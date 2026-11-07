import sys
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User
from app.models.measurement import MeasurementProfile
from app.core.security import hash_password, create_access_token


@pytest.fixture
def anyio_backend():
    return "asyncio"


def create_test_personal_users(db: Session):
    u1 = User(
        email=f"personal1_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role="personal",
        is_active=True,
    )
    u2 = User(
        email=f"personal2_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role="personal",
        is_active=True,
    )
    db.add_all([u1, u2])
    db.flush()

    token1 = create_access_token(u1.id, u1.email, "personal")
    token2 = create_access_token(u2.id, u2.email, "personal")
    return u1, token1, u2, token2


def create_users_with_different_roles(db: Session):
    personal = User(
        email=f"personal_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role="personal",
        is_active=True,
    )
    brand = User(
        email=f"brand_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role="brand",
        is_active=True,
    )
    admin = User(
        email=f"admin_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("Pass123!"),
        role="admin",
        is_active=True,
    )
    db.add_all([personal, brand, admin])
    db.flush()

    t_personal = create_access_token(personal.id, personal.email, "personal")
    t_brand = create_access_token(brand.id, brand.email, "brand")
    t_admin = create_access_token(admin.id, admin.email, "admin")
    return (personal, t_personal), (brand, t_brand), (admin, t_admin)


@pytest.mark.anyio
async def test_personal_user_creates_and_reads_structured_profile(db_session: Session):
    """
    Test Case 1:
    A personal authenticated user can create and read their own structured measurement profile.
    Saves extracted millimeter values without photos or image URLs.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)

    payload = {
        "profile_name": "Summer Fit",
        "hand_side": "both",
        "measurements": {
            "thumb": 14.5,
            "index": 11.2,
            "middle": 12.0,
            "ring": 11.0,
            "pinky": 8.8,
        },
        "calibration_data": {
            "pixels_per_mm": 12.4,
            "coin_detected": True,
        },
        "coin_verified": True,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create
        create_resp = await client.post(
            "/api/measurements/profiles",
            json=payload,
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert create_resp.status_code == 201, create_resp.text
        data = create_resp.json()
        assert data["profile_name"] == "Summer Fit"
        assert data["nickname"] == "Summer Fit"
        assert data["hand_side"] == "both"
        assert data["user_id"] == str(u1.id)
        assert data["coin_verified"] is True
        assert data["measurements"]["thumb"] == 14.5
        profile_id = data["id"]

        # Read detail
        read_resp = await client.get(
            f"/api/measurements/profiles/{profile_id}",
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert read_resp.status_code == 200
        detail = read_resp.json()
        assert detail["id"] == profile_id
        assert detail["profile_name"] == "Summer Fit"
        assert detail["measurements"]["thumb"] == 14.5

        # List
        list_resp = await client.get(
            "/api/measurements/profiles",
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert list_resp.status_code == 200
        profiles = list_resp.json()
        assert len(profiles) >= 1
        assert any(p["id"] == profile_id for p in profiles)


@pytest.mark.anyio
async def test_owner_isolation_and_foreign_user_rejection(db_session: Session):
    """
    Test Case 2:
    Another user cannot list, read, update, or delete another user's profile.
    Listing completely excludes foreign records; direct access returns 403 Forbidden.
    """
    u1, token1, u2, token2 = create_test_personal_users(db_session)

    payload = {
        "nickname": "User 1 Secret Nails",
        "hand_side": "left",
        "measurements": {
            "thumb": 15.0,
            "index": 12.0,
            "middle": 13.0,
            "ring": 12.0,
            "pinky": 9.0,
        },
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # User 1 creates profile
        res = await client.post(
            "/api/measurements/profiles",
            json=payload,
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert res.status_code == 201
        profile_id = res.json()["id"]

        # User 2 lists profiles: User 1's profile is NOT present
        list_resp = await client.get(
            "/api/measurements/profiles",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert list_resp.status_code == 200
        user2_profiles = list_resp.json()
        assert not any(p["id"] == profile_id for p in user2_profiles)

        # User 2 attempts to read User 1's profile: 403 Forbidden
        read_resp = await client.get(
            f"/api/measurements/profiles/{profile_id}",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert read_resp.status_code == 403
        assert "Access denied" in read_resp.text

        # User 2 attempts to update User 1's profile: 403 Forbidden
        update_resp = await client.patch(
            f"/api/measurements/profiles/{profile_id}",
            json={"nickname": "User 1 Updated Name"},
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert update_resp.status_code == 403

        # User 2 attempts to delete User 1's profile: 403 Forbidden
        delete_resp = await client.delete(
            f"/api/measurements/profiles/{profile_id}",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert delete_resp.status_code == 403

        # User 1 CAN update their profile
        u1_update = await client.patch(
            f"/api/measurements/profiles/{profile_id}",
            json={"nickname": "User 1 Updated"},
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert u1_update.status_code == 200
        assert u1_update.json()["nickname"] == "User 1 Updated"

        # User 1 CAN delete their profile
        u1_delete = await client.delete(
            f"/api/measurements/profiles/{profile_id}",
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert u1_delete.status_code == 200
        assert u1_delete.json()["success"] is True

        # Now reading deleted profile returns 404
        read_after_delete = await client.get(
            f"/api/measurements/profiles/{profile_id}",
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert read_after_delete.status_code == 404


@pytest.mark.anyio
async def test_no_unauthenticated_access_and_no_arbitrary_ownership_assignment(db_session: Session):
    """
    Test Case 3:
    - Unauthenticated requests are rejected.
    - Passing a spoofed user_id / owner_id in the payload NEVER assigns ownership to that ID.
      The profile is authoritatively assigned to the authenticated user.
    """
    u1, token1, u2, _ = create_test_personal_users(db_session)
    victim_user_id = str(u2.id)

    payload = {
        "profile_name": "Spoofed Ownership Test",
        "hand_side": "both",
        "measurements": {"thumb": 14.0, "index": 11.0, "middle": 12.0, "ring": 11.0, "pinky": 9.0},
        "user_id": victim_user_id,
        "owner_id": victim_user_id,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Unauthenticated create fails
        unauth_create = await client.post("/api/measurements/profiles", json=payload)
        assert unauth_create.status_code in (401, 403)

        # Unauthenticated list fails
        unauth_list = await client.get("/api/measurements/profiles")
        assert unauth_list.status_code in (401, 403)

        # Authenticated create with spoofed user_id
        auth_create = await client.post(
            "/api/measurements/profiles",
            json=payload,
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert auth_create.status_code == 201
        created_data = auth_create.json()

        # Crucial security assertion: Owner MUST be u1, NEVER the victim u2
        assert created_data["user_id"] == str(u1.id)
        assert created_data["user_id"] != victim_user_id


@pytest.mark.anyio
async def test_photo_bytes_data_urls_image_urls_and_file_fields_rejected(db_session: Session):
    """
    Test Case 4:
    Zero biometric photo or image storage.
    Strictly rejects photo bytes, data URLs, image URLs, and original chart upload fields.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)

    valid_measurements = {"thumb": 14.0, "index": 11.0, "middle": 12.0, "ring": 11.0, "pinky": 9.0}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Top-level forbidden photo field
        r1 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Test", "measurements": valid_measurements, "photo": "fake_photo_bytes"},
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert r1.status_code == 422

        # 2. Top-level image field
        r2 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Test", "measurements": valid_measurements, "image": "some_image"},
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert r2.status_code == 422

        # 3. Top-level chart_file field
        r3 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Test", "measurements": valid_measurements, "chart_file": "chart.csv"},
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert r3.status_code == 422

        # 4. Embedded data URL in measurements
        r4 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test",
                "measurements": {"thumb": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA"},
            },
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert r4.status_code == 422

        # 5. Non-positive millimeter width
        r6 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test",
                "measurements": {"thumb": -2.5, "index": 11.0},
            },
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert r6.status_code == 422

        # 6. Zero millimeter width
        r7 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test",
                "measurements": {"thumb": 0.0, "index": 11.0},
            },
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert r7.status_code == 422


