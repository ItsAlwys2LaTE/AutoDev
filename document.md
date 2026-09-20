# AutoDev: Master Technical Architecture & System Documentation

> **Document Version**: 2.2.1-Prod (Master Edition)  
> **Repository Root**: `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main`  
> **Primary Author & Maintainer**: Anupam Sharma  
> **System Classification**: Autonomous Multi-Agent Software Engineering Platform  
> **Commit Span**: `c80d011` (Commit #01) to `5502746` (Commit #78, `HEAD -> main`)  
> **Target Runtimes**: Python 3.11+, FastAPI, Uvicorn, LangGraph, Docker Engine, Vanilla ES6+ Web Dashboard, Monaco Editor  
> **Verification Status**: Formally Verified across 4 Integration Tiers & Adversarial Stress Suites  

---

## Table of Contents

1. [Executive Architecture Overview](#1-executive-architecture-overview)
   - 1.1 [Core Mission & System Paradigm](#11-core-mission--system-paradigm)
   - 1.2 [Multi-Agent Collaboration Architecture](#12-multi-agent-collaboration-architecture)
   - 1.3 [Component-Wise Pipelined Execution Model](#13-component-wise-pipelined-execution-model)
   - 1.4 [High-Level Topology & Data Flow](#14-high-level-topology--data-flow)
2. [Timeline Format & Chronological Evolution (78 Commits Across 9 Eras)](#2-timeline-format--chronological-evolution-78-commits-across-9-eras)
   - 2.1 [Era 1: Initial Foundational Architecture & Requirements Modeling (Phase 1)](#21-era-1-initial-foundational-architecture--requirements-modeling-phase-1)
   - 2.2 [Era 2: Full SDLC Architecture, Autonomous CodeGen & Subprocess Sandbox (Phase 2)](#22-era-2-full-sdlc-architecture-autonomous-codegen--subprocess-sandbox-phase-2)
   - 2.3 [Era 3: Multi-Agent Arbitration Network & Closed-Loop Self-Correction (Phase 3)](#23-era-3-multi-agent-arbitration-network--closed-loop-self-correction-phase-3)
   - 2.4 [Era 4: Rich-Text Documents, Real-Time SSE Streaming & Monaco IDE (BUILD SYS v1.3.0.Alpha)](#24-era-4-rich-text-documents-real-time-sse-streaming--monaco-ide-build-sys-v130alpha)
   - 2.5 [Era 5: Critic Hardening, Documentation Agent & API Key Balancer (BUILD SYS v1.3.1.Alpha)](#25-era-5-critic-hardening-documentation-agent--api-key-balancer-build-sys-v131alpha)
   - 2.6 [Era 6: Polyglot SDLC & Universal Docker Sandbox Engine v2.0 (BUILD SYS v1.4.0.Alpha to v2.0)](#26-era-6-polyglot-sdlc--universal-docker-sandbox-engine-v20-build-sys-v140alpha-to-v20)
   - 2.7 [Era 7: Component-Wise Pipelined Architecture v2.1.0 & Modular Orchestration](#27-era-7-component-wise-pipelined-architecture-v210--modular-orchestration)
   - 2.8 [Era 8: Mathematical DAG Pipeline Engine Integration (`backend/autodev_pipeline`)](#28-era-8-mathematical-dag-pipeline-engine-integration-backendautodev_pipeline)
   - 2.9 [Era 9: Production Hardening, Concurrency Bug Fixes & UI Polish (HEAD / v2.2.1-Prod)](#29-era-9-production-hardening-concurrency-bug-fixes--ui-polish-head--v221-prod)
   - 2.10 [Comprehensive Milestone & Version Matrix](#210-comprehensive-milestone--version-matrix)
3. [Deep-Dive: Core Algorithm 1 — Parallel Component Pipeline Scheduler & DAG Engine](#3-deep-dive-core-algorithm-1--parallel-component-pipeline-scheduler--dag-engine)
   - 3.1 [Theoretical Motivation & Concurrency Challenges](#31-theoretical-motivation--concurrency-challenges)
   - 3.2 [Graph-Theoretic Foundations & `PipelineDAG`](#32-graph-theoretic-foundations--pipelinedag)
   - 3.3 [Kahn's Topological Sort & Layered Parallel Scheduling](#33-kahns-topological-sort--layered-parallel-scheduling)
   - 3.4 [Tarjan's Strongly Connected Components (SCC) & Cycle Extraction](#34-tarjans-strongly-connected-components-scc--cycle-extraction)
   - 3.5 [Deterministic Cycle Resolution Policies (`ABORT`, `SAFE_STALL`, `FEEDBACK_ARC_SET_STUB`)](#35-deterministic-cycle-resolution-policies-abort-safe_stall-feedback_arc_set_stub)
   - 3.6 [Finite State Machine & Component Automata (`ComponentStatus`)](#36-finite-state-machine--component-automata-componentstatus)
   - 3.7 [Concurrency Control & Monotonic Epoch Fencing (`StageMutex`, `StageLockManager`)](#37-concurrency-control--monotonic-epoch-fencing-stagemutex-stagelockmanager)
   - 3.8 [Elimination of Coffman's Deadlock Conditions & Atomic 2-Phase Handover](#38-elimination-of-coffmans-deadlock-conditions--atomic-2-phase-handover)
   - 3.9 [Priority Queue Min-Heap Dispatching (`StageQueueManager`)](#39-priority-queue-min-heap-dispatching-stagequeuemanager)
   - 3.10 [Discrete Tick Mechanics (`PipelineScheduler.step()` & `/api/pipeline/tick`)](#310-discrete-tick-mechanics-pipelineschedulerstep--apipipelinetick)
   - 3.11 [Fault Tolerance, Multi-Tier Watchdogs & Poison-Pill Isolation](#311-fault-tolerance-multi-tier-watchdogs--poison-pill-isolation)
   - 3.12 [Write-Ahead State Store (WASS) & Deterministic Crash Recovery](#312-write-ahead-state-store-wass--deterministic-crash-recovery)
   - 3.13 [Forensic Analysis & Root-Cause Resolution of Concurrency Hangs](#313-forensic-analysis--root-cause-resolution-of-concurrency-hangs)
4. [Deep-Dive: Core Algorithm 2 — Smart API Key Balancer Subsystem](#4-deep-dive-core-algorithm-2--smart-api-key-balancer-subsystem)
   - 4.1 [Architectural Overview & Multi-Pool Topology](#41-architectural-overview--multi-pool-topology)
   - 4.2 [3-Tier Environment Discovery Hierarchy](#42-3-tier-environment-discovery-hierarchy)
   - 4.3 [Strict Stage Isolation Guard (`StrictStageReservationGuard`)](#43-strict-stage-isolation-guard-strictstagereservationguard)
   - 4.4 [Dynamic Health Tracking, Error Classification & Exponential Cooldown Decay](#44-dynamic-health-tracking-error-classification--exponential-cooldown-decay)
   - 4.5 [Pluggable Load-Balancing Strategies & Selection Algorithms](#45-pluggable-load-balancing-strategies--selection-algorithms)
   - 4.6 [Multi-Tier Fallback Matrix Engine](#46-multi-tier-fallback-matrix-engine)
   - 4.7 [Universal Exponential Backoff Decorator (`backend/retry.py`)](#47-universal-exponential-backoff-decorator-backendretrypy)
   - 4.8 [Exhaustion Failure Modes & Diagnostic Telemetry](#48-exhaustion-failure-modes--diagnostic-telemetry)
   - 4.9 [Statistical Telemetry & Chi-Square Fairness Verification](#49-statistical-telemetry--chi-square-fairness-verification)
5. [Full Technical Specifications: Backend API Routes](#5-full-technical-specifications-backend-api-routes)
   - 5.1 [Endpoint Catalog (16 Routes)](#51-endpoint-catalog-16-routes)
   - 5.2 [Detailed Route Specifications & Schemas](#52-detailed-route-specifications--schemas)
   - 5.3 [Pydantic Domain Models Reference](#53-pydantic-domain-models-reference)
6. [Full Technical Specifications: Frontend UI Architecture & Logic](#6-full-technical-specifications-frontend-ui-architecture--logic)
   - 6.1 [Client Component Hierarchy & Layout Structure](#61-client-component-hierarchy--layout-structure)
   - 6.2 [Frontend State Machine & Stage Progression Automata](#62-frontend-state-machine--stage-progression-automata)
   - 6.3 [Polling Loop, SSE Log Stream & Event Handling](#63-polling-loop-sse-log-stream--event-handling)
   - 6.4 [Embedded Monaco Editor, Live Docker Preview & Security Controls](#64-embedded-monaco-editor-live-docker-preview--security-controls)
   - 6.5 [Integration Phase Revision Layout & Arbitration History Architecture](#65-integration-phase-revision-layout--arbitration-history-architecture)
   - 6.6 [Live Preview 3-Layer Defense System](#live-preview-3-layer-defense-system-premature-exit-prevention)
   - 6.7 [Post-Completion Iteration & Query Engine Architecture](#67-post-completion-iteration--query-engine-architecture)
   - 6.8 [Polyglot Dependency Isolation & Pre-Flight Environment Guarding (`pip: not found` Defense)](#68-cross-runtime-docker-execution-defense-prevention-of-sh-1-pip-not-found)
   - 6.9 [State Persistence Engine, In-Flight Phase Auto-Recovery & Dual-Button Control Plane](#69-state-persistence-engine-in-flight-phase-auto-recovery--dual-button-control-plane)
   - 6.10 [Polyglot Container Isolation, Test Runner Hijack Defense & Critic-Adjudicator Execution Alignment](#610-polyglot-container-isolation-test-runner-hijack-defense--critic-adjudicator-execution-alignment)
   - 6.11 [Substring Collision Defense (`sh: 1: go: not found` Prevention) & Integration Test Hardening](#611-substring-collision-defense-sh-1-go-not-found-prevention--integration-test-hardening)
   - 6.12 [Zero-Dependency In-Memory HTTP Test Client & Supertest Module Resolution Defense](#612-zero-dependency-in-memory-http-test-client--supertest-module-resolution-defense)
7. [Verification & Test Suite Documentation](#7-verification--test-suite-documentation)
   - 7.1 [Automated Integration Suite (`test_pipeline_flow.py`)](#71-automated-integration-suite-test_pipeline_flowpy)
   - 7.2 [Empirical Stress & Challenger Suite (`test_pipeline_stress_challenge.py`)](#72-empirical-stress--challenger-suite-test_pipeline_stress_challengepy)
   - 7.3 [Decorator & Resilience Unit Suite (`test_backoff.py`)](#73-decorator--resilience-unit-suite-test_backoffpy)
   - 7.4 [Formal Verification Execution Procedures](#74-formal-verification-execution-procedures)

---

## 1. Executive Architecture Overview

### 1.1 Core Mission & System Paradigm

AutoDev is an autonomous, full-stack Software Development Life Cycle (SDLC) engineering platform. Rather than acting as a simple prompt-and-response code generator, AutoDev models the multi-phase engineering methodology of high-performing human engineering teams:

```
[ Natural Language Feature Request ]
                │
                ▼
[ Phase 1: Requirements Modeling Agent ] ──────> RequirementsDocument (Pydantic Schema)
                │
                ▼
[ Phase 1.5: Master Architect Agent ] ──────────> ComponentDecomposition (DAG Definition)
                │
                ▼
[ Mathematical Parallel DAG Engine ] ──────────> Kahn Partitioning & StageMutex Allocation
                │
     ┌──────────┴──────────┐
     ▼                     ▼
[ Component Track 1 ] [ Component Track N ]
     │                     │
     ├─ DESIGN (SystemDesignBlueprint)
     ├─ CODEGEN (GeneratedCodeBase & Unit Tests)
     └─ CRITICS (Docker Sandbox + 3 LangGraph Peer Reviewers + Chief Adjudicator)
     │                     │
     └──────────┬──────────┘
                ▼
[ Phase 4: Integrator Agent ] ─────────────────> Unified Integrated Codebase & End-to-End Tests
                │
                ▼
[ Phase 5: Documentation Agent ] ──────────────> README.md, Architecture Specs & Production ZIP
```

### 1.2 Multi-Agent Collaboration Architecture

The platform partitions software engineering responsibilities into specialized agent personas:

1. **Requirements Modeling Agent (`backend/agents/requirements_agent.py`)**: Transforms unstructured, natural-language ideas into structured requirements featuring user stories, functional criteria, non-functional constraints, and acceptance criteria.
2. **Master Architect Agent (`backend/agents/master_architect.py`)**: Assesses product complexity. When a system comprises multiple distinct domains, it partitions requirements into modular, loosely coupled components with explicit dependency edges.
3. **System Design Blueprint Agent (`backend/agents/design_agent.py`)**: Authors comprehensive architectural blueprints containing file hierarchies, module purposes, technical dependencies, Docker container images, test runner commands, and algorithmic pseudocode.
4. **Autonomous CodeGen Agent (`backend/agents/codegen_agent.py`)**: Writes production-ready polyglot code and unit tests adhering to blueprint specifications and strict typing requirements. Supports autonomous self-healing via revision plans.
5. **Multi-Critic Arbitration Network (`backend/agents/critics.py`)**:
   - **Correctness Critic (Gemini 3.6-flash)**: Analyzes test execution logs, assertion failures, exit codes, and coverage metrics.
   - **Architecture Critic (Mistral `mistral-small-latest` / Gemini fallback)**: Verifies adherence to blueprint file hierarchies, structural patterns, and defensiveness rules.
   - **Completeness Critic (Gemini 3.6-flash)**: Scrutinizes edge cases, null boundaries, divide-by-zero vulnerabilities, and input sanitization.
6. **Chief Software Adjudicator (`backend/orchestrator.py`)**: Synthesizes multi-critic reports using LangGraph into a consolidated verdict (`pass`, `revise`, or `error`) and produces structured, actionable revision plans.
7. **Integrator Agent (`backend/agents/integrator_agent.py`)**: Stitches independently verified component codebases into a cohesive repository, resolving cross-module import paths and generating end-to-end integration tests.
8. **Documentation Agent (`backend/agents/documentation_agent.py`)**: Generates production-ready `README.md` and `USER_GUIDE.md` specifications upon pipeline completion.

### 1.3 Component-Wise Pipelined Execution Model

For non-trivial applications, monolithic single-prompt code generation fails due to LLM context limits and combinatorial explosion. AutoDev employs a **Component-Wise Pipelined Architecture (v2.1.0+)**:
- Software projects are partitioned into a Directed Acyclic Graph (DAG) of components $C = \{c_1, c_2, \dots, c_n\}$.
- Each component executes independently through 3 unit stages: $\text{DESIGN} \to \text{CODEGEN} \to \text{CRITICS}$.
- Concurrency across stages is governed by a **Discrete DAG Pipeline Scheduler**, allowing independent components to advance in parallel across different pipeline stages without race conditions.

### 1.4 High-Level Topology & Data Flow

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

## 2. Timeline Format & Chronological Evolution (78 Commits Across 9 Eras)

The AutoDev codebase represents 27 days of continuous evolutionary development (`2026-08-03` to `2026-08-29`), comprising **78 commits** organized across **9 architectural eras**.

```
   Aug 03              Aug 15              Aug 26-27           Aug 27 (AM)         Aug 27 (PM)
┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐
│   Era 1   │──────>│   Era 2   │──────>│   Era 3   │──────>│   Era 4   │──────>│   Era 5   │
│  Phase 1  │       │  Phase 2  │       │  Phase 3  │       │ Rich Text │       │ Balancer  │
│  v0.1.0   │       │  v0.2.0   │       │  v1.0-1.1 │       │  v1.2-1.3 │       │  v1.3.1   │
└───────────┘       └───────────┘       └───────────┘       └───────────┘       └───────────┘
                                                                                      │
   Aug 29 (Prod)       Aug 29 (AM)         Aug 28-29           Aug 27-28              │
┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐             │
│   Era 9   │<──────│   Era 8   │<──────│   Era 7   │<──────│   Era 6   │<────────────┘
│ Hardening │       │ DAG Engine│       │ Component │       │ Docker2.0 │
│  v2.2.1   │       │  v2.2.0   │       │  v2.1.0   │       │  v1.4-2.0 │
└───────────┘       └───────────┘       └───────────┘       └───────────┘
```

---

### 2.1 Era 1: Initial Foundational Architecture & Requirements Modeling (Phase 1)
- **Timeframe**: 2026-08-03
- **Milestone Version**: `v0.1.0-alpha`
- **Focus**: Genesis of AutoDev, Pydantic schema formalization, FastAPI backend scaffolding, Requirements Agent.

#### Commits
* **Commit #01 `[c80d011]`** (*2026-08-03 23:10:31 +0530*): `Initial commit`
  - *Author*: Anupam Sharma | *Files*: `README.md` (+2 lines)
  - *Context*: Initialized git repository baseline and mission statement.
* **Commit #02 `[5e2d61d]`** (*2026-08-03 23:12:09 +0530*): `Phase-1: Requirements Model`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/requirements_agent.py`, `backend/index.html`, `backend/main.py`, `backend/models.py`, `backend/requirements.txt` (+229 lines)
  - *Implementation*: Created Phase-1 Requirements Modeling Agent using Google Gemini API (`gemini-1.5-pro`/`gemini-pro`). Built Pydantic models (`RequirementsDocument`, `UserStory`, `AcceptanceCriteria`) and FastAPI endpoint `POST /api/generate-requirements`.
* **Commit #03 `[ec1a055]`** (*2026-08-03 23:15:24 +0530*): `Add files via upload`
  - *Author*: Anupam Sharma | *Files*: `README.md` (+84, -2 lines)
  - *Implementation*: Added comprehensive installation guide covering Python 3.10+ prerequisites, environment variables, and Gemini API setup.
* **Commit #04 `[b7b5441]`** (*2026-08-03 23:16:23 +0530*): `Update README.md`
  - *Author*: Anupam Sharma | *Files*: `README.md` (+2, -4 lines)
  - *Implementation*: Formatted markdown layout and badge references.

---

### 2.2 Era 2: Full SDLC Architecture, Autonomous CodeGen & Subprocess Sandbox (Phase 2)
- **Timeframe**: 2026-08-15
- **Milestone Version**: `v0.2.0-alpha`
- **Focus**: System Design Blueprint Agent, Code Generation Agent, Local Subprocess Executor.

#### Commits
* **Commit #05 `[059979f]`** (*2026-08-15 23:49:03 +0530*): `Phase-2 final commit`
  - *Author*: Anupam Sharma | *Files*: 9 files (+621, -103 lines)
  - *Implementation*: Created `backend/agents/design_agent.py` (`SystemDesignBlueprint` schema), `backend/agents/codegen_agent.py` (`GeneratedCodeBase` schema), `backend/executor.py` (subprocess test runner), and endpoints `POST /api/generate-design`, `POST /api/generate-code`, `POST /api/execute-code`.
  - *System Impact*: Completed the end-to-end SDLC generation loop: Requirements $\to$ Blueprint $\to$ Multi-File Codebase $\to$ Automated Pytest Verification.
* **Commit #06 `[85dcb7c]`** (*2026-08-15 23:49:47 +0530*): `Update README.md`
  - *Author*: Anupam Sharma | *Files*: `README.md` (-1 line)
  - *Implementation*: Cleaned up Phase 2 setup instructions.

---

### 2.3 Era 3: Multi-Agent Arbitration Network & Closed-Loop Self-Correction (Phase 3)
- **Timeframe**: 2026-08-26 to 2026-08-27 (Early Morning)
- **Milestone Version**: `v1.0.0-alpha` to `v1.1.0-alpha`
- **Focus**: LangGraph 3-Critic Arbitration Network, Chief Software Adjudicator, Autonomous Self-Correction Loop.

#### Commits
* **Commit #07 `[afdb38b]`** (*2026-08-26 23:35:49 +0530*): `feat: Phase 3 Arbitration Engine, updated UI, and Gemini 3.7 model support`
  - *Author*: Anupam Sharma | *Files*: 9 files (+499, -76 lines)
  - *Implementation*: Implemented `backend/agents/critics.py` featuring three independent critics (Correctness on Gemini, Architecture on Mistral/Groq, Completeness on Groq) and `backend/orchestrator.py` implementing a LangGraph `StateGraph` arbitration network fanning into the Chief Software Adjudicator.
* **Commit #08 `[bc5add7]`** (*2026-08-26 23:48:23 +0530*): `docs: Update README with missing Critic environment variables and correct Phase 4/5 roadmap milestones`
  - *Author*: Anupam Sharma | *Files*: `README.md` (+9, -3 lines)
  - *Implementation*: Documented `GEMINI_API_KEY`, `MISTRAL_API_KEY`, and `GROQ_API_KEY`.
* **Commit #09 `[3073ede]`** (*2026-08-26 23:58:50 +0530*): `chore: Rollback primary models from 3.7-flash to 3.6-flash due to API availability issues`
  - *Author*: Anupam Sharma | *Files*: 9 files (+9, -9 lines)
  - *Root Cause*: Upstream Google GenAI endpoints returned 503 UNAVAILABLE for `gemini-3.7-flash`.
  - *Fix*: Standardized primary inference models on stable `gemini-3.6-flash`.
* **Commit #10 `[d2d37c2]`** (*2026-08-27 00:16:58 +0530*): `feat: Implemented autonomous Self-Correction loop between Phase 3 and Phase 2b`
  - *Author*: Anupam Sharma | *Files*: 3 files (+72, -7 lines)
  - *Implementation*: Added `revision_count` and `revision_plan` parameters to `codegen_agent.py` and `index.html`, establishing an automated 3-iteration self-healing loop when the Adjudicator returns a `revise` verdict.
* **Commit #11 `[e126db0]`** (*2026-08-27 01:04:57 +0530*): `fix: Resolve Groq API JSON validation error by updating model name and strict JSON system prompt`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+2, -2 lines)
  - *Fix*: Injected strict JSON schema constraints into Groq prompts to eliminate response decoding crashes.
* **Commit #12 `[177356a]`** (*2026-08-27 01:07:08 +0530*): `fix: Update Groq model to stable llama3-70b-8192`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+1, -1 lines)
* **Commit #13 `[99d913d]`** (*2026-08-27 01:08:47 +0530*): `fix: Update Groq model to active llama-3.1-70b-versatile`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+1, -1 lines)
  - *Fix*: Upgraded context window to handle large architectural review payloads.
* **Commit #14 `[b1acddb]`** (*2026-08-27 01:12:53 +0530*): `fix: Update Groq critic to Llama 4 Scout (all previous Llama models decommissioned)`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+3, -3 lines)
* **Commit #15 `[71a4ccb]`** (*2026-08-27 01:17:18 +0530*): `fix: Revert Groq model back to openai/gpt-oss-120b per user request, maintain fixed JSON schema prompt`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+3, -3 lines)
* **Commit #16 `[82b99b4]`** (*2026-08-27 01:22:13 +0530*): `fix: Add missing HTML id 'codeBtnText' that was crashing the automated self-correction loop silently`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+2, -2 lines)
  - *Fix*: Added missing DOM ID `codeBtnText` in UI template, preventing JavaScript `TypeError: null` exceptions during automated self-correction iterations.

---

### 2.4 Era 4: Rich-Text Documents, Real-Time SSE Streaming & Monaco IDE (BUILD SYS v1.3.0.Alpha)
- **Timeframe**: 2026-08-27 (Morning)
- **Milestone Version**: `v1.2.0-alpha` to `v1.3.0-alpha`
- **Focus**: Rich-Text Document Editors, LLM Parsing Endpoints, Embedded Monaco IDE, Server-Sent Events (SSE), Test Coverage.

#### Commits
* **Commit #17 `[58d2828]`** (*2026-08-27 01:42:26 +0530*): `feat: Implement editable YAML formatting for Phase 1 Requirements output`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+14, -3 lines)
* **Commit #18 `[3b1a3ff]`** (*2026-08-27 01:43:10 +0530*): `feat: Implement editable YAML formatting for Phase 2 Architecture Blueprint output`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+15, -3 lines)
* **Commit #19 `[22b9c8a]`** (*2026-08-27 01:53:21 +0530*): `feat: Replace YAML editors with highly user-friendly Rich Text document editors; Add LLM-powered backend parsing endpoints; Update README`
  - *Author*: Anupam Sharma | *Files*: 3 files (+99, -22 lines)
  - *Implementation*: Replaced error-prone raw YAML textareas with intuitive Rich Text Document Editors; created backend endpoints `POST /api/parse-requirements` and `POST /api/parse-design` to reliably parse user-edited markdown into strict Pydantic models.
* **Commit #20 `[cc61090]`** (*2026-08-27 02:03:27 +0530*): `fix: Implement safeguard in Arbitration Engine to gracefully halt the automation loop upon API rate limits or systemic errors`
  - *Author*: Anupam Sharma | *Files*: 3 files (+8, -7 lines)
  - *Fix*: Guarded LangGraph Adjudicator node to emit `verdict="error"` instead of `verdict="revise"` when critics encounter API rate limits, preventing infinite billing loops.
* **Commit #21 `[e613681]`** (*2026-08-27 02:07:27 +0530*): `fix: Align rich text formatting templates with actual Pydantic schema field names (user_stories, files, etc.)`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+27, -4 lines)
* **Commit #22 `[1980589]`** (*2026-08-27 02:24:37 +0530*): `feat: Add Interactive Pipeline Stepper Visualization to frontend UI; Update README`
  - *Author*: Anupam Sharma | *Files*: 2 files (+90, -4 lines)
  - *Implementation*: Built 5-phase horizontal progress stepper component dynamically reflecting active execution phases.
* **Commit #23 `[faee7da]`** (*2026-08-27 02:25:29 +0530*): `feat: Add one-click Download Code as ZIP functionality using JSZip`
  - *Author*: Anupam Sharma | *Files*: 2 files (+38, -1 lines)
* **Commit #24 `[327e44d]`** (*2026-08-27 02:30:15 +0530*): `fix: Restore missing closing brace in generateRequirements() that caused a JS syntax error`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+1 line)
* **Commit #25 `[0d2be66]`** (*2026-08-27 02:38:39 +0530*): `feat: Implement Real-Time Streaming Output (SSE) for all generation phases`
  - *Author*: Anupam Sharma | *Files*: 6 files (+157, -69 lines)
  - *Implementation*: Converted all generation endpoints to stream token-by-token using `StreamingResponse`, eliminating UI latency blocking.
* **Commit #26 `[60d8ceb]`** (*2026-08-27 02:42:52 +0530*): `fix: Remove stale imports causing ImportError in uvicorn server startup`
  - *Author*: Anupam Sharma | *Files*: `backend/main.py` (-2 lines)
* **Commit #27 `[9e6535c]`** (*2026-08-27 02:49:19 +0530*): `feat: Implement fully interactive Embedded Monaco IDE in Phase 2b CodeGen output`
  - *Author*: Anupam Sharma | *Files*: 2 files (+101, -15 lines)
  - *Implementation*: Embedded Monaco Editor into the browser UI with multi-file tabs, syntax highlighting, and live editing capabilities.
* **Commit #28 `[38eda2c]`** (*2026-08-27 03:01:45 +0530*): `feat: Implement global token tracking and cost calculation widget, and update Phase terminology to BUILD versions`
  - *Author*: Anupam Sharma | *Files*: 5 files (+81, -14 lines)
  - *Implementation*: Injected `\n__USAGE__{prompt},{completion}` metadata into stream footers; built real-time token and cost estimation widget.
* **Commit #29 `[e0f16a9]`** (*2026-08-27 03:06:04 +0530*): `feat: Implement Test Coverage Analysis using pytest-cov and display metrics in UI`
  - *Author*: Anupam Sharma | *Files*: 3 files (+21, -5 lines)
  - *Implementation*: Added `--cov` flag to pytest executions in `backend/executor.py` and rendered test coverage percentages in the UI.
* **Commit #30 `[1435d50]`** (*2026-08-27 11:42:50 +0530*): `fix: Prevent usage metadata token from corrupting JSON stream mid-flight`
  - *Author*: Anupam Sharma | *Files*: 3 files (+21, -9 lines)
  - *Fix*: Separated token usage metadata from JSON payload to prevent `JSON.parse` failures during streaming.

---

### 2.5 Era 5: Critic Hardening, Documentation Agent & API Key Balancer (BUILD SYS v1.3.1.Alpha)
- **Timeframe**: 2026-08-27 (Afternoon to Night)
- **Milestone Version**: `v1.3.1-alpha`
- **Focus**: Resilient API key partitioning, 503 fallback routing, Phase 3.5 Documentation Agent, and whitelist defensive rules.

#### Commits
* **Commit #31 `[3cfdbd8]`** (*2026-08-27 11:46:40 +0530*): `fix: Add fallback to gemini-3.5-flash-lite for parsing endpoints to handle 503 UNAVAILABLE errors on primary model`
  - *Author*: Anupam Sharma | *Files*: `backend/main.py` (+38, -24 lines)
* **Commit #32 `[071257a]`** (*2026-08-27 11:49:43 +0530*): `fix: Create parent directories automatically in sandbox executor to support nested file generation`
  - *Author*: Anupam Sharma | *Files*: `backend/executor.py` (+1 line)
  - *Fix*: Added `os.makedirs(os.path.dirname(path), exist_ok=True)` before writing files in sandbox executor.
* **Commit #33 `[1f3d2b6]`** (*2026-08-27 11:52:36 +0530*): `fix: Strengthen test discovery by handling pytest exit code 5 and enforcing python naming conventions in design prompts`
  - *Author*: Anupam Sharma | *Files*: 2 files (+9, -4 lines)
  - *Fix*: Handled pytest exit code 5 (no tests collected) gracefully and reinforced `test_*.py` naming rules in design prompts.
* **Commit #34 `[5f589c2]`** (*2026-08-27 12:17:21 +0530*): `fix: Add type guard for Groq/Mistral APIs returning list instead of dict in critic responses`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+10 lines)
* **Commit #35 `[586e044]`** (*2026-08-27 12:21:29 +0530*): `fix: Add explicit import rule to CodeGen prompt to prevent recurring NameError on typing constructs`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/codegen_agent.py` (+1 line)
* **Commit #36 `[f3b0aa1]`** (*2026-08-27 12:26:13 +0530*): `fix: Add gemini-3.5-flash-lite fallback to Correctness Critic for 503 UNAVAILABLE errors`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+10, -3 lines)
* **Commit #37 `[f3fea34]`** (*2026-08-27 12:30:37 +0530*): `fix: Add gemini-3.5-flash-lite fallback to Adjudicator for 503 UNAVAILABLE errors`
  - *Author*: Anupam Sharma | *Files*: `backend/orchestrator.py` (+14, -6 lines)
* **Commit #38 `[5ad0d49]`** (*2026-08-27 12:43:53 +0530*): `feat: Implement Revision History tabs and Code Diff viewer to preserve and compare self-correction loop iterations`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+231, -4 lines)
* **Commit #39 `[bc3a3d4]`** (*2026-08-27 19:11:00 +0530*): `fix: Add rule 6 to CodeGen prompt to prevent importing builtins from stdlib modules (e.g. ZeroDivisionError from decimal)`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/codegen_agent.py` (+1 line)
* **Commit #40 `[14dd9ec]`** (*2026-08-27 20:13:43 +0530*): `feat: Use separate GEMINI_API_KEY_ADJUDICATOR for Adjudicator phase to balance API rate limits`
  - *Author*: Anupam Sharma | *Files*: `backend/orchestrator.py` (+1, -1 lines)
  - *Implementation*: Partitioned API key pools: isolated Adjudicator on `GEMINI_API_KEY_ADJUDICATOR` to avoid rate limit collisions with critics.
* **Commit #41 `[48a0596]`** (*2026-08-27 20:28:49 +0530*): `feat: Synchronize pipeline to explicitly support and whitelist robust edge-case handling (fixing infinite revision loops between completeness and architecture critics)`
  - *Author*: Anupam Sharma | *Files*: 4 files (+6, -2 lines)
  - *Fix*: Injected system instructions whitelisting defensive programming, boundary checks, and input guards as positive robustness features rather than unapproved blueprint deviations, ending infinite critic revision ping-pong loops.
* **Commit #42 `[3dd7f65]`** (*2026-08-27 20:56:31 +0530*): `fix: Provide blueprint to Completeness Critic (Groq) and constrain prompt to prevent out-of-scope feature suggestions`
  - *Author*: Anupam Sharma | *Files*: 2 files (+9, -4 lines)
* **Commit #43 `[1dd0628]`** (*2026-08-27 21:13:07 +0530*): `fix: Migrate Completeness Critic from Groq to Gemini to bypass 8k TPM limits on Groq free tier when passing the large blueprint context`
  - *Author*: Anupam Sharma | *Files*: 2 files (+27, -46 lines)
  - *Fix*: Migrated Completeness Critic permanently to Gemini 3.6-flash, bypassing Groq's 8,000 tokens-per-minute quota limit.
* **Commit #44 `[0d80e90]`** (*2026-08-27 21:30:35 +0530*): `feat: Implement Phase 3.5 Documentation Agent to automatically generate comprehensive README and documentation files`
  - *Author*: Anupam Sharma | *Files*: 3 files (+188 lines)
  - *Implementation*: Created `backend/agents/documentation_agent.py` (`DocumentationSet` model) and endpoint `POST /api/generate-documentation`.
* **Commit #45 `[04461e7]`** (*2026-08-27 21:31:18 +0530*): `docs: Update README with BUILD SYS.v1.3.1.Alpha and Phase 3.5 Documentation Agent`
  - *Author*: Anupam Sharma | *Files*: `README.md` (+8, -1 lines)
* **Commit #46 `[5e1b2dc]`** (*2026-08-27 21:36:08 +0530*): `feat: Show Documentation Agent only after arbitration completes and add prominent Final Download ZIP button`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+16, -2 lines)
* **Commit #47 `[bd6ae5c]`** (*2026-08-27 21:39:28 +0530*): `fix: Resolve SyntaxError caused by literal backslashes in documentation agent prompt strings`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/documentation_agent.py` (+5, -5 lines)
* **Commit #48 `[4d472f3]`** (*2026-08-27 23:06:50 +0530*): `feat: Implement Adjudicator API Key as universal fallback for all Critic Agents (Correctness, Completeness, Architecture) to prevent rate limits`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+46, -17 lines)
* **Commit #49 `[199fd06]`** (*2026-08-27 23:11:18 +0530*): `fix: Update fallback logic to conditionally use adjudicator key only on rate limit, else use 3.5-flash-lite on same key`
  - *Author*: Anupam Sharma | *Files*: `backend/agents/critics.py` (+59, -37 lines)
  - *Implementation*: Established dual-axis fallback routing: switch to `GEMINI_API_KEY_ADJUDICATOR` on HTTP 429 quota exhaustion; downgrade to `gemini-3.5-flash-lite` on the same key for HTTP 503 server busy errors.

---

### 2.6 Era 6: Polyglot SDLC & Universal Docker Sandbox Engine v2.0 (BUILD SYS v1.4.0.Alpha to v2.0)
- **Timeframe**: 2026-08-27 (Night) to 2026-08-28 (Evening)
- **Milestone Version**: `v1.4.0-alpha` to `v2.0.0`
- **Focus**: Polyglot tech stack support (HTML/JS/Python/React), dynamic FastAPI live preview endpoints, Dockerized execution sandbox v2.0.

#### Commits
* **Commit #50 `[c395cf2]`** (*2026-08-27 23:36:08 +0530*): `feat: Implement Polyglot support across all SDLC phases (HTML/JS/Python/etc) via dynamic execution sandbox and tech stack tracking`
  - *Author*: Anupam Sharma | *Files*: 8 files (+45, -30 lines)
* **Commit #51 `[e5925e4]`** (*2026-08-27 23:37:08 +0530*): `docs: Update README and UI to build SYS.v1.4.0.Alpha and document Polyglot feature`
  - *Author*: Anupam Sharma | *Files*: 2 files (+3, -2 lines)
* **Commit #52 `[78717aa]`** (*2026-08-28 01:29:33 +0530*): `feat: Implement Universal Testing Engine for all stacks and embed Live Preview UI into Monaco IDE`
  - *Author*: Anupam Sharma | *Files*: 7 files (+71, -14 lines)
* **Commit #53 `[badc58a]`** (*2026-08-28 11:58:10 +0530*): `fix: Auto-inject dependency installation (npm install / pip install) in executor sandbox to prevent command not found errors`
  - *Author*: Anupam Sharma | *Files*: `backend/executor.py` (+14, -1 lines)
* **Commit #54 `[9730ebd]`** (*2026-08-28 13:39:41 +0530*): `fix: Replace brittle Regex srcdoc injection with dynamic FastAPI Live Preview endpoints to fix ES6 module imports and 404s`
  - *Author*: Anupam Sharma | *Files*: 2 files (+68, -17 lines)
* **Commit #55 `[08b1693]`** (*2026-08-28 13:52:38 +0530*): `feat: Architect v2.0 Dockerized Execution and Preview Engine to securely compile complex React apps`
  - *Author*: Anupam Sharma | *Files*: 7 files (+180, -108 lines)
  - *Implementation*: Completely overhauled `backend/executor.py` to use Docker SDK (`docker.from_env()`). Streamed generated code via in-memory tar archives, mapped dynamic host ports, and enforced container resource isolation.
* **Commit #56 `[af95e5c]`** (*2026-08-28 14:01:44 +0530*): `docs: Update setup instructions for Docker v2.0 and clean up outdated project roadmap`
  - *Author*: Anupam Sharma | *Files*: `README.md` (+6, -8 lines)
* **Commit #57 `[e3e3d19]`** (*2026-08-28 14:06:51 +0530*): `feat: Update token cost UI to display in INR instead of USD`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+6, -5 lines)
* **Commit #58 `[4e2ef33]`** (*2026-08-28 15:10:51 +0530*): `fix: Update execute-code fetch payload to pass blueprint instead of run_tests_command to resolve 422 Pydantic validation error`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+1, -1 lines)
* **Commit #59 `[e91a8f5]`** (*2026-08-28 16:42:51 +0530*): `fix: Sanitize tarball extraction paths and prevent AI from placing projects in root subdirectories to fix Python manage.py Errno 2 bugs`
  - *Author*: Anupam Sharma | *Files*: 4 files (+15, -5 lines)
* **Commit #60 `[647c627]`** (*2026-08-28 20:57:46 +0530*): `fix: Update agent prompts to strictly enforce pytest test_*.py auto-discovery naming conventions to fix 0 items collected error`
  - *Author*: Anupam Sharma | *Files*: 2 files (+2, -2 lines)

---

### 2.7 Era 7: Component-Wise Pipelined Architecture v2.1.0 & Modular Orchestration
- **Timeframe**: 2026-08-28 (Night) to 2026-08-29 (Early Morning)
- **Milestone Version**: `v2.1.0`
- **Focus**: Master Architect Agent, Integrator Agent, Component Decomposition Schema, Multi-Track Visualizer Dashboard.

#### Commits
* **Commit #61 `[3fdbde3]`** (*2026-08-28 21:45:34 +0530*): `feat: Implement Component-wise Pipelined Software Architecturing (v2.1.0) with Master Architect and Integration Agents`
  - *Author*: Anupam Sharma | *Files*: 7 files (+718, -15 lines)
  - *Implementation*: Created `backend/agents/master_architect.py` (`ComponentDecomposition` schema) and `backend/agents/integrator_agent.py` (`POST /api/integrate`), allowing complex projects to be decomposed into modular components.
* **Commit #62 `[112c5bd]`** (*2026-08-28 23:02:44 +0530*): `fix(ui): Implement interactive, robust component pipeline dashboard`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+449, -276 lines)
* **Commit #63 `[f62341a]`** (*2026-08-28 23:10:14 +0530*): `fix(ui): Resolve javascript SyntaxError caused by template literals in pipeline orchestrator`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+448, -448 lines)
* **Commit #64 `[2858161]`** (*2026-08-28 23:33:20 +0530*): `fix(ui): Expand page width, fix pipeline concurrency override, correctly bind source_code and critic models`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+11, -13 lines)
* **Commit #65 `[e1240d8]`** (*2026-08-29 00:14:58 +0530*): `feat(ui): Automate code generation and arbitration loops, wait for manual approval only at final component validation`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+16, -11 lines)
* **Commit #66 `[079eada]`** (*2026-08-29 00:25:10 +0530*): `fix(ui): Enforce true staged pipeline concurrency and fix textarea rendering bug for design blueprint`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+70, -44 lines)
* **Commit #67 `[3c32b3f]`** (*2026-08-29 00:32:05 +0530*): `feat(ui): Restore readable rich-text formatting for design blueprint and wire up LLM parsing`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+31, -9 lines)
* **Commit #68 `[15f6e2a]`** (*2026-08-29 00:52:50 +0530*): `feat(ui): Restore Old UI component aesthetics and grid layout in pipeline`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+189, -78 lines)
* **Commit #69 `[56baaec]`** (*2026-08-29 00:58:49 +0530*): `fix(ui): Correct DOM element IDs in final integration phase to match Old UI components`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+8, -4 lines)

---

### 2.8 Era 8: Mathematical DAG Pipeline Engine Integration (`backend/autodev_pipeline`)
- **Timeframe**: 2026-08-29 (Morning)
- **Milestone Version**: `v2.2.0-DAG`
- **Focus**: Kahn's topological sort, Tarjan's SCC cycle detection, lease-backed `StageMutex`, atomic 2-phase handover, write-ahead state store (WASS).

#### Commits
* **Commit #70 `[9166d0a]`** (*2026-08-29 11:48:43 +0530*): `feat(pipeline): Integrate robust mathematical pipeline DAG algorithm into backend orchestrator`
  - *Author*: Anupam Sharma | *Files*: 14 files (+3909, -39 lines)
  - *Implementation*: Created `backend/autodev_pipeline/` package (`dag_engine.py`, `concurrency.py`, `models.py`, `scheduler.py`, `fault_tolerance.py`) and wired into `backend/pipeline_api.py`. Replaced ad-hoc polling with formal graph-theoretic scheduling.
* **Commit #71 `[24906a3]`** (*2026-08-29 12:11:34 +0530*): `fix(pipeline): provide missing required name positional argument to ComponentStateRecord in API`
  - *Author*: Anupam Sharma | *Files*: `backend/pipeline_api.py` (+4, -2 lines)
  - *Fix*: Extracted `name=c.get('component_name', c.get('component_id', 'Unnamed'))` in `/api/pipeline/init`, fixing `TypeError` on component creation.
* **Commit #72 `[69a7443]`** (*2026-08-29 12:15:55 +0530*): `fix(ui): sanitize unescaped control characters in JSON strings before parsing`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+40, -1 lines)
  - *Fix*: Added client-side regex pre-sanitization for raw control characters (`\n`, `\t`, `\r`) in LLM JSON output strings.
* **Commit #73 `[d805221]`** (*2026-08-29 12:22:48 +0530*): `fix(ui): Release DESIGN stage lock correctly in the DAG scheduler after approval`
  - *Author*: Anupam Sharma | *Files*: `backend/index.html` (+1 line)
  - *Fix*: Explicitly triggered `/api/pipeline/complete` with `stage="DESIGN"` upon user approval, releasing the `DESIGN` stage mutex and unblocking queued components.
* **Commit #74 `[311215c]`** (*2026-08-29 12:47:23 +0530*): `fix(pipeline): Increase lease timeout for UI mode and pass Master Plan to Critics`
  - *Author*: Anupam Sharma | *Files*: 118 files (+11061, -14 lines)
  - *Implementation*: Scaled default lease TTL from 30s to 3600s in `models.py` for human review; passed `master_decomposition` context into critic prompts to prevent false-positive critic rejections on partitioned microservices.

---

### 2.9 Era 9: Production Hardening, Concurrency Bug Fixes & UI Polish (HEAD / v2.2.1-Prod)
- **Timeframe**: 2026-08-29 (Afternoon to Evening)
- **Milestone Version**: `v2.2.1-Prod`
- **Focus**: Live Terminal SSE log stream, Prompt Guard security filter, UI horizontal carousel, universal exponential backoff.

#### Commits
* **Commit #75 `[7b98316]`** (*2026-08-29 12:56:36 +0530*): `feat(ui): implement live terminal log panel with SSE streaming`
  - *Author*: Anupam Sharma | *Files*: 3 files (+152 lines)
  - *Implementation*: Created `backend/log_stream.py` (`LogInterceptor` with SSE broadcast) and added collapsible live terminal log drawer to frontend dashboard.
* **Commit #76 `[8c52368]`** (*2026-08-29 13:06:12 +0530*): `feat(security): implement Input Validation and Prompt Guard`
  - *Author*: Anupam Sharma | *Files*: 3 files (+62, -4 lines)
  - *Implementation*: Created `backend/prompt_guard.py` with regex filters detecting prompt injection attacks, system prompt extraction, and vagueness violations.
* **Commit #77 `[84ee7cb]`** (*2026-08-29 13:14:18 +0530*): `fix(ui): rework pipeline stepper for parallel DAG engine components`
  - *Author*: Anupam Sharma | *Files*: 8 files (+275, -19 lines)
  - *Implementation*: Synchronized UI horizontal stepper with DAG engine states; expanded `backend/retry.py` with async/generator backoff support.
* **Commit #78 `[5502746]`** (*2026-08-29 18:24:43 +0530*): `style(ui): restyle component pipeline grid to horizontal carousel with light theme`
  - *Author*: Anupam Sharma | *Files*: 5 files (+341, -39 lines)
  - *Implementation*: Restyled component pipeline grid into an elegant, light-themed horizontal scrolling carousel; expanded `backend/retry.py` to 492 lines with polymorphic execution support, transient error classification, and full jitter.

---

### 2.10 Comprehensive Milestone & Version Matrix

| Version Tag | Commit Hash | Date | Milestone Scope | Core Architectural Capabilities |
|---|---|---|---|---|
| `v0.1.0-alpha` | `5e2d61d` (#02) | 2026-08-03 | Phase 1 Requirements | Pydantic model definition, FastAPI scaffold, Gemini API integration |
| `v0.2.0-alpha` | `059979f` (#05) | 2026-08-15 | Phase 2 SDLC Loop | Design Blueprint, CodeGen Agent, Subprocess execution sandbox |
| `v1.0.0-alpha` | `afdb38b` (#07) | 2026-08-26 | Phase 3 Arbitration | LangGraph 3-Critic Consensus Network, Chief Adjudicator node |
| `v1.1.0-alpha` | `d2d37c2` (#10) | 2026-08-27 | Self-Correction Loop | Closed-loop 3-iteration self-healing CodeGen retry loop |
| `v1.2.0-alpha` | `22b9c8a` (#19) | 2026-08-27 | Rich-Text UX | Rich text document editing with Gemini schema parsing endpoints |
| `v1.3.0-alpha` | `9e6535c` (#27) | 2026-08-27 | Monaco IDE & SSE | Monaco editor embed, SSE token streaming, pytest-cov metrics |
| `v1.3.1-alpha` | `0d80e90` (#44) | 2026-08-27 | Balancer & Docs | Phase 3.5 Documentation Agent, Adjudicator key isolation |
| `v1.4.0-alpha` | `c395cf2` (#50) | 2026-08-27 | Polyglot SDLC | Multi-language tech stack tracking, dynamic live preview |
| `v2.0.0` | `08b1693` (#55) | 2026-08-28 | Docker Engine v2.0 | Isolated Docker container execution, auto-dependency injection |
| `v2.1.0` | `3fdbde3` (#61) | 2026-08-28 | Component Pipeline | Master Architect, Integrator, modular multi-component pipeline |
| `v2.2.0-DAG` | `9166d0a` (#70) | 2026-08-29 | Mathematical DAG | Kahn sort, Tarjan SCC, StageMutex, 2-phase handover, WASS |
| `v2.2.1-Prod` | `5502746` (#78) | 2026-08-29 | Production Release | Live SSE terminal, Prompt Guard, horizontal carousel UI, Backoff |

---

## 3. Deep-Dive: Core Algorithm 1 — Parallel Component Pipeline Scheduler & DAG Engine

The scheduling engine is located in `backend/autodev_pipeline/` and exposed via `backend/pipeline_api.py`.

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

### 3.1 Theoretical Motivation & Concurrency Challenges

Monolithic execution of multi-component software suites faces severe concurrency hazards when multiple agents generate, test, and critique code asynchronously:
1. **Hold-and-Wait Coffman Deadlock**: Component in stage $S_i$ blocks waiting for stage $S_{i+1}$ while refusing to release the mutex on $S_i$.
2. **Stale State Commit (Split-Brain)**: A slow LLM call completes after its watchdog timeout, overwriting newly updated state.
3. **Queue Starvation of Revised Code**: Failed components returned for revision get placed at the tail of FIFO queues, delaying overall pipeline completion.
4. **Circular Dependency Loops**: Components with circular dependencies ($A \to B \to A$) block the pipeline permanently.

### 3.2 Graph-Theoretic Foundations & `PipelineDAG`

The dependency graph is modeled as a directed graph $G = (V, E)$ in `PipelineDAG` (`backend/autodev_pipeline/dag_engine.py`):
- **Vertices ($V$)**: Component state records `ComponentStateRecord`.
- **Edges ($E$)**: Dependency edge $(u, v) \in E$ denotes that component $v$ depends on component $u$ ($u \to v$).
- **Dual Adjacency Indexing**:
  - `_downstream[u] = {v1, v2, ...}`: Successor set ($u \to v$).
  - `_upstream[v] = {u1, u2, ...}`: Predecessor set ($u \to v$).

$$\text{deg}^-(v) = |\{u \in V \mid u \in \text{\_upstream}[v] \land u \in V\}|$$

### 3.3 Kahn's Topological Sort & Layered Parallel Scheduling

`PipelineDAG.compute_topological_plan()` executes Kahn's Algorithm ($O(|V| + |E|)$) with deterministic tie-breaking by `(priority_order, component_id)`:

1. Identify root layer $L_0 = \{v \in V \mid \text{deg}^-(v) = 0\}$.
2. Incrementally peel execution layers $L_0, L_1, \dots, L_k$:
   $$L_{i+1} = \left\{v \in V \setminus \bigcup_{j=0}^i L_j \;\Big|\; \forall u \text{ such that } (u, v) \in E, u \in \bigcup_{j=0}^i L_j\right\}$$
3. Compute critical path distance $\text{CP}(u)$ from node $u$ to any sink via reverse topological dynamic programming:
   $$\text{CP}(u) = 1 + \max_{(u, v) \in E} \text{CP}(v) \quad (\text{with } \text{CP}(\text{sink}) = 1)$$

### 3.4 Tarjan's Strongly Connected Components (SCC) & Cycle Extraction

`PipelineDAG.detect_cycles_tarjan()` runs Tarjan's DFS in $O(|V| + |E|)$ time, maintaining DFS discovery indices `indices[u]` and low-link values `lowlinks[u]`:

$$\text{lowlinks}[u] = \min \left( \text{indices}[u], \min_{(u, v) \in E, v \notin \text{visited}} \text{lowlinks}[v], \min_{(u, w) \in E, w \in \text{stack}} \text{indices}[w] \right)$$

An SCC represents a directed cycle if $|\text{SCC}| > 1$ or if a node contains a self-loop $(u, u) \in E$. `_extract_cycle_path_from_scc()` performs DFS traversal within the SCC subgraph to extract the exact closed cycle path $[u_1, u_2, \dots, u_k, u_1]$.

### 3.5 Deterministic Cycle Resolution Policies (`ABORT`, `SAFE_STALL`, `FEEDBACK_ARC_SET_STUB`)

When cycles are detected, `PipelineDAG.resolve_cycles()` applies one of three deterministic policies:
1. **`CycleResolutionPolicy.ABORT`**: Immediately aborts graph registration and returns HTTP 400.
2. **`CycleResolutionPolicy.SAFE_STALL`**: Identifies all cycle participants and their transitive downstream dependents, transitions them to `ComponentStatus.STALLED`, and allows independent acyclic subgraphs to proceed.
3. **`CycleResolutionPolicy.FEEDBACK_ARC_SET_STUB`**: Heuristic Feedback Arc Set removal that iteratively cuts cycle back-edges $(u, v)$ and injects interface mock stubs `stub::{u}_for_{v}` until the graph is acyclic.

### 3.6 Finite State Machine & Component Automata (`ComponentStatus`)

Every component is governed by an immutable finite state automaton defined in `ComponentStatus` (`backend/autodev_pipeline/models.py`):

```
                              +-----------------------+
                              |        CREATED        |
                              +-----------------------+
                                 /        |        \
            Has Dependencies    /         |         \   No Dependencies
                               v          |          v
        +--------------------------+      |      +--------------------+
        |       PENDING_DEPS       |      |      |       READY        |<-------------+
        +--------------------------+      |      +--------------------+              |
                     |                    |                |                         |
          Prerequisites Satisfied         |         Stage Acquired                   |
                     |                    |                |                         |
                     +------------------->+                v                         |
                                          |      +--------------------+              |
                                          |      |      IN_STAGE      |              |
                                          |      +--------------------+              |
                                          |        /     |    |     \                |
                                 Stall /  |       /      |    |      \  Critic Pass  |
                                 Failure  |      /       |    |       v (Next Stage) |
                                          |     /        |    |   +-----------+      |
                                          |    /         |    +-->| COMPLETED |      |
                                          v   v          |        +-----------+      |
                                     +---------+         |                           |
                                     | STALLED |         | Critic Revise (< 3)       |
                                     +---------+         +---------------------------+
                                          |              |
                                          |              | Critic Revise (>= 3) / Poison Pill
                                          v              v
                                     +--------+    +-------------+
                                     | FAILED |    | QUARANTINED |
                                     +--------+    +-------------+
```

#### State Transition Matrix (`VALID_TRANSITIONS`)
State mutations are validated by `can_transition_to(target)` and executed via `transition_to()`:

| From State | Permitted Target States | Trigger Condition |
|---|---|---|
| `CREATED` | `PENDING_DEPS`, `READY`, `STALLED`, `FAILED` | Initial DAG registration |
| `PENDING_DEPS` | `READY`, `STALLED`, `FAILED` | All upstream dependencies reach `COMPLETED` |
| `READY` | `IN_STAGE`, `STALLED`, `FAILED`, `COMPLETED` | Mutex acquired on target stage |
| `IN_STAGE` | `READY`, `COMPLETED`, `QUARANTINED`, `STALLED`, `FAILED` | Stage finished, lease expired, or critic verdict |
| `STALLED` | `READY`, `PENDING_DEPS`, `COMPLETED`, `FAILED` | Cycle broken or cascade pause lifted |
| `QUARANTINED` | `READY`, `COMPLETED`, `FAILED` | Circuit breaker manual override |
| `COMPLETED` | *(None - Terminal)* | Final success state |
| `FAILED` | *(None - Terminal)* | Final unrecoverable failure |

### 3.7 Concurrency Control & Monotonic Epoch Fencing (`StageMutex`, `StageLockManager`)

To guarantee strict single occupancy ($\le 1$ worker per stage) and prevent split-brain state corruption, `StageMutex` and `StageLockManager` (`backend/autodev_pipeline/concurrency.py`) implement lease-backed locks with strictly monotonic epoch fencing:

```python
@dataclass(frozen=True)
class LeaseToken:
    token_id: str
    component_id: str
    stage: StageEnum
    epoch: int
    acquired_at: float
    expires_at: float
    lease_duration_sec: float

    def is_valid(self, current_time: Optional[float] = None) -> bool:
        now = time.time() if current_time is None else current_time
        return now < self.expires_at
```

#### Monotonic Epoch Fencing Properties:
1. **Strict Monotonicity**: Every stage acquisition or forced eviction increments `_epoch_counter`:
   $$\text{Epoch}_{t+1} = \text{Epoch}_t + 1$$
2. **Stale Commit Invalidation**: When a worker finishes a stage, its lease token must match `_active_lease.epoch` and `_active_lease.token_id`. If a watchdog evicted the lease, the stage epoch counter was incremented, causing late worker commits to be safely rejected.

### 3.8 Elimination of Coffman's Deadlock Conditions & Atomic 2-Phase Handover

`StageHandoverProtocol.execute_handover()` implements a non-blocking 2-phase handover that provably eliminates the **Coffman Hold-and-Wait condition**:

```
[ Worker Finishing Stage S_i ]
              │
              ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 1: UNCONDITIONAL RELEASE                                         |
| 1. lock_manager.release_stage(S_i, component_id, lease_token)           |
| 2. Clear component.active_lease = None, component.current_stage = None   |
| 3. Mutex on S_i becomes FREE; immediately available to other workers   |
+─────────────────────────────────────────────────────────────────────────+
              │
              ▼
+─────────────────────────────────────────────────────────────────────────+
| PHASE 2: TARGET ROUTING & QUEUE ENQUEUE                                 |
| If next_stage != None:                                                  |
|    component.transition_to(ComponentStatus.READY)                       |
|    queue_manager.enqueue(next_stage, component_id, priority_order)      |
| Else:                                                                   |
|    component.transition_to(ComponentStatus.COMPLETED)                   |
+─────────────────────────────────────────────────────────────────────────+
```

#### Coffman Deadlock Conditions Elimination Matrix:
1. **Mutual Exclusion**: Strictly enforced via single-occupancy `StageMutex`.
2. **Hold and Wait**: **Eliminated** by Phase 1 release before Phase 2 queue enqueue. A waiting component holds **0 locks**.
3. **No Preemption**: Preemption is actively supported via watchdog lease revocation with epoch bumping.
4. **Circular Wait**: **Eliminated** by acyclic DAG dependencies and monotonic stage progression ($\text{DESIGN} \to \text{CODEGEN} \to \text{CRITICS}$).

### 3.9 Priority Queue Min-Heap Dispatching (`StageQueueManager`)

`StageQueueManager` manages per-stage min-heap priority queues using `QueueItem`:

```python
@dataclass(order=True)
class QueueItem:
    priority_score: int              # Primary sort key (lower = higher priority)
    arrival_sequence: int            # Monotonic insertion tie-breaker (FIFO)
    component_id: str = field(compare=False)
    enqueued_at: float = field(compare=False, default_factory=time.time)
    metadata: Dict[str, Any] = field(compare=False, default_factory=dict)
```

#### Priority Scoring Formulation:
$$\text{Score}(c) = \text{priority\_order}(c) - \begin{cases} 10000 & \text{if } \text{is\_revision} = \text{True} \\ 0 & \text{otherwise} \end{cases}$$

- **Revision Priority Preemption**: Revised components returning from `CRITICS` receive a $-10000$ priority score bonus, guaranteeing they jump ahead of unstarted components to prevent pipeline stalls.
- **Strict FIFO Tie-Breaking**: When priority scores are identical, `arrival_sequence` (monotonic counter) guarantees deterministic FIFO dispatching.

### 3.10 Discrete Tick Mechanics (`PipelineScheduler.step()` & `/api/pipeline/tick`)

`PipelineScheduler.step()` executes a 3-step scheduling cycle under `self._scheduler_lock`:

```
+=============================================================================+
|                      SCHEDULING TICK CYCLE: step()                          |
+=============================================================================+
|                                                                             |
|  STEP 1: DEPENDENCY RESOLUTION (Unblock DAG Nodes)                          |
|  1. Find nodes in CREATED or PENDING_DEPS where all upstream in COMPLETED   |
|  2. Transition unblocked nodes: CREATED/PENDING_DEPS -> READY              |
|  3. Enqueue unblocked nodes into StageQueueManager[DESIGN]                  |
|  4. Log DEPENDENCY_RESOLVED event to WASS                                   |
|                                                                             |
|  STEP 2: EXPIRED LEASE WATCHDOG SWEEP                                       |
|  1. lock_manager.check_and_clean_expired_leases(now)                        |
|  2. For each expired lease (stage, cid, lease):                             |
|     - Force revoke lease and increment epoch                                |
|     - Transition component: IN_STAGE -> READY (reason="LEASE_EXPIRED")     |
|     - Re-enqueue cid into StageQueueManager[stage]                          |
|     - Log STAGE_LEASE_EXPIRED event to WASS                                 |
|                                                                             |
|  STEP 3: STAGE DISPATCHING (Highest-Priority Dequeue & Lock Acquisition)    |
|  1. For each stage in [DESIGN, CODEGEN, CRITICS, INTEGRATION, DOCS]:        |
|     - Check if lock_manager.is_stage_occupied(stage) is False               |
|     - Peek candidate_id = queue_manager.peek(stage)                         |
|     - If candidate.status == READY:                                         |
|       * lease = lock_manager.try_acquire_stage(stage, candidate_id)         |
|       * If lease acquired:                                                  |
|         - queue_manager.dequeue(stage)                                      |
|         - comp.transition_to(IN_STAGE, stage=stage, lease=lease)            |
|         - Log STAGE_LEASE_ACQUIRED event to WASS                            |
|         - Add (candidate_id, stage, epoch) to dispatch assignments          |
|                                                                             |
+=============================================================================+
```

### 3.11 Fault Tolerance, Multi-Tier Watchdogs & Poison-Pill Isolation

Located in `backend/autodev_pipeline/fault_tolerance.py`:

1. **`MultiTierWatchdog`**:
   - **Docker Timeout Guard**: `guard_docker_execution(timeout_sec=45.0)` runs container executions in a bounded daemon thread, forcibly terminating hung runs with exit code 124 (`DOCKER_TIMEOUT_EXCEEDED`).
   - **LLM Timeout & Retry**: `execute_with_llm_retry(max_retries=3, initial_backoff=1.0s)` implements exponential backoff with jitter, fast-failing permanent errors (`invalid_api_key`, `schema_violation`).
   - **Lease TTL Monitor**: `monitor_stage_leases()` cleans up stale leases and resets components to `READY`.
2. **`PoisonPillCircuitBreaker`**:
   - Tracks cumulative revisions per component. When $\text{revision\_count} \ge 3$:
     - Forcibly releases stage mutex.
     - Transitions component to `ComponentStatus.QUARANTINED`.
     - Invokes `CascadePauseEngine` to freeze downstream dependents while unaffected independent components complete.
3. **`CascadePauseEngine`**:
   - Computes transitive downstream closure: $\text{Closure}(u) = \{v \in V \mid u \rightsquigarrow v\}$.
   - Transitions all unstarted downstream components to `ComponentStatus.STALLED` and removes them from stage priority queues.

### 3.12 Write-Ahead State Store (WASS) & Deterministic Crash Recovery

1. **Append-Only Event Journal (`pipeline_events.jsonl`)**: Every state transition logs a `StateTransitionEvent` containing a SHA-256 integrity hash with `os.fsync()` durability.
2. **Atomic Snapshot Checkpointing (`pipeline_snapshot.json`)**: Checkpoints the complete pipeline state atomically using a temporary file and atomic `os.replace()`.
3. **Deterministic Crash Recovery (`CrashRecoveryEngine.recover_pipeline_state()`)**:
   - Loads latest durable snapshot.
   - Replays subsequent journal events, verifying SHA-256 hashes.
   - Rolls back all in-flight uncommitted `IN_STAGE` components to `READY`.
   - Reconstructs priority queues based on existing artifacts (`DESIGN` if no blueprint, `CODEGEN` if blueprint exists, `CRITICS` if codebase exists).

### 3.13 Forensic Analysis & Root-Cause Resolution of Concurrency Hangs

| Issue ID | Affected Component | Commit Hash / File | Root Cause Analysis | Technical Fix & Implementation | Systemic Outcome |
|---|---|---|---|---|---|
| **BUG-01** | `DESIGN` Stage Mutex | `d805221` / `backend/pipeline_api.py` | Human operators clicked 'Approve Blueprint' in UI, but backend never invoked `lock_manager.release_stage(DESIGN)`. Mutex stayed `HELD`, permanently blocking subsequent components. | Explicitly invoked `scheduler.complete_stage_design()`, releasing DESIGN mutex, incrementing epoch, and routing component to `Q_CODEGEN`. | Eliminated DESIGN stage pipeline freeze; subsequent components progress immediately. |
| **BUG-02** | Component Init API | `24906a3` / `backend/pipeline_api.py` | `ComponentStateRecord` required `name` as mandatory positional argument. In `/api/pipeline/init`, the router instantiated records omitting `name`, triggering unhandled `TypeError`. | Extracted `name=c.get('component_name', c.get('component_id', 'Unnamed'))` and passed to `ComponentStateRecord`. | Restored 100% reliability for `/api/pipeline/init` endpoint. |
| **BUG-03** | UI JSON Parser | `69a7443` / `backend/index.html` | LLM outputs contained unescaped ASCII control characters (literal newlines `\n`, tabs `\t`, `\r`) in JSON strings, crashing `JSON.parse()`. | Implemented regex pre-sanitization: `text.replace(/[\x00-\x1F\x7F]/g, match => match === '\n' ? '\\n' : match === '\t' ? '\\t' : match === '\r' ? '\\r' : '')`. | Prevented UI state corruption from malformed LLM string outputs. |
| **BUG-04** | Watchdog Lease TTL | `311215c` / `autodev_pipeline/models.py` | Default lease TTL was 30.0s. Human operators reviewing blueprints in UI took >30s, causing watchdog to forcibly evict active leases. | Increased default `lease_duration_sec` from 30.0s to 3600.0s (1 hour) in `PipelineConfig` and `models.py`. | Enabled human-in-the-loop blueprint review without premature eviction. |
| **BUG-05** | Critic Context Blindness | `311215c` / `backend/agents/critics.py` | Critics evaluated single component codebases without understanding master architecture decomposition, falsely flagging missing features partitioned in other components. | Injected `master_decomposition` context into critic prompts: *"The current codebase is only a single component. DO NOT flag missing functionality belonging to other components."* | Prevented false critic rejections on modular distributed components. |
| **BUG-06** | Priority Inversion | `backend/autodev_pipeline/concurrency.py` | Python's `heapq` is a min-heap. Original formula used `score = -effective_priority`, inverting priority order (priority 2 dispatched before priority 0). | Fixed priority formula in `StageQueueManager.enqueue()`: `score = int(priority_order) - (10000 if is_revision else 0)`. | Ensured highest priority components (priority 0) dispatch strictly before lower priority items. |
| **BUG-07** | Lease Invisibility | `backend/autodev_pipeline/scheduler.py` | `scheduler.tick_schedule()` returned only newly dispatched stages. Active leases held across multiple ticks returned empty lists, causing UI visualizer to show components as inactive. | Aggregated both active stage leases held in `lock_manager` and newly dispatched stages, returning complete active tuples `(component_id, stage, epoch)`. | Ensured continuous, accurate UI visualization during multi-second stage executions. |
| **BUG-08** | Terminal Lifecycle | `backend/autodev_pipeline/scheduler.py` | In single-component pipelines, passing `CRITICS` routed to `INTEGRATION`, causing components to stall in `Q_INTEGRATION` without an integrator trigger. | Added check: `if norm_stage == StageEnum.CRITICS: next_stg = None`, transitioning component directly to `ComponentStatus.COMPLETED`. | Ensured clean completion of component execution tracks. |

---

## 4. Deep-Dive: Core Algorithm 2 — Smart API Key Balancer Subsystem

The Smart API Key Balancer subsystem is implemented in `autodev_balancer/` and `backend/retry.py`.

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

### 4.1 Architectural Overview & Multi-Pool Topology

The balancer manages two distinct provider pools:
1. **6 Gemini API Keys (`ProviderEnum.GEMINI`)**: Shared dynamically across general SDLC stages (`REQUIREMENTS`, `MASTER_ARCHITECT`, `DESIGN`, `CODEGEN`, `CRITIC_CORRECTNESS`, `CRITIC_COMPLETENESS`, `ADJUDICATOR`, `INTEGRATOR`, `DOCUMENTATION`).
2. **1 Mistral API Key (`ProviderEnum.MISTRAL`)**: Dedicated and strictly isolated for the Architecture Critic (`StageEnum.CRITIC_ARCHITECTURE`).

### 4.2 3-Tier Environment Discovery Hierarchy

`KeyDiscovery.discover_gemini_keys()` in `autodev_balancer/config.py` resolves keys across three priority tiers:
- **Priority 1**: `GEMINI_API_KEYS` (comma-separated: `key1,key2,key3,key4,key5,key6`).
- **Priority 2**: Numbered environment variables: `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, ..., `GEMINI_API_KEY_6`.
- **Priority 3**: Legacy AutoDev stage variables: `GEMINI_API_KEY_REQUIREMENTS`, `GEMINI_API_KEY_DESIGN`, `GEMINI_API_KEY_CODEGEN`, `GEMINI_API_KEY_CRITICS`, `GEMINI_API_KEY_ADJUDICATOR`, `GEMINI_API_KEY_INTEGRATION`.
- **Single Key Fallback**: `GEMINI_API_KEY`.
- **Mistral Discovery**: `MISTRAL_API_KEY` (fallback: `MISTRAL_KEY`).

### 4.3 Strict Stage Isolation Guard (`StrictStageReservationGuard`)

`StrictStageReservationGuard` (`autodev_balancer/guard.py`) cryptographically enforces that the Mistral key is leased **only** by the Architecture Critic:

```python
AUTHORIZED_MISTRAL_STAGES: Set[StageEnum] = {
    StageEnum.CRITIC_ARCHITECTURE,
}

AUTHORIZED_MISTRAL_SUBTASKS: Set[str] = {
    "architecture",
    "architecture_critic",
    "arch_critic",
    "evaluate_architecture",
}
```

Any unauthorized stage (e.g. `CODEGEN`, `REQUIREMENTS`, `ADJUDICATOR`) attempting to acquire a Mistral key immediately raises `StageAccessDeniedError`.

### 4.4 Dynamic Health Tracking, Error Classification & Exponential Cooldown Decay

`HealthTracker` (`autodev_balancer/health.py`) manages dynamic health states:
- `KeyStatus.ACTIVE`: Eligible for immediate dispatch.
- `KeyStatus.COOLDOWN`: Temporarily paused due to transient error (default 5.0s).
- `KeyStatus.RATE_LIMITED`: Exponential cooldown due to HTTP 429 quota exhaustion.
- `KeyStatus.DISABLED`: Permanently evicted due to invalid API key or 401/403 auth error.

```
                      +-------------------+
                      |   ACTIVE (100%)   |<───────────────────────+
                      +-------------------+                        │
                        /        │        \                        │
             HTTP 429  /   HTTP  │         \  Permanent Auth Error │ Cooldown Elapsed
          Rate Limit  /    5xx   │          \ (401/403/InvalidKey) │ (Self-Healing Decay)
                     v           v           v                     │
              +--------------+ +----------+ +--------------+       │
              | RATE_LIMITED | | COOLDOWN | |   DISABLED   |       │
              +--------------+ +----------+ +--------------+       │
                     │               │             (Fatal)         │
                     │               +─────────────────────────────+
                     +─────────────────────────────────────────────+
```

#### Exponential Rate-Limit Backoff Formula:
$$T_{\text{cooldown}} = \min\left(T_{\text{max}}, T_{\text{base}} \cdot 2^{N - 1}\right)$$
Where $T_{\text{base}} = 15.0\text{s}$, $T_{\text{max}} = 300.0\text{s}$, and $N = \text{consecutive\_rate\_limits}$.
- 1st 429 hit: $15.0\text{s}$
- 2nd 429 hit: $30.0\text{s}$
- 3rd 429 hit: $60.0\text{s}$
- 4th 429 hit: $120.0\text{s}$
- 5th 429 hit: $240.0\text{s}$
- 6th+ 429 hit: $300.0\text{s}$ (capped at $T_{\text{max}}$)

#### Error Classification Hierarchy:
1. **Rate Limit (`is_rate_limit_error`)**: HTTP 429, `ResourceExhausted`, `"rate limit"`, `"quota"`. Placed in exponential cooldown.
2. **Transient Server Error (`is_transient_server_error`)**: HTTP 500, 502, 503, 504, `ConnectionReset`, socket timeouts. Placed in brief 5.0s cooldown.
3. **Permanent Auth Error (`is_permanent_auth_error`)**: HTTP 401, 403, `API_KEY_INVALID`, `PERMISSION_DENIED`. Transitions key to `KeyStatus.DISABLED`.
4. **Permanent Client Error (`is_permanent_client_error`)**: HTTP 400 Bad Request, `SchemaViolation`, `ContextLengthExceeded`. Recorded without penalizing healthy API keys.

#### Monotonic Self-Healing Cooldown Decay:
`HealthTracker.is_available(key_record, now_mono)` compares `time.monotonic()` against `key_record.cooldown_until`. When the cooldown period elapses, the key automatically self-heals to `KeyStatus.ACTIVE` without background polling threads.

### 4.5 Pluggable Load-Balancing Strategies & Selection Algorithms

Located in `autodev_balancer/strategies.py`:

1. **Least-Connections Strategy (`LeastConnectionsStrategy` - Default)**:
   $$\text{Score}(k) = \alpha \cdot \text{active\_in\_flight}(k) + \beta \cdot \text{total\_requests}(k)$$
   Where $\alpha = 1000.0$ (concurrency penalty) and $\beta = 1.0$ (fairness tie-breaker).
2. **Round-Robin Strategy (`RoundRobinStrategy`)**:
   $$k = \text{candidates}[i \pmod{|\text{candidates}|}], \quad i \leftarrow i + 1$$
3. **Weighted Round-Robin Strategy (`WeightedRoundRobinStrategy`)**: Proportional distribution based on configured key weights.
4. **Least-Recently-Used Strategy (`LRUStrategy`)**:
   $$k^* = \arg\min_{k \in \text{candidates}} \text{last\_used\_timestamp}(k)$$
5. **Token Bucket Strategy (`TokenBucketStrategy`)**:
   - Rate limit parameters: Capacity $C = 60.0\text{ tokens}$, Fill Rate $r = 1.0\text{ token/s}$.
   - Token refresh: $\text{Tokens}_k \leftarrow \min(C, \text{Tokens}_k + \Delta t \cdot r)$.
   - Filters candidates where $\text{Tokens}_k \ge 1.0$.

### 4.6 Multi-Tier Fallback Matrix Engine

`FallbackMatrixEngine` (`autodev_balancer/fallback.py`) coordinates multi-tier model degradation and key rotation:

```
[ Request Inbound for Stage S ]
                │
                ▼
    Is Stage CRITIC_ARCHITECTURE?
         /                 \
       YES                  NO
        │                    │
        ▼                    ▼
  [ TIER 3: MISTRAL ]  [ TIER 1: PRIMARY GEMINI (gemini-3.6-flash) ]
  Try Mistral Key      Rotate across Gemini Keys 1..6 on 429/Transient
        │                    │
     Success?                │ All 6 Keys Exhausted on 3.6-flash?
      /   \                  │
    YES    NO (Failover)     ▼
     │      +───────────────>[ TIER 2: SECONDARY GEMINI (gemini-3.5-flash) ]
     │                       Rotate across Gemini Keys 1..6 on 3.5-flash
     │                               │
     │                       All 6 Keys Exhausted on 3.5-flash?
     │                               │
     │                               ▼
     │                       [ TOTAL EXHAUSTION ]
     │                       Raise AllKeysExhaustedError with Telemetry
     ▼
  [ Return Result & Telemetry ]
```

#### Fallback Rules:
1. **Tier 1 (Intra-Tier Key Rotation)**: Requests attempt `gemini-3.6-flash`. On 429 rate limit or transient error, the key enters cooldown and the request retries immediately on the next key on the **same primary model**.
2. **Tier 2 (Inter-Tier Model Degradation)**: Downgrades to `gemini-3.5-flash` **only after all 6 Gemini keys have been exhausted on the primary model**.
3. **Tier 3 (Cross-Provider Critic Fallback)**: The Architecture Critic attempts Mistral first. If the Mistral key encounters rate limits, it falls back seamlessly to the 6-key Gemini pool.
4. **Fast-Fail on Permanent Errors**: HTTP 400 Bad Request or schema violations abort immediately without burning secondary keys.

### 4.7 Universal Exponential Backoff Decorator (`backend/retry.py`)

Implemented in `backend/retry.py` (492 lines), `@with_exponential_backoff` provides a standalone decorator for LLM API invocations across all backend agent functions:

```python
def with_exponential_backoff(
    fn: Optional[Callable] = None,
    *,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    jitter: bool = False,
    max_delay: float = 60.0,
    retryable_exceptions: Optional[Tuple[Type[Exception], ...]] = None,
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
) -> Any:
```

$$\text{Delay}(\text{attempt}) = \min\left(\text{max\_delay}, \text{initial\_delay} \cdot (\text{backoff\_factor})^{\text{attempt}}\right) + \text{jitter}$$
- Attempt 0: $1.0\text{s}$ delay
- Attempt 1: $2.0\text{s}$ delay
- Attempt 2: $4.0\text{s}$ delay

#### Polymorphic Execution Support:
1. Synchronous Functions (`inspect.isfunction`)
2. Synchronous Generator Functions (`inspect.isgeneratorfunction`)
3. Synchronous Stream Iterators (`collections.abc.Iterator`)
4. Asynchronous Coroutines (`inspect.iscoroutinefunction`)
5. Asynchronous Generator Streams (`inspect.isasyncgenfunction`)

### 4.8 Exhaustion Failure Modes & Diagnostic Telemetry

When all keys across all model tiers are exhausted:
1. `FallbackMatrixEngine` captures an `ExecutionTelemetry` record containing full diagnostic history of every attempt, provider, model, latency, and error message.
2. Computes the minimum remaining cooldown time across all keys:
   $$\Delta t_{\text{min\_recovery}} = \min_{k \in \text{Keys}} \max(0, \text{cooldown\_until}(k) - t_{\text{now}})$$
3. Raises `AllKeysExhaustedError` containing the telemetry and cooldown details.

### 4.9 Statistical Telemetry & Chi-Square Fairness Verification

`TelemetryAggregator` (`autodev_balancer/telemetry.py`) verifies load distribution fairness across the 6 Gemini keys:

1. **Pearson's Chi-Square Goodness-of-Fit Test**:
   $$\chi^2 = \sum_{i=1}^{k} \frac{(O_i - E_i)^2}{E_i}, \quad E_i = \frac{N}{k}$$
   - Degrees of Freedom: $\text{df} = k - 1 = 5$.
   - Critical value at $\alpha = 0.05$: $\chi^2_{\text{crit}} = 11.070$.
   - Passing criterion: $\chi^2 \le 11.070$ ($p \ge 0.05$), proving uniform distribution.
2. **Coefficient of Variation ($CV$)**:
   $$CV = \frac{\sigma}{\mu} = \frac{\sqrt{\frac{1}{k} \sum (O_i - \mu)^2}}{\mu} \le 0.15$$
3. **Max-to-Min Allocation Ratio**:
   $$\text{Ratio} = \frac{\max(O_i)}{\min(O_i)} \le 1.30$$
4. **Zero Starvation Check**:
   $$\forall i, \quad O_i \ge 0.70 \cdot \mu$$

---

## 5. Full Technical Specifications: Backend API Routes

The backend exposes **16 discrete API routes** across `backend/main.py`, `backend/pipeline_api.py`, and `backend/log_stream.py`.

### 5.1 Endpoint Catalog (16 Routes)

| # | Route URL | Method | Module | Tag / Purpose |
|---|---|---|---|---|
| 1 | `/` | `GET` | `backend/main.py:58` | Serve Single-Page Application Client (`index.html`) |
| 2 | `/api/generate-requirements` | `POST` | `backend/main.py:68` | Requirements Agent Streaming Endpoint |
| 3 | `/api/decompose` | `POST` | `backend/main.py:84` | Master Architect Decomposition Streaming Endpoint |
| 4 | `/api/generate-design` | `POST` | `backend/main.py:118` | System Design Blueprint Streaming Endpoint |
| 5 | `/api/generate-code` | `POST` | `backend/main.py:131` | Code Generation Streaming Endpoint |
| 6 | `/api/parse-requirements` | `POST` | `backend/main.py:151` | Rich Text to RequirementsDocument JSON Parser |
| 7 | `/api/parse-blueprint` | `POST` | `backend/main.py:182` | Rich Text to SystemDesignBlueprint JSON Parser |
| 8 | `/api/execute-code` | `POST` | `backend/main.py:213` | Docker Sandbox Test Execution Endpoint |
| 9 | `/api/run-critics` | `POST` | `backend/main.py:221` | LangGraph Multi-Critic Arbitration Endpoint |
| 10 | `/api/integrate` | `POST` | `backend/main.py:97` | Multi-Component Integrator Streaming Endpoint |
| 11 | `/api/generate-documentation` | `POST` | `backend/main.py:247` | Documentation Agent Streaming Endpoint |
| 12 | `/api/preview/start` | `POST` | `backend/main.py:277` | Docker Live Preview Container Launch Endpoint |
| 13 | `/api/pipeline/init` | `POST` | `backend/pipeline_api.py:25` | DAG Graph & Pipeline Initialization Endpoint |
| 14 | `/api/pipeline/tick` | `GET` | `backend/pipeline_api.py:42` | Discrete Scheduling Tick Polling Endpoint |
| 15 | `/api/pipeline/complete` | `POST` | `backend/pipeline_api.py:54` | Stage Handover & Completion Signal Endpoint |
| 16 | `/api/logs/stream` | `GET` | `backend/log_stream.py:32` | Real-Time Server-Sent Events (SSE) Log Stream |

---

### 5.2 Detailed Route Specifications & Schemas

#### Route 1: Serve Single-Page Application Client
- **URL**: `GET /`
- **Source**: `backend/main.py:58`
- **Request**: Headers: `Accept: text/html` | Body: None
- **Response**: `200 OK` (HTML content from `backend/index.html`) or `{"error": "index.html not found."}`

#### Route 2: Requirements Agent Streaming Endpoint
- **URL**: `POST /api/generate-requirements`
- **Source**: `backend/main.py:68`
- **Request Body (`FeatureRequestInput`)**:
  ```json
  {
    "feature_request": "Build a task manager with user authentication, task CRUD, and priority tagging."
  }
  ```
- **Response**: `200 OK` (`StreamingResponse`, `text/plain`). Streams `RequirementsDocument` JSON followed by `\n__USAGE__{prompt},{completion}`.
- **Error Codes**: `400 Bad Request` (PromptGuard security violation), `422 Unprocessable Entity`, `500 Internal Server Error`.

#### Route 3: Master Architect Decomposition Streaming Endpoint
- **URL**: `POST /api/decompose`
- **Source**: `backend/main.py:84`
- **Request Body (`RequirementsDocument`)**:
  ```json
  {
    "project_title": "Task Manager",
    "overview": "Task management application with auth.",
    "user_stories": []
  }
  ```
- **Response**: `200 OK` (`StreamingResponse`, `text/plain`). Streams `ComponentDecomposition` JSON + usage metadata.
- **Payload Structure**:
  ```json
  {
    "is_complex": true,
    "project_overview": "Modular task manager with decoupled services.",
    "shared_tech_stack": ["Python", "FastAPI", "pytest"],
    "shared_docker_image": "python:3.11-slim",
    "components": [
      {
        "component_id": "auth-service",
        "component_name": "Authentication Service",
        "description": "User login and JWT management.",
        "scoped_requirements": "Requirements for auth...",
        "dependencies_on": [],
        "priority_order": 1
      },
      {
        "component_id": "task-service",
        "component_name": "Task Management Service",
        "description": "CRUD operations for tasks.",
        "scoped_requirements": "Requirements for tasks...",
        "dependencies_on": ["auth-service"],
        "priority_order": 2
      }
    ],
    "integration_strategy": "Mount sub-routers in main FastAPI app."
  }
  ```

#### Route 4: System Design Blueprint Streaming Endpoint
- **URL**: `POST /api/generate-design`
- **Source**: `backend/main.py:118`
- **Request Body (`DesignInput`)**:
  ```json
  {
    "requirements": {
      "project_title": "Auth Service",
      "overview": "User auth module.",
      "user_stories": []
    },
    "component_context": "Tech Stack: Python, FastAPI\nDocker Image: python:3.11-slim"
  }
  ```
- **Response**: `200 OK` (`StreamingResponse`, `text/plain`). Streams `SystemDesignBlueprint` JSON + usage metadata.

#### Route 5: Code Generation Streaming Endpoint
- **URL**: `POST /api/generate-code`
- **Source**: `backend/main.py:131`
- **Request Body (`CodeGenInput`)**:
  ```json
  {
    "requirements": { "project_title": "Auth Service", "overview": "...", "user_stories": [] },
    "blueprint": {
      "architecture_overview": "FastAPI auth service",
      "tech_stack": ["Python", "pytest"],
      "docker_image": "python:3.11-slim",
      "dev_server_command": "NONE",
      "dev_server_port": 0,
      "run_tests_command": "pytest",
      "files": [
        {"file_name": "auth.py", "purpose": "JWT auth logic", "dependencies": ["jwt"], "pseudocode": "..."},
        {"file_name": "test_auth.py", "purpose": "Pytest auth suite", "dependencies": ["pytest"], "pseudocode": "..."}
      ]
    },
    "previous_codebase": null,
    "revision_plan": null
  }
  ```
- **Response**: `200 OK` (`StreamingResponse`, `text/plain`). Streams `GeneratedCodeBase` JSON + usage metadata.

#### Route 6: Parse Free-Form Requirements to JSON
- **URL**: `POST /api/parse-requirements`
- **Source**: `backend/main.py:151`
- **Request Body (`TextUpdateInput`)**: `{"text": "PROJECT TITLE:\nCalculator\n..."}`
- **Response**: `200 OK` (JSON matching `RequirementsDocument`).

#### Route 7: Parse Free-Form Blueprint to JSON
- **URL**: `POST /api/parse-blueprint`
- **Source**: `backend/main.py:182`
- **Request Body (`TextUpdateInput`)**: `{"text": "ARCHITECTURE OVERVIEW:\nModular layout\n..."}`
- **Response**: `200 OK` (JSON matching `SystemDesignBlueprint`).

#### Route 8: Docker Sandbox Test Execution Endpoint
- **URL**: `POST /api/execute-code`
- **Source**: `backend/main.py:213`
- **Request Body (`ExecuteInput`)**:
  ```json
  {
    "codebase": {
      "files": [
        {"file_name": "app.py", "source_code": "def add(a, b): return a + b\n"},
        {"file_name": "test_app.py", "source_code": "from app import add\ndef test_add(): assert add(2, 3) == 5\n"}
      ]
    },
    "blueprint": {
      "architecture_overview": "Calculator",
      "tech_stack": ["Python", "pytest"],
      "docker_image": "python:3.11-slim",
      "dev_server_command": "NONE",
      "dev_server_port": 0,
      "run_tests_command": "pytest",
      "files": []
    }
  }
  ```
- **Response**: `200 OK` (`ExecutionResult`):
  ```json
  {
    "success": true,
    "logs": "============================= test session starts =============================\nplatform linux -- Python 3.11.9\nrootdir: /workspace\ncollected 1 item\n\ntest_app.py .                                                            [100%]\n\n============================== 1 passed in 0.02s ==============================\nTOTAL 2 0 100%"
  }
  ```

#### Route 9: Multi-Critic Arbitration & Adjudication Endpoint
- **URL**: `POST /api/run-critics`
- **Source**: `backend/main.py:221`
- **Request Body (`ArbitrationInput`)**:
  ```json
  {
    "requirements": { "project_title": "Auth", "overview": "...", "user_stories": [] },
    "blueprint": { "architecture_overview": "...", "tech_stack": [], "docker_image": "python:3.11-slim", "dev_server_command": "NONE", "dev_server_port": 0, "run_tests_command": "pytest", "files": [] },
    "codebase": { "files": [ { "file_name": "auth.py", "source_code": "..." } ] },
    "execution_result": { "success": true, "logs": "1 passed in 0.02s" },
    "master_decomposition": null
  }
  ```
- **Response**: `200 OK`:
  ```json
  {
    "feedbacks": [
      {
        "critic_name": "Correctness Critic (Gemini)",
        "severity_score": 0,
        "issues_list": [],
        "overall_comments": "All tests passed cleanly."
      },
      {
        "critic_name": "Architecture Critic (Mistral)",
        "severity_score": 0,
        "issues_list": [],
        "overall_comments": "Complies with blueprint."
      },
      {
        "critic_name": "Completeness Critic (Gemini)",
        "severity_score": 0,
        "issues_list": [],
        "overall_comments": "Edge cases guarded."
      }
    ],
    "decision": {
      "verdict": "pass",
      "revision_plan": "Codebase verified and approved."
    }
  }
  ```

#### Route 10: Multi-Component Integrator Streaming Endpoint
- **URL**: `POST /api/integrate`
- **Source**: `backend/main.py:97`
- **Request Body (`IntegrationInput`)**:
  ```json
  {
    "requirements": { "project_title": "Task App", "overview": "...", "user_stories": [] },
    "decomposition": { "is_complex": true, "project_overview": "...", "shared_tech_stack": ["Python"], "shared_docker_image": "python:3.11-slim", "components": [], "integration_strategy": "Import submodules" },
    "component_results": [
      {
        "component_id": "auth-service",
        "component_name": "Auth",
        "blueprint": { "architecture_overview": "...", "tech_stack": [], "docker_image": "...", "dev_server_command": "...", "dev_server_port": 0, "run_tests_command": "pytest", "files": [] },
        "codebase": { "files": [ { "file_name": "auth.py", "source_code": "..." } ] },
        "execution_result": { "success": true, "logs": "..." }
      }
    ]
  }
  ```
- **Response**: `200 OK` (`StreamingResponse`, `text/plain`). Streams merged `GeneratedCodeBase` JSON + usage metadata.

#### Route 11: Documentation Agent Streaming Endpoint
- **URL**: `POST /api/generate-documentation`
- **Source**: `backend/main.py:247`
- **Request Body (`DocumentationInput`)**:
  ```json
  {
    "requirements": { "project_title": "Task App", "overview": "...", "user_stories": [] },
    "blueprint": { "architecture_overview": "...", "tech_stack": [], "docker_image": "...", "dev_server_command": "...", "dev_server_port": 0, "run_tests_command": "pytest", "files": [] },
    "codebase": { "files": [ { "file_name": "main.py", "source_code": "..." } ] }
  }
  ```
- **Response**: `200 OK` (`StreamingResponse`, `text/plain`). Streams `DocumentationSet` JSON (`README.md`, `USER_GUIDE.md`) + usage metadata.

#### Route 12: Docker Live Preview Container Launch Endpoint
- **URL**: `POST /api/preview/start`
- **Source**: `backend/main.py:277`
- **Request Body (`ExecuteInput`)**: Complete codebase and blueprint with dev server command.
- **Response**: `200 OK` (`{"url": "http://localhost:<dynamic_port>"}`).

#### Route 13: DAG Graph & Pipeline Initialization Endpoint
- **URL**: `POST /api/pipeline/init`
- **Source**: `backend/pipeline_api.py:25`
- **Request Body (`PipelineInitInput`)**:
  ```json
  {
    "components": [
      {
        "component_id": "auth-service",
        "name": "Auth Service",
        "dependencies_on": [],
        "priority_order": 1
      },
      {
        "component_id": "task-service",
        "name": "Task Service",
        "dependencies_on": ["auth-service"],
        "priority_order": 2
      }
    ]
  }
  ```
- **Response**: `200 OK` (`{"status": "ok"}`) or `400 Bad Request` (`{"detail": "Cyclic dependencies detected in components"}`).

#### Route 14: Discrete Scheduling Tick Polling Endpoint
- **URL**: `GET /api/pipeline/tick`
- **Source**: `backend/pipeline_api.py:42`
- **Request**: None
- **Response**: `200 OK`:
  ```json
  {
    "assignments": [
      {
        "component_id": "auth-service",
        "stage": "DESIGN",
        "epoch": 1
      }
    ]
  }
  ```

#### Route 15: Stage Handover & Completion Signal Endpoint
- **URL**: `POST /api/pipeline/complete`
- **Source**: `backend/pipeline_api.py:54`
- **Request Body (`CompleteStageInput`)**:
  ```json
  {
    "component_id": "auth-service",
    "stage": "DESIGN",
    "verdict": "pass"
  }
  ```
- **Response**: `200 OK` (`{"success": true}`).

#### Route 16: Real-Time Server-Sent Events (SSE) Log Stream
- **URL**: `GET /api/logs/stream`
- **Source**: `backend/log_stream.py:32`
- **Request Headers**: `Accept: text/event-stream`
- **Response**: `200 OK` (`StreamingResponse`, `text/event-stream`). Emits raw log stream items and periodic `: keepalive` comments.

---

### 5.3 Pydantic Domain Models Reference

```
+====================================================================================================+
|                                  PYDANTIC DOMAIN MODELS REFERENCE                                  |
+====================================================================================================+
| Model Class            | Source Location               | Key Fields & Descriptions                 |
+------------------------+-------------------------------+-------------------------------------------+
| FeatureRequestInput    | backend/main.py:25            | feature_request (str)                     |
| TextUpdateInput        | backend/main.py:28            | text (str)                                |
| CodeGenInput           | backend/main.py:31            | requirements, blueprint, previous, plan   |
| DocumentationInput     | backend/main.py:37            | requirements, blueprint, codebase         |
| ExecuteInput           | backend/main.py:42            | codebase (GeneratedCodeBase), blueprint   |
| ArbitrationInput       | backend/main.py:46            | reqs, blueprint, codebase, exec_res, decomp|
| IntegrationInput       | backend/main.py:53            | requirements, decomposition, comp_results |
| DesignInput            | backend/main.py:114           | requirements, component_context           |
| PipelineInitInput      | backend/pipeline_api.py:17    | components (List[Dict[str, Any]])         |
| CompleteStageInput     | backend/pipeline_api.py:20    | component_id, stage, verdict              |
| AcceptanceCriteria     | backend/models.py:6           | id, description, expected_behavior        |
| UserStory              | backend/models.py:12          | title, as_a, i_want_to, so_that, criteria |
| RequirementsDocument   | backend/models.py:20          | project_title, overview, user_stories     |
| FileBlueprint          | backend/models.py:28          | file_name, purpose, deps, pseudocode      |
| SystemDesignBlueprint  | backend/models.py:35          | arch_overview, tech_stack, docker_image,  |
|                        |                               | dev_server_cmd, run_tests_cmd, files      |
| CodeFile               | backend/models.py:47          | file_name, source_code                    |
| GeneratedCodeBase      | backend/models.py:52          | files (List[CodeFile])                    |
| ExecutionResult        | backend/models.py:56          | success (bool), logs (str)                |
| CriticFeedback         | backend/models.py:63          | critic_name, severity_score, issues, comms|
| AdjudicatorDecision    | backend/models.py:72          | verdict (pass/revise/error), revision_plan|
| ComponentSpec          | backend/models.py:79          | component_id, name, desc, scoped_reqs,    |
|                        |                               | dependencies_on, priority_order           |
| ComponentDecomposition | backend/models.py:88          | is_complex, project_overview, tech_stack,  |
|                        |                               | docker_image, components, integ_strategy  |
| ComponentResult        | backend/models.py:97          | component_id, name, blueprint, codebase,  |
|                        |                               | execution_result                          |
| DocumentationSet       | documentation_agent.py:13     | files (List[CodeFile])                    |
+====================================================================================================+
```

---

## 6. Full Technical Specifications: Frontend UI Architecture & Logic

The client dashboard is implemented in `backend/index.html` as a zero-build Single-Page Application utilizing Tailwind CSS, Monaco Editor, and Server-Sent Events.

### 6.1 Client Component Hierarchy & Layout Structure

```
+-----------------------------------------------------------------------------------------+
| [Header] Title: AutoDev Autonomous SDLC | Global Cost Tracker (INR / Token Counter)     |
+-----------------------------------------------------------------------------------------+
| [Pipeline Progress Stepper] (1. Req -> 2. Decomp -> 3. Design -> 4. Code -> 5. Integr)  |
+-----------------------------------------------------------------------------------------+
| [Input Section] Feature Request Textarea + SYS.REQ_COMPILER Execution Button            |
+-----------------------------------------------------------------------------------------+
| [Error Banner] (Hidden by default; displays PromptGuard & API failure alerts)           |
+-----------------------------------------------------------------------------------------+
| [Phase 1 Output] Rich Text Editable Requirements Document + SYS.DECOMPOSER Trigger      |
+-----------------------------------------------------------------------------------------+
| [Phase 1.5 Decomposition] Component Breakdown Cards + Launch Pipeline Trigger          |
+-----------------------------------------------------------------------------------------+
| [Component Pipeline Dashboard] Horizontally Scrolling Multi-Track Carousel Cards:      |
| +-------------------------------------------------------------------------------------+ |
| | Component Card: ID, Name, Status Badge                                              | |
| | - Sub-Panel 1: Architectural Blueprint (Editable Textarea + Approve Button)         | |
| | - Sub-Panel 2: Generated Codebase (Monaco Editor + File Explorer + Revision Tabs)   | |
| | - Sub-Panel 3: Arbitration Feedback (Execution Logs + Critic Cards + Adjudicator)   | |
| | - Component Lock Button: Approves and moves component to passing buffer             | |
| +-------------------------------------------------------------------------------------+ |
| [Integration Section] Triggered once all components pass -> Merged Codebase & Tests    |
+-----------------------------------------------------------------------------------------+
| [Single-Pass Output Sections] (For non-complex projects):                               |
| - Phase 2 Design -> Phase 2b CodeGen & Live Docker Preview -> Phase 2c Sandbox Tests   |
| - Phase 3 Critics -> Phase 3.5 Documentation Generation & Download .ZIP               |
+-----------------------------------------------------------------------------------------+
| [Collapsible Live Terminal Drawer] Real-time SSE /api/logs/stream console output        |
+-----------------------------------------------------------------------------------------+
```

### 6.2 Frontend State Machine & Stage Progression Automata

```
[queued]
   │
   ▼ (Dispatched to DESIGN stage by /api/pipeline/tick)
[designing] (Streaming blueprint from /api/generate-design)
   │
   ▼
[waiting_design] (Prompting operator to inspect/edit rich text blueprint)
   │
   ▼ (Operator clicks "Approve Design & Generate Code" -> /api/pipeline/complete[DESIGN])
[coding_queued]
   │
   ▼ (Dispatched to CODEGEN stage by /api/pipeline/tick)
[coding] (Streaming source files from /api/generate-code into Monaco)
   │
   ▼ (Completed -> /api/pipeline/complete[CODEGEN])
[critic_queued]
   │
   ▼ (Dispatched to CRITICS stage by /api/pipeline/tick)
[executing] (Running test suite in Docker container via /api/execute-code)
   │
   ▼
[critiquing] (Invoking parallel arbitration critics via /api/run-critics)
   │
   ├─► If verdict == 'revise' && revisionCount < 3:
   │      Increment revisionCount -> [coding_queued] (Autonomous self-correction)
   │
   ├─► If verdict == 'pass':
   │      [waiting_critic] -> Operator clicks "Lock Final Component"
   │      -> [passed] (Component locked, /api/pipeline/complete[CRITICS])
   │
   └─► If verdict == 'fail' or revisionCount >= 3:
          [failed] / Max Revisions (Manual inspect and force approve option)
```

#### Frontend State Visual Indicator Reference:

| State String | Visual Badge Styling | Status Label |
|---|---|---|
| `queued` | `bg-slate-800 text-slate-400 border border-slate-700` | Queued for Design |
| `designing` | `bg-indigo-500/20 text-indigo-400 border border-indigo-500/30` | Designing... |
| `waiting_design` | `bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse` | Action Required |
| `coding_queued` | `bg-slate-800 text-slate-400 border border-slate-700` | Queued for Code |
| `coding` | `bg-purple-500/20 text-purple-400 border border-purple-500/30` | Coding... |
| `critic_queued` | `bg-slate-800 text-slate-400 border border-slate-700` | Queued for Tests |
| `executing` / `critiquing` | `bg-rose-500/20 text-rose-400 border border-rose-500/30` | Evaluating... |
| `waiting_critic` | `bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse` | Action Required |
| `passed` | `bg-emerald-500/20 text-emerald-400 border border-emerald-500/30` | Passed ✓ |
| `failed` | `bg-red-500/20 text-red-400 border border-red-500/30` | Failed ✗ |

### 6.3 Polling Loop, SSE Log Stream & Event Handling

1. **Tick Polling Loop (`setInterval(processPipeline, 2000)`)**:
   - Runs every **2,000 milliseconds**.
   - Invokes `GET /api/pipeline/tick` to receive the active `assignments` array.
   - Triggers matching stage handlers (`startComponentDesign`, `startComponentCoding`, `startComponentCritic`).
2. **Atomic Stage Completion Dispatch**:
   - Dispatches `POST /api/pipeline/complete` with payload `{"component_id": cId, "stage": "<STAGE>", "verdict": "pass"}`.
3. **SSE Live Terminal Stream**:
   - Initializes `new EventSource('/api/logs/stream')` on DOM load.
   - Highlights log lines dynamically (cyan for agents, green for passes, red for errors, yellow for warnings).
4. **Token Usage & INR Cost Conversion**:
   - Ingests `\n__USAGE__{prompt},{completion}` footers and computes cost using a multiplier of 84 INR/USD.
5. **Stream Sanitization & Control Character Parsing**:
   - Sanitizes streaming LLM output in `readJsonStream()` to escape control characters before invoking `JSON.parse()`.

### 6.4 Embedded Monaco Editor, Live Docker Preview & Security Controls

1. **Monaco Editor Integration**: Injects full VS Code editing core with tabs, syntax highlighting, and buffer synchronization before execution.
2. **Dynamic Docker Preview Sandbox**: Starts a Docker container with live port mapping, displaying web apps in an interactive iframe.
3. **Prompt Guard Security Check**: Validates input length ($\ge 10$ chars), word count ($\ge 3$ words), and filters prompt injection tokens.
4. **Re-entrancy Protection**: Disables buttons and shows spinners immediately upon click.
5. **Self-Correction 3-Cycle Cap**: Automatically caps self-correction cycles at 3 iterations to prevent infinite token consumption.

### 6.5 Integration Phase Revision Layout & Arbitration History Architecture

1. **State Store & Snapshot Structure**:
   - `integrationRevisionHistory`: An array of code snapshots recorded on initial integration synthesis and each revision loop (`Initial`, `Rev 1`, `Rev 2`, `Rev 3`, ...). Each record preserves:
     - `revision`: Integer index (0-indexed).
     - `codebase`: Deep clone of the integrated project files array (`file_name`, `content`).
     - `executionResult`: Execution output (`stdout`, `stderr`, exit code, execution errors) corresponding to that code snapshot.
     - `status`: String state (`'complete'`, `'error'`, etc.).
   - `integrationActiveRevisionIndex`: Pointer tracking the currently displayed code revision.
   - `integrationCriticHistory`: An array of arbitration snapshots recorded for each evaluation cycle (`Initial Eval`, `Rev 1 Eval`, `Rev 2 Eval`, ...). Each record preserves:
     - `revision`: Integer revision index.
     - `arbitration`: Full critic feedback dictionary (`correctness`, `performance`, `security`, `architecture`) containing reviewer critiques, severity scores, and recommendations.
     - `decision`: Final adjudicator verdict (`AdjudicatorDecision` payload with `verdict`, `reasons`, `composite_score`, `early_stop_triggered`, etc.).
     - `executionResult`: Execution logs evaluated by critics during that cycle.
     - `loading`: Boolean flag tracking in-flight evaluations.
     - `error`: Optional error string if arbitration synthesis failed or was interrupted.
   - `integrationActiveCriticIndex`: Pointer tracking the currently displayed arbitration evaluation tab.

2. **Dual-Tab Container Layout**:
   - `#integrationRevTabs`: Flex tab container positioned directly above the Monaco editor in `#codeOutputSection`. Dynamically renders pills (`Initial`, `Rev 1`, `Rev 2`...) via `renderIntegrationRevTabs()`. The active tab is visually highlighted with blue accent styling (`bg-blue-600 text-white shadow-sm font-medium`).
   - `#integrationCriticTabs`: Flex tab container positioned in `#criticOutputSection` above the critic cards. Dynamically renders pills (`Initial Eval`, `Rev 1 Eval`...) via `renderIntegrationCriticTabs()`. Supports pending indicator dots during active evaluation cycles.

3. **Buffer Synchronization & Model Isolation**:
   - Monaco editor model buffers are synchronized via `monaco.editor.getModels()` on each file switch. When navigating between integration revisions via `switchIntegrationRevision(targetIdx)`, the Monaco editor instances and file explorer tree are bound strictly to `integrationRevisionHistory[targetIdx].codebase`.
   - Associated execution logs in `#integrationRunOutput` and execution status badges are restored to reflect the execution run of the selected revision.

4. **Consecutive Diff Mode (`toggleDiffMode()`)**:
   - Clicking `#diffToggleBtn` splits the editor into a Monaco Diff Editor (`monaco.editor.createDiffEditor`), comparing the active integration revision (`Rev N`) directly against the immediately preceding revision (`Rev N - 1`).
   - **File Pairing by Name**: When comparing revisions, files are strictly resolved by matching `file_name` (`prevRev.codebase.files.find(f => f.file_name === curFile.file_name)`). Newly added files diff against empty string `""` without index mismatch fallbacks.
   - **Safe Model Disposal**: Previous diff models (`diffEditorInstance.getModel()`) are explicitly disposed prior to instantiating new diff buffers, preventing DOM memory leaks.

5. **Lifecycle Reset & Error Handling Resilience**:
   - Fresh integration runs (`runIntegration(!isRevision)`) immediately flush and hide `#integrationRevTabs` and `#integrationCriticTabs` in the DOM, resetting history arrays to prevent visual artifact leaks.
   - Arbitration failures (`catch (err)` in `runIntegration`) mark pending evaluations with `loading: false` and `error: err.message`, rendering an explicit error state in `renderIntegrationCriticHistoryTab` rather than an unresolvable infinite spinner.
   - When browsing historical tabs without critics or decisions, stale cards and adjudicator verdict cards are explicitly cleared and hidden.


### 6.7 Post-Completion Iteration & Query Engine Architecture

#### 1. Executive Purpose & Operational Paradigm
Following the conclusion of the standard AutoDev Software Development Life Cycle (culminating in Phase 4 Integration and Phase 5 Documentation generation), end-users frequently require iterative adjustments, aesthetic styling modifications, dynamic form extensions, or technical Q&A explorations without re-triggering the entire multi-phase generation pipeline.

Traditional monolithic code re-generation approaches suffer from critical operational defects:
1. **Non-Deterministic Semantic Drift**: Re-running full generation agents frequently rewrites unrelated working components, introducing regressions and changing established variable bindings.
2. **Whitespace & Formatting Corruption**: File regenerations re-format files, breaking strict git diffing, linters, and byte-level caching.
3. **Severe Token & Latency Inefficiencies**: Sending entire codebases back through decomposition, architect, and code generation cycles burns dozens of minutes and tens of thousands of tokens.

The **Post-Completion Iteration & Query Engine** resolves these challenges through a dual-mode control plane (`modify` vs `query`):
- **Surgical Refactoring**: The `RefactorAgent` modifies *only* targeted files while leaving untouched files **100% byte-identical** (mathematically verified by SHA-256 digests and direct object identity preservation).
- **Zero-Mutation Technical Queries**: A streaming conversational advisory engine inspects application blueprints and codebase buffers, streaming technical markdown answers with a mathematical proof of 0 file mutations and zero Docker execution overhead.
- **Permanent Frontend Control Plane**: The `#postCompletionSection` UI persists beneath the download button, preserving state across successive iterations, tab switches, and ZIP exports.

```
+====================================================================================================+
|                     POST-COMPLETION ITERATION & QUERY ARCHITECTURAL FLOW                           |
+====================================================================================================+
|                                                                                                    |
|  [ User Request: "Switch theme to dark neon purple" ]                                             |
|                          │                                                                         |
|                          ▼                                                                         |
|     POST /api/post-completion/modify (or /api/post-completion/query)                               |
|                          │                                                                         |
|         ┌────────────────┴────────────────┐                                                        |
|         ▼                                 ▼                                                        |
|  [ Modify Mode ]                   [ Query Mode ]                                                  |
|         │                                 │                                                        |
|         ▼                                 ▼                                                        |
|  RefactorAgent.refactor_codebase()  stream_codebase_query()                                        |
|  - Gemini 3.5/3.7 Load Balanced    - Conversational Stream                                         |
|  - Returns RefactorOutput          - Mathematical Proof:                                           |
|    (Only modified/new files)         0 File Mutations, 0 Docker Runs                               |
|         │                                 │                                                        |
|         ▼                                 ▼                                                        |
|  merge_refactored_codebase()        StreamingResponse (text/plain)                                 |
|  - Untouched files: Byte-Identical        │                                                        |
|  - Modified files: In-place replace       ▼                                                        |
|  - New files: Appended (N -> N+1)   Render Stream in #postCompQueryOutput                          |
|         │                                                                                          |
|         ▼                                                                                          |
|  Optional Sandbox Verification                                                                     |
|  - execute_code() (npm run build)                                                                  |
|  - Inline Pass / Fail Badge                                                                        |
|         │                                                                                          |
|         ▼                                                                                          |
|  Frontend State Synchronization                                                                    |
|  - Append 'Post-Run Rev X' snapshot to integrationRevisionHistory                                  |
|  - Update currentCodebase & Monaco editor                                                          |
|  - Refresh File Explorer & Live Preview hot-reload                                                 |
|  - Synchronize downloadZip() payload                                                               |
|                                                                                                    |
+====================================================================================================+
```

#### 2. Backend Domain Models (`backend/models.py`)
Four specialized Pydantic v2 schemas govern the post-completion request-response lifecycle:

```python
class PostCompletionModifyRequest(BaseModel):
    """Payload for modifying an existing codebase post-pipeline completion."""
    prompt: str = Field(description="User's refactoring, feature addition, or styling directive")
    codebase: GeneratedCodeBase = Field(description="The current codebase snapshot to selectively refactor")
    blueprint: Optional[SystemDesignBlueprint] = Field(default=None, description="System design blueprint")
    run_verification: Optional[bool] = Field(default=True, description="Whether to execute sandbox verification")
    mode: Optional[str] = Field(default="QUICK", description="Generation mode: QUICK or COMPLEX")
    generation_mode: Optional[str] = Field(default=None, description="Mode alias for backwards compatibility")

class PostCompletionQueryRequest(BaseModel):
    """Payload for querying/inspecting an existing codebase post-pipeline completion."""
    prompt: Optional[str] = Field(default=None, description="User's technical query")
    query: Optional[str] = Field(default=None, description="Alias for prompt")
    codebase: GeneratedCodeBase = Field(description="The current codebase snapshot to inspect (read-only)")
    blueprint: Optional[SystemDesignBlueprint] = Field(default=None, description="System design blueprint")
    mode: Optional[str] = Field(default="QUICK", description="Generation mode: QUICK or COMPLEX")
    generation_mode: Optional[str] = Field(default=None, description="Mode alias")

    @model_validator(mode="before")
    @classmethod
    def resolve_query_or_prompt(cls, data: Any) -> Any:
        if isinstance(data, dict):
            p = data.get("prompt") or data.get("query")
            if p is not None:
                data["prompt"] = str(p)
                data["query"] = str(p)
        return data

class RefactorOutput(BaseModel):
    """Structured response from the RefactorAgent containing ONLY modified or newly created files."""
    summary: str = Field(description="Concise description of changes made and files touched")
    modified_files: List[CodeFile] = Field(description="List of modified or new files. Untouched files omitted.")

class PostCompletionModifyResponse(BaseModel):
    """API response returned by POST /api/post-completion/modify."""
    success: bool = Field(description="True if modification and merging succeeded")
    summary: str = Field(description="Summary of the applied changes")
    modified_files: List[str] = Field(description="List of file paths that were modified or created")
    codebase: GeneratedCodeBase = Field(description="The updated, fully-merged codebase")
    execution_result: Optional[ExecutionResult] = Field(default=None, description="Sandbox verification result")
```

To ensure cross-module type identity and avoid Pydantic metaclass duplicate registration issues, `backend/models.py` registers itself under both `"models"` and `"backend.models"` in `sys.modules`.

#### 3. RefactorAgent & Byte-Identity Invariance Engine (`backend/agents/refactor_agent.py`)
The `RefactorAgent` encapsulates the core algorithmic guarantees of surgical code modification:

1. **The Five Critical Refactoring Laws (`REFACTOR_SYSTEM_PROMPT`)**:
   - **Selective Output Law**: The agent must return *only* files that are modified or newly created. Untouched files MUST be omitted from `modified_files`.
   - **Complete Source Code Law**: All returned files must contain the complete, runnable source code. Diff notation (`+`, `-`), ellipsis (`...`), and placeholder comments (`/* unchanged */`) are strictly forbidden.
   - **Architectural Preservation Law**: Preserves styling methodologies (Tailwind CSS, CSS Modules), module systems (ESM `"type": "module"`), and framework idioms.
   - **Dependency Discipline Law**: If external libraries are added, `package.json` or `requirements.txt` must be updated within `modified_files`.
   - **Defensive Programming Law**: Ensures updated code passes build validation and mandates Python raw string literals (`r"..."`) for regular expressions.

2. **Algorithmic Merger Mechanics (`merge_refactored_codebase`)**:
   - **Path Normalization**: Replaces backslashes with forward slashes, strips leading `./`, and normalizes casing for lookup (`path.replace('\\', '/').strip().lstrip('./').lower()`).
   - **Untouched File Byte Invariance**: For every file in `original_codebase.files` not present in the modification map, the merger retains the exact original `CodeFile` object reference in memory. This guarantees 100% byte-for-byte equality (`orig.encode('utf-8') == new.encode('utf-8')`) and identical SHA-256 cryptographic hashes.
   - **Canonical Path Casing Preservation**: Modified files replace content in-place while retaining the original canonical casing (e.g. `SRC/app.css` updates `src/App.css` without altering filename case or creating duplicates).
   - **New File Addition ($N \to N+1$)**: Truly new files are appended to the codebase array with sanitized relative paths.

3. **Read-Only Technical Q&A Stream (`stream_codebase_query`)**:
   - Accepts the codebase strictly as read-only context.
   - Streams formatted Markdown responses chunk-by-chunk using Google GenAI SDK `generate_content_stream`.
   - Never calls `merge_refactored_codebase` or touches memory buffers.
   - Handles stream retries with `\n__RESET__\n` markers.

#### 4. Multi-Key Balancer Integration & Mode Resolution
Post-completion requests fully participate in AutoDev's 7-key load-balancing and dual-mode execution infrastructure:
- **QUICK Mode**: Resolved via `resolve_models_for_mode("QUICK")` to strictly use `gemini-3.5-flash-lite` across all attempts and fallbacks, avoiding costly model invocations.
- **COMPLEX Mode**: Resolved via `resolve_models_for_mode("COMPLEX")` to prioritize `gemini-3.7-flash`, automatically falling back to `gemini-3.5-flash-lite`.
- **429 Rate-Limit Key Rotation**: If an API key encounters an HTTP 429 quota exhaustion error (`google.api_core.exceptions.ResourceExhausted`), the system records the error with exponential cooldown in `KeyHealthTracker` and rotates to the next available API key in the stage pool (`GEMINI_API_KEY_CODEGEN`, `GEMINI_API_KEY_REQUIREMENTS`, `GEMINI_API_KEY_1..7`).
- **Standardized Phase Logging**: Transition logs are emitted to persistent `autodev.log`, `sys.stdout`, and the SSE log stream via `format_phase_transition()`:
  ```text
  [PHASE TRANSITION] [Component: System] COMPLETED -> POST_COMPLETION_MODIFY (Prompt: ...) | Model: gemini-3.5-flash-lite | API Key: GEMINI_API_KEY_CODEGEN (AQ.Ab8...4R0A)
  ```

#### 5. Permanent Frontend Control Plane (`backend/index.html`)
The post-completion interface provides a permanent interactive control surface:

1. **DOM Placement & Hierarchy**:
   - `#postCompletionSection` is placed permanently within `#adjudicatorSection` directly following `#finalDownloadBtn`.
   - It is triggered by `showPostCompletionSection()` across 10 distinct pipeline completion checkpoints (including QUICK mode automated passes, COMPLEX countdown expiries, single-pass completion, and multi-component DAG integration completion).
   - **Non-Disappearing Contract**: The section remains permanently visible across all subsequent post-run modifications, queries, tab switches, and ZIP downloads. It is only reset when initiating a brand new SDLC project via `resetUI()`.

2. **Interactive Controls & Quick Action Chips**:
   - **Mode Toggle Pill**: Seamlessly switches between "Modify Code" (`#postCompToggleModify`) and "Ask Query" (`#postCompToggleQuery`).
   - **Quick Action Chips**: One-click prompt population:
     - `🎨 Theme change`: Sets prompt to `"Change styling/theming to dark neon cyberpunk palette"` and switches to Modify mode.
     - `➕ Add field`: Sets prompt to `"Add a telephone number input field with validation to the main form"` and switches to Modify mode.
     - `🐛 Fix bug`: Sets prompt to `"Fix validation bugs and handle edge-case inputs gracefully"` and switches to Modify mode.
     - `💡 Explain project`: Sets prompt to `"Provide a comprehensive architectural and component breakdown of this project"` and switches to Query mode.

3. **Inline Sandbox Verification Status Badges**:
   - For code modifications, if sandbox verification is enabled, `#postCompSandboxCard` renders an inline status badge:
     - **Green Badge (`PASSED`)**: `✓ Sandbox Build & Verification Passed`.
     - **Red Badge (`FAILED`)**: `✗ Sandbox Verification Failed` with collapsible execution logs (`#postCompLogsContainer`).
   - If Docker is offline or disabled, verification errors are captured cleanly in `ExecutionResult(success=False, logs=...)`, rendering diagnostic failure badges without crashing the HTTP 200 response or corrupting UI state.

4. **Multi-Revision History & Snapshotting**:
   - Each modification creates an immutable snapshot (`JSON.parse(JSON.stringify(currentCodebase))`) labeled `Post-Run Rev X` (e.g. `Post-Run Rev 1`, `Post-Run Rev 2`).
   - Snapshots are pushed to `integrationRevisionHistory` (or `revisionHistory`) and rendered in `#integrationRevTabs` with distinct emerald badges (`bg-emerald-600/30 text-emerald-300 border-emerald-500/50`).
   - **Bidirectional State Restoration**: Clicking a revision tab flushes the Monaco buffer, restores the selected codebase snapshot, re-renders the File Explorer, switches the editor to the active file, and restores the execution logs and status badge for that revision.
   - **JSZip Export & Live Preview Sync**: `downloadZip()` packages `currentCodebase.files`, guaranteeing subsequent ZIP downloads export the latest post-run changes. If the Docker Live Preview container is active, `renderLivePreview()` hot-reloads the dev container with the updated code.

#### 6. Automated Testing & Verification Architecture (`tests/test_post_completion.py`)
Requirement R3 is verified through a dedicated, high-performance pytest suite comprising **42 test cases across 6 core test classes**:

| Test Class | Scope & Invariants Tested | Verification Method |
|---|---|---|
| `TestThemingStylingByteIdentical` | CSS/JSX modifications update target files while keeping all untouched files 100% byte-identical. Path normalization for Windows backslashes and casing preservation. | Strict byte equality (`new.encode() == orig.encode()`), SHA-256 cryptographic digests, in-memory object reference equality (`is`). |
| `TestFormFieldAdditionAndFileCreation` | Form field additions modify target components; new utility/modal files increment codebase count ($N \to N+1$) with sanitized paths. | File count delta assertions ($N+1$), path sanitization (`./` and `\\` stripped), untouched file invariance. |
| `TestTechnicalQueryImmutability` | Streaming technical Q&A queries return markdown answers without mutating codebase buffers or executing Docker containers. | Pre- and post-query SHA-256 hash vectors, file count invariance, zero calls to `main.execute_code`. |
| `TestConsecutivePostCompletionRevisions` | Sequential revisions ($Rev 0 \to Rev 1 \to Rev 2 \to Rev 3$) maintain cumulative feature persistence, isolated snapshot immutability, and bidirectional tab switching state restoration. | Multi-revision chaining assertions, deep snapshot comparisons, tab switching restoration checks, ZIP download payload verification. |
| `TestFastAPIPostCompletionEndpoints` | HTTP route validation for `/api/post-completion/modify` and `/api/post-completion/query`, executor sandbox invocation, graceful error trapping, and Pydantic 422 schema validation. | `fastapi.testclient.TestClient(app)`, mock executor responses, 200/422 status assertions, `text/plain` streaming validation. |
| `TestKeyBalancerAndModelResolution` | Mode-based model selection (QUICK $\to$ `gemini-3.5-flash-lite`, COMPLEX $\to$ `gemini-3.7-flash`), HTTP 429 rate-limit key rotation, and secondary model fallback. | `unittest.mock.patch`, simulated `ResourceExhausted` 429 exceptions, model argument inspection, multi-key rotation verification. |

**Performance & Determinism**: The entire 42-test suite executes in **< 1.5 seconds** with zero external network or Docker daemon dependencies, ensuring instant CI/CD feedback and absolute zero regressions across the AutoDev platform.

---

## 7. Verification & Test Suite Documentation

AutoDev includes an exhaustive test suite covering unit contracts, end-to-end pipeline flows, adversarial DAG stress scenarios, and decorator resilience.

```
+====================================================================================================+
|                                    AUTODEV VERIFICATION MATRIX                                     |
+====================================================================================================+
| Test Suite File                    | Test Focus & Scope                        | Test Count & Mode |
+------------------------------------+-------------------------------------------+-------------------+
| test_pipeline_flow.py              | 4 Integration Tiers + Subsystem Contracts | 13 Test Cases     |
| test_pipeline_stress_challenge.py  | 5 Adversarial Concurrency Challenges      | 5 Stress Cases    |
| test_backoff.py                    | Exponential Backoff & Fallback Matrix     | 24 Unit Cases     |
+====================================================================================================+
```

### 7.1 Automated Integration Suite (`test_pipeline_flow.py`)

`test_pipeline_flow.py` verifies the complete lifecycle across 4 formal testing tiers:

1. **Tier 1: Single Component Full Lifecycle**:
   - `test_tier1_single_component_full_lifecycle`: Pushes a single component from `CREATED` through `DESIGN`, `CODEGEN`, and `CRITICS` to `COMPLETED`.
2. **Tier 2: Boundary & Corner Cases**:
   - `test_tier2_cyclic_dag_rejection`: Confirms immediate HTTP 400 rejection of cyclic dependency graphs.
   - `test_tier2_empty_components_init`: Verifies empty decomposition handling.
   - `test_tier2_idle_ticks_no_active_components`: Asserts empty assignment arrays on idle ticks.
   - `test_tier2_stale_stage_completion`: Verifies rejection of duplicate or out-of-order `/api/pipeline/complete` calls.
   - `test_tier2_schema_field_compatibility`: Validates compatibility with both `dependencies` and `dependencies_on`.
   - `test_tier2_reset_and_isolation`: Verifies that consecutive runs do not leak state across pipeline initializations.
3. **Tier 3: Revision Feedback Loop**:
   - `test_tier3_single_revision_flow`: Tests `CRITICS` revise $\to$ `CODEGEN` $\to$ `CRITICS` pass $\to$ `COMPLETED`.
   - `test_tier3_multi_revision_flow`: Tests 2 consecutive revisions before passing.
   - `test_tier3_max_revisions_exceeded_quarantine`: Verifies transition to `QUARANTINED` when revision cap (3) is exceeded.
   - `test_tier3_terminal_fail_verdict`: Verifies transition to `FAILED` on unrecoverable failure.
4. **Tier 4: Multi-Component Concurrent DAG Acceptance Simulation**:
   - `test_tier4_concurrent_dag_acceptance_3_components`: Simulates 3 concurrent components ($A \to B, C$) with interleaved stage progression, 0 deadlocks, and verified topological ordering.
   - `test_tier4_complex_stress_dag_simulation`: Simulates a 6-node multi-layered dependency graph.
5. **Subsystem Unit Contracts**:
   - `test_state_transitions_quarantined_and_stalled_to_completed`: Validates transition rules.
   - `test_priority_queue_min_heap_ordering`: Verifies min-heap ordering and the $-10000$ revision bonus.

### 7.2 Empirical Stress & Challenger Suite (`test_pipeline_stress_challenge.py`)

`test_pipeline_stress_challenge.py` executes 5 adversarial stress scenarios:

1. **Challenge 1: Massive 20-Node Multi-Tier DAG Concurrency**: Validates high concurrency across 4 layers of 5 nodes each, enforcing stage mutex single-occupancy and DAG invariants across 20 nodes.
2. **Challenge 2: Inverted Priority Order Dependency Resolution**: Tests DAG with upstream low-priority nodes (priority 100) blocking downstream high-priority nodes (priority 1), confirming dependencies resolve before priorities.
3. **Challenge 3: Poison Pill Quarantine & Cascade Behavior**: Injects a failing component with $K \ge 3$ revisions, confirming poison pill quarantine and downstream cascade stall while independent subgraphs complete.
4. **Challenge 4: Multi-Threaded Concurrent Polling & Completion Races**: Spawns 10 concurrent threads polling `/api/pipeline/tick` and posting `/api/pipeline/complete`, verifying thread safety and 0 race condition crashes.
5. **Challenge 5: Randomized Monte Carlo Fuzzing**: Runs 10 randomized iterations with random topologies (3–8 nodes), random priorities, and randomized revision verdicts.

### 7.3 Decorator & Resilience Unit Suite (`test_backoff.py`)

`test_backoff.py` (1,287 lines) validates the `@with_exponential_backoff` decorator and fallback routing:
- Verifies retry delays of 1.0s and 2.0s with success on the 3rd attempt.
- Confirms fast-fail behavior on non-retryable exceptions (`ValueError`, `KeyError`, 400 Bad Request).
- Verifies retry behavior across sync functions, sync generators, async coroutines, and async generator streams.
- Tests mock fallback from `gemini-3.6-flash` to `gemini-3.5-flash-lite` on 503 UNAVAILABLE.

### 7.4 Formal Verification Execution Procedures

To run the complete verification test suite across all subsystems:

```powershell
# 1. Run Comprehensive End-to-End Pipeline Integration Suite
pytest test_pipeline_flow.py -v

# 2. Run Adversarial Concurrency & Stress Challenger Suite
pytest test_pipeline_stress_challenge.py -v

# 3. Run Universal Exponential Backoff & Balancer Resilience Suite
python -m unittest test_backoff.py -v

# 4. Run All Test Suites in Unified Sequence
pytest test_pipeline_flow.py test_pipeline_stress_challenge.py -v
```

---



### Aug 29, 2026 - Critical Deadlock Diagnosis & UI Fixes

#### 1. Stage Lease Timeout (The "Queued for Code" Deadlock)
**Issue:** Users experienced a severe deadlock where Component 1 would complete the DESIGN stage but permanently hang in "Queued for Code", preventing Components 2 and 3 from progressing.
**Root Cause:** The `PipelineConfig` was defaulting to a `lease_duration_sec` of `30.0` seconds. Since the LLM generation and manual review process took longer than 30 seconds, the DAG lock manager proactively revoked the lease for Component 1. When the UI eventually called `/api/pipeline/complete`, the `StageHandoverProtocol` correctly detected that the lease was lost and aborted the stage handover, leaving the component permanently orphaned in `IN_STAGE` without enqueuing it to `CODEGEN`.
**Fix:** Increased the global `lease_duration_sec` and `stage_timeout_sec` in `PipelineConfig` to `3600.0` seconds to safely accommodate manual human-in-the-loop review phases without premature lock revocation.

#### 2. Terminal Logging Enhancements & Crash Resolution
- Implemented enriched terminal logging to display the precise Component Name, Agent active in the stage, API Key in use, and Revision Attempts.
- Fixed an `AttributeError` (`ComponentStatus.QUEUED`) injected during the terminal update which was independently failing the polling mechanism.

#### 3. Horizontal Pipeline Carousel UI & Toggler
- Re-styled the component pipeline grid to a strict horizontal carousel. Components now render with full width `w-full` inside a `flex-row` with `snap-x` mechanics, eliminating vertical scrolling.
- Reverted the component block backgrounds to the requested "Old UI" aesthetic (bright white `bg-white`, slate borders, and vibrant text colors).
- Implemented a "Pill-shaped Toggle Bar" above the pipeline tracks, allowing users to rapidly click a component's name to auto-scroll the carousel smoothly to that specific component.


#### 4. Monaco Editor Revision History Integrity Fix
- **Issue:** When a component required revision in QUICK mode (or COMPLEX mode), switching back to view the "Initial" revision tab resulted in the very first file's source code displaying `"Agent is writing code..."` rather than the initial generated code.
- **Root Cause:** In `backend/index.html`, `startComponentCode` called `componentEditors[cId].setValue("Agent is writing code...")` to render a loading placeholder. Because the editor's `activeRevisionIndex` and `activeFileIndex` were still pointing to revision 0, file 0, Monaco's `onDidChangeModelContent` listener fired synchronously and mutated `state.revisionHistory[0].codebase.files[0].source_code` in memory.
- **Fix:** Added `isProgrammaticComponentEditorUpdate` guard flag, guarded `onDidChangeModelContent` to ignore programmatic updates and check `state.status !== 'coding'`, safely cloned `prevCodebase` before setting loading placeholders, and ensured `switchComponentFile` performs deep cloning of historical revision codebases.


#### 5. Dynamic Revision System (Hybrid Approach - Proposal E)
- **Architecture**: Replaces fixed 1-3 revision limits with dynamic budgets, weighted severity composite scoring, and early-stop delta checks.
- **Weighted Composite Formula**: Correctness 50%, Architecture 20%, Completeness 30%.
- **Auto-Pass Boundary**: If weighted composite score is <= 2.0, component auto-passes critics without invoking LLM adjudicator.
- **Dynamic Budget Calculation**: Computed dynamically as min(5, ceil(composite / 3)).
- **Early-Stop Delta Detection**: If revision improvement delta between consecutive cycles is <= 1.0, early stop terminates the revision cycle with approval to prevent diminishing returns.
- **Frontend Integration**: Updated single-pass, component DAG, and integration phase self-correction loops in `index.html` to dynamically consume and display budget allocations (e.g., "Attempt 1/4") and respect early-stop signals.

#### 6. Jest ESM/CommonJS Compatibility Fix
- **Issue:** AutoDev-generated JavaScript projects intermittently failed tests with `SyntaxError: Cannot use import statement outside a module` because `jest.setup.js` was written using ESM `import` syntax while Jest runs in CommonJS mode by default.
- **Root Cause:** The Design Agent and CodeGen Agent system prompts gave no guidance on Jest's ESM vs CommonJS requirements, so the LLM would freely mix `import` and `require` depending on context.
- **Fix:** Added explicit mandatory rules to both `backend/agents/design_agent.py` and `backend/agents/codegen_agent.py` instructing the AI to always:
  1. Generate `babel.config.js` with `@babel/preset-env` targeting `node: 'current'`
  2. Add `babel-jest`, `@babel/core`, and `@babel/preset-env` to `devDependencies`
  3. Add a `jest` config block in `package.json` with the `babel-jest` transform and `testEnvironment: jsdom`
  4. Write `jest.setup.js` using CommonJS `require()` only - never ESM `import`

### Sep 07, 2026 - Critical Deadlock Resolution and Deterministic Revision

#### 1. Frontend "Queued for Code" Deadlock Fix
- **Issue**: Users experienced a severe pipeline deadlock where 2 or more components remained permanently stuck in the "Queued for Code" (`coding_queued`) state on the UI, while the console and backend logged partial completions.
- **Root Cause**: If the browser's fetch calls (like `/api/generate-code`) encountered a network error, rate limit, or backend 500 error, the UI `catch(e)` block correctly updated the visual state to `failed`, but **failed to notify the backend**. This caused the backend lock manager to permanently hold the exclusive `CODEGEN` or `CRITICS` lock for that component. Due to the strict mutual-exclusion design of the DAG engine, no subsequent components could enter the `CODEGEN` stage, permanently hanging the rest of the pipeline in `coding_queued`.
- **Fix**: Added explicit lock-release API calls (`fetch('/api/pipeline/complete', { verdict: 'error' })`) to all pipeline `catch` blocks in `backend/index.html`. Modified `backend/autodev_pipeline/scheduler.py` to correctly interpret `verdict == 'error'` by unconditionally releasing the stage lock, transitioning the component to `FAILED`, and halting downstream dependencies without stalling the entire DAG.

#### 2. Deterministic Adjudicator & Testing Overhaul
- Removed the stochastic LLM-based `node_adjudicator` entirely, replacing it with a deterministic Python gate-logic engine in `backend/orchestrator.py`.
- Replaced Jest with Vitest + ESM for modern frontend testing, avoiding CommonJS legacy module conflicts.
- Added E2E testing support using Playwright.
- Increased the sandbox Docker timeout from 60s to 180s to prevent premature termination of complex Vitest/Playwright suites.

*Master System Documentation compiled autonomously for AutoDev. Verified against Git commit history (c80d011 to a0db60c), source code implementations, and integration test suites.*


### Frontend-Backend Revision Sync Deadlock (Fixed)
**Issue:** Components were deadlocking in a "Queued for Code" state while the backend showed them as "COMPLETED".
**Root Cause:** The 
ode_adjudicator dynamically adjusts the retry budget (dynamic_budget=3 for execution failures) and the frontend respects this by allowing 3 retries. However, the backend scheduler.py hardcoded max_revisions=2. During the second retry, the frontend sent erdict: revise (expecting the component to loop back to CODEGEN), but the backend saw that 
evision_count (2) >= max_revisions (2) and autonomously force-proceeded the component to COMPLETED. The frontend awaited a CODEGEN assignment that would never arrive.
**Fix:** Updated CompleteStageInput to accept dynamic_budget from the frontend, and patched complete_stage_execution to dynamically sync comp.max_revisions = dynamic_budget when received.

### Live Preview Connection Refused Bug (Fixed)
**Issue:** The Live Preview consistently threw "localhost refused to connect".
**Root Cause:** Two issues were at play. First, dev servers like Vite and Webpack bind to 127.0.0.1 inside the Docker container by default, making them inaccessible from the host machine despite port mapping. Second, the frontend blindly assigned the iframe source after a hardcoded 5-second timeout, which was vastly insufficient for containers running 
pm install.
**Fix:**
- Injected HOST=0.0.0.0, VITE_HOST=0.0.0.0, and HOSTNAME=0.0.0.0 environment variables into the Docker container instantiation to force internal servers to bind to the network interface.
- Replaced the hardcoded 5-second UI timeout with a robust polling mechanism that pings the target URL using 
o-cors mode, ensuring the iframe only mounts once the dev server actually begins accepting TCP connections.
- Added a 2.5-second crash detection in the backend start_preview API, returning container logs directly to the frontend if the dev server immediately terminates (e.g. due to syntax errors).

### Deadlock Edge-case has_exceeded_revisions (Fixed)
**Issue:** The user experienced another deadlock exactly after 2 revisions in QUICK mode. The frontend showed the component stuck in "Queued for Code" while the backend logs indicated "Forced advancement after 3 revisions".
**Root Cause:** A subtle off-by-one error in the backend's has_exceeded_revisions() logic. The frontend loops while 
evisionCount < maxCompRevs, meaning the final allowed retry attempt strictly equals the budget. When the frontend sent erdict: revise for the final allowed retry (e.g. attempt 3 of 3), the backend incremented its counter to 3, evaluated 3 >= 3, and prematurely killed the final retry, forcing the component to COMPLETED. The frontend awaited CODEGEN for the final retry, resulting in a deadlock.
**Fix:** Modified has_exceeded_revisions() in ackend/autodev_pipeline/models.py to evaluate strictly greater than (>) rather than greater-than-or-equal-to (>=). This perfectly aligns the backend safety net with the frontend's loop boundaries. Additionally, normalized the fallback default budget for QUICK mode to 2 across all index.html catch blocks.

### Live Preview Missing Python Bug (Fixed)
**Issue:** The Live Preview crashed with sh: 1: python: not found when rendering plain HTML sites.
**Root Cause:** The system prompt instructs the AI to use python -m http.server 8080 --bind 0.0.0.0 as a fallback command if a dev server is not defined. If the AI also selected a Node-based Docker image (e.g., 
ode:20-alpine) for a plain HTML site, the container would attempt to execute Python, which is not installed in Node images.
**Fix:** Added an interceptor in main.py (start_preview) that intelligently detects if the python -m http.server command is being passed to a Node-based image, and seamlessly rewrites the command to 
px --yes serve -p 8080 -H 0.0.0.0. The --yes flag prevents 
px from hanging on interactive installation prompts.

### Playwright Version Mismatch Bug (Fixed)
**Issue:** Components with Playwright integration tests frequently failed with Error: browserType.launch: Executable doesn't exist at /ms-playwright/chromium.... The error logs stated: Looks like Playwright was just updated to 1.63.0. Please update docker image as well. - current: mcr.microsoft.com/playwright:v1.48.0-jammy.
**Root Cause:** The master_architect agent instructed the creation of a mcr.microsoft.com/playwright:v1.48.0-jammy docker image, but the AI commonly authored package.json with "@playwright/test": "^1.48.0" or "*". During the test execution phase, 
pm install automatically resolved and installed the newest NPM package (e.g. 1.63.0). Playwright NPM packages are strictly hardcoded to specific binary versions, so 1.63.0 crashed when looking for its binaries inside a 1.48.0 container.
**Fix:**
- Updated the AI prompts (master_architect.py, design_agent.py, integrator_agent.py) to emphasize locking @playwright/test to exactly "1.48.0".
- Added an automatic fallback interceptor in executor.py that parses the requested Playwright version from the docker_image string, and automatically appends 
pm install @playwright/test@<version> --save-exact directly after the base 
pm install. This explicitly guarantees the installed NPM package perfectly matches the container's pre-installed binaries, entirely preventing the mismatch crash.

### Test Cleanup in Downloadable ZIP
**Issue:** Users requested the ability to download a clean project ZIP without the AutoDev automated test files (Playwright, Pytest, Vitest) included.
**Fix:** Intercepted the downloadZip() function in the frontend index.html. It now automatically filters out all common test files (.test.js, 	est_*.py, 	ests/, __tests__/, playwright.config.js, etc.) before zipping the codebase. Additionally, it safely parses package.json and 
equirements.txt to seamlessly strip out testing dependencies (@playwright/test, itest, pytest) and test commands from the final source.

### Critic Evaluation History
**Feature:** Added a history viewer for the Arbitration Feedback phase.
**Implementation:** Similar to the Code Revision tabs, the frontend now stores the complete evaluation history (execLogs, rbitration, and erdict) locally during the pipeline run. We inject a tabbed interface inside the Arbitration Feedback section, allowing the user to seamlessly toggle through [Initial Eval], [Rev 1 Eval], etc. This enables the user to compare exactly how the codebase improved (or regressed) across each iterative revision generated by the critics.

### Pre-Flight Linting & Golden Stacks (Hallucination Prevention)
**Feature:** Added a system to permanently prevent dependency mismatch crashes and API hallucination errors (like the lucide-react undefined element crash).
**Implementation:** 
1. **Golden Stacks (ackend/golden_stacks.py)**: Intercepts the generated package.json for React/Vite projects before Docker execution. Instead of allowing the AI to invent potentially dangerous or outdated library versions, the pipeline dynamically forces a predefined "Golden" dependency matrix, guaranteeing that React, React Router, Vite, and Playwright versions are strictly pinned to working versions.
2. **Static Analysis Pre-Flight**: Modified executor.py to conditionally inject 
pm run lint (ESLint) directly into the test command if a lint script exists in the package file. If the AI hallucinates an import, the static analyzer catches it instantly and fails the execution early. This feeds the exact AST error directly to the Critic Subagent for a rapid self-healing cycle, completely bypassing slow runtime browser timeouts.

### Test Stability Overhaul (Supertest Ban + React Import Injection + Display Name Fix)
**Problem:** AI-generated React apps were stuck in an unresolvable doom loop during testing:
1. ESLint `react/display-name` rule blocked anonymous arrow components in route configs.
2. `supertest` (Node-only HTTP library) was imported in test files but Vitest runs through Vite (browser-oriented), so `supertest` could never be resolved.
3. `.jsx` test files crashed with `React is not defined` because the jsdom test environment requires an explicit `import React` even with the new JSX transform.
4. The Critic scored passing-but-simple tests as sev 6, triggering destructive rewrites that introduced new bugs (regression loop).

**Fixes Applied:**
- **`golden_stacks.py`**: Added `'react/display-name': 'off'` to ESLint config. Added `supertest` and `superagent` to a banned dependencies blocklist that strips them from any AI-generated `package.json`. Added auto-injection of `import React from 'react'` into all `.test.jsx` / `.test.tsx` files if missing.
- **`codegen_agent.py`**, **`design_agent.py`**, **`integrator_agent.py`**: Updated system prompts to explicitly ban `supertest`, mandate `import React` in test files, and instruct the AI to test server logic by importing handler functions directly instead of using HTTP testing libraries.

### Live Preview 3-Layer Defense System (Premature Exit Prevention)

**Problem / Root Cause:**
The Docker live preview system (`POST /api/preview/start`) experienced premature container exit crashes reporting `sh: 1: python: not found`.
1. **Playwright Image Bypass**: The previous command rewriting interceptor in `main.py` only checked `if "node" in image.lower() and "python -m http.server" in cmd`. When the design or architect agent generated a multi-component system using the standard Playwright image `mcr.microsoft.com/playwright:v1.48.0-jammy` with a static or fallback server command `python -m http.server 8080`, the check evaluated to `False` (since `"node"` was not in `"playwright"`). The container then attempted to run `python`, which does not exist in Debian Playwright base images.
2. **Missing Dev Server Command Fallbacks**: When blueprints set `dev_server_command: "NONE"` or `dev_server_port: 0`, the server defaulted to Python HTTP server unconditionally, regardless of whether the application was a Node or React/Vite project.
3. **Agent Prompt Hallucinations**: Prompt instructions in `design_agent.py`, `master_architect.py`, and `integrator_agent.py` provided conflicting advice, suggesting `python -m http.server` for static HTML even inside Node/Playwright environments.

**3-Layer Defense Solution:**

1. **Layer 1: Runtime Command Normalization (`backend/main.py`)**:
   - Replaced narrow `"node"` image check with a comprehensive non-Python detection heuristic: `is_python_image = "python" in image.lower()`.
   - Any non-Python image (including Playwright, Node, Bun, and Deno) executing `python -m http.server` or `python3 -m http.server` has its command rewritten to `npx --yes serve -p <port> -H 0.0.0.0`.
   - Binds host addresses uniformly using `-H 0.0.0.0` or `--bind 0.0.0.0`.

2. **Layer 2: Deterministic Codebase Heuristic Fallback (`backend/main.py`)**:
   - When `cmd == "NONE"` or `internal_port == 0`, the endpoint deterministically inspects the payload codebase files:
     - **Vite Projects** (has `package.json` with `vite` dependency): Configures `npm run dev -- --host 0.0.0.0` on internal port `5173`.
     - **Generic Node Projects** (has `package.json`): Configures `npx --yes serve -p 3000 -H 0.0.0.0` on internal port `3000`.
     - **Static HTML Web Apps** (has `index.html`): Configures `npx --yes serve -p 8080 -H 0.0.0.0` on port `8080` (or `python3 -m http.server 8080 --bind 0.0.0.0` if running in a genuine Python image).
     - **Python Projects**: Preserves `python3 -m http.server 8080 --bind 0.0.0.0` on port `8080`.

3. **Layer 3: Agent Prompt Guardrails & Compatibility Mandates**:
   - Updated system prompts in `design_agent.py`, `master_architect.py`, and `integrator_agent.py`.
   - Mandated that `dev_server_command` and `docker_image` must be strictly compatible.
   - For React/Vite web apps, mandated setting `dev_server_command` to `npm run dev -- --host 0.0.0.0` with `dev_server_port: 5173`.
   - Strictly prohibited generating Python server commands when using Node or Playwright Docker images.

### Architectural Blueprint Phase Transition Fix (Null Button Guard)

**Problem:**
When running simple products (`!decomposition.is_complex`), the pipeline transitions into single-pass design generation (`generateDesign()`). The frontend threw an unhandled runtime exception:
`TypeError: Cannot set properties of null (setting 'disabled') at setButtonLoading`
This halted execution immediately and caused the application to freeze in the architectural blueprint phase.

**Root Cause:**
1. In an earlier iteration, the Phase 1 transition button `designBtn` was replaced with `decomposeBtn`. In simple product mode, `runDecomposition()` dynamically created `simpleDesignBtn` instead.
2. However, `generateDesign()` still called `setButtonLoading('designBtn', 'designSpinner', true)`.
3. `setButtonLoading()` did not check whether `btn` or `spinner` existed before setting `btn.disabled = true`, causing an unhandled promise rejection.
4. Additionally, `runDecomposition()` was prematurely marking stepper 2 as `'success'` before design generation had even begun.

**Fix Applied:**
1. **Defensive `setButtonLoading`**: Made `setButtonLoading()` strictly null-safe by guarding `btn` and `spinner` lookups before modifying DOM properties.
2. **Dynamic Target Resolution in `generateDesign()`**: Updated `generateDesign()` to resolve the active design button dynamically (`document.getElementById('simpleDesignBtn') ? 'simpleDesignBtn' : 'designBtn'`) with its corresponding spinner.
3. **Stepper Timing Correction**: Removed the premature `updateStepper(2, 'success')` call in `runDecomposition()`. Stepper 2 now transitions to `'loading'` when `generateDesign()` starts and `'success'` only after the blueprint JSON is validated.

### Technical Query Response Human-Readable Formatting

**Feature:**
Converted the Post-Completion Technical Query advisory responses from raw unformatted Markdown into structured, human-readable documentation matching the visual style and typography of the Requirements (`#jsonOutput`) and Architectural Blueprint (`#designJsonOutput`) document cards.

**Implementation:**
1. **Frontend Document Card Styling (`backend/index.html`)**:
   Replaced the dark raw text block with the signature document card layout: white card background (`bg-white rounded-lg border border-slate-200 shadow-sm`), uppercase pulse badge (`READ-ONLY TECHNICAL EXPLANATION`), a copy-text button, and clean inner content area (`bg-slate-50 text-slate-800`).
2. **Client-Side Markdown to Human-Readable Formatter (`formatMarkdownToHumanReadable`)**:
   Transforms streaming Markdown chunks and completed responses into clean structured text:
   - Headers (`#`, `##`, `###`) are transformed to clean capitalized section headers (e.g., `OVERVIEW:`, `ARCHITECTURE & PATTERNS:`).
   - Code blocks (```` ``` ````) are converted to cleanly indented `[CODE SNIPPET]:` blocks.
   - List asterisks/dashes (`*`, `-`) are standardized to clean bullet points (`•`).
   - Markdown syntax artifacts (`**bold**`, `*italic*`, `` `code` ``) are stripped/standardized to clean human-readable text.
3. **Backend Agent Prompt Alignment (`backend/agents/refactor_agent.py`)**:
   Updated `QUERY_SYSTEM_PROMPT` to instruct Gemini models to directly author clean, well-structured technical text with capitalized section titles, clean bullet points, and indented code snippets.

### 6.8 Cross-Runtime Docker Execution Defense: Prevention of `sh: 1: pip: not found`

**Problem:**
During the Docker execution and sandbox testing phase, multi-component pipelines executing Go, Node, Playwright, or Rust components were failing with:
`sh: 1: pip: not found`
This caused test execution to immediately exit with code 127, triggering repeated mandatory revisions and blocking pipeline progression.

**Root Cause:**
In `backend/executor.py`, `resolve_test_runner_command()` inspected `codebase.files` to check if `requirements.txt` was present. If `has_requirements_txt` evaluated to `True`, the executor unconditionally injected:
`pip install -r requirements.txt && <base_cmd>`
When a Go component (e.g. `golang:1.22-bookworm` running `go test ./...`) or a Node/Playwright component contained a `requirements.txt` file (e.g. from an upstream decomposition manifest or agent hallucination), `pip install` was prepended to the command. Since `pip` does not exist inside Go, Node, Playwright, or Rust container images, the shell exited with `pip: not found`. Similarly, if a Python container had an auxiliary `package.json`, `npm install` could be erroneously injected into a container lacking Node.js.

**Defense & Architectural Resolution:**
1. **Mutually Exclusive Runtime Environment Detection (`backend/executor.py`)**:
   - Explicitly evaluates Docker image tags (`is_python_image`, `is_go_image`, `is_rust_image`, `is_node_image`).
   - Categorizes runner commands (`is_go_runner`, `is_rust_runner`, `is_node_runner`, `is_python_runner`).
   - Establishes strict mutually exclusive runtime flags (`is_node_env` vs `is_python_env`).
2. **Runtime-Guarded Dependency Pre-Flight Injections**:
   - `npm install` is strictly guarded by `is_node_env` and will NEVER be injected into Go, Rust, or Python containers.
   - `pip install` is strictly guarded by `is_python_env` and will NEVER be injected into Go, Rust, Node, or Playwright containers.
3. **Multi-Tier Resilient Python Package Installation**:
   - In Python environments, bare `pip install` is replaced with a 4-tier resilient fallback supporting PEP 668 (`--break-system-packages`), standard `pip`, and `python3 -m pip`:
     ```bash
     (pip install --break-system-packages -r requirements.txt 2>/dev/null || \
      pip install -r requirements.txt 2>/dev/null || \
      python3 -m pip install --break-system-packages -r requirements.txt 2>/dev/null || \
      python3 -m pip install -r requirements.txt 2>/dev/null || \
      python -m pip install -r requirements.txt)
     ```
4. **Live Preview Defense Alignment (`backend/main.py`)**:
   - Applied the same `is_python_docker_image` guard and multi-tier pip invocation fallback in `start_preview` to prevent live preview container boot crashes.
5. **Automated Verification (`tests/test_docker_executor.py`)**:
   - Added automated unit test suite verifying Go, Playwright, Rust, and Python permutations with conflicting manifest files.

---

### 6.9 State Persistence Engine, In-Flight Phase Auto-Recovery & Dual-Button Control Plane

```
+====================================================================================================+
|                    STATE PERSISTENCE & FAULT-TOLERANT CONTROL PLANE ARCHITECTURE                   |
+====================================================================================================+
|                                                                                                    |
|  [ User Initiates Development: "Execute SYS.REQ_COMPILER" ]                                        |
|                          │                                                                         |
|                          ▼                                                                         |
|    #submitBtn TRANSFORMS INTO DUAL-BUTTON CONTROL PLANE (#pipelineControlGroup)                    |
|    ┌───────────────────────────────────┬───────────────────────────────────┐                       |
|    │       #abortDevBtn                │      #requestNewProductBtn        │                       |
|    │  - AbortController.abort()        │  - Flush localStorage             │                       |
|    │  - CountdownManager.cancelAll()   │  - Clear #featureRequest          │                       |
|    │  - pipelineStatus = 'aborted'     │  - Deep resetUI() DOM purge       │                       |
|    │  - State Preserved for Inspection │  - Restore #submitBtn             │                       |
|    └───────────────────────────────────┴───────────────────────────────────┘                       |
|                          │                                                                         |
|                          ▼                                                                         |
|           StateStore PERSISTENCE LAYER ('autodev_state_v1')                                        |
|    ┌───────────────────────────────────────────────────────────────────────┐                       |
|    │  - Debounced (300ms) writes during token streaming                    │                       |
|    │  - Synchronous milestone flushes on phase transitions                 │                       |
|    │  - localStorage primary storage with sessionStorage fallback          │                       |
|    │  - QuotaExceededError automatic storage pruning defense               │                       |
|    └───────────────────────────────────────────────────────────────────────┘                       |
|                          │                                                                         |
|           ┌──────────────┴──────────────┐                                                          |
|           ▼                             ▼                                                          |
|   [ Browser Refresh / F5 ]    [ Network Disconnect ]                                               |
|           │                             │                                                          |
|           ▼                             ▼                                                          |
|   DOMContentLoaded Bootloader    window.ononline Listener                                          |
|   - Parse autodev_state_v1       - Re-establish SSE connection                                     |
|   - Render #restorationBanner    - Retry interrupted fetch                                         |
|   - Hydrate UI / Monaco tabs     - Zero progress loss                                              |
|           │                                                                                        |
|           ▼                                                                                        |
|   9-PHASE IN-FLIGHT AUTO-RECOVERY MATRIX                                                           |
|   - Requirements    -> Re-compile requirements stream                                              |
|   - Decomposition   -> Re-execute architecture decomposition                                       |
|   - SP Design       -> Re-generate design blueprint                                                |
|   - SP Codegen      -> Restart single-pass code generation                                         |
|   - SP Execute      -> Re-trigger sandbox docker run                                               |
|   - SP Critics      -> Re-evaluate codebase through critics                                        |
|   - Component DAG   -> Preserve completed nodes; resume active node ticker                         |
|   - Integration     -> Re-run multi-component code merger & test                                   |
|   - Documentation   -> Re-generate system documentation                                            |
|                                                                                                    |
+====================================================================================================+
```

#### 1. Motivation & Core Guarantees
Prior to this architecture, browser reloads (`F5`), accidental tab closes, or transient network blips during lengthy LLM generation or Docker execution phases would wipe the frontend memory state, resetting the entire UI back to the initial prompt screen. Users were forced to restart multi-stage pipelines from scratch, losing all generated blueprints, code files, and critic arbitration history.

The State Persistence Engine and Fault-Tolerant Control Plane establish four invariant guarantees:
1. **Unconditional Pipeline Continuity**: The pipeline runs continuously and **only stops** when the user explicitly clicks `#abortDevBtn` ("Abort Development") or `#requestNewProductBtn` ("Request New Product").
2. **In-Flight Phase Auto-Recovery**: Interrupted phases automatically re-trigger and resume execution upon page reload without user intervention.
3. **Multi-Component DAG Preservation**: In multi-component projects, all upstream completed components, their Monaco editor revision tabs, and critic cards remain preserved in memory and storage. Only the interrupted component's active phase re-executes, smoothly resuming the DAG scheduler ticker.
4. **Transient Disconnect Immunity**: Temporary network drops do not reset or fail the pipeline; the system registers online reconnect listeners and retries failed calls.

#### 2. Dual-Button Control Plane Mechanics (`#pipelineControlGroup`)
Upon development initiation (e.g. clicking `#submitBtn` or auto-restoring an active run), `#submitBtn` is hidden and replaced by `#pipelineControlGroup`:

```html
<div id="pipelineControlGroup" class="flex gap-2">
  <button id="abortDevBtn" class="flex-1 py-2 px-4 rounded font-mono text-xs uppercase bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow transition-colors flex items-center justify-center gap-2">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    Abort Development
  </button>
  <button id="requestNewProductBtn" class="flex-1 py-2 px-4 rounded font-mono text-xs uppercase bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold shadow transition-colors flex items-center justify-center gap-2">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
    Request New Product
  </button>
</div>
```

- **`abortDevelopment()`**:
  - Halts all active countdown timers via `CountdownManager.cancelAll()`.
  - Aborts active network fetch streams via `activeAbortController.abort()`.
  - Sets `pipelineStatus = 'aborted'`.
  - Halts the DAG scheduler ticker (`pipelineTickerActive = false`).
  - **Crucially preserves all DOM state and persistent storage**, allowing the user to review generated blueprints, explore code files in Monaco, inspect critic logs, and read docstrings without any data loss.
- **`requestNewProduct()`**:
  - Aborts active network streams and cancels countdowns.
  - Flushes storage via `localStorage.removeItem('autodev_state_v1')` and `sessionStorage.removeItem('autodev_state_v1')`.
  - Empties `#featureRequest` textarea.
  - Executes comprehensive `resetUI()` cleanup: destroys Monaco instances, clears file trees, resets steppers, resets DAG carousels, and hides all output cards.
  - Restores `#submitBtn` and hides `#pipelineControlGroup`.

#### 3. Persistent Storage Engine (`StateStore`)
The `StateStore` module encapsulates safe, performant client-side persistence:
- **Key**: `autodev_state_v1`
- **Dual-Storage Resilience**: Writes to `window.localStorage` with automatic fallback to `window.sessionStorage` if localStorage is blocked by browser privacy policies.
- **Debounced Writes (300ms)**: During high-frequency streaming token ingestion (Requirements, Design, Codegen), `StateStore.saveDebounced()` coalesces mutations to prevent DOM event-loop starvation and disk I/O bottlenecks.
- **Synchronous Milestone Flushes**: On phase boundary transitions (e.g., transition from Design to Codegen, or Codegen to Critics), `StateStore.saveImmediate()` flushes the exact state synchronously.
- **Quota Management & Storage Pruning**: If `QuotaExceededError` is trapped, `StateStore` executes an automated pruning strategy:
  1. Truncates auxiliary execution log history beyond the last 20,000 characters.
  2. Drops intermediate Monaco undo stacks while preserving raw file strings.
  3. Re-attempts serialization.

#### 4. The 9-Phase In-Flight Auto-Recovery Matrix
On `DOMContentLoaded`, `initAutoRecovery()` inspects `StateStore.load()`. If a session exists with `pipelineStatus === 'running'` and an `inFlightPhase` is present:
1. Displays `#restorationBanner` informing the user: `Restored previous development session. Resuming [Phase Name]...` with a manual dismiss control.
2. Hydrates the `#featureRequest` input, mode toggle (QUICK vs COMPLEX), steppers, and pre-existing output cards.
3. Dispatches execution based on the recovery matrix:

| In-Flight Phase Key | State Hydrated Prior to Re-Trigger | Resumed Function | Behavior & DAG Invariants |
|---|---|---|---|
| `requirements` | Prompt input, model selection | `compileRequirements()` | Resumes streaming requirements generation. |
| `decomposition` | Requirements JSON | `runDecomposition()` | Re-evaluates complexity and architectural decomposition. |
| `single_pass_design` | Requirements JSON | `generateDesign()` | Restores requirements card and restarts single-pass blueprint generation. |
| `single_pass_codegen` | Blueprint JSON | `generateCode()` | Restores blueprint card, mounts Monaco editor, and restarts codegen. |
| `single_pass_execute` | Blueprint JSON & Codebase | `runExecution()` | Restores codebase into Monaco and re-triggers Docker container sandbox. |
| `single_pass_critics` | Codebase & Sandbox Logs | `runCritics()` | Restores codebase and sandbox logs; re-evaluates through critic panel. |
| `component_dag` | Decomposition, Completed Components | `resumeComponentDAG()` | **Preserves completed components.** Identifies active component and restarts its specific in-flight stage (`DESIGN`, `CODEGEN`, or `CRITICS`), restarting the pipeline ticker. |
| `integration` | All Component Codebases & Artifacts | `runIntegration()` | Restores component outputs into tabs and re-executes system integration. |
| `documentation` | Integrated Codebase & Blueprints | `generateDocs()` | Restores final codebase and re-runs comprehensive document compiler. |

#### 5. Offline Reconnection Defense
AutoDev attaches a global network event listener:
```javascript
window.addEventListener('online', () => {
  if (pipelineStatus === 'running' && inFlightPhase) {
    showNotification('Network connection restored. Resuming pipeline...', 'info');
    resumeInFlightPhase(inFlightPhase);
  }
});
```
Transient Wi-Fi or Ethernet disconnections trigger graceful retries rather than fatal failures, guaranteeing uninterrupted autonomous software development.

#### 6. Verification & Automated Test Suite (`tests/test_state_persistence.py`)
State persistence and control plane mechanics are validated by **35 automated test cases across 6 comprehensive test classes**:

| Test Class | Invariants & Behaviors Verified |
|---|---|
| `TestStateStoreUnit` | Schema serialization, dual localStorage/sessionStorage fallback, 300ms debouncing, synchronous flushes, and QuotaExceededError handling. |
| `TestDualButtonControlPlane` | `#submitBtn` $\to$ `#pipelineControlGroup` DOM transformation, `#abortDevBtn` and `#requestNewProductBtn` element contracts. |
| `TestAbortDevelopmentMechanics` | `AbortController.abort()` invocation, `CountdownManager.cancelAll()`, `pipelineStatus = 'aborted'`, and UI state preservation. |
| `TestRequestNewProductMechanics` | `localStorage.removeItem('autodev_state_v1')`, input clearing, `resetUI()` invocation, and `#submitBtn` restoration. |
| `TestInFlightPhaseAutoRecoveryMatrix` | Full 9-phase matrix coverage: requirements, decomposition, SP design, SP codegen, SP execute, SP critics, component DAG, integration, and documentation. Multi-component DAG preservation. |
| `TestNetworkDisconnectAndOfflineResilience` | Offline event interception, reconnection trigger (`online`), and auto-retry without data loss. |

All 35 tests pass with 100% determinism in < 1.0s, bringing the complete AutoDev test suite to **82 passing tests** with zero regressions.

---

### 6.10 Polyglot Container Isolation, Test Runner Hijack Defense & Critic-Adjudicator Execution Alignment

```
+====================================================================================================+
|                POLYGLOT CONTAINER ISOLATION & CRITIC EXECUTION ALIGNMENT ARCHITECTURE              |
+====================================================================================================+
|                                                                                                    |
|  [ Polyglot / Mixed Decomposition: e.g., React Frontend + Python Backend Microservice ]            |
|                                       │                                                            |
|                                       ▼                                                            |
|  resolve_docker_image(blueprint, codebase)                                                         |
|  - Inspects actual codebase files (requirements.txt vs package.json)                              |
|  - Auto-corrects pure Python microservices: playwright/node image -> python:3.11-slim             |
|  - Auto-corrects pure Node/React services:  python image          -> playwright/node image         |
|                                       │                                                            |
|                                       ▼                                                            |
|  resolve_test_runner_command(blueprint, codebase)                                                  |
|  - Evaluates is_pure_python: has_py_files && !has_package_json && !has_js_files                    |
|  - Prevents Node stack hijacking: is_node_stack = False when is_pure_python                        |
|  - Preserves pytest: base_cmd = "pytest" (never overridden to "npm test")                          |
|  - Injects 4-tier resilient pip install: (pip install ... || python3 -m pip install ...)           |
|                                       │                                                            |
|                                       ▼                                                            |
|  Docker Sandbox Container Run: execute_code()                                                      |
|  - Spawns python:3.11-slim with pre-installed Python 3.11, pip, and pytest                         |
|  - Complete isolation: zero npm ENOENT package.json crashes                                        |
|                                       │                                                            |
|                                       ▼                                                            |
|  Correctness Critic Alignment: evaluate_correctness()                                              |
|  - Mode B prompt passes Execution Sandbox Status: PASSED / FAILED                                  |
|  - Strict instruction: If execution failed, assign severity >= 6 and detail errors                 |
|  - Deterministic Python Guard: if not exec_success and fb.severity_score <= 2:                       |
|    Enforces severity_score = 8 and issues_list failure details                                     |
|  - Eliminates Critic (0/10) vs Master Adjudicator (Revise) contradiction                           |
|                                                                                                    |
+====================================================================================================+
```

#### 1. Problem & Root Cause Analysis
During polyglot application development (e.g. FastAPI / PyMuPDF backend microservices paired with React/HTML frontends), the pipeline suffered from two coupled failure modes:
1. **Test Runner Hijack (`npm error ENOENT: package.json`)**:
   - Because the Master Architect selected a Playwright Docker image for the overall frontend, the component context passed to the Python microservice inherited `docker_image = "mcr.microsoft.com/playwright:v1.48.0-jammy"`.
   - In `backend/executor.py`, `resolve_test_runner_command()` evaluated `is_node_image = True` and erroneously marked `is_node_stack = True` even though the codebase was 100% Python (`requirements.txt`, `main.py`, `test_main.py`).
   - Line 91 saw `raw_cmd == "pytest"` and replaced it with `"npm test"`, causing npm to crash with `ENOENT: no such file or directory, open '/workspace/package.json'`.
2. **The Critic–Adjudicator Revision Doom Loop**:
   - The Correctness Critic (Gemini) evaluated `test_main.py` in Mode B. Since no failed pytest assertions existed in the log (pytest was never run), the LLM awarded a passing score of `Sev: 0/10`.
   - The Master Adjudicator (deterministic Python gate) checked `if not execution_result.success:` and triggered mandatory `REVISION REQUIRED` on Gate 1 with the raw npm error log.
   - The Codegen Agent received this feedback for 3 consecutive revisions, but because it only writes application code and cannot alter Docker images or test runner commands, all 3 revisions failed identically.

#### 2. Architectural Defenses Implemented

##### Layer 1: Dynamic Docker Runtime Image Resolution (`backend/executor.py`)
Introduced `resolve_docker_image()` to dynamically inspect the codebase files and guarantee container-codebase compatibility:
- **Pure Python Codebases** (`requirements.txt` / `.py` files without `package.json` or `.js` files):
  Automatically normalizes the container image to `python:3.11-slim`, preventing execution inside Node or Playwright images that lack `pip` and `pytest`.
- **Pure Node/React Codebases** (`package.json` / `.js` files without Python files):
  Automatically normalizes the container image to `mcr.microsoft.com/playwright:v1.48.0-jammy`.

##### Layer 2: Pure Python Test Runner Protection (`backend/executor.py`)
In `resolve_test_runner_command()`:
- Evaluates `is_pure_python = (has_py_files or has_requirements_txt) and not has_package_json and not has_js_files and not has_go_files and not has_rust_files`.
- Explicitly excludes pure Python codebases from `is_node_stack`, regardless of what container image was requested.
- Preserves `pytest` whenever `is_pure_python` is True or `raw_cmd.lower() == "pytest"`, completely eliminating `npm test` overrides on Python projects.

##### Layer 3: Deterministic Critic Execution Status Alignment (`backend/agents/critics.py`)
In `evaluate_correctness()`:
- Injected `Execution Sandbox Status: PASSED / FAILED` into the Mode B LLM prompt.
- Explicitly prohibited awarding severity scores $\le 2$ when sandbox execution failed.
- Added a deterministic Python post-processing guard:
  ```python
  def _enforce_execution_status(fb: CriticFeedback) -> CriticFeedback:
      fb.critic_name = critic_name
      if not exec_success and fb.severity_score <= 2:
          fb.severity_score = 8
          if not fb.issues_list:
              fb.issues_list = ["Test suite execution failed in container sandbox (exit code != 0)."]
          fb.overall_comments = f"Execution failed in Docker sandbox. {fb.overall_comments}".strip()
      return fb
  ```
  This guarantees that Critic reports and Adjudicator verdicts remain 100% aligned, preventing misleading 0/10 scores during infrastructure or test crashes.

#### 3. Verification
Automated test suite `tests/test_docker_executor.py` expanded to cover:
- Pure Python microservice in Playwright image auto-correcting to `python:3.11-slim` and running `pytest`.
- Pure Node project in Python image auto-correcting to Playwright.
- Correctness Critic deterministic guard enforcing severity $\ge 6$ on non-zero exit codes.

Total test suite across repository: **85 passing tests (100% pass rate)**.

---

### 6.11 Substring Collision Defense (`sh: 1: go: not found` Prevention) & Integration Test Hardening

```
+====================================================================================================+
|         SUBSTRING COLLISION DEFENSE & INTEGRATION TEST HARDENING ARCHITECTURE                       |
+====================================================================================================+
|                                                                                                    |
|  [ Multi-Component Integration: e.g. FastAPI Backend + Static HTML/CSS Frontend ]                  |
|  - shared_tech_stack: ["Python", "FastAPI", "google-generativeai", "pytest", "HTML", "CSS"]       |
|                                       │                                                            |
|                                       ▼                                                            |
|  Flawed Substring Check (PREVIOUS):                                                                |
|  any(k in s for s in tech_stack for k in ("go", "golang"))                                         |
|  -> "go" in "google-generativeai" == True! -> is_go_stack = True                                    |
|  -> Hijacked base_cmd = "go test ./..."                                                            |
|  -> Container crashed: sh: 1: go: not found (Exit code 127)                                         |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 1: Strict Regex Word Boundaries & File Pre-Flight Guard (RESOLVED):                         |
|  - re.search(r'\b(go|golang)\b', s)                                                                |
|  - Requires has_go_files or has_go_mod or is_go_image                                              |
|  - "google-generativeai", "django", "mongodb", "algorithms" NEVER match Go runner                  |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 2: Manifest-Driven Test Command in Integration UI (RESOLVED):                              |
|  - runIntegration() inspects codebase files rather than guessing from tech stack strings           |
|  - Python backend with HTML frontend -> dynamicTestCmd = "pytest" (not "npm test")                 |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 3: Runtime Docker Image Normalization (RESOLVED):                                           |
|  - Python backend with static HTML/CSS resolves to python:3.11-slim (not Playwright/Node/Go)        |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 4: Integrator Agent System Prompt Hardening (RESOLVED):                                     |
|  - Strictly prohibits placeholder smoke tests (e.g. static HTML title checks or 200 OK on root)    |
|  - Mandates multi-step API tests using fastapi.testclient.TestClient / httpx                       |
|  - Validates file/PDF byte uploads, OCR fallback, session persistence, and error handling          |
|                                                                                                    |
+====================================================================================================+
```

#### 1. Problem & Root Cause Analysis

During the integration phase of a multi-component application comprising a Python backend (using `FastAPI`, `PyMuPDF`, `google-generativeai`, and `pytest`) and an HTML/CSS frontend, the integration pipeline repeatedly failed across all three automated self-correction revisions:
```
Test Execution Results: Failed
sh: 1: go: not found
Execution complete. Invoke the parallel Arbitration Engine.

Correctness Critic (Gemini) Sev: 8/10:
The test execution failed due to an environment command error, and the existing test suite fails to thoroughly validate the complex acceptance criteria outlined in the requirements... Execution log indicates a compilation/execution failure where the 'go' command was not found (sh: 1: go: not found)... The test suite is extremely minimal and consists almost entirely of placeholder or trivial smoke tests (e.g. checking for static text headers) rather than real end-to-end integration across OCR and AI workflows.
```

Forensic investigation revealed two root causes:

##### Root Cause 1: 2-Character Substring Collision in Runner Resolution (`backend/executor.py`)
In `backend/executor.py`, stack detection logic contained:
```python
is_go_stack = any(k in s for s in tech_stack_lower for k in ("go", "golang"))
```
Because `"go"` is a two-character English substring, any tech stack entry containing `"go"` evaluated `k in s` to `True`:
- `"google-generativeai"` $\to$ matches `"go"`
- `"django"` $\to$ matches `"go"`
- `"mongodb"` $\to$ matches `"go"`
- `"algorithms"` $\to$ matches `"go"`
- `"argon2"` $\to$ matches `"go"`

When `runIntegration()` in `backend/index.html` processed `shared_tech_stack`, the presence of `"HTML"` triggered its heuristic to initialize `dynamicTestCmd = "npm test"`. Then `backend/executor.py` evaluated:
```python
elif is_go_stack and raw_cmd.lower() in ("pytest", "npm test"):
    base_cmd = "go test ./..."
```
Because `is_go_stack` was erroneously `True` due to `"google-generativeai"`, `base_cmd` was hijacked to `"go test ./..."`. The container was a standard Python or Playwright Linux environment without Go installed, resulting in an immediate command not found crash (`sh: 1: go: not found`, exit code 127).

A similar risk existed for Rust:
```python
is_rust_stack = any(k in s for s in tech_stack_lower for k in ("rust", "cargo"))
```
Entries like `"truststore"` would trigger `is_rust_stack = True`.

##### Root Cause 2: Integrator Prompt Lacked Rigorous Integration Test Mandates (`backend/agents/integrator_agent.py`)
While `integrator_agent.py` contained detailed multi-paragraph guidelines for Node.js/Playwright E2E suites, its instruction for Python was merely:
`Generate test_integration.py with pytest assertions testing end-to-end user workflows.`
Given this minimal instruction, LLMs predictably fell back to trivial smoke tests (such as checking if `index.html` contains a `<title>` string or asserting `GET /` returns 200 OK) rather than testing real multi-step API workflows, file uploads, OCR processing, or state persistence. The Correctness Critic rightly flagged these trivial tests with severity 8/10.

#### 2. Architectural Defenses Implemented

##### Layer 1: Strict Regex Word Boundaries & File Pre-Flight Guard (`backend/executor.py`)
Replaced naive substring inclusion with strict word-boundary regular expressions:
```python
has_go_keyword = any(bool(re.search(r'\b(go|golang)\b', s)) for s in tech_stack_lower)
has_rust_keyword = any(bool(re.search(r'\b(rust|cargo)\b', s)) for s in tech_stack_lower)

is_go_stack = has_go_keyword and (has_go_files or has_go_mod or is_go_image)
is_rust_stack = has_rust_keyword and (has_rust_files or has_cargo_toml or is_rust_image)
```
- `"google-generativeai"`, `"django"`, and `"mongodb"` are strictly rejected because `\b(go|golang)\b` does not match within longer words.
- Even if a user's prompt mentions the word "go", `is_go_stack` remains `False` unless `.go` files, a `go.mod` file, or a Go container image actually exist in the codebase.

##### Layer 2: Manifest-Driven Test Command Selection in Frontend Integration (`backend/index.html`)
In `runIntegration()`, replaced the crude `stack.some(s => s.includes('html'))` heuristic with direct codebase file inspection:
- **`package.json` present**: `dynamicTestCmd = "npm test"`
- **Python files / `requirements.txt` present without `package.json`**: `dynamicTestCmd = "pytest"`
- **`.go` files or `go.mod` present**: `dynamicTestCmd = "go test ./..."`
- **`.rs` files or `Cargo.toml` present**: `dynamicTestCmd = "cargo test"`

##### Layer 3: Runtime Docker Image Normalization for Python Backends with Static Frontends (`backend/executor.py`)
In `resolve_docker_image()`:
When an integrated application consists of a Python backend (with `requirements.txt` or `.py` files) and static HTML/CSS files (without a `package.json`), the container image is guaranteed to resolve to `python:3.11-slim`, ensuring `pytest`, `python3`, and standard Linux libraries are present.

##### Layer 4: Hardened Integrator Agent System Prompt (`backend/agents/integrator_agent.py`)
Expanded Rule 4 in `INTEGRATOR_SYSTEM_PROMPT` to mandate production-grade integration test suites:
- **Prohibition of Placeholder Smoke Tests**: Explicitly forbids trivial smoke tests that only verify static HTML headers or root endpoint 200 OK statuses.
- **Mandatory Multi-Step Workflows**: Requires using `fastapi.testclient.TestClient` or `httpx` to execute chained API flows across microservices.
- **Simulated File Uploads**: Requires constructing mock binary files (`io.BytesIO`) to thoroughly exercise upload, OCR extraction, and document processing endpoints.
- **Boundary & Error Assertions**: Requires testing invalid payloads, malformed files, rate-limit responses, and concurrency semaphore ceilings.
- **Session State Persistence**: Mandates testing session retrieval, updates, and cross-request consistency.

#### 3. Verification & Test Coverage (`tests/test_docker_executor.py`)

Three new regression tests were added to `tests/test_docker_executor.py`:
1. `test_google_generativeai_never_triggers_go_test`: Asserts that `tech_stack=["python", "google-generativeai"]` resolves strictly to `pytest` and never `go test ./...`.
2. `test_django_and_mongodb_never_trigger_go_test`: Asserts that `"django"` and `"mongodb"` do not trigger Go stack hijacking.
3. `test_integration_python_backend_with_html_frontend_resolves_pytest`: Asserts that an integrated Python backend with static HTML files resolves to `python:3.11-slim` and `pytest`.

Full test suite execution: **88 passed (100% pass rate, 0 regressions)**.

---

### 6.12 Zero-Dependency In-Memory HTTP Test Client & Supertest Module Resolution Defense

```
+====================================================================================================+
|            ZERO-DEPENDENCY SUPERTEST SHIM & VITEST RESOLUTION DEFENSE ARCHITECTURE                 |
+====================================================================================================+
|                                                                                                    |
|  [ LLM Generates Backend Test Suite: auth.test.js with "import request from 'supertest'" ]         |
|                                       │                                                            |
|                                       ▼                                                            |
|  THE FATAL RESOLUTION TRAP (PREVIOUS):                                                             |
|  - Prompts instructed AI "Do NOT use supertest" in a brief clause -> AI ignored and imported it     |
|  - AI omitted supertest from package.json (or golden_stacks stripped it)                            |
|  - npm install never installed supertest into node_modules                                          |
|  - vitest run executed -> Vite plugin loadAndTransform() failed:                                   |
|    "Error: Failed to load url supertest in /workspace/auth.test.js. Does the file exist?"          |
|  - 0 tests executed -> Critic flagged Sev 8/10 -> Self-correction failed identically across 3 revs|
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 1: Zero-Dependency In-Memory HTTP Client (setupSupertest.js):                              |
|  - Implements MockIncomingMessage (Readable stream) & MockServerResponse (EventEmitter)            |
|  - Directly invokes app(req, res) or app.handle(req, res) in-memory                                |
|  - ZERO network sockets, ZERO port bindings, ZERO 180s container sandbox timeouts                  |
|  - Chained API: request(app).post().send().set().query().expect().then()                            |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 2: Universal Vitest / Vite Module Aliasing (golden_stacks.py):                              |
|  - Automatically injects vitest.config.js (or updates vite.config.ts) with:                       |
|    resolve: { alias: { 'supertest': './setupSupertest.js', 'superagent': './setupSupertest.js' } }  |
|  - Bypasses node_modules resolution completely in Vite's module pipeline                           |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 3: Container Physical Stub Pre-Flight Injection (executor.py):                              |
|  - Right after npm install, creates valid ESM packages:                                            |
|    node_modules/supertest/package.json & index.js (copy of setupSupertest.js)                      |
|    node_modules/superagent/package.json & index.js                                                 |
|  - Guarantees resolution even if tests use CommonJS require('supertest') or bypass config aliases   |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 4: Agent System Prompt Hardening (codegen_agent, design_agent, integrator_agent):           |
|  - Prominent ZERO-TOLERANCE rule prohibiting supertest / superagent                                |
|  - Concrete code templates showing how to test route handlers with mock req/res (vi.fn())          |
|                                                                                                    |
+====================================================================================================+
```

#### 1. Problem & Forensic Root-Cause Analysis

During unit test execution of Node.js backend components (e.g. `nexusprep-backend`), test runs consistently crashed during Vite module loading:
```
added 128 packages, and audited 129 packages in 9s
added 4 packages in 2s

> nexusprep-backend@1.0.0 test
> vitest run

 RUN  v2.1.9 /workspace

 ❯ auth.test.js (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  auth.test.js [ auth.test.js ]
Error: Failed to load url supertest (resolved id: supertest) in /workspace/auth.test.js. Does the file exist?
 ❯ loadAndTransform node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:51969:17

Test Files  1 failed (1)
     Tests  no tests

Critic Reports: Correctness Critic (Gemini) Sev: 8/10:
The test suite failed to execute due to a missing 'supertest' module or bundling/resolution error in Vite, resulting in zero tests running and a test suite failure.
```

##### Root Cause Analysis
1. **The LLM Prior Probability Trap**: LLMs trained on Express/Node.js web frameworks have an overwhelming statistical bias towards writing `import request from 'supertest'` for API route testing.
2. **The Missing Dependency Contradiction**:
   - In `design_agent.py` and `codegen_agent.py`, prompts cautioned "Do NOT use supertest". Consequently, the AI did not list `supertest` in `package.json` dependencies.
   - When `npm install` executed in the Docker sandbox, `supertest` was never installed into `/workspace/node_modules`.
3. **Vite `loadAndTransform` Crash**:
   Vitest runs through Vite's ESM bundler pipeline. When `auth.test.js` imported `supertest`, Vite queried `node_modules` for a matching package. Because `supertest` was not installed, Vite halted test execution immediately with `Error: Failed to load url supertest`.
4. **The Revision Loop Failure**:
   Because the Correctness Critic noted `missing 'supertest' module`, the Codegen Agent attempted in revisions to add `supertest` to `package.json`. However:
   - In `golden_stacks.py`, `BANNED_DEV_DEPS = {'supertest', 'superagent'}` stripped `supertest` from React projects.
   - For non-React projects, even if `supertest` installed, real `supertest` calls `http.createServer(app).listen(0)`, binding TCP ports and hanging container test runners until the 180-second timeout.

#### 2. Architectural Defenses Implemented

##### Layer 1: Zero-Dependency In-Memory HTTP Test Client (`setupSupertest.js`)
Implemented a standalone, zero-dependency in-memory client that emulates the complete `supertest` interface:
- **`MockIncomingMessage`**: Subclasses Node's `stream.Readable`, parsing URL paths, query parameters, headers, and streaming request payloads (JSON objects, strings, buffers) to body-parser middleware.
- **`MockServerResponse`**: Subclasses `events.EventEmitter`, providing Express `ServerResponse` methods (`status`, `sendStatus`, `setHeader`, `set`, `getHeader`, `writeHead`, `write`, `end`, `send`, `json`). Captures response status, parsed JSON bodies, headers, and emits `'finish'`.
- **In-Memory Request Execution**: Directly executes `app(req, res)` or `app.handle(req, res)` in-memory. Zero network sockets are opened, zero ports are bound, eliminating port conflicts and preventing 180s container execution timeouts.
- **Chained Supertest API Support**: Supports `.get()`, `.post()`, `.put()`, `.delete()`, `.patch()`, `.options()`, `.head()`, `.set()`, `.send()`, `.query()`, `.type()`, `.accept()`, `.auth()`, `.expect()`, and `.then()`.

##### Layer 2: Automatic Module Aliasing (`backend/golden_stacks.py`)
In `enforce_golden_dependencies()`:
- Whenever `supertest` or `superagent` is referenced in any source file or when Node tests are present:
  - Injects `setupSupertest.js` into the codebase.
  - Injects or configures `vitest.config.js` (or `vite.config.ts`) with:
    ```javascript
    resolve: {
      alias: {
        'supertest': path.resolve(process.cwd(), './setupSupertest.js'),
        'superagent': path.resolve(process.cwd(), './setupSupertest.js'),
      },
    }
    ```
  - Vite's resolver intercepts all `supertest` import specifiers and resolves them directly to the in-memory client, completely bypassing `node_modules` lookups.

##### Layer 3: Physical Package Stub Injection in Sandbox (`backend/executor.py`)
In `resolve_test_runner_command()`:
Immediately after `npm install --no-audit --no-fund`, executes a shell pre-flight command:
```bash
(mkdir -p node_modules/supertest node_modules/superagent && \
 echo '{"name":"supertest","version":"6.3.4","main":"index.js","type":"module"}' > node_modules/supertest/package.json 2>/dev/null && \
 cp setupSupertest.js node_modules/supertest/index.js 2>/dev/null && \
 echo '{"name":"superagent","version":"8.1.2","main":"index.js","type":"module"}' > node_modules/superagent/package.json 2>/dev/null && \
 cp setupSupertest.js node_modules/superagent/index.js 2>/dev/null || true)
```
Even if a test uses CommonJS `require('supertest')` or Vitest is executed with flags bypassing configuration files, `node_modules/supertest` is physically present as a valid ES module package.

##### Layer 4: Agent System Prompt Hardening
Updated `codegen_agent.py`, `design_agent.py`, and `integrator_agent.py`:
- Prominently bans `supertest` and `superagent`.
- Provides explicit patterns demonstrating how to test Express/Node route controllers directly using mock `req` and `res` objects with `vi.fn()`:
  ```javascript
  import { registerHandler } from './controllers/authController.js';
  test('registers user', async () => {
    const req = { body: { email: 'user@test.com', password: 'secretpassword' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await registerHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
  ```

#### 3. Verification & Test Suite Expansion (`tests/test_docker_executor.py`)

Three new unit tests were added:
1. `test_supertest_stripped_from_node_backend_package_json_and_shim_injected`: Validates that `supertest` is stripped from `package.json` and both `setupSupertest.js` and `vitest.config.js` are injected with aliases.
2. `test_node_executor_injects_supertest_stub_command`: Validates that `resolve_test_runner_command()` includes the physical `node_modules/supertest` stub creation command.
3. `test_setup_supertest_injected_when_auth_test_js_imports_supertest`: Validates that `auth.test.js` importing `supertest` triggers automatic shim injection.

Full repository test suite execution: **91 passed in 4.11s (100% pass rate, 0 regressions)**.

---

### 6.13 Targeted Differential Revision Architecture & AST Surgical Refactoring

```
+====================================================================================================+
|                     TARGETED DIFFERENTIAL REVISION PIPELINE (AST SURGICAL ENGINE)                  |
+====================================================================================================+
|                                                                                                    |
|  Docker Test Failure Output (Pytest / Vitest / Bundler Logs)                                       |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 1: Differential Revision Extractor (backend/agents/revision_extractor.py)                   |
|  - Multi-Regex Failure Analyzer (Tracebacks, Pytest FAILED markers, Vitest FAIL suites)            |
|  - Filename & Root Path Normalizer against Current Codebase Manifest                               |
|  - Broken Files Isolation ([broken_file_1.py, ...])                                                |
|  - Safety Threshold: If 0 files or 100% of files broken -> Graceful Fallback to Full Pipeline     |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 2: Differential Revision Agent (backend/agents/differential_revision_agent.py)              |
|  - Surgical LLM Prompting with RefactorOutput Schema (summary + modified_files)                   |
|  - Broken files provided in full for in-place surgical editing                                     |
|  - Unbroken passing files provided as lightweight semantic signatures (0 token waste)             |
|  - Pre-Merge AST Validation & Syntax Sanitization Gate (Python ast.parse & JSX checks)            |
|                                       │                                                            |
|                                       ▼                                                            |
|  Layer 3: Deterministic Codebase Merging & State Preservation                                      |
|  - Replaces ONLY broken files in the component codebase tree                                       |
|  - Preserves 100% byte-for-byte fidelity of all passing source & test files                        |
|                                                                                                    |
+====================================================================================================+
```

#### 1. Problem & Forensic Root-Cause Analysis

In prior versions of AutoDev, when a component failed automated Docker testing (e.g. 1 out of 8 unit tests failed or a single syntax error occurred in a 6-file codebase), the self-correction loop passed the entire codebase back to the `codegen_agent` for a complete rewrite.

##### Observed Failure Modes:
1. **Token Exhaustion & Truncation**: Re-generating 5 to 10 full application files in a single LLM response frequently exceeded the generation token limit, resulting in truncated files and corrupted closing braces.
2. **Hallucinatory Regressions**: In attempting to fix a single bug in file A, the LLM frequently introduced unintended regressions or rewrote completely functioning logic in files B, C, and D.
3. **Latency Explosion**: Re-generating full codebases required 45-90 seconds per revision round, causing pipeline timeouts and poor user experience.

#### 2. Architectural Implementation

##### Component A: Broken File Extractor (`backend/agents/revision_extractor.py`)
- **`extract_broken_files(execution_logs: str, codebase: GeneratedCodeBase) -> List[str]`**:
  - Employs a multi-pattern regex engine targeting:
    - Pytest failure headers (`FAILED test_auth.py::test_login`)
    - Python traceback frames (`File "main.py", line 148, in ...`)
    - Vitest failure headers (`FAIL auth.test.js > registers user`)
    - Vite bundler resolution errors (`Error: Failed to resolve import "./Navbar" from "src/App.jsx"`)
    - Syntax error locations across Python, JavaScript, and TypeScript.
  - Normalizes relative and container paths against the known `codebase.files` manifest.
  - **Fallback Safeguard**: If no files are identified or if every single file is flagged as broken, returns an empty list, signalling `codegen_agent` to safely fall back to full prompt generation.

##### Component B: Surgical Refactor Agent (`backend/agents/differential_revision_agent.py`)
- **`run_differential_revision(...) -> GeneratedCodeBase`**:
  - Enforces the `RefactorOutput` schema:
    ```python
    class RefactorOutput(BaseModel):
        summary: str
        modified_files: List[GeneratedFile]
    ```
  - **Context Optimization**: Broken files are presented with their full source code. Unbroken passing files are compressed into a compact symbol manifest, maintaining full cross-module context while consuming < 10% of standard token budgets.
  - **AST Pre-Merge Verification**: Every modified file is parsed via `ast.parse` (for Python) or JSX syntax guards before merging. If valid, the modified files are spliced back into the original codebase, guaranteeing that passing files remain byte-identical.

---

### 6.14 Hybrid Verification & Dual-Mode Critic Architecture

```
+====================================================================================================+
|                             HYBRID VERIFICATION & CRITIC ARCHITECTURE                              |
+====================================================================================================+
|                                                                                                    |
|  Master Architect Component Classification                                                         |
|  (Frontend / UI Component)                            (Backend / API / Logic Component)            |
|               │                                                       │                            |
|               ▼                                                       ▼                            |
|  Verification Command:                                 Verification Command:                       |
|  `npm install && npm run build`                        `pytest` or `vitest run`                    |
|  Test Files Omitted (0 Token Waste)                    Comprehensive Unit Test Suites Generated    |
|               │                                                       │                            |
|               ▼                                                       ▼                            |
|  Docker Sandbox: Vite / Next.js Build Check            Docker Sandbox: In-Process Test Runner      |
|               │                                                       │                            |
|               ▼                                                       ▼                            |
|  Dual-Mode Correctness Critic Evaluation               Dual-Mode Correctness Critic Evaluation     |
|  (Mode A: Source-to-Requirements Audit)                (Mode B: Sandbox Test Execution Audit)      |
|                                                                                                    |
+====================================================================================================+
```

#### 1. Theoretical Motivation & The JSDOM Flaw

LLMs writing unit tests for modern interactive web applications (React, Tailwind, Lucide icons, Canvas, complex state) inside containerized headless JSDOM environments encounter recurring failure rates exceeding 70%:
- Missing mock implementations for browser APIs (`ResizeObserver`, `IntersectionObserver`, `window.matchMedia`, WebGL).
- Complex asynchronous component rendering timing out under test runners.
- Divergence between JSDOM emulation and real Chromium browser behavior.

Crucially, **unit test generation consumed up to 50% of the LLM token budget**, starving the actual user-facing application components of depth, style, and production error handling.

#### 2. The Hybrid Verification Paradigm

AutoDev splits verification posture based on component nature:

1. **Frontend / UI Components**:
   - `design_agent` configures `run_tests_command: "npm install --no-audit --no-fund && npm run build"` and strictly omits `*.test.*` files.
   - `codegen_agent` redirects 100% of its token budget to complete, production-grade application code, rich styles, responsive layouts, and robust edge-case handling.
   - Verification succeeds if and only if the application compiles cleanly with zero syntax, import, or bundling errors.
2. **Backend / API / Logic Components**:
   - `design_agent` configures `run_tests_command: "pytest"` (or `npm test`), designing comprehensive unit test suites that mock databases and external services.
   - `codegen_agent` implements robust route handlers and corresponding offline unit tests.
3. **Dual-Mode Correctness Critic (`backend/agents/critics.py`)**:
   - Inspects the codebase: if unit test files are absent, it autonomously switches to **Direct Source Audit Mode**, verifying components against requirements and acceptance criteria.
   - If test files exist, it operates in **Sandbox Test Audit Mode**, evaluating test runner outputs, stack traces, and failure metrics.

---

### 6.15 Python Pipeline Hardening, Transitive Dependency Guard & Defensive Runtime Patterns

#### 1. Transitive Dependency Conflicts & `python-multipart` Auto-Injection

In Python FastAPI sandboxes, two recurring dependency bugs caused unrecoverable test failures:
1. **Motor vs PyMongo Conflict**: Installing `motor==3.3.2` without constraints pulled the latest `pymongo 4.8+`, which removed `_QUERY_OPTIONS`, breaking Motor with `ImportError: cannot import name '_QUERY_OPTIONS' from 'pymongo.common'`.
2. **FastAPI Form Data / Upload Crash**: Whenever an endpoint accepted form parameters or file uploads (`File(...)`, `Form(...)`), FastAPI raised `RuntimeError: Form data requires 'python-multipart' to be installed`. Because LLMs rarely remembered to add `python-multipart` to `requirements.txt`, test suites failed during route registration before any tests could execute.

##### Architectural Resolution (`backend/golden_stacks.py`):
- Added `PYTHON_DEPENDENCY_CONSTRAINTS`:
  ```python
  PYTHON_DEPENDENCY_CONSTRAINTS = {
      "motor": {"pymongo": "<4.8"},
      "fastapi": {"python-multipart": ""},
  }
  ```
- Implemented `enforce_python_dependency_constraints(content: str) -> str` with an idempotent deduplication guard. If `motor` is detected, `pymongo<4.8` is pinned. If `fastapi` is detected, `python-multipart` is automatically added if not already present.

#### 2. System Prompt Guardrails (Rules 12, 13, and 14)

Updated `codegen_agent.py` and `differential_revision_agent.py`:
- **Rule 12 (Transitive Dependency Conflicts)**: Instructs the model that import errors from pip-installed packages indicate transitive conflicts that must be resolved via `requirements.txt` version pins rather than patching application source code.
- **Rule 13 (Defensive Dictionary Access)**: Strictly mandates `dict.pop('key', None)` or `dict.get('key')` instead of bare `.pop('key')` or `dict['key']`. Prevents fatal `KeyError` crashes in endpoints that strip sensitive fields (e.g. passwords) before returning database documents.
- **Rule 14 (Motor / MongoDB Module-Level Mock Pattern)**: Motor client instances initialize at module import time. Using standard `@patch('main.get_database')` fails to intercept the client creation, causing tests to attempt a live connection to `localhost:27017` and timing out after 30s with `ServerSelectionTimeoutError`, which cascades into `RuntimeError: Event loop is closed`. The rule enforces lazy initialization (`get_db()`) and requires mocking the database *prior* to `from main import app`.

---

### 6.16 Dynamic Abort/Retry Control Plane & Live Terminal Telemetry Sync

#### 1. Dynamic Abort -> Retry Pipeline Lifecycle

In `backend/index.html`, the execution control plane was upgraded from a static abort button to a dynamic stateful lifecycle:
- When a user clicks **Abort Development**, the frontend halts active polling, signals the `AbortController` to cancel in-flight HTTP requests, and sets the local state to `ABORTED`.
- The button dynamically transitions into a high-visibility yellow **Retry Development** button.
- Clicking **Retry Development** caches the active product prompt, triggers `resetUI()` to perform a deep reset of all pipeline tracks, restores the prompt, and automatically re-launches development from Phase 1 without requiring page reloads or loss of context.

#### 2. Live Terminal Telemetry Sync & Revision Highlighting

The real-time SSE terminal drawer (`#terminalContent`) was enhanced with bidirectional client-backend telemetry:
- **Connection Health Tracking**: Hooks into `EventSource.onopen` and `EventSource.onerror`, appending explicit status indicators (`[System] Connection lost...` in red, `[System] Connection reestablished...` in blue).
- **Targeted Revision Highlighting**: Backend logs matching differential revision events (e.g., `CodeGen Agent: Engaged targeted differential revision on X broken file(s)`) are parsed and styled with bold fuchsia text and a `🔄` badge.
- **Client-Side Event Mirroring**: Overrides frontend `console.log`, routing client lifecycle events (countdown timer states, phase transitions, abort/retry triggers) directly into the live terminal with color-coded severity tags.
