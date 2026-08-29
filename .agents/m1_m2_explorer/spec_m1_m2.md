# Technical Specification & Algorithmic Blueprint: Milestones M1 & M2

**Document Version:** 1.0.0  
**Target Project:** `autodev_pipeline_algo` (`C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo`)  
**Scope:** 
- **Milestone M1:** Core Data Models, Enums, State Transition Automata, and Schemas (`src/autodev_pipeline/models.py`)
- **Milestone M2:** DAG Dependency Engine, Kahn's Topological Resolution, Tarjan's SCC Cycle Detection, and Safe Stall / FAS Resolution Policies (`src/autodev_pipeline/dag_engine.py`)

---

## 1. System Context & Theoretical Foundations

In the AutoDev multi-agent software development pipeline, a complex software specification is decomposed by the Master Architect into a set of discrete components $\mathcal{C} = \{c_1, c_2, \dots, c_n\}$. These components must traverse an ordered sequence of development stages:

$$\mathcal{S} = \{S_{\text{DESIGN}}, S_{\text{CODEGEN}}, S_{\text{CRITICS}}, S_{\text{INTEGRATION}}, S_{\text{DOCUMENTATION}}\}$$

Milestones M1 and M2 establish the foundational data structures and graph algorithms required to ensure:
1. **Mathematical Stage Exclusivity Invariant:** At any instant $t$, at most one component may occupy any given stage:
   $$\forall S \in \mathcal{S}, \quad \sum_{c \in \mathcal{C}} \mathbb{I}\Big(\text{stage}(c, t) = S\Big) \le 1$$
2. **Deterministic Topological Execution:** Components execute strictly when all prerequisite dependencies have successfully completed.
3. **Circular Dependency Immunity:** Cyclical dependencies ($c_1 \to c_2 \to \dots \to c_1$) and malformed references (phantom or self-dependencies) are detected upfront in $O(|V| + |E|)$ time and resolved deterministically without silent deadlocks or process crashes.

---

## 2. Milestone M1: Core Models Specification (`src/autodev_pipeline/models.py`)

### 2.1 Enums & Discrete Domain Types

```python
"""
Data models and state schemas for the AutoDev Robust Pipeline Algorithm.
File: src/autodev_pipeline/models.py
"""

from enum import Enum, unique
from typing import Dict, List, Optional, Set, Any, Tuple
from dataclasses import dataclass, field, asdict
import time
import uuid
import hashlib
import json


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
    def linear_order(cls) -> List["StageEnum"]:
        """Returns the canonical sequential progression order."""
        return [
            cls.DESIGN,
            cls.CODEGEN,
            cls.CRITICS,
            cls.INTEGRATION,
            cls.DOCUMENTATION,
        ]

    def next_stage(self) -> Optional["StageEnum"]:
        """Returns the next sequential stage, or None if terminal."""
        order = self.linear_order()
        idx = order.index(self)
        if idx + 1 < len(order):
            return order[idx + 1]
        return None

    def prev_stage(self) -> Optional["StageEnum"]:
        """Returns the previous sequential stage, or None if initial."""
        order = self.linear_order()
        idx = order.index(self)
        if idx > 0:
            return order[idx - 1]
        return None


@unique
class ComponentStatus(str, Enum):
    """
    Formal lifecycle state of an individual component.
    """
    CREATED = "CREATED"                     # Initial state post-decomposition
    PENDING_DEPS = "PENDING_DEPS"           # Waiting for upstream DAG dependencies to complete
    READY = "READY"                         # All dependencies passed; queued for stage acquisition
    IN_STAGE = "IN_STAGE"                   # Actively holding a stage lease and executing
    STALLED = "STALLED"                     # Halted due to dependency failure, cycle, or cascade pause
    QUARANTINED = "QUARANTINED"             # Isolated circuit breaker (exceeded max revisions / poison pill)
    COMPLETED = "COMPLETED"                 # Successfully passed all stages through CRITICS (ready for integration)
    FAILED = "FAILED"                       # Terminally failed (unrecoverable system or verification error)

    def is_terminal(self) -> bool:
        """Indicates if the state represents an execution conclusion for the component track."""
        return self in (ComponentStatus.COMPLETED, ComponentStatus.FAILED, ComponentStatus.QUARANTINED)

    def is_active(self) -> bool:
        """Indicates if the component is actively holding resources or competing in queues."""
        return self in (ComponentStatus.READY, ComponentStatus.IN_STAGE)


@unique
class StageLockStatus(str, Enum):
    """
    Status of a pipeline stage mutex.
    """
    FREE = "FREE"
    HELD = "HELD"
    MAINTENANCE = "MAINTENANCE"


@unique
class CycleResolutionPolicy(str, Enum):
    """
    Deterministic resolution policies when circular dependencies are detected in DAG.
    """
    ABORT = "ABORT"                                 # Reject decomposition, halt pipeline with error
    SAFE_STALL = "SAFE_STALL"                       # Freeze cyclical nodes in STALLED state, unblock independents
    FEEDBACK_ARC_SET_STUB = "FEEDBACK_ARC_SET_STUB" # Break cycle edges via minimum FAS and inject interface stubs


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
```

