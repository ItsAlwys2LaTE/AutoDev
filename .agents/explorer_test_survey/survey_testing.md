# AutoDev API Key Balancer: Comprehensive 4-Tier Testing Architecture & Programmatic Verification Suite Specification

**Document ID:** TEST-SURVEY-AUTODEV-BALANCER-001  
**Target Project:** `autodev_api_balancer` (`C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer`)  
**Integration Target:** AutoDev Multi-Agent Backend (`c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend`)  
**Author:** Testing & Verification Survey Explorer (`explorer_test_survey`)  
**Date:** 2026-08-29  
**Status:** COMPLETED / APPROVED TEST ARCHITECTURE SPECIFICATION  

---

## 1. Executive Summary & Verification Objectives

### 1.1 Problem Domain
AutoDev's multi-agent architecture executes complex software development tasks across multiple concurrent stages (Requirements, Architecture Decomposition, System Design, Code Generation, Sandbox Execution, Parallel Multi-Model Critics, Adjudication, Integration, and Documentation). 

Under concurrent multi-component pipelining, LLM API consumption creates severe operational challenges:
1. **Unbalanced API Key Utilization:** Without centralized load balancing, individual API keys quickly exhaust their Requests Per Minute (RPM) and Tokens Per Minute (TPM) quotas, triggering HTTP 429 (`RESOURCE_EXHAUSTED`) cascades.
2. **Improper Key Allocation & Cross-Stage Contamination:** Sensitive or specialized API keys (specifically the 1 dedicated Mistral API key) risk being accidentally consumed by generic pipeline stages rather than being strictly preserved for the Architecture Critic.
3. **Premature or Ineffective Model Downgrades:** When rate limits occur, naive systems immediately downgrade to inferior models (e.g. `gemini-3.5-flash` or `gemini-3.5-flash-lite`) without first attempting to rotate across other healthy keys using the primary, high-capability model (`gemini-3.6-flash`).

### 1.2 Authoritative Mission & Acceptance Criteria (from `ORIGINAL_REQUEST.md`)
To eliminate these failure modes, `autodev_api_balancer` must be verified against four non-negotiable requirements:
- **R1: Key Allocation & Load Balancing:** Pool of 6 Gemini API keys with thread-safe, health-aware rotation distributing load evenly across pipeline stages.
- **R2: Strict Key Reservation:** 1 Mistral API key strictly isolated and exclusively dispensed to the Architecture Critic stage.
- **R3: Robust Fallback Matrix:** Rate-limited or failed requests must strictly rotate across all available Gemini keys on primary model (`gemini-3.6-flash`) before gracefully degrading to secondary model (`gemini-3.5-flash`).
- **R4: Full Implementation & Programmatic Verification:** Fully implemented Python modules with a comprehensive 4-tier test suite and a standalone load-test harness simulating $\ge 50$ concurrent requests with statistical distribution reporting.

---

## 2. System Model & Formal Contracts Under Test

### 2.1 Domain Enums and Data Models

```python
from enum import Enum
from typing import Optional, List, Dict, Set
from pydantic import BaseModel, Field
from datetime import datetime

class StageEnum(str, Enum):
    REQUIREMENTS = "REQUIREMENTS"
    MASTER_ARCHITECT = "MASTER_ARCHITECT"
    DESIGN = "DESIGN"
    CODEGEN = "CODEGEN"
    CRITIC_CORRECTNESS = "CRITIC_CORRECTNESS"
    CRITIC_ARCHITECTURE = "CRITIC_ARCHITECTURE"
    CRITIC_COMPLETENESS = "CRITIC_COMPLETENESS"
    ADJUDICATOR = "ADJUDICATOR"
    INTEGRATOR = "INTEGRATOR"
    DOCUMENTATION = "DOCUMENTATION"

class ModelNameEnum(str, Enum):
    GEMINI_3_6_FLASH = "gemini-3.6-flash"    # Primary Gemini model
    GEMINI_3_5_FLASH = "gemini-3.5-flash"    # Secondary Gemini fallback model
    MISTRAL_SMALL = "mistral-small-latest"   # Mistral model for Architecture Critic

class KeyProvider(str, Enum):
    GEMINI = "gemini"
    MISTRAL = "mistral"

class KeyHealthStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COOLDOWN = "COOLDOWN"
    DISABLED = "DISABLED"

class KeyUsageMetrics(BaseModel):
    key_id: str
    provider: KeyProvider
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    rate_limit_hits: int = 0
    in_flight_requests: int = 0
    last_used_at: Optional[float] = None
    rate_limited_until: float = 0.0

class LeaseToken(BaseModel):
    lease_id: str
    key_id: str
    api_key_value: str
    provider: KeyProvider
    model_name: str
    stage: StageEnum
    acquired_at: float
    is_released: bool = False
```

### 2.2 Formal State Transition & Fallback Invariants

#### Invariant 1: Strict Stage Isolation for Mistral Key ($\mathcal{I}_{\text{Mistral-Isolation}}$)
$$\forall \text{req}, \quad \text{LeaseGranted}(\text{req}, \text{provider}=\text{MISTRAL}) \implies \text{req}.\text{stage} = \text{StageEnum.CRITIC\_ARCHITECTURE}$$
If $\text{req}.\text{stage} \ne \text{CRITIC\_ARCHITECTURE}$, the balancer MUST raise `StrictStageIsolationViolation` and dispense 0 Mistral tokens.

