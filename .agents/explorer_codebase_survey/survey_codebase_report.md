# AutoDev Codebase Architectural Survey & Concurrency Analysis

**Date**: 2026-08-28T19:25:00Z  
**Surveyor**: Codebase Architecture Explorer (`explorer_codebase_survey`)  
**Target Codebase**: `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main`  
**Target Project Destination**: `C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo`  

---

## 1. Executive Architectural Overview

AutoDev is an autonomous multi-agent Software Development Life Cycle (SDLC) system designed to take a natural language feature request and autonomously generate requirements, system architecture blueprints, source code, execute automated test suites in isolated sandbox containers, and adjudicate quality via parallel multi-model AI critics.

### 1.1 Architectural Evolution
1. **v1.0.0 - v1.5.0 (Single-Pass Sequential Pipeline)**:
   - A linear waterfall execution model: `SYS.REQ_COMPILER` (Requirements) $\to$ `SYS.ARCH_MAPPER` (Design) $\to$ `SYS.CODE_GEN` (Code) $\to$ `SYS.SANDBOX_EXEC` (Pytest/Jest execution) $\to$ `SYS.ARBITRATION` (LangGraph critics & adjudication) $\to$ `SYS.DOC_GEN` (Documentation).
2. **v2.0.0 (Dockerized Execution & Embedded Preview Engine)**:
   - Docker Python SDK integration (`docker.from_env()`) replacing native host temp directory execution.
   - Dynamic port forwarding for live browser previews via iframe.
3. **v2.1.0 (Component-wise Pipelined Architecture)**:
   - Introduction of the `MasterArchitect` agent (`master_architect.py`) to classify complexity and decompose large applications into standalone `ComponentSpec` units with defined DAG dependencies (`dependencies_on`) and priority order (`priority_order`).
   - Introduction of the `IntegratorAgent` (`integrator_agent.py`) to merge independently generated and tested components into a unified application.
   - Staged concurrent pipeline orchestrator implemented on the client-side (`backend/index.html`).

---

## 2. Component, Agent, and Stage Execution Model

### 2.1 Agent Catalog & Execution Contracts

| Agent | File Path | LLM Model(s) | Input Schema | Output Schema | Execution Mode |
|---|---|---|---|---|---|
| **Requirements Agent** | `backend/agents/requirements_agent.py:10` | `gemini-3.6-flash` (fallback: `gemini-3.5-flash-lite`) | `FeatureRequestInput` (string) | `RequirementsDocument` (`models.py:20`) | SSE Token Stream (`generate_content_stream`) |
| **Master Architect** | `backend/agents/master_architect.py:9` | `gemini-3.6-flash` (fallback: `gemini-3.5-flash-lite`) | `RequirementsDocument` (`models.py:20`) | `ComponentDecomposition` (`models.py:88`) | SSE Token Stream (`generate_content_stream`) |
| **Design Agent** | `backend/agents/design_agent.py:10` | `gemini-3.6-flash` (fallback: `gemini-3.5-flash-lite`) | `RequirementsDocument` + `component_context` (string) | `SystemDesignBlueprint` (`models.py:35`) | SSE Token Stream (`generate_content_stream`) |
| **CodeGen Agent** | `backend/agents/codegen_agent.py:9` | `gemini-3.6-flash` (fallback: `gemini-3.5-flash-lite`) | `RequirementsDocument` + `SystemDesignBlueprint` (+ `previous_codebase`, `revision_plan`) | `GeneratedCodeBase` (`models.py:52`) | SSE Token Stream (`generate_content_stream`) |
| **Docker Sandbox Executor** | `backend/executor.py:25` | N/A (Docker Engine) | `GeneratedCodeBase` + `SystemDesignBlueprint` | `ExecutionResult` (`models.py:56`) | Synchronous Docker Container Exec (`exec_run`) |
| **Parallel Critics** | `backend/agents/critics.py:15,74,154` | Correctness: Gemini 3.6-flash; Architecture: Mistral-small (fallback: Gemini 3.5-flash-lite); Completeness: Gemini 3.6-flash | Requirements, Blueprint, Codebase, ExecutionResult | `CriticFeedback` (`models.py:63`) | Parallel invocation in LangGraph StateGraph |
| **Adjudicator** | `backend/orchestrator.py:34` | `gemini-3.6-flash` (fallback: `gemini-3.5-flash-lite`) | Concatenated `List[CriticFeedback]` | `AdjudicatorDecision` (`models.py:72`) | LangGraph Node returning verdict (`pass`/`revise`/`error`) |
| **Integrator Agent** | `backend/agents/integrator_agent.py:12` | `gemini-3.6-flash` (fallback: `gemini-3.5-flash-lite`) | `RequirementsDocument` + `ComponentDecomposition` + `List[ComponentResult]` | `GeneratedCodeBase` (`models.py:52`) | SSE Token Stream (`generate_content_stream`) |
| **Documentation Agent** | `backend/agents/documentation_agent.py:15` | `gemini-3.6-flash` (fallback: `gemini-3.5-flash-lite`) | `RequirementsDocument` + `SystemDesignBlueprint` + `GeneratedCodeBase` | `DocumentationSet` (`documentation_agent.py:12`) | SSE Token Stream (`generate_content_stream`) |