---

### 2.2 Data Classes & Core Entities

#### 2.2.1 `LeaseToken`
The `LeaseToken` is a cryptographically verifiable, epoch-fenced capability token granting a component exclusive occupancy of a specific pipeline stage for a bounded duration.

```python
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

    def renew(self, duration_sec: Optional[float] = None, current_time: Optional[float] = None) -> "LeaseToken":
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
    def from_dict(cls, data: Dict[str, Any]) -> "LeaseToken":
        return cls(
            token_id=data["token_id"],
            component_id=data["component_id"],
            stage=StageEnum(data["stage"]),
            epoch=int(data["epoch"]),
            acquired_at=float(data["acquired_at"]),
            expires_at=float(data["expires_at"]),
            lease_duration_sec=float(data["lease_duration_sec"]),
        )
```

#### 2.2.2 `ComponentStateRecord`
Represents the complete, mutable runtime state of an individual component, including its DAG relationships, current stage execution metadata, revision loop counters, and generated artifacts.

```python
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
    max_revisions: int = 3
    
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
    VALID_TRANSITIONS = {
        ComponentStatus.CREATED: {ComponentStatus.PENDING_DEPS, ComponentStatus.READY, ComponentStatus.STALLED, ComponentStatus.FAILED},
        ComponentStatus.PENDING_DEPS: {ComponentStatus.READY, ComponentStatus.STALLED, ComponentStatus.FAILED},
        ComponentStatus.READY: {ComponentStatus.IN_STAGE, ComponentStatus.STALLED, ComponentStatus.FAILED, ComponentStatus.COMPLETED},
        ComponentStatus.IN_STAGE: {ComponentStatus.READY, ComponentStatus.COMPLETED, ComponentStatus.QUARANTINED, ComponentStatus.STALLED, ComponentStatus.FAILED},
        ComponentStatus.STALLED: {ComponentStatus.READY, ComponentStatus.PENDING_DEPS, ComponentStatus.FAILED},
        ComponentStatus.QUARANTINED: {ComponentStatus.READY, ComponentStatus.FAILED}, # Manual or policy un-quarantine
        ComponentStatus.COMPLETED: set(),  # Terminal state
        ComponentStatus.FAILED: set(),     # Terminal state
    }

    def can_transition_to(self, target: ComponentStatus) -> bool:
        """Validates if target status is reachable from current status."""
        return target in self.VALID_TRANSITIONS.get(self.status, set())

    def transition_to(
        self,
        new_status: ComponentStatus,
        stage: Optional[StageEnum] = None,
        lease: Optional[LeaseToken] = None,
        reason: Optional[str] = None
    ) -> None:
        """
        Executes a validated state transition, updating timestamps and stage associations.
        Raises ValueError on invalid state transition.
        """
        if not self.can_transition_to(new_status):
            raise ValueError(
                f"Invalid transition for component {self.component_id}: {self.status} -> {new_status}"
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

    def increment_revision(self) -> int:
        """Increments revision count and returns new value."""
        self.revision_count += 1
        self.updated_at = time.time()
        return self.revision_count

    def has_exceeded_revisions(self) -> bool:
        """Checks whether the component has exhausted its revision retry budget."""
        return self.revision_count >= self.max_revisions

    def to_dict(self) -> Dict[str, Any]:
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
    def from_dict(cls, data: Dict[str, Any]) -> "ComponentStateRecord":
        return cls(
            component_id=data["component_id"],
            name=data["name"],
            dependencies=list(data.get("dependencies", [])),
            priority_order=int(data.get("priority_order", 0)),
            status=ComponentStatus(data["status"]),
            current_stage=StageEnum(data["current_stage"]) if data.get("current_stage") else None,
            active_lease=LeaseToken.from_dict(data["active_lease"]) if data.get("active_lease") else None,
            revision_count=int(data.get("revision_count", 0)),
            max_revisions=int(data.get("max_revisions", 3)),
            blueprint_artifact=data.get("blueprint_artifact"),
            codebase_artifact=data.get("codebase_artifact"),
            execution_result=data.get("execution_result"),
            critic_feedbacks=list(data.get("critic_feedbacks", [])),
            quarantine_reason=data.get("quarantine_reason"),
            error_log=data.get("error_log"),
            created_at=float(data.get("created_at", time.time())),
            updated_at=float(data.get("updated_at", time.time())),
            stage_entered_at=float(data["stage_entered_at"]) if data.get("stage_entered_at") else None,
            completed_at=float(data["completed_at"]) if data.get("completed_at") else None,
        )
```

