import os
import logging
from typing import Optional
from dotenv import load_dotenv
import pymongo
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase,
    AsyncIOMotorCollection,
)

load_dotenv()

logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "autodev")

_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


def get_client() -> Optional[AsyncIOMotorClient]:
    """Returns the singleton AsyncIOMotorClient instance."""
    return _client


def get_database() -> Optional[AsyncIOMotorDatabase]:
    """Returns the connected AsyncIOMotorDatabase instance or None if disconnected."""
    global _client, _database
    if _database is not None:
        return _database
    if _client is not None:
        _database = _client[MONGODB_DB_NAME]
        return _database
    return None


def get_users_collection() -> Optional[AsyncIOMotorCollection]:
    """Accessor for the users collection."""
    db = get_database()
    return db["users"] if db is not None else None


def get_sessions_collection() -> Optional[AsyncIOMotorCollection]:
    """Accessor for the sessions collection."""
    db = get_database()
    return db["sessions"] if db is not None else None


def get_projects_collection() -> Optional[AsyncIOMotorCollection]:
    """Accessor for the projects collection."""
    db = get_database()
    return db["projects"] if db is not None else None


def get_otp_collection() -> Optional[AsyncIOMotorCollection]:
    """Accessor for the otp_codes collection."""
    db = get_database()
    return db["otp_codes"] if db is not None else None


import re


def _mask_uri(uri: str) -> str:
    """Masks username:password in MongoDB connection URIs to prevent credential leakage in logs."""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", uri)


async def connect_db(uri: Optional[str] = None, db_name: Optional[str] = None) -> AsyncIOMotorDatabase:
    """
    Initializes the MongoDB client singleton using motor async driver.
    Supports local MongoDB and MongoDB Atlas (mongodb+srv://).
    Uses a 5000ms server selection timeout for cloud Atlas network resilience.
    """
    global _client, _database
    connection_uri = uri or MONGODB_URI
    target_db_name = db_name or MONGODB_DB_NAME

    if _client is None:
        _client = AsyncIOMotorClient(
            connection_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
    _database = _client[target_db_name]
    # Verify connectivity via ping
    await _client.admin.command("ping")
    logger.info("Connected to MongoDB at %s (database: %s)", _mask_uri(connection_uri), target_db_name)
    return _database


async def close_db() -> None:
    """Closes the MongoDB client connection cleanly."""
    global _client, _database
    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed.")


async def health_check() -> bool:
    """
    Checks if MongoDB server is reachable.
    Returns True if ping command succeeds, False otherwise.
    """
    try:
        if _client is None:
            return False
        await _client.admin.command("ping")
        return True
    except Exception as e:
        logger.debug("MongoDB health check ping failed: %s", e)
        return False


async def ensure_indexes() -> None:
    """
    Creates necessary indexes for users, sessions, projects, and otp_codes.
    Safe to call multiple times on application startup.
    """
    db = get_database()
    if db is None:
        logger.warning("Cannot ensure indexes: database connection is not initialized.")
        return

    try:
        # Users indexes
        users = db["users"]
        await users.create_index("email", unique=True)
        await users.create_index("username", unique=True, sparse=True)

        # Sessions indexes (compound user_id + created_at descending)
        sessions = db["sessions"]
        await sessions.create_index(
            [("user_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)]
        )

        # Projects indexes
        projects = db["projects"]
        await projects.create_index("session_id", unique=True)
        await projects.create_index("user_id")

        # OTP codes indexes (TTL on expires_at)
        otp_codes = db["otp_codes"]
        await otp_codes.create_index("email")
        await otp_codes.create_index("expires_at", expireAfterSeconds=0)

        logger.info("MongoDB indexes verified successfully.")
    except Exception as e:
        logger.error("Failed ensuring MongoDB indexes: %s", e)
        raise
