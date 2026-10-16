import io
import re
import zipfile
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from bson import ObjectId
import pymongo

from database import get_sessions_collection, get_projects_collection
from auth import get_current_user
from session_models import (
    CreateSessionRequest,
    UpdateSessionRequest,
    SessionRecord,
    SessionListResponse,
    SessionStats,
    StoreProjectRequest,
)

logger = logging.getLogger(__name__)

session_router = APIRouter(prefix="/api/sessions", tags=["Session History"])


def _session_doc_to_record(doc: Dict[str, Any]) -> SessionRecord:
    """Helper to convert MongoDB session document to a validated SessionRecord."""
    created = doc.get("created_at")
    completed = doc.get("completed_at")

    created_str = created.isoformat() if hasattr(created, "isoformat") else str(created or "")
    completed_str = completed.isoformat() if hasattr(completed, "isoformat") else (str(completed) if completed else None)

    return SessionRecord(
        id=str(doc["_id"]),
        user_id=str(doc.get("user_id", "")),
        project_name=doc.get("project_name", "Untitled Project"),
        feature_request=doc.get("feature_request", ""),
        mode=doc.get("mode", "STANDARD"),
        status=doc.get("status", "running"),
        created_at=created_str,
        completed_at=completed_str,
        duration_ms=int(doc.get("duration_ms", 0)),
        total_prompt_tokens=int(doc.get("total_prompt_tokens", 0)),
        total_completion_tokens=int(doc.get("total_completion_tokens", 0)),
        total_cost_inr=float(doc.get("total_cost_inr", 0.0)),
        stages_completed=list(doc.get("stages_completed", [])),
        component_count=int(doc.get("component_count", 0)),
        has_project=bool(doc.get("has_project", False)),
    )


@session_router.post("", response_model=SessionRecord, status_code=status.HTTP_201_CREATED)
async def create_session(
    req: CreateSessionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Creates a new development session record associated with the authenticated user.
    Called when pipeline begins execution.
    """
    coll = get_sessions_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    now = datetime.now(timezone.utc)
    session_doc = {
        "user_id": current_user["_id"],
        "project_name": (req.project_name or "Untitled Project").strip(),
        "feature_request": req.feature_request or "",
        "mode": req.mode or "STANDARD",
        "status": "running",
        "created_at": now,
        "completed_at": None,
        "duration_ms": 0,
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
        "total_cost_inr": 0.0,
        "stages_completed": [],
        "component_count": 0,
        "has_project": False,
    }

    result = await coll.insert_one(session_doc)
    session_doc["_id"] = result.inserted_id
    logger.info("Created session %s for user %s (%s)", str(result.inserted_id), str(current_user["_id"]), session_doc["project_name"])
    return _session_doc_to_record(session_doc)


@session_router.put("/{session_id}", response_model=SessionRecord)
async def update_session(
    session_id: str,
    req: UpdateSessionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Updates a development session with final status, token usage, duration, and metrics.
    Called upon pipeline completion or abort.
    """
    coll = get_sessions_collection()
    if coll is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )

    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID format")

    session = await coll.find_one({"_id": oid, "user_id": current_user["_id"]})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session record not found")

    now = datetime.now(timezone.utc)
    updates = {
        "status": req.status,
        "duration_ms": req.duration_ms,
        "total_prompt_tokens": req.total_prompt_tokens,
        "total_completion_tokens": req.total_completion_tokens,
        "total_cost_inr": req.total_cost_inr,
        "stages_completed": req.stages_completed,
        "component_count": req.component_count,
        "completed_at": now if req.status in ("completed", "aborted") else session.get("completed_at"),
    }

    await coll.update_one({"_id": oid}, {"$set": updates})
    updated = await coll.find_one({"_id": oid})
    logger.info("Updated session %s status to '%s'", session_id, req.status)
    return _session_doc_to_record(updated)


