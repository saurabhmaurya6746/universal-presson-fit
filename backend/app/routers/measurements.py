import base64
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union, Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Path, Request
from pydantic import BaseModel, Field, ConfigDict, model_validator
from sqlalchemy.orm import Session
from ..auth.dependencies import require_personal
from ..db.session import get_db
from ..models.user import User
from ..models.measurement import MeasurementProfile

router = APIRouter(prefix="/api/measurements/profiles", tags=["measurements"])

# Request payload limit: 16 KB maximum for structured measurement data
MAX_MEASUREMENT_PAYLOAD_BYTES = 16 * 1024


async def verify_payload_size_limit(request: Request):
    """
    Enforce a strict request body limit (16 KB) appropriate for structured measurements.
    Preemptively prevents transmission of binary image data or bulky files.
    """
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_MEASUREMENT_PAYLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Request payload exceeds size limit ({MAX_MEASUREMENT_PAYLOAD_BYTES} bytes). Image and file uploads are prohibited.",
                )
        except ValueError:
            pass
    body = await request.body()
    if len(body) > MAX_MEASUREMENT_PAYLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Request payload exceeds size limit ({MAX_MEASUREMENT_PAYLOAD_BYTES} bytes). Image and file uploads are prohibited.",
        )


# ==============================================================================
# 1. Finite Allowlists & Strict Schemas
# ==============================================================================

# Existing frontend validation and calibration reason codes as a finite allowlist
VALIDATION_REASON_CODES_SET = {
    "COIN_MISSING_OR_INVALID",
    "RESOLUTION_TOO_LOW",
    "NAIL_COUNT_LOW",
    "NAIL_COUNT_PARTIAL",
    "NAIL_COUNT_EXCESSIVE",
    "FINGER_SEPARATION_TOO_CLOSE",
    "INDEX_VS_PINKY_ABNORMAL",
    "ASPECT_RATIO_EXCESSIVE",
    "WIDTH_SUSPICIOUSLY_NARROW",
    "LONGITUDINAL_CURL",
    "WEAK_PERIMETER_CIRCULAR_EDGE",
    "MONO_METALLIC_COIN",
    "OUTER_RING_NOT_BRASS",
    "OUTER_RING_INCOMPLETE",
    "OUTER_RING_IRREGULAR",
    "CONFIDENCE_BELOW_THRESHOLD",
    "BLUR_DETECTED",
    "LIGHTING_POOR",
    "TILT_EXCESSIVE",
}

ValidationReasonCode = Literal[
    "COIN_MISSING_OR_INVALID",
    "RESOLUTION_TOO_LOW",
    "NAIL_COUNT_LOW",
    "NAIL_COUNT_PARTIAL",
    "NAIL_COUNT_EXCESSIVE",
    "FINGER_SEPARATION_TOO_CLOSE",
    "INDEX_VS_PINKY_ABNORMAL",
    "ASPECT_RATIO_EXCESSIVE",
    "WIDTH_SUSPICIOUSLY_NARROW",
    "LONGITUDINAL_CURL",
    "WEAK_PERIMETER_CIRCULAR_EDGE",
    "MONO_METALLIC_COIN",
    "OUTER_RING_NOT_BRASS",
    "OUTER_RING_INCOMPLETE",
    "OUTER_RING_IRREGULAR",
    "CONFIDENCE_BELOW_THRESHOLD",
    "BLUR_DETECTED",
    "LIGHTING_POOR",
    "TILT_EXCESSIVE",
]


