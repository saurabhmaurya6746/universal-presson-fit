import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.main import app
from app.models.user import User
from app.models.brand import Brand
from app.models.chart import SizingChart, SizingChartEntry
from app.core.security import hash_password, create_access_token


@pytest.fixture
def anyio_backend():
    return "asyncio"


def create_user_helper(db_session: Session, role: str = "personal", email_prefix: str = "user") -> tuple[User, str]:
    """Helper to create a user and return (user, access_token)."""
    user = User(
        email=f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        full_name=f"Test {email_prefix.capitalize()}",
        role=role,
        is_active=True,
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(user.id, user.email, role)
    return user, token


@pytest.mark.anyio
async def test_admin_sizing_charts_requires_admin_role(db_session: Session):
    """Verifies that non-admin and unauthenticated requests are strictly rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Unauthenticated request -> 401 or 403
        res = await ac.get("/api/admin/sizing-charts")
        assert res.status_code in (401, 403)

        # 2. Personal user -> 403
        _, personal_token = create_user_helper(db_session, role="personal")
        res = await ac.get(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {personal_token}"},
        )
        assert res.status_code == 403

        # 3. Brand member user -> 403
        _, brand_token = create_user_helper(db_session, role="brand")
        res = await ac.get(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {brand_token}"},
        )
        assert res.status_code == 403

        # 4. Admin user -> 200
        _, admin_token = create_user_helper(db_session, role="admin")
        res = await ac.get(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)


@pytest.mark.anyio
async def test_admin_create_preset_set_chart(db_session: Session):
    """Tests creating a Format A (preset_set) brand chart with XS/S/M/L finger width mapping."""
    _, admin_token = create_user_helper(db_session, role="admin")
    transport = ASGITransport(app=app)
    slug = f"test-presse-{uuid.uuid4().hex[:6]}"

    payload = {
        "brand_name": f"PRESSE Test {uuid.uuid4().hex[:4]}",
        "brand_slug": slug,
        "brand_description": "Clean press-on nail sets.",
        "chart_name": "PRESSE Sizing Guide",
        "format": "preset_set",
        "unit": "mm",
        "status": "published",
        "is_public": True,
        "source_url": "https://presse.example.com/sizing-guide",
        "source_notes": "Extracted from official PRESSE sizing guide.",
        "verification_status": "user_provided",
        "entries": [
            {"size_label": "XS", "thumb_width_mm": 14.0, "index_width_mm": 10.0, "middle_width_mm": 11.0, "ring_width_mm": 10.0, "pinky_width_mm": 9.0, "display_order": 0},
            {"size_label": "S", "thumb_width_mm": 15.0, "index_width_mm": 11.0, "middle_width_mm": 12.0, "ring_width_mm": 11.0, "pinky_width_mm": 9.0, "display_order": 1},
            {"size_label": "M", "thumb_width_mm": 16.0, "index_width_mm": 12.0, "middle_width_mm": 13.0, "ring_width_mm": 12.0, "pinky_width_mm": 10.0, "display_order": 2},
            {"size_label": "L", "thumb_width_mm": 17.0, "index_width_mm": 13.0, "middle_width_mm": 14.0, "ring_width_mm": 13.0, "pinky_width_mm": 10.0, "display_order": 3},
        ],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
        )
        assert res.status_code == 201
        created = res.json()
        assert created["format"] == "preset_set"
        assert created["verification_status"] == "user_provided"
        assert created["is_official"] is True
        assert len(created["entries"]) == 4

        # Verify in database
        chart = db_session.get(SizingChart, uuid.UUID(created["id"]))
        assert chart is not None
        assert chart.format == "preset_set"
        assert chart.unit == "mm"
        assert len(chart.entries) == 4

        # Verify public catalog view
        pub_res = await ac.get(f"/api/public/brands/{slug}")
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        assert pub_data["sizingChart"] is not None
        assert "XS" in pub_data["sizingChart"]["sizes"]
        assert pub_data["sizingChart"]["sizes"]["XS"]["thumb"] == 14.0
        assert pub_data["sizingChart"]["verification_status"] == "user_provided"


@pytest.mark.anyio
async def test_admin_create_numbered_size_chart_with_approx_and_ranges(db_session: Session):
    """Tests creating a Format B (numbered_size) brand chart preserving 0-9 ordering, approx flags, and ranges."""
    _, admin_token = create_user_helper(db_session, role="admin")
    transport = ASGITransport(app=app)
    slug = f"test-joyee-{uuid.uuid4().hex[:6]}"

    payload = {
        "brand_name": f"Joyee Test {uuid.uuid4().hex[:4]}",
        "brand_slug": slug,
        "brand_description": "Joyee press on nails.",
        "chart_name": "Joyee Press-On Nail Size Guide",
        "format": "numbered_size",
        "unit": "mm",
        "status": "published",
        "is_public": True,
        "source_url": "https://joyee.example.com/pages/press-on-nail-size-guide",
        "source_notes": "Preserves approximate measurements (~). Size 0 is smallest (pinky) and Size 9 is largest (thumb).",
        "verification_status": "user_provided",
        "entries": [
            {"size_label": "0", "width_mm": 7.0, "is_approximate": True, "typical_finger": "Pinky (petite hands)", "display_order": 0},
            {"size_label": "1", "width_mm": 8.0, "is_approximate": True, "typical_finger": "Pinky (average hands)", "display_order": 1},
            {"size_label": "2", "width_mm": 9.0, "is_approximate": True, "typical_finger": "Ring finger (petite)", "display_order": 2},
            {"size_label": "3", "width_mm": 10.0, "is_approximate": True, "typical_finger": "Ring / middle finger", "display_order": 3},
            {"size_label": "4", "width_mm": 11.0, "is_approximate": True, "typical_finger": "Middle finger (average)", "display_order": 4},
            {"size_label": "5", "width_mm": 12.0, "is_approximate": True, "typical_finger": "Index finger / thumb (petite)", "display_order": 5},
            {"size_label": "6", "width_mm": 13.0, "is_approximate": True, "typical_finger": "Thumb (average)", "display_order": 6},
            {"size_label": "7", "width_mm": 14.0, "is_approximate": True, "typical_finger": "Thumb (wider)", "display_order": 7},
            {"size_label": "8", "min_width_mm": 15.0, "max_width_mm": 16.0, "is_approximate": True, "typical_finger": "Thumb (wide nail beds)", "display_order": 8},
            {"size_label": "9", "width_mm": 17.0, "is_approximate": True, "typical_finger": "Thumb (extra wide)", "display_order": 9},
        ],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
        )
        assert res.status_code == 201
        created = res.json()
        assert created["format"] == "numbered_size"
        assert len(created["entries"]) == 10

        # Verify entry 8 has range 15-16
        e8 = next(e for e in created["entries"] if e["size_label"] == "8")
        assert e8["is_approximate"] is True
        assert float(e8["min_width_mm"]) == 15.0
        assert float(e8["max_width_mm"]) == 16.0

        # Verify entry 0 is pinky
        e0 = next(e for e in created["entries"] if e["size_label"] == "0")
        assert e0["typical_finger"] == "Pinky (petite hands)"
        assert float(e0["width_mm"]) == 7.0

        # Verify in public catalog
        pub_res = await ac.get(f"/api/public/brands/{slug}")
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        assert pub_data["sizingChart"]["format"] == "numbered_size"
        assert "numbered_sizes" in pub_data["sizingChart"]
        assert len(pub_data["sizingChart"]["numbered_sizes"]) == 10


@pytest.mark.anyio
async def test_admin_create_shape_range_chart_with_high_precision(db_session: Session):
    """Tests creating a Format C (shape_range) brand chart with 2-decimal length/width precision (Glamnetic model)."""
    _, admin_token = create_user_helper(db_session, role="admin")
    transport = ASGITransport(app=app)
    slug = f"test-glamnetic-{uuid.uuid4().hex[:6]}"

    payload = {
        "brand_name": f"Glamnetic Test {uuid.uuid4().hex[:4]}",
        "brand_slug": slug,
        "brand_description": "Glamnetic press-on nails.",
        "chart_name": "Glamnetic Shape Sizing Specifications",
        "format": "shape_range",
        "unit": "mm",
        "status": "published",
        "is_public": True,
        "source_url": "https://glamnetic.example.com/pages/sizing-chart",
        "source_notes": "Shape-wise dimension ranges in millimeters. Average thickness is 0.6 mm.",
        "verification_status": "user_provided",
        "entries": [
            {"shape": "Extra Short Round", "size_label": "Extra Short Round", "min_length_mm": 11.40, "max_length_mm": 16.65, "min_width_mm": 6.50, "max_width_mm": 13.95, "thickness_mm": 0.6, "display_order": 0},
            {"shape": "Short Almond", "size_label": "Short Almond", "min_length_mm": 15.33, "max_length_mm": 22.33, "min_width_mm": 6.55, "max_width_mm": 14.08, "thickness_mm": 0.6, "display_order": 1},
            {"shape": "Medium Coffin", "size_label": "Medium Coffin", "min_length_mm": 15.58, "max_length_mm": 21.29, "min_width_mm": 6.29, "max_width_mm": 13.98, "thickness_mm": 0.6, "display_order": 2},
            {"shape": "Long Coffin", "size_label": "Long Coffin", "min_length_mm": 19.81, "max_length_mm": 25.94, "min_width_mm": 6.39, "max_width_mm": 14.08, "thickness_mm": 0.6, "display_order": 3},
        ],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
        )
        assert res.status_code == 201
        created = res.json()
        assert created["format"] == "shape_range"
        assert len(created["entries"]) == 4

        # Check precision preserved
        e_round = next(e for e in created["entries"] if e["shape"] == "Extra Short Round")
        assert float(e_round["min_length_mm"]) == 11.40
        assert float(e_round["max_length_mm"]) == 16.65
        assert float(e_round["min_width_mm"]) == 6.50
        assert float(e_round["max_width_mm"]) == 13.95
        assert float(e_round["thickness_mm"]) == 0.6

        # Verify in public catalog
        pub_res = await ac.get(f"/api/public/brands/{slug}")
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        assert pub_data["sizingChart"]["format"] == "shape_range"
        assert "shape_ranges" in pub_data["sizingChart"]
        assert len(pub_data["sizingChart"]["shape_ranges"]) == 4


@pytest.mark.anyio
async def test_admin_draft_vs_published_visibility(db_session: Session):
    """Verifies that draft charts are not publicly visible, and toggle publish operates cleanly."""
    _, admin_token = create_user_helper(db_session, role="admin")
    transport = ASGITransport(app=app)
    slug = f"draft-brand-{uuid.uuid4().hex[:6]}"

    payload = {
        "brand_name": f"Draft Brand {uuid.uuid4().hex[:4]}",
        "brand_slug": slug,
        "chart_name": "Draft Sizing Chart",
        "format": "preset_set",
        "unit": "mm",
        "status": "draft",
        "is_public": False,
        "verification_status": "user_provided",
        "entries": [
            {"size_label": "XS", "thumb_width_mm": 14.0, "display_order": 0},
        ],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create as draft
        res = await ac.post(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
        )
        assert res.status_code == 201
        chart_id = res.json()["id"]

        # 1. Draft is NOT in public catalog list
        pub_list = await ac.get("/api/public/brands")
        assert pub_list.status_code == 200
        slugs = [b["slug"] for b in pub_list.json()]
        assert slug not in slugs

        # 2. Detail returns 404 for draft
        pub_detail = await ac.get(f"/api/public/brands/{slug}")
        assert pub_detail.status_code == 404

        # 3. Publish chart via admin patch
        publish_res = await ac.patch(
            f"/api/admin/sizing-charts/{chart_id}/publish",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"action": "publish"},
        )
        assert publish_res.status_code == 200
        assert publish_res.json()["status"] == "published"
        assert publish_res.json()["is_public"] is True

        # 4. Now visible in public catalog
        pub_detail_after = await ac.get(f"/api/public/brands/{slug}")
        assert pub_detail_after.status_code == 200
        assert pub_detail_after.json()["name"].startswith("Draft Brand")

        # 5. Unpublish chart
        unpublish_res = await ac.patch(
            f"/api/admin/sizing-charts/{chart_id}/publish",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"action": "unpublish"},
        )
        assert unpublish_res.status_code == 200
        assert unpublish_res.json()["status"] == "draft"

        # 6. Again 404 in public catalog
        pub_detail_hidden = await ac.get(f"/api/public/brands/{slug}")
        assert pub_detail_hidden.status_code == 404


@pytest.mark.anyio
async def test_admin_update_and_delete_chart(db_session: Session):
    """Tests updating a chart's entries (incrementing version) and deleting it."""
    _, admin_token = create_user_helper(db_session, role="admin")
    transport = ASGITransport(app=app)
    slug = f"update-brand-{uuid.uuid4().hex[:6]}"

    payload = {
        "brand_name": f"Mutable Brand {uuid.uuid4().hex[:4]}",
        "brand_slug": slug,
        "chart_name": "Initial Chart",
        "format": "preset_set",
        "unit": "mm",
        "status": "published",
        "is_public": True,
        "verification_status": "user_provided",
        "entries": [
            {"size_label": "S", "thumb_width_mm": 15.0, "display_order": 0},
        ],
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
        )
        assert res.status_code == 201
        chart_id = res.json()["id"]

        # Update chart
        update_payload = {
            "chart_name": "Updated Chart Title",
            "format": "preset_set",
            "unit": "mm",
            "status": "published",
            "is_public": True,
            "verification_status": "verified",
            "entries": [
                {"size_label": "S", "thumb_width_mm": 15.5, "display_order": 0},
                {"size_label": "M", "thumb_width_mm": 16.5, "display_order": 1},
            ],
        }
        update_res = await ac.put(
            f"/api/admin/sizing-charts/{chart_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_payload,
        )
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["chart_name"] == "Updated Chart Title"
        assert updated["version"] == 2
        assert len(updated["entries"]) == 2

        # Delete chart
        del_res = await ac.delete(
            f"/api/admin/sizing-charts/{chart_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"delete_brand": True},
        )
        assert del_res.status_code == 200

        # Chart is gone
        get_res = await ac.get(
            f"/api/admin/sizing-charts/{chart_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert get_res.status_code == 404


@pytest.mark.anyio
async def test_admin_create_and_manage_the_nailest_length_only_chart(db_session: Session):
    """
    Tests creating, querying, updating, and publishing The Nailest
    Length-Only Numbered chart with 10 shapes and #0–#9 vertical tip lengths in mm.
    """
    _, admin_token = create_user_helper(db_session, role="admin")
    transport = ASGITransport(app=app)
    slug = f"test-nailest-{uuid.uuid4().hex[:6]}"

    nailest_shapes = [
        "Short Oval", "Short Square", "Regular Square", "Regular Coffin",
        "Regular Stiletto", "Regular Oval", "Regular Almond",
        "Long Square", "Long Coffin", "Long Stiletto"
    ]

    matrix = {
        "Short Oval": [23, 22, 21, 20, 19, 18, 17, 16, 15, 15],
        "Short Square": [21, 20, 19, 19, 18, 18, 17, 16, 15, 14],
        "Regular Square": [24, 23, 22, 21, 20, 19, 18, 17, 16, 15],
        "Regular Coffin": [24, 23, 22, 21, 20, 19, 18, 17, 16, 15],
        "Regular Stiletto": [25, 24, 23, 22, 21, 20, 19, 18, 17, 16],
        "Regular Oval": [26, 25, 24, 23, 22, 21, 20, 19, 18, 17],
        "Regular Almond": [26, 25, 24, 23, 22, 21, 20, 19, 18, 17],
        "Long Square": [30, 29, 28, 27, 26, 25, 24, 23, 22, 21],
        "Long Coffin": [34, 33, 32, 31, 30, 29, 28, 27, 26, 25],
        "Long Stiletto": [37, 36, 35, 34, 33, 32, 31, 30, 29, 28],
    }

    entries = []
    ord_idx = 0
    for shp, lengths in matrix.items():
        for num, len_val in enumerate(lengths):
            entries.append({
                "size_label": f"#{num}",
                "shape": shp,
                "length_mm": float(len_val),
                "width_mm": None,
                "display_order": ord_idx,
            })
            ord_idx += 1

    payload = {
        "brand_name": "The Nailest Test",
        "brand_slug": slug,
        "brand_description": "Luxury press-on nails in 10 shapes.",
        "shapes": nailest_shapes,
        "chart_name": "The Nailest Numbered Length Guide",
        "format": "length_only_numbered",
        "unit": "mm",
        "status": "published",
        "is_public": True,
        "source_url": "https://thenailest.com/pages/sizing-chart",
        "source_notes": "Extracted from user-provided The Nailest sizing chart screenshots.",
        "verification_status": "user_provided",
        "entries": entries,
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Create chart
        create_res = await ac.post(
            "/api/admin/sizing-charts",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
        )
        assert create_res.status_code == 201, f"Create failed: {create_res.text}"
        created = create_res.json()
        assert created["format"] == "length_only_numbered"
        assert len(created["entries"]) == 100
        chart_id = created["id"]

        # 2. Public Catalog API returns the length chart dynamically
        pub_res = await ac.get(f"/api/public/brands/{slug}")
        assert pub_res.status_code == 200
        pub_brand = pub_res.json()
        assert pub_brand["name"] == "The Nailest Test"
        chart_obj = pub_brand["sizingChart"]
        assert chart_obj["format"] == "length_only_numbered"
        assert len(chart_obj["length_numbered_sizes"]) == 10
        assert chart_obj["length_numbered_sizes"]["Short Oval"]["#0"] == 23.0
        assert chart_obj["length_numbered_sizes"]["Long Stiletto"]["#9"] == 28.0

        # 3. Clean up chart
        del_res = await ac.delete(
            f"/api/admin/sizing-charts/{chart_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"delete_brand": True},
        )
        assert del_res.status_code == 200