@session_router.get("/stats", response_model=SessionStats)
async def get_session_stats(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Calculates aggregated statistics across all development sessions for the authenticated user:
    total sessions, total tokens consumed, and total cost in INR.
    """
    coll = get_sessions_collection()
    if coll is None:
        return SessionStats()

    pipeline = [
        {"$match": {"user_id": current_user["_id"]}},
        {
            "$group": {
                "_id": None,
                "total_sessions": {"$sum": 1},
                "total_prompt": {"$sum": "$total_prompt_tokens"},
                "total_completion": {"$sum": "$total_completion_tokens"},
                "total_cost": {"$sum": "$total_cost_inr"},
            }
        },
    ]

    cursor = coll.aggregate(pipeline)
    result_list = await cursor.to_list(length=1)

    if not result_list:
        return SessionStats(total_sessions=0, total_tokens_used=0, total_cost_inr=0.0)

    agg = result_list[0]
    total_tokens = int(agg.get("total_prompt", 0)) + int(agg.get("total_completion", 0))
    return SessionStats(
        total_sessions=int(agg.get("total_sessions", 0)),
        total_tokens_used=total_tokens,
        total_cost_inr=round(float(agg.get("total_cost", 0.0)), 4),
    )


@session_router.get("", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Returns a paginated list of chronological development sessions for the user.
    Sorted from newest to oldest.
    """
    coll = get_sessions_collection()
    if coll is None:
        return SessionListResponse(sessions=[], total=0, page=page, limit=limit)

    query = {"user_id": current_user["_id"]}
    total = await coll.count_documents(query)

    skip = (page - 1) * limit
    cursor = coll.find(query).sort("created_at", pymongo.DESCENDING).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    records = [_session_doc_to_record(d) for d in docs]
    return SessionListResponse(
        sessions=records,
        total=total,
        page=page,
        limit=limit,
    )


@session_router.get("/{session_id}", response_model=SessionRecord)
async def get_session_by_id(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieves a single session record by ID.
    """
    coll = get_sessions_collection()
    if coll is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID format")

    doc = await coll.find_one({"_id": oid, "user_id": current_user["_id"]})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session record not found")

    return _session_doc_to_record(doc)


@session_router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Deletes a session record and any associated project codebases stored in MongoDB.
    """
    coll = get_sessions_collection()
    proj_coll = get_projects_collection()

    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID format")

    if coll is not None:
        res = await coll.delete_one({"_id": oid, "user_id": current_user["_id"]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session record not found")

    if proj_coll is not None:
        await proj_coll.delete_many({"session_id": oid, "user_id": current_user["_id"]})

    logger.info("Deleted session %s and associated project data", session_id)
    return {"deleted": True, "message": "Session deleted successfully"}


@session_router.post("/{session_id}/project")
async def store_project(
    session_id: str,
    req: StoreProjectRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Stores the full completed project codebase in MongoDB for later retrieval and download.
    Sets has_project=True on the associated session.
    """
    coll = get_sessions_collection()
    proj_coll = get_projects_collection()

    if coll is None or proj_coll is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID format")

    session = await coll.find_one({"_id": oid, "user_id": current_user["_id"]})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session record not found")

    now = datetime.now(timezone.utc)
    project_doc = {
        "session_id": oid,
        "user_id": current_user["_id"],
        "files": req.files,
        "readme": req.readme,
        "user_guide": req.user_guide,
        "stored_at": now,
    }

    # Upsert project for this session
    await proj_coll.update_one(
        {"session_id": oid, "user_id": current_user["_id"]},
        {"$set": project_doc},
        upsert=True,
    )

    # Mark session as possessing stored project files
    await coll.update_one({"_id": oid}, {"$set": {"has_project": True, "updated_at": now}})
    logger.info("Stored %d codebase files for session %s in MongoDB Atlas", len(req.files), session_id)

    return {"stored": True, "file_count": len(req.files)}


@session_router.get("/{session_id}/project/download")
async def download_project_zip(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Streams the stored completed project codebase as an in-memory ZIP download archive.
    """
    coll = get_sessions_collection()
    proj_coll = get_projects_collection()

    if coll is None or proj_coll is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session ID format")

    session = await coll.find_one({"_id": oid, "user_id": current_user["_id"]})
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session record not found")

    project = await proj_coll.find_one({"session_id": oid, "user_id": current_user["_id"]})
    if project is None or not project.get("files"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No codebase archive found for this session. It may have been aborted or uncompleted.",
        )

    # Construct clean ZIP in-memory
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        existing_filenames = set()

        for file_entry in project.get("files", []):
            fname = file_entry.get("file_name") or ""
            fcode = file_entry.get("source_code") or ""
            if fname:
                zf.writestr(fname, fcode)
                existing_filenames.add(fname.lower())

        # Include README.md if provided and not already present
        if project.get("readme") and "readme.md" not in existing_filenames:
            zf.writestr("README.md", project["readme"])

        # Include USER_GUIDE.md if provided and not already present
        if project.get("user_guide") and "user_guide.md" not in existing_filenames:
            zf.writestr("USER_GUIDE.md", project["user_guide"])

    buffer.seek(0)
    zip_bytes = buffer.getvalue()

    # Create safe filename slug from project_name
    raw_name = session.get("project_name", "autodev-project")
    slug = re.sub(r"[^\w\-]+", "-", raw_name).strip("-") or "autodev-project"
    zip_filename = f"{slug}.zip"

    headers = {
        "Content-Disposition": f'attachment; filename="{zip_filename}"',
        "Content-Type": "application/zip",
        "Content-Length": str(len(zip_bytes)),
    }

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers=headers,
    )
