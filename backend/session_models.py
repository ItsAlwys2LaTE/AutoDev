from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    project_name: str = "Untitled Project"
    feature_request: str = ""
    mode: str = "QUICK"


class UpdateSessionRequest(BaseModel):
    status: str = "completed"  # "completed" | "aborted" | "running"
    duration_ms: int = 0
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_cost_inr: float = 0.0
    stages_completed: List[str] = Field(default_factory=list)
    component_count: int = 0


class SessionRecord(BaseModel):
    id: str
    user_id: str
    project_name: str
    feature_request: str
    mode: str
    status: str
    created_at: str
    completed_at: Optional[str] = None
    duration_ms: int = 0
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_cost_inr: float = 0.0
    stages_completed: List[str] = Field(default_factory=list)
    component_count: int = 0
    has_project: bool = False


class SessionListResponse(BaseModel):
    sessions: List[SessionRecord]
    total: int
    page: int
    limit: int


class SessionStats(BaseModel):
    total_sessions: int = 0
    total_tokens_used: int = 0
    total_cost_inr: float = 0.0


class ProjectFile(BaseModel):
    file_name: str
    source_code: str


class StoreProjectRequest(BaseModel):
    files: List[Dict[str, Any]] = Field(default_factory=list)
    readme: Optional[str] = None
    user_guide: Optional[str] = None