#### 2.2.3 `PipelineConfig`
Defines operational parameters, timeouts, and policy configuration for pipeline scheduling.

```python
@dataclass(frozen=True)
class PipelineConfig:
    """
    Global configuration parameters for pipeline execution, timeouts, and resilience policies.
    """
    max_revisions: int = 3                          # Maximum critic revision cycles before quarantine
    lease_duration_sec: float = 30.0               # Lease TTL per stage acquisition
    lease_heartbeat_interval_sec: float = 10.0      # Heartbeat cadence (tau = Delta t / 3)
    stage_timeout_sec: float = 120.0               # Global stage execution timeout
    docker_timeout_sec: float = 45.0               # Sandbox container execution timeout
    llm_timeout_sec: float = 60.0                  # LLM call timeout
    cycle_policy: CycleResolutionPolicy = CycleResolutionPolicy.SAFE_STALL
    enable_wass: bool = True                       # Enable Write-Ahead State Store logging
    state_log_path: str = "pipeline_state.json"    # Persistence path
    quarantine_on_poison_pill: bool = True          # Auto-isolate failing nodes

    def to_dict(self) -> Dict[str, Any]:
        return {
            "max_revisions": self.max_revisions,
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
    def from_dict(cls, data: Dict[str, Any]) -> "PipelineConfig":
        return cls(
            max_revisions=int(data.get("max_revisions", 3)),
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
```

#### 2.2.4 `StateTransitionEvent`
An append-only audit event serialized to disk before modifying in-memory state (WASS protocol).

```python
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

    def __post_init__(self):
        if not self.payload_hash:
            computed_hash = self._compute_hash()
            # Object is frozen, so set attribute via object.__setattr__
            object.__setattr__(self, "payload_hash", computed_hash)

    def _compute_hash(self) -> str:
        """Computes SHA-256 integrity hash of event fields."""
        serialized = json.dumps({
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "event_type": self.event_type.value,
            "component_id": self.component_id,
            "from_status": self.from_status.value if self.from_status else None,
            "to_status": self.to_status.value if self.to_status else None,
            "stage": self.stage.value if self.stage else None,
            "epoch": self.epoch,
            "metadata": self.metadata,
        }, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
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
    def from_dict(cls, data: Dict[str, Any]) -> "StateTransitionEvent":
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
```

#### 2.2.5 `PipelineSnapshot`
Complete serialized snapshot of the pipeline at timestamp $t$.

```python
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
    def from_dict(cls, data: Dict[str, Any]) -> "PipelineSnapshot":
        comps = {
            cid: ComponentStateRecord.from_dict(c_data)
            for cid, c_data in data.get("components", {}).items()
        }
        leases = {}
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
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> "PipelineSnapshot":
        return cls.from_dict(json.loads(json_str))
```

---

## 3. Milestone M2: DAG Dependency Engine & Cycle Resolution (`src/autodev_pipeline/dag_engine.py`)

### 3.1 Graph Representation & Formal Graph Constraints

Let $G = (V, E)$ be the dependency digraph where:
- $V = \{c_1, c_2, \dots, c_n\}$ is the set of component vertices.
- $E \subseteq V \times V$ is the set of directed precedence edges: $(u, v) \in E \implies u$ is a prerequisite for $v$ ($v$ depends on $u$).
- **In-Degree:** $\text{in\_degree}(v) = |\{u \in V \mid (u, v) \in E\}|$ represents the number of unfinished upstream dependencies for component $v$.
- **Out-Degree:** $\text{out\_degree}(u) = |\{v \in V \mid (u, v) \in E\}|$ represents the direct dependents waiting on component $u$.

#### Safety Invariants for DAG Execution:
1. **DAG Acyclicity:** $\nexists \langle v_0, v_1, \dots, v_k \rangle$ such that $(v_i, v_{i+1}) \in E$ and $(v_k, v_0) \in E$.
2. **Referential Integrity:** $\forall (u, v) \in E, \quad u \in V \land v \in V$.
3. **Irreflexivity (No Self-Dependencies):** $\forall v \in V, \quad (v, v) \notin E$.
4. **Execution Eligibility Condition:**
   $$\text{Eligible}(v) \iff \forall u \text{ s.t. } (u, v) \in E, \quad \text{status}(u) = \text{COMPLETED}$$

---

### 3.2 Result Data Structures

