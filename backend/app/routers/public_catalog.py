import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..models.brand import Brand
from ..models.chart import SizingChart, SizingChartEntry

router = APIRouter(prefix="/api/public/brands", tags=["public-catalog"])


def serialize_public_chart(chart: SizingChart) -> Dict[str, Any]:
    """
    Serialize SizingChart and its entries strictly for customer-facing public use.
    Produces shapes directly compatible with both publicBrandRepository and brandMatchingService:
    - Provides 'sizes' finger map for Format A (per_size)
    - Provides 'ranges' array for Format B (width_ranges)
    - Excludes internal notes, trial records, and owner IDs.
    """
    entries = []
    sizes: Dict[str, Dict[str, float]] = {}
    ranges: List[Dict[str, Any]] = []

    for e in (chart.entries or []):
        thumb = float(e.thumb_width_mm) if e.thumb_width_mm is not None else None
        index = float(e.index_width_mm) if e.index_width_mm is not None else None
        middle = float(e.middle_width_mm) if e.middle_width_mm is not None else None
        ring = float(e.ring_width_mm) if e.ring_width_mm is not None else None
        pinky = float(e.pinky_width_mm) if e.pinky_width_mm is not None else None
        min_w = float(e.min_width_mm) if e.min_width_mm is not None else None
        max_w = float(e.max_width_mm) if e.max_width_mm is not None else None

        entries.append({
            "id": str(e.id),
            "chart_id": str(e.chart_id),
            "size_label": e.size_label,
            "thumb_width_mm": thumb,
            "index_width_mm": index,
            "middle_width_mm": middle,
            "ring_width_mm": ring,
            "pinky_width_mm": pinky,
            "min_width_mm": min_w,
            "max_width_mm": max_w,
            "display_order": e.display_order,
        })

        if chart.format == "width_ranges":
            if min_w is not None and max_w is not None:
                ranges.append({
                    "sizeLabel": e.size_label,
                    "minMm": min_w,
                    "maxMm": max_w,
                })
        else:
            sizes[e.size_label] = {
                "thumb": thumb or 0.0,
                "index": index or 0.0,
                "middle": middle or 0.0,
                "ring": ring or 0.0,
                "pinky": pinky or 0.0,
            }

    updated_date = chart.updated_at.strftime("%Y-%m-%d") if chart.updated_at else ""

    return {
        "id": str(chart.id),
        "brand_id": str(chart.brand_id),
        "brandId": str(chart.brand_id),
        "chart_name": chart.chart_name,
        "chartName": chart.chart_name,
        "unit": chart.unit or "mm",
        "format": "width_ranges" if chart.format == "width_ranges" else "per_size_fingers",
        "raw_format": chart.format,
        "updatedDate": updated_date,
        "custom_notes": chart.custom_notes,
        "customNotes": chart.custom_notes,
        "source_type": chart.source_type,
        "sourceType": chart.source_type,
        "version": chart.version,
        "sizes": sizes,
        "ranges": ranges,
        "sizing_chart_entries": entries,
        "created_at": chart.created_at.isoformat() if chart.created_at else "",
        "updated_at": chart.updated_at.isoformat() if chart.updated_at else "",
    }


def serialize_public_brand(brand: Brand, chart: Optional[SizingChart] = None) -> Dict[str, Any]:
    """
    Serialize Brand strictly using customer-facing allowlisted fields.
    Guarantees that owner_id, contact_person, contact_email, admin_notes,
    status, is_public, and trial records are NEVER leaked.
    """
    data = {
        "id": str(brand.id),
        "name": brand.name,
        "slug": brand.slug,
        "tagline": brand.tagline,
        "description": brand.description,
        "website": brand.website,
        "instagram": brand.instagram,
        "city": brand.city,
        "country": brand.country,
        "shapes": brand.shapes or [],
        "created_at": brand.created_at.isoformat() if brand.created_at else None,
        "updated_at": brand.updated_at.isoformat() if brand.updated_at else None,
    }
    if chart is not None:
        public_chart = serialize_public_chart(chart)
        data["sizingChart"] = public_chart
        data["sizing_chart"] = public_chart
    return data


@router.get("")
def list_public_brands(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    List customer-facing public brand catalog.
    Strict eligibility predicate:
    - Brand must be admin-approved (status='active')
    - Brand profile must be public (is_public=True)
    - Sizing chart must be published (status='published')
    - Sizing chart must be public (is_public=True)
    Unapproved, pending, suspended, draft, or private brands/charts are strictly excluded.
    Returns only allowlisted customer-facing fields.
    """
    brands = (
        db.query(Brand)
        .join(SizingChart, SizingChart.brand_id == Brand.id)
        .filter(
            Brand.status == "active",
            Brand.is_public.is_(True),
            SizingChart.status == "published",
            SizingChart.is_public.is_(True),
        )
        .order_by(Brand.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [serialize_public_brand(b, b.chart) for b in brands]


@router.get("/{brand_id}/chart")
def get_public_brand_chart(
    brand_id: str = Path(..., description="Brand studio UUID or slug"),
    db: Session = Depends(get_db),
):
    """
    Retrieve published, public sizing chart for an active, public brand.
    Strict eligibility predicate:
    - Brand must be active and public
    - Chart must be published and public
    Returns 404 for draft/private charts, non-public brands, or nonexistent brands.
    Response shape matches brandMatchingService expectations.
    """
    target_uuid = None
    try:
        target_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        pass

    if target_uuid:
        brand = db.query(Brand).filter(Brand.id == target_uuid).first()
    else:
        brand = db.query(Brand).filter(Brand.slug == brand_id).first()

    if not brand or brand.status != "active" or not brand.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public brand not found.",
        )

    chart = (
        db.query(SizingChart)
        .filter(
            SizingChart.brand_id == brand.id,
            SizingChart.status == "published",
            SizingChart.is_public.is_(True),
        )
        .first()
    )

    if not chart:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published public sizing chart not found for this brand.",
        )

    return serialize_public_chart(chart)


@router.get("/{slug_or_id}")
def get_public_brand_detail(
    slug_or_id: str = Path(..., description="Brand studio UUID or slug"),
    db: Session = Depends(get_db),
):
    """
    Retrieve customer-facing public profile and published sizing chart by brand UUID or slug.
    Strict eligibility predicate:
    - Brand must be active and public
    - Sizing chart must be published and public
    Returns 404 for unapproved/private brands or draft/private charts.
    Response shape is allowlisted and directly consumable by publicBrandRepository.
    """
    target_uuid = None
    try:
        target_uuid = uuid.UUID(slug_or_id)
    except (ValueError, TypeError):
        pass

    if target_uuid:
        brand = db.query(Brand).filter(Brand.id == target_uuid).first()
    else:
        brand = db.query(Brand).filter(Brand.slug == slug_or_id).first()

    if not brand or brand.status != "active" or not brand.is_public:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public brand not found.",
        )

    chart = (
        db.query(SizingChart)
        .filter(
            SizingChart.brand_id == brand.id,
            SizingChart.status == "published",
            SizingChart.is_public.is_(True),
        )
        .first()
    )

    if not chart:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public brand has no published sizing chart available.",
        )

    return serialize_public_brand(brand, chart)
