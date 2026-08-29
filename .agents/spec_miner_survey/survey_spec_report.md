# Multi-Agent Development Pipeline Algorithm: Comprehensive Requirements & Specification Survey

**Document ID:** SPEC-SURVEY-AUTODEV-PIPE-001  
**Target Project:** `autodev_pipeline_algo` (`~/teamwork_projects/autodev_pipeline_algo`)  
**Base System:** AutoDev SDLC Architecture (`backend/`, `orchestrator.py`, `models.py`, `executor.py`)  
**Status:** COMPLETE / SPECIFICATION MINED  
**Date:** 2026-08-29  

---

## 1. Executive Summary & Problem Domain

### 1.1 The Multi-Agent Pipeline Concurrency Challenge
AutoDev transforms unstructured human feature requests into fully tested, architected, and peer-reviewed software systems. In complex applications, the **Master Architect** decomposes a project into $N$ discrete, cohesive components ($C_1, C_2, \dots, C_N$) that must proceed through sequential SDLC stages:
1. **Stage 1 (SYS.ARCH_MAPPER):** Architectural Design & Blueprinting (`design_agent`)
2. **Stage 2 (SYS.CODE_GEN):** Polyglot Code Generation (`codegen_agent`)
3. **Stage 3 (SYS.EXEC_SANDBOX & SYS.ARBITRATION):** Dockerized Execution Sandbox & Multi-Critic Arbitration (`executor` + `critics` + `adjudicator`)
4. **Stage 4 (SYS.INTEGRATOR):** Cross-Component Synthesis & Integration Testing (`integrator_agent`)
5. **Stage 5 (SYS.DOC_GEN):** System Documentation (`documentation_agent`)

While simple sequential execution is slow and wastes resources, uncontrolled parallelism creates severe issues:
- **Resource Saturation & Rate-Limit Spikes:** Concurrent LLM calls to heavy models (`gemini-3.6-flash`, `mistral-small`) trigger TPM/RPM throttling and 429 cascades.
- **Docker Host Contention:** Concurrent container instantiation causes port collisions, memory spikes, and CPU starvation during test execution.
- **Race Conditions & UI Desynchronization:** Asynchronous frontend/backend state machines collide when multiple components update shared state simultaneously.
- **Deadlocks from Dependency Stalls:** Unresolved cycles or unmanaged dependencies lock all worker tracks indefinitely.

### 1.2 The Algorithmic Goal
Design an optimal, formally verified **Pipeline Concurrency & Stage Exclusivity Algorithm** that:
- Maximizes pipeline throughput via multi-component stage pipelining (e.g., Component $A$ in Code Gen while Component $B$ is in Design).
- Strictly enforces **Stage Occupancy Exclusivity** ($\le 1$ active component per stage at any instant $t$).
- Resolves Directed Acyclic Graph (DAG) dependencies with deterministic cycle detection and failure isolation.
- Guarantees crash recovery, timeout safety, and zero state corruption under adversarial stress.

---

## 2. Authoritative Specification Extraction