### 2.2 Current Pipeline Scheduling & Lifecycle

In the current AutoDev implementation, the component pipeline lifecycle is coordinated almost entirely in browser JavaScript inside `backend/index.html` (lines 1452–1861, derived from `replace_pipeline.py`):

```text
[Master Architect: ComponentDecomposition]
                   │
                   ▼
  For each Component in DAG order (priority_order):
  State: 'queued'
                   │
                   ▼ (Check dependencies_on & pipelineLocks.design)
  State: 'designing'  ───►  /api/generate-design
                   │
                   ▼
  State: 'waiting_design' (User edits or reviews rich text)
                   │
                   ▼ (approveDesign -> /api/parse-blueprint)
  State: 'coding_queued'
                   │
                   ▼ (Check pipelineLocks.code)
  State: 'coding'  ───►  /api/generate-code
                   │
                   ▼
  State: 'critic_queued'
                   │
                   ▼ (Check pipelineLocks.critic)
  State: 'executing'  ───►  /api/execute-code (Docker sandbox pytest/jest)
                   │
                   ▼
  State: 'critiquing' ───►  /api/run-critics (LangGraph parallel critics -> Adjudicator)
                   │
         ┌─────────┴─────────┐
         │ Verdict == revise │ (revisionCount < 3)
         ▼                   │
  State: 'coding_queued' ◄───┘ (Auto-revising with revision_plan)
         │
         │ Verdict == pass OR Force Approved
         ▼
  State: 'passed' (ComponentResult saved to componentResults array)
                   │
                   ▼ (All components 'passed')
  [Integrator Agent: /api/integrate] ──► Final Codebase & Integration Tests ──► DocGen
```

---

## 3. Concurrency Bottlenecks, Race Conditions, and Failure Vectors

A forensic examination of the backend Python modules, git history, patch files, and frontend orchestrator reveals critical architectural vulnerabilities and failure modes:

### 3.1 Client-Side Orchestration & Ephemeral Pipeline State
- **Vulnerability**: The entire pipeline state machine (`componentStates`, `pipelineLocks`, `pipelineQueue`, `activeComponentCount`, `componentResults`) resides solely in browser memory (`backend/index.html:359–365, 1453–1475`).
- **Failure Impact**: If the user's browser tab reloads, drops connection, crashes, or encounters a client-side JavaScript runtime exception, the entire multi-agent pipeline state is irrevocably lost. There is **zero backend checkpointing or persistence** (no SQLite, JSON state file, or Redis).

### 3.2 Single-Slot Boolean Locking (`pipelineLocks`) & Deadlock Vulnerability
- **Vulnerability**: In `backend/index.html:1454, 1575–1609`, stage mutual exclusion is implemented using primitive boolean flags:
  ```javascript
  let pipelineLocks = { design: false, code: false, critic: false };
  ```