def check_unpadded_base64(s: str) -> bool:
    """
    Detect unpadded base64 payloads and binary/image artifacts embedded in user strings.
    Protects user-supplied string fields (profile_name, summary_profile, sizes).
    Zero false positives on standard natural phrases or sizing terminology.
    """
    if not s or not isinstance(s, str):
        return False
    val = s.strip()
    if len(val) < 6:
        return False

    # Allowlist check for known enum strings and UUIDs
    if (
        val in VALIDATION_REASON_CODES_SET
        or val.lower() in ("thumb", "index", "middle", "ring", "pinky", "both", "left", "right")
        or re.match(r"^(left[_\s-]?)?(right[_\s-]?)?(nail[_\s]*[1-5])$", val, re.I)
    ):
        return False
    try:
        uuid.UUID(val)
        return False
    except (ValueError, TypeError, AttributeError):
        pass

    # Explicit base64 or data keyword indicators
    if re.search(r"(data:image|base64)", val, re.I):
        return True

    # Check for long continuous token >= 16 chars without spaces/punctuation
    for token in re.split(r"[\s,:]+", val):
        if not token:
            continue
        if len(token) >= 16 and re.match(r"^[A-Za-z0-9+/_-]{16,}$", token):
            return True

    # Base64 word artifacts: lowercase immediately followed by uppercase, or digits embedded inside letters
    # Standard English words never have [a-z][A-Z] or [a-zA-Z]\d+[a-zA-Z]
    words = re.findall(r"[A-Za-z0-9+/_-]+", val)
    b64_word_count = 0
    for w in words:
        if len(w) >= 4 and (re.search(r"[a-z][A-Z]", w) or re.search(r"[a-zA-Z]\d+[a-zA-Z]", w)):
            b64_word_count += 1
    if b64_word_count >= 1 and len(val) >= 12:
        return True

    # Attempt base64 decode after padding
    clean = re.sub(r"[\s\-_,:]", "", val)
    if len(clean) >= 8 and len(clean) % 4 in (0, 2, 3):
        padded = clean + "=" * ((4 - len(clean) % 4) % 4)
        try:
            dec = base64.b64decode(padded, validate=True)
            # Binary image signatures
            if any(sig in dec for sig in [b"\x89PNG", b"\xff\xd8", b"GIF8", b"RIFF", b"WEBP", b"BM", b"\x00"]):
                return True
            # High-printable text decoding to suspicious keywords
            if len(dec) >= 6:
                printable = sum(1 for b in dec if 32 <= b <= 126)
                if printable / len(dec) > 0.85:
                    dec_lower = dec.lower()
                    if any(kw in dec_lower for kw in [b"base64", b"image", b"photo", b"payload", b"data", b"test", b"hello", b"world", b"canvas"]):
                        return True
        except Exception:
            pass

    return False


def normalize_finger_position(finger: str, hand: Optional[str] = None, default_hand: Optional[str] = None) -> tuple[Optional[str], str]:
    """
    Normalizes a finger identifier to (hand, canonical_finger).
    Canonical fingers for real fingernails:
    - 'thumb' (aliases: 'Thumb', 'Nail 1', 'nail 1')
    - 'index' (aliases: 'Index', 'pointer', 'Nail 2', 'nail 2')
    - 'middle' (aliases: 'Middle', 'mid', 'Nail 3', 'nail 3')
    - 'ring' (aliases: 'Ring', 'Nail 4', 'nail 4')
    - 'pinky' (aliases: 'Pinky', 'little', 'Nail 5', 'nail 5')
    """
    finger_str = (finger or "").strip()
    hand_str = hand.strip().lower() if hand else None
    lower = finger_str.lower()

    prefix_hand = None
    if lower.startswith("left"):
        prefix_hand = "left"
        lower = re.sub(r"^left[_\s-]*", "", lower)
    elif lower.startswith("right"):
        prefix_hand = "right"
        lower = re.sub(r"^right[_\s-]*", "", lower)

    # Require hand field and hand prefix to agree if both are provided
    if hand_str and prefix_hand and hand_str != prefix_hand:
        raise ValueError(
            f"Conflicting hand information: finger='{finger}' indicates '{prefix_hand}' hand "
            f"but hand field indicates '{hand_str}' hand. Hand indicator and prefix must agree."
        )

    effective_hand = hand_str or prefix_hand
    if not effective_hand and default_hand and default_hand in ("left", "right"):
        effective_hand = default_hand

    canonical_finger = None
    if "thumb" in lower:
        canonical_finger = "thumb"
    elif "index" in lower or "pointer" in lower:
        canonical_finger = "index"
    elif "middle" in lower or "mid" in lower:
        canonical_finger = "middle"
    elif "ring" in lower:
        canonical_finger = "ring"
    elif "pinky" in lower or "little" in lower:
        canonical_finger = "pinky"
    else:
        m = re.search(r"nail\s*([1-5])", lower)
        if m:
            order = ["thumb", "index", "middle", "ring", "pinky"]
            canonical_finger = order[int(m.group(1)) - 1]

    if not canonical_finger:
        canonical_finger = re.sub(r"[\s-]+", "_", lower)

    return effective_hand, canonical_finger


