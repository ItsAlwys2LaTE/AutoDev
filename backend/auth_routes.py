import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from database import get_users_collection, get_sessions_collection, get_projects_collection
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    user_doc_to_profile,
    get_current_user,
)
from auth_models import (
    SignupRequest,
    LoginRequest,
    GoogleAuthRequest,
    SendOtpRequest,
    VerifyOtpRequest,
    UpdateProfileRequest,
    ChangePasswordRequest,
    AuthResponse,
    UserProfile,
)
from email_service import generate_otp, store_otp, verify_otp, send_otp_email

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


@auth_router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(req: SignupRequest):
    """
    Registers a new user account with email, username, and password.
    Dispatches an email OTP for verification and returns a Bearer access token.
    """
    coll = get_users_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    clean_email = req.email.strip().lower()
    clean_username = req.username.strip()

    # 1. Check if email already registered
    existing_email = await coll.find_one({"email": clean_email})
    if existing_email:
        if existing_email.get("email_verified", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address is already registered. Please sign in instead.",
            )
        else:
            # Check username uniqueness if changing username on unverified account
            existing_user = await coll.find_one({"username": clean_username})
            if existing_user and str(existing_user["_id"]) != str(existing_email["_id"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username is already taken",
                )

            # User began sign-up but was unverified. Update credentials and reissue OTP
            now = datetime.now(timezone.utc)
            updated_fields = {
                "password_hash": hash_password(req.password),
                "username": clean_username,
                "display_name": (req.display_name or clean_username).strip(),
                "updated_at": now,
            }
            await coll.update_one({"_id": existing_email["_id"]}, {"$set": updated_fields})
            existing_email.update(updated_fields)

            otp = generate_otp()
            await store_otp(clean_email, otp, purpose="signup")
            await send_otp_email(clean_email, otp, purpose="signup")

            token = create_access_token({"sub": str(existing_email["_id"]), "email": clean_email})
            profile = user_doc_to_profile(existing_email)
            return AuthResponse(access_token=token, token_type="bearer", user=profile)

    # 2. Check username uniqueness for new accounts
    existing_username = await coll.find_one({"username": clean_username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken",
        )

    # 2. Hash password & assemble user document
    now = datetime.now(timezone.utc)
    user_doc = {
        "email": clean_email,
        "username": clean_username,
        "display_name": (req.display_name or clean_username).strip(),
        "password_hash": hash_password(req.password),
        "avatar_color": "#6366f1",
        "role_title": None,
        "email_verified": False,
        "auth_provider": "email",
        "google_sub": None,
        "ai_config": {
            "use_custom_key": False,
            "custom_api_key_hash": None,
            "primary_model": "gemini-3.5-flash-lite",
            "fallback_model": "gemini-3.1-flash-lite",
        },
        "dev_preferences": {
            "default_framework": "auto",
            "personalized_prompt": "",
            "auto_export": False,
        },
        "github_config": {
            "username": "",
            "default_repo": "",
            "default_commit_message": "AutoDev: Initial codebase delivery",
            "auto_create_repo": False,
            "remember_token": False,
        },
        "created_at": now,
        "updated_at": now,
    }

    result = await coll.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    # 3. Dispatch initial verification OTP in the background
    otp = generate_otp()
    await store_otp(clean_email, otp, purpose="signup")
    await send_otp_email(clean_email, otp, purpose="signup")

    # 4. Generate token and return profile
    token = create_access_token({"sub": str(result.inserted_id), "email": clean_email})
    profile = user_doc_to_profile(user_doc)

    return AuthResponse(access_token=token, token_type="bearer", user=profile)


@auth_router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """
    Authenticates a user using email and password.
    Returns a Bearer token with 24-hour expiry (or 30-day if remember_me is True).
    """
    coll = get_users_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    clean_email = req.email.strip().lower()
    user = await coll.find_one({"email": clean_email})

    if not user or not user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    expires_delta = timedelta(days=30) if req.remember_me else timedelta(hours=24)
    token = create_access_token(
        {"sub": str(user["_id"]), "email": clean_email},
        expires_delta=expires_delta,
    )
    profile = user_doc_to_profile(user)

    return AuthResponse(access_token=token, token_type="bearer", user=profile)


@auth_router.get("/me", response_model=UserProfile)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns the authenticated user's profile information.
    Requires a valid JWT Bearer token.
    """
    return user_doc_to_profile(current_user)


@auth_router.get("/config")
async def get_auth_config():
    """
    Returns public authentication configuration flags for frontend initialization.
    """
    from email_service import get_brevo_config
    api_key, _, _ = get_brevo_config()
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip() or GOOGLE_CLIENT_ID
    return {
        "google_client_id": client_id,
        "has_brevo": bool(api_key),
    }


@auth_router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest):
    """
    Authenticates or signs up a user via Google OAuth ID token or OAuth2 access token.
    Verifies token validity against Google certificates or userinfo endpoint.
    """
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    import httpx

    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip() or GOOGLE_CLIENT_ID
    id_info = None

    # Strategy 1: Verify as OIDC ID token (JWT format)
    try:
        id_info = id_token.verify_oauth2_token(
            req.id_token,
            google_requests.Request(),
            audience=client_id if client_id else None,
        )
    except Exception as verify_err:
        logger.info("OIDC ID token verification note: %s. Trying userinfo fallback...", verify_err)

    # Strategy 2: Verify via Google userinfo endpoint (OAuth2 access token ya29...)
    if not id_info:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {req.id_token}"},
                )
                if resp.status_code == 200:
                    id_info = resp.json()
                else:
                    # Strategy 3: Try tokeninfo endpoint
                    resp_ti = await client.get(
                        f"https://oauth2.googleapis.com/tokeninfo?id_token={req.id_token}"
                    )
                    if resp_ti.status_code == 200:
                        id_info = resp_ti.json()
        except Exception as fallback_err:
            logger.warning("Google userinfo fallback failed: %s", fallback_err)

    if not id_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed: Invalid or expired token",
        )

    google_email = (id_info.get("email") or "").strip().lower()
    google_name = id_info.get("name") or "User"
    google_sub = id_info.get("sub")

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token did not contain a valid email address",
        )

    coll = get_users_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    now = datetime.now(timezone.utc)
    user = await coll.find_one({"$or": [{"email": google_email}, {"google_sub": google_sub}]})

    if user is None:
        # Generate base username from email handle
        base_username = google_email.split("@")[0].replace(".", "_")
        existing_username = await coll.find_one({"username": base_username})
        username = f"{base_username}_{secrets.randbelow(1000)}" if existing_username else base_username

        user_doc = {
            "email": google_email,
            "username": username,
            "display_name": google_name,
            "password_hash": None,
            "avatar_color": "#6366f1",
            "role_title": None,
            "email_verified": True,
            "auth_provider": "google",
            "google_sub": google_sub,
            "ai_config": {
                "use_custom_key": False,
                "custom_api_key_hash": None,
                "primary_model": "gemini-3.5-flash-lite",
                "fallback_model": "gemini-3.1-flash-lite",
            },
            "dev_preferences": {
                "default_framework": "auto",
                "personalized_prompt": "",
                "auto_export": False,
            },
            "github_config": {
                "username": "",
                "default_repo": "",
                "default_commit_message": "AutoDev: Initial codebase delivery",
                "auto_create_repo": False,
                "remember_token": False,
            },
            "created_at": now,
            "updated_at": now,
        }
        res = await coll.insert_one(user_doc)
        user_doc["_id"] = res.inserted_id
        user = user_doc
    else:
        # Link Google account if not already linked
        if not user.get("google_sub"):
            await coll.update_one(
                {"_id": user["_id"]},
                {"$set": {"google_sub": google_sub, "email_verified": True, "updated_at": now}},
            )
            user["google_sub"] = google_sub
            user["email_verified"] = True

    expires_delta = timedelta(days=30) if req.remember_me else timedelta(hours=24)
    token = create_access_token(
        {"sub": str(user["_id"]), "email": google_email},
        expires_delta=expires_delta,
    )
    profile = user_doc_to_profile(user)

    return AuthResponse(access_token=token, token_type="bearer", user=profile)


@auth_router.post("/send-otp")
async def send_otp_endpoint(req: SendOtpRequest):
    """
    Generates and dispatches a 6-digit OTP code to the requested email.
    """
    clean_email = req.email.strip().lower()
    otp = generate_otp()
    stored = await store_otp(clean_email, otp, purpose=req.purpose)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store verification code",
        )

    sent = await send_otp_email(clean_email, otp, purpose=req.purpose)
    return {
        "success": sent,
        "message": "Verification code dispatched successfully",
    }


@auth_router.post("/verify-otp")
async def verify_otp_endpoint(req: VerifyOtpRequest):
    """
    Validates a 6-digit OTP code against stored records.
    Consumes the code on success. If purpose is 'signup', marks email as verified.
    """
    clean_email = req.email.strip().lower()
    is_valid = await verify_otp(clean_email, req.otp_code, purpose=req.purpose)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )

    # Mark user as email verified if purpose is signup or email_change
    if req.purpose in ("signup", "email_change"):
        coll = get_users_collection()
        if coll is not None:
            await coll.update_one(
                {"email": clean_email},
                {"$set": {"email_verified": True, "updated_at": datetime.now(timezone.utc)}},
            )

    return {
        "verified": True,
        "message": "Verification code verified successfully",
    }


@auth_router.post("/refresh", response_model=AuthResponse)
async def refresh_token(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Refreshes an active JWT access token for continuous sessions.
    """
    token = create_access_token({
        "sub": str(current_user["_id"]),
        "email": current_user["email"],
    })
    profile = user_doc_to_profile(current_user)
    return AuthResponse(access_token=token, token_type="bearer", user=profile)


@auth_router.put("/profile", response_model=UserProfile)
async def update_profile(
    req: UpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Updates the authenticated user's profile fields and settings.
    Checks username and email uniqueness if they are being updated.
    """
    coll = get_users_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}

    # Display name
    if req.display_name is not None:
        updates["display_name"] = req.display_name.strip()

    # Username change
    if req.username is not None:
        clean_user = req.username.strip()
        if clean_user != current_user.get("username"):
            existing = await coll.find_one({"username": clean_user})
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username is already taken",
                )
            updates["username"] = clean_user

    # Email change (requires verification)
    if req.email is not None:
        clean_email = req.email.strip().lower()
        if clean_email != current_user.get("email"):
            existing = await coll.find_one({"email": clean_email})
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email address is already in use by another account",
                )
            updates["email"] = clean_email
            updates["email_verified"] = False

    # Role / Title
    if req.role_title is not None:
        updates["role_title"] = req.role_title.strip()

    # Avatar color
    if req.avatar_color is not None:
        updates["avatar_color"] = req.avatar_color.strip()

    # Subdocuments: AI Config
    if req.ai_config is not None:
        updates["ai_config"] = req.ai_config.model_dump()

    # Subdocuments: Dev Preferences
    if req.dev_preferences is not None:
        updates["dev_preferences"] = req.dev_preferences.model_dump()

    # Subdocuments: GitHub Config
    if req.github_config is not None:
        updates["github_config"] = req.github_config.model_dump()

    await coll.update_one({"_id": current_user["_id"]}, {"$set": updates})
    updated_user = await coll.find_one({"_id": current_user["_id"]})
    return user_doc_to_profile(updated_user)


@auth_router.put("/password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Changes the authenticated user's password.
    Requires verification of the existing password.
    """
    coll = get_users_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    stored_hash = current_user.get("password_hash")
    if not stored_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account authenticated via Google and does not have a local password set",
        )

    if not verify_password(req.current_password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed",
        )

    new_hash = hash_password(req.new_password)
    await coll.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc)}},
    )

    return {"success": True, "message": "Password updated successfully"}


@auth_router.delete("/account")
async def delete_account(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Deletes the authenticated user account and all associated sessions and projects.
    """
    coll = get_users_collection()
    sess_coll = get_sessions_collection()
    proj_coll = get_projects_collection()

    user_id = current_user["_id"]

    if coll is not None:
        await coll.delete_one({"_id": user_id})

    if sess_coll is not None:
        await sess_coll.delete_many({"user_id": user_id})

    if proj_coll is not None:
        await proj_coll.delete_many({"user_id": user_id})

    return {"deleted": True, "message": "User account and all associated data deleted successfully"}