@pytest.mark.anyio
async def test_brand_and_admin_accounts_cannot_use_personal_profile_routes(db_session: Session):
    """
    Requirement 1:
    Enforce the personal account role on every measurement profile endpoint
    (list, create, read, update, delete) using the backend role authorization dependency.
    Brand and admin accounts MUST receive HTTP 403 Forbidden on all personal profile routes.
    """
    (personal, t_personal), (brand, t_brand), (admin, t_admin) = create_users_with_different_roles(db_session)

    # 1. Personal user creates a profile
    valid_payload = {
        "profile_name": "Personal Nails",
        "hand_side": "both",
        "measurements": {"thumb": 14.0, "index": 11.0, "middle": 12.0, "ring": 11.0, "pinky": 9.0},
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_res = await client.post(
            "/api/measurements/profiles",
            json=valid_payload,
            headers={"Authorization": f"Bearer {t_personal}"},
        )
        assert create_res.status_code == 201
        profile_id = create_res.json()["id"]

        # 2. Test Brand user is denied across all 5 endpoints
        # List
        r_b_list = await client.get("/api/measurements/profiles", headers={"Authorization": f"Bearer {t_brand}"})
        assert r_b_list.status_code == 403
        assert "requires role in ('personal',)" in r_b_list.text

        # Create
        r_b_create = await client.post("/api/measurements/profiles", json=valid_payload, headers={"Authorization": f"Bearer {t_brand}"})
        assert r_b_create.status_code == 403

        # Read
        r_b_read = await client.get(f"/api/measurements/profiles/{profile_id}", headers={"Authorization": f"Bearer {t_brand}"})
        assert r_b_read.status_code == 403

        # Update
        r_b_patch = await client.patch(f"/api/measurements/profiles/{profile_id}", json={"nickname": "B"}, headers={"Authorization": f"Bearer {t_brand}"})
        assert r_b_patch.status_code == 403

        # Delete
        r_b_del = await client.delete(f"/api/measurements/profiles/{profile_id}", headers={"Authorization": f"Bearer {t_brand}"})
        assert r_b_del.status_code == 403

        # 3. Test Admin user is denied across all 5 endpoints
        # List
        r_a_list = await client.get("/api/measurements/profiles", headers={"Authorization": f"Bearer {t_admin}"})
        assert r_a_list.status_code == 403
        assert "requires role in ('personal',)" in r_a_list.text

        # Create
        r_a_create = await client.post("/api/measurements/profiles", json=valid_payload, headers={"Authorization": f"Bearer {t_admin}"})
        assert r_a_create.status_code == 403

        # Read
        r_a_read = await client.get(f"/api/measurements/profiles/{profile_id}", headers={"Authorization": f"Bearer {t_admin}"})
        assert r_a_read.status_code == 403

        # Update
        r_a_patch = await client.patch(f"/api/measurements/profiles/{profile_id}", json={"nickname": "A"}, headers={"Authorization": f"Bearer {t_admin}"})
        assert r_a_patch.status_code == 403

        # Delete
        r_a_del = await client.delete(f"/api/measurements/profiles/{profile_id}", headers={"Authorization": f"Bearer {t_admin}"})
        assert r_a_del.status_code == 403


@pytest.mark.anyio
async def test_strict_schemas_reject_innocuous_keys_numeric_pixel_arrays_and_unsupported_objects(db_session: Session):
    """
    Requirements 2 & 3:
    - Replace arbitrary nested Dict/List with strict schemas and explicit allowlists.
    - Attempting to submit image data under innocuous nested keys, numeric pixel arrays,
      and unsupported nested objects MUST be rejected with HTTP 422.
    - Confirms that NO profile row is stored in the database.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        initial_count = db_session.query(MeasurementProfile).count()

        # Case A: Innocuous nested key in measurements
        payload_a = {
            "profile_name": "Sneaky Preview Test",
            "measurements": {
                "thumb": 14.5,
                "index": 12.0,
                "middle": 13.0,
                "ring": 11.5,
                "pinky": 9.5,
                "preview_pixels": "innocuous_encoded_binary_string",
            },
        }
        res_a = await client.post("/api/measurements/profiles", json=payload_a, headers=headers)
        assert res_a.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case B: Innocuous nested key in calibration_data
        payload_b = {
            "profile_name": "Sneaky Calibration Test",
            "measurements": {"thumb": 14.5, "index": 12.0, "middle": 13.0, "ring": 11.5, "pinky": 9.5},
            "calibration_data": {
                "pixels_per_mm": 12.0,
                "raw_sample_data": "sample_binary_payload",
            },
        }
        res_b = await client.post("/api/measurements/profiles", json=payload_b, headers=headers)
        assert res_b.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case C: 1D Numeric pixel array in measurements
        payload_c = {
            "profile_name": "Pixel Array 1D Test",
            "measurements": [128, 255, 64, 32, 16, 0, 48, 96],
        }
        res_c = await client.post("/api/measurements/profiles", json=payload_c, headers=headers)
        assert res_c.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case D: 2D Numeric pixel array in measurements
        payload_d = {
            "profile_name": "Pixel Array 2D Test",
            "measurements": [[255, 255, 255], [128, 128, 128], [0, 0, 0]],
        }
        res_d = await client.post("/api/measurements/profiles", json=payload_d, headers=headers)
        assert res_d.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case E: Unsupported nested object in measurements list
        payload_e = {
            "profile_name": "Nested Deep Object Test",
            "measurements": [
                {
                    "finger": "thumb",
                    "width_mm": 14.5,
                    "deep_nested": {"sub_pixels": [1, 2, 3]},
                }
            ],
        }
        res_e = await client.post("/api/measurements/profiles", json=payload_e, headers=headers)
        assert res_e.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case F: Arbitrary dictionary structure under measurements
        payload_f = {
            "profile_name": "Arbitrary Dict Test",
            "measurements": {"random_nested_struct": {"inner": 123}},
        }
        res_f = await client.post("/api/measurements/profiles", json=payload_f, headers=headers)
        assert res_f.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case G: Innocuous nested object in validation_metadata
        payload_g = {
            "profile_name": "Validation Leak Test",
            "measurements": {"thumb": 14.5, "index": 12.0, "middle": 13.0, "ring": 11.5, "pinky": 9.5},
            "validation_metadata": {
                "passed": True,
                "thumbnail_binary_stream": "fake_stream_of_data",
            },
        }
        res_g = await client.post("/api/measurements/profiles", json=payload_g, headers=headers)
        assert res_g.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count


@pytest.mark.anyio
async def test_oversized_and_base64_strings_in_metadata_fields_are_rejected(db_session: Session):
    """
    Test that oversized or base64 strings in any metadata field
    (profile_name, summary_profile, reasons, error, recommended_size) are strictly rejected
    and no profile row is stored.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    base_measurements = {"thumb": 14.5, "index": 12.0, "middle": 13.0, "ring": 11.5, "pinky": 9.5}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        initial_count = db_session.query(MeasurementProfile).count()

        # 1. Base64 / data URL in profile_name
        r1 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "data:image/png;base64,iVBORw0KGgoAAA==", "measurements": base_measurements},
            headers=headers,
        )
        assert r1.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 2. Oversized profile_name (> 100 chars)
        r2 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "N" * 125, "measurements": base_measurements},
            headers=headers,
        )
        assert r2.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 3. Base64 in summary_profile
        r3 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Fit",
                "measurements": base_measurements,
                "summary_profile": "aGVsbG8gd29ybGQgYmFzZTY0IGRhdGEgdG8gdGVzdCBwcmV2aWV3PT0=",
            },
            headers=headers,
        )
        assert r3.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 4. Oversized summary_profile (> 120 chars)
        r4 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Fit",
                "measurements": base_measurements,
                "summary_profile": "Thumb: 15mm, Index: 12mm, Middle: 13mm, Ring: 12mm, Pinky: 9mm, Extra Padding Text That Goes Beyond One Hundred And Twenty Characters Length Limit",
            },
            headers=headers,
        )
        assert r4.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 5. Base64 in validation reasons
        r5 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Fit",
                "measurements": base_measurements,
                "validation_metadata": {"reasons": ["aGVsbG8gd29ybGQgYmFzZTY0PT0="]},
            },
            headers=headers,
        )
        assert r5.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 6. Oversized reason (> 64 chars)
        r6 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Fit",
                "measurements": base_measurements,
                "validation_metadata": {"reasons": ["R" * 80]},
            },
            headers=headers,
        )
        assert r6.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 7. Base64 / non-code in validation error
        r7 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Fit",
                "measurements": base_measurements,
                "validation_metadata": {"error": "aGVsbG8gd29ybGQgYmFzZTY0PT0="},
            },
            headers=headers,
        )
        assert r7.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 8. Oversized error code (> 64 chars)
        r8 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Fit",
                "measurements": base_measurements,
                "validation_metadata": {"error": "COIN_MISSING_ERROR_" * 10},
            },
            headers=headers,
        )
        assert r8.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 9. Base64 in recommended_size
        r9 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Fit",
                "measurements": [
                    {"finger": "thumb", "width_mm": 14.5, "recommended_size": "base64/data=="}
                ],
            },
            headers=headers,
        )
        assert r9.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count