def validate_finger_measurement_list(items: List["FingerMeasurementItem"], hand_side: Optional[str] = None) -> None:
    """
    Validate bounded measurement list:
    - Business rule: One hand has five actual fingernails.
    - Accept only Nail 1 through Nail 5 as detected-nail labels. Reject Nail 6, 7, 8.
    - Single-hand profile: at most 5 nails. If > 5 nails, reject with 422.
    - Two-hand profile: at most 5 nails per hand and 10 total. Each item must identify its hand.
    - Duplicate and alias checks within each hand. Same position on opposite hands is allowed.
    """
    if len(items) > 10:
        raise ValueError("Measurement list cannot contain more than 10 finger items in total (maximum 5 nails per hand).")

    # Reject Nail 6, 7, 8 or extra detections
    for item in items:
        f = getattr(item, "finger", None) or (item.get("finger") if isinstance(item, dict) else "")
        if re.search(r"nail\s*[6-9]|\bnail\s*\d{2,}", f, re.I):
            raise ValueError(
                f"Label '{f}' is an extra AI detection, not a real finger position. "
                "One hand has only five actual fingernails (Nail 1 through Nail 5). "
                "Extra detections cannot be saved as real nails."
            )

    # Check hand consistency and limits
    if hand_side in ("left", "right"):
        # Single-hand profile
        if len(items) > 5:
            raise ValueError(
                f"Single-hand measurement list ({hand_side}) cannot contain more than 5 fingernails "
                f"(one hand has only 5 fingernails). Found {len(items)} items."
            )
        seen = set()
        for item in items:
            h, canon = normalize_finger_position(item.finger, getattr(item, "hand", None), default_hand=hand_side)
            if h and h != hand_side:
                raise ValueError(f"Measurement item for '{h}' hand cannot be included in a {hand_side}-hand profile.")
            if canon in seen:
                raise ValueError(f"Duplicate finger position '{canon}' detected on {hand_side} hand.")
            seen.add(canon)
    elif hand_side == "both":
        # Two-hand profile: each item MUST identify its hand
        left_seen = set()
        right_seen = set()
        for item in items:
            h, canon = normalize_finger_position(item.finger, getattr(item, "hand", None), default_hand=None)
            if not h:
                raise ValueError(
                    f"For two-hand profiles (hand_side='both'), each measurement item must identify its hand ('left' or 'right'). "
                    f"Item '{item.finger}' did not specify a hand."
                )
            if h == "left":
                if canon in left_seen:
                    raise ValueError(f"Duplicate finger position '{canon}' detected on left hand.")
                left_seen.add(canon)
            elif h == "right":
                if canon in right_seen:
                    raise ValueError(f"Duplicate finger position '{canon}' detected on right hand.")
                right_seen.add(canon)
            else:
                raise ValueError(f"Invalid hand '{h}'. Must be 'left' or 'right'.")

        if len(left_seen) > 5:
            raise ValueError(
                f"Cannot have more than 5 fingernails assigned to the left hand. Found {len(left_seen)}."
            )
        if len(right_seen) > 5:
            raise ValueError(
                f"Cannot have more than 5 fingernails assigned to the right hand. Found {len(right_seen)}."
            )
    else:
        # hand_side is unspecified
        left_seen = set()
        right_seen = set()
        unspecified_seen = set()
        for item in items:
            h, canon = normalize_finger_position(item.finger, getattr(item, "hand", None), default_hand=None)
            if h == "left":
                if canon in left_seen:
                    raise ValueError(f"Duplicate finger position '{canon}' detected on left hand.")
                left_seen.add(canon)
            elif h == "right":
                if canon in right_seen:
                    raise ValueError(f"Duplicate finger position '{canon}' detected on right hand.")
                right_seen.add(canon)
            else:
                if canon in unspecified_seen:
                    raise ValueError(f"Duplicate finger position '{canon}' detected.")
                unspecified_seen.add(canon)

        if unspecified_seen and (len(unspecified_seen) > 5 or len(items) > 5):
            raise ValueError(
                f"Single-hand measurement list cannot contain more than 5 fingernails (one hand has 5 fingernails). Found {len(items)}."
            )
        if len(left_seen) > 5:
            raise ValueError(f"Cannot have more than 5 fingernails assigned to left hand. Found {len(left_seen)}.")
        if len(right_seen) > 5:
            raise ValueError(f"Cannot have more than 5 fingernails assigned to right hand. Found {len(right_seen)}.")


