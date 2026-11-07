import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User
from app.models.brand import Brand, BrandMember
from app.models.trial import BrandTrial
from app.core.security import hash_password, create_access_token

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_brand_apply_creates_pending_brand_membership_and_trial_atomically(
    db_session: Session,
):
    """
    Test Case 1:
    Brand apply creates pending/private brand, owner membership, and a ten-day trial
    atomically from the signup/application timestamp.
    """
    user = User(
        email=f"applicant_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role="personal",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token(user.id, user.email, "personal")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "name": "Luxe PressOn Studio",
            "tagline": "Handcrafted luxury nails",
            "description": "High end custom press-on sets",
            "contact_person": "Jane Doe",
            "contact_email": user.email,
            "website": "https://luxepresson.example.com",
            "city": "Mumbai",
            "country": "India",
            "shapes": ["Almond", "Coffin"],
        }
        res = await client.post(
            "/api/brands/apply",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["success"] is True
        assert "pending review" in data["message"].lower()

        brand_data = data["brand"]
        assert brand_data["name"] == "Luxe PressOn Studio"
        assert brand_data["status"] == "pending_review"
        assert brand_data["is_public"] is False
        assert brand_data["owner_id"] == str(user.id)

        # Verify trial in response
        trial_data = brand_data["trial"]
        assert trial_data is not None
        assert trial_data["status"] == "active"
        assert trial_data["renewal_intent"] == "not_asked"
        assert trial_data["selected_plan"] == "growth"

        # Check database records
        brand_id = uuid.UUID(brand_data["id"])
        db_brand = db_session.query(Brand).filter(Brand.id == brand_id).first()
        assert db_brand is not None
        assert db_brand.status == "pending_review"
        assert db_brand.is_public is False

        # Owner membership
        membership = db_session.query(BrandMember).filter(BrandMember.brand_id == brand_id).first()
        assert membership is not None
        assert membership.user_id == user.id
        assert membership.role == "owner"

        # Ten-day trial
        db_trial = db_session.query(BrandTrial).filter(BrandTrial.brand_id == brand_id).first()
        assert db_trial is not None
        duration = db_trial.end_date - db_trial.start_date
        assert duration.days == 10

        # User upgraded to brand role
        db_session.refresh(user)
        assert user.role == "brand"

@pytest.mark.anyio
async def test_trial_advances_for_pending_brand_and_approval_does_not_reset_dates(
    db_session: Session,
):
    """
    Test Case 2:
    Trial starts at brand application timestamp and continues while pending.
    Approval must NOT reset trial start/end dates.
    """
    owner = User(email=f"owner_{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("Pass123!"), role="brand", is_active=True)
    db_session.add(owner)
    db_session.flush()

    signup_time = datetime.now(timezone.utc) - timedelta(days=2)
    end_time = signup_time + timedelta(days=10)

    brand = Brand(
        owner_id=owner.id,
        name="Timeless Nails",
        slug=f"timeless-nails-{uuid.uuid4().hex[:6]}",
        contact_email=owner.email,
        status="pending_review",
        is_public=False,
        created_at=signup_time,
    )
    db_session.add(brand)
    db_session.flush()

    trial = BrandTrial(
        brand_id=brand.id,
        start_date=signup_time,
        end_date=end_time,
        status="active",
        created_at=signup_time,
    )
    db_session.add(trial)

    membership = BrandMember(brand_id=brand.id, user_id=owner.id, role="owner")
    db_session.add(membership)
    db_session.commit()

    token = create_access_token(owner.id, owner.email, "brand")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # GET brand details while pending
        r1 = await client.get(f"/api/brands/by-id/{brand.id}", headers={"Authorization": f"Bearer {token}"})
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["status"] == "pending_review"
        assert d1["trial"]["start_date"] == signup_time.isoformat()
        assert d1["trial"]["end_date"] == end_time.isoformat()

        # Admin approves brand
        brand.status = "active"
        db_session.commit()

        # GET brand details after approval: trial start and end dates MUST remain unchanged!
        r2 = await client.get(f"/api/brands/by-id/{brand.id}", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["status"] == "active"
        assert d2["trial"]["start_date"] == signup_time.isoformat()
        assert d2["trial"]["end_date"] == end_time.isoformat()

@pytest.mark.anyio
async def test_brand_user_cannot_set_approval_or_admin_fields(
    db_session: Session,
):
    """
    Test Case 3:
    Brand users cannot set approval state, admin notes, or public flags
    through registration or update requests.
    """
    user = User(email=f"tamper_{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("Pass123!"), role="personal", is_active=True)
    db_session.add(user)
    db_session.commit()

    token = create_access_token(user.id, user.email, "personal")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Attempt to inject status='active', is_public=True, admin_notes into apply
        tamper_apply = {
            "name": "Tamper Studio",
            "contact_person": "Hacker",
            "contact_email": user.email,
            "status": "active",
            "is_public": True,
            "admin_notes": "approved_by_exploit",
        }
        res = await client.post("/api/brands/apply", json=tamper_apply, headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 201
        b_data = res.json()["brand"]
        brand_id = b_data["id"]

        # Server-enforced pending_review, private, no admin notes
        assert b_data["status"] == "pending_review"
        assert b_data["is_public"] is False

        db_brand = db_session.query(Brand).filter(Brand.id == uuid.UUID(brand_id)).first()
        assert db_brand.status == "pending_review"
        assert db_brand.is_public is False
        assert db_brand.admin_notes is None

        # 2. Attempt to PATCH status='active', is_public=True, admin_notes
        tamper_patch = {
            "status": "active",
            "is_public": True,
            "admin_notes": "auto_approved",
            "tagline": "Legitimate Tagline",
        }
        r_patch = await client.patch(
            f"/api/brands/by-id/{brand_id}",
            json=tamper_patch,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r_patch.status_code == 200
        p_data = r_patch.json()["brand"]

        # Status and public flags must remain untouched
        assert p_data["status"] == "pending_review"
        assert p_data["is_public"] is False
        assert p_data["tagline"] == "Legitimate Tagline"

        db_session.refresh(db_brand)
        assert db_brand.status == "pending_review"
        assert db_brand.is_public is False
        assert db_brand.admin_notes is None

@pytest.mark.anyio
async def test_brand_authorization_matrix_and_foreign_brand_rejection(
    db_session: Session,
):
    """
    Test Case 4:
    Owner and manager access follows permission matrix; foreign brand ID is denied.
    - Owner can GET and PATCH brand.
    - Manager can GET brand, but PATCH is rejected (403).
    - Foreign brand user cannot GET or PATCH foreign brand (403).
    - Personal user cannot access brand (403).
    - Platform admin can GET and PATCH brand via admin override.
    """
    owner = User(email=f"owner_{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("Pass123!"), role="brand", is_active=True)
    manager = User(email=f"manager_{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("Pass123!"), role="brand", is_active=True)
    foreign_user = User(email=f"foreign_{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("Pass123!"), role="brand", is_active=True)
    personal_user = User(email=f"personal_{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("Pass123!"), role="personal", is_active=True)
    admin_user = User(email=f"admin_{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("Pass123!"), role="admin", is_active=True)

    db_session.add_all([owner, manager, foreign_user, personal_user, admin_user])
    db_session.flush()

    brand = Brand(
        owner_id=owner.id,
        name="Matrix Brand",
        slug=f"matrix-brand-{uuid.uuid4().hex[:6]}",
        contact_email=owner.email,
        status="active",
        is_public=True,
    )
    db_session.add(brand)
    db_session.flush()

    # Memberships for brand (verified legacy roles: owner and manager)
    m_owner = BrandMember(brand_id=brand.id, user_id=owner.id, role="owner")
    m_mgr = BrandMember(brand_id=brand.id, user_id=manager.id, role="manager")
    db_session.add_all([m_owner, m_mgr])

    # Foreign brand for foreign_user
    foreign_brand = Brand(
        owner_id=foreign_user.id,
        name="Foreign Brand",
        slug=f"foreign-brand-{uuid.uuid4().hex[:6]}",
        contact_email=foreign_user.email,
        status="active",
        is_public=True,
    )
    db_session.add(foreign_brand)
    db_session.flush()
    m_foreign = BrandMember(brand_id=foreign_brand.id, user_id=foreign_user.id, role="owner")
    db_session.add(m_foreign)
    db_session.commit()

    owner_tok = create_access_token(owner.id, owner.email, "brand")
    mgr_tok = create_access_token(manager.id, manager.email, "brand")
    foreign_tok = create_access_token(foreign_user.id, foreign_user.email, "brand")
    personal_tok = create_access_token(personal_user.id, personal_user.email, "personal")
    admin_tok = create_access_token(admin_user.id, admin_user.email, "admin")

    brand_id = str(brand.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Owner: GET ok, PATCH ok
        r = await client.get(f"/api/brands/by-id/{brand_id}", headers={"Authorization": f"Bearer {owner_tok}"})
        assert r.status_code == 200
        r = await client.patch(f"/api/brands/by-id/{brand_id}", json={"city": "Delhi"}, headers={"Authorization": f"Bearer {owner_tok}"})
        assert r.status_code == 200
        assert r.json()["brand"]["city"] == "Delhi"

        # 2. Manager: GET ok, PATCH forbidden (403)
        r = await client.get(f"/api/brands/by-id/{brand_id}", headers={"Authorization": f"Bearer {mgr_tok}"})
        assert r.status_code == 200
        r = await client.patch(f"/api/brands/by-id/{brand_id}", json={"city": "Pune"}, headers={"Authorization": f"Bearer {mgr_tok}"})
        assert r.status_code == 403

        # 3. Foreign brand user: GET forbidden (403), PATCH forbidden (403)
        r = await client.get(f"/api/brands/by-id/{brand_id}", headers={"Authorization": f"Bearer {foreign_tok}"})
        assert r.status_code == 403
        r = await client.patch(f"/api/brands/by-id/{brand_id}", json={"city": "Kolkata"}, headers={"Authorization": f"Bearer {foreign_tok}"})
        assert r.status_code == 403

        # 4. Personal user: GET forbidden (403), PATCH forbidden (403)
        r = await client.get(f"/api/brands/by-id/{brand_id}", headers={"Authorization": f"Bearer {personal_tok}"})
        assert r.status_code == 403
        r = await client.patch(f"/api/brands/by-id/{brand_id}", json={"city": "Chennai"}, headers={"Authorization": f"Bearer {personal_tok}"})
        assert r.status_code == 403

        # 5. Platform admin: GET ok (200), PATCH ok (200) via override
        r = await client.get(f"/api/brands/by-id/{brand_id}", headers={"Authorization": f"Bearer {admin_tok}"})
        assert r.status_code == 200
        r = await client.patch(f"/api/brands/by-id/{brand_id}", json={"city": "Bangalore"}, headers={"Authorization": f"Bearer {admin_tok}"})
        assert r.status_code == 200
        assert r.json()["brand"]["city"] == "Bangalore"