#### Invariant 2: Primary-Before-Secondary Fallback Priority ($\mathcal{I}_{\text{Fallback-Order}}$)
Let $\mathcal{K}_{\text{Gemini}} = \{k_1, k_2, k_3, k_4, k_5, k_6\}$ be the pool of 6 Gemini keys.  
For any pipeline request $R$ targeting Gemini:
$$\text{AttemptModel}(R, \text{GEMINI\_3\_5\_FLASH}) \implies \forall k \in \mathcal{K}_{\text{Gemini}}, \quad \text{State}(k, \text{GEMINI\_3\_6\_FLASH}) = \text{COOLDOWN} \lor \text{FAILED}$$
The balancer MUST exhaust all 6 keys on `gemini-3.6-flash` before issuing any lease for `gemini-3.5-flash`.

#### Invariant 3: Thread-Safe In-Flight Balance ($\mathcal{I}_{\text{InFlight-Accounting}}$)
$$\forall k \in \mathcal{K}, \quad \text{in\_flight}(k) = \sum_{\tau \in \text{ActiveLeases}} \mathbb{I}(\tau.\text{key\_id} = k.\text{id} \land \neg \tau.\text{is\_released}) \ge 0$$
Releases must be strictly idempotent and decrement in-flight counts atomically.

---

## 3. Comprehensive 4-Tier Testing Architecture