### 2.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Decomposition | Complexity Assessment & DAG Generation | Decomposes complex prompt into `ComponentSpec` items with `dependencies_on` and `priority_order`. | `RequirementsDocument` | `ComponentDecomposition` (list of `ComponentSpec`) | Fallback to single-pass if `is_complex=False`; model fallback on 429/timeout. | `master_architect.py`, `models.py` |
| 2 | Stage 1 (Design) | Scoped Blueprint Generation | Produces `SystemDesignBlueprint` including file manifests, Docker images, test commands, and pseudocode. | `RequirementsDocument`, `scoped_requirements`, shared tech stack | `SystemDesignBlueprint` (JSON) | Falls back to `gemini-3.5-flash-lite` on LLM error. | `design_agent.py`, `models.py` |
| 3 | Stage 2 (Code) | Autonomous Codebase Generation | Generates runnable source files and test suites matching blueprint specifications. | `RequirementsDocument`, `SystemDesignBlueprint`, optional `revision_plan` | `GeneratedCodeBase` (list of `CodeFile`) | Fallback model invocation; syntax validation trap. | `codegen_agent.py`, `models.py` |
| 4 | Stage 3a (Sandbox) | Docker Sandbox Test Execution | Builds isolated container, streams tarball in-memory, runs test command, captures stdout/stderr. | `GeneratedCodeBase`, `SystemDesignBlueprint` | `ExecutionResult` (`success: bool`, `logs: str`) | Returns `ExecutionResult(success=False, logs=...)`, guaranteed container cleanup in `finally`. | `executor.py` |
| 5 | Stage 3b (Arbitration) | Parallel Multi-Critic LangGraph | Parallel evaluation across Correctness (Gemini), Architecture (Mistral), and Completeness (Gemini). | `RequirementsDocument`, `SystemDesignBlueprint`, `GeneratedCodeBase`, `ExecutionResult` | `List[CriticFeedback]` | Rate limit detection triggers fallback key/model; missing keys return synthetic error feedback. | `critics.py`, `orchestrator.py` |
| 6 | Stage 3c (Adjudication) | Verdict & Revision Synthesis | LangGraph Adjudicator reviews feedbacks, outputs `pass`, `revise`, or `error` with structured revision instructions. | `List[CriticFeedback]` | `AdjudicatorDecision` (`verdict`, `revision_plan`) | Distinguishes system API errors from code flaws; outputs `error` on API failure. | `orchestrator.py` |
| 7 | Self-Healing Loop | Autonomous Code Revision Loop | Loops code back to Stage 2 on `revise` verdict up to $K=3$ times. | `GeneratedCodeBase`, `revision_plan`, `revision_count` | Updated `GeneratedCodeBase` or escalation | Bounded at $K=3$; escalates to manual approval / marked component failure. | `index.html`, `orchestrator.py` |
| 8 | Stage 4 (Integration) | Multi-Component Code Integration | Merges all passed component codebases, unifies dependencies, resolves naming collisions, generates unified entrypoint and integration tests. | `RequirementsDocument`, `ComponentDecomposition`, `List[ComponentResult]` | Unified `GeneratedCodeBase` | Fallback model streaming; schema enforcement. | `integrator_agent.py` |
| 9 | Stage 5 (Docs) | Autonomous Documentation | Generates system-level README and user guide post-integration. | `RequirementsDocument`, `SystemDesignBlueprint`, `GeneratedCodeBase` | Markdown documentation streams | Fallback model stream on error. | `documentation_agent.py` |
| 10 | Concurrency Control | Stage Occupancy Exclusivity Lock | Guarantees at most 1 component per stage to prevent resource contention. | Component readiness signal | Lock acquisition token / Stage dispatch | Naive boolean flags in prototype; requires formal Mutex/Semaphore in design algorithm. | `index.html` (L1454-L1608), `ORIGINAL_REQUEST.md` (R1) |
| 11 | Dependency Management | Dynamic In-Degree Topological Scheduler | Computes component eligibility based on upstream dependency status. | `dependencies_on` graph, component state table | Eligible component queue | Stalls component if upstream is unpassed; lacks cycle detection in prototype. | `index.html` (L1582), `ORIGINAL_REQUEST.md` (R2) |
| 12 | Fault Containment | Dependent Safe Stalling | Isolates failure of an upstream component so independent components can finish. | Component failure event | Dependent components marked `STALLED_DEPENDENCY_FAILED` | In prototype, hangs indefinitely; design algorithm must isolate cleanly. | `ORIGINAL_REQUEST.md` (R2) |

---

### 2.2 Edge Cases Discovered