- **Failure Impact**:
  1. **Race Conditions**: `processPipeline()` is triggered asynchronously across multiple event handlers and promises. JavaScript's asynchronous microtask scheduling means multiple async paths can evaluate `!pipelineLocks.<stage>` before the lock is assigned `true`, causing stage collision.
  2. **Deadlock on Unhandled Exception**: If an API fetch call, network disconnect, or JSON streaming parser fails midway inside `startComponentDesign`, `startComponentCode`, or `startComponentExecutionAndCritics`, the `catch` blocks attempt to reset the lock (`pipelineLocks.design = false`), but unhandled promise rejections or streaming aborts leave `pipelineLocks.<stage> = true` indefinitely, permanently deadlocking that stage for all remaining components.
  3. **No Stage Re-entrancy or Queue Ordering**: Components waiting for a stage are picked via a simple `.find()` on `pipelineQueue`, which can lead to starvation if revision loops continually re-insert failed components ahead of unstarted ones.

### 3.3 Dependency Graph Bypass & Out-of-Order Execution Hazards
- **Forensic Discovery (`patch.py:26–31`)**:
  In `patch.py`, the dependency validation check was altered from:
  ```javascript
  const depsPassed = c.dependencies_on.every(depId => 
      !componentStates[depId] || componentStates[depId].status === 'passed'
  );
  ```
  to:
  ```javascript
  const depsPassed = true;
  ```
  While `replace_pipeline.py` partially restored the dependency check in `processPipeline()`, it failed to enforce topological sorting invariants or check for circular dependencies.
- **Failure Impact**: If Component B depends on Component A's data models or APIs, launching Component B before Component A has reached `passed` results in Component B designing and generating hallucinated, incompatible interfaces, causing cascading failure during Phase 4 (`/api/integrate`).

### 3.4 Global State Race Condition in Preview Engine
- **Vulnerability**: In `backend/main.py:251, 260–324`:
  ```python
  preview_container_id = None
  
  @app.post("/api/preview/start")
  def start_preview(payload: ExecuteInput):
      global preview_container_id
      ...
      if preview_container_id:
          try:
              old_c = client.containers.get(preview_container_id)
              old_c.stop(timeout=1)
              old_c.remove(force=True)
          except Exception:
              pass
      ...
      preview_container_id = container.id
  ```
- **Failure Impact**: Because `preview_container_id` is a module-level global variable without thread locks or session scoping, concurrent requests overwrite this identifier. Starting a preview for Component A while Component B is booting will forcefully terminate Component A's container or orphan Docker containers on the host machine.

### 3.5 Unbounded Execution & Blocking Sandbox Execution
- **Vulnerability**: In `backend/executor.py:80–83`:
  ```python
  exit_code, output = container.exec_run(
      cmd=f"sh -c '{run_tests_command}'",
      workdir="/workspace"
  )
  ```
- **Failure Impact**: `container.exec_run()` is called synchronously **without a timeout parameter**. If the LLM generates code containing an infinite loop (e.g., `while True:`, unresolved recursion, or a blocking dev server), the execution thread blocks indefinitely. In a concurrent pipeline, this ties up FastAPI worker threads, exhausts Docker resources, and prevents downstream stages from completing.

### 3.6 LLM Rate Limit Cascades & Quota Exhaustion
- **Vulnerability**: In `backend/orchestrator.py:100–124` and `backend/agents/critics.py`:
  The Arbitration Engine fans out to 3 parallel critics simultaneously (`Correctness`, `Architecture`, `Completeness`).
- **Failure Impact**: When multiple components run through the pipeline concurrently, parallel critic calls multiply LLM requests per minute (RPM) and tokens per minute (TPM). If a user uses a single Google Gemini API key across all agents (common in development), multiple concurrent workers hitting 3 critics simultaneously trigger HTTP `429 Too Many Requests`. Although fallback to `gemini-3.5-flash-lite` exists, if the fallback key is identical or also throttled, the Adjudicator receives error payloads and fails the pipeline.

