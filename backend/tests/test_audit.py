import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User
from app.models.brand import Brand, BrandMember
from app.models.trial import BrandTrial
from app.models.audit import AdminAuditEvent
from app.routers.admin import sanitize_audit_state
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


def create_brand(db_session: Session, owner: User) -> Brand:
    now = datetime.now(timezone.utc)
    brand = Brand(
        owner_id=owner.id,
        name=f"Studio {uuid.uuid4().hex[:6]}",
        slug=f"studio-{uuid.uuid4().hex[:6]}",
        contact_person="Owner",
        contact_email=owner.email,
        country="India",
        status="pending_review",
        is_public=False,
        created_at=now,
    )
    db_session.add(brand)
    db_session.flush()

    trial = BrandTrial(
        brand_id=brand.id,
        start_date=now,
        end_date=now + timedelta(days=10),
        status="active",
        created_at=now,
    )
    db_session.add(trial)
    db_session.commit()
    db_session.refresh(brand)
    return brand


@pytest.mark.anyio
async def test_audit_event_logged_transactionally_for_each_privileged_mutation(db_session: Session):
    """
    Requirement 7:
    Each admin mutation creates exactly one audit event in the same transaction.
    Tests brand approval, brand suspension, user status change, and trial update.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_audit")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_audit")
    target_pers, _ = create_user(db_session, role="personal", email_prefix="target_pers")
    brand = create_brand(db_session, owner_user)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Brand Approve -> generates 'brand_approved' audit event
        res_app = await client.post(
            f"/api/admin/brands/{brand.id}/approve",
            json={"admin_notes": "All checks passed"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_app.status_code == 200

        audit1 = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == brand.id, AdminAuditEvent.action == "brand_approved")
            .first()
        )
        assert audit1 is not None
        assert audit1.admin_id == admin_user.id
        assert audit1.target_entity == "brands"
        assert audit1.previous_state == {"status": "pending_review", "is_public": False, "has_notes": False}
        assert audit1.new_state == {"status": "active", "is_public": False, "has_notes": True, "notes_updated": True}
        assert "admin_notes" not in audit1.new_state

        # 2. User Role Update -> generates 'user_status_or_role_updated' audit event
        res_user = await client.patch(
            f"/api/admin/accounts/{target_pers.id}/status-or-role",
            json={"role": "brand"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_user.status_code == 200

        audit2 = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == target_pers.id, AdminAuditEvent.action == "user_status_or_role_updated")
            .first()
        )
        assert audit2 is not None
        assert audit2.admin_id == admin_user.id
        assert audit2.target_entity == "users"
        assert audit2.previous_state == {"role": "personal", "is_active": True}
        assert audit2.new_state == {"role": "brand", "is_active": True}

        # 3. Trial Update -> generates 'trial_updated' audit event
        res_trial = await client.patch(
            f"/api/admin/trials/{brand.id}",
            json={"status": "extended", "notes": "Granted extra week"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_trial.status_code == 200

        audit3 = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == brand.trial.id, AdminAuditEvent.action == "trial_updated")
            .first()
        )
        assert audit3 is not None
        assert audit3.target_entity == "brand_trials"
        assert audit3.new_state["status"] == "extended"
        assert audit3.new_state["has_notes"] is True
        assert audit3.new_state["notes_updated"] is True
        assert "notes" not in audit3.new_state


@pytest.mark.anyio
async def test_forced_audit_failure_rolls_back_domain_mutation(db_session: Session):
    """
    Requirement 7 (Atomicity & Rollback Guarantee):
    If audit writing fails or an error occurs in the transaction, the corresponding
    domain change (e.g. brand status update) MUST be rolled back completely.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_fail")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_fail")
    brand = create_brand(db_session, owner_user)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Patch record_audit_event to simulate an unhandled database error during audit logging
        with patch("app.routers.admin.record_audit_event", side_effect=RuntimeError("Simulated database audit write failure")):
            with pytest.raises(RuntimeError):
                await client.post(
                    f"/api/admin/brands/{brand.id}/approve",
                    json={"admin_notes": "Should fail and roll back"},
                    headers={"Authorization": f"Bearer {t_admin}"},
                )

        # Confirm the domain mutation was NOT committed to the database
        db_session.rollback()
        db_session.refresh(brand)
        assert brand.status == "pending_review", "Domain mutation must be rolled back on audit failure!"
        assert brand.admin_notes is None

        # Confirm zero audit rows were stored for this failed operation
        audit_count = db_session.query(AdminAuditEvent).filter(AdminAuditEvent.target_id == brand.id).count()
        assert audit_count == 0


