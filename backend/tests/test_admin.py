import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User
from app.models.brand import Brand, BrandMember
from app.models.chart import SizingChart, SizingChartEntry
from app.models.trial import BrandTrial
from app.models.audit import AdminAuditEvent
from app.core.security import hash_password, create_access_token

@pytest.fixture
def anyio_backend():
    return "asyncio"


def create_user(db_session: Session, role: str = "personal", email_prefix: str = "user") -> tuple[User, str]:
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


def create_brand_with_trial(db_session: Session, owner: User, status: str = "pending_review", is_public: bool = False) -> Brand:
    """Helper to create a brand, owner membership, and 10-day trial."""
    now = datetime.now(timezone.utc)
    brand = Brand(
        owner_id=owner.id,
        name=f"Studio {uuid.uuid4().hex[:6]}",
        slug=f"studio-{uuid.uuid4().hex[:6]}",
        contact_person=owner.full_name or "Jane Owner",
        contact_email=owner.email,
        tagline="Handmade press-ons",
        description="Premium nails",
        city="Mumbai",
        country="India",
        status=status,
        is_public=is_public,
        shapes=["Almond", "Coffin"],
        created_at=now,
    )
    db_session.add(brand)
    db_session.flush()

    member = BrandMember(
        brand_id=brand.id,
        user_id=owner.id,
        role="owner",
    )
    db_session.add(member)

    trial = BrandTrial(
        brand_id=brand.id,
        start_date=now,
        end_date=now + timedelta(days=10),
        status="active",
        renewal_intent="not_asked",
        selected_plan="growth",
        created_at=now,
    )
    db_session.add(trial)
    db_session.commit()
    db_session.refresh(brand)
    return brand