```python
"""
DAG Dependency Engine and Cycle Resolution Algorithms.
File: src/autodev_pipeline/dag_engine.py
"""

from typing import Dict, List, Set, Tuple, Optional, Any
from dataclasses import dataclass, field
import collections

from autodev_pipeline.models import (
    ComponentStateRecord,
    ComponentStatus,
    CycleResolutionPolicy,
)


@dataclass(frozen=True)
class DAGValidationResult:
    """
    Comprehensive validation report for a component dependency graph.
    """
    is_valid: bool
    has_cycles: bool
    cycles: List[List[str]] = field(default_factory=list)
    missing_dependencies: Dict[str, List[str]] = field(default_factory=dict)
    self_dependencies: List[str] = field(default_factory=list)
    orphan_nodes: List[str] = field(default_factory=list)
    error_messages: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class TopologicalPlan:
    """
    Execution plan produced by Kahn's algorithm with layer and depth metrics.
    """
    linear_order: List[str]
    parallel_layers: List[List[str]]
    critical_path_lengths: Dict[str, int]
    in_degrees: Dict[str, int]


@dataclass(frozen=True)
class CycleResolutionResult:
    """
    Outcome of executing a cycle resolution policy.
    """
    policy: CycleResolutionPolicy
    resolved_acyclic: bool
    stalled_components: List[str] = field(default_factory=list)
    broken_edges: List[Tuple[str, str]] = field(default_factory=list)
    injected_stubs: Dict[str, List[str]] = field(default_factory=dict)
    diagnostic_message: str = ""
```

---

### 3.3 Algorithms Specification

#### 3.3.1 Kahn's Algorithm for Topological Sorting & In-Degree Tracking
Kahn's algorithm performs $O(|V| + |E|)$ topological ordering, layer partitioning (breadth-first execution levels), and critical path computation.

**Mathematical Steps:**
1. Let $\text{in\_deg}(v) = |\{u \in V \mid (u, v) \in E\}|$ for all $v \in V$.
2. Initialize FIFO queue $Q_0 \leftarrow \{v \in V \mid \text{in\_deg}(v) = 0\}$.
3. Layer index $L = 0$.
4. While $Q_L \ne \emptyset$:
   - Set current layer $\mathcal{L}_L \leftarrow \text{elements of } Q_L$.
   - Initialize $Q_{L+1} \leftarrow \emptyset$.
   - For each $u \in \mathcal{L}_L$:
     - Append $u$ to linear order $\mathcal{T}$.
     - For each downstream neighbor $v \in \text{Adj}_{\text{down}}(u)$:
       - $\text{in\_deg}(v) \leftarrow \text{in\_deg}(v) - 1$
       - If $\text{in\_deg}(v) = 0$, add $v$ to $Q_{L+1}$.
   - $L \leftarrow L + 1$.
5. If $|\mathcal{T}| = |V|$, graph is acyclic. Critical path depths are computed backwards from sink nodes.
6. If $|\mathcal{T}| < |V|$, vertices with $\text{in\_deg}(v) > 0$ participate in or depend on cycles.

#### 3.3.2 Tarjan's Strongly Connected Components (SCC) Cycle Isolation
Tarjan's algorithm extracts all maximal strongly connected subgraphs in a single DFS traversal in $O(|V| + |E|)$ time.

**Mathematical Lowlink Recurrence:**
For a node $u$ during DFS:
$$\text{lowlink}(u) = \min \begin{cases} 
\text{index}(u) \\
\min_{(u, v) \in E, v \text{ unvisited}} \text{lowlink}(v) \\
\min_{(u, w) \in E, w \text{ on stack}} \text{index}(w)
\end{cases}$$

An SCC root is identified when $\text{lowlink}(u) = \text{index}(u)$. If $|SCC| > 1$ or $(u, u) \in E$, an exact cycle path is extracted via depth-first backtrace within the SCC subgraph.

#### 3.3.3 Feedback Arc Set (FAS) Heuristic Cycle Breaking
To break cycles automatically under `FEEDBACK_ARC_SET_STUB`:
1. For each SCC with $|SCC| > 1$, compute the induced subgraph $G_{\text{SCC}} = (V_{\text{SCC}}, E_{\text{SCC}})$.
2. Use the Eades-Lin-Smyth greedy heuristic (or minimum in-degree/priority ranking) to identify the minimum edge set $E_{\text{FAS}} \subset E_{\text{SCC}}$ whose removal eliminates all cycles.
3. For each broken edge $(u, v) \in E_{\text{FAS}}$:
   - Remove $(u, v)$ from dependency graph.
   - Generate an interface contract stub ID (e.g. `stub::u_to_v`).
   - Component $v$ is allowed to progress to DESIGN/CODEGEN against the mock interface stub without blocking on $u$'s full implementation.

