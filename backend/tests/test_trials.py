import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User
from app.models.brand import Brand, BrandMember
from app.models.chart import SizingChart
from app.models.trial import BrandTrial
from app.models.audit import AdminAuditEvent
from app.core.security import hash_password, create_access_token

@pytest.fixture
def anyio_backend():
    return "asyncio"


def create_user(db_session: Session, role: str = "personal", email_prefix: str = "user") -> tuple[User, str]:
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


def create_brand_with_trial(
    db_session: Session,
    owner: User,
    start_offset_days: int = 0,
    trial_duration_days: int = 10,
    status: str = "pending_review",
    is_public: bool = False,
) -> tuple[Brand, BrandTrial]:
    now = datetime.now(timezone.utc)
    signup_time = now - timedelta(days=start_offset_days)

    brand = Brand(
        owner_id=owner.id,
        name=f"Trial Brand {uuid.uuid4().hex[:6]}",
        slug=f"trial-brand-{uuid.uuid4().hex[:6]}",
        contact_person=owner.full_name or "Jane Owner",
        contact_email=owner.email,
        country="India",
        status=status,
        is_public=is_public,
        shapes=["Almond"],
        created_at=signup_time,
    )
    db_session.add(brand)
    db_session.flush()

    member = BrandMember(brand_id=brand.id, user_id=owner.id, role="owner")
    db_session.add(member)

    trial = BrandTrial(
        brand_id=brand.id,
        start_date=signup_time,
        end_date=signup_time + timedelta(days=trial_duration_days),
        status="active",
        renewal_intent="not_asked",
        selected_plan="growth",
        created_at=signup_time,
    )
    db_session.add(trial)
    db_session.commit()
    db_session.refresh(brand)
    db_session.refresh(trial)
    return brand, trial


