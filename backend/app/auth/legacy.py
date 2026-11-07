from typing import Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
from pydantic import BaseModel
from ..config import settings

security = HTTPBearer()

class AuthenticatedUser(BaseModel):
    user_id: str
    email: str
    role: str
    token: str

async def get_legacy_supabase_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> AuthenticatedUser:
    token = credentials.credentials
    try:
        async with httpx.AsyncClient() as client:
            # 1. Validate token with Supabase GoTrue Auth service
            user_res = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                },
                timeout=5.0
            )
            if user_res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token."
                )
            user_data = user_res.json()
            user_id = user_data.get("id")
            email = user_data.get("email", "")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User ID not found in token."
                )

            # 2. Query user profile role from public.profiles using PostgREST passing caller JWT
            resp = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=id,full_name,role",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                },
                timeout=5.0
            )
            role = "personal"
            if resp.status_code == 200:
                profiles = resp.json()
                if profiles and len(profiles) > 0:
                    role = profiles[0].get("role", "personal")

        return AuthenticatedUser(
            user_id=user_id,
            email=email,
            role=role,
            token=token
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}"
        )

class BrandMembership(BaseModel):
    brand_id: str
    role: str

async def get_brand_membership(
    brand_id: str,
    user: AuthenticatedUser = Depends(get_legacy_supabase_user),
) -> BrandMembership:
    """Verify that the authenticated caller belongs to the brand in the URL (legacy Supabase helper)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/brand_members?profile_id=eq.{user.user_id}&brand_id=eq.{brand_id}&select=brand_id,role",
            headers={
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {user.token}",
            },
            timeout=5.0
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unable to verify membership in this brand studio."
            )
        memberships = resp.json()
        if not memberships:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not belong to this brand studio."
            )
        return BrandMembership(
            brand_id=memberships[0]["brand_id"],
            role=memberships[0]["role"]
        )
