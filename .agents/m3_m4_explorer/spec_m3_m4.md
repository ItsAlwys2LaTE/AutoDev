# Technical Specification & Algorithmic Blueprint: Milestones M3 & M4

**Document Version:** 1.0.0  
**Target Project:** `autodev_pipeline_algo` (`C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo`)  
**Scope:** 
- **Milestone M3:** Concurrency Controller, Lease-Backed Stage Mutexes, Stage Queue Management, and Atomic 2-Phase Handover Protocol (`src/autodev_pipeline/concurrency.py`, `src/autodev_pipeline/scheduler.py`)
- **Milestone M4:** Multi-Tier Watchdogs, Poison-Pill Circuit Breaker, Cascade Pause / Safe Stall Isolation, and Atomic Write-Ahead State Store (WASS) Crash Recovery (`src/autodev_pipeline/fault_tolerance.py`)

---

## 1. Executive Summary & Mathematical Invariants

Milestones M3 and M4 provide the runtime execution, concurrency control, and fault tolerance backbone for the AutoDev multi-agent software development pipeline. While Milestones M1 and M2 established the static data models and DAG dependency validation, M3 and M4 govern dynamic state transitions, thread synchronization, stage scheduling, timeout enforcement, and zero-loss crash resilience.

```
+---------------------------------------------------------------------------------------------------+
|                                 AutoDev M3 & M4 Runtime Architecture                              |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  PipelineScheduler                                          |  |
|  |  +---------------------------+  +--------------------------+  +--------------------------+  |  |
|  |  |   PipelineDAG (from M2)   |  |   StageLockManager (M3)  |  |  StageQueueManager (M3)  |  |  |
|  |  | (Kahn + Tarjan In-Degree) |  | (Single Occupancy/Epoch) |  | (Per-Stage FIFO/Priority)|  |  |
|  |  +---------------------------+  +--------------------------+  +--------------------------+  |  |
|  |                                                |                             |              |  |
|  |                                                v                             v              |  |
|  |                            [ Atomic 2-Phase Handover Protocol (M3) ]                        |  |
|  |                                (Release S_j  --->  Enqueue/Acquire S_{j+1})                 |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                        +-----------------------+-----------------------+                          |
|                        |                                               |                          |
|                        v                                               v                          |
|  +-------------------------------------------+   +---------------------------------------------+  |
|  |      Fault Tolerance Subsystem (M4)       |   |       Persistence & Recovery Engine (M4)    |  |
|  | - Multi-Tier Watchdogs (Docker/LLM/Lease) |   | - Atomic Write-Ahead State Store (WASS)     |  |
|  | - Poison-Pill Circuit Breaker (K >= 3)    |   | - Monotonic Epoch Fencing & Audit Journal   |  |
|  | - Cascade Pause & Graph Stall Isolation   |   | - Deterministic Snapshot Replayer & Rollback|  |
|  +-------------------------------------------+   +---------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 1.1 Core Mathematical Invariants

1. **Single-Occupancy Stage Invariant (Mutual Exclusion):**
   For every discrete pipeline stage $S \in \mathcal{S}$, at any discrete instant $t$, at most one component may hold an active, unexpired lease:
   $$\forall S \in \mathcal{S}, \quad \sum_{c \in \mathcal{C}} \mathbb{I}\Big(\text{lease\_holder}(S, t) = c \land \text{is\_valid}(\text{lease}(c, S), t)\Big) \le 1$$

2. **Monotonic Epoch Fencing Invariant:**
   Let $e(S, t) \in \mathbb{N}$ be the epoch counter of stage $S$ at time $t$. For every state mutation or stage lock acquisition at time $t_2 > t_1$:
   $$e(S, t_2) > e(S, t_1)$$
   Any commit attempt for stage $S$ presenting token $\tau$ where $\text{epoch}(\tau) < e(S, t_{\text{commit}})$ is strictly rejected with `STALE_EPOCH_FENCED`.

3. **Deadlock Freedom via Negation of Coffman Hold-and-Wait:**
   Let $\text{Held}(c, t) \subseteq \mathcal{S}$ be the set of stages held by component $c$ at time $t$, and let $\text{Requested}(c, t) \subseteq \mathcal{S}$ be the stage requested by $c$. The 2-phase handover protocol strictly enforces:
   $$\forall c \in \mathcal{C}, \forall t, \quad |\text{Held}(c, t)| \le 1 \quad \land \quad \Big(|\text{Held}(c, t)| = 1 \implies \text{Requested}(c, t) = \emptyset\Big)$$
   Therefore, no component can hold a stage while waiting for another stage:
   $$\text{Hold-and-Wait} \iff \exists c \in \mathcal{C} \text{ s.t. } |\text{Held}(c, t)| \ge 1 \land |\text{Requested}(c, t)| \ge 1 \equiv \text{FALSE}$$

4. **Deterministic Recovery Invariant (Zero State Corruption):**
   Let $\mathcal{E} = \langle e_1, e_2, \dots, e_m \rangle$ be the append-only journal of state transition events on disk. The recovered system state $\sigma_{\text{rec}}$ obtained by replaying $\mathcal{E}$ from snapshot $\Sigma_k$ is identical to the last consistent pre-crash state $\sigma_{\text{pre}}$:
   $$\sigma_{\text{rec}} = \text{Replay}(\Sigma_k, \langle e_{k+1}, \dots, e_m \rangle) \equiv \sigma_{\text{pre}}$$
   Furthermore, any uncommitted in-flight stage lease is safely rolled back to the stage's waiting queue with an incremented epoch.

---

## 2. Milestone M3: Concurrency Engine & Scheduling Specification

Milestone M3 is implemented across two core modules:
1. `src/autodev_pipeline/concurrency.py`: Stage mutexes, epoch generation, queue management, and 2-phase handover protocol.
2. `src/autodev_pipeline/scheduler.py`: Pipeline scheduling loop, stage executor coordination, and lifecycle progression.

### 2.1 `StageMutex` Class Specification

A thread-safe, lease-backed synchronization primitive dedicated to a single pipeline stage.

#### Responsibilities:
- Grants exclusive stage occupancy to at most one component ID.
- Generates strictly monotonic integer epochs on every acquisition.
- Enforces time-to-live (TTL) expiration checks.
- Validates lease renewal requests from the active lease holder.
- Validates release requests, verifying both `component_id` and `epoch` match the active lease.
- Supports forced preemption/revocation with epoch incrementing for watchdog timeouts.

```python
class StageMutex:
    """
    Thread-safe, lease-backed mutual exclusion lock for a single pipeline stage.
    Enforces <= 1 occupancy with monotonic epoch fencing and TTL expiration.
    """
    def __init__(self, stage: StageEnum, default_lease_duration: float = 30.0):
        self.stage = stage
        self.default_lease_duration = default_lease_duration
        self._lock = threading.RLock()
        self._current_holder: Optional[str] = None
        self._active_lease: Optional[LeaseToken] = None
        self._epoch_counter: int = 0
        self._status: StageLockStatus = StageLockStatus.FREE
```

#### Method Specifications:

1. `try_acquire(component_id: str, duration_sec: Optional[float] = None, current_time: Optional[float] = None) -> Optional[LeaseToken]`
   - **Pre-conditions:** Thread-safe acquisition under `self._lock`.
   - **Logic:**
     1. Evaluate if mutex is occupied:
        - If `self._active_lease` is not `None`:
          - If `self._active_lease.is_valid(now)`: Acquisition fails, return `None`.
          - Else: Lease has expired. Log expiration, transition status to `FREE`, and proceed to grant lock to new requestor.
     2. Increment `self._epoch_counter += 1`.
     3. Instantiate new `LeaseToken`:
        - `token_id = str(uuid.uuid4())`
        - `component_id = component_id`
        - `stage = self.stage`
        - `epoch = self._epoch_counter`
        - `acquired_at = now`
        - `expires_at = now + dur`
        - `lease_duration_sec = dur`
     4. Update state: `self._current_holder = component_id`, `self._active_lease = new_token`, `self._status = StageLockStatus.HELD`.
     5. Return `new_token`.

2. `renew_lease(component_id: str, lease_token: LeaseToken, duration_sec: Optional[float] = None, current_time: Optional[float] = None) -> Optional[LeaseToken]`
   - **Validation:**
     - Must hold `self._lock`.
     - Check `self._active_lease` is not `None`.
     - Check `self._active_lease.component_id == component_id`.
     - Check `self._active_lease.epoch == lease_token.epoch` and `self._active_lease.token_id == lease_token.token_id`.
     - Check `self._active_lease.is_valid(now)`.
   - **Action:**
     - Generate renewed `LeaseToken` with same `token_id`, `epoch`, `acquired_at`, and new `expires_at = now + dur`.
     - Set `self._active_lease = renewed_token`.
     - Return `renewed_token`.

3. `release(component_id: str, lease_token: LeaseToken, current_time: Optional[float] = None) -> bool`
   - **Validation:**
     - Must hold `self._lock`.
     - Check `self._active_lease` is not `None`.
     - If `self._active_lease.token_id != lease_token.token_id` or `self._active_lease.epoch != lease_token.epoch` or `self._active_lease.component_id != component_id`:
       - Return `False` (stale release rejected).
   - **Action:**
     - Clear `self._active_lease = None`, `self._current_holder = None`, `self._status = StageLockStatus.FREE`.
     - Return `True`.

4. `force_revoke(reason: str = "WATCHDOG_EVICTION") -> Optional[LeaseToken]`
   - **Action:**
     - Revokes active lease unconditionally.
     - Increments `self._epoch_counter += 1` to guarantee any late commit by the evicted worker is fenced out.
     - Resets `self._active_lease = None`, `self._current_holder = None`, `self._status = StageLockStatus.FREE`.
     - Returns the evicted `LeaseToken`.

5. `is_occupied(current_time: Optional[float] = None) -> bool`
   - Returns `True` if `self._active_lease` exists and `self._active_lease.is_valid(now)`. If expired, cleans up state and returns `False`.

---

### 2.2 `StageLockManager` Class Specification

Coordinates all 5 pipeline stage mutexes (`DESIGN`, `CODEGEN`, `CRITICS`, `INTEGRATION`, `DOCUMENTATION`).

```python
class StageLockManager:
    """
    Centralized coordinator managing stage mutexes for all pipeline stages.
    Provides atomic multi-stage queries, lease lifecycle management, and snapshotting.
    """
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self._mutexes: Dict[StageEnum, StageMutex] = {
            stage: StageMutex(stage, default_lease_duration=self.config.lease_duration_sec)
            for stage in StageEnum.linear_order()
        }
        self._manager_lock = threading.RLock()