```
+-----------------------------------------------------------------------------------------+
|                                4-TIER TEST ARCHITECTURE                                 |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  | Tier 1: Feature Coverage Unit & Integration Suite                                 |  |
|  | - Key Pool Initialization (6 Gemini + 1 Mistral)                                  |  |
|  | - Thread-safe Lease Acquisition & Context Manager Protocol                        |  |
|  | - Load Balancing Algorithms (Weighted Round Robin, Least-Connections)             |  |
|  | - Stage-Aware Dispatching & Environment Discovery                                 |  |
|  | - Error & 429 Rate-Limit Status Interception                                      |  |
|  +-----------------------------------------------------------------------------------+  |
|                                           |                                             |
|  +-----------------------------------------------------------------------------------+  |
|  | Tier 2: Boundary & Corner Cases Suite                                             |  |
|  | - Pool Exhaustion on Primary Model -> Degrade to Secondary                        |  |
|  | - Dual Model Pool Total Exhaustion -> Typed Balancer Exhaustion Exception         |  |
|  | - Invalid Stage Token & Stage Injection Attack Prevention                         |  |
|  | - Rapid Burst Stampede (100+ threads within 10ms)                                 |  |
|  | - Dynamic Cooldown Expiration & Health Recovery                                   |  |
|  | - Exception Safety: Guaranteed Lease Release on Client Failure                    |  |
|  +-----------------------------------------------------------------------------------+  |
|                                           |                                             |
|  +-----------------------------------------------------------------------------------+  |
|  | Tier 3: Cross-Feature Combination & Cascade Tests                                 |  |
|  | - Multi-Stage Concurrent Pipeline Simulation (Design + Code + Critics + Int)       |  |
|  | - Parallel LangGraph Critics Contention (2x Gemini + 1x Mistral)                  |  |
|  | - Dynamic Mid-Flight Key Revocation & Cascade Failover                            |  |
|  | - Cooldown Expiry During Active Traffic Surge                                     |  |
|  | - Multi-Threaded Simultaneous 429 Collision Resolution                            |  |
|  +-----------------------------------------------------------------------------------+  |
|                                           |                                             |
|  +-----------------------------------------------------------------------------------+  |
|  | Tier 4: Real-World Load Test Harness (>= 50 Concurrent Requests)                  |  |
|  | - 50+ Concurrent Worker Threads Simulating Full AutoDev SDLC Workload              |  |
|  | - Configurable Mock LLM Backend with Latency Jitter & Injectable Rate Limits      |  |
|  | - Statistical Distribution Verification (Chi-Square p >= 0.05, CV <= 0.15)        |  |
|  | - Primary Key Exhaustion Rotation Assertion (Keys 1..6 on 3.6 -> 3.5 fallback)   |  |
|  | - Strict Isolation Assertion for Mistral Key (0 non-critic leaks across 1000 ops) |  |
|  +-----------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Tier-by-Tier Specification & Detailed Test Catalog

### 4.1 Tier 1: Feature Coverage Unit & Integration Tests

The Tier 1 suite validates foundational functional requirements, contract correctness, and object lifecycles in isolation.

| Test ID | Module / Focus | Test Objective | Inputs & Setup | Expected Output & Assertions |
|---|---|---|---|---|
| `TEST-T1-01` | Pool Config | Validate discovery and initialization of 6 Gemini keys + 1 Mistral key from env vars. | Env with `GEMINI_API_KEY_1..6` and `MISTRAL_API_KEY`. | Pool initializes with `len(gemini_keys) == 6`, `len(mistral_keys) == 1`, all in `ACTIVE` state. |
| `TEST-T1-02` | Pool Config | Validate backward-compatibility discovery from legacy AutoDev role-based env vars. | Env with `GEMINI_API_KEY_DESIGN`, `GEMINI_API_KEY_CODEGEN`, etc. | Legacy keys mapped to 6 distinct pool slots without key collisions. |
| `TEST-T1-03` | Acquisition | Acquire and release a Gemini key lease via context manager. | Call `with balancer.acquire(stage=StageEnum.CODEGEN) as lease:`. | Valid `LeaseToken` returned; in-flight count increments during block and decrements to 0 on exit. |
| `TEST-T1-04` | Acquisition | Acquire Mistral key for Architecture Critic. | Call `balancer.acquire(stage=StageEnum.CRITIC_ARCHITECTURE)`. | Valid Mistral `LeaseToken` returned with `model_name="mistral-small-latest"`. |
| `TEST-T1-05` | Rotation | Validate uniform Round-Robin rotation across 6 Gemini keys for 12 sequential requests. | 12 sequential calls for `StageEnum.DESIGN`. | Exactly 2 requests allocated per key ($k_1 \to k_2 \to \dots \to k_6 \to k_1 \to \dots \to k_6$). |
| `TEST-T1-06` | Least-Connections | Validate Least-Connections balancing when key 1 holds an active long-running lease. | Key 1 in-flight=1, Keys 2..6 in-flight=0. | Next request routed to one of Keys 2..6, bypassing Key 1. |
| `TEST-T1-07` | Health Tracking | Report rate limit (429) on a key and verify transition to `COOLDOWN`. | Report 429 on `k_2` with `cooldown_seconds=30`. | `k_2.status == KeyHealthStatus.COOLDOWN`, `rate_limited_until > time.time()`. |
| `TEST-T1-08` | Health Tracking | Verify that a key in `COOLDOWN` is bypassed during standard rotation. | `k_2` in cooldown; issue 5 requests. | Requests distributed among $\{k_1, k_3, k_4, k_5, k_6\}$; $k_2$ receives 0 requests. |
| `TEST-T1-09` | Model Fallback | Execute request with automatic fallback when primary key fails. | Mock client: $k_1$ fails with 429; $k_2$ succeeds on `gemini-3.6-flash`. | Balancer automatically retries on $k_2$ with `gemini-3.6-flash`, returning successful result. |
| `TEST-T1-10` | Telemetry Metrics | Validate metrics tracking (total_requests, errors, latency, in-flight). | Execute 20 mixed success/failure requests. | Balancer metrics reflect exact request counts, error counts, and zero lingering in-flight leases. |

---

### 4.2 Tier 2: Boundary & Corner Cases Suite

The Tier 2 suite stress-tests edge conditions, error boundaries, race conditions, and hostile input scenarios.

| Test ID | Boundary Category | Scenario & Setup | Stress / Edge Condition | Expected Invariant & Assertions |
|---|---|---|---|---|
| `TEST-T2-01` | Primary Pool Depletion | 5 Gemini keys in `COOLDOWN`; 1 Gemini key active. | 10 concurrent requests arrive. | All 10 requests route through the 1 active key without crash or deadlock; queue serialization maintained. |
| `TEST-T2-02` | All 6 Keys Depleted (3.6) | All 6 Gemini keys encounter 429 on `gemini-3.6-flash`. | Issue request for `StageEnum.CODEGEN`. | Balancer switches to `gemini-3.5-flash` and successfully executes on available key; logs `DEGRADED_MODEL_FALLBACK`. |
| `TEST-T2-03` | Total Pool Exhaustion | All 6 Gemini keys exhausted on BOTH `gemini-3.6-flash` AND `gemini-3.5-flash`. | Issue request for `StageEnum.DESIGN`. | Balancer raises `AllKeysExhaustedException` with structured cooldown time-to-recovery metadata. |
| `TEST-T2-04` | Security Isolation | Attempt to acquire Mistral key for `StageEnum.CODEGEN`. | Explicitly request Mistral key for non-critic stage. | Balancer raises `StrictStageIsolationViolation`; 0 leases granted; Mistral metrics unchanged. |
| `TEST-T2-05` | Security Isolation | Attempt to acquire Mistral key for `StageEnum.CRITIC_CORRECTNESS`. | Non-architecture critic requests Mistral. | Balancer raises `StrictStageIsolationViolation`; routes to Gemini pool. |
| `TEST-T2-06` | Security Isolation | Attempt to acquire Mistral key with arbitrary string / malformed stage. | Pass `stage="MALICIOUS_STAGE"`. | Balancer rejects with `InvalidStageException` / validation error. |
| `TEST-T2-07` | Rapid Burst Stampede | 100 threads concurrently request leases in $<10\text{ms}$. | High concurrency thundering herd. | Zero race conditions; exact lease count matches; all threads acquire and release cleanly. |
| `TEST-T2-08` | Cooldown Expiration | Key placed in 2-second cooldown; virtual/real time advances by 2.1 seconds. | Call balancer after cooldown expires. | Key status transitions from `COOLDOWN` $\to$ `ACTIVE`; key re-enters active rotation pool. |
| `TEST-T2-09` | Exception Safety | Consumer raises unhandled `ZeroDivisionError` inside `with balancer.acquire():` block. | Unhandled exception within context block. | Exception propagates, but `__exit__` guarantees lease release; in-flight count decrements to 0. |
| `TEST-T2-10` | Idempotent Double Release | Client calls `balancer.release(lease)` twice on the same token. | Manual double-release invocation. | Second release is a safe no-op; in-flight counter does not drop below 0 ($\ge 0$ invariant). |
| `TEST-T2-11` | Network Timeout Trap | LLM call hangs for $T > 30\text{s}$ or raises `TimeoutError`. | Simulated socket drop / timeout. | Balancer catches timeout, marks key with transient failure, attempts next key on primary model. |
| `TEST-T2-12` | Missing Configuration | Environment initialized with 0 Gemini keys and 0 Mistral keys. | Empty environment / missing `.env`. | Balancer raises `ConfigurationError` during initialization with clear remediation instructions. |

---

### 4.3 Tier 3: Cross-Feature Combination & Cascade Tests

Tier 3 validates complex multi-agent workflows, concurrent stage cross-talk, dynamic failure propagation, and LangGraph multi-critic fan-out.

| Test ID | Workflow / Interaction | Setup & Execution | Verification Logic |
|---|---|---|---|
| `TEST-T3-01` | Full Pipeline Concurrent SDLC | 5 simultaneous component pipelines running: `Requirements` $\to$ `Design` $\to$ `CodeGen` $\to$ `Critics` $\to$ `Integration` $\to$ `DocGen`. | Verifies simultaneous key acquisition across different stages without deadlocks; all 6 Gemini keys engaged evenly. |
| `TEST-T3-02` | Parallel LangGraph Critics Fan-Out | 10 components simultaneously trigger arbitration (each running Correctness, Architecture, Completeness in parallel = 30 concurrent critic calls). | Verifies Correctness & Completeness acquire Gemini keys; Architecture acquires Mistral key; zero cross-contamination. |
| `TEST-T3-03` | Cascade Fallback Under Dynamic Drop | 30 concurrent requests executing. Keys 1, 2, 3 dynamically injected with 429 errors mid-run. | Balancer dynamically reroutes in-flight requests to Keys 4, 5, 6 on `gemini-3.6-flash` without request loss. |
| `TEST-T3-04` | Rolling Recovery During Load | Heavy background load while rate-limited keys progressively expire their cooldowns. | Verifies recovered keys immediately re-enter rotation and absorb new load, preventing secondary saturation. |
| `TEST-T3-05` | Simultaneous 429 Collision | 6 threads hit 429 on all 6 distinct Gemini keys at the exact same millisecond. | Balancer atomically coordinates failover so all 6 threads cleanly downgrade to `gemini-3.5-flash` in parallel. |

---

### 4.4 Tier 4: Real-World Load Test Harness Specification

The Tier 4 suite is the centerpiece programmatic load harness simulating $\ge 50$ concurrent multi-agent requests with statistical assertions.

```
+------------------------------------------------------------------------------------------------+
|                             TIER 4 REAL-WORLD LOAD TEST HARNESS                                |
+------------------------------------------------------------------------------------------------+
|                                                                                                |
|   +----------------------------------------------------------------------------------------+   |
|   |  Load Generator: 50+ Concurrent Worker Threads (simulating AutoDev Multi-Agent SDLC)   |   |
|   |  - 15x Design Workers                                                                  |   |
|   |  - 15x CodeGen Workers                                                                 |   |
|   |  - 10x Architecture Critic Workers (Mistral Target)                                    |   |
|   |  - 10x Correctness / Completeness Critic Workers (Gemini Target)                       |   |
|   +----------------------------------------------------------------------------------------+   |
|                                              |                                                 |
|                                              v                                                 |
|   +----------------------------------------------------------------------------------------+   |
|   |  API Key Balancer & Fallback Matrix Engine (`autodev_api_balancer`)                    |   |
|   |  - Thread-Safe Health-Aware Key Allocator                                              |   |
|   |  - Strict Mistral Stage Enforcer                                                       |   |
|   |  - Multi-Key Primary -> Secondary Model Fallback Resolver                              |   |
|   +----------------------------------------------------------------------------------------+   |
|                                              |                                                 |
|                                              v                                                 |
|   +----------------------------------------------------------------------------------------+   |
|   |  High-Fidelity Mock LLM Engine (`MockLLMBackend`)                                      |   |
|   |  - Configurable Latency: Normal Distribution ($\mu = 100\text{ms}, \sigma = 20\text{ms}$) |   |
|   |  - Injectable 429 Rate Limits per Key / RPM Thresholds                                 |   |
|   |  - Strict Key-Value Verification & Audit Logging                                       |   |
|   +----------------------------------------------------------------------------------------+   |
|                                              |                                                 |
|                                              v                                                 |
|   +----------------------------------------------------------------------------------------+   |
|   |  Statistical Analyzer & Verification Engine                                            |   |
|   |  1. Chi-Square ($\chi^2$) Goodness-of-Fit Test ($p \ge 0.05$)                          |   |
|   |  2. Max/Min Ratio Check ($\le 1.30$) & Coefficient of Variation ($CV \le 0.15$)         |   |
|   |  3. Primary Key Rotation Trace Assertion (Keys 1..6 on 3.6 before 3.5 downgrade)       |   |
|   |  4. Strict Mistral Isolation Assertion (100% rejection on non-architecture stages)     |   |
|   +----------------------------------------------------------------------------------------+   |
+------------------------------------------------------------------------------------------------+
```

---

## 5. Statistical Verification & Distribution Metrics

To programmatically prove that load is distributed evenly across all 6 Gemini keys without bias or hot-spotting, the load test calculates four rigorous statistical metrics:

### 5.1 Chi-Square ($\chi^2$) Goodness-of-Fit Test
Under uniform load balancing across $K = 6$ Gemini keys with $N_{\text{total}}$ total requests, the expected count for each key is:
$$E_i = \frac{N_{\text{total}}}{6}, \quad \forall i \in \{1, \dots, 6\}$$
The test statistic is computed as:
$$\chi^2 = \sum_{i=1}^{6} \frac{(O_i - E_i)^2}{E_i}$$
Where $O_i$ is the observed request count for Key $i$.
- **Degrees of Freedom:** $df = K - 1 = 5$.
- **Critical Threshold ($\alpha = 0.05$):** $\chi^2_{0.05, 5} = 11.070$.
- **Pass Invariant:** $\chi^2 \le 11.070$ (corresponding to $p\text{-value} \ge 0.05$).

### 5.2 Coefficient of Variation ($CV$)
The Coefficient of Variation measures relative dispersion:
$$CV = \frac{\sigma}{\mu} = \frac{\sqrt{\frac{1}{6} \sum_{i=1}^{6} (O_i - \mu)^2}}{\mu}$$
Where $\mu = \frac{N_{\text{total}}}{6}$.
- **Pass Invariant:** $CV \le 0.15$ (standard deviation must be within 15% of the mean).

### 5.3 Max-to-Min Allocation Ratio ($R_{\text{max/min}}$)
$$R_{\text{max/min}} = \frac{\max(O_1, \dots, O_6)}{\min(O_1, \dots, O_6)}$$
- **Pass Invariant:** $R_{\text{max/min}} \le 1.30$ (the most utilized key must receive no more than 30% more requests than the least utilized key under unconstrained load).

### 5.4 Zero-Starvation Guarantee
$$\forall i \in \{1, \dots, 6\}, \quad O_i \ge 0.70 \times E_i$$
No single healthy Gemini key may be starved of traffic.

---

## 6. Real-World Load Test Harness Implementation Blueprint

Below is the complete architectural design and executable code structure for the Tier 4 programmatic load test harness (`load_test_harness.py`).

```python
"""
Tier 4 Real-World Load Test Harness for AutoDev API Key Balancer
Simulates >= 50 concurrent pipeline requests across all SDLC stages with mock LLM backends,
statistical distribution evaluation, fallback order verification, and strict isolation assertions.
"""

