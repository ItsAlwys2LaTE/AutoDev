# Project: AutoDev Robust Pipeline Algorithm

## Architecture
A formal, deterministic, backend-driven concurrency and stage scheduling engine for multi-agent software development pipelines.
The system coordinates concurrent components through discrete lifecycle stages while enforcing strict mutual exclusion per stage ($\le 1$ occupant per stage), dynamic DAG dependency management, circular dependency resolution, multi-tier watchdog timeouts, and atomic crash recovery.

```
+-----------------------------------------------------------------------------------+
|                            AutoDev Pipeline Engine                                |
|                                                                                   |
|  +------------------------+      +-------------------------+      +------------+  |
|  |   Master Architect     | ---> |   DAG Dependency Engine | ---> | Ready      |  |
|  | (ComponentDecomposition|      | (Kahn + Tarjan CycleDet)|      | Queue (Q0) |  |
|  +------------------------+      +-------------------------+      +------------+  |
|                                                                         |         |
|  +----------------------------------------------------------------------+         |
|  |                                                                                |
|  v                                                                                |
|  [Stage: Design]  -- atomic handover --> [Stage: CodeGen] -- atomic handover --+  |
|  (Lock: Mutex + Lease)                   (Lock: Mutex + Lease)                 |  |
|                                                                                |  |
|  +-----------------------------------------------------------------------------+  |
|  |                                                                                |
|  v                                                                                |
|  [Stage: Critics / Adjudication] -- atomic handover --> [Stage: Integration]      |
|  (Lock: Mutex + Lease)                                  (Lock: Mutex + Lease)     |
|                                                                                |  |
|  +-----------------------------------------------------------------------------+  |
|  |                                                                                |
|  v                                                                                |
|  [Stage: Documentation / Finalize] ---> COMPLETED / STORED                        |
|                                                                                   |
|  Cross-Cutting Infrastructure:                                                    |
|  - Write-Ahead State Store (WASS) & Epoch Fencing                                 |
|  - Multi-Tier Watchdog & Timeout Matrix (LLM / Docker / Stage)                   |
|  - Poison-Pill Quarantine & Safe Stall Isolation                                  |
+-----------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Discrete State Machine & Stage Invariants | Formal lifecycle states (CREATED, PENDING_DEPS, READY, IN_STAGE, STALLED, QUARANTINED, COMPLETED, FAILED) with mathematical invariant $\forall S_j, \sum \mathbb{I} \le 1$. | M1 | Spec Miner / Algo Explorer |
| F2 | Lease-Backed Stage Mutex & Epoch Fencing | Single-occupancy stage locks backed by monotonic epoch tokens and TTL leases to eliminate hold-and-wait deadlocks and stale writes. | M1, M3 | Algo Explorer |
| F3 | DAG Dependency Engine (Kahn's + Tarjan's) | In-degree topological tracking for $O(1)$ unblocking and Tarjan's SCC for $O(V+E)$ upfront circular dependency detection. | M2 | Spec Miner / Algo Explorer |
| F4 | Cycle Breaking & Safe Stall Policies | Policy engine offering Safe Stall, Feedback Arc Set stubbing, and orphan validation when cycles or missing dependencies occur. | M2 | Spec Miner / Algo Explorer |
| F5 | Atomic Stage Handover Protocol | 2-phase release-before-acquire protocol with intermediate FIFO/priority stage queues ($Q_{\text{Design}}, Q_{\text{Code}}, Q_{\text{Critic}}, Q_{\text{Integrate}}$). | M3 | Spec Miner / Codebase Explorer |
| F6 | Multi-Tier Timeout Matrix & Watchdog | Hierarchical watchdogs (Docker sandbox timeout, LLM rate limit backoff, stage TTL watchdog) preventing thread hangs. | M4 | Codebase Explorer / Spec Miner |
| F7 | Poison-Pill Isolation & Cascade Pause | Automatic quarantine when a component exceeds 3 revision failures; pausing direct downstream dependents while unblocking independent tracks. | M4 | Algo Explorer / Codebase Explorer |
| F8 | Atomic Write-Ahead State Store (WASS) | Append-only event log and idempotent state snapshotting for crash resumption and zero-state-corruption recovery. | M4 | Spec Miner / Algo Explorer |
| F9 | Master Algorithmic Design Document | Exhaustive user-facing design deliverable `ALGORITHM_DESIGN.md` in `C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo` with formal proofs, state transition tables, LTL invariants, and pseudo-code. | M5 | ORIGINAL_REQUEST |
| F10 | Adversarial E2E Verification & Agent-as-Judge | Independent 100-point rubric evaluation, comprehensive 4-tier test suite + Tier 5 adversarial hardening, and forensic integrity audit. | M6 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Formalisms & Data Models | Define mathematical formalisms, LTL safety/liveness invariants, state enums, `StageMutex`, `LeaseToken`, `ComponentStateRecord`, `PipelineDAG` models. | none | DONE |
| M2 | DAG Engine & Cycle Resolution | Implement Kahn's in-degree resolution, Tarjan's SCC cycle detection, cycle isolation, missing/self-dependency checks, and safe stall handling. | M1 | DONE |
| M3 | Concurrency Controller & Stage Handover | Implement single-stage mutual exclusion locks, monotonic epoch fencing, stage queues, priority dispatching, and atomic 2-phase stage handover. | M1, M2 | DONE |
| M4 | Watchdogs, Quarantine & Crash Recovery | Implement multi-tier timeout matrix (Docker/LLM/Stage), poison-pill circuit breaker, cascade pause, and atomic Write-Ahead State Store (WASS) persistence & recovery. | M1, M2, M3 | DONE |
| M5 | Master Algorithmic Design Document | Author the comprehensive user-facing algorithmic design deliverable `ALGORITHM_DESIGN.md` at `C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo\ALGORITHM_DESIGN.md`. | M1, M2, M3, M4 | DONE |
| M6 | E2E Testing & Adversarial Verification | Execute 4-Tier test suite, Tier 5 adversarial stress testing, 100-point Agent-as-Judge rubric evaluation, and Forensic Integrity Audit. | M1, M2, M3, M4, M5 | DONE |

## Interface Contracts
### `PipelineDAG` ↔ `ConcurrencyController`
- `PipelineDAG.get_ready_components() -> List[str]`: Returns component IDs whose upstream dependencies are COMPLETED.
- `PipelineDAG.detect_cycles() -> List[List[str]]`: Returns list of strongly connected components with $|SCC| > 1$.
- `PipelineDAG.get_dependents(component_id: str) -> List[str]`: Returns direct downstream dependent components.

### `StageMutex` ↔ `StageScheduler`
- `StageMutex.try_acquire(component_id: str, stage: StageEnum, ttl_seconds: float) -> Optional[LeaseToken]`: Monotonically increments epoch and grants lease if stage is idle.
- `StageMutex.release(component_id: str, stage: StageEnum, lease_token: LeaseToken) -> bool`: Releases lock only if epoch matches lease.
- `StageMutex.is_occupied(stage: StageEnum) -> bool`: Checks if stage has an active unexpired lease.

### `StateManager` ↔ `CrashRecoveryEngine`
- `StateManager.log_transition(event: StateTransitionEvent) -> None`: Appends transition to atomic WASS log.
- `StateManager.create_snapshot() -> PipelineStateSnapshot`: Emits immutable state snapshot.
- `CrashRecoveryEngine.recover_from_log(log_path: str) -> PipelineSchedulerState`: Deterministically replays event log to reconstruct exact state.

## Code Layout
Target Project Directory: `C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo`
- `ALGORITHM_DESIGN.md`: Master user-facing algorithmic design document.
- `src/autodev_pipeline/models.py`: Data models and schemas (`ComponentStateRecord`, `LeaseToken`, `StageEnum`, `PipelineSnapshot`).
- `src/autodev_pipeline/dag_engine.py`: DAG dependency resolution, Kahn's algorithm, Tarjan's SCC cycle detector.
- `src/autodev_pipeline/concurrency.py`: Lease-backed stage mutex, epoch fencing, priority stage queues, atomic handover.
- `src/autodev_pipeline/fault_tolerance.py`: Multi-tier watchdogs, poison-pill quarantine, cascade pause, WASS persistence.
- `src/autodev_pipeline/scheduler.py`: Unified pipeline scheduler orchestrating components through stages.
- `tests/test_tier1_features.py`: Tier 1 Feature unit tests (stage exclusion, dependency unblocking, basic transitions).
- `tests/test_tier2_boundaries.py`: Tier 2 Boundary & edge case tests (cycles, missing deps, zero deps, massive DAGs).
- `tests/test_tier3_combinations.py`: Tier 3 Cross-feature interaction tests (concurrent stage competition, dynamic cycle injection).
- `tests/test_tier4_workloads.py`: Tier 4 Real-world multi-agent workload scenarios (simulated AutoDev SDLC execution).
- `tests/test_tier5_adversarial.py`: Tier 5 White-box adversarial stress tests (race condition fuzzing, crash injection).
- `tests/adversarial_audit_report.md`: Independent Agent-as-Judge 100-point adversarial scorecard.
