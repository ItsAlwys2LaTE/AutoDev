import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class AIConfig(BaseModel):
    use_custom_key: bool = False
    custom_api_key_hash: Optional[str] = None
    primary_model: str = "gemini-3.5-flash-lite"
    fallback_model: str = "gemini-3.1-flash-lite"


class DevPreferences(BaseModel):
    default_framework: str = "auto"
    personalized_prompt: str = ""
    auto_export: bool = False


class GitHubConfig(BaseModel):
    username: str = ""
    default_repo: str = ""
    default_commit_message: str = "AutoDev: Initial codebase delivery"
    auto_create_repo: bool = False
    remember_token: bool = False


class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    display_name: Optional[str] = None

    @field_validator("email")
    def validate_email_format(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Invalid email format")
        return clean

    @field_validator("username")
    def validate_username(cls, v: str) -> str:
        clean = (v or "").strip()
        if len(clean) < 3 or len(clean) > 30:
            raise ValueError("Username must be between 3 and 30 characters")
        if not re.match(r"^[a-zA-Z0-9_-]+$", clean):
            raise ValueError("Username may only contain letters, numbers, underscores, and hyphens")
        return clean

    @field_validator("password")
    def validate_password_length(cls, v: str) -> str:
        if len(v or "") < 6:
            raise ValueError("Password must be at least 6 characters long")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False

    @field_validator("email")
    def normalize_email(cls, v: str) -> str:
        return (v or "").strip().lower()


class GoogleAuthRequest(BaseModel):
    id_token: str
    remember_me: bool = False


class SendOtpRequest(BaseModel):
    email: str
    purpose: str = "signup"

    @field_validator("email")
    def normalize_email(cls, v: str) -> str:
        return (v or "").strip().lower()


class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: str
    purpose: str = "signup"

    @field_validator("email")
    def normalize_email(cls, v: str) -> str:
        return (v or "").strip().lower()

    @field_validator("otp_code")
    def normalize_otp(cls, v: str) -> str:
        clean = re.sub(r"\D", "", v or "")
        if len(clean) != 6:
            raise ValueError("OTP code must be exactly 6 digits")
        return clean


class UserProfile(BaseModel):
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_color: str = "#6366f1"
    role_title: Optional[str] = None
    email_verified: bool = False
    auth_provider: str = "email"
    created_at: str = ""
    ai_config: AIConfig = Field(default_factory=AIConfig)
    dev_preferences: DevPreferences = Field(default_factory=DevPreferences)
    github_config: GitHubConfig = Field(default_factory=GitHubConfig)


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    role_title: Optional[str] = None
    avatar_color: Optional[str] = None
    ai_config: Optional[AIConfig] = None
    dev_preferences: Optional[DevPreferences] = None
    github_config: Optional[GitHubConfig] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    def validate_new_password(cls, v: str) -> str:
        if len(v or "") < 6:
            raise ValueError("New password must be at least 6 characters long")
        return v


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