import time
import random
import threading
import concurrent.futures
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
import scipy.stats as stats  # Or pure-python fallback

# Import Balancer models and engine
from autodev_api_balancer.models import StageEnum, ModelNameEnum, KeyProvider
from autodev_api_balancer.balancer import APIKeyBalancer, StrictStageIsolationViolation, AllKeysExhaustedException

@dataclass
class MockLLMResponse:
    content: str
    key_used: str
    model_used: str
    latency_ms: float
    status_code: int = 200

class MockLLMBackend:
    """
    High-fidelity simulated API backend with configurable latency,
    injectable rate limits (429), server errors (503), and audit logging.
    """
    def __init__(self, base_latency_ms: float = 100.0, jitter_ms: float = 20.0):
        self.base_latency_ms = base_latency_ms
        self.jitter_ms = jitter_ms
        self.rate_limited_keys: Dict[str, float] = {}  # key_id -> expiry timestamp
        self.call_audit_log: List[Dict] = []
        self.lock = threading.Lock()

    def set_rate_limit(self, key_id: str, duration_sec: float):
        with self.lock:
            self.rate_limited_keys[key_id] = time.time() + duration_sec

    def clear_rate_limits(self):
        with self.lock:
            self.rate_limited_keys.clear()

    def execute_call(self, lease_token, prompt: str) -> MockLLMResponse:
        # Simulate realistic network latency with normal jitter
        latency = max(10.0, random.gauss(self.base_latency_ms, self.jitter_ms)) / 1000.0
        time.sleep(latency)
        
        now = time.time()
        with self.lock:
            is_limited = self.rate_limited_keys.get(lease_token.key_id, 0.0) > now
            self.call_audit_log.append({
                "timestamp": now,
                "key_id": lease_token.key_id,
                "provider": lease_token.provider,
                "model_name": lease_token.model_name,
                "stage": lease_token.stage,
                "status_code": 429 if is_limited else 200,
                "latency_ms": latency * 1000.0
            })

        if is_limited:
            raise Exception(f"HTTP 429: Rate limit exceeded for key {lease_token.key_id}")

        return MockLLMResponse(
            content=f"Simulated output for {lease_token.stage}",
            key_used=lease_token.key_id,
            model_used=lease_token.model_name,
            latency_ms=latency * 1000.0,
            status_code=200
        )

