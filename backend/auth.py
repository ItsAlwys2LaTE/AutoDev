import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "autodev-super-secret-jwt-key-change-in-production-32chars")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours


def hash_password(plain: str) -> str:
    """
    Hashes a plaintext password using bcrypt with standard salt.
    Truncates to 72 bytes as per bcrypt specification.
    """
    if not plain:
        raise ValueError("Password cannot be empty")
    pw_bytes = plain.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifies a plaintext password against a bcrypt hash.
    Returns True if valid, False otherwise.
    """
    if not plain or not hashed:
        return False
    try:
        pw_bytes = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except Exception as e:
        logger.debug("Password verification error: %s", e)
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Encodes a JWT access token with payload data and expiration claim.
    Defaults to 24 hours (or custom expires_delta, e.g. 30 days for remember_me).
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and validates a JWT access token.
    Returns payload dictionary if valid and unexpired, None otherwise.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.debug("JWT decode failed: %s", e)
        return None
    except Exception as e:
        logger.debug("Unexpected error during token decoding: %s", e)
        return None


def user_doc_to_profile(doc: Dict[str, Any]) -> Any:
    """
    Maps a MongoDB user document dictionary to a validated UserProfile model.
    """
    from auth_models import UserProfile, AIConfig, DevPreferences, GitHubConfig

    created = doc.get("created_at")
    if hasattr(created, "isoformat"):
        created_str = created.isoformat()
    elif created:
        created_str = str(created)
    else:
        created_str = ""

    return UserProfile(
        id=str(doc["_id"]),
        email=doc.get("email", ""),
        username=doc.get("username", ""),
        display_name=doc.get("display_name"),
        avatar_color=doc.get("avatar_color", "#6366f1"),
        role_title=doc.get("role_title"),
        email_verified=doc.get("email_verified", False),
        auth_provider=doc.get("auth_provider", "email"),
        created_at=created_str,
        ai_config=AIConfig(**(doc.get("ai_config") or {})),
        dev_preferences=DevPreferences(**(doc.get("dev_preferences") or {})),
        github_config=GitHubConfig(**(doc.get("github_config") or {})),
    )


from fastapi import Request, HTTPException, status
from bson import ObjectId
from database import get_users_collection


async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency: extracts and validates the JWT Bearer token from the
    Authorization header, fetches the authenticated user from MongoDB Atlas.
    Raises HTTPException(401) on missing, invalid, or expired tokens.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    coll = get_users_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    try:
        user = await coll.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token was not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_optional_user(request: Request) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency: extracts and validates JWT if present, but returns None
    instead of raising an exception if absent or invalid. For optional auth routes.
    """
    try:
        return await get_current_user(request)
    except Exception:
        return None
