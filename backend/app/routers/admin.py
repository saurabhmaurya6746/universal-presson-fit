import uuid
import re
import math
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from pydantic import BaseModel, ConfigDict, Field, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db.session import get_db
from ..auth.dependencies import require_admin
from ..models.user import User
from ..models.brand import Brand
from ..models.chart import SizingChart, SizingChartEntry
from ..models.trial import BrandTrial
from ..models.audit import AdminAuditEvent

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# ==============================================================================
# 1. Pydantic Schemas for Requests & Responses
# ==============================================================================

class AdminUserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    email_verified: bool
    created_at: str
    updated_at: str


class AdminUpdateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Optional[Literal["personal", "brand", "admin"]] = None
    is_active: Optional[bool] = None


class AdminTrialSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    status: str
    start_date: str
    end_date: str
    selected_plan: str
    renewal_intent: str
    days_remaining: int
    is_expired: bool
    notes: Optional[str] = None


class AdminBrandDetailResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    slug: str
    owner_id: str
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    city: Optional[str] = None
    country: str
    status: str
    is_public: bool
    shapes: List[str]
    logo_url: Optional[str] = None
    is_official: bool = False
    admin_notes: Optional[str] = None
    trial: Optional[AdminTrialSummary] = None
    created_at: str
    updated_at: str


class AdminReviewActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    admin_notes: Optional[str] = Field(None, max_length=500)
    reason: Optional[str] = Field(None, max_length=500)


class AdminChartReviewResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    brand_id: str
    brand_name: str
    brand_status: str
    brand_is_public: bool
    is_official: bool = False
    chart_name: str
    format: str
    unit: str
    status: str
    is_public: bool
    version: int
    entry_count: int
    custom_notes: Optional[str] = None
    source_url: Optional[str] = None
    verification_status: Optional[str] = None
    created_at: str
    updated_at: str


class AdminChartEntryPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = None
    size_label: str = Field(..., max_length=50)
    shape: Optional[str] = Field(None, max_length=100)
    finger: Optional[str] = Field(None, max_length=50)
    typical_finger: Optional[str] = Field(None, max_length=150)
    width_mm: Optional[float] = None
    length_mm: Optional[float] = None
    min_width_mm: Optional[float] = None
    max_width_mm: Optional[float] = None
    min_length_mm: Optional[float] = None
    max_length_mm: Optional[float] = None
    thickness_mm: Optional[float] = None
    is_approximate: bool = False
    thumb_width_mm: Optional[float] = None
    index_width_mm: Optional[float] = None
    middle_width_mm: Optional[float] = None
    ring_width_mm: Optional[float] = None
    pinky_width_mm: Optional[float] = None
    display_order: int = 0


class AdminCreateBrandChartRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    brand_id: Optional[str] = None
    brand_name: Optional[str] = Field(None, max_length=100)
    brand_slug: Optional[str] = Field(None, max_length=100)
    brand_description: Optional[str] = None
    brand_tagline: Optional[str] = Field(None, max_length=200)
    logo_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    shapes: List[str] = Field(default_factory=list)

    chart_name: str = Field(..., max_length=150)
    format: str = Field(..., max_length=32)
    unit: str = Field(default="mm", max_length=16)
    status: Literal["draft", "published"] = "draft"
    is_public: bool = False
    custom_notes: Optional[str] = None
    source_url: Optional[str] = Field(None, max_length=500)
    source_notes: Optional[str] = None
    verification_status: str = Field(default="user_provided", max_length=64)
    entries: List[AdminChartEntryPayload] = Field(default_factory=list)


class AdminUpdateBrandChartRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    brand_name: Optional[str] = Field(None, max_length=100)
    brand_description: Optional[str] = None
    brand_tagline: Optional[str] = Field(None, max_length=200)
    logo_url: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=255)
    shapes: Optional[List[str]] = None

    chart_name: Optional[str] = Field(None, max_length=150)
    format: Optional[str] = Field(None, max_length=32)
    unit: Optional[str] = Field(None, max_length=16)
    status: Optional[Literal["draft", "published"]] = None
    is_public: Optional[bool] = None
    custom_notes: Optional[str] = None
    source_url: Optional[str] = Field(None, max_length=500)
    source_notes: Optional[str] = None
    verification_status: Optional[str] = Field(None, max_length=64)
    entries: Optional[List[AdminChartEntryPayload]] = None


class AdminChartDetailResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    brand_id: str
    brand_name: str
    brand_slug: str
    brand_logo_url: Optional[str] = None
    brand_description: Optional[str] = None
    brand_website: Optional[str] = None
    brand_shapes: List[str]
    is_official: bool
    chart_name: str
    format: str
    unit: str
    status: str
    is_public: bool
    custom_notes: Optional[str] = None
    source_url: Optional[str] = None
    source_notes: Optional[str] = None
    verification_status: str
    version: int
    entries: List[Dict[str, Any]]
    created_at: str
    updated_at: str


class AdminSizingChartListItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    brand_id: str
    brand_name: str
    brand_slug: str
    brand_logo_url: Optional[str] = None
    is_official: bool
    chart_name: str
    format: str
    unit: str
    status: str
    is_public: bool
    version: int
    entry_count: int
    shapes_count: int
    source_url: Optional[str] = None
    verification_status: str
    updated_at: str


class AdminTrialResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    brand_id: str
    brand_name: str
    start_date: str
    end_date: str
    status: str
    renewal_intent: str
    selected_plan: str
    notes: Optional[str] = None
    days_remaining: int
    is_expired: bool
    created_at: str
    updated_at: str


class AdminUpdateTrialRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[Literal["active", "ending_soon", "expired", "extended", "converted"]] = None
    renewal_intent: Optional[Literal["yes", "no", "pending", "not_asked"]] = None
    selected_plan: Optional[str] = Field(None, max_length=64)
    end_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)


class AdminAuditEventResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    admin_id: Optional[str] = None
    admin_email: Optional[str] = None
    action: str
    target_entity: str
    target_id: str
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    created_at: str


# ==============================================================================
# 2. Helpers
# ==============================================================================

SAFE_AUDIT_KEYS = {
    "role",
    "is_active",
    "status",
    "is_public",
    "end_date",
    "renewal_intent",
    "selected_plan_changed",
    "has_notes",
    "notes_updated",
}

VALID_AUDIT_ROLES = {"personal", "brand", "admin"}

VALID_AUDIT_STATUSES = {
    "active",
    "pending_review",
    "rejected",
    "suspended",
    "demo_sample",
    "draft",
    "published",
    "ending_soon",
    "expired",
    "extended",
    "converted",
}

VALID_AUDIT_RENEWAL_INTENTS = {"yes", "no", "pending", "not_asked"}

BOOLEAN_AUDIT_KEYS = {
    "is_active",
    "is_public",
    "selected_plan_changed",
    "has_notes",
    "notes_updated",
}