| # | Feature | Input / Condition | Observed Prototype Behavior | Required Robust Design Behavior |
|---|---------|-------------------|-----------------------------|---------------------------------|
| E1 | DAG Scheduling | Circular Dependency (e.g., $A \to B \to C \to A$) | All components in cycle remain in `queued` status forever (silent deadlock). | Detect cycle at initialization via Kahn/Tarjan algorithm. Promptly emit diagnostic error, break cycle using priority heuristics, or safely abort pipeline. |
| E2 | DAG Scheduling | Missing Dependency ID ($A$ depends on non-existent `comp-xyz`) | `dependencies_on.every` evaluates `!componentStates[depId]` as true, accidentally allowing $A$ to run prematurely. | Validate graph integrity against $V = \{C_{\text{id}}\}$; reject or purge phantom dependency IDs before pipeline start. |
| E3 | DAG Scheduling | Self-referential Dependency ($A \to A$) | `depsPassed` evaluates false permanently; $A$ stalls forever. | Validate graph reflexivity $u \ne v, \forall (u,v) \in E$; reject self-dependencies. |
| E4 | Stage Concurrency | Concurrent Stage Release & Contention | Multiple ready components compete for newly freed stage lock. | Deterministic priority queue scheduler (DAG topological depth $\to$ Critical Path length $\to$ `priority_order` $\to$ FIFO). |
| E5 | Stage 3a Sandbox | Test Execution Infinite Loop / Hang | Sandbox `container.exec_run` hangs indefinitely, blocking stage lock and entire track. | Enforce strict execution timeout $T_{\text{Docker}}$ (e.g., 60s) with SIGKILL and forced container removal in `finally`. |
| E6 | Stage 3a Sandbox | Docker Daemon Outage / Crash | Unhandled exception or fatal error log; lock released without advancing state properly. | Wrap in typed `DockerSandboxUnavailableError`, safe stall pipeline, snapshot state to disk. |
| E7 | LLM Stage Execution | 429 Rate Limit / 503 Quota Exhaustion | In prototype, Adjudicator might treat rate limit as code error or crash server. | Immediate exponential backoff with full jitter; fallback to secondary model (`3.5-flash-lite`); classify as `SYSTEM_TRANSIENT_ERROR` rather than code revision. |
| E8 | Revision Loop | Continuous Rejection ($K \ge 3$) | Frontend presents force-approve button; pipeline stalls if unattended. | Configurable failure policy: `ESCALATE_HUMAN`, `MARK_FAILED_AND_CONTINUE_INDEPENDENT`, or `DEGRADED_PASS`. |
| E9 | Upstream Failure | Upstream Component Fails Terminally | Dependent components wait forever in `queued` status. | Trigger topological cascade: mark all transitive downstream nodes as `BLOCKED_DEPENDENCY_FAILED`, release all stage locks, continue unaffected subgraphs. |
| E10 | Network / Process Crash | Orchestrator process terminated mid-stage | All in-memory state and progress lost; must restart from scratch. | Atomic persistence (Write-Ahead Logging / State Checkpointing) after every state transition. Resumption algorithm loads last valid state. |
| E11 | Shared Stage Handover | Race condition during transition ($C_i: S_1 \to S_2$) | Potential window where $S_1$ is held while waiting for $S_2$ lock (deadlock risk). | Strict two-phase lock handover: Component moves to Intermediate Queue $Q_{S_2}$, releases $M_{S_1}$ immediately, then contends for $M_{S_2}$. |

---

## 3. Requirement 1 (R1): State & Concurrency Management

### 3.1 Mathematical Formulation of Stage Exclusivity
Let $\mathcal{C} = \{C_1, C_2, \dots, C_N\}$ be the set of components decomposed from the product requirements.  
Let $\mathcal{S} = \{S_{\text{Design}}, S_{\text{Code}}, S_{\text{Arbitration}}, S_{\text{Integration}}\}$ be the ordered set of pipeline stages.  
Let $\sigma(C_i, t) \in \mathcal{S} \cup \{\text{QUEUED}, \text{PASSED}, \text{FAILED}, \text{STALLED}\}$ denote the state of component $C_i$ at time $t$.

#### Invariant 1.1: Mutual Stage Exclusivity (Safety)
$$\forall S_j \in \mathcal{S}, \quad \forall t \ge 0, \quad \sum_{i=1}^{N} \mathbb{I}\Big(\sigma(C_i, t) = S_j\Big) \le 1$$
Where $\mathbb{I}(\cdot)$ is the indicator function. At no point in time may two or more components occupy the same stage $S_j$.