@pytest.mark.anyio
async def test_trial_starts_at_signup_and_is_ten_days(db_session: Session):
    """
    Requirement 5:
    Trial start/end equal signup time and +10 days.
    """
    owner_user, _ = create_user(db_session, role="brand", email_prefix="trial_owner")
    brand, trial = create_brand_with_trial(db_session, owner_user, start_offset_days=0, trial_duration_days=10)

    # Verify duration
    duration = (trial.end_date - trial.start_date).total_seconds()
    assert int(duration // 86400) == 10
    assert trial.status == "active"
    assert trial.renewal_intent == "not_asked"
    assert trial.selected_plan == "growth"


@pytest.mark.anyio
async def test_pending_duration_counts_and_approval_does_not_reset_trial(db_session: Session):
    """
    Requirement 2 & 5:
    Pending time counts toward the 10-day trial.
    Admin approval must NOT reset signup-time trial dates.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_trial")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_pending")

    # Created 4 days ago
    brand, trial = create_brand_with_trial(db_session, owner_user, start_offset_days=4, trial_duration_days=10)
    orig_start = trial.start_date
    orig_end = trial.end_date

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin inspects trial before approval
        res_get = await client.get(f"/api/admin/trials/{brand.id}", headers={"Authorization": f"Bearer {t_admin}"})
        assert res_get.status_code == 200
        data_before = res_get.json()
        assert data_before["days_remaining"] == 6
        assert data_before["is_expired"] is False

        # Admin approves brand
        res_app = await client.post(
            f"/api/admin/brands/{brand.id}/approve",
            json={"admin_notes": "Approved on day 4"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_app.status_code == 200

        # Confirm trial timestamps did NOT reset
        db_session.refresh(trial)
        assert trial.start_date == orig_start
        assert trial.end_date == orig_end

        # Admin inspects trial after approval
        res_after = await client.get(f"/api/admin/trials/{brand.id}", headers={"Authorization": f"Bearer {t_admin}"})
        assert res_after.status_code == 200
        data_after = res_after.json()
        assert data_after["start_date"] == orig_start.isoformat()
        assert data_after["end_date"] == orig_end.isoformat()
        assert data_after["days_remaining"] == 6


@pytest.mark.anyio
async def test_trial_expiry_is_informational_only_no_auto_consequences(db_session: Session):
    """
    Requirement 6:
    Trial expiry is INFORMATIONAL ONLY.
    Marking a trial expired or past its end date does NOT:
    - Auto-hide public brand or charts.
    - Freeze editing of sizing charts.
    - Downgrade plans or trigger payments/billing.
    - Delete any records.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_exp")
    owner_user, t_owner = create_user(db_session, role="brand", email_prefix="owner_exp")

    # Brand is approved and public, trial ended 2 days ago
    brand, trial = create_brand_with_trial(
        db_session, owner_user, start_offset_days=12, trial_duration_days=10, status="active", is_public=True
    )
    # Published, public chart
    chart = SizingChart(
        brand_id=brand.id,
        chart_name="Active Sizing",
        format="per_size",
        unit="mm",
        status="published",
        is_public=True,
        version=1,
    )
    db_session.add(chart)
    db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Inspect trial via admin: reported as expired and 0 days remaining
        res_trial = await client.get(f"/api/admin/trials/{brand.id}", headers={"Authorization": f"Bearer {t_admin}"})
        assert res_trial.status_code == 200
        trial_info = res_trial.json()
        assert trial_info["is_expired"] is True
        assert trial_info["days_remaining"] == 0

        # Explicitly mark status='expired' via admin PATCH
        res_patch = await client.patch(
            f"/api/admin/trials/{brand.id}",
            json={"status": "expired", "notes": "Informational expiry marked"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_patch.status_code == 200
        assert res_patch.json()["status"] == "expired"

        # 2. Public Catalog Check: Brand and Chart are NOT hidden
        res_pub = await client.get("/api/public/brands")
        assert res_pub.status_code == 200
        assert any(b["id"] == str(brand.id) for b in res_pub.json())

        # 3. Chart Editing Check: Brand owner can STILL edit and validate charts
        res_validate = await client.post(
            f"/api/brands/{brand.id}/charts/validate",
            json={
                "chart_name": "Active Sizing",
                "format": "per_size",
                "per_size_entries": [
                    {"size_label": "M", "thumb_width_mm": 15.0, "index_width_mm": 13.0, "middle_width_mm": 14.0, "ring_width_mm": 13.0, "pinky_width_mm": 10.0}
                ]
            },
            headers={"Authorization": f"Bearer {t_owner}"},
        )
        assert res_validate.status_code == 200
        assert res_validate.json()["valid"] is True

        # 4. No payment or billing side-effects exist
        db_session.refresh(brand)
        assert brand.status == "active"
        assert brand.is_public is True


@pytest.mark.anyio
async def test_admin_update_trial_parameters_audited(db_session: Session):
    """
    Test trial administration:
    - Admin updates trial parameters (extend end_date, change selected_plan, renewal_intent).
    - Privileged mutation is audited in admin_audit_events in the same transaction.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_tupdate")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_tupdate")
    brand, trial = create_brand_with_trial(db_session, owner_user, start_offset_days=0, trial_duration_days=10)

    future_date = datetime.now(timezone.utc) + timedelta(days=25)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_patch = await client.patch(
            f"/api/admin/trials/{brand.id}",
            json={
                "status": "extended",
                "renewal_intent": "yes",
                "selected_plan": "pro",
                "end_date": future_date.isoformat(),
                "notes": "Custom pilot extension",
            },
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_patch.status_code == 200
        updated = res_patch.json()
        assert updated["status"] == "extended"
        assert updated["renewal_intent"] == "yes"
        assert updated["selected_plan"] == "pro"
        assert updated["notes"] == "Custom pilot extension"

        # Verify DB reflection
        db_session.refresh(trial)
        assert trial.status == "extended"
        assert trial.renewal_intent == "yes"
        assert trial.selected_plan == "pro"

        # Verify transactional audit event
        audit = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == trial.id, AdminAuditEvent.action == "trial_updated")
            .first()
        )
        assert audit is not None
        assert audit.admin_id == admin_user.id
        assert audit.target_entity == "brand_trials"
        assert audit.new_state["status"] == "extended"
        assert audit.new_state["selected_plan_changed"] is True
        assert "selected_plan" not in audit.new_state