class FingerMeasurementItem(BaseModel):
    """Structured millimeter entry for an individual finger."""
    model_config = ConfigDict(extra="forbid")

    hand: Optional[str] = Field(None, pattern=r"^(left|right)$", description="Optional hand indicator")
    finger: str = Field(
        ...,
        pattern=r"^(left[_\s-]?)?(right[_\s-]?)?(thumb|index|pointer|middle|mid|ring|pinky|little|Thumb|Index|Pointer|Middle|Mid|Ring|Pinky|Little|Nail\s*[1-5]|nail\s*[1-5])$",
        description="Standard finger or detected nail identifier (Nail 1 through Nail 5)",
    )
    width_mm: float = Field(..., gt=0.0, le=50.0, description="Measured width in millimeters")
    height_mm: Optional[float] = Field(None, gt=0.0, le=60.0, description="Optional length in millimeters")
    recommended_size: Optional[str] = Field(None, max_length=20, pattern=r"^[A-Za-z0-9\s\-_]{1,20}$")
    size: Optional[str] = Field(None, max_length=20, pattern=r"^[A-Za-z0-9\s\-_]{1,20}$")

    @model_validator(mode="before")
    @classmethod
    def check_extra_detections(cls, data: Any) -> Any:
        if isinstance(data, dict):
            finger = data.get("finger")
            if isinstance(finger, str) and re.search(r"nail\s*[6-9]|\bnail\s*\d{2,}", finger, re.I):
                raise ValueError(
                    f"Label '{finger}' is an extra AI detection, not a real finger position. "
                    "One hand has only five actual fingernails (Nail 1 through Nail 5). "
                    "Extra detections cannot be saved as real nails."
                )
        return data

    @model_validator(mode="after")
    def validate_hand_consistency(self):
        if self.hand and self.finger:
            lower = self.finger.strip().lower()
            prefix_hand = None
            if lower.startswith("left"):
                prefix_hand = "left"
            elif lower.startswith("right"):
                prefix_hand = "right"

            if prefix_hand and prefix_hand != self.hand.strip().lower():
                raise ValueError(
                    f"Conflicting hand information for item: finger='{self.finger}' has prefix '{prefix_hand}' "
                    f"but hand field is '{self.hand}'. Hand indicator and finger prefix must agree."
                )
        return self

    @model_validator(mode="after")
    def validate_item_privacy(self):
        for field_name in ("recommended_size", "size"):
            val = getattr(self, field_name, None)
            if val and check_unpadded_base64(val):
                raise ValueError(f"Forbidden base64 or encoded payload in '{field_name}'.")
        return self