class LoadTestHarness:
    """
    Orchestrates high-concurrency SDLC workloads, collects execution logs,
    and runs formal statistical distribution assertions.
    """
    def __init__(self, balancer: APIKeyBalancer, mock_backend: MockLLMBackend):
        self.balancer = balancer
        self.backend = mock_backend

    def run_concurrent_workload(self, num_requests: int = 60, concurrency: int = 50) -> Dict:
        """
        Simulates >= 50 concurrent pipeline requests distributed across
        Design, CodeGen, Architecture Critic, and Correctness Critic.
        """
        stages_pool = [
            StageEnum.DESIGN,
            StageEnum.CODEGEN,
            StageEnum.CRITIC_CORRECTNESS,
            StageEnum.CRITIC_ARCHITECTURE,
            StageEnum.CRITIC_COMPLETENESS,
            StageEnum.INTEGRATOR,
        ]
        
        results = []
        errors = []
        start_time = time.time()

        def worker_task(req_id: int):
            stage = stages_pool[req_id % len(stages_pool)]
            try:
                # Wrap with balancer lease context manager
                with self.balancer.acquire(stage=stage) as lease:
                    response = self.backend.execute_call(lease, f"Prompt {req_id}")
                    return {
                        "req_id": req_id,
                        "stage": stage,
                        "key_id": lease.key_id,
                        "provider": lease.provider,
                        "model": lease.model_name,
                        "success": True
                    }
            except Exception as e:
                return {
                    "req_id": req_id,
                    "stage": stage,
                    "error": str(e),
                    "success": False
                }

        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(worker_task, i) for i in range(num_requests)]
            for f in concurrent.futures.as_completed(futures):
                res = f.result()
                if res["success"]:
                    results.append(res)
                else:
                    errors.append(res)

        total_time = time.time() - start_time
        return {
            "num_requests": num_requests,
            "concurrency": concurrency,
            "total_time_sec": total_time,
            "throughput_rps": num_requests / total_time,
            "successful_requests": len(results),
            "failed_requests": len(errors),
            "results": results,
            "errors": errors
        }

    def compute_distribution_report(self, results: List[Dict]) -> Dict:
        """
        Calculates Chi-Square, CV, and min-max distribution metrics for Gemini keys.
        """
        gemini_counts: Dict[str, int] = {f"gemini_key_{i}": 0 for i in range(1, 7)}
        mistral_counts: Dict[str, int] = {"mistral_key_1": 0}

        for r in results:
            k = r.get("key_id")
            if k in gemini_counts:
                gemini_counts[k] += 1
            elif k in mistral_counts:
                mistral_counts[k] += 1

        total_gemini = sum(gemini_counts.values())
        observed = list(gemini_counts.values())
        expected = [total_gemini / 6.0] * 6

        # Chi-Square Calculation
        chi_square_stat = sum((o - e) ** 2 / e for o, e in zip(observed, expected)) if total_gemini > 0 else 0.0
        
        # Standard deviation and CV
        mean_val = total_gemini / 6.0 if total_gemini > 0 else 1.0
        variance = sum((o - mean_val) ** 2 for o in observed) / 6.0
        std_dev = variance ** 0.5
        cv = std_dev / mean_val if mean_val > 0 else 0.0

        min_val = min(observed) if observed else 0
        max_val = max(observed) if observed else 0
        max_min_ratio = (max_val / min_val) if min_val > 0 else float('inf')

        return {
            "total_gemini_requests": total_gemini,
            "gemini_distribution": gemini_counts,
            "mistral_distribution": mistral_counts,
            "chi_square_stat": chi_square_stat,
            "chi_square_critical_5pct": 11.070,
            "chi_square_passed": chi_square_stat <= 11.070,
            "mean_per_key": mean_val,
            "std_dev": std_dev,
            "coefficient_of_variation": cv,
            "cv_passed": cv <= 0.15,
            "min_count": min_val,
            "max_count": max_val,
            "max_min_ratio": max_min_ratio,
            "max_min_ratio_passed": max_min_ratio <= 1.30
        }
