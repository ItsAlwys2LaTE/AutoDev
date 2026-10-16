import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx
from dotenv import load_dotenv
from database import get_otp_collection

load_dotenv()

logger = logging.getLogger(__name__)

def get_brevo_config() -> tuple[str, str, str]:
    """Dynamically resolves Brevo configuration from environment variables."""
    load_dotenv(override=False)
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    sender_email = os.getenv("BREVO_SENDER_EMAIL", "anupamsharma12102004@gmail.com").strip()
    sender_name = os.getenv("BREVO_SENDER_NAME", "AutoDev").strip()
    return api_key, sender_email, sender_name


BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email"


def generate_otp() -> str:
    """Generates a cryptographically secure 6-digit numeric OTP code."""
    return f"{secrets.randbelow(900000) + 100000}"


async def store_otp(
    email: str,
    code: str,
    purpose: str = "signup",
    ttl_minutes: int = 10,
) -> bool:
    """
    Stores an OTP code in the MongoDB otp_codes collection.
    Automatically expires via MongoDB TTL index on expires_at.
    """
    coll = get_otp_collection()
    if coll is None:
        logger.warning("MongoDB not connected. Cannot persist OTP to database.")
        return False

    clean_email = email.strip().lower()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=ttl_minutes)

    try:
        await coll.update_one(
            {"email": clean_email, "purpose": purpose},
            {
                "$set": {
                    "email": clean_email,
                    "code": code,
                    "purpose": purpose,
                    "created_at": now,
                    "expires_at": expires_at,
                }
            },
            upsert=True,
        )
        logger.info("Stored %s OTP for %s (expires in %d minutes)", purpose, clean_email, ttl_minutes)
        return True
    except Exception as e:
        logger.error("Failed to store OTP for %s: %s", clean_email, e)
        return False


async def verify_otp(
    email: str,
    code: str,
    purpose: str = "signup",
) -> bool:
    """
    Verifies an OTP code for an email and purpose.
    Deletes the OTP record upon successful verification to prevent reuse.
    """
    coll = get_otp_collection()
    if coll is None:
        logger.warning("MongoDB not connected. Cannot verify OTP against database.")
        return False

    clean_email = email.strip().lower()
    clean_code = code.strip()
    now = datetime.now(timezone.utc)

    try:
        record = await coll.find_one({
            "email": clean_email,
            "code": clean_code,
            "purpose": purpose,
            "expires_at": {"$gt": now},
        })

        if record is not None:
            # Delete after single successful use
            await coll.delete_one({"_id": record["_id"]})
            logger.info("OTP verified and consumed for %s (%s)", clean_email, purpose)
            return True

        logger.warning("OTP verification failed for %s (%s)", clean_email, purpose)
        return False
    except Exception as e:
        logger.error("Error during OTP verification for %s: %s", clean_email, e)
        return False


def _build_otp_html(code: str, purpose: str) -> str:
    """Builds clean, professional HTML email content for the OTP verification."""
    purpose_title = {
        "signup": "Verify Your AutoDev Account",
        "password_reset": "Reset Your AutoDev Password",
        "email_change": "Confirm Your New Email Address",
    }.get(purpose, "Your AutoDev Verification Code")

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{purpose_title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; color: #f1f5f9; padding: 40px 20px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="font-family: Georgia, serif; font-style: italic; color: #ffffff; font-size: 28px; margin: 0;">AutoDev</h1>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Autonomous Software Engineering</p>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">{purpose_title}</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5;">Please use the one-time verification code below to complete your request. This code will expire in 10 minutes.</p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; padding: 14px 28px; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #38bdf8;">
        {code}
      </div>
    </div>
    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.4;">
      If you did not request this verification code, please ignore this email or contact support.
    </p>
  </div>
</body>
</html>"""


async def send_otp_email(
    email: str,
    code: str,
    purpose: str = "signup",
) -> bool:
    """
    Sends a 6-digit OTP email using Brevo (Sendinblue) transactional email API.
    Always logs code to console for local testing and developer visibility.
    """
    clean_email = email.strip().lower()
    api_key, sender_email, sender_name = get_brevo_config()

    # Always log to server terminal for instant developer visibility
    print(f"[AutoDev OTP] Verification code for {clean_email} ({purpose}): {code}")

    if not api_key:
        logger.warning(
            "BREVO_API_KEY is not configured in environment. [DEV MODE] OTP for %s (%s): %s",
            clean_email,
            purpose,
            code,
        )
        return True

    purpose_subject = {
        "signup": "Your AutoDev Verification Code",
        "password_reset": "AutoDev Password Reset Code",
        "email_change": "AutoDev Email Verification Code",
    }.get(purpose, "Your AutoDev Verification Code")

    payload = {
        "sender": {
            "name": sender_name,
            "email": sender_email,
        },
        "to": [
            {"email": clean_email}
        ],
        "subject": purpose_subject,
        "htmlContent": _build_otp_html(code, purpose),
    }

    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(BREVO_SMTP_URL, json=payload, headers=headers)
            if response.status_code in (200, 201, 202):
                msg_id = response.json().get("messageId", "ok") if response.headers.get("content-type", "").startswith("application/json") else "ok"
                logger.info("Successfully sent OTP email to %s via Brevo (messageId: %s)", clean_email, msg_id)
                print(f"[Brevo Email] Verification code successfully dispatched to {clean_email} via Brevo (ID: {msg_id})")
                return True
            else:
                logger.error(
                    "Brevo API error (%d): %s",
                    response.status_code,
                    response.text,
                )
                print(f"[Brevo Email Error] HTTP {response.status_code}: {response.text}")
                return False
    except Exception as e:
        logger.error("Failed to dispatch OTP email to %s via Brevo: %s", clean_email, e)
        print(f"[Brevo Email Exception] {e}")
        return False