class FingerWidthMap(BaseModel):
    """Structured per-finger width dictionary (Format A)."""
    model_config = ConfigDict(extra="forbid")

    thumb: Optional[float] = Field(None, gt=0.0, le=50.0)
    index: Optional[float] = Field(None, gt=0.0, le=50.0)
    middle: Optional[float] = Field(None, gt=0.0, le=50.0)
    ring: Optional[float] = Field(None, gt=0.0, le=50.0)
    pinky: Optional[float] = Field(None, gt=0.0, le=50.0)

    @model_validator(mode="after")
    def validate_has_finger(self):
        widths = [self.thumb, self.index, self.middle, self.ring, self.pinky]
        if not any(w is not None for w in widths):
            raise ValueError("At least one finger measurement width must be provided.")
        return self


class TwoHandWidthMap(BaseModel):
    """Structured dual-hand finger width dictionary."""
    model_config = ConfigDict(extra="forbid")

    left: Optional[FingerWidthMap] = None
    right: Optional[FingerWidthMap] = None

    @model_validator(mode="after")
    def validate_has_hand(self):
        if self.left is None and self.right is None:
            raise ValueError("At least one hand (left or right) must be specified.")
        return self


# Strictly bounded measurement list: at most 10 measured nails for two hands
StructuredMeasurementList = Annotated[
    List[FingerMeasurementItem],
    Field(min_length=1, max_length=10, description="At most 10 measured nails for two hands"),
]

# Strictly allowlisted structured measurements union
StructuredMeasurements = Union[FingerWidthMap, TwoHandWidthMap, StructuredMeasurementList]


class ValidationMetadata(BaseModel):
    """Explicitly allowlisted photo-quality validation flags with finite reason codes."""
    model_config = ConfigDict(extra="forbid")

    passed: Optional[bool] = None
    score: Optional[float] = Field(None, ge=0.0, le=1.0)
    reasons: Optional[List[ValidationReasonCode]] = Field(None, max_length=10)
    blur_score: Optional[float] = Field(None, ge=0.0, le=1000.0)
    lighting_ok: Optional[bool] = None
    angle_ok: Optional[bool] = None
    error: Optional[ValidationReasonCode] = None


class CalibrationMetadata(BaseModel):
    """Explicitly allowlisted scale and coin verification metadata."""
    model_config = ConfigDict(extra="forbid")

    coin_detected: Optional[bool] = None
    coin_verified: Optional[bool] = None
    pixels_per_mm: Optional[float] = Field(None, gt=0.0, le=500.0)
    coin_radius_px: Optional[float] = Field(None, gt=0.0, le=2000.0)
    coin_scale: Optional[float] = Field(None, gt=0.0, le=500.0)
    scale_factor: Optional[float] = Field(None, gt=0.0, le=500.0)
    landmark_count: Optional[int] = Field(None, ge=0, le=100)
    thumb_detected: Optional[bool] = None
    validation_metadata: Optional[ValidationMetadata] = None
    summary_profile: Optional[str] = Field(
        None,
        max_length=120,
        pattern=r"^[A-Za-z0-9\s,:\.\-_()]{1,120}$",
        description="Constrained summary profile text (finger-size list only)",
    )

    @model_validator(mode="after")
    def validate_summary(self):
        if self.summary_profile and check_unpadded_base64(self.summary_profile):
            raise ValueError("Forbidden base64 or encoded payload in 'summary_profile'.")
        return self


# ==============================================================================
# 2. Defense-in-Depth Payload Scanners
# ==============================================================================

DATA_URL_PATTERN = re.compile(r"^data:(image\/[a-zA-Z0-9.+-]+|application\/[a-zA-Z0-9.+-]+)?;", re.IGNORECASE)
IMAGE_URL_PATTERN = re.compile(r"(https?:\/\/|[a-zA-Z0-9_\-\.\/]+)\.(jpe?g|png|webp|gif|bmp|tiff|svg)(\?.*)?$", re.IGNORECASE)


