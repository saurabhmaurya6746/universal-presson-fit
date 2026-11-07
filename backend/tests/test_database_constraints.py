import uuid
from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models import (
    User,
    Brand,
    SizingChart,
    SizingChartEntry,
)

def create_sample_user(session: Session, email_prefix: str = "test") -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com",
        full_name="Test Studio Owner",
        role="brand",
    )
    session.add(user)
    session.flush()
    return user

def create_sample_brand(session: Session, owner: User, name: str = "Aura Nails") -> Brand:
    brand = Brand(
        id=uuid.uuid4(),
        owner_id=owner.id,
        name=name,
        slug=f"aura-nails-{uuid.uuid4().hex[:8]}",
        contact_email=owner.email,
        shapes=["Almond", "Coffin"],
    )
    session.add(brand)
    session.flush()
    return brand

def test_database_enforces_one_chart_per_brand(db_session: Session):
    """Verify database rejects a second chart for the same brand, but accepts charts for distinct brands."""
    owner = create_sample_user(db_session)
    brand1 = create_sample_brand(db_session, owner, "Brand 1")
    brand2 = create_sample_brand(db_session, owner, "Brand 2")

    # Chart 1 for Brand 1
    chart1 = SizingChart(
        id=uuid.uuid4(),
        brand_id=brand1.id,
        chart_name="Brand 1 Primary Chart",
        format="per_size",
        status="published",
    )
    db_session.add(chart1)
    db_session.flush()

    # Chart 2 for Brand 2 (different brand) -> MUST SUCCEED
    chart2 = SizingChart(
        id=uuid.uuid4(),
        brand_id=brand2.id,
        chart_name="Brand 2 Primary Chart",
        format="per_size",
        status="published",
    )
    db_session.add(chart2)
    db_session.flush()

    # Attempting to insert a second chart for Brand 1 -> MUST FAIL with UniqueConstraint violation
    duplicate_chart = SizingChart(
        id=uuid.uuid4(),
        brand_id=brand1.id,
        chart_name="Brand 1 Duplicate Chart",
        format="width_ranges",
        status="draft",
    )
    db_session.add(duplicate_chart)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_database_rejects_nonpositive_finger_widths(db_session: Session):
    """Verify database check constraint rejects non-positive (<=0) finger width values."""
    owner = create_sample_user(db_session)
    brand = create_sample_brand(db_session, owner)
    chart = SizingChart(
        id=uuid.uuid4(),
        brand_id=brand.id,
        chart_name="Per Size Chart",
        format="per_size",
    )
    db_session.add(chart)
    db_session.flush()

    # Entry with 0.0 mm width -> MUST FAIL
    invalid_entry = SizingChartEntry(
        id=uuid.uuid4(),
        chart_id=chart.id,
        size_label="XS",
        thumb_width_mm=Decimal("0.0"),  # non-positive
        index_width_mm=Decimal("12.0"),
        middle_width_mm=Decimal("13.0"),
        ring_width_mm=Decimal("12.0"),
        pinky_width_mm=Decimal("9.0"),
        display_order=0,
    )
    db_session.add(invalid_entry)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_database_rejects_reversed_width_ranges(db_session: Session):
    """Verify database check constraint rejects reversed range boundaries (min > max)."""
    owner = create_sample_user(db_session)
    brand = create_sample_brand(db_session, owner)
    chart = SizingChart(
        id=uuid.uuid4(),
        brand_id=brand.id,
        chart_name="Range Chart",
        format="width_ranges",
    )
    db_session.add(chart)
    db_session.flush()

    # Entry with min > max (15.0 > 12.0) -> MUST FAIL
    invalid_range = SizingChartEntry(
        id=uuid.uuid4(),
        chart_id=chart.id,
        size_label="Tier 1",
        min_width_mm=Decimal("15.0"),
        max_width_mm=Decimal("12.0"),
        display_order=0,
    )
    db_session.add(invalid_range)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_database_rejects_case_insensitive_duplicate_size_labels(db_session: Session):
    """Verify database rejects duplicate size labels ignoring case within the same chart."""
    owner = create_sample_user(db_session)
    brand = create_sample_brand(db_session, owner)
    chart = SizingChart(
        id=uuid.uuid4(),
        brand_id=brand.id,
        chart_name="Multi Label Chart",
        format="per_size",
    )
    db_session.add(chart)
    db_session.flush()

    entry1 = SizingChartEntry(
        id=uuid.uuid4(),
        chart_id=chart.id,
        size_label="Medium",
        thumb_width_mm=Decimal("16.0"),
        display_order=0,
    )
    db_session.add(entry1)
    db_session.flush()

    # Entry with case variant "medium" or "  MEDIUM  " -> MUST FAIL
    entry2 = SizingChartEntry(
        id=uuid.uuid4(),
        chart_id=chart.id,
        size_label="  medium  ",
        thumb_width_mm=Decimal("16.0"),
        display_order=1,
    )
    db_session.add(entry2)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()