---

### 3.4 Implementation Architecture: `PipelineDAG` Class

```python
class PipelineDAG:
    """
    Deterministic Directed Acyclic Graph engine for component dependency resolution,
    Kahn topological sorting, Tarjan SCC cycle extraction, and safe stall policies.
    """
    def __init__(self):
        # Internal adjacency structures:
        # _downstream[u] = {v1, v2} means u -> v (v depends on u)
        self._downstream: Dict[str, Set[str]] = collections.defaultdict(set)
        # _upstream[v] = {u1, u2} means u -> v (v depends on u)
        self._upstream: Dict[str, Set[str]] = collections.defaultdict(set)
        # Nodes dictionary mapping component_id -> ComponentStateRecord
        self._nodes: Dict[str, ComponentStateRecord] = {}

    def add_component(self, component: ComponentStateRecord) -> None:
        """Adds a component node and registers its declared dependencies."""
        cid = component.component_id
        self._nodes[cid] = component
        if cid not in self._downstream:
            self._downstream[cid] = set()
        if cid not in self._upstream:
            self._upstream[cid] = set()

        for dep_id in component.dependencies:
            self.add_dependency(component_id=cid, depends_on_id=dep_id)

    def add_dependency(self, component_id: str, depends_on_id: str) -> None:
        """
        Adds a directed edge: depends_on_id -> component_id
        (depends_on_id is prerequisite for component_id).
        """
        self._upstream[component_id].add(depends_on_id)
        self._downstream[depends_on_id].add(component_id)

    def remove_dependency(self, component_id: str, depends_on_id: str) -> None:
        """Removes a directed dependency edge."""
        self._upstream[component_id].discard(depends_on_id)
        self._downstream[depends_on_id].discard(component_id)
        if component_id in self._nodes:
            if depends_on_id in self._nodes[component_id].dependencies:
                self._nodes[component_id].dependencies.remove(depends_on_id)

    def validate_graph(self) -> DAGValidationResult:
        """
        Validates graph referential integrity, self-dependencies, and acyclicity.
        Returns detailed DAGValidationResult.
        """
        missing_deps: Dict[str, List[str]] = {}
        self_deps: List[str] = []
        errors: List[str] = []

        all_node_ids = set(self._nodes.keys())

        # 1. Check self-dependencies and missing references
        for cid, node in self._nodes.items():
            declared_deps = node.dependencies
            for dep in declared_deps:
                if dep == cid:
                    self_deps.append(cid)
                    errors.append(f"Component '{cid}' has a self-dependency.")
                elif dep not in all_node_ids:
                    if cid not in missing_deps:
                        missing_deps[cid] = []
                    missing_deps[cid].append(dep)
                    errors.append(f"Component '{cid}' depends on non-existent component '{dep}'.")

        # 2. Check cycles using Tarjan's SCC
        cycles = self.detect_cycles_tarjan()
        has_cycles = len(cycles) > 0
        if has_cycles:
            for cycle in cycles:
                cycle_str = " -> ".join(cycle)
                errors.append(f"Circular dependency detected: {cycle_str}")

        # 3. Check orphan nodes (nodes with missing dependencies)
        orphans = list(missing_deps.keys())

        is_valid = (len(self_deps) == 0 and len(missing_deps) == 0 and not has_cycles)

        return DAGValidationResult(
            is_valid=is_valid,
            has_cycles=has_cycles,
            cycles=cycles,
            missing_dependencies=missing_deps,
            self_dependencies=self_deps,
            orphan_nodes=orphans,
            error_messages=errors,
        )

    def detect_cycles_tarjan(self) -> List[List[str]]:
        """
        Executes Tarjan's Strongly Connected Components algorithm.
        Returns a list of cycle paths for all SCCs with |SCC| > 1 or self-loops.
        Time Complexity: O(|V| + |E|).
        """
        index = 0
        indices: Dict[str, int] = {}
        lowlinks: Dict[str, int] = {}
        stack: List[str] = []
        on_stack: Set[str] = set()
        sccs: List[List[str]] = []

        def strongconnect(node: str):
            nonlocal index
            indices[node] = index
            lowlinks[node] = index
            index += 1
            stack.append(node)
            on_stack.add(node)

            # Consider successors in forward graph (downstream)
            for successor in self._downstream.get(node, set()):
                # Only explore known nodes
                if successor not in self._nodes:
                    continue
                if successor not in indices:
                    strongconnect(successor)
                    lowlinks[node] = min(lowlinks[node], lowlinks[successor])
                elif successor in on_stack:
                    lowlinks[node] = min(lowlinks[node], indices[successor])

            if lowlinks[node] == indices[node]:
                scc: List[str] = []
                while True:
                    w = stack.pop()
                    on_stack.remove(w)
                    scc.append(w)
                    if w == node:
                        break
                
                # An SCC is a cycle if |SCC| > 1 or if a single node has a self-edge
                if len(scc) > 1:
                    sccs.append(scc)
                elif len(scc) == 1 and node in self._downstream.get(node, set()):
                    sccs.append(scc)

        for node_id in self._nodes:
            if node_id not in indices:
                strongconnect(node_id)

        # Extract structured cycle paths
        cycle_paths: List[List[str]] = []
        for scc in sccs:
            path = self._extract_cycle_path_from_scc(scc)
            cycle_paths.append(path)

        return cycle_paths

    def _extract_cycle_path_from_scc(self, scc: List[str]) -> List[str]:
        """Extracts an exact closed cycle traversal path from nodes in an SCC."""
        scc_set = set(scc)
        if len(scc) == 1:
            return [scc[0], scc[0]]

        start = scc[0]
        visited = []
        path = [start]
        curr = start

        while True:
            # Find next neighbor within SCC
            found = False
            for nxt in self._downstream.get(curr, set()):
                if nxt in scc_set:
                    if nxt == start and len(path) > 1:
                        path.append(start)
                        return path
                    if nxt not in path:
                        path.append(nxt)
                        curr = nxt
                        found = True
                        break
            if not found:
                # Fallback simple closed path
                return scc + [scc[0]]

    def compute_topological_plan(self) -> TopologicalPlan:
        """
        Executes Kahn's algorithm to compute linear order, parallel execution layers,
        and critical path lengths.
        Raises ValueError if graph contains cycles.
        """
        in_degrees: Dict[str, int] = {}
        for cid in self._nodes:
            # in-degree is count of valid upstream prerequisites
            in_degrees[cid] = len([u for u in self._upstream.get(cid, set()) if u in self._nodes])

        # Layer 0: all nodes with in_degree == 0
        current_layer = [cid for cid, deg in in_degrees.items() if deg == 0]
        # Sort current layer deterministically by priority_order, then ID
        current_layer.sort(key=lambda x: (self._nodes[x].priority_order, x))

        parallel_layers: List[List[str]] = []
        linear_order: List[str] = []

        temp_in_degrees = dict(in_degrees)

        while current_layer:
            parallel_layers.append(list(current_layer))
            next_layer: List[str] = []

            for u in current_layer:
                linear_order.append(u)
                for v in self._downstream.get(u, set()):
                    if v in temp_in_degrees:
                        temp_in_degrees[v] -= 1
                        if temp_in_degrees[v] == 0:
                            next_layer.append(v)

            next_layer.sort(key=lambda x: (self._nodes[x].priority_order, x))
            current_layer = next_layer

        if len(linear_order) < len(self._nodes):
            unprocessed = set(self._nodes.keys()) - set(linear_order)
            raise ValueError(f"Graph contains cycles or unresolved dependencies. Unprocessed nodes: {unprocessed}")

        # Compute critical path length (longest path from node to any sink)
        critical_paths = self._compute_critical_paths(linear_order)

        return TopologicalPlan(
            linear_order=linear_order,
            parallel_layers=parallel_layers,
            critical_path_lengths=critical_paths,
            in_degrees=in_degrees,
        )

    def _compute_critical_paths(self, reversed_topological_order: List[str]) -> Dict[str, int]:
        """Computes critical path distance to leaf for each node."""
        path_lengths: Dict[str, int] = {cid: 1 for cid in self._nodes}
        for u in reversed(reversed_topological_order):
            for v in self._downstream.get(u, set()):
                if v in path_lengths:
                    path_lengths[u] = max(path_lengths[u], 1 + path_lengths[v])
        return path_lengths

    def get_ready_components(self, completed_ids: Set[str]) -> List[str]:
        """
        Returns all component IDs that:
        1. Are currently in CREATED or PENDING_DEPS status.
        2. Have all upstream dependencies present in completed_ids.
        Sorted by priority_order (ascending: 0 is highest priority), then created_at.
        """
        ready: List[str] = []
        for cid, node in self._nodes.items():
            if node.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                upstream = self._upstream.get(cid, set())
                # Only check dependencies that exist in nodes
                valid_upstream = {u for u in upstream if u in self._nodes}
                if valid_upstream.issubset(completed_ids):
                    ready.append(cid)

        ready.sort(key=lambda x: (self._nodes[x].priority_order, self._nodes[x].created_at, x))
        return ready

    def get_downstream_dependents(self, component_id: str, transitive: bool = True) -> Set[str]:
        """
        Returns all direct (or transitive) downstream dependent component IDs.
        Used for cascade stalling when an upstream component fails or is quarantined.
        """
        if not transitive:
            return set(self._downstream.get(component_id, set()))

        visited: Set[str] = set()
        queue = collections.deque(self._downstream.get(component_id, set()))
        while queue:
            curr = queue.popleft()
            if curr not in visited and curr in self._nodes:
                visited.add(curr)
                for nxt in self._downstream.get(curr, set()):
                    if nxt not in visited:
                        queue.append(nxt)
        return visited

    def get_upstream_dependencies(self, component_id: str, transitive: bool = True) -> Set[str]:
        """Returns all direct (or transitive) upstream prerequisite component IDs."""
        if not transitive:
            return set(self._upstream.get(component_id, set()))

        visited: Set[str] = set()
        queue = collections.deque(self._upstream.get(component_id, set()))
        while queue:
            curr = queue.popleft()
            if curr not in visited and curr in self._nodes:
                visited.add(curr)
                for prq in self._upstream.get(curr, set()):
                    if prq not in visited:
                        queue.append(prq)
        return visited

    def resolve_cycles(self, policy: CycleResolutionPolicy) -> CycleResolutionResult:
        """
        Applies deterministic cycle resolution policy.
        """
        validation = self.validate_graph()
        if not validation.has_cycles:
            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=True,
                diagnostic_message="Graph is already acyclic.",
            )

        cycle_nodes_set: Set[str] = set()
        for cycle in validation.cycles:
            cycle_nodes_set.update(cycle)

        if policy == CycleResolutionPolicy.ABORT:
            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=False,
                stalled_components=list(cycle_nodes_set),
                diagnostic_message=f"Aborting pipeline: {len(validation.cycles)} cycle(s) detected.",
            )

        elif policy == CycleResolutionPolicy.SAFE_STALL:
            # Mark all cycle nodes and their downstream dependents as STALLED
            stalled_set = set(cycle_nodes_set)
            for cid in list(cycle_nodes_set):
                stalled_set.update(self.get_downstream_dependents(cid, transitive=True))

            for cid in stalled_set:
                if cid in self._nodes:
                    node = self._nodes[cid]
                    if node.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS, ComponentStatus.READY):
                        node.status = ComponentStatus.STALLED
                        node.error_log = "Stalled due to circular dependency participation or upstream cycle."

            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=False,
                stalled_components=list(stalled_set),
                diagnostic_message=f"Safe stall activated: {len(stalled_set)} components stalled.",
            )

        elif policy == CycleResolutionPolicy.FEEDBACK_ARC_SET_STUB:
            broken_edges: List[Tuple[str, str]] = []
            stubs: Dict[str, List[str]] = collections.defaultdict(list)

            # Heuristic FAS on each detected cycle
            for cycle in validation.cycles:
                if len(cycle) >= 2:
                    # Select the back edge (last node to first node, or lowest priority edge)
                    u = cycle[-2]
                    v = cycle[-1] if cycle[-1] != cycle[0] else cycle[0]
                    # Remove edge u -> v
                    self.remove_dependency(component_id=v, depends_on_id=u)
                    broken_edges.append((u, v))
                    stub_id = f"stub::{u}_for_{v}"
                    stubs[v].append(stub_id)

            # Re-validate
            post_validation = self.validate_graph()
            resolved = not post_validation.has_cycles

            return CycleResolutionResult(
                policy=policy,
                resolved_acyclic=resolved,
                broken_edges=broken_edges,
                injected_stubs=dict(stubs),
                diagnostic_message=f"FAS Stubbing applied: {len(broken_edges)} edge(s) broken, acyclic={resolved}.",
            )

        raise ValueError(f"Unknown cycle resolution policy: {policy}")

    def clone(self) -> "PipelineDAG":
        """Creates a deep copy of the DAG and its component states."""
        cloned = PipelineDAG()
        for cid, node in self._nodes.items():
            cloned_node = ComponentStateRecord.from_dict(node.to_dict())
            cloned.add_component(cloned_node)
        return cloned
```