#### Invariant 1.2: Pipelining Parallelism (Liveness & Throughput)
At time $t$, up to $|\mathcal{S}|$ distinct components may execute concurrently, provided they occupy strictly distinct stages:
$$\sum_{j=1}^{|\mathcal{S}|} \mathbb{I}\left(\exists C_i \in \mathcal{C} \text{ s.t. } \sigma(C_i, t) = S_j\right) \le \min(N, |\mathcal{S}|)$$

---

### 3.2 Component Lifecycle State Machine

```
               [ INITIAL / UNINITIALIZED ]
                           │
                           ▼
                 [ QUEUED_FOR_DESIGN ] ◄────────┐ (If revision requires re-design)
                           │                    │
                           ▼ (Acquire Lock M_Design)
                      [ DESIGNING ]
                           │
                           ▼ (Release Lock M_Design)
                 [ QUEUED_FOR_CODE ] ◄──────────┤ (On Revision Verdict)
                           │                    │
                           ▼ (Acquire Lock M_Code)
                       [ CODING ]
                           │
                           ▼ (Release Lock M_Code)
               [ QUEUED_FOR_ARBITRATION ]
                           │
                           ▼ (Acquire Lock M_Arbitration)
                 [ EXECUTING_SANDBOX ]
                           │
                           ▼
                     [ CRITIQUING ]
                           │
                           ▼
                    [ ADJUDICATING ]
                           │
             ┌─────────────┴──────────────┐
             │                            │
             ▼ (Verdict = Pass)           ▼ (Verdict = Revise & rev < 3)
     [ COMPONENT_PASSED ]         [ REVISION_QUEUED ] ───► [ QUEUED_FOR_CODE ]
             │                            │
             │                            ▼ (Verdict = Revise & rev >= 3 / Unrecoverable)
             │                    [ COMPONENT_FAILED ]
             │                            │
             ▼                            ▼
  [ QUEUED_FOR_INTEGRATION ]     [ CASCADE_STALL_DEPENDENTS ]
             │
             ▼ (All non-failed components reach terminal state)
       [ INTEGRATING ] (Acquire Lock M_Integration)
             │
             ▼ (Release Lock M_Integration)
   [ PIPELINE_COMPLETED ]
```

---

### 3.3 Formal State Transition Table