def sanitize_audit_state(state: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Ensure audit snapshots use explicit safe fields only with strict value and type validation.
    Strictly validates:
      - role: only "personal", "brand", or "admin"
      - status: only known product values: "active", "pending_review", "rejected", "suspended",
        "demo_sample", "draft", "published", "ending_soon", "expired", "extended", or "converted"
      - renewal_intent: only "yes", "no", "pending", or "not_asked"
      - end_date: only a valid canonical ISO datetime string matching the format generated by datetime.isoformat()
      - is_active, is_public, selected_plan_changed, has_notes, notes_updated: actual booleans only; reject strings and numbers
    Drops invalid values and unknown keys without logging or returning rejected values.
    selected_plan is strictly excluded; selected_plan_changed is boolean only.
    """
    if not isinstance(state, dict):
        return None
    cleaned: Dict[str, Any] = {}
    for k, v in state.items():
        k_lower = str(k).lower().strip()
        if k_lower == "role":
            if type(v) is str and v in VALID_AUDIT_ROLES:
                cleaned[k_lower] = v
        elif k_lower == "status":
            if type(v) is str and v in VALID_AUDIT_STATUSES:
                cleaned[k_lower] = v
        elif k_lower == "renewal_intent":
            if type(v) is str and v in VALID_AUDIT_RENEWAL_INTENTS:
                cleaned[k_lower] = v
        elif k_lower == "end_date":
            if type(v) is str:
                try:
                    dt = datetime.fromisoformat(v)
                    if dt.isoformat() == v:
                        cleaned[k_lower] = v
                except Exception:
                    pass
        elif k_lower in BOOLEAN_AUDIT_KEYS:
            if type(v) is bool:
                cleaned[k_lower] = v
    return cleaned


def record_audit_event(
    db: Session,
    admin_id: uuid.UUID,
    action: str,
    target_entity: str,
    target_id: uuid.UUID,
    previous_state: Optional[Dict[str, Any]] = None,
    new_state: Optional[Dict[str, Any]] = None,
) -> AdminAuditEvent:
    """
    Creates an immutable AdminAuditEvent row within the caller's active database transaction.
    Atomically commits with the domain mutation.
    Ensures previous_state and new_state only contain explicit safe fields.
    """
    event = AdminAuditEvent(
        id=uuid.uuid4(),
        admin_id=admin_id,
        action=action,
        target_entity=target_entity,
        target_id=target_id,
        previous_state=sanitize_audit_state(previous_state),
        new_state=sanitize_audit_state(new_state),
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)
    return event


def compute_trial_status(trial: BrandTrial) -> tuple[int, bool]:
    now = datetime.now(timezone.utc)
    delta = (trial.end_date - now).total_seconds()
    days_rem = max(0, math.ceil(delta / 86400.0)) if delta > 0 else 0
    is_exp = now >= trial.end_date or trial.status == "expired"
    return days_rem, is_exp


def build_trial_summary(trial: Optional[BrandTrial]) -> Optional[AdminTrialSummary]:
    if not trial:
        return None
    days_rem, is_exp = compute_trial_status(trial)
    return AdminTrialSummary(
        id=str(trial.id),
        status=trial.status,
        start_date=trial.start_date.isoformat() if trial.start_date else "",
        end_date=trial.end_date.isoformat() if trial.end_date else "",
        selected_plan=trial.selected_plan,
        renewal_intent=trial.renewal_intent,
        days_remaining=days_rem,
        is_expired=is_exp,
        notes=trial.notes,
    )


def serialize_admin_brand(brand: Brand) -> AdminBrandDetailResponse:
    owner = brand.owner
    return AdminBrandDetailResponse(
        id=str(brand.id),
        name=brand.name,
        slug=brand.slug,
        owner_id=str(brand.owner_id),
        owner_email=owner.email if owner else None,
        owner_name=owner.full_name if owner else None,
        contact_person=brand.contact_person,
        contact_email=brand.contact_email,
        tagline=brand.tagline,
        description=brand.description,
        website=brand.website,
        instagram=brand.instagram,
        city=brand.city,
        country=brand.country,
        status=brand.status,
        is_public=brand.is_public,
        shapes=brand.shapes or [],
        logo_url=brand.logo_url,
        is_official=brand.is_official,
        admin_notes=brand.admin_notes,
        trial=build_trial_summary(brand.trial),
        created_at=brand.created_at.isoformat() if brand.created_at else "",
        updated_at=brand.updated_at.isoformat() if brand.updated_at else "",
    )


# ==============================================================================
# 3. Route Handlers
# ==============================================================================

# --- A. Account Management ---

@router.get("/accounts", response_model=List[AdminUserResponse])
def list_accounts(
    role: Optional[Literal["personal", "brand", "admin"]] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search email or full name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    List user accounts with filters.
    Strictly excludes sensitive credentials (password_hash, tokens, sessions, measurements).
    """
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if search:
        s = f"%{search.strip().lower()}%"
        q = q.filter((func.lower(User.email).like(s)) | (func.lower(User.full_name).like(s)))

    users = q.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return [
        AdminUserResponse(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            email_verified=u.email_verified,
            created_at=u.created_at.isoformat() if u.created_at else "",
            updated_at=u.updated_at.isoformat() if u.updated_at else "",
        )
        for u in users
    ]


@router.patch("/accounts/{user_id}/status-or-role", response_model=AdminUserResponse)
def update_account_status_or_role(
    req: AdminUpdateUserRequest,
    user_id: str = Path(..., description="Target user UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Update target user's role or active status.
    Atomically writes an audit event.
    Prevents self-demotion and self-deactivation.
    """
    try:
        user_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid user ID format.")

    target_user = db.query(User).filter(User.id == user_uuid).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found.")

    if req.role is None and req.is_active is None:
        raise HTTPException(status_code=422, detail="At least one field ('role' or 'is_active') must be provided.")

    # Guardrails against self-demotion or self-deactivation
    if target_user.id == current_admin.id:
        if req.is_active is False:
            raise HTTPException(status_code=400, detail="Administrators cannot deactivate their own account.")
        if req.role is not None and req.role != "admin":
            raise HTTPException(status_code=400, detail="Administrators cannot demote their own account from admin.")

    previous_state = {
        "role": target_user.role,
        "is_active": target_user.is_active,
    }

    if req.role is not None:
        target_user.role = req.role
    if req.is_active is not None:
        target_user.is_active = req.is_active

    new_state = {
        "role": target_user.role,
        "is_active": target_user.is_active,
    }

    # Record transactional audit event
    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="user_status_or_role_updated",
        target_entity="users",
        target_id=target_user.id,
        previous_state=previous_state,
        new_state=new_state,
    )

    db.commit()
    db.refresh(target_user)

    return AdminUserResponse(
        id=str(target_user.id),
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_user.role,
        is_active=target_user.is_active,
        email_verified=target_user.email_verified,
        created_at=target_user.created_at.isoformat() if target_user.created_at else "",
        updated_at=target_user.updated_at.isoformat() if target_user.updated_at else "",
    )


# --- B. Brand Review & Lifecycle ---

@router.get("/brands", response_model=List[AdminBrandDetailResponse])
def list_brands_for_review(
    status_filter: Optional[Literal["active", "pending_review", "rejected", "suspended", "demo_sample"]] = Query(
        None, alias="status", description="Filter by brand review status"
    ),
    is_public: Optional[bool] = Query(None, description="Filter by public visibility"),
    search: Optional[str] = Query(None, description="Search brand name, slug, or contact email"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    List brands for administrative review, including owner info and trial summary.
    """
    q = db.query(Brand)
    if status_filter:
        q = q.filter(Brand.status == status_filter)
    if is_public is not None:
        q = q.filter(Brand.is_public == is_public)
    if search:
        s = f"%{search.strip().lower()}%"
        q = q.filter(
            (func.lower(Brand.name).like(s))
            | (func.lower(Brand.slug).like(s))
            | (func.lower(Brand.contact_email).like(s))
        )

    brands = q.order_by(Brand.created_at.desc()).offset(offset).limit(limit).all()
    return [serialize_admin_brand(b) for b in brands]


@router.post("/brands/{brand_id}/approve", response_model=AdminBrandDetailResponse)
def approve_brand(
    req: Optional[AdminReviewActionRequest] = None,
    brand_id: str = Path(..., description="Brand studio UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Approve a brand application (sets status='active').
    TRIAL INDEPENDENCE: Does NOT reset signup-time trial start/end dates.
    Pending application duration counts toward the 10-day trial.
    Does NOT force public visibility.
    Atomically records an audit event.
    """
    try:
        b_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    brand = db.query(Brand).filter(Brand.id == b_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand studio not found.")

    previous_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
    }

    brand.status = "active"
    notes_updated = False
    if req and req.admin_notes is not None:
        notes_updated = True
        brand.admin_notes = req.admin_notes.strip()

    new_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
        "notes_updated": notes_updated,
    }

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="brand_approved",
        target_entity="brands",
        target_id=brand.id,
        previous_state=previous_state,
        new_state=new_state,
    )

    db.commit()
    db.refresh(brand)
    return serialize_admin_brand(brand)


@router.post("/brands/{brand_id}/reject", response_model=AdminBrandDetailResponse)
def reject_brand(
    req: Optional[AdminReviewActionRequest] = None,
    brand_id: str = Path(..., description="Brand studio UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reject a brand application (sets status='rejected', is_public=False).
    Atomically records an audit event.
    """
    try:
        b_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    brand = db.query(Brand).filter(Brand.id == b_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand studio not found.")

    previous_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
    }

    brand.status = "rejected"
    brand.is_public = False
    notes_updated = False
    if req and (req.admin_notes or req.reason):
        note = req.admin_notes or req.reason
        notes_updated = True
        brand.admin_notes = note.strip()

    new_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
        "notes_updated": notes_updated,
    }

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="brand_rejected",
        target_entity="brands",
        target_id=brand.id,
        previous_state=previous_state,
        new_state=new_state,
    )

    db.commit()
    db.refresh(brand)
    return serialize_admin_brand(brand)


@router.post("/brands/{brand_id}/suspend", response_model=AdminBrandDetailResponse)
def suspend_brand(
    req: Optional[AdminReviewActionRequest] = None,
    brand_id: str = Path(..., description="Brand studio UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Suspend a brand studio (sets status='suspended').
    Excluded from public directory.
    Atomically records an audit event.
    """
    try:
        b_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    brand = db.query(Brand).filter(Brand.id == b_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand studio not found.")

    previous_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
    }

    brand.status = "suspended"
    notes_updated = False
    if req and (req.admin_notes or req.reason):
        note = req.admin_notes or req.reason
        notes_updated = True
        brand.admin_notes = note.strip()

    new_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
        "notes_updated": notes_updated,
    }

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="brand_suspended",
        target_entity="brands",
        target_id=brand.id,
        previous_state=previous_state,
        new_state=new_state,
    )

    db.commit()
    db.refresh(brand)
    return serialize_admin_brand(brand)


@router.post("/brands/{brand_id}/reactivate", response_model=AdminBrandDetailResponse)
def reactivate_brand(
    req: Optional[AdminReviewActionRequest] = None,
    brand_id: str = Path(..., description="Brand studio UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Reactivate a suspended brand studio (sets status='active').
    Atomically records an audit event.
    """
    try:
        b_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    brand = db.query(Brand).filter(Brand.id == b_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand studio not found.")

    previous_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
    }

    brand.status = "active"
    notes_updated = False
    if req and req.admin_notes is not None:
        notes_updated = True
        brand.admin_notes = req.admin_notes.strip()

    new_state = {
        "status": brand.status,
        "is_public": brand.is_public,
        "has_notes": bool(brand.admin_notes),
        "notes_updated": notes_updated,
    }

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="brand_reactivated",
        target_entity="brands",
        target_id=brand.id,
        previous_state=previous_state,
        new_state=new_state,
    )

    db.commit()
    db.refresh(brand)
    return serialize_admin_brand(brand)


# --- C. Sizing Chart Review ---

@router.get("/charts/review", response_model=List[AdminChartReviewResponse])
def review_sizing_charts(
    brand_id: Optional[str] = Query(None, description="Filter by brand UUID"),
    status_filter: Optional[Literal["draft", "published"]] = Query(None, alias="status", description="Filter by status"),
    format_filter: Optional[Literal["per_size", "width_ranges"]] = Query(None, alias="format", description="Filter by format"),
    is_public: Optional[bool] = Query(None, description="Filter by chart public visibility"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Review sizing charts across brands with status, format, and entry count.
    """
    q = db.query(SizingChart).join(Brand, SizingChart.brand_id == Brand.id)
    if brand_id:
        try:
            b_uuid = uuid.UUID(brand_id)
            q = q.filter(SizingChart.brand_id == b_uuid)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid brand ID filter format.")
    if status_filter:
        q = q.filter(SizingChart.status == status_filter)
    if format_filter:
        q = q.filter(SizingChart.format == format_filter)
    if is_public is not None:
        q = q.filter(SizingChart.is_public == is_public)

    charts = q.order_by(SizingChart.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for c in charts:
        entry_cnt = db.query(func.count(SizingChartEntry.id)).filter(SizingChartEntry.chart_id == c.id).scalar() or 0
        results.append(
            AdminChartReviewResponse(
                id=str(c.id),
                brand_id=str(c.brand_id),
                brand_name=c.brand.name if c.brand else "",
                brand_status=c.brand.status if c.brand else "",
                brand_is_public=c.brand.is_public if c.brand else False,
                chart_name=c.chart_name,
                format=c.format,
                unit=c.unit,
                status=c.status,
                is_public=c.is_public,
                version=c.version,
                entry_count=entry_cnt,
                custom_notes=c.custom_notes,
                created_at=c.created_at.isoformat() if c.created_at else "",
                updated_at=c.updated_at.isoformat() if c.updated_at else "",
            )
        )
    return results


# --- D. Trial Administration ---

@router.get("/trials/{brand_id}", response_model=AdminTrialResponse)
def get_brand_trial(
    brand_id: str = Path(..., description="Brand studio UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Get trial details for a brand.
    Expiry status is informational only.
    """
    try:
        b_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    trial = db.query(BrandTrial).filter(BrandTrial.brand_id == b_uuid).first()
    if not trial:
        raise HTTPException(status_code=404, detail="Brand trial record not found.")

    days_rem, is_exp = compute_trial_status(trial)

    return AdminTrialResponse(
        id=str(trial.id),
        brand_id=str(trial.brand_id),
        brand_name=trial.brand.name if trial.brand else "",
        start_date=trial.start_date.isoformat() if trial.start_date else "",
        end_date=trial.end_date.isoformat() if trial.end_date else "",
        status=trial.status,
        renewal_intent=trial.renewal_intent,
        selected_plan=trial.selected_plan,
        notes=trial.notes,
        days_remaining=days_rem,
        is_expired=is_exp,
        created_at=trial.created_at.isoformat() if trial.created_at else "",
        updated_at=trial.updated_at.isoformat() if trial.updated_at else "",
    )


@router.patch("/trials/{brand_id}", response_model=AdminTrialResponse)
def update_brand_trial(
    req: AdminUpdateTrialRequest,
    brand_id: str = Path(..., description="Brand studio UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Update trial parameters (status, end_date, plan, renewal_intent, notes).
    INFORMATIONAL ONLY: Marking status as 'expired' does NOT trigger billing,
    payment, auto-renewal, chart hiding, edit freezing, or deletion.
    Atomically records an audit event.
    """
    try:
        b_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    trial = db.query(BrandTrial).filter(BrandTrial.brand_id == b_uuid).first()
    if not trial:
        raise HTTPException(status_code=404, detail="Brand trial record not found.")

    previous_state = {
        "status": trial.status,
        "end_date": trial.end_date.isoformat() if trial.end_date else None,
        "renewal_intent": trial.renewal_intent,
        "has_notes": bool(trial.notes),
    }

    notes_updated = False
    plan_changed = False
    if req.status is not None:
        trial.status = req.status
    if req.renewal_intent is not None:
        trial.renewal_intent = req.renewal_intent
    if req.selected_plan is not None:
        if req.selected_plan != trial.selected_plan:
            plan_changed = True
        trial.selected_plan = req.selected_plan
    if req.end_date is not None:
        trial.end_date = req.end_date
    if req.notes is not None:
        notes_updated = True
        trial.notes = req.notes.strip()

    new_state = {
        "status": trial.status,
        "end_date": trial.end_date.isoformat() if trial.end_date else None,
        "renewal_intent": trial.renewal_intent,
        "selected_plan_changed": plan_changed,
        "has_notes": bool(trial.notes),
        "notes_updated": notes_updated,
    }

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="trial_updated",
        target_entity="brand_trials",
        target_id=trial.id,
        previous_state=previous_state,
        new_state=new_state,
    )

    db.commit()
    db.refresh(trial)

    days_rem, is_exp = compute_trial_status(trial)

    return AdminTrialResponse(
        id=str(trial.id),
        brand_id=str(trial.brand_id),
        brand_name=trial.brand.name if trial.brand else "",
        start_date=trial.start_date.isoformat() if trial.start_date else "",
        end_date=trial.end_date.isoformat() if trial.end_date else "",
        status=trial.status,
        renewal_intent=trial.renewal_intent,
        selected_plan=trial.selected_plan,
        notes=trial.notes,
        days_remaining=days_rem,
        is_expired=is_exp,
        created_at=trial.created_at.isoformat() if trial.created_at else "",
        updated_at=trial.updated_at.isoformat() if trial.updated_at else "",
    )


# --- E. Audit Event Log (Append-Only) ---

@router.get("/audit-events", response_model=List[AdminAuditEventResponse])
def list_audit_events(
    action: Optional[str] = Query(None, description="Filter by action name"),
    target_entity: Optional[str] = Query(None, description="Filter by target entity"),
    target_id: Optional[str] = Query(None, description="Filter by target entity UUID"),
    admin_id: Optional[str] = Query(None, description="Filter by admin actor UUID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    View append-only audit event history.
    Strictly read-only; no endpoints exist to alter or delete audit records.
    Never exposes passwords, tokens, hand photos, or original chart uploads.
    """
    q = db.query(AdminAuditEvent).outerjoin(User, AdminAuditEvent.admin_id == User.id)
    if action:
        q = q.filter(AdminAuditEvent.action == action)
    if target_entity:
        q = q.filter(AdminAuditEvent.target_entity == target_entity)
    if target_id:
        try:
            t_uuid = uuid.UUID(target_id)
            q = q.filter(AdminAuditEvent.target_id == t_uuid)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid target_id filter format.")
    if admin_id:
        try:
            a_uuid = uuid.UUID(admin_id)
            q = q.filter(AdminAuditEvent.admin_id == a_uuid)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid admin_id filter format.")

    events = q.order_by(AdminAuditEvent.created_at.desc()).offset(offset).limit(limit).all()

    return [
        AdminAuditEventResponse(
            id=str(e.id),
            admin_id=str(e.admin_id) if e.admin_id else None,
            admin_email=e.admin.email if e.admin else None,
            action=e.action,
            target_entity=e.target_entity,
            target_id=str(e.target_id),
            previous_state=sanitize_audit_state(e.previous_state),
            new_state=sanitize_audit_state(e.new_state),
            created_at=e.created_at.isoformat() if e.created_at else "",
        )
        for e in events
    ]


# ==============================================================================
# 9. Brand Sizing Charts Management (Universal Official & Partner Charts)
# ==============================================================================

def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", s)


def serialize_admin_chart_detail(chart: SizingChart) -> AdminChartDetailResponse:
    brand = chart.brand
    entries = []
    for e in (chart.entries or []):
        entries.append({
            "id": str(e.id),
            "chart_id": str(e.chart_id),
            "size_label": e.size_label,
            "shape": e.shape,
            "finger": e.finger,
            "typical_finger": e.typical_finger,
            "width_mm": float(e.width_mm) if e.width_mm is not None else None,
            "length_mm": float(e.length_mm) if e.length_mm is not None else None,
            "min_width_mm": float(e.min_width_mm) if e.min_width_mm is not None else None,
            "max_width_mm": float(e.max_width_mm) if e.max_width_mm is not None else None,
            "min_length_mm": float(e.min_length_mm) if e.min_length_mm is not None else None,
            "max_length_mm": float(e.max_length_mm) if e.max_length_mm is not None else None,
            "thickness_mm": float(e.thickness_mm) if e.thickness_mm is not None else None,
            "is_approximate": bool(e.is_approximate),
            "thumb_width_mm": float(e.thumb_width_mm) if e.thumb_width_mm is not None else None,
            "index_width_mm": float(e.index_width_mm) if e.index_width_mm is not None else None,
            "middle_width_mm": float(e.middle_width_mm) if e.middle_width_mm is not None else None,
            "ring_width_mm": float(e.ring_width_mm) if e.ring_width_mm is not None else None,
            "pinky_width_mm": float(e.pinky_width_mm) if e.pinky_width_mm is not None else None,
            "display_order": e.display_order,
        })

    return AdminChartDetailResponse(
        id=str(chart.id),
        brand_id=str(chart.brand_id),
        brand_name=brand.name if brand else "",
        brand_slug=brand.slug if brand else "",
        brand_logo_url=brand.logo_url if brand else None,
        brand_description=brand.description if brand else None,
        brand_website=brand.website if brand else None,
        brand_shapes=brand.shapes if (brand and brand.shapes) else [],
        is_official=bool(chart.is_official or (brand and brand.is_official)),
        chart_name=chart.chart_name,
        format=chart.format,
        unit=chart.unit or "mm",
        status=chart.status,
        is_public=chart.is_public,
        custom_notes=chart.custom_notes,
        source_url=chart.source_url,
        source_notes=chart.source_notes,
        verification_status=chart.verification_status or "user_provided",
        version=chart.version,
        entries=entries,
        created_at=chart.created_at.isoformat() if chart.created_at else "",
        updated_at=chart.updated_at.isoformat() if chart.updated_at else "",
    )


@router.get("/sizing-charts", response_model=List[AdminSizingChartListItem])
def list_admin_sizing_charts(
    format: Optional[str] = Query(None, description="Filter by chart format"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (draft/published)"),
    is_official: Optional[bool] = Query(None, description="Filter by official brand status"),
    search: Optional[str] = Query(None, description="Search by chart or brand name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    List all sizing charts with brand details, format, entry counts, and publication status.
    Supports filtering by format, status, official flag, and search query.
    """
    q = db.query(SizingChart).join(Brand, SizingChart.brand_id == Brand.id)

    if format and format != "all":
        q = q.filter(SizingChart.format == format.lower())
    if status_filter and status_filter != "all":
        q = q.filter(SizingChart.status == status_filter.lower())
    if is_official is not None:
        q = q.filter((SizingChart.is_official == is_official) | (Brand.is_official == is_official))
    if search:
        s_pattern = f"%{search.strip()}%"
        q = q.filter((SizingChart.chart_name.ilike(s_pattern)) | (Brand.name.ilike(s_pattern)))

    charts = q.order_by(SizingChart.updated_at.desc()).offset(offset).limit(limit).all()

    items = []
    for c in charts:
        b = c.brand
        items.append(
            AdminSizingChartListItem(
                id=str(c.id),
                brand_id=str(c.brand_id),
                brand_name=b.name if b else "",
                brand_slug=b.slug if b else "",
                brand_logo_url=b.logo_url if b else None,
                is_official=bool(c.is_official or (b and b.is_official)),
                chart_name=c.chart_name,
                format=c.format,
                unit=c.unit or "mm",
                status=c.status,
                is_public=c.is_public,
                version=c.version,
                entry_count=len(c.entries or []),
                shapes_count=len(b.shapes or []) if b else 0,
                source_url=c.source_url,
                verification_status=c.verification_status or "user_provided",
                updated_at=c.updated_at.isoformat() if c.updated_at else "",
            )
        )
    return items


@router.post("/sizing-charts", response_model=AdminChartDetailResponse, status_code=status.HTTP_201_CREATED)
def create_admin_brand_sizing_chart(
    req: AdminCreateBrandChartRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new brand and its sizing chart directly from the Admin Panel.
    Can attach to an existing brand or create a new official brand.
    Enforces format constraints, strict 1-to-1 brand chart cardinality,
    and records an audit event.
    """
    brand: Optional[Brand] = None

    if req.brand_id:
        try:
            b_uuid = uuid.UUID(req.brand_id)
            brand = db.query(Brand).filter(Brand.id == b_uuid).first()
            if not brand:
                raise HTTPException(status_code=404, detail="Specified brand not found.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid brand_id UUID format.")
    else:
        # Create brand
        if not req.brand_name or not req.brand_name.strip():
            raise HTTPException(status_code=422, detail="brand_name is required when creating a new brand.")

        base_slug = req.brand_slug.strip().lower() if req.brand_slug else slugify(req.brand_name)
        if not base_slug:
            base_slug = f"brand-{uuid.uuid4().hex[:6]}"

        # Check slug collision
        existing_slug = db.query(Brand).filter(Brand.slug == base_slug).first()
        if existing_slug:
            slug = f"{base_slug}-{uuid.uuid4().hex[:4]}"
        else:
            slug = base_slug

        brand = Brand(
            id=uuid.uuid4(),
            owner_id=current_admin.id,
            name=req.brand_name.strip(),
            slug=slug,
            tagline=req.brand_tagline.strip() if req.brand_tagline else None,
            description=req.brand_description.strip() if req.brand_description else None,
            logo_url=req.logo_url.strip() if req.logo_url else None,
            website=req.website.strip() if req.website else None,
            contact_email=req.contact_email.strip() if req.contact_email else current_admin.email,
            country="India",
            status="active" if req.status == "published" else "active",
            is_public=req.is_public if req.status == "published" else False,
            is_official=True,
            shapes=req.shapes or [],
        )
        db.add(brand)
        db.flush()

    # Check existing chart on this brand
    existing_chart = db.query(SizingChart).filter(SizingChart.brand_id == brand.id).first()
    if existing_chart:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This brand already has an existing sizing chart. Edit the existing chart instead.",
        )

    # Validate format
    format_clean = req.format.strip().lower()
    allowed_formats = {"preset_set", "numbered_size", "shape_range", "per_size", "width_ranges", "length_only_numbered"}
    if format_clean not in allowed_formats:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported chart format '{req.format}'. Must be one of: {sorted(allowed_formats)}",
        )

    chart = SizingChart(
        id=uuid.uuid4(),
        brand_id=brand.id,
        chart_name=req.chart_name.strip(),
        format=format_clean,
        unit=req.unit.strip().lower() if req.unit else "mm",
        status=req.status,
        is_public=req.is_public,
        custom_notes=req.custom_notes.strip() if req.custom_notes else None,
        source_url=req.source_url.strip() if req.source_url else None,
        source_notes=req.source_notes.strip() if req.source_notes else None,
        verification_status=req.verification_status or "user_provided",
        is_official=True,
        source_type="manual",
        version=1,
    )
    db.add(chart)
    db.flush()

    # Create entries
    for idx, e in enumerate(req.entries):
        from decimal import Decimal

        def to_dec(val: Optional[float]) -> Optional[Decimal]:
            return Decimal(str(val)) if val is not None else None

        entry = SizingChartEntry(
            id=uuid.uuid4(),
            chart_id=chart.id,
            size_label=e.size_label.strip(),
            shape=e.shape.strip() if e.shape else None,
            finger=e.finger.strip() if e.finger else None,
            typical_finger=e.typical_finger.strip() if e.typical_finger else None,
            width_mm=to_dec(e.width_mm),
            length_mm=to_dec(e.length_mm),
            min_width_mm=to_dec(e.min_width_mm),
            max_width_mm=to_dec(e.max_width_mm),
            min_length_mm=to_dec(e.min_length_mm),
            max_length_mm=to_dec(e.max_length_mm),
            thickness_mm=to_dec(e.thickness_mm),
            is_approximate=bool(e.is_approximate),
            thumb_width_mm=to_dec(e.thumb_width_mm),
            index_width_mm=to_dec(e.index_width_mm),
            middle_width_mm=to_dec(e.middle_width_mm),
            ring_width_mm=to_dec(e.ring_width_mm),
            pinky_width_mm=to_dec(e.pinky_width_mm),
            display_order=e.display_order if e.display_order is not None else idx,
        )
        db.add(entry)

    # If publishing, ensure brand is public
    if req.status == "published" and req.is_public:
        brand.is_public = True
        brand.status = "active"

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="create_official_sizing_chart",
        target_entity="sizing_chart",
        target_id=chart.id,
        new_state={"status": chart.status, "is_public": chart.is_public},
    )

    db.commit()
    db.refresh(chart)
    return serialize_admin_chart_detail(chart)


@router.get("/sizing-charts/{chart_id}", response_model=AdminChartDetailResponse)
def get_admin_sizing_chart(
    chart_id: str = Path(..., description="Sizing chart UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Get full details and all entries of a sizing chart (including drafts and internal notes).
    """
    try:
        c_uuid = uuid.UUID(chart_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chart_id UUID format.")

    chart = db.query(SizingChart).filter(SizingChart.id == c_uuid).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Sizing chart not found.")

    return serialize_admin_chart_detail(chart)


@router.put("/sizing-charts/{chart_id}", response_model=AdminChartDetailResponse)
def update_admin_sizing_chart(
    req: AdminUpdateBrandChartRequest,
    chart_id: str = Path(..., description="Sizing chart UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Update brand metadata, chart fields, and measurement entries.
    All edits are recorded in audit logs.
    """
    try:
        c_uuid = uuid.UUID(chart_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chart_id UUID format.")

    chart = db.query(SizingChart).filter(SizingChart.id == c_uuid).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Sizing chart not found.")

    brand = chart.brand

    # Update brand info
    if brand:
        if req.brand_name is not None:
            brand.name = req.brand_name.strip()
        if req.brand_description is not None:
            brand.description = req.brand_description.strip()
        if req.brand_tagline is not None:
            brand.tagline = req.brand_tagline.strip()
        if req.logo_url is not None:
            brand.logo_url = req.logo_url.strip()
        if req.website is not None:
            brand.website = req.website.strip()
        if req.shapes is not None:
            brand.shapes = req.shapes

    # Update chart info
    prev_state = {"status": chart.status, "is_public": chart.is_public}

    if req.chart_name is not None:
        chart.chart_name = req.chart_name.strip()
    if req.format is not None:
        chart.format = req.format.strip().lower()
    if req.unit is not None:
        chart.unit = req.unit.strip().lower()
    if req.status is not None:
        chart.status = req.status
    if req.is_public is not None:
        chart.is_public = req.is_public
    if req.custom_notes is not None:
        chart.custom_notes = req.custom_notes.strip() if req.custom_notes else None
    if req.source_url is not None:
        chart.source_url = req.source_url.strip() if req.source_url else None
    if req.source_notes is not None:
        chart.source_notes = req.source_notes.strip() if req.source_notes else None
    if req.verification_status is not None:
        chart.verification_status = req.verification_status

    # Update entries if provided
    if req.entries is not None:
        from decimal import Decimal

        def to_dec(val: Optional[float]) -> Optional[Decimal]:
            return Decimal(str(val)) if val is not None else None

        # Remove existing entries
        for old_e in list(chart.entries or []):
            db.delete(old_e)
        db.flush()

        # Add updated entries
        for idx, e in enumerate(req.entries):
            entry = SizingChartEntry(
                id=uuid.uuid4(),
                chart_id=chart.id,
                size_label=e.size_label.strip(),
                shape=e.shape.strip() if e.shape else None,
                finger=e.finger.strip() if e.finger else None,
                typical_finger=e.typical_finger.strip() if e.typical_finger else None,
                width_mm=to_dec(e.width_mm),
                length_mm=to_dec(e.length_mm),
                min_width_mm=to_dec(e.min_width_mm),
                max_width_mm=to_dec(e.max_width_mm),
                min_length_mm=to_dec(e.min_length_mm),
                max_length_mm=to_dec(e.max_length_mm),
                thickness_mm=to_dec(e.thickness_mm),
                is_approximate=bool(e.is_approximate),
                thumb_width_mm=to_dec(e.thumb_width_mm),
                index_width_mm=to_dec(e.index_width_mm),
                middle_width_mm=to_dec(e.middle_width_mm),
                ring_width_mm=to_dec(e.ring_width_mm),
                pinky_width_mm=to_dec(e.pinky_width_mm),
                display_order=e.display_order if e.display_order is not None else idx,
            )
            db.add(entry)

        chart.version += 1

    # Keep brand visibility aligned when published
    if chart.status == "published" and chart.is_public and brand:
        brand.is_public = True
        brand.status = "active"

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="update_sizing_chart",
        target_entity="sizing_chart",
        target_id=chart.id,
        previous_state=prev_state,
        new_state={"status": chart.status, "is_public": chart.is_public},
    )

    db.commit()
    db.refresh(chart)
    return serialize_admin_chart_detail(chart)


@router.patch("/sizing-charts/{chart_id}/publish", response_model=AdminChartDetailResponse)
def toggle_publish_sizing_chart(
    action: Literal["publish", "unpublish"] = Query(..., description="Action to perform: publish or unpublish"),
    chart_id: str = Path(..., description="Sizing chart UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Publish or unpublish an official or partner sizing chart.
    Publishing marks the chart status as 'published' and is_public=True,
    and also makes the parent brand active and public.
    Unpublishing sets status to 'draft' and is_public=False.
    """
    try:
        c_uuid = uuid.UUID(chart_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chart_id UUID format.")

    chart = db.query(SizingChart).filter(SizingChart.id == c_uuid).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Sizing chart not found.")

    prev_state = {"status": chart.status, "is_public": chart.is_public}

    if action == "publish":
        chart.status = "published"
        chart.is_public = True
        if chart.brand:
            chart.brand.is_public = True
            chart.brand.status = "active"
    else:
        chart.status = "draft"
        chart.is_public = False

    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action=f"{action}_sizing_chart",
        target_entity="sizing_chart",
        target_id=chart.id,
        previous_state=prev_state,
        new_state={"status": chart.status, "is_public": chart.is_public},
    )

    db.commit()
    db.refresh(chart)
    return serialize_admin_chart_detail(chart)


@router.delete("/sizing-charts/{chart_id}")
def delete_admin_sizing_chart(
    delete_brand: bool = Query(False, description="Whether to also delete the brand if it is an official brand"),
    chart_id: str = Path(..., description="Sizing chart UUID"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a sizing chart and its entries with confirmation.
    Optionally deletes the associated brand if it is marked official and has no other charts.
    """
    try:
        c_uuid = uuid.UUID(chart_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chart_id UUID format.")

    chart = db.query(SizingChart).filter(SizingChart.id == c_uuid).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Sizing chart not found.")

    brand = chart.brand
    record_audit_event(
        db=db,
        admin_id=current_admin.id,
        action="delete_sizing_chart",
        target_entity="sizing_chart",
        target_id=chart.id,
        previous_state={"status": chart.status, "is_public": chart.is_public},
    )

    db.delete(chart)
    if delete_brand and brand and brand.is_official:
        db.delete(brand)

    db.commit()
    return {"success": True, "message": "Sizing chart deleted successfully."}
