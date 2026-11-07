import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class UserRegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (at least 8 characters)")
    full_name: Optional[str] = Field(None, max_length=255, description="Full name")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Invalid email format.")
        return clean

class UserPublicProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    email_verified: bool
    brand_id: Optional[str] = None
    brand_name: Optional[str] = None
    brand_role: Optional[str] = None

class UserRegisterResponse(BaseModel):
    user: UserPublicProfile
    verification_required: bool
    message: str
    dev_verification_token: Optional[str] = None

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublicProfile

class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublicProfile

class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1)

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

class AuthMessageResponse(BaseModel):
    success: bool
    message: str
    dev_reset_token: Optional[str] = None
