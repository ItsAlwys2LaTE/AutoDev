## 2026-08-28T19:15:50Z
You are the Worker implementing Milestone M3 (Concurrency Controller & Stage Handover Protocol) and Milestone M4 (Fault Tolerance, Multi-Tier Watchdogs & Crash Recovery).
Your working directory: c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\m3_m4_worker
Original request path: c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\ORIGINAL_REQUEST.md
Scope document: c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\PROJECT.md
Specification document: c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\m3_m4_explorer\spec_m3_m4.md
Target project directory: C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo

Exclusive write ownership:
- C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo\src\autodev_pipeline\concurrency.py
- C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo\src\autodev_pipeline\fault_tolerance.py
- C:\Users\Anupam Sharma\teamwork_projects\autodev_pipeline_algo\src\autodev_pipeline\scheduler.py

Task:
Implement genuine, production-grade, fully functional Python modules for:
1. `src/autodev_pipeline/concurrency.py`:
   - `StageMutex` and `StageLockManager`: Strict single-occupancy per stage (<= 1 occupant), monotonic epoch fencing, lease TTL checking, renewal, and release validation.
   - `StageQueueManager`: Per-stage priority/FIFO queues (Q_DESIGN, Q_CODEGEN, Q_CRITICS, Q_INTEGRATION, Q_DOCUMENTATION) with Kahn critical-path priority and +1000 revision bonus.
   - `StageHandoverProtocol`: Atomic 2-phase handover (Release S_j -> Enqueue/Acquire S_{j+1}) eliminating Coffman hold-and-wait deadlock conditions.
2. `src/autodev_pipeline/fault_tolerance.py`:
   - `MultiTierWatchdog`: Docker execution timeout guard (T_Docker = 45s), LLM exponential backoff with jitter (T_LLM = 60s), and stage lease expiration monitor (T_Lease = 30s).
   - `PoisonPillCircuitBreaker`: Automatic quarantine on >= 3 consecutive failures.
   - `CascadePauseEngine`: Safe stall isolation for transitive downstream dependents while preserving independent execution tracks.
   - `WriteAheadStateStore` (WASS) & `CrashRecoveryEngine`: Append-only JSONL event journal with cryptographic SHA-256 hashes, atomic snapshots, and deterministic replay with in-flight stage rollbacks.
3. `src/autodev_pipeline/scheduler.py`:
   - `PipelineScheduler`: Central orchestration engine integrating DAG dependency tracking, stage queues, stage mutexes, watchdog monitors, and WASS journal logging.

Run Python syntax checks and basic module imports to verify your implementation.