---

## 4. Interaction Contracts & Downstream Milestone Integration

### 4.1 Interface Contract: `PipelineDAG` $\longleftrightarrow$ `ConcurrencyController` (M3)
The Concurrency Controller relies strictly on the following methods:
1. `get_ready_components(completed_ids: Set[str]) -> List[str]`: Evaluates in-degree readiness in $O(|V|)$ without race conditions.
2. `get_downstream_dependents(component_id: str) -> Set[str]`: Identifies nodes for cascade stalling when an upstream node fails or is quarantined.
3. `compute_topological_plan() -> TopologicalPlan`: Provides priority queue weights based on `critical_path_lengths`.

### 4.2 Interface Contract: `models.py` $\longleftrightarrow$ `StageMutex` (M3)
The Stage Mutex requires:
1. `LeaseToken.is_valid(current_time)`: Verified prior to admitting any worker action.
2. `LeaseToken.epoch`: Checked against the stage's internal `current_epoch` to reject fenced commits.
3. `StageEnum.linear_order()` and `next_stage()`: Governs the atomic 2-phase handover sequence ($S_1 \to Q_{S_2} \to S_2$).

### 4.3 Interface Contract: `models.py` $\longleftrightarrow$ `FaultTolerance` / `WASS` (M4)
The Write-Ahead State Store requires:
1. `StateTransitionEvent.to_dict()` and `_compute_hash()`: Serialized before committing state mutations.
2. `PipelineSnapshot.to_json()` / `from_json()`: Used for zero-corruption crash resumption.