| Source State | Event / Trigger | Guard Condition | Target State | Mutex / Resource Action |
|---|---|---|---|---|
| `UNINITIALIZED` | `DECOMPOSITION_COMPLETE` | Decomposition valid & acyclic | `QUEUED_FOR_DESIGN` | Insert into $Q_{\text{Design}}$ |
| `QUEUED_FOR_DESIGN` | Stage 1 Free & Scheduler Selects $C_i$ | $\forall u \in \text{deps}(C_i): \sigma(u) = \text{PASSED}$ | `DESIGNING` | Acquire $M_{\text{Design}}$ |
| `DESIGNING` | Design Agent Finish / Blueprint Valid | Schema validated | `QUEUED_FOR_CODE` | Release $M_{\text{Design}}$, Insert into $Q_{\text{Code}}$ |
| `DESIGNING` | LLM Fatal Error / Unrecoverable | Retries exhausted | `COMPONENT_FAILED` | Release $M_{\text{Design}}$, Notify Scheduler |
| `QUEUED_FOR_CODE` | Stage 2 Free & Scheduler Selects $C_i$ | $C_i$ has valid blueprint | `CODING` | Acquire $M_{\text{Code}}$ |
| `CODING` | CodeGen Agent Finish / Files Produced | File manifest non-empty | `QUEUED_FOR_ARBITRATION` | Release $M_{\text{Code}}$, Insert into $Q_{\text{Arbitration}}$ |
| `CODING` | LLM Fatal Error | Retries exhausted | `COMPONENT_FAILED` | Release $M_{\text{Code}}$, Notify Scheduler |
| `QUEUED_FOR_ARBITRATION` | Stage 3 Free & Scheduler Selects $C_i$ | $C_i$ has codebase & blueprint | `EXECUTING_SANDBOX` | Acquire $M_{\text{Arbitration}}$ |
| `EXECUTING_SANDBOX` | Docker Test Completes | Output captured within timeout $T_{\text{Docker}}$ | `CRITIQUING` | Retain $M_{\text{Arbitration}}$ |
| `EXECUTING_SANDBOX` | Docker Timeout / Crash | Elapsed $> T_{\text{Docker}}$ or Daemon failure | `SANDBOX_RETRY_OR_FAIL` | Cleanup container, retry or fail |
| `CRITIQUING` | All 3 Critics Finish | Feedbacks collected | `ADJUDICATING` | Retain $M_{\text{Arbitration}}$ |
| `ADJUDICATING` | Adjudicator Verdict = `pass` | All checks passed | `COMPONENT_PASSED` | Release $M_{\text{Arbitration}}$, Notify Dependents |
| `ADJUDICATING` | Adjudicator Verdict = `revise` | Revision Count $< K_{\text{max}}$ | `QUEUED_FOR_CODE` | Release $M_{\text{Arbitration}}$, Increment `rev_count`, Insert into $Q_{\text{Code}}$ |
| `ADJUDICATING` | Adjudicator Verdict = `revise` | Revision Count $\ge K_{\text{max}}$ | `COMPONENT_FAILED` | Release $M_{\text{Arbitration}}$, Trigger Cascade Stall |
| `ADJUDICATING` | Adjudicator Verdict = `error` | System API Failure | `TRANSIENT_RETRY_WAIT` | Retain or Release lock, backoff retry |
| `COMPONENT_PASSED` | All Components in $\mathcal{C}$ Reach Terminal State | At least 1 passed component | `QUEUED_FOR_INTEGRATION` | Insert into $Q_{\text{Integration}}$ |
| `QUEUED_FOR_INTEGRATION` | Stage 4 Free & All Tracks Complete | Pre-conditions met | `INTEGRATING` | Acquire $M_{\text{Integration}}$ |
| `INTEGRATING` | Integrator Finishes & Tests Pass | Unified codebase passes sandbox | `PIPELINE_COMPLETED` | Release $M_{\text{Integration}}$ |

---

### 3.4 Synchronization Primitives & Anti-Deadlock Handover
To guarantee **freedom from deadlocks** ($Liveness$) during stage handovers:
1. **Never Hold-and-Wait Across Stages:** A component leaving stage $S_j$ MUST unconditionally release mutex $M_{S_j}$ *before* attempting to acquire mutex $M_{S_{j+1}}$.
2. **Intermediate FIFO/Priority Stage Queues:** Between every two consecutive stages $S_j$ and $S_{j+1}$, an intermediate queue $Q_{S_{j+1}}$ buffers completed items.
3. **Deterministic Dispatcher Loop:** A centralized or actor-based Stage Dispatcher monitors ready components in $Q_{S_j}$ and assigns the stage mutex strictly when idle, eliminating distributed locking races.

---

## 4. Requirement 2 (R2): Edge Cases, DAG Resolution, & Crash Prevention

### 4.1 DAG Dependency Formulation & Resolution
Let $G = (V, E)$ be the dependency digraph where:
- $V = \{C_1, C_2, \dots, C_N\}$
- $E = \{(C_u, C_v) \mid C_v \text{ depends on } C_u\}$ ($C_u$ must pass before $C_v$ can start Stage 1).

#### Invariant 2.1: Eligibility Precondition
$$\text{Eligible}(C_v) \iff \forall C_u \in \text{InNeighbors}(C_v), \quad \sigma(C_u) = \text{COMPONENT\_PASSED}$$

#### 4.1.1 Upfront Cycle Detection (Kahn's Algorithm with Cycle Isolation)
1. Compute in-degree $\text{in\_deg}(v) = |\{u \in V \mid (u, v) \in E\}|$ for all $v \in V$.
2. Initialize queue $Q \leftarrow \{v \in V \mid \text{in\_deg}(v) = 0\}$.
3. While $Q$ is not empty:
   - Pop $u$ from $Q$, append to topological order $\mathcal{T}$.
   - For each neighbor $v$ of $u$:
     - $\text{in\_deg}(v) \leftarrow \text{in\_deg}(v) - 1$
     - If $\text{in\_deg}(v) = 0$, push $v$ into $Q$.