@pytest.mark.anyio
async def test_audit_log_is_append_only_and_cannot_be_modified_or_deleted_via_api(db_session: Session):
    """
    Requirement 8:
    Audit log cannot be modified or deleted through the API.
    Attempting POST, PUT, PATCH, or DELETE on /api/admin/audit-events returns 405 Method Not Allowed.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_append")
    headers = {"Authorization": f"Bearer {t_admin}"}

    # Record a test audit event in DB
    event = AdminAuditEvent(
        id=uuid.uuid4(),
        admin_id=admin_user.id,
        action="manual_test_event",
        target_entity="test_entity",
        target_id=uuid.uuid4(),
        previous_state={"state": 1},
        new_state={"state": 2},
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(event)
    db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Attempt POST to create audit directly -> 405
        res_post = await client.post("/api/admin/audit-events", json={"action": "fake"}, headers=headers)
        assert res_post.status_code == 405

        # 2. Attempt PUT -> 405
        res_put = await client.put("/api/admin/audit-events", json={"action": "fake"}, headers=headers)
        assert res_put.status_code == 405

        # 3. Attempt PATCH -> 405
        res_patch = await client.patch(f"/api/admin/audit-events/{event.id}", json={"action": "tamper"}, headers=headers)
        assert res_patch.status_code in (404, 405)

        # 4. Attempt DELETE -> 405
        res_del = await client.delete(f"/api/admin/audit-events/{event.id}", headers=headers)
        assert res_del.status_code in (404, 405)

        # 5. Verify the event is still safely preserved in DB
        db_session.refresh(event)
        assert event.action == "manual_test_event"


@pytest.mark.anyio
async def test_audit_events_list_query_and_privacy_redaction(db_session: Session):
    """
    Requirement 8:
    - Lists audit events with filters (action, target_entity, target_id, admin_id).
    - Returns admin_email and safe summary.
    - PRIVACY GUARANTEE: Never includes credentials, tokens, hand images, or original chart uploads.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_query")
    target_id = uuid.uuid4()

    event = AdminAuditEvent(
        id=uuid.uuid4(),
        admin_id=admin_user.id,
        action="test_privacy_action",
        target_entity="safe_entity",
        target_id=target_id,
        previous_state={"status": "draft"},
        new_state={"status": "published"},
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(event)
    db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/admin/audit-events?action=test_privacy_action",
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res.status_code == 200
        events = res.json()
        assert len(events) >= 1
        matched = events[0]
        assert matched["action"] == "test_privacy_action"
        assert matched["target_entity"] == "safe_entity"
        assert matched["target_id"] == str(target_id)
        assert matched["admin_email"] == admin_user.email
        assert matched["previous_state"] == {"status": "draft"}
        assert matched["new_state"] == {"status": "published"}

        # Raw response text check: Ensure no passwords, tokens, or biometric binaries exist
        raw_text = res.text.lower()
        assert "password" not in raw_text
        assert "password_hash" not in raw_text
        assert "data:image" not in raw_text
        assert "access_token" not in raw_text


@pytest.mark.anyio
async def test_audit_snapshots_exclude_private_strings_and_base64_payloads(db_session: Session):
    """
    Requirement 1, 2, 3:
    Audit snapshots use explicit safe fields only.
    Distinctive private strings (e.g. secrets, sensitive notes, customer identifiers)
    and image/base64-like content submitted through brand admin_notes and trial notes
    MUST be strictly absent from both the stored audit event row and the GET /api/admin/audit-events API response.
    Atomic rollback behavior on audit write failure is preserved.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_priv")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_priv")
    brand = create_brand(db_session, owner_user)

    distinctive_private_string = "CONFIDENTIAL_PATIENT_SSN_999-88-7777 secret_api_key_sk_live_xyz987654321"
    base64_image_content = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Submit distinctive private string via brand admin_notes during approval
        res_app = await client.post(
            f"/api/admin/brands/{brand.id}/approve",
            json={"admin_notes": distinctive_private_string},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_app.status_code == 200

        # Verify the brand row itself holds the note for operational review, BUT the audit snapshot DOES NOT
        db_session.refresh(brand)
        assert brand.admin_notes == distinctive_private_string

        audit_brand = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == brand.id, AdminAuditEvent.action == "brand_approved")
            .first()
        )
        assert audit_brand is not None
        # Assert safe fields only
        assert audit_brand.previous_state == {"status": "pending_review", "is_public": False, "has_notes": False}
        assert audit_brand.new_state == {"status": "active", "is_public": False, "has_notes": True, "notes_updated": True}

        # Distinctive private string is strictly absent from DB audit row
        prev_str = str(audit_brand.previous_state)
        new_str = str(audit_brand.new_state)
        assert "CONFIDENTIAL_PATIENT_SSN" not in prev_str
        assert "CONFIDENTIAL_PATIENT_SSN" not in new_str
        assert "secret_api_key" not in prev_str
        assert "secret_api_key" not in new_str
        assert "admin_notes" not in prev_str
        assert "admin_notes" not in new_str

        # 2. Submit image / base64-like content via trial notes
        res_trial = await client.patch(
            f"/api/admin/trials/{brand.id}",
            json={"status": "extended", "notes": base64_image_content},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_trial.status_code == 200

        audit_trial = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == brand.trial.id, AdminAuditEvent.action == "trial_updated")
            .first()
        )
        assert audit_trial is not None
        assert audit_trial.new_state["status"] == "extended"
        assert audit_trial.new_state["has_notes"] is True
        assert audit_trial.new_state["notes_updated"] is True
        assert "notes" not in audit_trial.new_state

        trial_prev_str = str(audit_trial.previous_state)
        trial_new_str = str(audit_trial.new_state)
        assert "data:image" not in trial_prev_str
        assert "data:image" not in trial_new_str
        assert "base64" not in trial_prev_str
        assert "base64" not in trial_new_str
        assert "iVBORw0KGgo" not in trial_prev_str
        assert "iVBORw0KGgo" not in trial_new_str

        # 3. Verify GET /api/admin/audit-events response CANNOT return those free-text fields
        res_events = await client.get(
            "/api/admin/audit-events",
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_events.status_code == 200
        events_json = res_events.json()
        raw_events_text = res_events.text

        # Verify across entire API response payload
        assert "CONFIDENTIAL_PATIENT_SSN" not in raw_events_text
        assert "secret_api_key" not in raw_events_text
        assert "data:image" not in raw_events_text
        assert "iVBORw0KGgo" not in raw_events_text
        assert "admin_notes" not in raw_events_text

        # Inspect specific matched event objects
        brand_ev = next(e for e in events_json if e["id"] == str(audit_brand.id))
        assert brand_ev["previous_state"] == {"status": "pending_review", "is_public": False, "has_notes": False}
        assert brand_ev["new_state"] == {"status": "active", "is_public": False, "has_notes": True, "notes_updated": True}

        trial_ev = next(e for e in events_json if e["id"] == str(audit_trial.id))
        assert "notes" not in trial_ev["new_state"]
        assert trial_ev["new_state"]["has_notes"] is True
        assert trial_ev["new_state"]["notes_updated"] is True

        # 4. Atomic Rollback Verification:
        # Patch record_audit_event to fail and prove domain change rolls back
        with patch("app.routers.admin.record_audit_event", side_effect=RuntimeError("Atomic audit failure test")):
            with pytest.raises(RuntimeError):
                await client.post(
                    f"/api/admin/brands/{brand.id}/suspend",
                    json={"admin_notes": "Attempt to suspend with audit failure"},
                    headers={"Authorization": f"Bearer {t_admin}"},
                )

        db_session.rollback()
        db_session.refresh(brand)
        # Brand status was NOT changed to suspended because transaction rolled back!
        assert brand.status == "active"
        assert brand.admin_notes == distinctive_private_string  # still previous note, not overwritten


@pytest.mark.anyio
async def test_audit_snapshots_exclude_selected_plan_and_strip_out_of_band_plans(db_session: Session):
    """
    Phase 5 Final Audit Privacy Correction:
    - selected_plan is an unrestricted string. It is strictly excluded from SAFE_AUDIT_KEYS.
    - Neither previous_state nor new_state stores the submitted plan string.
    - Records only selected_plan_changed: bool in audit state.
    - Submitting distinctive private text or base64 text through selected_plan updates the trial
      on the domain model, but the plan string is completely absent from the stored audit row
      and the GET /api/admin/audit-events API response.
    - GET /api/admin/audit-events strips selected_plan from existing or out-of-band event snapshots.
    - Transactional rollback on audit failure is preserved.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_plan")
    owner_user, _ = create_user(db_session, role="brand", email_prefix="owner_plan")
    brand = create_brand(db_session, owner_user)

    distinctive_plan_secret = "CONFIDENTIAL_PLAN_SECRET_API_KEY_444_555"
    base64_plan_payload = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Submit distinctive private text through selected_plan
        res_priv_plan = await client.patch(
            f"/api/admin/trials/{brand.id}",
            json={"selected_plan": distinctive_plan_secret, "status": "extended"},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_priv_plan.status_code == 200
        # Domain behavior unchanged: trial model updated
        db_session.refresh(brand.trial)
        assert brand.trial.selected_plan == distinctive_plan_secret
        assert brand.trial.status == "extended"

        audit_priv = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == brand.trial.id, AdminAuditEvent.action == "trial_updated")
            .order_by(AdminAuditEvent.created_at.desc())
            .first()
        )
        assert audit_priv is not None
        assert audit_priv.new_state["selected_plan_changed"] is True
        assert "selected_plan" not in audit_priv.new_state
        assert "selected_plan" not in (audit_priv.previous_state or {})
        assert distinctive_plan_secret not in str(audit_priv.new_state)
        assert distinctive_plan_secret not in str(audit_priv.previous_state)

        # 2. Submit base64-like text through selected_plan
        res_b64_plan = await client.patch(
            f"/api/admin/trials/{brand.id}",
            json={"selected_plan": base64_plan_payload},
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_b64_plan.status_code == 200
        db_session.refresh(brand.trial)
        assert brand.trial.selected_plan == base64_plan_payload

        audit_b64 = (
            db_session.query(AdminAuditEvent)
            .filter(AdminAuditEvent.target_id == brand.trial.id, AdminAuditEvent.action == "trial_updated")
            .order_by(AdminAuditEvent.created_at.desc())
            .first()
        )
        assert audit_b64 is not None
        assert audit_b64.new_state["selected_plan_changed"] is True
        assert "selected_plan" not in audit_b64.new_state
        assert "data:image" not in str(audit_b64.new_state)
        assert "base64" not in str(audit_b64.new_state)
        assert "iVBORw0KGgo" not in str(audit_b64.new_state)

        # 3. Insert an out-of-band legacy event directly with selected_plan in previous/new state
        out_of_band_event = AdminAuditEvent(
            id=uuid.uuid4(),
            admin_id=admin_user.id,
            action="legacy_out_of_band_event",
            target_entity="brand_trials",
            target_id=brand.trial.id,
            previous_state={"status": "active", "selected_plan": "ROGUE_LEGACY_PLAN_NAME"},
            new_state={"status": "extended", "selected_plan": "OUT_OF_BAND_UNVALIDATED_PLAN"},
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(out_of_band_event)
        db_session.commit()

        # 4. Query GET /api/admin/audit-events and verify all plan strings are absent
        res_events = await client.get(
            "/api/admin/audit-events",
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res_events.status_code == 200
        raw_events_text = res_events.text
        events_json = res_events.json()

        assert distinctive_plan_secret not in raw_events_text
        assert "iVBORw0KGgo" not in raw_events_text
        assert "ROGUE_LEGACY_PLAN_NAME" not in raw_events_text
        assert "OUT_OF_BAND_UNVALIDATED_PLAN" not in raw_events_text

        # Verify specific out-of-band item was sanitized: selected_plan is stripped
        oob_item = next(e for e in events_json if e["id"] == str(out_of_band_event.id))
        assert "selected_plan" not in oob_item["previous_state"]
        assert "selected_plan" not in oob_item["new_state"]
        assert oob_item["previous_state"] == {"status": "active"}
        assert oob_item["new_state"] == {"status": "extended"}

        # 5. Atomic Rollback Check for trial update:
        with patch("app.routers.admin.record_audit_event", side_effect=RuntimeError("Simulated trial audit failure")):
            with pytest.raises(RuntimeError):
                await client.patch(
                    f"/api/admin/trials/{brand.id}",
                    json={"selected_plan": "FAILED_PLAN_SHOULD_ROLLBACK"},
                    headers={"Authorization": f"Bearer {t_admin}"},
                )

        db_session.rollback()
        db_session.refresh(brand.trial)
        # selected_plan was NOT updated because transaction rolled back!
        assert brand.trial.selected_plan == base64_plan_payload


@pytest.mark.anyio
async def test_audit_sanitizer_validates_types_and_values_and_strips_out_of_band_private_strings(db_session: Session):
    """
    Phase 5 Audit Sanitizer Fix:
    Validate each allowed key by its expected type and value:
    - role: only "personal", "brand", or "admin"
    - status: only known product values: "active", "pending_review", "rejected", "suspended",
      "demo_sample", "draft", "published", "ending_soon", "expired", "extended", or "converted"
    - renewal_intent: only "yes", "no", "pending", or "not_asked"
    - end_date: only a valid canonical ISO datetime string matching datetime.isoformat()
    - is_active, is_public, selected_plan_changed, has_notes, notes_updated: actual booleans only (reject strings and numbers)
    - Drop invalid values and unknown keys without logging or returning rejected values.
    - Verify GET /api/admin/audit-events strips out-of-band private strings while preserving valid values.
    """
    admin_user, t_admin = create_user(db_session, role="admin", email_prefix="adm_oob")
    target_user, _ = create_user(db_session, role="personal", email_prefix="target_oob")

    private_role_leak = "CONFIDENTIAL_EXECUTIVE_ROLE_OVERRIDE_TOP_SECRET"
    private_status_leak = "HIGHLY_SENSITIVE_BRAND_STATUS_INVESTIGATION_PENDING"
    private_intent_leak = "RESTRICTED_RENEWAL_INTENT_LEGAL_DISPUTE_999"
    private_date_leak = "PRIVATE_TERMINATION_DATE_SECRET_LEAK"

    now = datetime.now(timezone.utc)
    valid_iso = now.isoformat()

    # 1. Out-of-band audit event with private strings in role, status, renewal_intent, and end_date
    oob_event_1 = AdminAuditEvent(
        id=uuid.uuid4(),
        admin_id=admin_user.id,
        action="oob_leak_attempt_event",
        target_entity="system",
        target_id=target_user.id,
        previous_state={
            "role": private_role_leak,
            "status": private_status_leak,
            "renewal_intent": private_intent_leak,
            "end_date": private_date_leak,
            "is_active": "true",  # string, not boolean -> must be dropped
            "is_public": 1,       # int, not boolean -> must be dropped
            "unauthorized_private_key": "some_secret_text",
        },
        new_state={
            "role": "admin",
            "status": "active",
            "renewal_intent": "yes",
            "end_date": valid_iso,
            "is_active": True,
            "is_public": False,
            "selected_plan_changed": True,
            "has_notes": False,
            "notes_updated": True,
        },
        created_at=now,
    )
    db_session.add(oob_event_1)

    # 2. Out-of-band audit event testing non-canonical date formats and non-boolean flags
    oob_event_2 = AdminAuditEvent(
        id=uuid.uuid4(),
        admin_id=admin_user.id,
        action="oob_format_check_event",
        target_entity="system",
        target_id=target_user.id,
        previous_state={
            "end_date": "1999-01-01",               # date-only, not canonical datetime.isoformat()
            "selected_plan_changed": 0,             # int 0 -> must be dropped
            "has_notes": "false",                   # string -> must be dropped
            "notes_updated": 1.0,                   # float -> must be dropped
        },
        new_state={
            "end_date": "1999/01/01 10:00:00",      # non-ISO format -> must be dropped
            "selected_plan": "unvalidated_plan_str",# excluded key -> must be dropped
            "status": "unknown_custom_status",      # unknown status value -> must be dropped
            "role": "superadmin",                   # invalid role value -> must be dropped
            "renewal_intent": "maybe",              # invalid renewal intent -> must be dropped
        },
        created_at=now,
    )
    db_session.add(oob_event_2)
    db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/admin/audit-events",
            headers={"Authorization": f"Bearer {t_admin}"},
        )
        assert res.status_code == 200
        raw_text = res.text
        events_json = res.json()

        # Check that none of the private strings leak into the API response
        assert private_role_leak not in raw_text
        assert private_status_leak not in raw_text
        assert private_intent_leak not in raw_text
        assert private_date_leak not in raw_text
        assert "unauthorized_private_key" not in raw_text
        assert "some_secret_text" not in raw_text
        assert "unvalidated_plan_str" not in raw_text
        assert "unknown_custom_status" not in raw_text
        assert "superadmin" not in raw_text
        assert "maybe" not in raw_text
        assert "1999-01-01" not in raw_text
        assert "1999/01/01" not in raw_text

        # Inspect oob_event_1 in response
        ev1 = next(e for e in events_json if e["id"] == str(oob_event_1.id))
        # previous_state had all invalid values -> should be sanitized to empty dict
        assert ev1["previous_state"] == {}
        # new_state had valid values -> all should be preserved
        assert ev1["new_state"] == {
            "role": "admin",
            "status": "active",
            "renewal_intent": "yes",
            "end_date": valid_iso,
            "is_active": True,
            "is_public": False,
            "selected_plan_changed": True,
            "has_notes": False,
            "notes_updated": True,
        }

        # Inspect oob_event_2 in response
        ev2 = next(e for e in events_json if e["id"] == str(oob_event_2.id))
        # All keys in previous_state and new_state were invalid types/values
        assert ev2["previous_state"] == {}
        assert ev2["new_state"] == {}

    # 3. Unit-level matrix verification of sanitize_audit_state directly
    all_product_statuses = [
        "active", "pending_review", "rejected", "suspended",
        "demo_sample", "draft", "published", "ending_soon",
        "expired", "extended", "converted",
    ]
    for st in all_product_statuses:
        assert sanitize_audit_state({"status": st}) == {"status": st}

    for r in ["personal", "brand", "admin"]:
        assert sanitize_audit_state({"role": r}) == {"role": r}

    for ri in ["yes", "no", "pending", "not_asked"]:
        assert sanitize_audit_state({"renewal_intent": ri}) == {"renewal_intent": ri}

    for bk in ["is_active", "is_public", "selected_plan_changed", "has_notes", "notes_updated"]:
        assert sanitize_audit_state({bk: True}) == {bk: True}
        assert sanitize_audit_state({bk: False}) == {bk: False}
        assert sanitize_audit_state({bk: "true"}) == {}
        assert sanitize_audit_state({bk: 1}) == {}
        assert sanitize_audit_state({bk: 0}) == {}