---

## 5. Edge Cases & Verification Matrix for M1 & M2

| # | Test Category | Edge Case Scenario | Expected System Behavior | Invariant Verified |
|---|---------------|--------------------|--------------------------|---------------------|
| 1 | M1 / State | Invalid state transition (`COMPLETED` $\to$ `READY`) | Raises `ValueError`, state remains untouched | Finite State Machine Validity |
| 2 | M1 / Lease | Lease token expired ($t > t_{\text{expires}}$) | `is_valid()` returns `False`, `time_remaining()` returns `0.0` | Lease Exclusivity |
| 3 | M1 / Serialization | Full roundtrip `to_dict` $\to$ `from_dict` | Identical hash, types, and nested dict structures | WASS Replay Safety |
| 4 | M2 / Graph | Disconnected DAG ($C_1, C_2$ with no edges) | All components in Layer 0, topological sort succeeds | Dynamic Independence |
| 5 | M2 / Graph | Self-dependency ($C_A \to C_A$) | `validate_graph()` flags `self_dependencies=['C_A']`, `is_valid=False` | Irreflexivity |
| 6 | M2 / Graph | Phantom dependency ID ($C_A$ depends on `comp-999`) | `validate_graph()` flags `missing_dependencies={'C_A': ['comp-999']}` | Referential Integrity |
| 7 | M2 / Cycle | 3-Node Cycle ($A \to B \to C \to A$) | Tarjan detects SCC $\{A, B, C\}$, extracts path `[A, B, C, A]` | Cycle Isolation |
| 8 | M2 / Cycle | Diamond Graph ($A \to B, A \to C, B \to D, C \to D$) | Valid acyclic DAG; $D$ is ready only when both $B$ and $C$ complete | Topological In-Degree Precedence |
| 9 | M2 / Policy | Safe Stall on Cycle | Cyclical nodes transitioned to `STALLED`, independent subgraphs unaffected | Fault Containment |
| 10| M2 / Policy | FAS Stubbing on Cycle | Broken edge removed, stub injected, DAG becomes valid acyclic | Self-Healing Recovery |

