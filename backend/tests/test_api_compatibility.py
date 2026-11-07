import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_health_check_endpoint():
    """Verify health check endpoint preserves contract and never exposes DB credentials."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "presson-fit-brand-api"
        assert "supabase_url" in data
        assert "database_configured" in data

        # Crucial security check: Ensure no DB password or connection string is exposed
        raw_text = response.text
        assert "password" not in raw_text.lower()
        assert "postgresql://" not in raw_text
        assert "postgres://" not in raw_text

@pytest.mark.anyio
async def test_openapi_json_available():
    """Verify OpenAPI documentation endpoint remains accessible."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "paths" in data
        assert "/api/health" in data["paths"]
        assert "/api/auth/register" in data["paths"]
        assert "/api/auth/login" in data["paths"]
        assert "/api/brands/apply" in data["paths"]
        assert "/api/brands/by-id/{brand_id}" in data["paths"]
        assert "/api/brands/{brand_id}/charts" in data["paths"]
        assert "/api/brands/{brand_id}/charts/validate" in data["paths"]
        assert "/api/brands/{brand_id}/charts/{chart_id}" in data["paths"]
        assert "/api/measurements/profiles" in data["paths"]
        assert "/api/measurements/profiles/{profile_id}" in data["paths"]
        assert "/api/public/brands" in data["paths"]
        assert "/api/public/brands/{slug_or_id}" in data["paths"]
        assert "/api/public/brands/{brand_id}/chart" in data["paths"]
        assert "/api/admin/accounts" in data["paths"]
        assert "/api/admin/accounts/{user_id}/status-or-role" in data["paths"]
        assert "/api/admin/brands" in data["paths"]
        assert "/api/admin/brands/{brand_id}/approve" in data["paths"]
        assert "/api/admin/brands/{brand_id}/reject" in data["paths"]
        assert "/api/admin/brands/{brand_id}/suspend" in data["paths"]
        assert "/api/admin/brands/{brand_id}/reactivate" in data["paths"]
        assert "/api/admin/charts/review" in data["paths"]
        assert "/api/admin/trials/{brand_id}" in data["paths"]
        assert "/api/admin/audit-events" in data["paths"]
