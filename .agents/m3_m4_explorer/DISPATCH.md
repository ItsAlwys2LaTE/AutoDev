## 2026-08-28T19:13:56Z

**From**: parent (`e24102f9-3737-4f83-abea-af240c0b7734`)
**To**: m3_m4_explorer
**Message**:
You are the Explorer for Milestone M3 (Concurrency Controller & Stage Handover Protocol) and Milestone M4 (Fault Tolerance, Multi-Tier Watchdogs & Crash Recovery).
Your working directory: c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\m3_m4_explorer
Original request path: c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\ORIGINAL_REQUEST.md
Scope document: c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\PROJECT.md
Target project directory: C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo

Task:
Formulate detailed technical specifications, class designs, synchronization mechanisms, and algorithms for:
1. Milestone M3 (`src/autodev_pipeline/concurrency.py` and `src/autodev_pipeline/scheduler.py`):
   - `StageMutex` and `StageLockManager`: single occupancy per stage, lease expiration check, monotonic epoch token generation, renewal, release validation.
   - `StageQueueManager`: per-stage FIFO/priority queues (Q_design, Q_codegen, Q_critics, Q_integration, Q_documentation).
   - Atomic Handover Protocol: 2-phase handover (S_j release -> S_{j+1} acquire or queue), eliminating Coffman hold-and-wait deadlock conditions.
2. Milestone M4 (`src/autodev_pipeline/fault_tolerance.py`):
   - Multi-tier Watchdog: Docker execution timeout guard, LLM backoff/retry, stage lease watchdog.
   - Poison-Pill Circuit Breaker: automatic quarantine on >= 3 consecutive failures.
   - Cascade Pause / Safe Stall: pause direct dependents while independent branches proceed.
   - Atomic Write-Ahead State Store (WASS): append-only event journal and deterministic replay/snapshot recovery.

Write your specification to `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\m3_m4_explorer\spec_m3_m4.md` and complete your handoff report `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\m3_m4_explorer\handoff.md`.
Send a message when finished.