```

---

## 7. Dedicated Verification Test Specifications

### 7.1 Verification Test 1: Primary Key Rotation Before Downgrade to `gemini-3.5-flash`

**Requirement Mapping:** ORIGINAL_REQUEST §R3, Acceptance Criteria Line 67  
**Test ID:** `TEST-T4-FALLBACK-ROTATION`

```python
def test_primary_key_rotation_before_downgrade(balancer, mock_backend):
    """
    Verifies that when rate limits occur, the balancer strictly attempts
    Key 1..6 on primary model (gemini-3.6-flash) before downgrading to gemini-3.5-flash.
    """
    attempt_history = []

    # Configure mock backend to fail primary model on first 5 keys, succeed on 6th
    def custom_execute(lease):
        attempt_history.append((lease.key_id, lease.model_name))
        if lease.model_name == ModelNameEnum.GEMINI_3_6_FLASH:
            if lease.key_id in ["gemini_key_1", "gemini_key_2", "gemini_key_3", "gemini_key_4", "gemini_key_5"]:
                raise Exception("429 Rate Limit on Primary Model")
            elif lease.key_id == "gemini_key_6":
                return "SUCCESS_ON_KEY_6"
        elif lease.model_name == ModelNameEnum.GEMINI_3_5_FLASH:
            return "SUCCESS_ON_SECONDARY"
        raise Exception("Unexpected call")

    # Execute request
    result = balancer.execute_with_fallback(
        stage=StageEnum.CODEGEN,
        caller=custom_execute
    )

    assert result == "SUCCESS_ON_KEY_6"
    # Assert all first 5 attempts were on primary model gemini-3.6-flash
    for key_id, model in attempt_history[:5]:
        assert model == ModelNameEnum.GEMINI_3_6_FLASH, f"Premature model downgrade on {key_id}"
    
    # Now simulate ALL 6 keys failing on primary model
    attempt_history.clear()
    def custom_execute_all_fail(lease):
        attempt_history.append((lease.key_id, lease.model_name))
        if lease.model_name == ModelNameEnum.GEMINI_3_6_FLASH:
            raise Exception("429 Rate Limit on Primary")
        elif lease.model_name == ModelNameEnum.GEMINI_3_5_FLASH:
            return "SUCCESS_ON_SECONDARY_MODEL"

    result2 = balancer.execute_with_fallback(
        stage=StageEnum.DESIGN,
        caller=custom_execute_all_fail
    )

    assert result2 == "SUCCESS_ON_SECONDARY_MODEL"
    # Verify that exactly 6 primary attempts occurred before the first secondary attempt
    primary_attempts = [m for k, m in attempt_history if m == ModelNameEnum.GEMINI_3_6_FLASH]
    secondary_attempts = [m for k, m in attempt_history if m == ModelNameEnum.GEMINI_3_5_FLASH]
    assert len(primary_attempts) == 6, f"Expected 6 primary attempts, got {len(primary_attempts)}"
    assert len(secondary_attempts) >= 1
    assert attempt_history[6][1] == ModelNameEnum.GEMINI_3_5_FLASH