### 3.7 Asynchronous State Mutation & Inconsistent Codebase Payloads
- **Vulnerability**: In `backend/index.html:1805–1820` (from `patch2.py`), the automated revision loop uses `setTimeout(..., 1500)` before calling `processPipeline()`.
- **Failure Impact**: If another event or user action triggers state transitions during the timeout interval, `state.revisionCount` and `state.status` can be modified concurrently, causing duplicate execution tasks or submitting stale `state.codebase` versions to the CodeGen agent.
- **Deduplication Defect**: In `approveComponent` (`backend/index.html:1851`), `componentResults.push({...})` unconditionally appends results without checking if `component_id` already exists. Re-running or re-approving a component results in duplicate component instances in the final integration payload.

---

## 4. Interfaces and Data Models for the New Pipeline Algorithm

To resolve these vulnerabilities, the new algorithmic design must replace client-side ad-hoc scheduling with a formal, backend-driven algorithmic pipeline engine. Below are the data models and contracts required:

### 4.1 Core Data Models (`models.py` extension)

```python
from enum import Enum
from typing import List, Dict, Optional, Set
from pydantic import BaseModel, Field
from datetime import datetime

class StageEnum(str, Enum):
    QUEUED = "QUEUED"
    DESIGN = "DESIGN"
    DESIGN_REVIEW = "DESIGN_REVIEW"
    CODEGEN = "CODEGEN"
    EXECUTION = "EXECUTION"
    ARBITRATION = "ARBITRATION"
    REVISION = "REVISION"
    PASSED = "PASSED"
    FAILED = "FAILED"
    STALLED = "STALLED"
    CANCELLED = "CANCELLED"

class StageLockPolicy(str, Enum):
    EXCLUSIVE_STAGE = "EXCLUSIVE_STAGE"      # R1: Strictly at most 1 component per stage
    CONCURRENT_ACROSS_STAGES = "CONCURRENT"  # Components can occupy DIFFERENT stages simultaneously

class ComponentExecutionRecord(BaseModel):
    component_id: str
    stage: StageEnum
    stage_entered_at: datetime
    revision_count: int = 0
    max_revisions: int = 3
    timeout_seconds: int = 120
    blueprint: Optional[SystemDesignBlueprint] = None
    codebase: Optional[GeneratedCodeBase] = None
    execution_result: Optional[ExecutionResult] = None
    critique_feedbacks: List[CriticFeedback] = Field(default_factory=list)
    adjudicator_decision: Optional[AdjudicatorDecision] = None
    error_message: Optional[str] = None

class DependencyGraphSpec(BaseModel):
    nodes: Dict[str, ComponentSpec]
    adjacency_list: Dict[str, List[str]]    # component_id -> list of dependent component_ids
    in_degree: Dict[str, int]               # component_id -> count of unmet dependencies
    topological_order: List[str]

class PipelineStateSnapshot(BaseModel):
    pipeline_id: str
    status: str                             # IDLE, RUNNING, PAUSED, COMPLETED, FAILED, STALLED
    active_stage_occupants: Dict[StageEnum, Optional[str]] # Stage -> component_id holding the lock (R1)
    components: Dict[str, ComponentExecutionRecord]
    completed_components: List[str]
    failed_components: List[str]
    stalled_components: List[str]
    event_log: List[Dict[str, str]]
```

### 4.2 Required Algorithmic Interfaces

1. **`IPipelineDAGResolver`**:
   - **`validate_dag(components: List[ComponentSpec]) -> Tuple[bool, Optional[str]]`**: Detects cycles (using Kahn's algorithm or Tarjan's strongly connected components algorithm) and validates dependency existence.
   - **`get_ready_queue(snapshot: PipelineStateSnapshot) -> List[str]`**: Returns components whose `dependencies_on` are 100% in `PASSED` status and who are currently in `QUEUED` state.

2. **`IStageConcurrencyController` (Enforces R1 Requirement)**:
   - **`acquire_stage_lock(stage: StageEnum, component_id: str) -> bool`**: Atomically grants stage entry if and only if `active_stage_occupants[stage] is None`.
   - **`release_stage_lock(stage: StageEnum, component_id: str) -> None`**: Atomically releases the stage lock, transitioning the stage to idle and notifying the scheduler.
   - **`can_advance(component_id: str, target_stage: StageEnum) -> bool`**: Verifies prerequisites (dependencies passed, previous stage completed, target stage lock available).

