import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User
from app.models.brand import Brand, BrandMember
from app.models.chart import SizingChart, SizingChartEntry
from app.models.trial import BrandTrial
from app.core.security import hash_password


@pytest.fixture
def anyio_backend():
    return "asyncio"


def seed_test_brand_suite(db: Session):
    """
    Seeds brands across all lifecycle states and visibility combinations:
    1. active_published_public: Approved active brand with published public chart (ELIGIBLE)
    2. active_range_public: Approved active brand with published public width_ranges chart (ELIGIBLE)
    3. pending_brand: Pending approval brand with draft chart (INELIGIBLE)
    4. private_brand: Active brand with is_public=False (INELIGIBLE)
    5. suspended_brand: Suspended brand (INELIGIBLE)
    6. active_draft_chart: Active public brand with draft chart (INELIGIBLE)
    7. active_private_chart: Active public brand with published but is_public=False chart (INELIGIBLE)
    """
    owner = User(
        email=f"brandowner_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role="brand",
        is_active=True,
    )
    db.add(owner)
    db.flush()

    # 1. Eligible Format A Brand
    b1 = Brand(
        owner_id=owner.id,
        name="Luxe PressOn Studio",
        slug=f"luxe-{uuid.uuid4().hex[:6]}",
        tagline="Handcrafted Luxury Press-Ons",
        description="Premium salon-grade reusable nails.",
        contact_person="Private Contact",
        contact_email="private@luxepresson.com",
        website="https://luxepresson.example.com",
        instagram="@luxepresson",
        city="Mumbai",
        country="India",
        status="active",
        is_public=True,
        admin_notes="Top tier approved partner studio",
    )
    db.add(b1)
    db.flush()

    c1 = SizingChart(
        brand_id=b1.id,
        chart_name="Standard Five Finger Chart",
        format="per_size",
        unit="mm",
        status="published",
        is_public=True,
        custom_notes="Custom fitting guidelines",
    )
    db.add(c1)
    db.flush()

    e1_xs = SizingChartEntry(
        chart_id=c1.id,
        size_label="XS",
        thumb_width_mm=Decimal("14.0"),
        index_width_mm=Decimal("11.0"),
        middle_width_mm=Decimal("12.0"),
        ring_width_mm=Decimal("11.0"),
        pinky_width_mm=Decimal("9.0"),
        display_order=1,
    )
    e1_s = SizingChartEntry(
        chart_id=c1.id,
        size_label="S",
        thumb_width_mm=Decimal("15.0"),
        index_width_mm=Decimal("12.0"),
        middle_width_mm=Decimal("13.0"),
        ring_width_mm=Decimal("12.0"),
        pinky_width_mm=Decimal("10.0"),
        display_order=2,
    )
    db.add_all([e1_xs, e1_s])

    # 2. Eligible Format B Brand (Width Ranges)
    b2 = Brand(
        owner_id=owner.id,
        name="Range Nails Studio",
        slug=f"range-{uuid.uuid4().hex[:6]}",
        tagline="Millimeter Range Brackets",
        description="Accurate range-matched sizing.",
        contact_person="Range Manager",
        contact_email="manager@rangenails.com",
        city="Bengaluru",
        country="India",
        status="active",
        is_public=True,
    )
    db.add(b2)
    db.flush()

    c2 = SizingChart(
        brand_id=b2.id,
        chart_name="Width Ranges 0-9",
        format="width_ranges",
        unit="mm",
        status="published",
        is_public=True,
    )
    db.add(c2)
    db.flush()

    e2_0 = SizingChartEntry(
        chart_id=c2.id,
        size_label="0",
        min_width_mm=Decimal("17.0"),
        max_width_mm=Decimal("18.5"),
        display_order=1,
    )
    e2_1 = SizingChartEntry(
        chart_id=c2.id,
        size_label="1",
        min_width_mm=Decimal("15.5"),
        max_width_mm=Decimal("17.0"),
        display_order=2,
    )
    db.add_all([e2_0, e2_1])

    # 3. Pending Brand (Ineligible)
    b3 = Brand(
        owner_id=owner.id,
        name="Pending Review Brand",
        slug=f"pending-{uuid.uuid4().hex[:6]}",
        contact_email="pending@example.com",
        status="pending_review",
        is_public=False,
    )
    db.add(b3)

    # 4. Private Brand (Ineligible)
    b4 = Brand(
        owner_id=owner.id,
        name="Private Active Brand",
        slug=f"private-{uuid.uuid4().hex[:6]}",
        contact_email="private@example.com",
        status="active",
        is_public=False,
    )
    db.add(b4)

    # 5. Suspended Brand (Ineligible)
    b5 = Brand(
        owner_id=owner.id,
        name="Suspended Brand",
        slug=f"suspended-{uuid.uuid4().hex[:6]}",
        contact_email="suspended@example.com",
        status="suspended",
        is_public=True,
    )
    db.add(b5)

    # 6. Active Public Brand with Draft Chart (Ineligible)
    b6 = Brand(
        owner_id=owner.id,
        name="Active With Draft Chart",
        slug=f"draft-chart-{uuid.uuid4().hex[:6]}",
        contact_email="draft@example.com",
        status="active",
        is_public=True,
    )
    db.add(b6)
    db.flush()

    c6 = SizingChart(
        brand_id=b6.id,
        chart_name="Unfinished Draft Chart",
        format="per_size",
        status="draft",
        is_public=False,
    )
    db.add(c6)

    # 7. Active Public Brand with Private Chart (Ineligible)
    b7 = Brand(
        owner_id=owner.id,
        name="Active With Private Chart",
        slug=f"private-chart-{uuid.uuid4().hex[:6]}",
        contact_email="privchart@example.com",
        status="active",
        is_public=True,
    )
    db.add(b7)
    db.flush()

    c7 = SizingChart(
        brand_id=b7.id,
        chart_name="Published But Private",
        format="per_size",
        status="published",
        is_public=False,
    )
    db.add(c7)

    db.commit()
    return {
        "eligible_a": (b1, c1),
        "eligible_b": (b2, c2),
        "pending": b3,
        "private": b4,
        "suspended": b5,
        "draft_chart": (b6, c6),
        "private_chart": (b7, c7),
    }


