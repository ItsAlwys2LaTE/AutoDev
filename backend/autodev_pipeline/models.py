"""
AutoDev Robust Pipeline Algorithm - Core Domain Models and State Schemas.

File: src/autodev_pipeline/models.py
Milestone: M1 (Core Models & State Transition Automata)
"""

from __future__ import annotations

import collections
from dataclasses import asdict, dataclass, field
from enum import Enum, unique
import hashlib
import json
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid


@unique
class StageEnum(str, Enum):
    """
    Ordered discrete stages in the AutoDev multi-agent pipeline.
    Single-occupancy stages where strict mutual exclusion (<= 1 occupant) is enforced.
    """
    DESIGN = "DESIGN"                 # Stage 1: Architecture blueprint & schema synthesis
    CODEGEN = "CODEGEN"               # Stage 2: Autonomous polyglot code generation
    CRITICS = "CRITICS"               # Stage 3: Docker sandbox execution & multi-critic adjudication
    INTEGRATION = "INTEGRATION"       # Stage 4: Multi-component synthesis & unified integration testing
    DOCUMENTATION = "DOCUMENTATION"   # Stage 5: System documentation, README, and API specs

    @classmethod
    def linear_order(cls) -> List[StageEnum]:
        """Returns the canonical sequential progression order of stages."""
        return [
            cls.DESIGN,
            cls.CODEGEN,
            cls.CRITICS,
            cls.INTEGRATION,
            cls.DOCUMENTATION,
        ]

    def next_stage(self) -> Optional[StageEnum]:
        """Returns the next sequential stage, or None if current stage is terminal."""
        order = self.linear_order()
        idx = order.index(self)
        if idx + 1 < len(order):
            return order[idx + 1]
        return None

    def prev_stage(self) -> Optional[StageEnum]:
        """Returns the previous sequential stage, or None if current stage is initial."""
        order = self.linear_order()
        idx = order.index(self)
        if idx > 0:
            return order[idx - 1]
        return None


@unique
class ComponentStatus(str, Enum):
    """
    Formal lifecycle states of an individual component in the pipeline.
    """
    CREATED = "CREATED"                     # Initial state post-decomposition
    PENDING_DEPS = "PENDING_DEPS"           # Waiting for upstream DAG dependencies to complete
    WAITING_DEP = "WAITING_DEP"             # Alias for PENDING_DEPS
    READY = "READY"                         # All dependencies passed; queued for stage acquisition
    IN_STAGE = "IN_STAGE"                   # Actively holding a stage lease and executing
    STALLED = "STALLED"                     # Halted due to dependency failure, cycle, or cascade pause
    QUARANTINED = "QUARANTINED"             # Isolated circuit breaker (exceeded max revisions / poison pill)
    COMPLETED = "COMPLETED"                 # Successfully passed all stages (ready for integration/done)
    FAILED = "FAILED"                       # Terminally failed (unrecoverable error)

    def is_terminal(self) -> bool:
        """Indicates if the state represents an execution conclusion for the component track."""
        return self in (ComponentStatus.COMPLETED, ComponentStatus.FAILED, ComponentStatus.QUARANTINED)

    def is_active(self) -> bool:
        """Indicates if the component is actively holding resources or competing in queues."""
        return self in (ComponentStatus.READY, ComponentStatus.IN_STAGE)


@unique
class StageLockStatus(str, Enum):
    """
    Status of a pipeline stage mutex lock.
    """
    FREE = "FREE"
    HELD = "HELD"
    MAINTENANCE = "MAINTENANCE"


@unique
class CycleResolutionPolicy(str, Enum):
    """
    Deterministic resolution policies when circular dependencies are detected in the DAG.
    """
    ABORT = "ABORT"                                 # Reject decomposition, halt pipeline with error
    SAFE_STALL = "SAFE_STALL"                       # Freeze cyclical nodes in STALLED state, unblock independents
    FEEDBACK_ARC_SET_STUB = "FEEDBACK_ARC_SET_STUB" # Break cycle edges via heuristic FAS and inject interface stubs