3. **`IRecoveryAndTimeoutManager` (Enforces R2 Requirement)**:
   - **`check_timeouts(snapshot: PipelineStateSnapshot) -> List[str]`**: Scans in-flight components exceeding `timeout_seconds`.
   - **`handle_stage_failure(component_id: str, stage: StageEnum, error: Exception) -> StageEnum`**: Implements circuit breakers, records error logs, releases stage lock, and routes component to `REVISION`, `STALLED`, or `FAILED`.
   - **`recover_pipeline(snapshot: PipelineStateSnapshot) -> bool`**: Attempts automatic recovery or puts pipeline in safe `STALLED` state without corrupting memory or Docker resources.

4. **`IAdversarialEvaluator`**:
   - Rubric integration hooks for an independent adversarial agent-as-judge to verify deadlock freedom, absence of race conditions, and graceful crash recovery.

---

## 5. Tooling, Testing Environments, and Execution Harnesses

### 5.1 Existing Tooling in Repo
- **FastAPI Backend Server** (`backend/main.py`):
  - Uvicorn server runtime with ASGI streaming (`StreamingResponse`) for SSE token streaming.
  - JSON Schema serialization and validation using Pydantic v2.
- **Docker Execution Sandbox** (`backend/executor.py`):
  - In-memory `tarfile` generation (`create_tar_from_codebase`) injecting virtual codebases into Docker containers.
  - Multi-stack Docker images: `python:3.11-slim`, `node:20-alpine`.
  - Automatic test framework execution: `pytest` and `npm test` with Jest + JSDOM.
- **LangGraph StateGraph Engine** (`backend/orchestrator.py`):
  - `langgraph.graph.StateGraph` with parallel fan-out / fan-in fan graphs, `Annotated[List[CriticFeedback], operator.add]`.
- **Multi-LLM Integration SDKs**:
  - `google-genai` (Gemini SDK v1/v2), `mistralai`, `groq`.
- **Frontend Workbench** (`backend/index.html`):
  - Embedded Monaco Editor with multi-tab code navigation and live diff inspection.
  - Interactive live preview iframe connected to dynamic Docker container ports.
  - Real-time token usage and cost calculation widget.

### 5.2 Gaps in Existing Test Infrastructure
- **Zero Repo-Level Unit Tests**: Currently, the repository contains **no test suites** for `orchestrator.py`, `executor.py`, `models.py`, or `main.py`.
- **No Mock Execution Harness**: All existing execution relies on active Docker daemons and live LLM API keys. A robust pipeline algorithm test harness must include deterministic mock agents, simulated stage latency, simulated random failures, simulated timeouts, and simulated circular dependencies.

---

## 6. Recommendations & Integration Strategy for the New Algorithm

1. **Relocate Pipeline State Machine to Backend**:
   - Decouple the pipeline algorithm entirely from browser JavaScript. Create a pure Python algorithmic engine in `C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo`.
2. **Implement Formal Stage Lock Token Management**:
   - Guarantee R1: No two components can occupy the same stage (`active_stage_occupants[stage] == component_id`).
   - Allow cross-stage pipelining: While Component A is in `CODEGEN`, Component B can occupy `DESIGN`, and Component C can occupy `ARBITRATION`.
3. **Strict DAG Cycle Validation & Deadlock Prevention**:
   - Enforce DAG topological validation at decomposition ingestion. If a circular dependency is detected, reject immediately or isolate the cycle.
4. **Execution Sandbox Hardening**:
   - Add explicit execution timeout wrappers (e.g., `timeout=30s`) in Docker `container.exec_run` and thread execution handlers.
   - Clean up Docker containers in a `finally` block or context manager with deterministic container UUID tagging.
5. **State Snapshotting & Audit Log**:
   - Emit timestamped state transitions to JSON/SQLite so crashes can resume from the last valid snapshot without loss of completed component artifacts.

---
*Report compiled by Codebase Architecture Explorer for the AutoDev Pipeline Algorithm Design Task.*
