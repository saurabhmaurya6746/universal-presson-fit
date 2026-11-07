from typing import Dict, Optional
from ..config import settings

class EmailService:
    """
    Email notification service for verification and password reset tokens.

    PRODUCTION BLOCKER:
    In production (ENVIRONMENT='production'), real email delivery requires an approved
    and configured email provider (e.g. SendGrid, AWS SES, Resend). If none is configured,
    email sending fails safely and reports an unconfigured provider blocker.

    In non-production (development / test), tokens are captured in an in-memory test store
    for automated test verification and local developer workflows. Secrets are NEVER logged.
    """

    def __init__(self):
        # Development token capture store: email -> latest token
        self._dev_capture: Dict[str, Dict[str, str]] = {}

    @property
    def is_production_provider_configured(self) -> bool:
        # Currently no third-party email provider is approved or integrated
        return False

    def send_verification_email(self, email: str, raw_token: str) -> Optional[str]:
        if settings.is_production:
            if not self.is_production_provider_configured:
                raise RuntimeError(
                    "Production email delivery provider is not configured. Email verification blocked."
                )
            # Future Phase: Call approved production provider API
            return None

        # Non-production capture for automated tests and local setup
        self._dev_capture[email.lower()] = {
            "purpose": "email_verification",
            "token": raw_token,
        }
        return raw_token

    def send_password_reset_email(self, email: str, raw_token: str) -> Optional[str]:
        if settings.is_production:
            if not self.is_production_provider_configured:
                raise RuntimeError(
                    "Production email delivery provider is not configured. Password reset delivery blocked."
                )
            # Future Phase: Call approved production provider API
            return None

        # Non-production capture for automated tests and local setup
        self._dev_capture[email.lower()] = {
            "purpose": "password_reset",
            "token": raw_token,
        }
        return raw_token

    def get_latest_dev_token(self, email: str, purpose: str) -> Optional[str]:
        """Test helper to retrieve captured token in non-production environments."""
        if settings.is_production:
            return None
        record = self._dev_capture.get(email.lower())
        if record and record.get("purpose") == purpose:
            return record.get("token")
        return None

    def clear_dev_tokens(self) -> None:
        """Clear captured tokens in test runner."""
        self._dev_capture.clear()

email_service = EmailService()