4. If $|\mathcal{T}| < |V|$:
   - **Cycle Detected:** The remaining vertices $V_{\text{cycle}} = \{v \in V \mid \text{in\_deg}(v) > 0\}$ form one or more directed cycles.
   - **Action:**
     - Extract Strongly Connected Components (Tarjan's algorithm).
     - Format structured cycle diagnostic report: `CYCLE_ERROR: [C_A -> C_B -> C_A]`.
     - Execute Cycle Resolution Policy (Prompt Master Architect with cycle error for 1 regeneration, or abort cleanly).

---

### 4.2 Failure Isolation & Cascade Stalling
When a component $C_{\text{fail}}$ enters `COMPONENT_FAILED`:
1. Identify all reachable downstream components:
   $$\text{Downstream}(C_{\text{fail}}) = \{C_w \in V \mid \exists \text{ path from } C_{\text{fail}} \text{ to } C_w \text{ in } G\}$$
2. For every $C_w \in \text{Downstream}(C_{\text{fail}})$:
   - If $\sigma(C_w) \in \{\text{UNINITIALIZED}, \text{QUEUED\_FOR_DESIGN}\}$:
     - Transition $\sigma(C_w) \leftarrow \text{STALLED\_DEPENDENCY\_FAILED}$.
     - Remove $C_w$ from stage queues.
3. For all disjoint components $C_{\text{indep}} \notin \text{Downstream}(C_{\text{fail}})$:
   - Continue processing through pipeline stages without interruption.
4. **State Integrity:** All completed blueprints, source files, and test logs of passed components are fully preserved in the system state store.

---

### 4.3 Comprehensive Timeout & Error Matrix

| Subsystem / Operation | Timeout ($T_{\text{max}}$) | Failure Signature | Mitigation & Recovery Action |
|---|---|---|---|
| Master Architect | 90s | HTTP 504 / Streaming socket timeout | Fallback to `gemini-3.5-flash-lite`. If second attempt fails, abort with decomposition failure. |
| Design Agent (Stage 1) | 60s | Incomplete JSON / Stream hang | Terminate stream, release $M_{\text{Design}}$, retry with temperature adjustment (max 2 retries). |
| CodeGen Agent (Stage 2) | 120s | Partial code output / Token limit | Fallback model; if persistent, log error, mark `COMPONENT_FAILED`, release $M_{\text{Code}}$. |
| Docker Creation / Pull | 60s | Docker Daemon hang / Network drop | Kill container creation, prune dangling containers, verify Docker status. |
| Sandbox Test Exec (Stage 3a) | 45s | Process hang (infinite loop in generated code) | Issue `SIGKILL` to container process, terminate container, return `ExecutionResult(success=False, logs="Execution Timed Out (45s)")`. |
| AI Critics (Stage 3b) | 45s (parallel) | 1 critic hangs / rate limits | Timeout per critic node; LangGraph collects available feedbacks; Adjudicator evaluates with available quorum or fallbacks. |
| Adjudicator (Stage 3c) | 30s | JSON parse error / API timeout | Fallback key & model; classify system errors as non-code errors to prevent bogus revision loops. |
| Integrator Agent (Stage 4) | 120s | Merge collision / Syntax failure | Re-run with strict collision-avoidance prompt; if still failing, package individual components as standalone bundle. |

---

### 4.4 State Persistence & Idempotency (Crash Recovery)
To guarantee zero corruption upon process crashes:
1. **Write-Ahead State Store (WASS):** Every state transition is written to disk atomically (e.g., `pipeline_state.json.tmp` $\to$ atomic rename `pipeline_state.json`) containing:
   - Complete Component Decomposition
   - State of all components and their revision counts
   - Stored artifacts (Blueprints, Codebases, Test Logs, Feedbacks, Verdicts)
   - Mutex assignment table and queue snapshots
2. **Crash Recovery Algorithm on Boot:**
   - Load `pipeline_state.json`.
   - Reconstruct DAG and compute in-progress stage locks.
   - Any component recorded in an active execution state (`DESIGNING`, `CODING`, `EXECUTING_SANDBOX`) at crash time is reverted to its preceding queued state (`QUEUED_FOR_DESIGN`, `QUEUED_FOR_CODE`, `QUEUED_FOR_ARBITRATION`).
   - Clean up any orphan Docker containers created in previous session (`docker ps -a --filter label=autodev`).
   - Resume Stage Dispatcher loop.

---

## 5. Adversarial Verification Criteria & Agent-as-Judge Rubric

An independent adversarial judge agent must evaluate the proposed pipeline algorithm design against the following strict 100-point rubric.

```
========================================================================================
                  MULTI-AGENT PIPELINE ADVERSARIAL RUBRIC (100 PTS)
========================================================================================

DIMENSION 1: MUTUAL EXCLUSION & CONCURRENCY SAFETY (Weight: 20 Points)
----------------------------------------------------------------------------------------
[ ] CR-1.1 (8 pts): Formal Stage Invariant Proof.
    The design mathematically and operationally proves that no two components can 
    occupy the same stage at timestamp t.
[ ] CR-1.2 (6 pts): Mutex / Queue Handover Rigor.
    The algorithm enforces release-before-acquire or two-phase lock handover without
    race windows.
[ ] CR-1.3 (6 pts): Concurrent Re-entrancy Protection.
    Stage dispatchers are thread-safe, async-safe, and immune to double-dispatch.

DIMENSION 2: DEADLOCK FREEDOM & LIVENESS GUARANTEES (Weight: 20 Points)
----------------------------------------------------------------------------------------
[ ] CR-2.1 (8 pts): Coffman Deadlock Conditions Annihilation.
    - Mutual Exclusion: Managed strictly without circular waits.
    - Hold and Wait: Eliminated via intermediate staging queues.
    - No Preemption: Graceful timeout preemption with state preservation.
    - Circular Wait: DAG topological scheduling prevents circular wait.
[ ] CR-2.2 (6 pts): Starvation & Priority Inversion Prevention.
    Scheduler utilizes fair DAG-depth / FIFO weighting so low-priority components
    do not starve behind long revision loops.
[ ] CR-2.3 (6 pts): Liveness Under Bounded Revisions.
    Revision loops are strictly bounded (K <= 3), guaranteeing termination in finite steps.

DIMENSION 3: DAG EDGE-CASE & GRAPH IMMUNITY (Weight: 20 Points)
----------------------------------------------------------------------------------------
[ ] CR-3.1 (8 pts): Deterministic Cycle Detection.
    Algorithm executes Kahn's / Tarjan's algorithm before pipeline startup and handles
    cycles without indefinite hanging.
[ ] CR-3.2 (6 pts): Phantom & Self-Dependency Immunity.
    Validates all u in deps(v) against active node set V and asserts u != v.
[ ] CR-3.3 (6 pts): Dynamic In-Degree Recalculation.
    Accurately decrements in-degree on component completion and unlocks eligible children.

DIMENSION 4: FAULT CONTAINMENT, TIMEOUTS & RESILIENCE (Weight: 20 Points)
----------------------------------------------------------------------------------------
[ ] CR-4.1 (8 pts): Granular Timeout Enforcement.
    Explicit timeouts at Docker, LLM, Critic, and Pipeline levels with guaranteed cleanup.
[ ] CR-4.2 (6 pts): Cascade Failure Isolation.
    Failing component isolates downstream dependents to STALLED without crashing
    independent tracks or orchestrator.
[ ] CR-4.3 (6 pts): Transient System Error Disambiguation.
    Distinguishes 429/503 API rate limits from code issues, preventing invalid revision loops.

DIMENSION 5: STATE INTEGRITY, IDEMPOTENCY & RECOVERY (Weight: 20 Points)
----------------------------------------------------------------------------------------
[ ] CR-5.1 (8 pts): Atomic State Checkpointing.
    State transitions and generated artifacts are snapshotted atomically to prevent corruption.
[ ] CR-5.2 (6 pts): Crash Resumption Idempotency.
    Restarting from a crash re-executes only the interrupted stage without re-running
    passed stages.
[ ] CR-5.3 (6 pts): Clean Resource Tear-Down (RAII).
    All containers, sockets, memory tarballs, and temp directories are guaranteed
    destroyed in `finally` blocks.

========================================================================================
PASS THRESHOLD: >= 90/100 Points with ZERO critical safety violations.
========================================================================================
```

---

## 6. Structure & Specification Requirements for the Design Document Deliverable

The final algorithmic design document (`autodev_pipeline_design.md`) must be structured with the following exact architectural sections:

```text
autodev_pipeline_design.md
├── 1. Architectural Blueprint & System Overview
│   ├── 1.1 Multi-Agent Pipeline Taxonomy & Stage Decomposition
│   └── 1.2 Core Architectural Principles & Invariants
├── 2. Formal Concurrency & State Machine Specification
│   ├── 2.1 Formal Mathematical Definitions & Notation
│   ├── 2.2 Discrete Stage Model & Mutex Topology
│   ├── 2.3 Comprehensive State Transition Matrix
│   └── 2.4 Pipelined Execution Handover Protocol
├── 3. DAG Dependency Resolution & Graph Algorithms
│   ├── 3.1 Graph Initialization & Schema Validation
│   ├── 3.2 Cycle Detection & Isolation Algorithm (Kahn / Tarjan)
│   ├── 3.3 Dynamic In-Degree Dispatcher & Priority Queue Scheduling
│   └── 3.4 Dependency Cascade Stalling on Upstream Failure
├── 4. Fault Tolerance, Timeouts, & Sandboxed Containment
│   ├── 4.1 Multi-Tier Timeout Architecture
│   ├── 4.2 Docker Sandbox Isolation & Resource Cleanup Protocol
│   ├── 4.3 LLM Rate-Limit Backoff & Model Fallback Hierarchy
│   └── 4.4 Arbitration Revision Loop & Circuit Breaker Logic
├── 5. State Persistence, Crash Recovery, & Idempotency
│   ├── 5.1 Write-Ahead State Persistence & Atomic Commit
│   └── 5.2 Crash Recovery & Pipeline Resumption Algorithm
├── 6. End-to-End Algorithmic Pseudocode
│   ├── 6.1 Master Pipeline Engine (Main Loop)
│   ├── 6.2 Stage Worker Processors (Design, Code, Arbitrate, Integrate)
│   └── 6.3 Recovery & Maintenance Subroutines
└── 7. Adversarial Verification & Self-Audit Evaluation
    ├── 7.1 Adversarial Threat Model & Attack Vector Analysis
    └── 7.2 Scorecard Against 100-Point Agent-as-Judge Rubric
```

---

## 7. Survey Verification & Acceptance Mapping

| Acceptance Criteria (from ORIGINAL_REQUEST.md) | Requirement Spec Section | Verification Method |
|---|---|---|
| **R1: State and Concurrency Management** (Strict stage occupancy exclusivity, component progression rules, synchronization primitives). | Sections 1.2, 3.1, 3.2, 3.3, 3.4, 6.2 | Formal Invariant 1.1 proof, mutex release-before-acquire rule, discrete state transition table. |
| **R2: Edge Case & Crash Prevention** (DAG dependency resolution, circular dependency detection/resolution, timeouts, crash handling, recovery, safe stalling without corruption). | Sections 2.2, 4.1, 4.2, 4.3, 4.4, 6.3 | Kahn's algorithm specification, cascade failure isolation rule, multi-tier timeout matrix, atomic state store. |
| **Adversarial Review Readiness** (Agent-as-judge model applying strict adversarial rubric). | Section 5 | Complete 100-point adversarial scorecard across 5 dimensions with explicit pass threshold. |
| **Algorithmic Deliverable Specification** (Clear design document structure and requirements). | Section 6 | Hierarchical specification blueprint for the final design document. |

---
*End of Survey & Specification Mining Report.*