@pytest.mark.anyio
async def test_public_directory_strictly_excludes_ineligible_brands(db_session: Session):
    """
    Test Case 5:
    Public brand directory strictly excludes unapproved, pending, private, and suspended brands,
    as well as active brands without published public sizing charts.
    """
    seeded = seed_test_brand_suite(db_session)
    eligible_a_id = str(seeded["eligible_a"][0].id)
    eligible_b_id = str(seeded["eligible_b"][0].id)
    pending_id = str(seeded["pending"].id)
    private_id = str(seeded["private"].id)
    suspended_id = str(seeded["suspended"].id)
    draft_chart_id = str(seeded["draft_chart"][0].id)
    private_chart_id = str(seeded["private_chart"][0].id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/public/brands")
        assert res.status_code == 200
        brands = res.json()
        ids = [b["id"] for b in brands]

        # Eligible brands must be present
        assert eligible_a_id in ids
        assert eligible_b_id in ids

        # Ineligible brands must NEVER be present
        assert pending_id not in ids, "Pending brand leaked into public directory!"
        assert private_id not in ids, "Private brand leaked into public directory!"
        assert suspended_id not in ids, "Suspended brand leaked into public directory!"
        assert draft_chart_id not in ids, "Brand with draft chart leaked into public directory!"
        assert private_chart_id not in ids, "Brand with private chart leaked into public directory!"


@pytest.mark.anyio
async def test_public_chart_endpoint_excludes_draft_private_or_ineligible_brands(db_session: Session):
    """
    Test Case 6:
    Public chart endpoint returns 404 for draft/private charts, unapproved brands,
    or non-public profiles.
    """
    seeded = seed_test_brand_suite(db_session)
    pending_brand = seeded["pending"]
    draft_chart_brand = seeded["draft_chart"][0]
    private_chart_brand = seeded["private_chart"][0]
    eligible_brand, _ = seeded["eligible_a"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Nonexistent brand returns 404
        r_fake = await client.get(f"/api/public/brands/{uuid.uuid4()}/chart")
        assert r_fake.status_code == 404

        # Pending brand chart returns 404
        r_pending = await client.get(f"/api/public/brands/{pending_brand.id}/chart")
        assert r_pending.status_code == 404

        # Active brand with draft chart returns 404
        r_draft = await client.get(f"/api/public/brands/{draft_chart_brand.id}/chart")
        assert r_draft.status_code == 404

        # Active brand with private chart returns 404
        r_priv = await client.get(f"/api/public/brands/{private_chart_brand.id}/chart")
        assert r_priv.status_code == 404

        # Eligible brand returns 200 OK by UUID
        r_ok_uuid = await client.get(f"/api/public/brands/{eligible_brand.id}/chart")
        assert r_ok_uuid.status_code == 200

        # Eligible brand returns 200 OK by slug
        r_ok_slug = await client.get(f"/api/public/brands/{eligible_brand.slug}/chart")
        assert r_ok_slug.status_code == 200


@pytest.mark.anyio
async def test_public_responses_strictly_omit_sensitive_and_internal_fields(db_session: Session):
    """
    Test Case 7:
    Public response omits owner_id, contact fields, admin_notes, status, trial,
    and internal review fields.
    """
    seeded = seed_test_brand_suite(db_session)
    eligible_brand, _ = seeded["eligible_a"]

    forbidden_fields = [
        "owner_id",
        "contact_person",
        "contact_email",
        "admin_notes",
        "status",
        "is_public",
        "trial",
        "trial_id",
        "brand_trials",
        "renewal_intent",
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Inspect public directory
        r_dir = await client.get("/api/public/brands")
        assert r_dir.status_code == 200
        dir_data = r_dir.json()
        target_dir_brand = next(b for b in dir_data if b["id"] == str(eligible_brand.id))
        for field in forbidden_fields:
            assert field not in target_dir_brand, f"Sensitive field '{field}' leaked in public directory!"

        # 2. Inspect public detail
        r_detail = await client.get(f"/api/public/brands/{eligible_brand.slug}")
        assert r_detail.status_code == 200
        detail_data = r_detail.json()
        for field in forbidden_fields:
            assert field not in detail_data, f"Sensitive field '{field}' leaked in public detail!"

        # 3. Inspect public chart endpoint
        r_chart = await client.get(f"/api/public/brands/{eligible_brand.slug}/chart")
        assert r_chart.status_code == 200
        chart_data = r_chart.json()
        for field in forbidden_fields:
            assert field not in chart_data, f"Sensitive field '{field}' leaked in public chart!"


@pytest.mark.anyio
async def test_eligible_chart_returned_in_matching_compatible_shape(db_session: Session):
    """
    Test Case 8:
    Eligible approved/public/published brand charts return in shapes directly consumable
    by publicBrandRepository and brandMatchingService:
    - Format A (per_size): sizes finger map {XS: {thumb, index, middle, ring, pinky}}
    - Format B (width_ranges): ranges array [{sizeLabel, minMm, maxMm}]
    - Standard metadata: chartName, brandId, updatedDate, unit='mm'
    """
    seeded = seed_test_brand_suite(db_session)
    brand_a, chart_a = seeded["eligible_a"]
    brand_b, chart_b = seeded["eligible_b"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # --- Format A Verification ---
        resp_a = await client.get(f"/api/public/brands/{brand_a.slug}/chart")
        assert resp_a.status_code == 200
        data_a = resp_a.json()
        assert data_a["chartName"] == "Standard Five Finger Chart"
        assert data_a["brandId"] == str(brand_a.id)
        assert data_a["unit"] == "mm"
        assert data_a["format"] == "per_size_fingers"

        # Matching compatibility: sizes map
        sizes = data_a["sizes"]
        assert "XS" in sizes
        assert "S" in sizes
        assert sizes["XS"]["thumb"] == 14.0
        assert sizes["XS"]["index"] == 11.0
        assert sizes["XS"]["middle"] == 12.0
        assert sizes["XS"]["ring"] == 11.0
        assert sizes["XS"]["pinky"] == 9.0

        # Raw DB entries also included for repository flexibility
        assert len(data_a["sizing_chart_entries"]) == 2

        # --- Format B Verification ---
        resp_b = await client.get(f"/api/public/brands/{brand_b.slug}/chart")
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        assert data_b["chartName"] == "Width Ranges 0-9"
        assert data_b["brandId"] == str(brand_b.id)
        assert data_b["format"] == "width_ranges"

        # Matching compatibility: ranges array
        ranges = data_b["ranges"]
        assert len(ranges) == 2
        r0 = next(r for r in ranges if r["sizeLabel"] == "0")
        assert r0["minMm"] == 17.0
        assert r0["maxMm"] == 18.5
        r1 = next(r for r in ranges if r["sizeLabel"] == "1")
        assert r1["minMm"] == 15.5
        assert r1["maxMm"] == 17.0
