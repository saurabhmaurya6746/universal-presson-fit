import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User
from app.models.brand import Brand, BrandMember
from app.core.security import hash_password, create_access_token
from app.auth.dependencies import (
    get_current_user,
    require_role,
    require_admin,
    require_brand_any,
    require_brand_manager_or_owner,
    require_brand_owner,
    BrandMemberContext,
)

# Test router to exercise role and brand authorization dependencies
authz_test_router = APIRouter(prefix="/api/test-authz", tags=["test-authz"])

@authz_test_router.get("/admin-only")
def admin_only_endpoint(user: User = Depends(require_admin)):
    return {"message": "Welcome Admin", "role": user.role}

@authz_test_router.get("/brand/{brand_id}/any")
def brand_any_endpoint(ctx: BrandMemberContext = Depends(require_brand_any)):
    return {"message": "Brand Member Allowed", "role": ctx.role}

@authz_test_router.get("/brand/{brand_id}/owner")
def brand_owner_endpoint(ctx: BrandMemberContext = Depends(require_brand_owner)):
    return {"message": "Brand Owner Allowed", "role": ctx.role}

# Mount test router on app
app.include_router(authz_test_router)

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_role_changes_in_db_take_effect_immediately_without_trusting_jwt_claims(
    db_session: Session,
):
    """
    Test Case 8:
    Verify that role changes and account disabling take effect directly from PostgreSQL
    on the next request, even if the caller presents a JWT token with different claims.
    JWT role claims are purely informational and never authoritative.
    """
    user = User(
        email="role_tamper_test@example.com",
        password_hash=hash_password("Pass123!"),
        role="personal",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    # 1. Forge or issue a JWT claiming 'admin' role while DB role is 'personal'
    tampered_jwt = create_access_token(user.id, user.email, role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Caller tries to access admin endpoint with tampered JWT role
        r1 = await client.get(
            "/api/test-authz/admin-only",
            headers={"Authorization": f"Bearer {tampered_jwt}"},
        )
        # Authoritative DB lookup sees user.role == 'personal' -> 403 Forbidden!
        assert r1.status_code == 403

        # 2. Promote user to 'admin' in PostgreSQL
        user.role = "admin"
        db_session.commit()

        # Present a JWT that claimed 'personal' role
        stale_personal_jwt = create_access_token(user.id, user.email, role="personal")

        r2 = await client.get(
            "/api/test-authz/admin-only",
            headers={"Authorization": f"Bearer {stale_personal_jwt}"},
        )
        # Authoritative DB lookup sees user.role == 'admin' -> 200 OK!
        assert r2.status_code == 200
        assert r2.json()["role"] == "admin"

        # 3. Disable account in PostgreSQL
        user.is_active = False
        db_session.commit()

        r3 = await client.get(
            "/api/test-authz/admin-only",
            headers={"Authorization": f"Bearer {stale_personal_jwt}"},
        )
        # Inactive status takes effect on the very next request -> 401 Unauthorized
        assert r3.status_code == 401

@pytest.mark.anyio
async def test_authorization_matrix_personal_brand_admin_and_brand_owner_vs_manager(
    db_session: Session,
):
    """
    Test Case 9:
    Verify authoritative permission matrix matching legacy schema and Phase 0 inventory:
    - Legacy schema permits only 'owner' and 'manager' brand membership roles.
    - Personal cannot access brand studio or admin endpoints.
    - Foreign brand members cannot access another brand's studio endpoints.
    - Distinct owner vs manager permissions:
      * Manager can access brand member endpoints ('any'), but is rejected on 'owner' (403).
      * Owner can access both member and owner endpoints.
    - Platform admin can access admin and has override access to brand studios.
    """
    # 1. Create brand owner, manager, foreign user, personal user, and admin user
    owner_user = User(email="owner@example.com", password_hash=hash_password("Pass123!"), role="brand", is_active=True)
    manager_user = User(email="manager@example.com", password_hash=hash_password("Pass123!"), role="brand", is_active=True)
    foreign_user = User(email="foreign@example.com", password_hash=hash_password("Pass123!"), role="brand", is_active=True)
    personal_user = User(email="personal@example.com", password_hash=hash_password("Pass123!"), role="personal", is_active=True)
    admin_user = User(email="admin@example.com", password_hash=hash_password("Pass123!"), role="admin", is_active=True)

    db_session.add_all([owner_user, manager_user, foreign_user, personal_user, admin_user])
    db_session.commit()

    # 2. Create brand studio
    brand = Brand(
        owner_id=owner_user.id,
        name="Test Brand Studio",
        slug=f"test-brand-studio-{uuid.uuid4().hex[:8]}",
        contact_email="owner@example.com",
        status="active",
        is_public=True,
    )
    db_session.add(brand)
    db_session.commit()

    brand_id = str(brand.id)

    # 3. Create brand memberships with verified legacy roles: owner and manager
    owner_member = BrandMember(brand_id=brand.id, user_id=owner_user.id, role="owner")
    manager_member = BrandMember(brand_id=brand.id, user_id=manager_user.id, role="manager")
    db_session.add_all([owner_member, manager_member])
    db_session.commit()

    owner_token = create_access_token(owner_user.id, owner_user.email, "brand")
    manager_token = create_access_token(manager_user.id, manager_user.email, "brand")
    foreign_token = create_access_token(foreign_user.id, foreign_user.email, "brand")
    personal_token = create_access_token(personal_user.id, personal_user.email, "personal")
    admin_token = create_access_token(admin_user.id, admin_user.email, "admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # A. Personal User checks (rejected everywhere)
        r = await client.get("/api/test-authz/admin-only", headers={"Authorization": f"Bearer {personal_token}"})
        assert r.status_code == 403

        r = await client.get(f"/api/test-authz/brand/{brand_id}/any", headers={"Authorization": f"Bearer {personal_token}"})
        assert r.status_code == 403

        r = await client.get(f"/api/test-authz/brand/{brand_id}/owner", headers={"Authorization": f"Bearer {personal_token}"})
        assert r.status_code == 403

        # B. Foreign User checks (rejected from this brand studio)
        r = await client.get(f"/api/test-authz/brand/{brand_id}/any", headers={"Authorization": f"Bearer {foreign_token}"})
        assert r.status_code == 403

        r = await client.get(f"/api/test-authz/brand/{brand_id}/owner", headers={"Authorization": f"Bearer {foreign_token}"})
        assert r.status_code == 403

        # C. Manager User checks (can access 'any', but rejected on owner endpoints)
        r = await client.get(f"/api/test-authz/brand/{brand_id}/any", headers={"Authorization": f"Bearer {manager_token}"})
        assert r.status_code == 200

        r = await client.get(f"/api/test-authz/brand/{brand_id}/owner", headers={"Authorization": f"Bearer {manager_token}"})
        assert r.status_code == 403

        # D. Owner User checks (can access 'any' and 'owner')
        r = await client.get(f"/api/test-authz/brand/{brand_id}/any", headers={"Authorization": f"Bearer {owner_token}"})
        assert r.status_code == 200

        r = await client.get(f"/api/test-authz/brand/{brand_id}/owner", headers={"Authorization": f"Bearer {owner_token}"})
        assert r.status_code == 200

        # E. Platform Admin checks (can access admin and brand owner endpoints)
        r = await client.get("/api/test-authz/admin-only", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200

        r = await client.get(f"/api/test-authz/brand/{brand_id}/owner", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200

def test_database_constraint_rejects_unsupported_brand_member_role(db_session: Session):
    """
    Verify PostgreSQL database check constraint ck_brand_members_role rejects
    any role other than 'owner' and 'manager' (e.g. invented 'member' role).
    """
    from sqlalchemy.exc import IntegrityError

    user = User(email="test_role_constraint@example.com", password_hash=hash_password("Pass123!"), role="brand")
    db_session.add(user)
    db_session.flush()

    brand = Brand(
        owner_id=user.id,
        name="Role Constraint Brand",
        slug=f"role-constraint-brand-{uuid.uuid4().hex[:6]}",
        contact_email=user.email,
    )
    db_session.add(brand)
    db_session.flush()

    # Attempting to assign unverified/invented role 'member' -> must fail
    invalid_member = BrandMember(brand_id=brand.id, user_id=user.id, role="member")
    db_session.add(invalid_member)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()