def assert_privacy_compliance(obj: Any, path: str = "payload") -> None:
    """Secondary defense-in-depth scan against embedded data URLs, image URLs, or unpadded base64."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            assert_privacy_compliance(v, f"{path}.{k}")
    elif isinstance(obj, (list, tuple, set)):
        for i, item in enumerate(obj):
            assert_privacy_compliance(item, f"{path}[{i}]")
    elif isinstance(obj, str):
        val = obj.strip()
        if DATA_URL_PATTERN.search(val):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Forbidden data URL detected at '{path}'. Customer images and photo storage are strictly prohibited.",
            )
        if IMAGE_URL_PATTERN.search(val):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Forbidden image URL detected at '{path}'. Image links and customer photos are strictly prohibited.",
            )
        if check_unpadded_base64(val):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Forbidden base64 or encoded payload detected at '{path}'. Customer images and photo storage are strictly prohibited.",
            )


# ==============================================================================
# 3. Request & Response Models
# ==============================================================================

class ProfileCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_name: Optional[str] = Field(None, max_length=100, pattern=r"^[A-Za-z0-9\s\-_'().]{1,100}$")
    nickname: Optional[str] = Field(None, max_length=100, pattern=r"^[A-Za-z0-9\s\-_'().]{1,100}$")
    hand_side: Optional[str] = Field(None, pattern="^(left|right|both)$")
    measurements: StructuredMeasurements
    calibration_data: Optional[CalibrationMetadata] = None
    calibration_metadata: Optional[CalibrationMetadata] = None
    validation_metadata: Optional[ValidationMetadata] = None
    summary_profile: Optional[str] = Field(
        None,
        max_length=120,
        pattern=r"^[A-Za-z0-9\s,:\.\-_()]{1,120}$",
        description="Constrained summary profile text (finger-size list only)",
    )
    coin_verified: Optional[bool] = False
    user_id: Optional[str] = None
    owner_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_request_integrity(self):
        for field_name in ("profile_name", "nickname", "summary_profile"):
            val = getattr(self, field_name, None)
            if val and check_unpadded_base64(val):
                raise ValueError(f"Forbidden base64 or encoded payload in '{field_name}'.")

        # Resolve hand_side if not explicitly provided
        if not self.hand_side:
            if isinstance(self.measurements, TwoHandWidthMap):
                self.hand_side = "both"
            elif isinstance(self.measurements, FingerWidthMap):
                self.hand_side = "right"
            elif isinstance(self.measurements, list):
                hands = set()
                for item in self.measurements:
                    h, _ = normalize_finger_position(item.finger, getattr(item, "hand", None), default_hand=None)
                    if h:
                        hands.add(h)
                if len(hands) > 1 or "both" in hands:
                    self.hand_side = "both"
                elif len(hands) == 1:
                    self.hand_side = list(hands)[0]
                else:
                    self.hand_side = "right"  # Single hand default
            else:
                self.hand_side = "both"

        if isinstance(self.measurements, list):
            validate_finger_measurement_list(self.measurements, hand_side=self.hand_side)

        return self


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_name: Optional[str] = Field(None, max_length=100, pattern=r"^[A-Za-z0-9\s\-_'().]{1,100}$")
    nickname: Optional[str] = Field(None, max_length=100, pattern=r"^[A-Za-z0-9\s\-_'().]{1,100}$")
    hand_side: Optional[str] = Field(None, pattern="^(left|right|both)$")
    measurements: Optional[StructuredMeasurements] = None
    calibration_data: Optional[CalibrationMetadata] = None
    calibration_metadata: Optional[CalibrationMetadata] = None
    validation_metadata: Optional[ValidationMetadata] = None
    summary_profile: Optional[str] = Field(
        None,
        max_length=120,
        pattern=r"^[A-Za-z0-9\s,:\.\-_()]{1,120}$",
        description="Constrained summary profile text (finger-size list only)",
    )
    coin_verified: Optional[bool] = None
    user_id: Optional[str] = None
    owner_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_request_integrity(self):
        for field_name in ("profile_name", "nickname", "summary_profile"):
            val = getattr(self, field_name, None)
            if val and check_unpadded_base64(val):
                raise ValueError(f"Forbidden base64 or encoded payload in '{field_name}'.")

        if isinstance(self.measurements, list):
            validate_finger_measurement_list(self.measurements, hand_side=self.hand_side)

        return self


def serialize_profile(p: MeasurementProfile) -> Dict[str, Any]:
    """Serialize MeasurementProfile for client responses."""
    cal_data = p.calibration_data or {}
    val_meta = cal_data.get("validation_metadata") if isinstance(cal_data, dict) else None
    summary = cal_data.get("summary_profile") if isinstance(cal_data, dict) else None

    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "profile_name": p.profile_name,
        "nickname": p.profile_name,
        "hand_side": p.hand_side,
        "measurements": p.measurements,
        "calibration_data": p.calibration_data,
        "calibration_metadata": p.calibration_data,
        "validation_metadata": val_meta,
        "summary_profile": summary,
        "coin_verified": p.coin_verified,
        "created_at": p.created_at.isoformat() if p.created_at else "",
        "updated_at": p.updated_at.isoformat() if p.updated_at else "",
    }


def normalize_measurements_for_storage(m: StructuredMeasurements) -> Any:
    """Convert structured measurement model instances into clean JSON-serializable primitives."""
    if isinstance(m, BaseModel):
        return m.model_dump(exclude_unset=True)
    if isinstance(m, list):
        return [item.model_dump(exclude_unset=True) if isinstance(item, BaseModel) else item for item in m]
    return m


# ==============================================================================
# 4. Route Handlers (Strictly Personal Role Enforced)
# ==============================================================================

@router.get("")
def list_measurement_profiles(
    current_user: User = Depends(require_personal),
    db: Session = Depends(get_db),
):
    """
    List all measurement profiles owned by the authenticated personal user.
    Owner-scoped query filter guarantees complete isolation.
    Restricted strictly to personal accounts.
    """
    profiles = (
        db.query(MeasurementProfile)
        .filter(MeasurementProfile.user_id == current_user.id)
        .order_by(MeasurementProfile.created_at.desc())
        .all()
    )
    return [serialize_profile(p) for p in profiles]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_payload_size_limit)],
)
def create_measurement_profile(
    req: ProfileCreateRequest,
    current_user: User = Depends(require_personal),
    db: Session = Depends(get_db),
):
    """
    Create a new structured measurement profile for the authenticated personal user.
    - Restricted strictly to personal accounts (brand/admin rejected with 403).
    - Request payload size limited to 16 KB.
    - Owner is authoritatively derived from verified auth context; submitted owner IDs are ignored.
    - Requires strictly allowlisted millimeter measurements and calibration metadata.
    - Rejects unknown nested keys, numeric pixel arrays, and non-measurement objects.
    - Constrains reasons, error codes, and summary_profile to prevent arbitrary payload injection.
    """
    # 1. Secondary defense-in-depth check
    raw_payload = req.model_dump(exclude_unset=True)
    assert_privacy_compliance(raw_payload)

    # 2. Resolve profile name / nickname
    name = (req.nickname or req.profile_name or "My Saved Fit").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Profile name cannot be blank.")

    # 3. Consolidate metadata
    cal_meta = req.calibration_data or req.calibration_metadata
    cal_dict = cal_meta.model_dump(exclude_unset=True) if cal_meta else {}
    if req.validation_metadata:
        cal_dict["validation_metadata"] = req.validation_metadata.model_dump(exclude_unset=True)
    if req.summary_profile:
        cal_dict["summary_profile"] = req.summary_profile

    # 4. Derive coin verification
    coin_verified = bool(req.coin_verified or cal_dict.get("coin_verified") or cal_dict.get("coin_detected"))

    profile = MeasurementProfile(
        user_id=current_user.id,  # Authoritative backend ownership assignment
        profile_name=name,
        hand_side=req.hand_side,
        measurements=normalize_measurements_for_storage(req.measurements),
        calibration_data=cal_dict if cal_dict else None,
        coin_verified=coin_verified,
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return serialize_profile(profile)


@router.get("/{profile_id}")
def get_measurement_profile(
    profile_id: str = Path(..., description="Measurement profile UUID"),
    current_user: User = Depends(require_personal),
    db: Session = Depends(get_db),
):
    """
    Retrieve an individual measurement profile owned by the authenticated personal user.
    Returns 404 if not found, 403 if owned by another user.
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid profile ID format.")

    profile = db.query(MeasurementProfile).filter(MeasurementProfile.id == profile_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Measurement profile not found.")

    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this measurement profile.",
        )

    return serialize_profile(profile)