@pytest.mark.anyio
async def test_measurement_list_bounds_exceeding_ten_items_rejected(db_session: Session):
    """
    Test that submitting more than 10 measurement items is rejected with HTTP 422
    and creates no profile row in the database.
    (Maximum supported measured nails for two hands is 10).
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    # 11 distinct items (exceeding 10-nail limit)
    eleven_items = [
        {"finger": "left_thumb", "width_mm": 14.5},
        {"finger": "left_index", "width_mm": 12.0},
        {"finger": "left_middle", "width_mm": 13.0},
        {"finger": "left_ring", "width_mm": 11.5},
        {"finger": "left_pinky", "width_mm": 9.5},
        {"finger": "right_thumb", "width_mm": 14.2},
        {"finger": "right_index", "width_mm": 11.8},
        {"finger": "right_middle", "width_mm": 12.8},
        {"finger": "right_ring", "width_mm": 11.3},
        {"finger": "right_pinky", "width_mm": 9.3},
        {"finger": "thumb", "hand": "left", "width_mm": 14.0},  # 11th item
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Over 10 Nails", "measurements": eleven_items},
            headers=headers,
        )
        assert res.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count


@pytest.mark.anyio
async def test_duplicate_and_aliased_finger_items_rejected(db_session: Session):
    """
    Test that duplicate and aliased finger items are rejected with HTTP 422,
    including case and 'Nail 1' vs 'thumb' aliases when referring to the same position,
    duplicate positions on the same hand are rejected, the same position on opposite hands
    is allowed, and rejected requests create no profile row in the database.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    duplicate_test_cases = [
        # 1. Exact duplicate finger
        [{"finger": "thumb", "width_mm": 14.5}, {"finger": "thumb", "width_mm": 14.2}],
        # 2. Case variation: "Index" vs "index"
        [{"finger": "Index", "width_mm": 12.0}, {"finger": "index", "width_mm": 12.0}],
        # 3. Alias: "thumb" vs "Nail 1"
        [{"finger": "thumb", "width_mm": 14.5}, {"finger": "Nail 1", "width_mm": 14.5}],
        # 4. Alias: "index" vs "nail 2"
        [{"finger": "index", "width_mm": 12.0}, {"finger": "nail 2", "width_mm": 12.0}],
        # 5. Synonym & Alias: "pointer" vs "Index"
        [{"finger": "pointer", "width_mm": 12.0}, {"finger": "Index", "width_mm": 12.0}],
        # 6. Alias: "middle" vs "Nail 3"
        [{"finger": "middle", "width_mm": 13.0}, {"finger": "Nail 3", "width_mm": 13.0}],
        # 7. Synonym: "mid" vs "middle"
        [{"finger": "mid", "width_mm": 13.0}, {"finger": "middle", "width_mm": 13.0}],
        # 8. Alias: "ring" vs "Nail 4"
        [{"finger": "ring", "width_mm": 11.5}, {"finger": "Nail 4", "width_mm": 11.5}],
        # 9. Alias: "pinky" vs "Nail 5"
        [{"finger": "pinky", "width_mm": 9.5}, {"finger": "Nail 5", "width_mm": 9.5}],
        # 10. Synonym: "little" vs "pinky"
        [{"finger": "little", "width_mm": 9.5}, {"finger": "pinky", "width_mm": 9.5}],
        # 11. Hand-prefixed duplicate on same hand: "left_thumb" vs "left Nail 1"
        [{"finger": "left_thumb", "width_mm": 14.5}, {"finger": "left Nail 1", "width_mm": 14.5}],
        # 12. Hand attribute duplicate on same hand: finger="thumb", hand="left" vs finger="Nail 1", hand="left"
        [{"finger": "thumb", "hand": "left", "width_mm": 14.5}, {"finger": "Nail 1", "hand": "left", "width_mm": 14.5}],
        # 13. Hand-prefixed vs hand-attribute duplicate on same hand:
        [{"finger": "right_index", "width_mm": 12.0}, {"finger": "index", "hand": "right", "width_mm": 12.0}],
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for idx, items in enumerate(duplicate_test_cases):
            res = await client.post(
                "/api/measurements/profiles",
                json={"profile_name": f"Duplicate Case {idx}", "measurements": items},
                headers=headers,
            )
            assert res.status_code == 422, f"Expected 422 for duplicate case {idx}, got {res.status_code}: {res.text}"
            assert db_session.query(MeasurementProfile).count() == initial_count

        # Test: Same finger position on opposite hands IS allowed
        res_opposite = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Opposite Hands Thumb Profile",
                "hand_side": "both",
                "measurements": [
                    {"finger": "left_thumb", "width_mm": 14.5},
                    {"finger": "right_thumb", "width_mm": 14.2},
                ],
            },
            headers=headers,
        )
        assert res_opposite.status_code == 201
        assert db_session.query(MeasurementProfile).count() == initial_count + 1