@pytest.mark.anyio
async def test_admin_routes_reject_unauthenticated_personal_and_brand_roles(db_session: Session):
    """
    Requirement 1 & Security Matrix:
    Every admin route must enforce the current database-loaded admin role.
    Personal and brand users are denied with HTTP 403 Forbidden.
    Unauthenticated requests receive HTTP 401 Unauthorized.
    Never trusts caller-supplied or JWT claims.
    """
    _, t_personal = create_user(db_session, role="personal", email_prefix="pers")
    _, t_brand = create_user(db_session, role="brand", email_prefix="brand")
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm")

    # Brand for target testing
    test_brand = create_brand_with_trial(db_session, admin_user)
    b_id = str(test_brand.id)
    u_id = str(admin_user.id)

    admin_endpoints = [
        ("GET", "/api/admin/accounts", None),
        ("PATCH", f"/api/admin/accounts/{u_id}/status-or-role", {"is_active": True}),
        ("GET", "/api/admin/brands", None),
        ("POST", f"/api/admin/brands/{b_id}/approve", {"admin_notes": "test"}),
        ("POST", f"/api/admin/brands/{b_id}/reject", {"admin_notes": "test"}),
        ("POST", f"/api/admin/brands/{b_id}/suspend", {"admin_notes": "test"}),
        ("POST", f"/api/admin/brands/{b_id}/reactivate", {"admin_notes": "test"}),
        ("GET", "/api/admin/charts/review", None),
        ("GET", f"/api/admin/trials/{b_id}", None),
        ("PATCH", f"/api/admin/trials/{b_id}", {"status": "extended"}),
        ("GET", "/api/admin/audit-events", None),
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for method, path, payload in admin_endpoints:
            # 1. Unauthenticated -> 401 or 403 (HTTPBearer returns 403 when Authorization header is absent)
            r_unauth = await client.request(method, path, json=payload)
            assert r_unauth.status_code in (401, 403), f"Expected 401 or 403 for unauth {method} {path}, got {r_unauth.status_code}"

            # Invalid Bearer token -> 401 Unauthorized
            r_bad = await client.request(method, path, json=payload, headers={"Authorization": "Bearer bad_invalid_token"})
            assert r_bad.status_code == 401, f"Expected 401 for bad token {method} {path}, got {r_bad.status_code}"

            # 2. Personal role -> 403
            r_pers = await client.request(method, path, json=payload, headers={"Authorization": f"Bearer {t_personal}"})
            assert r_pers.status_code == 403, f"Expected 403 for personal {method} {path}, got {r_pers.status_code}"
            assert "requires role in ('admin',)" in r_pers.text

            # 3. Brand role -> 403
            r_br = await client.request(method, path, json=payload, headers={"Authorization": f"Bearer {t_brand}"})
            assert r_br.status_code == 403, f"Expected 403 for brand {method} {path}, got {r_br.status_code}"
            assert "requires role in ('admin',)" in r_br.text

            # 4. Admin role -> authorized (not 401 or 403)
            r_adm = await client.request(method, path, json=payload, headers={"Authorization": f"Bearer {t_admin}"})
            assert r_adm.status_code not in (401, 403), f"Admin was blocked on {method} {path} with {r_adm.status_code}"


@pytest.mark.anyio
async def test_admin_list_accounts_and_privacy_redaction(db_session: Session):
    """
    Test admin account listing:
    - Filters by role, is_active, search.
    - PRIVACY GUARANTEE: Never exposes password_hash, reset/refresh tokens, or measurement details.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="superadmin")
    u1, _ = create_user(db_session, role="personal", email_prefix="alice_list")
    u2, _ = create_user(db_session, role="brand", email_prefix="bob_list")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/admin/accounts", headers={"Authorization": f"Bearer {t_admin}"})
        assert res.status_code == 200
        users = res.json()
        assert len(users) >= 3

        # Check fields and ensure sensitive data is not exposed
        for u in users:
            assert "id" in u
            assert "email" in u
            assert "role" in u
            assert "is_active" in u
            assert "password" not in u
            assert "password_hash" not in u
            assert "measurements" not in u
            assert "sessions" not in u

        # Check search filtering
        res_search = await client.get("/api/admin/accounts?search=alice_list", headers={"Authorization": f"Bearer {t_admin}"})
        assert res_search.status_code == 200
        search_data = res_search.json()
        assert any(item["email"] == u1.email for item in search_data)
        assert not any(item["email"] == u2.email for item in search_data)

        # Check role filtering
        res_role = await client.get("/api/admin/accounts?role=brand", headers={"Authorization": f"Bearer {t_admin}"})
        assert res_role.status_code == 200
        for item in res_role.json():
            assert item["role"] == "brand"


@pytest.mark.anyio
async def test_admin_update_account_status_and_role_prevents_self_escalation(db_session: Session):
    """
    Test account update:
    - Admin can update role and active status of other users.
    - Self-escalation / safety: Admin cannot deactivate or demote self.
    - Transactionally writes audit log.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_updater")
    target_user, _ = create_user(db_session, role="personal", email_prefix="target_pers")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Self-deactivation prevented
        res_self_deact = await client.patch(
            f"/api/admin/accounts/{admin_user.id}/status-or-role",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_self_deact.status_code == 400
        assert "cannot deactivate their own account" in res_self_deact.text

        # 2. Self-demotion prevented
        res_self_demote = await client.patch(
            f"/api/admin/accounts/{admin_user.id}/status-or-role",
            json={"role": "personal"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_self_demote.status_code == 400
        assert "cannot demote their own account" in res_self_demote.text

        # 3. Valid update of another user (e.g. promote to brand, deactivate)
        res_update = await client.patch(
            f"/api/admin/accounts/{target_user.id}/status-or-role",
            json={"role": "brand", "is_active": False},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_update.status_code == 200
        updated = res_update.json()
        assert updated["role"] == "brand"
        assert updated["is_active"] is False

        # Verify DB reflection
        db_session.refresh(target_user)
        assert target_user.role == "brand"
        assert target_user.is_active is False

        # Verify audit event written
        audit = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == target_user.id)
            .order_by(AdminAuditEvent.created_at.desc())
            .first()
        )
        assert audit is not None
        assert audit.action == "user_status_or_role_updated"
        assert audit.previous_state == {"role": "personal", "is_active": True}
        assert audit.new_state == {"role": "brand", "is_active": False}


@pytest.mark.anyio
async def test_admin_brand_approval_leaves_trial_dates_unchanged(db_session: Session):
    """
    Requirement 2 & 5:
    Admin approval changes brand status from 'pending_review' to 'active',
    and LEAVES ORIGINAL SIGNUP-TIME TRIAL DATES COMPLETELY UNCHANGED.
    Pending duration counts toward the 10-day trial.
    Approval does NOT automatically make the brand public.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_approver")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_brand")

    # Brand created 3 days ago
    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    brand = Brand(
        owner_id=owner_user.id,
        name="Pending Studio",
        slug="pending-studio",
        contact_person="Jane",
        contact_email=owner_user.email,
        country="India",
        status="pending_review",
        is_public=False,
        created_at=three_days_ago,
    )
    db_session.add(brand)
    db_session.flush()

    trial = BrandTrial(
        brand_id=brand.id,
        start_date=three_days_ago,
        end_date=three_days_ago + timedelta(days=10),
        status="active",
        renewal_intent="not_asked",
        selected_plan="growth",
        created_at=three_days_ago,
    )
    db_session.add(trial)
    db_session.commit()

    orig_start = trial.start_date
    orig_end = trial.end_date

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Verify listing in admin review
        res_list = await client.get(
            "/api/admin/brands?status=pending_review",
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_list.status_code == 200
        assert any(b["id"] == str(brand.id) for b in res_list.json())

        # 2. Approve brand
        res_app = await client.post(
            f"/api/admin/brands/{brand.id}/approve",
            json={"admin_notes": "Identity verified"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_app.status_code == 200
        approved_brand = res_app.json()
        assert approved_brand["status"] == "active"
        assert approved_brand["is_public"] is False  # Public visibility remains opt-in
        assert approved_brand["admin_notes"] == "Identity verified"

        # 3. CRITICAL: Verify trial dates are identical to signup time!
        db_session.refresh(trial)
        assert trial.start_date == orig_start, "Approval must NOT reset trial start date!"
        assert trial.end_date == orig_end, "Approval must NOT reset trial end date!"
        # Days remaining reflects the 3 days spent in pending
        delta = (trial.end_date - datetime.now(timezone.utc)).total_seconds()
        assert 6 <= int(delta // 86400) <= 7


@pytest.mark.anyio
async def test_admin_brand_reject_suspend_and_reactivate_lifecycle(db_session: Session):
    """
    Requirement 4:
    - Reject sets status='rejected' and is_public=False.
    - Suspend sets status='suspended', removing brand from public catalog.
    - Reactivation follows explicit admin route setting status='active'.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_lifecycle")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_cycle")
    brand = create_brand_with_trial(db_session, owner_user, status="active", is_public=True)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Suspend active brand
        res_susp = await client.post(
            f"/api/admin/brands/{brand.id}/suspend",
            json={"admin_notes": "Investigation"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_susp.status_code == 200
        assert res_susp.json()["status"] == "suspended"

        # Public directory check: Suspended brand must be excluded
        res_pub = await client.get("/api/public/brands")
        assert res_pub.status_code == 200
        assert not any(b["id"] == str(brand.id) for b in res_pub.json())

        # 2. Reactivate suspended brand
        res_react = await client.post(
            f"/api/admin/brands/{brand.id}/reactivate",
            json={"admin_notes": "Investigation cleared"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_react.status_code == 200
        assert res_react.json()["status"] == "active"

        # 3. Reject brand
        res_rej = await client.post(
            f"/api/admin/brands/{brand.id}/reject",
            json={"reason": "Terms violation"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_rej.status_code == 200
        rejected = res_rej.json()
        assert rejected["status"] == "rejected"
        assert rejected["is_public"] is False


@pytest.mark.anyio
async def test_admin_chart_review_lists_sizing_charts_with_metadata(db_session: Session):
    """
    Test chart review API:
    - Lists sizing charts across brands.
    - Displays format, status, version, and entry count.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_charts")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_charts")
    brand = create_brand_with_trial(db_session, owner_user, status="active", is_public=True)

    chart = SizingChart(
        brand_id=brand.id,
        chart_name="Test Almond Chart",
        format="per_size",
        unit="mm",
        status="published",
        is_public=True,
        version=1,
    )
    db_session.add(chart)
    db_session.flush()

    # Add 2 entries
    entry1 = SizingChartEntry(chart_id=chart.id, size_label="XS", thumb_width_mm=14.0, index_width_mm=12.0, display_order=0)
    entry2 = SizingChartEntry(chart_id=chart.id, size_label="S", thumb_width_mm=15.0, index_width_mm=13.0, display_order=1)
    db_session.add_all([entry1, entry2])
    db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/admin/charts/review", headers={"Authorization": f"Bearer {t_admin}"})
        assert res.status_code == 200
        charts = res.json()
        assert len(charts) >= 1
        matched = next((c for c in charts if c["id"] == str(chart.id)), None)
        assert matched is not None
        assert matched["chart_name"] == "Test Almond Chart"
        assert matched["format"] == "per_size"
        assert matched["brand_name"] == brand.name
        assert matched["entry_count"] == 2