```

### 7.2 Verification Test 2: Strict Isolation Assertion for Mistral Key

**Requirement Mapping:** ORIGINAL_REQUEST §R2, Acceptance Criteria Line 68  
**Test ID:** `TEST-T4-MISTRAL-STRICT-ISOLATION`

```python
import pytest

@pytest.mark.parametrize("invalid_stage", [
    StageEnum.REQUIREMENTS,
    StageEnum.MASTER_ARCHITECT,
    StageEnum.DESIGN,
    StageEnum.CODEGEN,
    StageEnum.CRITIC_CORRECTNESS,
    StageEnum.CRITIC_COMPLETENESS,
    StageEnum.ADJUDICATOR,
    StageEnum.INTEGRATOR,
    StageEnum.DOCUMENTATION,
])
def test_mistral_key_strict_isolation_across_all_non_architecture_stages(balancer, invalid_stage):
    """
    Asserts that the Mistral API key cannot be dispensed to ANY non-Architecture Critic
    pipeline component under any circumstances.
    """
    # 1. Direct explicit request for Mistral provider on invalid stage MUST raise StrictStageIsolationViolation
    with pytest.raises(StrictStageIsolationViolation):
        balancer.acquire_key(stage=invalid_stage, preferred_provider=KeyProvider.MISTRAL)

    # 2. General lease acquisition for non-architecture stage MUST NEVER return Mistral key
    lease = balancer.acquire_key(stage=invalid_stage)
    try:
        assert lease.provider == KeyProvider.GEMINI, f"Mistral key leaked to stage {invalid_stage}"
        assert lease.api_key_value != balancer.mistral_key_value, "Mistral raw secret leaked in Gemini lease"
    finally:
        balancer.release_key(lease)

def test_mistral_key_concurrency_stress_isolation(balancer):
    """
    Runs 1000 rapid concurrent lease requests across randomized stages.
    Asserts with 100% certainty that 0 Mistral tokens are dispensed to non-architecture callers.
    """
    leak_count = 0
    lock = threading.Lock()

    def worker(i: int):
        nonlocal leak_count
        # 80% non-architecture stages, 20% architecture critic
        if i % 5 == 0:
            stage = StageEnum.CRITIC_ARCHITECTURE
        else:
            stage = random.choice([
                StageEnum.DESIGN, StageEnum.CODEGEN, 
                StageEnum.CRITIC_CORRECTNESS, StageEnum.INTEGRATOR
            ])
        
        lease = balancer.acquire_key(stage=stage)
        try:
            if stage != StageEnum.CRITIC_ARCHITECTURE and lease.provider == KeyProvider.MISTRAL:
                with lock:
                    leak_count += 1
        finally:
            balancer.release_key(lease)

    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        list(executor.map(worker, range(1000)))

    assert leak_count == 0, f"SECURITY VIOLATION: Mistral key was dispensed {leak_count} times to unauthorized stages!"
```

---

## 8. Target Code Layout & Test File Structure

### 8.1 Project Destination: `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer`

```text
autodev_api_balancer/
├── pyproject.toml                         # Project metadata and dependencies (pydantic, pytest, scipy)
├── pytest.ini                            # Pytest configuration (markers, test paths, timeout)
├── README.md                             # Architecture and usage documentation
├── run_balancer_tests.py                 # Standalone master CLI test runner with ANSI reporting
├── src/
│   └── autodev_api_balancer/
│       ├── __init__.py                   # Package exports
│       ├── models.py                     # Enums, Pydantic schemas, LeaseToken, KeyUsageMetrics
│       ├── key_pool.py                   # In-memory thread-safe key pool & health tracking
│       ├── strategies.py                 # RoundRobin, WeightedRoundRobin, LeastConnections
│       ├── isolation_guard.py            # Strict Mistral stage validation & security enforcer
│       ├── fallback_matrix.py            # Multi-tier model & key fallback state machine
│       └── balancer.py                   # Unified APIKeyBalancer entry point & context manager
└── tests/
    ├── __init__.py
    ├── conftest.py                       # Pytest fixtures (mock keys, virtual clock, mock backends)
    ├── test_tier1_feature_coverage.py     # Tier 1 unit & integration tests (12 tests)
    ├── test_tier2_boundary_cases.py       # Tier 2 boundary & stress tests (12 tests)
    ├── test_tier3_cross_feature.py        # Tier 3 combinatorial & cascade tests (8 tests)
    ├── test_tier4_load_harness.py         # Tier 4 real-world 50+ concurrent load test suite
    ├── load_test_harness.py              # Executable standalone load test script with distribution report
    └── test_verification_assertions.py   # Dedicated acceptance criteria verification suite