@pytest.mark.anyio
async def test_valid_single_hand_profile_with_nail_1_through_5_accepted(db_session: Session):
    """
    Test that a valid measurement profile containing Nail 1 through Nail 5 for one hand
    saves successfully (HTTP 201), creates 1 profile row, and is retrievable via GET.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    five_nails = [
        {"finger": "Nail 1", "width_mm": 14.5, "recommended_size": "Size 1"},
        {"finger": "Nail 2", "width_mm": 12.0, "recommended_size": "Size 2"},
        {"finger": "Nail 3", "width_mm": 13.0, "recommended_size": "Size 3"},
        {"finger": "Nail 4", "width_mm": 11.5, "recommended_size": "Size 4"},
        {"finger": "Nail 5", "width_mm": 9.5, "recommended_size": "Size 5"},
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Right Hand 5 Nails", "hand_side": "right", "measurements": five_nails},
            headers=headers,
        )
        assert res.status_code == 201
        created = res.json()
        assert created["profile_name"] == "Right Hand 5 Nails"
        assert len(created["measurements"]) == 5
        assert db_session.query(MeasurementProfile).count() == initial_count + 1

        profile_id = created["id"]
        # Verify retrievable via GET
        get_res = await client.get(f"/api/measurements/profiles/{profile_id}", headers=headers)
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert len(get_data["measurements"]) == 5
        assert get_data["measurements"][0]["finger"] == "Nail 1"
        assert get_data["measurements"][4]["finger"] == "Nail 5"


@pytest.mark.anyio
async def test_extra_ai_detections_nail_6_7_8_rejected_with_422(db_session: Session):
    """
    Business rule: One hand has five actual fingernails.
    'Nail 6', 'Nail 7', and 'Nail 8' are extra AI detections, not real finger positions.
    Never save them as nails or map them to another finger.
    Submitting Nail 6, 7, or 8 causes HTTP 422 and stores no profile.
    Extra detections are not silently removed.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    extra_detection_cases = [
        # 1. Standalone Nail 6
        [{"finger": "Nail 6", "width_mm": 10.0}],
        # 2. Standalone Nail 7
        [{"finger": "nail 7", "width_mm": 9.5}],
        # 3. Standalone Nail 8
        [{"finger": "Nail 8", "width_mm": 9.0}],
        # 4. Hand-prefixed extra detection
        [{"finger": "left Nail 6", "width_mm": 10.0}],
        # 5. Hand attribute extra detection
        [{"finger": "Nail 7", "hand": "right", "width_mm": 9.5}],
        # 6. Full hand (Nail 1-5) PLUS extra detection Nail 6
        [
            {"finger": "Nail 1", "width_mm": 14.5},
            {"finger": "Nail 2", "width_mm": 12.0},
            {"finger": "Nail 3", "width_mm": 13.0},
            {"finger": "Nail 4", "width_mm": 11.5},
            {"finger": "Nail 5", "width_mm": 9.5},
            {"finger": "Nail 6", "width_mm": 10.0},
        ],
        # 7. Full hand PLUS extra detection Nail 7
        [
            {"finger": "Nail 1", "width_mm": 14.5},
            {"finger": "Nail 2", "width_mm": 12.0},
            {"finger": "Nail 3", "width_mm": 13.0},
            {"finger": "Nail 4", "width_mm": 11.5},
            {"finger": "Nail 5", "width_mm": 9.5},
            {"finger": "Nail 7", "width_mm": 9.5},
        ],
        # 8. Full hand PLUS extra detection Nail 8
        [
            {"finger": "Nail 1", "width_mm": 14.5},
            {"finger": "Nail 2", "width_mm": 12.0},
            {"finger": "Nail 3", "width_mm": 13.0},
            {"finger": "Nail 4", "width_mm": 11.5},
            {"finger": "Nail 5", "width_mm": 9.5},
            {"finger": "Nail 8", "width_mm": 9.0},
        ],
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for idx, items in enumerate(extra_detection_cases):
            res = await client.post(
                "/api/measurements/profiles",
                json={"profile_name": f"Extra Detection Case {idx}", "measurements": items},
                headers=headers,
            )
            assert res.status_code == 422, f"Expected 422 for case {idx}, got {res.status_code}: {res.text}"
            assert "extra AI detection" in res.text
            assert db_session.query(MeasurementProfile).count() == initial_count


@pytest.mark.anyio
async def test_more_than_five_nails_assigned_to_one_hand_rejected(db_session: Session):
    """
    Test that assigning more than 5 fingernails to one hand is rejected with HTTP 422
    and stores no profile:
    - Single-hand profile with > 5 nails is rejected.
    - Two-hand profile where either hand has > 5 nails is rejected.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Case A: Single-hand profile with 6 nails (even without Nail 6 label)
        six_nails_single_hand = [
            {"finger": "thumb", "width_mm": 14.5},
            {"finger": "index", "width_mm": 12.0},
            {"finger": "middle", "width_mm": 13.0},
            {"finger": "ring", "width_mm": 11.5},
            {"finger": "pinky", "width_mm": 9.5},
            {"finger": "pointer", "width_mm": 11.8},  # 6th item on same single hand
        ]
        res_a = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Single Hand Over 5", "hand_side": "right", "measurements": six_nails_single_hand},
            headers=headers,
        )
        assert res_a.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case B: Two-hand profile where left hand has 6 nails
        six_left_nails = [
            {"finger": "left_thumb", "width_mm": 14.5},
            {"finger": "left_index", "width_mm": 12.0},
            {"finger": "left_middle", "width_mm": 13.0},
            {"finger": "left_ring", "width_mm": 11.5},
            {"finger": "left_pinky", "width_mm": 9.5},
            {"finger": "left_pointer", "width_mm": 12.0},
            {"finger": "right_thumb", "width_mm": 14.2},
        ]
        res_b = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Left Hand Over 5", "hand_side": "both", "measurements": six_left_nails},
            headers=headers,
        )
        assert res_b.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # Case C: Two-hand profile where right hand has 6 nails
        six_right_nails = [
            {"finger": "left_thumb", "width_mm": 14.5},
            {"finger": "right_thumb", "width_mm": 14.2},
            {"finger": "right_index", "width_mm": 11.8},
            {"finger": "right_middle", "width_mm": 12.8},
            {"finger": "right_ring", "width_mm": 11.3},
            {"finger": "right_pinky", "width_mm": 9.3},
            {"finger": "right_pointer", "width_mm": 11.8},
        ]
        res_c = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Right Hand Over 5", "hand_side": "both", "measurements": six_right_nails},
            headers=headers,
        )
        assert res_c.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count


@pytest.mark.anyio
async def test_two_explicit_hands_with_up_to_five_nails_each_accepted(db_session: Session):
    """
    Test that two explicit hands (hand_side='both') with up to 5 nails each (up to 10 total)
    are accepted and saved, requiring each item to identify its hand.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    # Valid 10 nails (5 left + 5 right)
    ten_nails = [
        {"finger": "left_thumb", "width_mm": 14.5},
        {"finger": "left_index", "width_mm": 12.0},
        {"finger": "left_middle", "width_mm": 13.0},
        {"finger": "left_ring", "width_mm": 11.5},
        {"finger": "left_pinky", "width_mm": 9.5},
        {"finger": "right_thumb", "width_mm": 14.2},
        {"finger": "right_index", "width_mm": 11.8},
        {"finger": "right_middle", "width_mm": 12.8},
        {"finger": "right_ring", "width_mm": 11.3},
        {"finger": "right_pinky", "width_mm": 9.3},
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Both Hands 10 Nails", "hand_side": "both", "measurements": ten_nails},
            headers=headers,
        )
        assert res.status_code == 201
        created = res.json()
        assert created["profile_name"] == "Both Hands 10 Nails"
        assert len(created["measurements"]) == 10
        assert db_session.query(MeasurementProfile).count() == initial_count + 1

        # Check retrieval
        profile_id = created["id"]
        get_res = await client.get(f"/api/measurements/profiles/{profile_id}", headers=headers)
        assert get_res.status_code == 200
        assert len(get_res.json()["measurements"]) == 10

        # Also verify that a two-hand request where an item does NOT identify its hand is rejected with 422
        missing_hand_items = [
            {"finger": "left_thumb", "width_mm": 14.5},
            {"finger": "thumb", "width_mm": 14.2},  # Ambiguous: no hand specified
        ]
        res_fail = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Missing Hand Indication", "hand_side": "both", "measurements": missing_hand_items},
            headers=headers,
        )
        assert res_fail.status_code == 422
        assert "must identify its hand" in res_fail.text
        assert db_session.query(MeasurementProfile).count() == initial_count + 1


