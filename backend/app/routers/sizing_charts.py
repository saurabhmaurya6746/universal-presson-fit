import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..auth.dependencies import (
    require_brand_any,
    require_brand_manager_or_owner,
    require_brand_owner,
    BrandMemberContext,
)
from ..db.session import get_db
from ..models.brand import Brand
from ..models.chart import SizingChart, SizingChartEntry

router = APIRouter(prefix="/api/brands/{brand_id}/charts", tags=["sizing-charts"])

class PerSizeEntry(BaseModel):
    size_label: str
    thumb_width_mm: float
    index_width_mm: float
    middle_width_mm: float
    ring_width_mm: float
    pinky_width_mm: float

class WidthRangeEntry(BaseModel):
    size_label: str
    min_width_mm: float
    max_width_mm: float

class ChartSaveRequest(BaseModel):
    chart_name: str = Field(..., min_length=2, max_length=150)
    format: str = Field(..., pattern="^(per_size|width_ranges)$")
    custom_notes: Optional[str] = None
    status: str = Field("draft", pattern="^(draft|published)$")
    is_public: bool = False
    source_type: str = Field("manual", pattern="^(manual|csv_upload|json_upload|preset)$")
    per_size_entries: Optional[List[PerSizeEntry]] = None
    width_range_entries: Optional[List[WidthRangeEntry]] = None