@unique
class TransitionEventType(str, Enum):
    """
    Typed event identifiers for Write-Ahead State Storage (WASS) and audit trails.
    """
    COMPONENT_CREATED = "COMPONENT_CREATED"
    STATUS_TRANSITION = "STATUS_TRANSITION"
    STAGE_LEASE_ACQUIRED = "STAGE_LEASE_ACQUIRED"
    STAGE_LEASE_RENEWED = "STAGE_LEASE_RENEWED"
    STAGE_LEASE_RELEASED = "STAGE_LEASE_RELEASED"
    STAGE_LEASE_EXPIRED = "STAGE_LEASE_EXPIRED"
    DEPENDENCY_RESOLVED = "DEPENDENCY_RESOLVED"
    CASCADE_STALL = "CASCADE_STALL"
    QUARANTINE_ISOLATED = "QUARANTINE_ISOLATED"
    CYCLE_RESOLVED = "CYCLE_RESOLVED"
    SNAPSHOT_CREATED = "SNAPSHOT_CREATED"
    CRASH_RECOVERY = "CRASH_RECOVERY"


@dataclass(frozen=True)
class LeaseToken:
    """
    Monotonic epoch-fenced lease token guaranteeing mutual exclusion on a single pipeline stage.
    """
    token_id: str                      # Unique UUID for the lease instance
    component_id: str                  # ID of the component holding the lease
    stage: StageEnum                   # The pipeline stage being leased
    epoch: int                         # Strictly monotonic counter per stage (fencing token)
    acquired_at: float                 # Epoch timestamp (seconds) when lease was granted
    expires_at: float                  # Epoch timestamp (seconds) when lease will expire
    lease_duration_sec: float          # Configured TTL duration (seconds)

    def is_valid(self, current_time: Optional[float] = None) -> bool:
        """Checks whether the lease is currently active and unexpired."""
        now = time.time() if current_time is None else current_time
        return now < self.expires_at

    def time_remaining(self, current_time: Optional[float] = None) -> float:
        """Returns the seconds remaining before lease expiration."""
        now = time.time() if current_time is None else current_time
        return max(0.0, self.expires_at - now)

    def renew(self, duration_sec: Optional[float] = None, current_time: Optional[float] = None) -> LeaseToken:
        """
        Creates a renewed LeaseToken with extended expiration time retaining the same epoch and token_id.
        """
        now = time.time() if current_time is None else current_time
        dur = self.lease_duration_sec if duration_sec is None else duration_sec
        return LeaseToken(
            token_id=self.token_id,
            component_id=self.component_id,
            stage=self.stage,
            epoch=self.epoch,
            acquired_at=self.acquired_at,
            expires_at=now + dur,
            lease_duration_sec=dur,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the lease token into a primitive dictionary."""
        return {
            "token_id": self.token_id,
            "component_id": self.component_id,
            "stage": self.stage.value,
            "epoch": self.epoch,
            "acquired_at": self.acquired_at,
            "expires_at": self.expires_at,
            "lease_duration_sec": self.lease_duration_sec,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> LeaseToken:
        """Deserializes a dictionary into a LeaseToken instance."""
        return cls(
            token_id=data["token_id"],
            component_id=data["component_id"],
            stage=StageEnum(data["stage"]),
            epoch=int(data["epoch"]),
            acquired_at=float(data["acquired_at"]),
            expires_at=float(data["expires_at"]),
            lease_duration_sec=float(data["lease_duration_sec"]),
        )


@dataclass
class ComponentStateRecord:
    """
    Runtime state record for a single pipeline component.
    """
    component_id: str
    name: str
    dependencies: List[str] = field(default_factory=list)
    priority_order: int = 0
    status: ComponentStatus = ComponentStatus.CREATED
    current_stage: Optional[StageEnum] = None
    active_lease: Optional[LeaseToken] = None
    revision_count: int = 0
    max_revisions: int = 2
    force_proceeded: bool = False

    # Generated Artifacts & Metadata
    blueprint_artifact: Optional[Dict[str, Any]] = None
    codebase_artifact: Optional[Dict[str, Any]] = None
    execution_result: Optional[Dict[str, Any]] = None
    critic_feedbacks: List[Dict[str, Any]] = field(default_factory=list)
    quarantine_reason: Optional[str] = None
    error_log: Optional[str] = None

    # Timestamps
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    stage_entered_at: Optional[float] = None
    completed_at: Optional[float] = None

    # Valid transitions mapping
    VALID_TRANSITIONS: Dict[ComponentStatus, Set[ComponentStatus]] = field(
        default_factory=lambda: {
            ComponentStatus.CREATED: {
                ComponentStatus.PENDING_DEPS,
                ComponentStatus.WAITING_DEP,
                ComponentStatus.READY,
                ComponentStatus.STALLED,
                ComponentStatus.FAILED,
            },
            ComponentStatus.PENDING_DEPS: {
                ComponentStatus.READY,
                ComponentStatus.STALLED,
                ComponentStatus.FAILED,
            },
            ComponentStatus.WAITING_DEP: {
                ComponentStatus.READY,
                ComponentStatus.STALLED,
                ComponentStatus.FAILED,
            },
            ComponentStatus.READY: {
                ComponentStatus.IN_STAGE,
                ComponentStatus.STALLED,
                ComponentStatus.FAILED,
                ComponentStatus.COMPLETED,
            },
            ComponentStatus.IN_STAGE: {
                ComponentStatus.READY,
                ComponentStatus.COMPLETED,
                ComponentStatus.QUARANTINED,
                ComponentStatus.STALLED,
                ComponentStatus.FAILED,
            },
            ComponentStatus.STALLED: {
                ComponentStatus.READY,
                ComponentStatus.PENDING_DEPS,
                ComponentStatus.WAITING_DEP,
                ComponentStatus.COMPLETED,
                ComponentStatus.FAILED,
            },
            ComponentStatus.QUARANTINED: {
                ComponentStatus.READY,
                ComponentStatus.COMPLETED,
                ComponentStatus.FAILED,
            },
            ComponentStatus.COMPLETED: set(),  # Terminal state
            ComponentStatus.FAILED: set(),     # Terminal state
        },
        init=False,
        repr=False,
    )

    def __post_init__(self):
        if self.max_revisions is None:
            self.max_revisions = 2

    def can_transition_to(self, target: ComponentStatus) -> bool:
        """Validates if target status is reachable from current status."""
        return target in self.VALID_TRANSITIONS.get(self.status, set())

    def transition_to(
        self,
        new_status: ComponentStatus,
        stage: Optional[StageEnum] = None,
        lease: Optional[LeaseToken] = None,
        reason: Optional[str] = None,
    ) -> None:
        """
        Executes a validated state transition, updating timestamps and stage associations.
        Raises ValueError on invalid state transition.
        """
        if not self.can_transition_to(new_status):
            raise ValueError(
                f"Invalid transition for component '{self.component_id}': {self.status.value} -> {new_status.value}"
            )

        now = time.time()
        self.status = new_status
        self.current_stage = stage
        self.active_lease = lease
        self.updated_at = now

        if new_status == ComponentStatus.IN_STAGE:
            self.stage_entered_at = now
        elif new_status == ComponentStatus.COMPLETED:
            self.completed_at = now
        elif new_status == ComponentStatus.QUARANTINED:
            self.quarantine_reason = reason
        elif new_status == ComponentStatus.FAILED:
            self.error_log = reason
        elif new_status == ComponentStatus.STALLED and reason:
            self.error_log = reason

    def increment_revision(self) -> int:
        """Increments revision count and returns new value."""
        self.revision_count += 1
        self.updated_at = time.time()
        return self.revision_count

    def has_exceeded_revisions(self) -> bool:
        """Checks whether the component has exhausted its revision retry budget."""
        return self.revision_count >= self.max_revisions

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the component state record into a primitive dictionary."""
        return {
            "component_id": self.component_id,
            "name": self.name,
            "dependencies": list(self.dependencies),
            "priority_order": self.priority_order,
            "status": self.status.value,
            "current_stage": self.current_stage.value if self.current_stage else None,
            "active_lease": self.active_lease.to_dict() if self.active_lease else None,
            "revision_count": self.revision_count,
            "max_revisions": self.max_revisions,
            "force_proceeded": self.force_proceeded,
            "blueprint_artifact": self.blueprint_artifact,
            "codebase_artifact": self.codebase_artifact,
            "execution_result": self.execution_result,
            "critic_feedbacks": self.critic_feedbacks,
            "quarantine_reason": self.quarantine_reason,
            "error_log": self.error_log,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "stage_entered_at": self.stage_entered_at,
            "completed_at": self.completed_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ComponentStateRecord:
        """Deserializes a dictionary into a ComponentStateRecord instance."""
        return cls(
            component_id=data["component_id"],
            name=data["name"],
            dependencies=list(data.get("dependencies", [])),
            priority_order=int(data.get("priority_order", 0)),
            status=ComponentStatus(data["status"]),
            current_stage=StageEnum(data["current_stage"]) if data.get("current_stage") else None,
            active_lease=LeaseToken.from_dict(data["active_lease"]) if data.get("active_lease") else None,
            revision_count=int(data.get("revision_count", 0)),
            max_revisions=int(data["max_revisions"]) if data.get("max_revisions") is not None else 2,
            force_proceeded=bool(data.get("force_proceeded", False)),
            blueprint_artifact=data.get("blueprint_artifact"),
            codebase_artifact=data.get("codebase_artifact"),
            execution_result=data.get("execution_result"),
            critic_feedbacks=list(data.get("critic_feedbacks", [])),
            quarantine_reason=data.get("quarantine_reason"),
            error_log=data.get("error_log"),
            created_at=float(data.get("created_at", time.time())),
            updated_at=float(data.get("updated_at", time.time())),
            stage_entered_at=float(data["stage_entered_at"]) if data.get("stage_entered_at") is not None else None,
            completed_at=float(data["completed_at"]) if data.get("completed_at") is not None else None,
        )


@dataclass(frozen=True)
class PipelineConfig:
    """
    Global configuration parameters for pipeline execution, timeouts, and resilience policies.
    """
    max_revisions: Optional[int] = None                          # Maximum critic revision cycles before quarantine
    generation_mode: str = "QUICK"
    lease_duration_sec: float = 3600.0               # Lease TTL per stage acquisition
    lease_heartbeat_interval_sec: float = 10.0      # Heartbeat cadence (tau = Delta t / 3)
    stage_timeout_sec: float = 3600.0               # Global stage execution timeout
    docker_timeout_sec: float = 300.0               # Sandbox container execution timeout
    llm_timeout_sec: float = 60.0                  # LLM call timeout
    cycle_policy: CycleResolutionPolicy = CycleResolutionPolicy.SAFE_STALL
    enable_wass: bool = True                       # Enable Write-Ahead State Store logging
    state_log_path: str = "pipeline_state.json"    # Persistence path
    quarantine_on_poison_pill: bool = True          # Auto-isolate failing nodes

    def __post_init__(self):
        gen_mode = str(self.generation_mode or "QUICK").upper()
        if self.generation_mode != gen_mode:
            object.__setattr__(self, "generation_mode", gen_mode)
        if self.max_revisions is None:
            default_revs = 2 if gen_mode == "QUICK" else 3
            object.__setattr__(self, "max_revisions", default_revs)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the configuration into a primitive dictionary."""
        return {
            "max_revisions": self.max_revisions,
            "generation_mode": self.generation_mode,
            "lease_duration_sec": self.lease_duration_sec,
            "lease_heartbeat_interval_sec": self.lease_heartbeat_interval_sec,
            "stage_timeout_sec": self.stage_timeout_sec,
            "docker_timeout_sec": self.docker_timeout_sec,
            "llm_timeout_sec": self.llm_timeout_sec,
            "cycle_policy": self.cycle_policy.value,
            "enable_wass": self.enable_wass,
            "state_log_path": self.state_log_path,
            "quarantine_on_poison_pill": self.quarantine_on_poison_pill,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> PipelineConfig:
        """Deserializes a dictionary into a PipelineConfig instance."""
        gen_mode = str(data.get("generation_mode") or "QUICK").upper()
        default_max_revs = 2 if gen_mode == "QUICK" else 3
        return cls(
            max_revisions=int(data["max_revisions"]) if "max_revisions" in data and data["max_revisions"] is not None else default_max_revs,
            generation_mode=gen_mode,
            lease_duration_sec=float(data.get("lease_duration_sec", 30.0)),
            lease_heartbeat_interval_sec=float(data.get("lease_heartbeat_interval_sec", 10.0)),
            stage_timeout_sec=float(data.get("stage_timeout_sec", 120.0)),
            docker_timeout_sec=float(data.get("docker_timeout_sec", 45.0)),
            llm_timeout_sec=float(data.get("llm_timeout_sec", 60.0)),
            cycle_policy=CycleResolutionPolicy(data.get("cycle_policy", CycleResolutionPolicy.SAFE_STALL.value)),
            enable_wass=bool(data.get("enable_wass", True)),
            state_log_path=str(data.get("state_log_path", "pipeline_state.json")),
            quarantine_on_poison_pill=bool(data.get("quarantine_on_poison_pill", True)),
        )


@dataclass(frozen=True)
class StateTransitionEvent:
    """
    Immutable state transition log record for Write-Ahead State Store (WASS) replay.
    """
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    event_type: TransitionEventType = TransitionEventType.STATUS_TRANSITION
    component_id: Optional[str] = None
    from_status: Optional[ComponentStatus] = None
    to_status: Optional[ComponentStatus] = None
    stage: Optional[StageEnum] = None
    epoch: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    payload_hash: str = field(default="")

    def __post_init__(self) -> None:
        if not self.payload_hash:
            computed_hash = self._compute_hash()
            object.__setattr__(self, "payload_hash", computed_hash)

    def _compute_hash(self) -> str:
        """Computes SHA-256 integrity hash of event fields."""
        serialized = json.dumps(
            {
                "event_id": self.event_id,
                "timestamp": self.timestamp,
                "event_type": self.event_type.value,
                "component_id": self.component_id,
                "from_status": self.from_status.value if self.from_status else None,
                "to_status": self.to_status.value if self.to_status else None,
                "stage": self.stage.value if self.stage else None,
                "epoch": self.epoch,
                "metadata": self.metadata,
            },
            sort_keys=True,
        )
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the transition event into a primitive dictionary."""
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "event_type": self.event_type.value,
            "component_id": self.component_id,
            "from_status": self.from_status.value if self.from_status else None,
            "to_status": self.to_status.value if self.to_status else None,
            "stage": self.stage.value if self.stage else None,
            "epoch": self.epoch,
            "metadata": self.metadata,
            "payload_hash": self.payload_hash,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> StateTransitionEvent:
        """Deserializes a dictionary into a StateTransitionEvent instance."""
        return cls(
            event_id=data["event_id"],
            timestamp=float(data["timestamp"]),
            event_type=TransitionEventType(data["event_type"]),
            component_id=data.get("component_id"),
            from_status=ComponentStatus(data["from_status"]) if data.get("from_status") else None,
            to_status=ComponentStatus(data["to_status"]) if data.get("to_status") else None,
            stage=StageEnum(data["stage"]) if data.get("stage") else None,
            epoch=int(data["epoch"]) if data.get("epoch") is not None else None,
            metadata=dict(data.get("metadata", {})),
            payload_hash=data.get("payload_hash", ""),
        )


@dataclass
class PipelineSnapshot:
    """
    Complete immutable snapshot of pipeline state for checkpointing and crash recovery.
    """
    snapshot_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    pipeline_status: str = "RUNNING"
    components: Dict[str, ComponentStateRecord] = field(default_factory=dict)
    stage_leases: Dict[str, Optional[LeaseToken]] = field(default_factory=dict)
    reservation_counter: int = 0
    event_sequence_num: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Serializes the pipeline snapshot into a primitive dictionary."""
        return {
            "snapshot_id": self.snapshot_id,
            "timestamp": self.timestamp,
            "pipeline_status": self.pipeline_status,
            "components": {cid: c.to_dict() for cid, c in self.components.items()},
            "stage_leases": {
                stage_str: (lease.to_dict() if lease else None)
                for stage_str, lease in self.stage_leases.items()
            },
            "reservation_counter": self.reservation_counter,
            "event_sequence_num": self.event_sequence_num,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> PipelineSnapshot:
        """Deserializes a dictionary into a PipelineSnapshot instance."""
        comps = {
            cid: ComponentStateRecord.from_dict(c_data)
            for cid, c_data in data.get("components", {}).items()
        }
        leases: Dict[str, Optional[LeaseToken]] = {}
        for stage_str, lease_data in data.get("stage_leases", {}).items():
            leases[stage_str] = LeaseToken.from_dict(lease_data) if lease_data else None

        return cls(
            snapshot_id=data.get("snapshot_id", str(uuid.uuid4())),
            timestamp=float(data.get("timestamp", time.time())),
            pipeline_status=data.get("pipeline_status", "RUNNING"),
            components=comps,
            stage_leases=leases,
            reservation_counter=int(data.get("reservation_counter", 0)),
            event_sequence_num=int(data.get("event_sequence_num", 0)),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serializes snapshot to formatted JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> PipelineSnapshot:
        """Deserializes snapshot from JSON string."""
        return cls.from_dict(json.loads(json_str))