```

### 8.2 Integration Destination: `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend`

```text
backend/
├── autodev_api_balancer/                 # Direct link / embedded package
│   ├── __init__.py
│   ├── models.py
│   ├── key_pool.py
│   ├── fallback_matrix.py
│   └── balancer.py
├── agents/
│   ├── codegen_agent.py                  # Integrated with APIKeyBalancer
│   ├── critics.py                        # Integrated with APIKeyBalancer (Correctness/Completeness: Gemini, Architecture: Mistral)
│   ├── design_agent.py                   # Integrated with APIKeyBalancer
│   ├── documentation_agent.py            # Integrated with APIKeyBalancer
│   ├── integrator_agent.py               # Integrated with APIKeyBalancer
│   ├── master_architect.py               # Integrated with APIKeyBalancer
│   └── requirements_agent.py             # Integrated with APIKeyBalancer
└── orchestrator.py                       # Adjudicator & LangGraph critic graph using APIKeyBalancer
```

---

## 9. Test Runner Commands & Automation Scripting

### 9.1 Pytest Execution Commands
```bash
# 1. Execute full test suite with verbose output
pytest -v

# 2. Execute Tier 1 Feature Coverage suite
pytest tests/test_tier1_feature_coverage.py -v

# 3. Execute Tier 2 Boundary & Corner Cases suite
pytest tests/test_tier2_boundary_cases.py -v

# 4. Execute Tier 3 Cross-Feature Combination suite
pytest tests/test_tier3_cross_feature.py -v

# 5. Execute Tier 4 Real-World 50+ Concurrency Load Test Suite
pytest tests/test_tier4_load_harness.py -v -s

# 6. Execute Dedicated Verification Assertions (Acceptance Criteria)
pytest tests/test_verification_assertions.py -v
```

### 9.2 Standalone Executable Load Test Runner (`run_balancer_tests.py`)
```bash
# Run standalone load test with custom concurrency and request counts
python run_balancer_tests.py --requests 100 --concurrency 50 --report-format json
```

Example CLI Output:
```text
================================================================================
           AUTODEV API KEY BALANCER: REAL-WORLD LOAD TEST REPORT
================================================================================
Parameters:
  Total Concurrent Requests: 60
  Worker Threads:           50
  Total Elapsed Time:       0.285s
  Throughput:               210.5 requests/sec

Distribution Matrix:
  Gemini Key 1:  10 requests [==================] 16.67%
  Gemini Key 2:  10 requests [==================] 16.67%
  Gemini Key 3:  10 requests [==================] 16.67%
  Gemini Key 4:  10 requests [==================] 16.67%
  Gemini Key 5:  10 requests [==================] 16.67%
  Gemini Key 6:  10 requests [==================] 16.67%
  Mistral Key 1: 10 requests (Architecture Critic ONLY)

Statistical Metrics:
  Chi-Square Statistic:     0.0000 (Critical: 11.070, p-value: 1.0000) -> [PASS]
  Coefficient of Variation: 0.0000 (Threshold: <= 0.1500)             -> [PASS]
  Max/Min Ratio:            1.0000 (Threshold: <= 1.3000)             -> [PASS]
  Zero Starvation Check:    0 keys starved                            -> [PASS]

Acceptance Verification Assertions:
  [PASS] Primary Key Rotation before 3.5-flash Downgrade (Tested & Asserted)
  [PASS] Strict Mistral Isolation (0 leaks across 1000 randomized attempts)
  [PASS] Thread-Safe Atomic Lease Release (Zero dangling leases)

FINAL RESULT: ALL VERIFICATION TIERS PASSED (100.0%)
================================================================================
```

---

## 10. Traceability Matrix: Requirements to Verification Tests

| Requirement (ORIGINAL_REQUEST.md) | Implementation Feature | Verification Test Suite | Assertions & Pass Criteria |
|---|---|---|---|
| **R1: 6-Key Pool & Load Balancing** | `key_pool.py`, `strategies.py` | `TEST-T1-05`, `TEST-T2-07`, `TEST-T4-LOAD-01` | $\chi^2 \le 11.07$, $CV \le 0.15$, $R_{\text{max/min}} \le 1.30$ under 50+ concurrent requests. |
| **R2: Strict Mistral Key Isolation** | `isolation_guard.py` | `TEST-T1-04`, `TEST-T2-04`, `TEST-T2-05`, `TEST-T4-MISTRAL-STRICT-ISOLATION` | 100% rejection on non-Architecture stages (`StrictStageIsolationViolation`); 0 leaks. |
| **R3: Robust Fallback Matrix** | `fallback_matrix.py` | `TEST-T1-09`, `TEST-T2-02`, `TEST-T2-03`, `TEST-T4-FALLBACK-ROTATION` | Keys 1..6 rotated on `gemini-3.6-flash` before any downgrade to `gemini-3.5-flash`. |
| **R4: Full Implementation & Testing** | Complete package in `autodev_api_balancer` | 4-Tier Test Suite + `run_balancer_tests.py` | Standalone executable python test script and $\ge 50$ concurrent test passes with 0 failures. |

---
*End of Testing Architecture & Programmatic Verification Suite Specification.*