def validate_chart_payload(req: ChartSaveRequest) -> Dict[str, Any]:
    """
    Validate sizing chart data:
    - Enforces format exclusivity (rejects mixed entry formats).
    - Checks required size rows, non-empty labels, and case-insensitive uniqueness.
    - Validates positive widths and valid range boundaries (min <= max).
    - Produces warnings for unusually large finger widths (> 35mm), range overlaps, and gaps.
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not req.chart_name.strip():
        errors.append("Chart name cannot be blank.")

    if req.format == "per_size":
        if req.width_range_entries and len(req.width_range_entries) > 0:
            errors.append("Mixed format: width_range_entries cannot be provided for per_size format.")

        if not req.per_size_entries or len(req.per_size_entries) == 0:
            errors.append("At least one size row must be defined for per-size charts.")
        else:
            labels = set()
            for i, entry in enumerate(req.per_size_entries):
                label = entry.size_label.strip()
                if not label:
                    errors.append(f"Row {i + 1}: Size label is required.")
                elif label.lower() in labels:
                    errors.append(f"Duplicate size label '{label}' detected.")
                else:
                    labels.add(label.lower())

                for finger, val in [
                    ("Thumb", entry.thumb_width_mm),
                    ("Index", entry.index_width_mm),
                    ("Middle", entry.middle_width_mm),
                    ("Ring", entry.ring_width_mm),
                    ("Pinky", entry.pinky_width_mm),
                ]:
                    if val is None or val <= 0:
                        errors.append(f"Row '{label}' ({finger}): Width must be greater than 0 mm.")
                    elif val > 35:
                        warnings.append(f"Row '{label}' ({finger}): Value {val} mm seems unusually large for nail width.")

    elif req.format == "width_ranges":
        if req.per_size_entries and len(req.per_size_entries) > 0:
            errors.append("Mixed format: per_size_entries cannot be provided for width_ranges format.")

        if not req.width_range_entries or len(req.width_range_entries) == 0:
            errors.append("At least one width range row must be defined.")
        else:
            labels = set()
            sorted_ranges = []
            for i, entry in enumerate(req.width_range_entries):
                label = entry.size_label.strip()
                if not label:
                    errors.append(f"Row {i + 1}: Size label is required.")
                elif label.lower() in labels:
                    errors.append(f"Duplicate size label '{label}' detected.")
                else:
                    labels.add(label.lower())

                if entry.min_width_mm is None or entry.max_width_mm is None or entry.min_width_mm <= 0 or entry.max_width_mm <= 0:
                    errors.append(f"Row '{label}': Millimeter values must be positive numbers.")
                elif entry.min_width_mm > entry.max_width_mm:
                    errors.append(f"Row '{label}': Reversed range (Min {entry.min_width_mm} mm > Max {entry.max_width_mm} mm).")

                if entry.min_width_mm is not None and entry.max_width_mm is not None and entry.min_width_mm <= entry.max_width_mm:
                    sorted_ranges.append((entry.min_width_mm, entry.max_width_mm, label))

            # Check overlap or gaps across sorted ranges
            sorted_ranges.sort(key=lambda x: x[0])
            for idx in range(len(sorted_ranges) - 1):
                cur_min, cur_max, cur_lbl = sorted_ranges[idx]
                nxt_min, nxt_max, nxt_lbl = sorted_ranges[idx + 1]
                if cur_max > nxt_min:
                    warnings.append(f"Overlap detected between '{cur_lbl}' ({cur_min}-{cur_max}mm) and '{nxt_lbl}' ({nxt_min}-{nxt_max}mm).")
                elif round(nxt_min - cur_max, 2) > 0.5:
                    warnings.append(f"Gap detected between '{cur_lbl}' (max {cur_max}mm) and '{nxt_lbl}' (min {nxt_min}mm).")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }

def serialize_chart(chart: SizingChart) -> Dict[str, Any]:
    """Serialize SizingChart and its entries for API responses."""
    entries = []
    for e in (chart.entries or []):
        entries.append({
            "id": str(e.id),
            "chart_id": str(e.chart_id),
            "size_label": e.size_label,
            "thumb_width_mm": float(e.thumb_width_mm) if e.thumb_width_mm is not None else None,
            "index_width_mm": float(e.index_width_mm) if e.index_width_mm is not None else None,
            "middle_width_mm": float(e.middle_width_mm) if e.middle_width_mm is not None else None,
            "ring_width_mm": float(e.ring_width_mm) if e.ring_width_mm is not None else None,
            "pinky_width_mm": float(e.pinky_width_mm) if e.pinky_width_mm is not None else None,
            "min_width_mm": float(e.min_width_mm) if e.min_width_mm is not None else None,
            "max_width_mm": float(e.max_width_mm) if e.max_width_mm is not None else None,
            "display_order": e.display_order,
        })

    return {
        "id": str(chart.id),
        "brand_id": str(chart.brand_id),
        "chart_name": chart.chart_name,
        "format": chart.format,
        "unit": chart.unit,
        "status": chart.status,
        "is_public": chart.is_public,
        "custom_notes": chart.custom_notes,
        "source_type": chart.source_type,
        "version": chart.version,
        "created_at": chart.created_at.isoformat() if chart.created_at else "",
        "updated_at": chart.updated_at.isoformat() if chart.updated_at else "",
        "sizing_chart_entries": entries,
    }

@router.post("/validate")
def preview_and_validate_chart(
    brand_id: str,
    req: ChartSaveRequest,
    ctx: BrandMemberContext = Depends(require_brand_any),
):
    """
    Dry-run validation endpoint before saving or publishing.
    Does not mutate database state.
    """
    return validate_chart_payload(req)

@router.get("")
def list_brand_charts(
    brand_id: str,
    ctx: BrandMemberContext = Depends(require_brand_any),
    db: Session = Depends(get_db),
):
    """
    List sizing charts for caller's brand (including drafts and private charts).
    Enforces that brand members only see their brand's chart.
    """
    try:
        brand_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    charts = (
        db.query(SizingChart)
        .filter(SizingChart.brand_id == brand_uuid)
        .order_by(SizingChart.created_at.desc())
        .all()
    )
    return [serialize_chart(c) for c in charts]

@router.post("", status_code=status.HTTP_201_CREATED)
def create_sizing_chart(
    brand_id: str,
    req: ChartSaveRequest,
    ctx: BrandMemberContext = Depends(require_brand_manager_or_owner),
    db: Session = Depends(get_db),
):
    """
    Create a new sizing chart with its rows:
    - Enforces strictly ONE sizing chart per brand.
    - Atomically creates chart header and entries in one transaction.
    - Only approved brands may publish or make charts public; unapproved brands may save drafts.
    """
    try:
        brand_uuid = uuid.UUID(brand_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand ID format.")

    brand = db.query(Brand).filter(Brand.id == brand_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand studio not found.")

    # 1. Enforce strictly ONE sizing chart per brand
    existing_chart = db.query(SizingChart).filter(SizingChart.brand_id == brand_uuid).first()
    if existing_chart:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A sizing chart already exists for this brand. A brand can have at most one sizing chart.",
        )

    # 2. Validate payload
    val = validate_chart_payload(req)

    # 3. Publishing and approval checks
    if req.status == "published" or req.is_public:
        if brand.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unapproved brands cannot publish sizing charts or make them public. Brand status is '{brand.status}'.",
            )
        if not val["valid"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Cannot publish invalid chart.", "errors": val["errors"]},
            )

    final_status = req.status
    final_is_public = req.is_public if (final_status == "published" and brand.status == "active") else False

    # 4. Atomic transaction: create header and entries together
    try:
        new_chart = SizingChart(
            brand_id=brand_uuid,
            chart_name=req.chart_name.strip(),
            format=req.format,
            unit="mm",
            status=final_status,
            is_public=final_is_public,
            custom_notes=req.custom_notes,
            source_type=req.source_type,
            version=1,
        )
        db.add(new_chart)
        db.flush()

        entries_to_add = []
        if req.format == "per_size" and req.per_size_entries:
            for idx, e in enumerate(req.per_size_entries):
                entries_to_add.append(
                    SizingChartEntry(
                        chart_id=new_chart.id,
                        size_label=e.size_label.strip(),
                        thumb_width_mm=e.thumb_width_mm,
                        index_width_mm=e.index_width_mm,
                        middle_width_mm=e.middle_width_mm,
                        ring_width_mm=e.ring_width_mm,
                        pinky_width_mm=e.pinky_width_mm,
                        display_order=idx,
                    )
                )
        elif req.format == "width_ranges" and req.width_range_entries:
            for idx, e in enumerate(req.width_range_entries):
                entries_to_add.append(
                    SizingChartEntry(
                        chart_id=new_chart.id,
                        size_label=e.size_label.strip(),
                        min_width_mm=e.min_width_mm,
                        max_width_mm=e.max_width_mm,
                        display_order=idx,
                    )
                )

        db.add_all(entries_to_add)
        db.commit()
        db.refresh(new_chart)

        return {
            "success": True,
            "chart": serialize_chart(new_chart),
            "warnings": val["warnings"],
        }
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database constraint violation while saving sizing chart entries.",
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create sizing chart.",
        )

@router.put("/{chart_id}")
def update_sizing_chart(
    brand_id: str,
    chart_id: str,
    req: ChartSaveRequest,
    ctx: BrandMemberContext = Depends(require_brand_manager_or_owner),
    db: Session = Depends(get_db),
):
    """
    Update an existing sizing chart and replace its entries atomically:
    - Atomically updates header and replaces all entries in one transaction.
    - If any error or constraint fails, complete transaction rolls back.
    - Only approved brands may publish or make charts public.
    """
    try:
        brand_uuid = uuid.UUID(brand_id)
        chart_uuid = uuid.UUID(chart_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand or chart ID format.")

    brand = db.query(Brand).filter(Brand.id == brand_uuid).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand studio not found.")

    chart = (
        db.query(SizingChart)
        .filter(SizingChart.id == chart_uuid, SizingChart.brand_id == brand_uuid)
        .first()
    )
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chart not found.")

    val = validate_chart_payload(req)

    # Publishing rules
    if req.status == "published" or req.is_public:
        if brand.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unapproved brands cannot publish sizing charts or make them public. Brand status is '{brand.status}'.",
            )
        if not val["valid"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Cannot publish invalid chart.", "errors": val["errors"]},
            )

    final_status = req.status
    final_is_public = req.is_public if (final_status == "published" and brand.status == "active") else False

    # Atomic transaction: update header and replace entries
    try:
        chart.chart_name = req.chart_name.strip()
        chart.format = req.format
        chart.status = final_status
        chart.is_public = final_is_public
        chart.custom_notes = req.custom_notes
        chart.source_type = req.source_type
        chart.version = chart.version + 1

        # Delete existing entries
        db.query(SizingChartEntry).filter(SizingChartEntry.chart_id == chart.id).delete(synchronize_session="fetch")

        # Insert replacement entries
        entries_to_add = []
        if req.format == "per_size" and req.per_size_entries:
            for idx, e in enumerate(req.per_size_entries):
                entries_to_add.append(
                    SizingChartEntry(
                        chart_id=chart.id,
                        size_label=e.size_label.strip(),
                        thumb_width_mm=e.thumb_width_mm,
                        index_width_mm=e.index_width_mm,
                        middle_width_mm=e.middle_width_mm,
                        ring_width_mm=e.ring_width_mm,
                        pinky_width_mm=e.pinky_width_mm,
                        display_order=idx,
                    )
                )
        elif req.format == "width_ranges" and req.width_range_entries:
            for idx, e in enumerate(req.width_range_entries):
                entries_to_add.append(
                    SizingChartEntry(
                        chart_id=chart.id,
                        size_label=e.size_label.strip(),
                        min_width_mm=e.min_width_mm,
                        max_width_mm=e.max_width_mm,
                        display_order=idx,
                    )
                )

        db.add_all(entries_to_add)
        db.commit()
        db.refresh(chart)

        return {
            "success": True,
            "message": "Chart updated successfully.",
            "chart": serialize_chart(chart),
            "warnings": val["warnings"],
        }
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database constraint violation while updating sizing chart entries.",
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update sizing chart.",
        )

@router.delete("/{chart_id}")
def delete_sizing_chart(
    brand_id: str,
    chart_id: str,
    ctx: BrandMemberContext = Depends(require_brand_manager_or_owner),
    db: Session = Depends(get_db),
):
    """
    Sizing chart deletion endpoint.
    Per Phase 3 specifications:
    Chart deletion semantics are undecided pending product policy approval.
    Destructive deletion is disabled to prevent permanent loss of customer measurement associations.
    Returns an explicit non-destructive response indicating deletion is disabled.
    """
    try:
        brand_uuid = uuid.UUID(brand_id)
        chart_uuid = uuid.UUID(chart_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid brand or chart ID format.")

    chart = (
        db.query(SizingChart)
        .filter(SizingChart.id == chart_uuid, SizingChart.brand_id == brand_uuid)
        .first()
    )
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chart not found.")

    # Explicit non-destructive rejection pending product policy
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Chart deletion is disabled pending product policy decision. Sizing charts cannot be destructively deleted.",
    )
