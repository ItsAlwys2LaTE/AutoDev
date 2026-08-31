# AutoDev: Autonomous Multi-Agent Software Engineering Platform

**Production Build: v2.2.1-Prod (Master Edition)**

🔗 **System Classification:** Autonomous Multi-Agent Software Engineering Platform | Built with Python 3.11+, FastAPI, Docker Engine, LangGraph, Monaco Editor, and Vanilla ES6+ Web Dashboard.

AutoDev is an autonomous, full-stack Software Development Life Cycle (SDLC) engineering platform that converts natural-language feature requests into fully realized, production-ready, multi-file software repositories. Rather than relying on fragile single-prompt code generation, AutoDev models the disciplined engineering methodologies of high-performing software teams. The system compiles requirements into formal specifications, decomposes complex architectures into mathematical Directed Acyclic Graphs (DAGs) of modular components, schedules concurrent development tracks using lease-backed single-occupancy locks, executes polyglot codebases inside isolated Docker sandboxes, verifies correctness through a LangGraph-powered multi-critic peer review network, and synthesizes components into unified, tested, and documented software packages.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Features](#2-core-features)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Autonomous Multi-Agent Subsystems](#5-autonomous-multi-agent-subsystems)
6. [Parallel DAG Pipeline Scheduler & Concurrency Control](#6-parallel-dag-pipeline-scheduler--concurrency-control)
7. [Smart API Key Balancer & Resilience Subsystem](#7-smart-api-key-balancer--resilience-subsystem)
8. [Universal Docker Sandbox & Live Preview Engine](#8-universal-docker-sandbox--live-preview-engine)
9. [Frontend UI & Embedded Monaco IDE](#9-frontend-ui--embedded-monaco-ide)
10. [Data Models & State Schemas](#10-data-models--state-schemas)
11. [API Reference](#11-api-reference)
12. [Setup & Execution](#12-setup--execution)
13. [Environment Variables](#13-environment-variables)
14. [Build System & Evolutionary Milestones](#14-build-system--evolutionary-milestones)
15. [Contributors](#15-contributors)

---

## 1. System Overview

AutoDev operates across two primary operational paradigms tailored to project scale:

- **Component-Wise Parallel DAG Mode (Complex Systems)** — For large-scale or multi-tier applications, the Master Architect decomposes requirements into an acyclic graph of loosely coupled components (e.g., Auth Service, Payment Gateway, Task API). Each component executes independently through staged tracks (`DESIGN` $\to$ `CODEGEN` $\to$ `CRITICS`), scheduled concurrently via a mathematical DAG engine. Passing components are merged by an Integrator Agent with unified routing and end-to-end tests.
- **Single-Pass Autonomous SDLC Mode (Direct Features)** — For focused modules and utility scripts, AutoDev executes a direct linear pipeline from requirements formalization to architectural blueprinting, multi-file code generation, automated Docker testing, multi-critic peer review, and documentation synthesis.

### End-to-End Autonomous Lifecycle

```
[ Natural Language Feature Request ]
                │
                ▼
[ Requirements Modeling Agent ] ──────────> RequirementsDocument (User Stories & Acceptance Criteria)
                │
                ▼
[ Master Architect Agent ] ───────────────> ComponentDecomposition (Acyclic Dependency Graph)
                │
                ▼
[ Parallel DAG Pipeline Scheduler ] ──────> Kahn Topological Sort & Lease-Backed StageMutex
                │
      ┌─────────┴─────────┐
      ▼                   ▼
[ Component Track 1 ] [ Component Track N ]
      │                   │
      ├─ DESIGN Stage (SystemDesignBlueprint & Pseudocode)
      ├─ CODEGEN Stage (Multi-File Polyglot Codebase & Unit Tests)
      └─ CRITICS Stage (Docker Sandbox + Correctness, Architecture & Completeness Peer Review)
      │                   │
      └─────────┬─────────┘
                ▼
[ Multi-Component Integrator Agent ] ─────> Unified Repositories, Cross-Module Wiring & E2E Tests
                │
                ▼
[ Documentation Generation Agent ] ───────> Comprehensive README.md, USER_GUIDE.md & ZIP Bundle
```

---

## 2. Core Features

| Feature | Description |
|---|---|
| **Autonomous Requirements Modeling** | Translates unstructured user prompts into structured `RequirementsDocument` schemas with user stories and testable acceptance criteria |
| **Master Architect Decomposition** | Partitions complex applications into modular, decoupled component specifications with explicit dependency edges and priority scoring |
| **Parallel DAG Pipeline Scheduler** | Graph-theoretic scheduler executing Kahn's topological sort, Tarjan's SCC cycle detection, and layered concurrency across components |
| **Deadlock-Free Stage Mutex** | Implements lease-backed locks with monotonic epoch fencing and atomic 2-phase handover, eliminating Coffman's hold-and-wait deadlock |
| **Priority Min-Heap Queue** | Dispatches ready components using a priority queue with a $-10,000$ priority score bonus for revised components to prevent pipeline stalls |
| **Polyglot Code Generation** | Produces production-ready typed code across Python, JavaScript, TypeScript, React, HTML/CSS, and shell scripts |
| **Universal Docker Sandbox v2.0** | Executes generated test suites inside ephemeral, isolated Docker containers with automated dependency injection (`pip`, `npm`) |
| **Dynamic Live Preview Engine** | Dynamically forwards development server ports (Vite, Next.js, HTTP servers) from Docker containers to browser preview iframes |
| **LangGraph Multi-Critic Arbitration** | Parallel peer-review network with Correctness (Gemini), Architecture (Mistral), and Completeness (Gemini) peer reviewers |
| **Closed-Loop Self-Correction** | Automatically routes Adjudicator revision plans and test logs back to CodeGen for up to 3 autonomous self-healing iterations |
| **Smart API Key Balancer** | Manages a 6-key Gemini pool and isolated Mistral key with Least-Connections routing, rate-limit tracking, and automatic cooldown decay |
| **Multi-Tier Model Fallback Matrix** | Implements graceful degradation: Tier 1 (`gemini-3.6-flash`) $\to$ Tier 2 (`gemini-3.5-flash-lite`) $\to$ Tier 3 (Mistral to Gemini pool failover) |
| **Universal Exponential Backoff** | Polymorphic decorator (`@with_exponential_backoff`) supporting sync/async functions, streams, full jitter, and error classification |
| **Embedded Monaco IDE** | Integrated VS Code editor with multi-file tabs, syntax highlighting, live editing, and revision diff comparison |
| **Rich-Text Document Editors** | User-friendly rich-text editors for requirements and blueprints with LLM-backed schema re-parsing |
| **Real-Time SSE Streaming** | Token-by-token streaming across all generation endpoints via Server-Sent Events (SSE) |
| **Live Terminal Log Drawer** | Collapsible real-time SSE log terminal streaming backend engine events, agent activations, and test logs |
| **Horizontal Carousel Dashboard** | Sleek light-themed multi-track UI with quick-jump pill navigation, stage badges, and action buttons |
| **Real-Time Token & Cost Tracker** | Intercepts SDK usage metadata and dynamically computes session token consumption and estimated cost in INR |
| **Prompt Guard Security Filter** | Defends against prompt injection attacks, system prompt extraction, and malformed/vague input prompts |
| **One-Click Production ZIP Export** | Bundles full project trees (source code, test suites, blueprints, documentation) into a downloadable `.zip` file via JSZip |
| **Write-Ahead State Store (WASS)** | Durable append-only event journal (`pipeline_events.jsonl`) and atomic snapshot checkpointing for crash recovery |

---

## 3. System Architecture

```
+====================================================================================================+
|                                    AUTODEV FULL-STACK TOPOLOGY                                     |
+====================================================================================================+
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  |                 BROWSER CLIENT DASHBOARD (backend/index.html - ES6 / Tailwind)               |  |
|  |                                                                                              |  |
|  |  +------------------------+  +---------------------------+  +-----------------------------+  |  |
|  |  | 5-Stage Stepper Header |  | Component Visualizer Grid |  | Embedded Monaco IDE         |  |  |
|  |  | Real-Time Cost Tracker |  | Horizontal Carousel Cards |  | Multi-File Diff Viewer      |  |  |
|  |  +------------------------+  +---------------------------+  +-----------------------------+  |  |
|  |              │                             │                               │                 |  |
|  |              ▼                             ▼                               ▼                 |  |
|  |  +----------------------------------------------------------------------------------------+  |  |
|  |  |             Live SSE Log Stream Drawer & Docker Interactive Preview Sandbox            |  |  |
|  |  +----------------------------------------------------------------------------------------+  |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                │                                                   |
|                        HTTP REST / SSE Stream  │  Polling Loop (/api/pipeline/tick)                |
|                                                ▼                                                   |
|  +----------------------------------------------------------------------------------------------+  |
|  |                               FASTAPI APPLICATION (backend/main.py)                          |  |
|  |                                                                                              |  |
|  |  +---------------------+   +-----------------------+   +----------------------------------+  |  |
|  |  | Core Workflow APIs  |   | Concurrency & DAG API |   | Log Stream & Security Router     |  |  |
|  |  | /api/generate-*     |   | /api/pipeline/*       |   | /api/logs/stream, PromptGuard    |  |  |
|  |  +---------------------+   +-----------------------+   +----------------------------------+  |  |
|  +----------------------------------------------------------------------------------------------+  |
|                 │                                                     │                            |
|                 ▼                                                     ▼                            |
|  +--------------------------------------------+     +-------------------------------------------+  |
|  |   AUTODEV DAG ENGINE (backend/autodev_...) |     |  SMART API KEY BALANCER (autodev_balancer)|  |
|  |                                            |     |                                           |  |
|  |  - PipelineDAG (Kahn / Tarjan SCC / FAS)   |     |  - KeyPoolManager (6x Gemini, 1x Mistral) |  |
|  |  - StageLockManager (StageMutex + Epoch)   |     |  - StrictStageReservationGuard (Mistral)  |  |
|  |  - StageQueueManager (Min-Heap + -10k Rev) |     |  - HealthTracker (Exponential Cooldown)   |  |
|  |  - StageHandoverProtocol (2-Phase Handover)|     |  - FallbackMatrixEngine (3.6 -> 3.5 -> Lite)|
|  |  - WASS Journal & CrashRecoveryEngine     |     |  - Universal Backoff (@with_backoff)      |  |
|  +--------------------------------------------+     +-------------------------------------------+  |
|                 │                                                     │                            |
|                 ▼                                                     ▼                            |
|  +--------------------------------------------+     +-------------------------------------------+  |
|  |       DOCKER EXECUTION SANDBOX ENGINE      |     |         MULTI-MODEL CLOUD PROVIDERS       |  |
|  |  - Ephemeral Container Isolation          |     |  - Google Gemini (gemini-3.6-flash, etc.) |  |
|  |  - Auto-Dependency Injection (npm / pip)   |     |  - Mistral AI (mistral-small-latest)      |  |
|  |  - Dynamic Live Preview Port Forwarding    |     |  - Groq Open-Weight Infrastructure        |  |
|  +--------------------------------------------+     +-------------------------------------------+  |
+====================================================================================================+
```

---

## 4. Technology Stack

### Backend & Core Infrastructure
- **FastAPI** — High-performance asynchronous HTTP REST framework and routing engine
- **Uvicorn** — Production ASGI web server serving endpoints and streaming connections
- **Pydantic (v2)** — Strict runtime schema validation, data serialization, and model definitions
- **LangGraph & LangChain Core** — StateGraph-based multi-agent orchestration and consensus arbitration
- **Docker SDK for Python (`docker`)** — Dynamic container lifecycle management, image pulling, and sandbox execution
- **SQLAlchemy** — Relational database modeling and transactional state management
- **python-dotenv** — Environment configuration and multi-tier credential discovery

### AI Inference & Provider SDKs
- **Google GenAI SDK (`google-genai`)** — Primary model connectivity (`gemini-3.6-flash`, `gemini-3.5-flash-lite`)
- **Mistral AI SDK (`mistralai`)** — Specialized architectural peer review (`mistral-small-latest`)
- **Groq SDK (`groq`)** — High-throughput open-weight model acceleration and fallbacks

### Frontend & User Interface
- **Vanilla ES6+ JavaScript** — Lightweight, reactive single-page dashboard without heavy build chains
- **Tailwind CSS (CDN)** — Modern utility-first styling with responsive, light-themed layouts
- **Monaco Editor** — Embedded VS Code browser editing engine with multi-tab file exploration and syntax highlighting
- **Server-Sent Events (SSE)** — Real-time token streaming and log output broadcasting
- **JSZip & FileSaver.js** — In-browser compression and one-click ZIP codebase exports

---

## 5. Autonomous Multi-Agent Subsystems

AutoDev organizes software engineering responsibilities into specialized agent personas:

### 5.1 Requirements Modeling Agent (`backend/agents/requirements_agent.py`)
Transforms natural-language feature requests into formal `RequirementsDocument` structures. It extracts functional objectives, non-functional constraints, structured user stories (`as_a`, `i_want_to`, `so_that`), and numbered, testable acceptance criteria.

### 5.2 Master Architect Agent (`backend/agents/master_architect.py`)
Analyzes full requirements specifications to determine architectural complexity. For non-trivial systems, it decomposes the problem into modular, loosely coupled components with explicit dependency edges (`dependencies_on`), priority orderings, and integration strategies.

### 5.3 System Design Blueprint Agent (`backend/agents/design_agent.py`)
Generates comprehensive architectural blueprints (`SystemDesignBlueprint`) for individual components. It specifies directory layouts, module purposes, technical dependencies, Docker container base images (`python:3.11-slim`, `node:20-alpine`), test runner commands, and detailed algorithmic pseudocode.

### 5.4 Autonomous CodeGen Agent (`backend/agents/codegen_agent.py`)
Translates design blueprints and requirements into production-ready polyglot code and comprehensive unit test suites. It enforces strict typing disciplines, handles nested directory creations, and accepts revision plans during autonomous self-healing loops.

### 5.5 LangGraph Multi-Critic Arbitration Network (`backend/agents/critics.py`)
Executes a fan-out peer review across three independent LLM critics:
- **Correctness Critic (`gemini-3.6-flash`)**: Analyzes sandbox test logs, assertion failures, exit codes, and test coverage metrics.
- **Architecture Critic (`mistral-small-latest` with Gemini fallback)**: Verifies adherence to blueprint file hierarchies, structural patterns, and defensiveness rules.
- **Completeness Critic (`gemini-3.6-flash`)**: Evaluates edge-case handling, input validation, null safety, and boundary condition guards.

### 5.6 Chief Software Adjudicator (`backend/orchestrator.py`)
A LangGraph state graph node that synthesizes peer-review feedbacks into a consolidated verdict (`pass`, `revise`, or `error`). On a `revise` verdict, it formulates an actionable revision plan and re-routes the task to CodeGen for up to 3 closed-loop iterations.

### 5.7 Multi-Component Integrator Agent (`backend/agents/integrator_agent.py`)
Takes independently verified component artifacts, reconciles cross-module import paths, builds root application routers, resolves shared state, and generates end-to-end integration test suites.

### 5.8 Documentation Generation Agent (`backend/agents/documentation_agent.py`)
Triggered upon pipeline completion to author production-ready `README.md` and `USER_GUIDE.md` files reflecting the generated codebase, installation steps, and API contracts.

---

## 6. Parallel DAG Pipeline Scheduler & Concurrency Control

The DAG scheduling engine (`backend/autodev_pipeline/`) coordinates multi-component pipeline concurrency while preventing deadlocks and race conditions.

```
+====================================================================================================+
|                    PARALLEL COMPONENT PIPELINE SCHEDULER (DAG ENGINE)                              |
+====================================================================================================+
|                                                                                                    |
|  +---------------------+   +-----------------------+   +----------------------------------+        |
|  |     PipelineDAG     |   |   StageLockManager    |   |        StageQueueManager         |        |
|  | Kahn Sort / Tarjan  |-->|  LeaseMutex / Epoch   |-->| Min-Heap (Score + FIFO Seq)      |        |
|  |  Cycle Resolution   |   |   Mutual Exclusion    |   | Priority Bonus (-10k Revision)   |        |
|  +---------------------+   +-----------------------+   +----------------------------------+        |
|             │                         │                                  │                         |
|             ▼                         ▼                                  ▼                         |
|  +----------------------------------------------------------------------------------------+        |
|  |              PipelineScheduler.step() / StageHandoverProtocol (2-Phase)                |        |
|  |       Phase 1: Release Lock -> Phase 2: Enqueue Target (0 Held Locks in Queue)         |        |
|  +----------------------------------------------------------------------------------------+        |
|             │                                                            │                         |
|             ▼                                                            ▼                         |
|  +-------------------------------------+      +-------------------------------------------+        |
|  | MultiTierWatchdog / PoisonPill CB   |      | WriteAheadStateStore (WASS) / Recovery    |        |
|  | Docker (45s/300s) | Lease TTL Sweep  |      | SHA-256 Event Journal + Atomic Snapshots  |        |
|  +-------------------------------------+      +-------------------------------------------+        |
+====================================================================================================+
```

### 6.1 Graph Foundations & `PipelineDAG`
Models components as vertices $V$ and dependencies as directed edges $E$ ($u \to v$ indicates component $v$ depends on $u$). Maintains dual adjacency indexing for fast ancestor/descendant resolution.

### 6.2 Kahn's Topological Sort & Layered Execution
Computes optimal layered execution plans $L_0, L_1, \dots, L_k$ in $O(|V| + |E|)$ time, sorting components by dependency prerequisites and deterministic `(priority_order, component_id)` tie-breakers.

### 6.3 Tarjan's SCC Cycle Detection & Resolution Policies
Detects directed cycles using Tarjan's strongly connected components algorithm and extracts exact cycle loops. Supports three deterministic policies:
- **`ABORT`**: Rejects invalid cyclic graphs immediately with HTTP 400.
- **`SAFE_STALL`**: Transitions cycle participants and downstream dependents to `STALLED`, allowing independent subgraphs to continue.
- **`FEEDBACK_ARC_SET_STUB`**: Iteratively cuts cycle back-edges and injects mock interface stubs.

### 6.4 Finite State Automaton (`ComponentStatus`)
Components transition through strict, immutable lifecycle states:
$$\text{CREATED} \to \text{PENDING\_DEPS} \to \text{READY} \to \text{IN\_STAGE} \to \text{COMPLETED}$$
Failed or problematic components transition safely to `STALLED`, `QUARANTINED`, or `FAILED`.

### 6.5 Lease-Backed `StageMutex` & Monotonic Epoch Fencing
Ensures single occupancy ($\le 1$ component per stage) across `DESIGN`, `CODEGEN`, and `CRITICS`. Every lease acquisition or eviction increments a monotonic epoch counter ($\text{Epoch}_{t+1} = \text{Epoch}_t + 1$), invalidating stale commits from delayed workers.

### 6.6 Atomic 2-Phase Handover (Deadlock Elimination)
`StageHandoverProtocol` provably eliminates Coffman's hold-and-wait deadlock condition:
1. **Phase 1 (Unconditional Release)**: The worker releases the active stage mutex and clears its lease token. The stage becomes immediately available to other queued components.
2. **Phase 2 (Target Enqueue)**: The component transitions to `READY` and enqueues in the next stage's priority queue holding **0 locks**.

### 6.7 Priority Min-Heap Queue Dispatching (`StageQueueManager`)
Computes priority scores for dispatching:
$$\text{Score}(c) = \text{priority\_order}(c) - \begin{cases} 10000 & \text{if } \text{is\_revision} = \text{True} \\ 0 & \text{otherwise} \end{cases}$$
Revised components jump ahead of unstarted components, eliminating revision queue starvation.

### 6.8 Discrete Tick Mechanics (`/api/pipeline/tick`)
Every scheduling tick (`PipelineScheduler.step()`):
1. Unblocks DAG nodes whose dependencies have reached `COMPLETED`.
2. Sweeps expired lease watchdogs and re-enqueues evicted components.
3. Dispatches highest-priority candidates into unoccupied stages.

### 6.9 Fault Tolerance, Watchdogs & Poison-Pill Isolation
- **`MultiTierWatchdog`**: Monitors Docker execution limits (45s unit timeout, 300s total cap) and sweeps expired stage leases.
- **`PoisonPillCircuitBreaker`**: Quarantines components exceeding 3 revision attempts and invokes `CascadePauseEngine` to stall downstream dependents while unaffected branches proceed.

### 6.10 Write-Ahead State Store (WASS) & Deterministic Recovery
Logs state mutations to an append-only JSONL journal (`pipeline_events.jsonl`) with SHA-256 integrity hashes and persists atomic snapshot checkpoints (`pipeline_snapshot.json`). Upon restart, `CrashRecoveryEngine` replays durable logs and reconstructs queues.

---

## 7. Smart API Key Balancer & Resilience Subsystem

The API key balancing engine (`autodev_balancer/` and `backend/retry.py`) provides quota isolation, rate-limit defense, and automatic failovers across LLM providers.

```
+===================================================================================================+
|                                AUTODEV BALANCER COMPONENT TOPOLOGY                                |
+===================================================================================================+
|                                                                                                   |
|  [ AutoDev Backend Agents: Requirements, Design, CodeGen, Critics, Adjudicator, Integrator ]       |
|                                                  │                                                |
|                                                  ▼                                                |
|  +---------------------------------------------------------------------------------------------+  |
|  |                   AutoDevLLMClient / AutoDevBalancerClient Facade Layer                     |  |
|  |           (generate_content, generate_content_stream, generate_gemini_content)              |  |
|  +---------------------------------------------------------------------------------------------+  |
|         │                                      │                                    │             |
|         ▼                                      ▼                                    ▼             |
|  +------------------------------+  +------------------------------+  +-------------------------+  |
|  | StrictStageReservationGuard  |  |         ModelRouter          |  |  TelemetryAggregator    |  |
|  | Mistral -> CRITIC_ARCH Only  |  | Stage -> Primary/Fallback    |  |  Chi-Square & CV Metric |  |
|  +------------------------------+  +------------------------------+  +-------------------------+  |
|                 \                                  /                                              |
|                  ▼                                ▼                                               |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  FallbackMatrixEngine                                       |  |
|  |          Tier 1: gemini-3.6-flash (6 Keys) -> Tier 2: gemini-3.5-flash (6 Keys)             |  |
|  |          Tier 3: Architecture Critic Mistral -> Gemini Pool Fallback                        |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                  │                                                |
|                                                  ▼                                                |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                    KeyPoolManager                                           |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  | RoutingStrategy: LeastConnections (Score = 1000*InFlight + TotalReqs), RR, WRR, LRU  |  |  |
|  |  | HealthTracker: Rate-Limit (Exp Backoff), Transient (5s), Permanent Disable, Decay     |  |  |
|  |  | TokenBucket: Capacity=60.0, FillRate=1.0/s                                           |  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                  │                                                |
|                        +-------------------------+-------------------------+                      |
|                        │                                                   │                      |
|                        ▼                                                   ▼                      |
|  +-------------------------------------------+   +---------------------------------------------+  |
|  | 6x Gemini API Keys (General SDLC Stages)  |   | 1x Mistral API Key (Architecture Critic)    |  |
|  | gemini-3.6-flash / gemini-3.5-flash       |   | mistral-small-latest                        |  |
|  +-------------------------------------------+   +---------------------------------------------+  |
+===================================================================================================+
```

### 7.1 Multi-Pool Key Topology & Discovery Hierarchy
- **6 Gemini API Keys (`ProviderEnum.GEMINI`)**: Distributed across general SDLC stages.
- **1 Mistral API Key (`ProviderEnum.MISTRAL`)**: Dedicated exclusively to Architecture peer review.
- **Discovery Precedence**: Resolves keys from `GEMINI_API_KEYS` (comma-separated), numbered keys (`GEMINI_API_KEY_1..6`), legacy stage-specific keys, or fallback `GEMINI_API_KEY`.

### 7.2 Strict Stage Reservation Guard (`StrictStageReservationGuard`)
Cryptographically restricts the Mistral API key to `CRITIC_ARCHITECTURE`. Unauthorized stages attempting to acquire the Mistral key are immediately blocked with `StageAccessDeniedError`.

### 7.3 Dynamic Health Tracking & Cooldown Decay
`HealthTracker` classifies errors and updates key statuses:
- `ACTIVE`: Eligible for immediate dispatch.
- `RATE_LIMITED`: Exponential backoff cooldown:
  $$T_{\text{cooldown}} = \min\left(300\text{s}, 15\text{s} \cdot 2^{N-1}\right)$$
- `COOLDOWN`: 5.0s transient server error pause.
- `DISABLED`: Permanently evicted due to invalid API credentials.

Keys automatically self-heal to `ACTIVE` once their monotonic cooldown expires.

### 7.4 Pluggable Load-Balancing Strategies
- **Least-Connections (Default)**: Scores candidates via $\text{Score} = 1000 \cdot \text{in\_flight} + \text{total\_requests}$.
- **Round-Robin & Weighted Round-Robin**: Deterministic cyclical or weighted distribution.
- **Least-Recently-Used (LRU)**: Selects keys with the oldest `last_used_timestamp`.
- **Token Bucket**: Enforces rate limiting ($C = 60.0$, $r = 1.0/\text{s}$).

### 7.5 Multi-Tier Fallback Matrix Engine
- **Tier 1 (Intra-Tier Rotation)**: Rotates across Gemini keys 1..6 on primary `gemini-3.6-flash`.
- **Tier 2 (Inter-Tier Model Degradation)**: Downgrades to `gemini-3.5-flash-lite` across all 6 keys only after Tier 1 is exhausted.
- **Tier 3 (Cross-Provider Critic Failover)**: Architecture Critic fails over from Mistral to the Gemini key pool.

### 7.6 Universal Exponential Backoff Decorator (`backend/retry.py`)
`@with_exponential_backoff` provides unified retry logic across sync functions, sync generators, async coroutines, and async generator streams with full jitter and fast-fail rules for non-retryable errors.

---

## 8. Universal Docker Sandbox & Live Preview Engine

AutoDev v2.0 isolates code execution and application previews inside ephemeral Docker containers (`backend/executor.py`).

### 8.1 Ephemeral Container Isolation
- Spawns isolated Docker containers matching blueprint image specifications (e.g. `python:3.11-slim`, `node:20-alpine`).
- Transfers generated codebases into containers via in-memory tar archives (`put_archive`), preventing host filesystem contamination.
- Enforces strict execution timeouts (45s test timeout, 300s total lifespan) and cleans up containers automatically upon completion.

### 8.2 Auto-Dependency Injection & Universal Testing
- Dynamically detects project dependencies and auto-injects installation steps (`pip install -r requirements.txt`, `npm install`).
- Executes stack-appropriate test runners (`pytest`, `npm test`, `jest`) and parses raw terminal logs and exit codes.
- Computes source code line coverage metrics via `pytest-cov` and surfaces total coverage percentages directly in the UI.

### 8.3 Dynamic Port Forwarding & Live Preview Server
- Starts long-running web application dev servers (`npm run dev`, `python app.py`) inside isolated Docker containers.
- Dynamically allocates and forwards host ports to container dev ports via `/api/preview/start`.
- Renders live interactive web applications inside an embedded iframe in the client dashboard.

---

## 9. Frontend UI & Embedded Monaco IDE

The AutoDev client interface (`backend/index.html`) is a zero-build Single-Page Application built with Vanilla ES6+ and Tailwind CSS.

### 9.1 Horizontal Scrolling Carousel & Pill Navigation
- Renders modular component tracks in a full-width horizontal carousel with `snap-x` mechanics, eliminating vertical scrolling clutter.
- Features an interactive **Pill Navigation Bar** allowing users to smoothly auto-scroll the carousel to any specific component.
- Displays live status badges (`Queued`, `Designing...`, `Action Required`, `Coding...`, `Evaluating...`, `Passed ✓`, `Failed ✗`).

### 9.2 Embedded Monaco IDE & Multi-File Explorer
- Integrates Microsoft's Monaco Editor engine directly into the browser.
- Supports multi-file tab navigation, syntax highlighting for all mainstream languages, inline code editing, and full-screen expansion.
- Includes a **Revision Diff Viewer** to inspect side-by-side modifications across self-correction iterations.

### 9.3 Rich-Text Document Editors & LLM Parsing
- Provides Word-like rich text editors for Requirements and Architecture Blueprints, allowing operators to freely refine specifications.
- Connects to backend LLM parsers (`POST /api/parse-requirements`, `POST /api/parse-blueprint`) to convert edited rich text back into strict JSON Pydantic schemas.

### 9.4 Real-Time SSE Log Stream Drawer
- Collapsible bottom terminal drawer connected to `GET /api/logs/stream`.
- Displays syntax-highlighted backend events, agent activations, API key assignments, and test execution logs in real time.

### 9.5 Real-Time Token & Cost Tracking
- Intercepts streaming SDK token metrics (`__USAGE__{prompt},{completion}`) and updates session token totals and estimated costs in INR ($84\text{ INR/USD}$).

### 9.6 Input Validation & Prompt Guard
- Validates prompt length ($\ge 10$ chars) and word count ($\ge 3$ words).
- Filters prompt injection attempts, system prompt extraction strings, and malformed inputs via `backend/prompt_guard.py`.

---

## 10. Data Models & State Schemas

### 10.1 `RequirementsDocument` (`backend/models.py`)
```json
{
  "project_title": "Task Management API",
  "overview": "RESTful task management system with authentication and CRUD endpoints.",
  "user_stories": [
    {
      "id": "US-001",
      "title": "User Registration",
      "as_a": "new user",
      "i_want_to": "register with email and password",
      "so_that": "I can access protected endpoints",
      "acceptance_criteria": [
        {
          "id": "AC-001",
          "description": "Reject duplicate email registration",
          "expected_behavior": "Returns HTTP 400 Bad Request"
        }
      ]
    }
  ]
}
```

### 10.2 `ComponentDecomposition` (`backend/models.py`)
```json
{
  "is_complex": true,
  "project_overview": "Decoupled microservice architecture for Task Management.",
  "shared_tech_stack": ["Python", "FastAPI", "pytest"],
  "shared_docker_image": "python:3.11-slim",
  "components": [
    {
      "component_id": "auth-service",
      "component_name": "Authentication Service",
      "description": "JWT authentication and user management.",
      "scoped_requirements": "Requirements for auth...",
      "dependencies_on": [],
      "priority_order": 1
    },
    {
      "component_id": "task-service",
      "component_name": "Task Service",
      "description": "Task creation, update, deletion, and query APIs.",
      "scoped_requirements": "Requirements for tasks...",
      "dependencies_on": ["auth-service"],
      "priority_order": 2
    }
  ],
  "integration_strategy": "Mount sub-routers into main FastAPI gateway application."
}
```

### 10.3 `SystemDesignBlueprint` (`backend/models.py`)
```json
{
  "architecture_overview": "FastAPI service with JWT token verification and SQLite persistence.",
  "tech_stack": ["Python", "FastAPI", "pytest"],
  "docker_image": "python:3.11-slim",
  "dev_server_command": "uvicorn main:app --host 0.0.0.0 --port 8000",
  "dev_server_port": 8000,
  "run_tests_command": "pytest --cov=.",
  "files": [
    {
      "file_name": "auth.py",
      "purpose": "Password hashing and JWT generation logic",
      "dependencies": ["pyjwt", "passlib"],
      "pseudocode": "def create_token(data): ...\ndef verify_token(token): ..."
    },
    {
      "file_name": "test_auth.py",
      "purpose": "Unit test suite for authentication module",
      "dependencies": ["pytest"],
      "pseudocode": "def test_token_creation(): ...\ndef test_invalid_token(): ..."
    }
  ]
}
```

### 10.4 `GeneratedCodeBase` & `CodeFile` (`backend/models.py`)
```json
{
  "files": [
    {
      "file_name": "auth.py",
      "source_code": "import jwt\n\ndef create_token(payload: dict) -> str:\n    return jwt.encode(payload, 'secret', algorithm='HS256')\n"
    },
    {
      "file_name": "test_auth.py",
      "source_code": "from auth import create_token\n\ndef test_create_token():\n    token = create_token({'user_id': 1})\n    assert isinstance(token, str)\n"
    }
  ]
}
```

### 10.5 `ExecutionResult` & `ArbitrationDecision` (`backend/models.py`)
```json
{
  "execution_result": {
    "success": true,
    "logs": "test_auth.py . [100%]\n1 passed in 0.03s\nTOTAL 10 0 100%"
  },
  "decision": {
    "verdict": "pass",
    "revision_plan": "All test assertions passed cleanly with 100% line coverage. Approved."
  }
}
```

---

## 11. API Reference

All backend endpoints are prefixed under `/api` (except root SPA route `/`).

### Endpoint Catalog (16 Routes)

| Route URL | Method | Module Location | Purpose / Description |
|---|---|---|---|
| `/` | `GET` | `backend/main.py:65` | Serves the single-page client dashboard (`backend/index.html`) |
| `/api/generate-requirements` | `POST` | `backend/main.py:75` | Streams `RequirementsDocument` JSON from natural-language prompt |
| `/api/decompose` | `POST` | `backend/main.py:91` | Streams `ComponentDecomposition` DAG specification |
| `/api/generate-design` | `POST` | `backend/main.py:129` | Streams `SystemDesignBlueprint` for a scoped component |
| `/api/generate-code` | `POST` | `backend/main.py:144` | Streams `GeneratedCodeBase` source files and test suites |
| `/api/parse-requirements` | `POST` | `backend/main.py:168` | Parses edited rich text back into a validated `RequirementsDocument` |
| `/api/parse-blueprint` | `POST` | `backend/main.py:232` | Parses edited rich text back into a validated `SystemDesignBlueprint` |
| `/api/execute-code` | `POST` | `backend/main.py:297` | Runs test suite inside an isolated Docker sandbox container |
| `/api/run-critics` | `POST` | `backend/main.py:305` | Executes LangGraph multi-critic peer review and adjudication |
| `/api/integrate` | `POST` | `backend/main.py:104` | Synthesizes verified components into a unified codebase |
| `/api/generate-documentation` | `POST` | `backend/main.py:331` | Streams production `README.md` and `USER_GUIDE.md` specifications |
| `/api/preview/start` | `POST` | `backend/main.py:361` | Launches Docker live preview container and returns dynamic port URL |
| `/api/pipeline/init` | `POST` | `backend/pipeline_api.py:48` | Initializes DAG graph topology and queues initial ready components |
| `/api/pipeline/tick` | `GET` | `backend/pipeline_api.py:65` | Discrete scheduling tick returning active and newly dispatched stages |
| `/api/pipeline/complete` | `POST` | `backend/pipeline_api.py:79` | Signals stage completion, releases locks, and triggers 2-phase handover |
| `/api/logs/stream` | `GET` | `backend/log_stream.py:32` | Real-time Server-Sent Events (SSE) log output stream |

---

## 12. Setup & Execution

### 12.1 Prerequisites
- **Python 3.11+** installed on the host machine.
- **Docker Desktop** (Windows / macOS) or **Docker Engine** (Linux) installed and running in the background.
- At least one **Google Gemini API Key** (multiple keys recommended for quota balancing).
- *(Optional)* **Mistral API Key** for dedicated Architecture Critic peer review.
- *(Optional)* **Groq API Key** for high-speed open-weight fallback inference.

### 12.2 Installation & Virtual Environment

Clone the repository and install backend dependencies:

```bash
# Clone repository
git clone https://github.com/ItsAlwys2LaTE/AutoDev.git
cd AutoDev

# Create and activate Python virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt
```

### 12.3 Environment Configuration

Create a `.env` file inside the `backend/` directory:

```dotenv
# =====================================================================
# Google Gemini API Keys (Single Key OR Multi-Key Pool)
# =====================================================================
# Option A: Single Key (Automatically shared across all stages)
GEMINI_API_KEY=your_gemini_api_key_here

# Option B: Dedicated Multi-Key Pool (Recommended for load balancing)
GEMINI_API_KEY_REQUIREMENTS=your_gemini_key_1
GEMINI_API_KEY_DESIGN=your_gemini_key_2
GEMINI_API_KEY_CODEGEN=your_gemini_key_3
GEMINI_API_KEY_CRITICS=your_gemini_key_4
GEMINI_API_KEY_ADJUDICATOR=your_gemini_key_5
GEMINI_API_KEY_INTEGRATION=your_gemini_key_6

# =====================================================================
# Optional Multi-Provider Keys
# =====================================================================
MISTRAL_API_KEY=your_mistral_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 12.4 Running the Application Server

Start the FastAPI backend with Uvicorn:

```bash
# From the backend/ directory
uvicorn main:app --reload --port 8000
```

The application client dashboard will be live at `http://localhost:8000`.

### 12.5 Executing an Autonomous Pipeline

1. Open `http://localhost:8000` in your web browser.
2. Enter a natural-language software feature request (e.g., *"Build a distributed task queue with worker heartbeats, job retries, and REST monitoring"*).
3. Click **Compile Requirements** to stream user stories and acceptance criteria.
4. Click **Decompose Architecture** to generate the component dependency graph.
5. Click **Launch Parallel Pipeline** to watch the DAG engine concurrently schedule and execute component tracks (`DESIGN` $\to$ `CODEGEN` $\to$ `CRITICS`).
6. Inspect generated code inside the embedded Monaco IDE, view live Docker sandbox test logs, and download the final project `.zip`.

### 12.6 Verification & Test Suite Execution

AutoDev includes an automated verification suite covering end-to-end integration flows, adversarial DAG stress tests, and balancer backoff mechanics:

```bash
# 1. Run Complete End-to-End Pipeline Integration Suite
pytest test_pipeline_flow.py -v

# 2. Run Adversarial Concurrency & Stress Challenger Suite
pytest test_pipeline_stress_challenge.py -v

# 3. Run Universal Exponential Backoff & Balancer Unit Tests
python -m unittest test_backoff.py -v
```

---

## 13. Environment Variables

| Variable | Required | Subsystem | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes* | LLM Client & Balancer | Universal fallback Google Gemini API key |
| `GEMINI_API_KEY_1` .. `_6` | No | Smart Balancer Pool | Numbered Gemini API keys for Least-Connections load distribution |
| `GEMINI_API_KEY_REQUIREMENTS` | No | Requirements Agent | Dedicated key for requirements modeling |
| `GEMINI_API_KEY_DESIGN` | No | Design Blueprint Agent | Dedicated key for architectural blueprinting |
| `GEMINI_API_KEY_CODEGEN` | No | Autonomous CodeGen | Dedicated key for multi-file code generation |
| `GEMINI_API_KEY_CRITICS` | No | Arbitration Network | Dedicated key for peer review critics |
| `GEMINI_API_KEY_ADJUDICATOR` | No | Adjudicator Node | Dedicated key for Chief Software Adjudicator |
| `GEMINI_API_KEY_INTEGRATION` | No | Integrator Agent | Dedicated key for cross-component integration |
| `MISTRAL_API_KEY` | No | Architecture Critic | Dedicated API key for Mistral `mistral-small-latest` |
| `GROQ_API_KEY` | No | Open-Weight Inference | API key for high-speed Groq inference fallbacks |

*\*At least one valid Gemini key is required for basic operation.*

---

## 14. Build System & Evolutionary Milestones

AutoDev has evolved through **78 commits across 9 architectural eras**, progressing from a basic prompt wrapper into a formally verified autonomous multi-agent engineering platform:

| Version Tag | Commit Hash | Milestone Scope | Core Architectural Capabilities |
|---|---|---|---|
| `v0.1.0-alpha` | `5e2d61d` | Phase 1 Requirements | Pydantic model definition, FastAPI scaffold, Gemini API integration |
| `v0.2.0-alpha` | `059979f` | Phase 2 SDLC Loop | Design Blueprint, CodeGen Agent, Subprocess execution sandbox |
| `v1.0.0-alpha` | `afdb38b` | Phase 3 Arbitration | LangGraph 3-Critic Consensus Network, Chief Adjudicator node |
| `v1.1.0-alpha` | `d2d37c2` | Self-Correction Loop | Closed-loop 3-iteration self-healing CodeGen retry loop |
| `v1.2.0-alpha` | `22b9c8a` | Rich-Text UX | Rich text document editing with Gemini schema parsing endpoints |
| `v1.3.0-alpha` | `9e6535c` | Monaco IDE & SSE | Monaco editor embed, SSE token streaming, `pytest-cov` metrics |
| `v1.3.1-alpha` | `0d80e90` | Balancer & Docs | Phase 3.5 Documentation Agent, Adjudicator key isolation |
| `v1.4.0-alpha` | `c395cf2` | Polyglot SDLC | Multi-language tech stack tracking, dynamic live preview |
| `v2.0.0` | `08b1693` | Docker Engine v2.0 | Isolated Docker container execution, auto-dependency injection |
| `v2.1.0` | `3fdbde3` | Component Pipeline | Master Architect, Integrator, modular multi-component pipeline |
| `v2.2.0-DAG` | `9166d0a` | Mathematical DAG | Kahn sort, Tarjan SCC, StageMutex, 2-phase handover, WASS |
| `v2.2.1-Prod` | `5502746` | Production Release | Live SSE terminal, Prompt Guard, horizontal carousel UI, Backoff |

---

## 15. Contributors

- **Aman Adil** — Bhilai Institute of Technology, Durg
- **Amit Sahu** — Bhilai Institute of Technology, Durg
- **Anupam Sharma** — Bhilai Institute of Technology, Durg *(Primary Author & Architecture Lead)*