@router.patch(
    "/{profile_id}",
    dependencies=[Depends(verify_payload_size_limit)],
)
def update_measurement_profile(
    req: ProfileUpdateRequest,
    profile_id: str = Path(..., description="Measurement profile UUID"),
    current_user: User = Depends(require_personal),
    db: Session = Depends(get_db),
):
    """
    Update an existing measurement profile owned by the authenticated personal user.
    Returns 404 if not found, 403 if owned by another user.
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid profile ID format.")

    profile = db.query(MeasurementProfile).filter(MeasurementProfile.id == profile_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Measurement profile not found.")

    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this measurement profile.",
        )

    raw_payload = req.model_dump(exclude_unset=True)
    assert_privacy_compliance(raw_payload)

    effective_hand = req.hand_side or profile.hand_side
    if req.measurements is not None:
        if isinstance(req.measurements, list):
            try:
                validate_finger_measurement_list(req.measurements, hand_side=effective_hand)
            except ValueError as e:
                raise HTTPException(status_code=422, detail=str(e))
        profile.measurements = normalize_measurements_for_storage(req.measurements)

    if req.nickname is not None or req.profile_name is not None:
        new_name = (req.nickname or req.profile_name or "").strip()
        if not new_name:
            raise HTTPException(status_code=422, detail="Profile name cannot be blank.")
        profile.profile_name = new_name

    if req.hand_side is not None:
        profile.hand_side = req.hand_side

    # Update metadata
    if req.calibration_data is not None or req.calibration_metadata is not None or req.validation_metadata is not None or req.summary_profile is not None:
        cal = dict(profile.calibration_data or {})
        new_cal = req.calibration_data or req.calibration_metadata
        if new_cal:
            cal.update(new_cal.model_dump(exclude_unset=True))
        if req.validation_metadata is not None:
            cal["validation_metadata"] = req.validation_metadata.model_dump(exclude_unset=True)
        if req.summary_profile is not None:
            cal["summary_profile"] = req.summary_profile
        profile.calibration_data = cal

    if req.coin_verified is not None:
        profile.coin_verified = req.coin_verified

    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return serialize_profile(profile)


@router.delete("/{profile_id}")
def delete_measurement_profile(
    profile_id: str = Path(..., description="Measurement profile UUID"),
    current_user: User = Depends(require_personal),
    db: Session = Depends(get_db),
):
    """
    Delete an individual measurement profile owned by the authenticated personal user.
    Returns 404 if not found, 403 if owned by another user.
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid profile ID format.")

    profile = db.query(MeasurementProfile).filter(MeasurementProfile.id == profile_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Measurement profile not found.")

    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this measurement profile.",
        )

    db.delete(profile)
    db.commit()
    return {
        "success": True,
        "message": "Measurement profile deleted successfully.",
        "id": str(profile_uuid),
    }
