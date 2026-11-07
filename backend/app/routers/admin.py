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
    chart_name: str
    format: str
    unit: str
    status: str
    is_public: bool
    version: int
    entry_count: int
    custom_notes: Optional[str] = None
    created_at: str
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