@pytest.mark.anyio
async def test_conflicting_hand_prefix_and_hand_field_rejected(db_session: Session):
    """
    Test that when a measurement item provides both a hand field and a hand prefix in finger,
    they are strictly required to agree.
    Reject conflicting combinations (e.g., finger='left_thumb' with hand='right') with HTTP 422,
    without silently preferring either value.
    Verifies rejection across both two-hand ('both') and single-hand ('left', 'right') profiles,
    confirms no profile row is stored, and verifies consistent combinations still succeed.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    conflicting_cases = [
        # Two-hand profile conflicts
        ("both", [{"finger": "left_thumb", "hand": "right", "width_mm": 14.5}]),
        ("both", [{"finger": "right_thumb", "hand": "left", "width_mm": 14.2}]),
        ("both", [{"finger": "left Nail 1", "hand": "right", "width_mm": 14.5}]),
        ("both", [{"finger": "right Nail 5", "hand": "left", "width_mm": 9.5}]),
        ("both", [{"finger": "left-index", "hand": "right", "width_mm": 12.0}]),
        ("both", [
            {"finger": "left_thumb", "hand": "left", "width_mm": 14.5},  # Valid
            {"finger": "right_pinky", "hand": "left", "width_mm": 9.5},   # Conflicting prefix vs hand
        ]),
        # Single-hand 'left' profile conflicts
        ("left", [{"finger": "left_thumb", "hand": "right", "width_mm": 14.5}]),
        ("left", [{"finger": "right_thumb", "hand": "left", "width_mm": 14.5}]),
        ("left", [{"finger": "left Nail 2", "hand": "right", "width_mm": 12.0}]),
        # Single-hand 'right' profile conflicts
        ("right", [{"finger": "right_thumb", "hand": "left", "width_mm": 14.5}]),
        ("right", [{"finger": "left_thumb", "hand": "right", "width_mm": 14.5}]),
        ("right", [{"finger": "right Nail 3", "hand": "left", "width_mm": 13.0}]),
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for idx, (hand_side, items) in enumerate(conflicting_cases):
            res = await client.post(
                "/api/measurements/profiles",
                json={"profile_name": f"Conflict Case {idx}", "hand_side": hand_side, "measurements": items},
                headers=headers,
            )
            assert res.status_code == 422, f"Expected 422 for conflict case {idx}, got {res.status_code}: {res.text}"
            assert "Conflicting hand information" in res.text or "must agree" in res.text
            assert db_session.query(MeasurementProfile).count() == initial_count, f"Row stored for conflict case {idx}!"

        # Confirm consistent hand prefix and hand field succeed in dual-hand profile
        consistent_dual = [
            {"finger": "left_thumb", "hand": "left", "width_mm": 14.5},
            {"finger": "right_thumb", "hand": "right", "width_mm": 14.2},
        ]
        res_dual = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Consistent Dual Hand", "hand_side": "both", "measurements": consistent_dual},
            headers=headers,
        )
        assert res_dual.status_code == 201
        assert db_session.query(MeasurementProfile).count() == initial_count + 1

        # Confirm consistent hand prefix and hand field succeed in single-hand left profile
        consistent_left = [
            {"finger": "left_thumb", "hand": "left", "width_mm": 14.5},
            {"finger": "left_index", "hand": "left", "width_mm": 12.0},
        ]
        res_left = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Consistent Left Hand", "hand_side": "left", "measurements": consistent_left},
            headers=headers,
        )
        assert res_left.status_code == 201
        assert db_session.query(MeasurementProfile).count() == initial_count + 2

        # Confirm consistent hand prefix and hand field succeed in single-hand right profile
        consistent_right = [
            {"finger": "right_thumb", "hand": "right", "width_mm": 14.5},
            {"finger": "right Nail 2", "hand": "right", "width_mm": 12.0},
        ]
        res_right = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Consistent Right Hand", "hand_side": "right", "measurements": consistent_right},
            headers=headers,
        )
        assert res_right.status_code == 201
        assert db_session.query(MeasurementProfile).count() == initial_count + 3

        # Confirm PATCH also rejects conflicting hand information
        profile_id = res_right.json()["id"]
        res_patch = await client.patch(
            f"/api/measurements/profiles/{profile_id}",
            json={"measurements": [{"finger": "left_pinky", "hand": "right", "width_mm": 9.5}]},
            headers=headers,
        )
        assert res_patch.status_code == 422
        assert "Conflicting hand information" in res_patch.text or "must agree" in res_patch.text


@pytest.mark.anyio
async def test_unsupported_nail_labels_beyond_five_and_invalid_identifiers_rejected(db_session: Session):
    """
    Test that unsupported nail labels (Nail 6 through 10, Nail 0, invalid anatomical names)
    are rejected with HTTP 422 and create no profile row in the database.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    invalid_finger_cases = [
        # 1. Nail 6
        [{"finger": "Nail 6", "width_mm": 11.0}],
        # 2. Nail 7
        [{"finger": "Nail 7", "width_mm": 11.0}],
        # 3. Nail 8
        [{"finger": "Nail 8", "width_mm": 11.0}],
        # 4. Nail 9
        [{"finger": "Nail 9", "width_mm": 11.0}],
        # 5. Nail 10
        [{"finger": "Nail 10", "width_mm": 11.0}],
        # 6. Nail 0
        [{"finger": "Nail 0", "width_mm": 11.0}],
        # 7. Non-finger anatomical string
        [{"finger": "toe", "width_mm": 11.0}],
        # 8. Arbitrary label
        [{"finger": "unknown_nail", "width_mm": 11.0}],
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for idx, items in enumerate(invalid_finger_cases):
            res = await client.post(
                "/api/measurements/profiles",
                json={"profile_name": f"Invalid Label Case {idx}", "measurements": items},
                headers=headers,
            )
            assert res.status_code == 422, f"Expected 422 for invalid case {idx}, got {res.status_code}"
            assert db_session.query(MeasurementProfile).count() == initial_count


@pytest.mark.anyio
async def test_existing_single_hand_and_two_hand_profile_shapes_work(db_session: Session):
    """
    Test that existing single-hand (Format A width map), dual-hand width maps,
    and two-hand measurement lists continue to work seamlessly.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Shape 1: Format A single-hand width map
        res1 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Shape 1 Single Hand Map",
                "hand_side": "right",
                "measurements": {"thumb": 14.5, "index": 12.0, "middle": 13.0, "ring": 11.5, "pinky": 9.5},
            },
            headers=headers,
        )
        assert res1.status_code == 201
        assert res1.json()["measurements"]["thumb"] == 14.5

        # Shape 2: Format A two-hand width map
        res2 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Shape 2 Two Hand Map",
                "hand_side": "both",
                "measurements": {
                    "left": {"thumb": 14.5, "index": 12.0, "middle": 13.0, "ring": 11.5, "pinky": 9.5},
                    "right": {"thumb": 14.2, "index": 11.8, "middle": 12.8, "ring": 11.2, "pinky": 9.2},
                },
            },
            headers=headers,
        )
        assert res2.status_code == 201
        assert res2.json()["measurements"]["left"]["thumb"] == 14.5
        assert res2.json()["measurements"]["right"]["thumb"] == 14.2

        # Shape 3: Explicit two-hand measurement list (up to 5 nails each hand, 10 total)
        ten_nails = (
            [{"finger": f"left Nail {i}", "width_mm": 10.0 + i} for i in range(1, 6)]
            + [{"finger": f"right Nail {i}", "width_mm": 10.0 + i} for i in range(1, 6)]
        )
        res3 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": "Shape 3 Ten Nails Both Hands", "hand_side": "both", "measurements": ten_nails},
            headers=headers,
        )
        assert res3.status_code == 201
        assert len(res3.json()["measurements"]) == 10

        assert db_session.query(MeasurementProfile).count() == initial_count + 3


@pytest.mark.anyio
async def test_unpadded_base64_strings_rejected_in_all_user_supplied_fields(db_session: Session):
    """
    Test that unpadded base64 strings containing only otherwise-allowed characters
    are rejected wherever user-supplied strings are accepted, and create no profile row.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    base_measurements = {"thumb": 14.5, "index": 12.0, "middle": 13.0, "ring": 11.5, "pinky": 9.5}

    # Unpadded base64 strings containing only alphanumeric characters [A-Za-z0-9]
    unpadded_b64_1 = "aGVsbG8gd29ybGQgYmFzZTY0IGRhdGE"
    unpadded_b64_2 = "dGVzdGluZ3VucGFkZGVkYmFzZTY0ZGF0YQ"
    unpadded_b64_img = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Unpadded base64 in profile_name
        r1 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": unpadded_b64_1, "measurements": base_measurements},
            headers=headers,
        )
        assert r1.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 2. Unpadded base64 image chunk in profile_name
        r2 = await client.post(
            "/api/measurements/profiles",
            json={"profile_name": unpadded_b64_img, "measurements": base_measurements},
            headers=headers,
        )
        assert r2.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 3. Unpadded base64 in nickname
        r3 = await client.post(
            "/api/measurements/profiles",
            json={"nickname": unpadded_b64_2, "measurements": base_measurements},
            headers=headers,
        )
        assert r3.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 4. Unpadded base64 in summary_profile
        r4 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Profile",
                "measurements": base_measurements,
                "summary_profile": unpadded_b64_1,
            },
            headers=headers,
        )
        assert r4.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 5. Unpadded base64 in calibration_data.summary_profile
        r5 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Profile",
                "measurements": base_measurements,
                "calibration_data": {"summary_profile": unpadded_b64_2},
            },
            headers=headers,
        )
        assert r5.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 6. Unpadded base64 in recommended_size
        r6 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Profile",
                "measurements": [
                    {"finger": "thumb", "width_mm": 14.5, "recommended_size": "dGVzdGluZ3VucGFkZGVk"}
                ],
            },
            headers=headers,
        )
        assert r6.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 7. Unpadded base64 in size field
        r7 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Profile",
                "measurements": [
                    {"finger": "thumb", "width_mm": 14.5, "size": "aGVsbG8gd29ybGQ"}
                ],
            },
            headers=headers,
        )
        assert r7.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 8. Unpadded base64 / non-finite code in validation reasons
        r8 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Profile",
                "measurements": base_measurements,
                "validation_metadata": {"reasons": ["aGVsbG8gd29ybGQgYmFzZTY0"]},
            },
            headers=headers,
        )
        assert r8.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count

        # 9. Unpadded base64 / non-finite code in validation error
        r9 = await client.post(
            "/api/measurements/profiles",
            json={
                "profile_name": "Test Profile",
                "measurements": base_measurements,
                "validation_metadata": {"error": "dGVzdGluZ3VucGFkZGVk"},
            },
            headers=headers,
        )
        assert r9.status_code == 422
        assert db_session.query(MeasurementProfile).count() == initial_count