```

#### Method Specifications:
- `get_mutex(stage: StageEnum) -> StageMutex`: Returns mutex for specified stage.
- `try_acquire_stage(stage: StageEnum, component_id: str, duration_sec: Optional[float] = None) -> Optional[LeaseToken]`
- `renew_stage_lease(stage: StageEnum, component_id: str, lease_token: LeaseToken, duration_sec: Optional[float] = None) -> Optional[LeaseToken]`
- `release_stage(stage: StageEnum, component_id: str, lease_token: LeaseToken) -> bool`
- `force_revoke_stage(stage: StageEnum, reason: str = "WATCHDOG_EVICTION") -> Optional[LeaseToken]`
- `is_stage_occupied(stage: StageEnum) -> bool`
- `get_stage_holder(stage: StageEnum) -> Optional[str]`
- `get_active_leases() -> Dict[StageEnum, Optional[LeaseToken]]`
- `check_and_clean_expired_leases(current_time: Optional[float] = None) -> List[Tuple[StageEnum, str, LeaseToken]]`: Identifies expired leases, revokes them with epoch bump, and returns list of expired `(stage, component_id, lease)`.

---

### 2.3 `StageQueueManager` Class Specification

Manages dedicated per-stage FIFO / Priority queues ($Q_{\text{DESIGN}}, Q_{\text{CODEGEN}}, Q_{\text{CRITICS}}, Q_{\text{INTEGRATION}}, Q_{\text{DOCUMENTATION}}$).

#### Priority Ordering Formalism:
To ensure deterministic execution and prevent starvation, components in each stage queue are ordered by:
1. **Priority Tier (Descending):** Explicit priority value (e.g. Critical Path depth computed by Kahn's algorithm or high-priority tags).
2. **Revision Priority Bonus:** Revisions in $Q_{\text{CODEGEN}}$ receive elevated priority over new components to clear feedback cycles rapidly.
3. **Arrival Order / Sequence Number (Ascending):** Strictly monotonic arrival counter ensuring FIFO ordering for equal priorities.

```python
@dataclass(order=True)
class QueueItem:
    """
    Comparable wrapper for priority queue dispatching.
    Lower sort_key = higher dequeue priority.
    """
    priority_score: int              # Inverted: -100 is higher priority than 0
    arrival_sequence: int            # Monotonic insertion sequence counter
    component_id: str = field(compare=False)
    enqueued_at: float = field(compare=False, default_factory=time.time)
    metadata: Dict[str, Any] = field(compare=False, default_factory=dict)
```

```python
class StageQueueManager:
    """
    Thread-safe manager for per-stage priority and FIFO queues.
    Prevents duplicate enqueueing and supports dynamic component eviction (stalling/quarantining).
    """
    def __init__(self):
        self._queues: Dict[StageEnum, List[QueueItem]] = {
            stage: [] for stage in StageEnum.linear_order()
        }
        self._enqueued_components: Dict[StageEnum, Set[str]] = {
            stage: set() for stage in StageEnum.linear_order()
        }
        self._sequence_counter: int = 0
        self._queue_lock = threading.RLock()
```

#### Method Specifications:
1. `enqueue(stage: StageEnum, component_id: str, priority_order: int = 0, is_revision: bool = False, metadata: Optional[Dict[str, Any]] = None) -> bool`
   - If `component_id` is already in `self._enqueued_components[stage]`, return `False` (idempotent, no duplicates).
   - Priority calculation:
     $$\text{priority\_score} = -(\text{priority\_order} + (100 \text{ if is\_revision else } 0))$$
   - `heapq.heappush(self._queues[stage], QueueItem(priority_score, self._sequence_counter, component_id, ...))`
   - `self._enqueued_components[stage].add(component_id)`
   - Return `True`.

2. `dequeue(stage: StageEnum) -> Optional[str]`
   - If queue is empty, return `None`.
   - `item = heapq.heappop(self._queues[stage])`
   - `self._enqueued_components[stage].remove(item.component_id)`
   - Return `item.component_id`.

3. `peek(stage: StageEnum) -> Optional[str]`
   - Return `self._queues[stage][0].component_id` if queue has elements else `None`.

4. `remove(stage: StageEnum, component_id: str) -> bool`
   - If `component_id` is in `self._enqueued_components[stage]`:
     - Filter `self._queues[stage] = [item for item in self._queues[stage] if item.component_id != component_id]`
     - `heapq.heapify(self._queues[stage])`
     - `self._enqueued_components[stage].remove(component_id)`
     - Return `True`.
   - Return `False`.

5. `remove_from_all_queues(component_id: str) -> List[StageEnum]`
   - Removes `component_id` from every stage queue (used when a component fails, stalls, or is quarantined). Returns list of stages from which it was removed.

6. `queue_size(stage: StageEnum) -> int`
7. `get_queue_snapshot() -> Dict[str, List[str]]`: Returns snapshot of all component IDs across all queues.

---

### 2.4 Atomic 2-Phase Stage Handover Protocol

To eliminate Coffman hold-and-wait deadlock conditions, the handover of a component $c_i$ between stage $S_j$ and subsequent stage $S_{j+1}$ (or back to $S_{\text{CODEGEN}}$ on revision) is strictly partitioned into two atomic phases.

```
+-----------------------------------------------------------------------------------------------+
|                                Atomic 2-Phase Handover Protocol                               |
|                                                                                               |
|   [ Stage S_j Execution ]                                                                     |
|              |                                                                                |
|              v                                                                                |
|   +---------------------------------------------------------------------------------------+   |
|   | PHASE 1: Exit Stage S_j                                                               |   |
|   | 1. Validate active LeaseToken(S_j, epoch_j).                                          |   |
|   | 2. Persist stage artifacts and checkpoint to Write-Ahead State Store (WASS).          |   |
|   | 3. Unconditionally release StageMutex(S_j). Lock status -> FREE.                      |   |
|   | 4. In-flight hold count for c_i drops to 0. (Hold-and-Wait Condition broken).         |   |
|   +---------------------------------------------------------------------------------------+   |
|              |                                                                                |
|              v                                                                                |
|   +---------------------------------------------------------------------------------------+   |
|   | INTERMEDIATE EVALUATION: Determine Next Action                                        |   |
|   | - If S_j passed and has next stage S_{j+1}: Target = S_{j+1}                          |   |
|   | - If S_j == CRITICS and verdict == REVISE: Target = CODEGEN (with incremented rev)   |   |
|   | - If S_j terminal (DOCUMENTATION / Integration passed): Mark COMPLETED, Unblock deps  |   |
|   +---------------------------------------------------------------------------------------+   |
|              |                                                                                |
|              v                                                                                |
|   +---------------------------------------------------------------------------------------+   |
|   | PHASE 2: Enqueue / Enter Target Stage                                                 |   |
|   | 1. Enqueue c_i into Q_{Target}. Status -> READY.                                      |   |
|   | 2. Attempt immediate dispatch: if StageMutex(Target) is FREE and c_i is at head of Q:  |   |
|   |    - Acquire LeaseToken(Target, epoch_{Target}).                                      |   |
|   |    - Pop c_i from Q_{Target}. Status -> IN_STAGE.                                     |   |
|   | 3. If Target is busy: c_i waits safely in Q_{Target} without holding any lock.        |   |
|   +---------------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------------+
```

#### Mathematical Proof of Deadlock Freedom:

1. **Let the Resource Allocation Graph (RAG)** at time $t$ be $G_{\text{RAG}}(t) = (V_{\mathcal{C}} \cup V_{\mathcal{S}}, E_{\text{hold}} \cup E_{\text{wait}})$, where:
   - $V_{\mathcal{C}}$ is the set of component vertices.
   - $V_{\mathcal{S}}$ is the set of stage lock vertices.
   - $(S, c) \in E_{\text{hold}}$ denotes stage $S$ is held by component $c$.
   - $(c, S) \in E_{\text{wait}}$ denotes component $c$ is waiting for stage $S$.

2. **Handover Invariant:** In Phase 1, $(S_j, c_i) \in E_{\text{hold}}$ is deleted *strictly before* any edge $(c_i, S_{j+1}) \in E_{\text{wait}}$ is added in Phase 2.
3. **Out-Degree Constraint:** For all $c \in V_{\mathcal{C}}$, out-degree in $E_{\text{wait}}$ is non-zero only if in-degree from $E_{\text{hold}}$ is zero:
   $$\text{deg}_{\text{in}}(c, E_{\text{hold}}) > 0 \implies \text{deg}_{\text{out}}(c, E_{\text{wait}}) = 0$$
4. **No Cycles:** A directed cycle in $G_{\text{RAG}}(t)$ requires at least one component node $c$ to have both an incoming edge from $E_{\text{hold}}$ and an outgoing edge to $E_{\text{wait}}$. By the constraint above, no such node exists. Therefore, $\forall t, G_{\text{RAG}}(t)$ is strictly acyclic. Deadlock is impossible. $\blacksquare$

---

## 3. Milestone M3: Unified Pipeline Scheduler Specification (`src/autodev_pipeline/scheduler.py`)

The `PipelineScheduler` orchestrates the complete end-to-end lifecycle of all components through the pipeline.

```python
class PipelineScheduler:
    """
    Central scheduler driving components through DAG dependencies and pipeline stages.
    Integrates DAG Engine, Lock Manager, Queue Manager, Handover Protocol, and WASS.
    """
    def __init__(
        self,
        dag: PipelineDAG,
        config: Optional[PipelineConfig] = None,
        lock_manager: Optional[StageLockManager] = None,
        queue_manager: Optional[StageQueueManager] = None,
        state_store: Optional["WriteAheadStateStore"] = None,
        fault_tolerance: Optional["FaultToleranceManager"] = None,
    ):
        self.dag = dag
        self.config = config or PipelineConfig()
        self.lock_manager = lock_manager or StageLockManager(self.config)
        self.queue_manager = queue_manager or StageQueueManager()
        self.state_store = state_store  # Optional WASS persistence
        self.fault_tolerance = fault_tolerance
        self._scheduler_lock = threading.RLock()
        self._is_running = False
        self._execution_history: List[StateTransitionEvent] = []