---

## 6. Implementation Plan & Developer Checklist

### For Milestone M1 Developer:
- [ ] Create `src/autodev_pipeline/models.py` matching the exact class definitions in Section 2.
- [ ] Ensure all enums (`StageEnum`, `ComponentStatus`, `StageLockStatus`, `CycleResolutionPolicy`, `TransitionEventType`) use `str, Enum` for seamless JSON serialization.
- [ ] Implement `LeaseToken` with immutable fields and `is_valid()`, `renew()`, `to_dict()`, `from_dict()`.
- [ ] Implement `ComponentStateRecord` with `VALID_TRANSITIONS` guard checks, `transition_to()`, and revision counters.
- [ ] Implement `PipelineConfig`, `StateTransitionEvent` (with SHA-256 hash computation), and `PipelineSnapshot`.

### For Milestone M2 Developer:
- [ ] Create `src/autodev_pipeline/dag_engine.py` matching Section 3.
- [ ] Implement `PipelineDAG` with internal `_downstream`, `_upstream`, and `_nodes` tracking.
- [ ] Implement `validate_graph()` checking self-deps, missing deps, and cycle detection.
- [ ] Implement `detect_cycles_tarjan()` with exact cycle path extraction.
- [ ] Implement `compute_topological_plan()` with Kahn's algorithm, layer partitioning, and critical path depth.
- [ ] Implement `get_ready_components()`, `get_downstream_dependents()`, `get_upstream_dependencies()`.
- [ ] Implement `resolve_cycles()` with `ABORT`, `SAFE_STALL`, and `FEEDBACK_ARC_SET_STUB`.

---
*End of Technical Specification for M1 & M2.*