@pytest.mark.anyio
async def test_oversized_payload_exceeding_size_limit_rejected(db_session: Session):
    """
    Test that request payloads exceeding the 16 KB size limit are rejected
    with HTTP 413 Payload Too Large and no profile row is stored.
    """
    u1, token1, _, _ = create_test_personal_users(db_session)
    headers = {"Authorization": f"Bearer {token1}"}
    initial_count = db_session.query(MeasurementProfile).count()

    # Construct an oversized payload (> 16 KB) with valid finger structures
    many_fingers = [{"finger": "thumb", "width_mm": 14.5} for _ in range(500)]
    oversized_payload = {
        "profile_name": "Oversized Test",
        "measurements": many_fingers,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/measurements/profiles", json=oversized_payload, headers=headers)
        assert res.status_code == 413
        assert "exceeds size limit" in res.text
        assert db_session.query(MeasurementProfile).count() == initial_count


def test_api_import_and_runtime_has_no_ai_or_image_inference_dependencies():
    """
    Test Case 9:
    API import and runtime must have no dependency on AI inference or image upload packages.
    Verifies that onnxruntime, cv2, torch, etc. are NOT imported.
    """
    forbidden_modules = ["onnxruntime", "cv2", "torch", "torchvision", "mediapipe"]
    for mod in forbidden_modules:
        assert mod not in sys.modules, f"Forbidden AI inference module '{mod}' is loaded in backend runtime."
