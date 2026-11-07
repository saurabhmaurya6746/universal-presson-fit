import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..auth.dependencies import (
    get_current_user,
    require_brand_any,
    require_brand_owner,
    BrandMemberContext,
)
from ..db.session import get_db
from ..models.user import User
from ..models.brand import Brand, BrandMember
from ..models.trial import BrandTrial

router = APIRouter(prefix="/api/brands", tags=["brands"])

class BrandApplyRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    tagline: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    contact_person: str = Field(..., min_length=2, max_length=100)
    contact_email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    website: Optional[str] = None
    instagram: Optional[str] = None
    city: Optional[str] = None
    country: str = "India"
    shapes: List[str] = ["Almond", "Coffin", "Square", "Oval"]

class BrandProfileResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    slug: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: str
    website: Optional[str] = None
    instagram: Optional[str] = None
    city: Optional[str] = None
    country: str
    status: str
    is_public: bool
    shapes: List[str]
    created_at: str
    updated_at: str

class BrandUpdateRequest(BaseModel):
    tagline: Optional[str] = None
    description: Optional[str] = None
    contact_person: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    city: Optional[str] = None
    shapes: Optional[List[str]] = None

def generate_slug(name: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9\s-]', '', name).strip().lower()
    slug = re.sub(r'[\s-]+', '-', cleaned)
    return slug or "brand"

def serialize_brand(brand: Brand, trial: Optional[BrandTrial] = None) -> Dict[str, Any]:
    trial_data = None
    if trial:
        trial_data = {
            "id": str(trial.id),
            "brand_id": str(trial.brand_id),
            "start_date": trial.start_date.isoformat() if trial.start_date else None,
            "end_date": trial.end_date.isoformat() if trial.end_date else None,
            "status": trial.status,
            "renewal_intent": trial.renewal_intent,
            "selected_plan": trial.selected_plan,
            "notes": trial.notes,
        }
    return {
        "id": str(brand.id),
        "owner_id": str(brand.owner_id),
        "name": brand.name,
        "slug": brand.slug,
        "tagline": brand.tagline,
        "description": brand.description,
        "contact_person": brand.contact_person,
        "contact_email": brand.contact_email,
        "website": brand.website,
        "instagram": brand.instagram,
        "city": brand.city,
        "country": brand.country,
        "status": brand.status,
        "is_public": brand.is_public,
        "shapes": brand.shapes or [],
        "created_at": brand.created_at.isoformat() if brand.created_at else "",
        "updated_at": brand.updated_at.isoformat() if brand.updated_at else "",
        "trial": trial_data,
    }

@router.post("/apply", status_code=status.HTTP_201_CREATED)
def apply_for_brand(
    req: BrandApplyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Apply for brand studio registration:
    - Atomically creates a pending, private brand, its owner membership, and its ten-day trial.
    - Trial starts at the brand application/signup timestamp and continues while pending.
    - Approval does not reset trial dates.
    - Brand users cannot set approval state, admin notes, or public flags.
    """
    signup_time = datetime.now(timezone.utc)
    base_slug = generate_slug(req.name)
    slug = base_slug
    suffix = 1
    while db.query(Brand).filter(Brand.slug == slug).first():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    try:
        brand = Brand(
            owner_id=user.id,
            name=req.name.strip(),
            slug=slug,
            tagline=req.tagline.strip() if req.tagline else None,
            description=req.description.strip() if req.description else None,
            contact_person=req.contact_person.strip(),
            contact_email=req.contact_email.strip().lower(),
            website=req.website.strip() if req.website else None,
            instagram=req.instagram.strip() if req.instagram else None,
            city=req.city.strip() if req.city else None,
            country=req.country or "India",
            status="pending_review",  # strictly pending_review; non-user-controllable
            is_public=False,          # strictly private; unapproved brands cannot be public
            shapes=req.shapes or ["Almond", "Coffin", "Square", "Oval"],
            admin_notes=None,         # non-user-controllable
            created_at=signup_time,
        )
        db.add(brand)
        db.flush()

        # Create owner membership record
        membership = BrandMember(
            brand_id=brand.id,
            user_id=user.id,
            role="owner",
        )
        db.add(membership)

        # Create ten-day trial starting at signup timestamp
        trial = BrandTrial(
            brand_id=brand.id,
            start_date=signup_time,
            end_date=signup_time + timedelta(days=10),
            status="active",
            renewal_intent="not_asked",
            selected_plan="growth",
        )
        db.add(trial)

        # Upgrade personal user role to brand
        if user.role == "personal":
            user.role = "brand"

        db.commit()
        db.refresh(brand)
        db.refresh(trial)

        return {
            "success": True,
            "message": "Brand studio application submitted successfully and is pending review.",
            "brand": serialize_brand(brand, trial),
        }
    except Exception:
        db.rollback()
        raise

@router.get("/by-id/{brand_id}")
def get_brand_by_id(
    brand_id: str,
    ctx: BrandMemberContext = Depends(require_brand_any),
    db: Session = Depends(get_db),
):
    """
    Return a brand only after verifying caller's membership or admin override for this URL ID.
    Loads brand profile and active trial information from PostgreSQL.
    """
    try:
        brand_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    brand = db.query(Brand).filter(Brand.id == brand_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand profile not found.")

    trial = db.query(BrandTrial).filter(BrandTrial.brand_id == brand.id).order_by(BrandTrial.created_at.desc()).first()
    return serialize_brand(brand, trial)

@router.patch("/by-id/{brand_id}")
def update_brand_by_id(
    brand_id: str,
    updates: BrandUpdateRequest,
    ctx: BrandMemberContext = Depends(require_brand_owner),
    db: Session = Depends(get_db),
):
    """
    Update brand studio settings.
    Restricted to brand owner or platform administrator.
    Brand users cannot set approval state, admin notes, slug, name, or public flags.
    """
    try:
        brand_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    brand = db.query(Brand).filter(Brand.id == brand_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand profile not found.")

    payload = updates.model_dump(exclude_unset=True) if hasattr(updates, "model_dump") else updates.dict(exclude_unset=True)
    allowed_fields = {"tagline", "description", "contact_person", "website", "instagram", "city", "shapes"}
    filtered_updates = {k: v for k, v in payload.items() if k in allowed_fields and v is not None}

    if not filtered_updates:
        trial = db.query(BrandTrial).filter(BrandTrial.brand_id == brand.id).order_by(BrandTrial.created_at.desc()).first()
        return {"success": True, "message": "No changes specified.", "brand": serialize_brand(brand, trial)}

    for key, val in filtered_updates.items():
        setattr(brand, key, val)

    db.commit()
    db.refresh(brand)
    trial = db.query(BrandTrial).filter(BrandTrial.brand_id == brand.id).order_by(BrandTrial.created_at.desc()).first()
    return {"success": True, "brand": serialize_brand(brand, trial)}