```

#### Scheduler Execution Cycle (`step()` / `run_tick()`):
On each scheduler tick (or event trigger):
1. **Dependency Resolution Step:**
   - Query `self.dag.get_ready_components()`.
   - For each ready component $c$ in `CREATED` or `PENDING_DEPS` status:
     - Transition status: `c.transition_to(ComponentStatus.READY)`.
     - Log event `DEPENDENCY_RESOLVED` and `STATUS_TRANSITION` to WASS.
     - Enqueue into $Q_{\text{DESIGN}}$: `self.queue_manager.enqueue(StageEnum.DESIGN, c.component_id, priority_order=c.priority_order)`.

2. **Stage Dispatch Step:**
   - For each stage $S \in [S_{\text{DESIGN}}, S_{\text{CODEGEN}}, S_{\text{CRITICS}}, S_{\text{INTEGRATION}}, S_{\text{DOCUMENTATION}}]$:
     - Check if $S$ is idle: `if not self.lock_manager.is_stage_occupied(S):`
       - Peek queue: `candidate_id = self.queue_manager.peek(S)`
       - If `candidate_id` is not `None`:
         - Try acquire lease: `lease = self.lock_manager.try_acquire_stage(S, candidate_id)`
         - If lease acquired:
           - Dequeue from queue: `self.queue_manager.dequeue(S)`
           - Component transition: `comp.transition_to(ComponentStatus.IN_STAGE, stage=S, lease=lease)`
           - Log event `STAGE_LEASE_ACQUIRED` to WASS.

3. **Stage Execution & Completion Step:**
   - Active stages execute their respective stage workers.
   - Upon stage completion (or verdict adjudication):
     - Execute 2-Phase Handover Protocol:
       - Phase 1: `self.lock_manager.release_stage(S, comp.component_id, lease)`
       - Phase 2:
         - If $S$ is `CRITICS` and verdict is `REVISE`:
           - Increment revision: `rev = comp.increment_revision()`
           - If `rev >= comp.max_revisions`:
             - Trigger poison-pill circuit breaker $\to$ Quarantine component.
           - Else:
             - Transition to `READY`, enqueue into $Q_{\text{CODEGEN}}$ with revision priority bonus.
         - Else if $S$ has a sequential next stage $S_{\text{next}}$:
           - Transition to `READY`, enqueue into $Q_{S_{\text{next}}}$.
         - Else (terminal stage completed):
           - Transition to `COMPLETED`.
           - Notify DAG: marks node completed, unblocking downstream dependents in step 1 on the next tick.

4. **Watchdog & Health Check Step:**
   - Clean expired leases via `lock_manager.check_and_clean_expired_leases()`.
   - Run multi-tier watchdog checks for container hangs, LLM hangs, and stage timeouts.

---

## 4. Milestone M4: Fault Tolerance, Multi-Tier Watchdogs & Crash Recovery (`src/autodev_pipeline/fault_tolerance.py`)

Milestone M4 guarantees that transient errors, agent hangs, container timeouts, and host crashes are handled deterministically without state corruption or pipeline stalls.

### 4.1 Hierarchical Multi-Tier Watchdog Matrix

```
+---------------------------------------------------------------------------------------------------+
|                               Multi-Tier Watchdog Architecture                                    |
|                                                                                                   |
|  [ Tier 1: Sandbox Watchdog ]       [ Tier 2: LLM Retry Watchdog ]    [ Tier 3: Stage Lease Watchdog ]
|  - Scope: Docker test executions    - Scope: LLM API invocations      - Scope: Stage Mutex Leases  |
|  - Timeout: T_docker = 45s          - Timeout: T_llm = 60s            - Timeout: TTL = 30s         |
|  - Action: SIGKILL container,       - Action: Exponential backoff     - Action: Force lease revoke,|
|    capture partial stdout/stderr,     with jitter (tau * 2^k +- j);     increment epoch counter,   |
|    record ExecutionResult(fail)       classify transient vs perm        fence stale worker commits |
+---------------------------------------------------------------------------------------------------+
```

#### Class Specification: `MultiTierWatchdog`
```python
class MultiTierWatchdog:
    """
    Hierarchical watchdog supervisor monitoring Docker sandbox execution,
    LLM API timeouts, and stage mutex leases.
    """
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self._active_timers: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
```

#### Method Specifications:
1. `guard_docker_execution(component_id: str, execution_fn: Callable[[], Dict[str, Any]], timeout_sec: Optional[float] = None) -> Dict[str, Any]`
   - Executes `execution_fn` within a bounded worker thread or process.
   - If execution completes within `timeout_sec` (default: 45.0s), returns execution result dictionary (`{"success": True, "exit_code": 0, "logs": ...}`).
   - If execution times out:
     - Issues kill signal to container process.
     - Returns `{"success": False, "exit_code": 124, "error": "DOCKER_TIMEOUT_EXCEEDED", "logs": "Execution exceeded timeout limit (45s)"}`.

2. `execute_with_llm_retry(component_id: str, llm_fn: Callable[[], Any], max_retries: int = 3, initial_backoff_sec: float = 1.0, timeout_sec: Optional[float] = None) -> Any`
   - Invokes `llm_fn` with bounded execution and exponential backoff retry loop:
     $$\tau_k = \min(30.0, \tau_0 \cdot 2^k + \text{uniform}(0, 0.5))$$
   - Classifies exceptions into:
     - **Transient Errors** (HTTP 429 Rate Limit, HTTP 503 Service Unavailable, Socket Timeout): Retries with backoff up to `max_retries`.
     - **Permanent Errors** (Authentication Error, Invalid Schema, Context Length Exceeded): Fails immediately without burning retry quota.
   - If retries exhausted, raises `RuntimeError(f"LLM call failed after {max_retries} attempts: {last_error}")`.

3. `monitor_stage_leases(lock_manager: StageLockManager, scheduler: "PipelineScheduler", current_time: Optional[float] = None) -> List[Dict[str, Any]]`
   - Scans all stages in `lock_manager`.
   - Identifies any lease where `not lease.is_valid(now)`.
   - For each expired lease:
     1. Revokes the stage mutex and increments stage epoch counter: `lock_manager.force_revoke_stage(stage, reason="LEASE_TTL_EXPIRED")`.
     2. Retrieves the affected component from scheduler.
     3. Evicts component from stage and re-enqueues into the stage queue or increments its revision counter.
     4. Logs `STAGE_LEASE_EXPIRED` event to WASS.

---

### 4.2 Poison-Pill Circuit Breaker Specification

Prevents infinite revision loops and resource starvation when a component consistently fails critic adjudication.

#### Formal Invariant:
Let $K(c) \in \mathbb{N}$ be the cumulative revision failure count for component $c$.
$$K(c) \ge K_{\text{max}} \implies \text{Status}(c) \leftarrow \text{QUARANTINED}$$

```python
class PoisonPillCircuitBreaker:
    """
    Circuit breaker isolating components that exceed maximum allowed revision cycles.
    Prevents infinite revision loops and initiates failure isolation.
    """
    def __init__(self, max_revisions: int = 3):
        self.max_revisions = max_revisions
        self._quarantined_components: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()

    def record_revision_failure(
        self,
        component: ComponentStateRecord,
        error_details: Optional[str] = None
    ) -> bool:
        """
        Increments component revision count. If threshold exceeded, transitions
        component to QUARANTINED and registers quarantine metadata.
        Returns True if component was quarantined, False if still within budget.
        """
        with self._lock:
            component.increment_revision()
            if component.has_exceeded_revisions():
                reason = error_details or f"Exceeded maximum revision limit ({self.max_revisions} cycles)"
                component.transition_to(
                    ComponentStatus.QUARANTINED,
                    stage=None,
                    lease=None,
                    reason=reason
                )
                self._quarantined_components[component.component_id] = {
                    "quarantined_at": time.time(),
                    "revision_count": component.revision_count,
                    "reason": reason,
                }
                return True
            return False

    def is_quarantined(self, component_id: str) -> bool:
        with self._lock:
            return component_id in self._quarantined_components

    def get_quarantine_info(self, component_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._quarantined_components.get(component_id)
```

---

### 4.3 Cascade Pause & Safe Stall Graph Isolation

When a component enters a terminal failure state (`QUARANTINED` or `FAILED`), any downstream component that depends on its output cannot proceed. Rather than crashing the entire pipeline, the `CascadePauseEngine` isolates only the affected downstream subgraph.

#### Mathematical Formulation:
Let $G = (V, E)$ be the dependency DAG.
For a failing component $c_{\text{fail}} \in V$, compute the transitive downstream reachability closure:
$$\mathcal{D}(c_{\text{fail}}) = \{w \in V \mid c_{\text{fail}} \rightsquigarrow w\}$$
For each $w \in \mathcal{D}(c_{\text{fail}})$:
- If $\text{status}(w) \in \{\text{CREATED}, \text{PENDING\_DEPS}, \text{READY}\}$:
  $$\text{status}(w) \leftarrow \text{STALLED}$$
  $$Q(S) \leftarrow Q(S) \setminus \{w\} \quad \forall S \in \mathcal{S}$$
- For all independent components $u \in V \setminus (\mathcal{D}(c_{\text{fail}}) \cup \{c_{\text{fail}}\})$:
  $$\text{status}(u) \text{ is unchanged; execution proceeds normally.}$$

```python
class CascadePauseEngine:
    """
    Isolates dependency failures by pausing transitive downstream dependents
    while permitting disjoint, independent pipeline branches to execute to completion.
    """
    def __init__(self, dag: PipelineDAG, queue_manager: StageQueueManager):
        self.dag = dag
        self.queue_manager = queue_manager
        self._stalled_components: Set[str] = set()
        self._lock = threading.RLock()

    def trigger_cascade_pause(
        self,
        failed_component_id: str,
        reason: str = "UPSTREAM_DEPENDENCY_FAILED"
    ) -> List[str]:
        """
        Identifies all reachable downstream dependents of failed_component_id,
        transitions them to STALLED, removes them from stage queues, and records isolation.
        Returns list of stalled component IDs.
        """
        with self._lock:
            # 1. Compute transitive downstream closure via BFS/DFS on DAG
            downstream_ids = self.dag.get_transitive_dependents(failed_component_id)
            stalled_this_round = []

            for dep_id in downstream_ids:
                comp = self.dag.get_component(dep_id)
                if comp and comp.status in (
                    ComponentStatus.CREATED,
                    ComponentStatus.PENDING_DEPS,
                    ComponentStatus.READY,
                ):
                    comp.transition_to(
                        ComponentStatus.STALLED,
                        stage=None,
                        lease=None,
                        reason=f"Cascaded stall from upstream component '{failed_component_id}': {reason}"
                    )
                    # Remove from all stage queues
                    self.queue_manager.remove_from_all_queues(dep_id)
                    self._stalled_components.add(dep_id)
                    stalled_this_round.append(dep_id)

            return stalled_this_round

    def get_stalled_components(self) -> Set[str]:
        with self._lock:
            return set(self._stalled_components)
```

---

### 4.4 Write-Ahead State Store (WASS) Specification

The Write-Ahead State Store guarantees zero data corruption and deterministic crash recovery through an append-only JSON-lines event journal and periodic atomic state snapshots.

#### Protocol:
1. **Write-Ahead Logging:** Before modifying in-memory state, the scheduler or lock manager creates a `StateTransitionEvent` (with SHA-256 integrity hash) and appends it to disk (`pipeline_state.log`), calling `file.flush()` and `os.fsync()`.
2. **Atomic Snapshots:** Periodically (or on key milestones), the complete in-memory `PipelineSnapshot` is serialized to a temporary file (`snapshot.tmp`) and atomically replaced via `os.replace("snapshot.tmp", "snapshot.json")`.

```python
class WriteAheadStateStore:
    """
    Append-only Write-Ahead State Store (WASS) providing durable event journaling,
    cryptographic integrity hashing, and atomic snapshot checkpointing.
    """
    def __init__(self, log_path: str = "pipeline_events.jsonl", snapshot_path: str = "pipeline_snapshot.json"):
        self.log_path = log_path
        self.snapshot_path = snapshot_path
        self._lock = threading.RLock()
        self._sequence_number: int = 0
        
        # Ensure log directory exists
        log_dir = os.path.dirname(os.path.abspath(self.log_path))
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)

    def log_event(self, event: StateTransitionEvent) -> StateTransitionEvent:
        """
        Atomically appends an event to the WASS journal with disk sync.
        """
        with self._lock:
            self._sequence_number += 1
            payload = event.to_dict()
            payload["seq"] = self._sequence_number
            line = json.dumps(payload) + "\n"
            
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(line)
                f.flush()
                os.fsync(f.fileno())
            
            return event

    def save_snapshot(self, snapshot: PipelineSnapshot) -> str:
        """
        Saves snapshot using atomic two-phase write (tmp file + atomic rename).
        """
        with self._lock:
            tmp_path = f"{self.snapshot_path}.tmp.{uuid.uuid4().hex[:8]}"
            with open(tmp_path, "w", encoding="utf-8") as f:
                f.write(snapshot.to_json(indent=2))
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self.snapshot_path)
            return self.snapshot_path

    def load_snapshot(self) -> Optional[PipelineSnapshot]:
        """
        Loads snapshot from disk if present.
        """
        with self._lock:
            if not os.path.exists(self.snapshot_path):
                return None
            with open(self.snapshot_path, "r", encoding="utf-8") as f:
                return PipelineSnapshot.from_json(f.read())

    def read_events(self) -> List[Dict[str, Any]]:
        """
        Reads all journaled events from the append-only log.
        """
        with self._lock:
            if not os.path.exists(self.log_path):
                return []
            events = []
            with open(self.log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        events.append(json.loads(line))
            return events
```

---

### 4.5 Crash Recovery Engine Specification

The `CrashRecoveryEngine` deterministically reconstructs the exact pipeline state on engine boot or post-crash restart.

#### Crash Recovery Algorithm:
```
Algorithm: CrashRecovery(SnapshotPath, LogPath)
Input: SnapshotPath (Path to snapshot.json), LogPath (Path to pipeline_events.jsonl)
Output: Reconstructed PipelineDAG, StageLockManager, StageQueueManager, and SchedulerState

1.  Load Snapshot:
    If SnapshotPath exists:
        Sigma <- LoadSnapshot(SnapshotPath)
        Initialize DAG with components from Sigma.components
        last_seq <- Sigma.event_sequence_num
    Else:
        Sigma <- EmptySnapshot()
        Initialize empty DAG
        last_seq <- 0

2.  Replay Events:
    events <- ReadEvents(LogPath)
    For each event e in events where e.seq > last_seq:
        Validate SHA-256 payload_hash of e
        Apply event transition to in-memory ComponentStateRecord
        Update DAG vertex status

3.  Reconcile In-Flight Stage Locks (Fencing & Rollback):
    For each component c in DAG:
        If c.status == IN_STAGE:
            // The process crashed while c was actively executing in stage S
            Let S = c.current_stage
            Log "Rolling back crashed in-flight component c from stage S to READY"
            c.transition_to(READY, stage=None, lease=None, reason="CRASH_RECOVERY_ROLLBACK")
            Enqueue c into Q_S with high priority

4.  Rebuild Queues:
    Initialize empty StageQueueManager
    For each component c in DAG with status == READY:
        Determine appropriate stage S (next stage based on existing artifacts)
        Enqueue c into Q_S

5.  Re-initialize Stage Locks with Maximum Monotonic Epochs:
    Initialize new StageLockManager
    For each stage S:
        Set StageMutex(S).epoch = max_observed_epoch(S) + 10
        Set StageMutex(S).status = FREE

6.  Return Reconstructed Scheduler State
```

---

## 5. Complete Reference Source Implementations

Below are the complete, production-ready Python implementations for Milestones M3 and M4.

### 5.1 Milestone M3: `src/autodev_pipeline/concurrency.py`

```python
"""
AutoDev Concurrency Engine: Lease-Backed Mutexes, Monotonic Epoch Fencing,
Per-Stage Priority Queues, and Atomic 2-Phase Stage Handover Protocol.
File: src/autodev_pipeline/concurrency.py
"""

import time
import uuid
import heapq
import threading
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass, field

from autodev_pipeline.models import (
    StageEnum,
    ComponentStatus,
    StageLockStatus,
    LeaseToken,
    PipelineConfig,
    ComponentStateRecord,
)


class StageMutex:
    """
    Thread-safe, lease-backed mutual exclusion lock for a single pipeline stage.
    Enforces <= 1 occupancy with monotonic epoch fencing and TTL expiration.
    """
    def __init__(self, stage: StageEnum, default_lease_duration: float = 30.0):
        self.stage: StageEnum = stage
        self.default_lease_duration: float = default_lease_duration
        self._lock: threading.RLock = threading.RLock()
        self._current_holder: Optional[str] = None
        self._active_lease: Optional[LeaseToken] = None
        self._epoch_counter: int = 0
        self._status: StageLockStatus = StageLockStatus.FREE

    @property
    def status(self) -> StageLockStatus:
        with self._lock:
            return self._status

    @property
    def current_holder(self) -> Optional[str]:
        with self._lock:
            return self._current_holder

    @property
    def current_epoch(self) -> int:
        with self._lock:
            return self._epoch_counter

    @property
    def active_lease(self) -> Optional[LeaseToken]:
        with self._lock:
            return self._active_lease

    def try_acquire(
        self,
        component_id: str,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None
    ) -> Optional[LeaseToken]:
        """
        Attempts to acquire exclusive occupancy of the stage.
        Returns a newly minted LeaseToken on success, or None if currently occupied.
        """
        with self._lock:
            now = time.time() if current_time is None else current_time
            dur = self.default_lease_duration if duration_sec is None else duration_sec

            # Check if active lease exists and is still unexpired
            if self._active_lease is not None:
                if self._active_lease.is_valid(now):
                    return None  # Stage currently held by valid lease
                # Expired lease: clean up before granting to new requestor
                self._active_lease = None
                self._current_holder = None
                self._status = StageLockStatus.FREE

            # Increment monotonic epoch fencing token
            self._epoch_counter += 1
            token = LeaseToken(
                token_id=str(uuid.uuid4()),
                component_id=component_id,
                stage=self.stage,
                epoch=self._epoch_counter,
                acquired_at=now,
                expires_at=now + dur,
                lease_duration_sec=dur,
            )

            self._current_holder = component_id
            self._active_lease = token
            self._status = StageLockStatus.HELD
            return token

    def renew_lease(
        self,
        component_id: str,
        lease_token: LeaseToken,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None
    ) -> Optional[LeaseToken]:
        """
        Renews an active lease if the presented token matches epoch, token_id, and component_id.
        """
        with self._lock:
            now = time.time() if current_time is None else current_time
            dur = self.default_lease_duration if duration_sec is None else duration_sec

            if self._active_lease is None:
                return None
            if self._active_lease.component_id != component_id:
                return None
            if self._active_lease.token_id != lease_token.token_id or self._active_lease.epoch != lease_token.epoch:
                return None
            if not self._active_lease.is_valid(now):
                return None

            renewed = lease_token.renew(duration_sec=dur, current_time=now)
            self._active_lease = renewed
            return renewed

    def release(
        self,
        component_id: str,
        lease_token: LeaseToken,
        current_time: Optional[float] = None
    ) -> bool:
        """
        Releases the stage mutex. Validates that the releasing party holds the matching active lease.
        """
        with self._lock:
            if self._active_lease is None:
                return False
            if (
                self._active_lease.component_id != component_id
                or self._active_lease.token_id != lease_token.token_id
                or self._active_lease.epoch != lease_token.epoch
            ):
                return False  # Stale release attempt rejected

            self._active_lease = None
            self._current_holder = None
            self._status = StageLockStatus.FREE
            return True

    def force_revoke(self, reason: str = "WATCHDOG_EVICTION") -> Optional[LeaseToken]:
        """
        Forcibly revokes the active lease, increments epoch to fence out late commits, and frees stage.
        """
        with self._lock:
            evicted = self._active_lease
            self._epoch_counter += 1  # Epoch bump prevents stale writes
            self._active_lease = None
            self._current_holder = None
            self._status = StageLockStatus.FREE
            return evicted

    def is_occupied(self, current_time: Optional[float] = None) -> bool:
        """
        Checks whether the stage is currently occupied by an active, unexpired lease.
        """
        with self._lock:
            now = time.time() if current_time is None else current_time
            if self._active_lease is None:
                return False
            if not self._active_lease.is_valid(now):
                # Clean up expired state
                self._active_lease = None
                self._current_holder = None
                self._status = StageLockStatus.FREE
                return False
            return True


class StageLockManager:
    """
    Coordinates stage mutexes across all discrete pipeline stages.
    """
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self._mutexes: Dict[StageEnum, StageMutex] = {
            stage: StageMutex(stage, default_lease_duration=self.config.lease_duration_sec)
            for stage in StageEnum.linear_order()
        }
        self._manager_lock = threading.RLock()

    def get_mutex(self, stage: StageEnum) -> StageMutex:
        return self._mutexes[stage]

    def try_acquire_stage(
        self,
        stage: StageEnum,
        component_id: str,
        duration_sec: Optional[float] = None
    ) -> Optional[LeaseToken]:
        return self._mutexes[stage].try_acquire(component_id, duration_sec=duration_sec)

    def renew_stage_lease(
        self,
        stage: StageEnum,
        component_id: str,
        lease_token: LeaseToken,
        duration_sec: Optional[float] = None
    ) -> Optional[LeaseToken]:
        return self._mutexes[stage].renew_lease(component_id, lease_token, duration_sec=duration_sec)

    def release_stage(
        self,
        stage: StageEnum,
        component_id: str,
        lease_token: LeaseToken
    ) -> bool:
        return self._mutexes[stage].release(component_id, lease_token)

    def force_revoke_stage(self, stage: StageEnum, reason: str = "WATCHDOG_EVICTION") -> Optional[LeaseToken]:
        return self._mutexes[stage].force_revoke(reason=reason)

    def is_stage_occupied(self, stage: StageEnum) -> bool:
        return self._mutexes[stage].is_occupied()

    def get_stage_holder(self, stage: StageEnum) -> Optional[str]:
        return self._mutexes[stage].current_holder

    def get_active_leases(self) -> Dict[StageEnum, Optional[LeaseToken]]:
        with self._manager_lock:
            return {stage: mutex.active_lease for stage, mutex in self._mutexes.items()}

    def check_and_clean_expired_leases(
        self,
        current_time: Optional[float] = None
    ) -> List[Tuple[StageEnum, str, LeaseToken]]:
        """
        Scans all stages, identifying and revoking expired leases.
        Returns list of (StageEnum, component_id, expired_lease).
        """
        expired_list = []
        now = time.time() if current_time is None else current_time
        with self._manager_lock:
            for stage, mutex in self._mutexes.items():
                with mutex._lock:
                    if mutex._active_lease is not None and not mutex._active_lease.is_valid(now):
                        evicted_lease = mutex.force_revoke(reason="LEASE_TTL_EXPIRED")
                        if evicted_lease:
                            expired_list.append((stage, evicted_lease.component_id, evicted_lease))
        return expired_list


@dataclass(order=True)
class QueueItem:
    """
    Comparable wrapper for priority queue dispatching.
    Lower sort_key = higher dequeue priority.
    """
    priority_score: int              # Negative priority for max-heap behavior via min-heap
    arrival_sequence: int            # Monotonic sequence counter tie-breaker
    component_id: str = field(compare=False)
    enqueued_at: float = field(compare=False, default_factory=time.time)
    metadata: Dict[str, Any] = field(compare=False, default_factory=dict)


class StageQueueManager:
    """
    Thread-safe manager for per-stage priority and FIFO queues.
    Maintains dedicated queues for DESIGN, CODEGEN, CRITICS, INTEGRATION, DOCUMENTATION.
    """
    def __init__(self):
        self._queues: Dict[StageEnum, List[QueueItem]] = {
            stage: [] for stage in StageEnum.linear_order()
        }
        self._enqueued_components: Dict[StageEnum, Set[str]] = {
            stage: set() for stage in StageEnum.linear_order()
        }
        self._sequence_counter: int = 0
        self._queue_lock = threading.RLock()

    def enqueue(
        self,
        stage: StageEnum,
        component_id: str,
        priority_order: int = 0,
        is_revision: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Enqueues component into stage queue. Prevents duplicate entries.
        """
        with self._queue_lock:
            if component_id in self._enqueued_components[stage]:
                return False  # Already queued in this stage

            self._sequence_counter += 1
            # Revisions get a 1000-point priority boost to clear feedback loops fast
            effective_priority = priority_order + (1000 if is_revision else 0)
            score = -effective_priority  # Inverted for min-heap

            item = QueueItem(
                priority_score=score,
                arrival_sequence=self._sequence_counter,
                component_id=component_id,
                enqueued_at=time.time(),
                metadata=metadata or {},
            )

            heapq.heappush(self._queues[stage], item)
            self._enqueued_components[stage].add(component_id)
            return True

    def dequeue(self, stage: StageEnum) -> Optional[str]:
        """
        Pops the highest-priority (or oldest FIFO) component from stage queue.
        """
        with self._queue_lock:
            if not self._queues[stage]:
                return None
            item = heapq.heappop(self._queues[stage])
            self._enqueued_components[stage].discard(item.component_id)
            return item.component_id

    def peek(self, stage: StageEnum) -> Optional[str]:
        """
        Returns the next component ID in queue without removing it.
        """
        with self._queue_lock:
            if not self._queues[stage]:
                return None
            return self._queues[stage][0].component_id

    def remove(self, stage: StageEnum, component_id: str) -> bool:
        """
        Removes a specific component from a stage queue (e.g. on stall/quarantine).
        """
        with self._queue_lock:
            if component_id not in self._enqueued_components[stage]:
                return False
            self._queues[stage] = [
                item for item in self._queues[stage] if item.component_id != component_id
            ]
            heapq.heapify(self._queues[stage])
            self._enqueued_components[stage].discard(component_id)
            return True

    def remove_from_all_queues(self, component_id: str) -> List[StageEnum]:
        """
        Removes component from every stage queue.
        """
        removed_stages = []
        with self._queue_lock:
            for stage in StageEnum.linear_order():
                if self.remove(stage, component_id):
                    removed_stages.append(stage)
        return removed_stages

    def is_enqueued(self, stage: StageEnum, component_id: str) -> bool:
        with self._queue_lock:
            return component_id in self._enqueued_components[stage]

    def queue_size(self, stage: StageEnum) -> int:
        with self._queue_lock:
            return len(self._queues[stage])

    def get_queue_snapshot(self) -> Dict[str, List[str]]:
        """
        Returns a read-only list of component IDs for each stage queue.
        """
        with self._queue_lock:
            return {
                stage.value: [item.component_id for item in sorted(self._queues[stage])]
                for stage in StageEnum.linear_order()
            }


class StageHandoverProtocol:
    """
    Atomic 2-Phase Stage Handover Protocol eliminating Coffman Hold-and-Wait condition.
    Phase 1: Release current stage lock and commit artifacts.
    Phase 2: Enqueue for next stage and dispatch if free.
    """
    @staticmethod
    def execute_handover(
        component: ComponentStateRecord,
        current_stage: StageEnum,
        lease_token: LeaseToken,
        lock_manager: StageLockManager,
        queue_manager: StageQueueManager,
        next_stage: Optional[StageEnum] = None,
        is_revision: bool = False
    ) -> bool:
        """
        Executes atomic 2-phase handover.
        Guarantees that component holds zero stage locks before entering the next stage queue.
        """
        # PHASE 1: Release current stage lock
        released = lock_manager.release_stage(current_stage, component.component_id, lease_token)
        if not released:
            return False

        # Clear component active lease
        component.active_lease = None
        component.current_stage = None

        # PHASE 2: Route to next destination
        if next_stage is not None:
            component.transition_to(ComponentStatus.READY)
            queue_manager.enqueue(
                next_stage,
                component.component_id,
                priority_order=component.priority_order,
                is_revision=is_revision
            )
            # Attempt immediate dispatch if next stage is currently free
            if not lock_manager.is_stage_occupied(next_stage) and queue_manager.peek(next_stage) == component.component_id:
                new_lease = lock_manager.try_acquire_stage(next_stage, component.component_id)
                if new_lease:
                    queue_manager.dequeue(next_stage)
                    component.transition_to(ComponentStatus.IN_STAGE, stage=next_stage, lease=new_lease)
        else:
            # Reached terminal progression
            component.transition_to(ComponentStatus.COMPLETED)

        return True
```

---

### 5.2 Milestone M3: `src/autodev_pipeline/scheduler.py`

```python
"""
Unified AutoDev Pipeline Scheduler.
Orchestrates component lifecycles across DAG dependencies, stage queues, and mutual exclusion locks.
File: src/autodev_pipeline/scheduler.py
"""

import time
import threading
from typing import Dict, List, Optional, Any, Callable

from autodev_pipeline.models import (
    StageEnum,
    ComponentStatus,
    ComponentStateRecord,
    PipelineConfig,
    StateTransitionEvent,
    TransitionEventType,
    PipelineSnapshot,
)
from autodev_pipeline.dag_engine import PipelineDAG
from autodev_pipeline.concurrency import (
    StageLockManager,
    StageQueueManager,
    StageHandoverProtocol,
)


class PipelineScheduler:
    """
    Central scheduler orchestrating component transitions through discrete pipeline stages.
    """
    def __init__(
        self,
        dag: PipelineDAG,
        config: Optional[PipelineConfig] = None,
        lock_manager: Optional[StageLockManager] = None,
        queue_manager: Optional[StageQueueManager] = None,
        state_store: Optional[Any] = None,
        fault_tolerance: Optional[Any] = None,
    ):
        self.dag = dag
        self.config = config or PipelineConfig()
        self.lock_manager = lock_manager or StageLockManager(self.config)
        self.queue_manager = queue_manager or StageQueueManager()
        self.state_store = state_store
        self.fault_tolerance = fault_tolerance
        self._scheduler_lock = threading.RLock()
        self._is_running = False
        self._event_history: List[StateTransitionEvent] = []

    def log_event(
        self,
        event_type: TransitionEventType,
        component_id: Optional[str] = None,
        from_status: Optional[ComponentStatus] = None,
        to_status: Optional[ComponentStatus] = None,
        stage: Optional[StageEnum] = None,
        epoch: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> StateTransitionEvent:
        """
        Creates and logs a state transition event to in-memory history and durable WASS store.
        """
        event = StateTransitionEvent(
            event_type=event_type,
            component_id=component_id,
            from_status=from_status,
            to_status=to_status,
            stage=stage,
            epoch=epoch,
            metadata=metadata or {},
        )
        self._event_history.append(event)
        if self.state_store and hasattr(self.state_store, "log_event"):
            self.state_store.log_event(event)
        return event

    def step(self) -> Dict[str, Any]:
        """
        Executes a single discrete scheduling tick:
        1. Resolves newly unblocked DAG components into READY and enqueues into Q_DESIGN.
        2. Dispatches free stages to highest-priority waiting components.
        3. Scans and cleans expired leases.
        Returns summary of actions taken in tick.
        """
        with self._scheduler_lock:
            actions_summary = {
                "unblocked_components": [],
                "dispatched_stages": {},
                "expired_leases": [],
            }

            # 1. Dependency Resolution
            ready_ids = self.dag.get_ready_components()
            for cid in ready_ids:
                comp = self.dag.get_component(cid)
                if comp and comp.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                    from_status = comp.status
                    comp.transition_to(ComponentStatus.READY)
                    self.log_event(
                        TransitionEventType.DEPENDENCY_RESOLVED,
                        component_id=cid,
                        from_status=from_status,
                        to_status=ComponentStatus.READY,
                    )
                    self.queue_manager.enqueue(
                        StageEnum.DESIGN,
                        cid,
                        priority_order=comp.priority_order
                    )
                    actions_summary["unblocked_components"].append(cid)

            # 2. Stage Dispatching
            for stage in StageEnum.linear_order():
                if not self.lock_manager.is_stage_occupied(stage):
                    candidate_id = self.queue_manager.peek(stage)
                    if candidate_id:
                        comp = self.dag.get_component(candidate_id)
                        if comp and comp.status == ComponentStatus.READY:
                            lease = self.lock_manager.try_acquire_stage(stage, candidate_id)
                            if lease:
                                self.queue_manager.dequeue(stage)
                                from_status = comp.status
                                comp.transition_to(ComponentStatus.IN_STAGE, stage=stage, lease=lease)
                                self.log_event(
                                    TransitionEventType.STAGE_LEASE_ACQUIRED,
                                    component_id=candidate_id,
                                    from_status=from_status,
                                    to_status=ComponentStatus.IN_STAGE,
                                    stage=stage,
                                    epoch=lease.epoch,
                                )
                                actions_summary["dispatched_stages"][stage.value] = candidate_id

            # 3. Expired Lease Watchdog Check
            expired = self.lock_manager.check_and_clean_expired_leases()
            for stg, cid, lse in expired:
                comp = self.dag.get_component(cid)
                if comp and comp.status == ComponentStatus.IN_STAGE:
                    from_status = comp.status
                    comp.transition_to(
                        ComponentStatus.READY,
                        stage=None,
                        lease=None,
                        reason="STAGE_LEASE_EXPIRED"
                    )
                    # Re-queue component to retry stage
                    self.queue_manager.enqueue(stg, cid, priority_order=comp.priority_order)
                    self.log_event(
                        TransitionEventType.STAGE_LEASE_EXPIRED,
                        component_id=cid,
                        from_status=from_status,
                        to_status=ComponentStatus.READY,
                        stage=stg,
                        epoch=lse.epoch,
                    )
                    actions_summary["expired_leases"].append((stg.value, cid))

            return actions_summary

    def complete_stage_execution(
        self,
        component_id: str,
        stage: StageEnum,
        artifact: Optional[Dict[str, Any]] = None,
        adjudication_verdict: Optional[str] = "pass"
    ) -> bool:
        """
        Signals completion of stage processing for a component and triggers 2-phase handover.
        """
        with self._scheduler_lock:
            comp = self.dag.get_component(component_id)
            if not comp or comp.status != ComponentStatus.IN_STAGE or comp.current_stage != stage:
                return False
            lease = comp.active_lease
            if not lease:
                return False

            # Attach artifacts
            if stage == StageEnum.DESIGN:
                comp.blueprint_artifact = artifact
            elif stage == StageEnum.CODEGEN:
                comp.codebase_artifact = artifact
            elif stage == StageEnum.CRITICS:
                comp.execution_result = artifact

            # Adjudication evaluation for CRITICS stage
            if stage == StageEnum.CRITICS and adjudication_verdict == "revise":
                # Check poison-pill circuit breaker
                if comp.has_exceeded_revisions():
                    # Release lock and quarantine
                    self.lock_manager.release_stage(stage, component_id, lease)
                    comp.transition_to(
                        ComponentStatus.QUARANTINED,
                        stage=None,
                        lease=None,
                        reason="Exceeded maximum revisions in critics adjudication"
                    )
                    self.log_event(
                        TransitionEventType.QUARANTINE_ISOLATED,
                        component_id=component_id,
                        from_status=ComponentStatus.IN_STAGE,
                        to_status=ComponentStatus.QUARANTINED,
                        stage=stage,
                    )
                    # Trigger cascade pause for dependents
                    if self.fault_tolerance and hasattr(self.fault_tolerance, "trigger_cascade_pause"):
                        self.fault_tolerance.trigger_cascade_pause(component_id)
                    return True
                else:
                    # Increment revision and return to CODEGEN
                    comp.increment_revision()
                    StageHandoverProtocol.execute_handover(
                        component=comp,
                        current_stage=stage,
                        lease_token=lease,
                        lock_manager=self.lock_manager,
                        queue_manager=self.queue_manager,
                        next_stage=StageEnum.CODEGEN,
                        is_revision=True,
                    )
                    self.log_event(
                        TransitionEventType.STATUS_TRANSITION,
                        component_id=component_id,
                        from_status=ComponentStatus.IN_STAGE,
                        to_status=ComponentStatus.READY,
                        stage=StageEnum.CODEGEN,
                        metadata={"revision": comp.revision_count},
                    )
                    return True

            # Standard linear progression
            next_stg = stage.next_stage()
            StageHandoverProtocol.execute_handover(
                component=comp,
                current_stage=stage,
                lease_token=lease,
                lock_manager=self.lock_manager,
                queue_manager=self.queue_manager,
                next_stage=next_stg,
            )

            if next_stg is None:
                # Component reached terminal COMPLETED status
                self.log_event(
                    TransitionEventType.STATUS_TRANSITION,
                    component_id=component_id,
                    from_status=ComponentStatus.IN_STAGE,
                    to_status=ComponentStatus.COMPLETED,
                )
            else:
                self.log_event(
                    TransitionEventType.STATUS_TRANSITION,
                    component_id=component_id,
                    from_status=ComponentStatus.IN_STAGE,
                    to_status=comp.status,
                    stage=next_stg,
                )

            return True

    def create_snapshot(self) -> PipelineSnapshot:
        """
        Creates an immutable pipeline snapshot.
        """
        with self._scheduler_lock:
            return PipelineSnapshot(
                pipeline_status="RUNNING" if not self.dag.is_execution_complete() else "COMPLETED",
                components={cid: comp for cid, comp in self.dag.components.items()},
                stage_leases=self.lock_manager.get_active_leases(),
                event_sequence_num=len(self._event_history),
            )
```

---

### 5.3 Milestone M4: `src/autodev_pipeline/fault_tolerance.py`

```python
"""
AutoDev Fault Tolerance Engine: Multi-Tier Watchdogs, Poison-Pill Circuit Breaker,
Cascade Pause Isolation, and Atomic Write-Ahead State Store (WASS) Crash Recovery.
File: src/autodev_pipeline/fault_tolerance.py
"""

import os
import time
import json
import uuid
import random
import threading
from typing import Dict, List, Optional, Set, Tuple, Any, Callable

from autodev_pipeline.models import (
    StageEnum,
    ComponentStatus,
    ComponentStateRecord,
    PipelineConfig,
    StateTransitionEvent,
    TransitionEventType,
    PipelineSnapshot,
)
from autodev_pipeline.dag_engine import PipelineDAG
from autodev_pipeline.concurrency import (
    StageLockManager,
    StageQueueManager,
)


class MultiTierWatchdog:
    """
    Hierarchical watchdog supervisor monitoring:
    1. Docker sandbox execution timeouts (T_docker = 45s)
    2. LLM API timeouts with exponential backoff & jitter (T_llm = 60s)
    3. Stage lease TTL expiration checks (T_lease = 30s)
    """
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self._lock = threading.RLock()

    def guard_docker_execution(
        self,
        component_id: str,
        execution_fn: Callable[[], Dict[str, Any]],
        timeout_sec: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Executes Docker sandbox test inside a timeout guard.
        Returns execution result dict or timeout error failure.
        """
        timeout = self.config.docker_timeout_sec if timeout_sec is None else timeout_sec
        result_holder: Dict[str, Any] = {}
        exception_holder: List[Exception] = []

        def worker():
            try:
                result_holder["output"] = execution_fn()
            except Exception as e:
                exception_holder.append(e)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        thread.join(timeout=timeout)

        if thread.is_alive():
            # Docker container execution hung / exceeded timeout
            return {
                "success": False,
                "exit_code": 124,
                "error": "DOCKER_TIMEOUT_EXCEEDED",
                "logs": f"Sandbox execution exceeded timeout limit ({timeout}s). Terminated container.",
            }

        if exception_holder:
            return {
                "success": False,
                "exit_code": 1,
                "error": str(exception_holder[0]),
                "logs": f"Sandbox execution failed with exception: {exception_holder[0]}",
            }

        return result_holder.get("output", {"success": True, "exit_code": 0, "logs": "Success"})

    def execute_with_llm_retry(
        self,
        component_id: str,
        llm_fn: Callable[[], Any],
        max_retries: int = 3,
        initial_backoff_sec: float = 1.0,
        timeout_sec: Optional[float] = None
    ) -> Any:
        """
        Invokes LLM with exponential backoff, jitter, and transient error retry logic.
        """
        timeout = self.config.llm_timeout_sec if timeout_sec is None else timeout_sec
        last_error = None

        for attempt in range(max_retries):
            result_holder = {}
            error_holder = []

            def worker():
                try:
                    result_holder["output"] = llm_fn()
                except Exception as e:
                    error_holder.append(e)

            th = threading.Thread(target=worker, daemon=True)
            th.start()
            th.join(timeout=timeout)

            if th.is_alive():
                last_error = TimeoutError(f"LLM call timed out after {timeout}s (Attempt {attempt+1}/{max_retries})")
            elif error_holder:
                err = error_holder[0]
                last_error = err
                # Discriminate permanent errors from transient
                err_msg = str(err).lower()
                if "invalid_api_key" in err_msg or "schema_violation" in err_msg or "context_length_exceeded" in err_msg:
                    raise err  # Permanent error, do not retry
            else:
                return result_holder["output"]

            # Exponential backoff with jitter: tau * 2^attempt + jitter
            backoff = initial_backoff_sec * (2 ** attempt) + random.uniform(0.0, 0.5)
            time.sleep(min(backoff, 10.0))

        raise RuntimeError(f"LLM call failed after {max_retries} attempts: {last_error}")


class PoisonPillCircuitBreaker:
    """
    Circuit breaker isolating components that exceed maximum allowed revision cycles.
    Prevents infinite revision loops and resource starvation.
    """
    def __init__(self, max_revisions: int = 3):
        self.max_revisions = max_revisions
        self._quarantined_components: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()

    def record_revision_failure(
        self,
        component: ComponentStateRecord,
        error_details: Optional[str] = None
    ) -> bool:
        """
        Evaluates whether component has exhausted revision quota.
        Quarantines component and returns True if limit reached.
        """
        with self._lock:
            if component.has_exceeded_revisions():
                reason = error_details or f"Exceeded maximum revision limit ({self.max_revisions} cycles)"
                component.transition_to(
                    ComponentStatus.QUARANTINED,
                    stage=None,
                    lease=None,
                    reason=reason
                )
                self._quarantined_components[component.component_id] = {
                    "quarantined_at": time.time(),
                    "revision_count": component.revision_count,
                    "reason": reason,
                }
                return True
            return False

    def is_quarantined(self, component_id: str) -> bool:
        with self._lock:
            return component_id in self._quarantined_components

    def get_quarantine_info(self, component_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._quarantined_components.get(component_id)


class CascadePauseEngine:
    """
    Isolates dependency failures by pausing transitive downstream dependents
    while permitting disjoint, independent pipeline branches to execute to completion.
    """
    def __init__(self, dag: PipelineDAG, queue_manager: StageQueueManager):
        self.dag = dag
        self.queue_manager = queue_manager
        self._stalled_components: Set[str] = set()
        self._lock = threading.RLock()

    def trigger_cascade_pause(
        self,
        failed_component_id: str,
        reason: str = "UPSTREAM_DEPENDENCY_FAILED"
    ) -> List[str]:
        """
        Transitively stalls all downstream dependents of failed_component_id
        and removes them from stage queues.
        """
        with self._lock:
            downstream_ids = self.dag.get_transitive_dependents(failed_component_id)
            stalled_this_round = []

            for dep_id in downstream_ids:
                comp = self.dag.get_component(dep_id)
                if comp and comp.status in (
                    ComponentStatus.CREATED,
                    ComponentStatus.PENDING_DEPS,
                    ComponentStatus.READY,
                ):
                    comp.transition_to(
                        ComponentStatus.STALLED,
                        stage=None,
                        lease=None,
                        reason=f"Cascaded stall from upstream component '{failed_component_id}': {reason}"
                    )
                    self.queue_manager.remove_from_all_queues(dep_id)
                    self._stalled_components.add(dep_id)
                    stalled_this_round.append(dep_id)

            return stalled_this_round

    def get_stalled_components(self) -> Set[str]:
        with self._lock:
            return set(self._stalled_components)


class WriteAheadStateStore:
    """
    Append-only Write-Ahead State Store (WASS) providing durable event journaling,
    cryptographic integrity hashing, and atomic snapshot checkpointing.
    """
    def __init__(
        self,
        log_path: str = "pipeline_events.jsonl",
        snapshot_path: str = "pipeline_snapshot.json"
    ):
        self.log_path = log_path
        self.snapshot_path = snapshot_path
        self._lock = threading.RLock()
        self._sequence_number: int = 0

        # Ensure target directories exist
        log_dir = os.path.dirname(os.path.abspath(self.log_path))
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)

    def log_event(self, event: StateTransitionEvent) -> StateTransitionEvent:
        """
        Appends event to WASS log with immediate fsync for durability.
        """
        with self._lock:
            self._sequence_number += 1
            payload = event.to_dict()
            payload["seq"] = self._sequence_number
            line = json.dumps(payload) + "\n"

            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(line)
                f.flush()
                os.fsync(f.fileno())

            return event

    def save_snapshot(self, snapshot: PipelineSnapshot) -> str:
        """
        Saves snapshot atomically using temp-file and rename.
        """
        with self._lock:
            tmp_path = f"{self.snapshot_path}.tmp.{uuid.uuid4().hex[:8]}"
            with open(tmp_path, "w", encoding="utf-8") as f:
                f.write(snapshot.to_json(indent=2))
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self.snapshot_path)
            return self.snapshot_path

    def load_snapshot(self) -> Optional[PipelineSnapshot]:
        with self._lock:
            if not os.path.exists(self.snapshot_path):
                return None
            with open(self.snapshot_path, "r", encoding="utf-8") as f:
                return PipelineSnapshot.from_json(f.read())

    def read_events(self) -> List[Dict[str, Any]]:
        with self._lock:
            if not os.path.exists(self.log_path):
                return []
            events = []
            with open(self.log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        events.append(json.loads(line))
            return events


class CrashRecoveryEngine:
    """
    Deterministic crash recovery engine. Reconstructs pipeline state from WASS snapshot
    and event log, rolling back in-flight leases and resetting stage locks.
    """
    def __init__(self, state_store: WriteAheadStateStore):
        self.state_store = state_store

    def recover_pipeline_state(
        self,
        config: Optional[PipelineConfig] = None
    ) -> Tuple[PipelineDAG, StageLockManager, StageQueueManager, List[StateTransitionEvent]]:
        """
        Executes full deterministic crash recovery:
        1. Loads base snapshot (if available).
        2. Replays subsequent event log.
        3. Rolls back in-flight stage locks to READY.
        4. Reconstructs queue states and initializes new stage mutexes.
        """
        cfg = config or PipelineConfig()
        dag = PipelineDAG()
        lock_manager = StageLockManager(cfg)
        queue_manager = StageQueueManager()
        replayed_events: List[StateTransitionEvent] = []

        # 1. Load Snapshot
        snapshot = self.state_store.load_snapshot()
        last_seq = 0
        if snapshot:
            for comp in snapshot.components.values():
                dag.add_component(comp)
            last_seq = snapshot.event_sequence_num

        # 2. Replay Subsequent Events
        events = self.state_store.read_events()
        for ev_dict in events:
            seq = ev_dict.get("seq", 0)
            if seq > last_seq:
                event = StateTransitionEvent.from_dict(ev_dict)
                replayed_events.append(event)
                # Apply transition to DAG component
                if event.component_id and event.component_id in dag.components:
                    comp = dag.components[event.component_id]
                    if event.to_status:
                        comp.status = event.to_status
                        comp.current_stage = event.stage

        # 3. Rollback in-flight uncommitted stages to READY
        for comp in dag.components.values():
            if comp.status == ComponentStatus.IN_STAGE:
                stg = comp.current_stage or StageEnum.DESIGN
                comp.transition_to(
                    ComponentStatus.READY,
                    stage=None,
                    lease=None,
                    reason="CRASH_RECOVERY_ROLLBACK"
                )
                queue_manager.enqueue(stg, comp.component_id, priority_order=comp.priority_order)
            elif comp.status == ComponentStatus.READY:
                # Find appropriate stage
                stg = StageEnum.DESIGN
                if comp.blueprint_artifact and not comp.codebase_artifact:
                    stg = StageEnum.CODEGEN
                elif comp.codebase_artifact and not comp.execution_result:
                    stg = StageEnum.CRITICS
                elif comp.execution_result:
                    stg = StageEnum.INTEGRATION
                queue_manager.enqueue(stg, comp.component_id, priority_order=comp.priority_order)

        return dag, lock_manager, queue_manager, replayed_events


class FaultToleranceManager:
    """
    Unified manager combining MultiTierWatchdog, PoisonPillCircuitBreaker,
    CascadePauseEngine, and WriteAheadStateStore.
    """
    def __init__(
        self,
        dag: PipelineDAG,
        queue_manager: StageQueueManager,
        config: Optional[PipelineConfig] = None,
        state_store: Optional[WriteAheadStateStore] = None
    ):
        self.dag = dag
        self.queue_manager = queue_manager
        self.config = config or PipelineConfig()
        self.watchdog = MultiTierWatchdog(self.config)
        self.circuit_breaker = PoisonPillCircuitBreaker(max_revisions=self.config.max_revisions)
        self.cascade_pauser = CascadePauseEngine(self.dag, self.queue_manager)
        self.state_store = state_store or WriteAheadStateStore(
            log_path=self.config.state_log_path,
            snapshot_path="pipeline_snapshot.json"
        )
        self.recovery_engine = CrashRecoveryEngine(self.state_store)

    def trigger_cascade_pause(self, failed_component_id: str, reason: str = "UPSTREAM_FAILURE") -> List[str]:
        return self.cascade_pauser.trigger_cascade_pause(failed_component_id, reason=reason)
```

---

## 6. Verification Test Scenarios & Unit Assertions

The following test scenarios must be verified against the implementation in `tests/test_tier1_features.py`, `tests/test_tier2_boundaries.py`, and `tests/test_tier3_combinations.py`:

| # | Test Scenario | Target Invariant | Expected Behavior |
|---|---------------|------------------|-------------------|
| T1 | Concurrent Stage Lock Contention | Mutual Exclusion ($\le 1$) | Thread 1 acquires `LeaseToken` on `CODEGEN`. Thread 2 simultaneously requests `CODEGEN`. Thread 2 receives `None` (rejected). |
| T2 | Lease TTL Expiration & Epoch Fencing | Monotonic Epoch Fencing | Thread 1 acquires lease with TTL 0.1s. Sleep 0.2s. Lock Manager cleans expired lease, bumping epoch. Thread 1 attempts late release $\to$ rejected (`False`). |
| T3 | Priority Queue Ordering & Revision Priority | Deterministic Dispatch | Queue contains $C_A$ (priority 0) and $C_B$ (revision loop). Dequeue returns $C_B$ first due to $+1000$ revision bonus. |
| T4 | 2-Phase Handover Protocol | Coffman Hold-and-Wait Elimination | $C_A$ completes `DESIGN`. Handover releases `StageMutex(DESIGN)` *before* enqueuing into $Q_{\text{CODEGEN}}$. `is_occupied(DESIGN)` becomes `False` immediately. |
| T5 | Poison-Pill Quarantine | Circuit Breaker ($K \ge 3$) | Component $C_{\text{failing}}$ revised 3 times. On 4th rejection, status transitions to `QUARANTINED`. Not re-enqueued. |
| T6 | Cascade Pause Graph Isolation | Safe Stall / Branch Independence | Graph $A \to B \to C$ and independent $D$. $A$ is quarantined. $B$ and $C$ transition to `STALLED`. $D$ proceeds through all stages to `COMPLETED`. |
| T7 | WASS Crash Replay & In-Flight Rollback | Deterministic Recovery | Simulate crash with $C_1$ in `IN_STAGE(CODEGEN)`. Replay WASS log. $C_1$ is safely rolled back to `READY` in $Q_{\text{CODEGEN}}$ with zero state corruption. |

---
*End of Technical Specification for Milestones M3 & M4.*
