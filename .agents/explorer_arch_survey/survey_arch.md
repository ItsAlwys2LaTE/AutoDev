# AutoDev API Key Balancer — Architecture & Concurrency Survey Report

**Author**: Architecture & Concurrency Survey Explorer  
**Date**: 2026-08-29  
**Status**: Ready for Implementation  
**Target Package**: `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer`  
**Integration Target**: `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend`  

---

## 1. Executive Summary & Core Architectural Objectives

The **AutoDev API Key Balancer** (`autodev_api_balancer`) is a high-throughput, thread-safe, and async-compatible key management, load balancing, and resilient fallback engine. Designed specifically for multi-agent software engineering pipelines (such as AutoDev), it manages a pool of **6 Gemini API keys** and **1 Mistral API key** under high concurrency ($50+$ concurrent requests).

### Primary Objectives:
1. **Intelligent Key Pool & Load Balancing**: Dynamically balance requests across 6 Gemini keys using least-connections with round-robin tie-breaking and token-bucket rate limiting.
2. **Strict Stage Reservation Guard**: Cryptographically and logically isolate the 1 Mistral API key exclusively for the **Architecture Critic** stage (`StageEnum.CRITICS` / `sub_task="architecture"`), raising strict access-denied errors for any unauthorized caller.
3. **Robust Fallback Matrix Engine**: Deterministically manage tiered execution:
   - **Tier 1 (Primary Model)**: Rotate across available Gemini Keys (1..6) targeting `gemini-3.6-flash`.
   - **Tier 2 (Secondary Model)**: If all 6 Gemini keys encounter 429/quota exhaustion on primary, gracefully degrade to `gemini-3.5-flash` across available keys.
   - **Tier 3 (Architecture Critic Route)**: Primary on `mistral-small-latest`; upon 429/quota error, gracefully fallback into the Gemini key pool (`gemini-3.6-flash` -> `gemini-3.5-flash`).
4. **Thread-Safe & Zero-Deadlock Concurrency**: Sub-millisecond locking granularity using Python reentrant locks (`threading.RLock`) and asynchronous primitives (`asyncio.Lock`), supporting $50+$ simultaneous requests with zero race conditions, data corruption, or lock inversion deadlocks.
5. **Comprehensive Telemetry & Auditability**: Real-time state metrics, per-key request/error counters, latency tracking, attempt history, and dynamic health windows.

---

## 2. System Architecture & Component Interactions

### 2.1 High-Level Component Topology

```
+-----------------------------------------------------------------------------------------------+
|                                      AutoDev Pipeline Stages                                  |
|  [Requirements]  [Design]  [CodeGen]  [Architecture Critic]  [Integration]  [Documentation]   |
+------------------------------------+-------------------------+--------------------------------+
                                     |                         |
                                     v                         v
+------------------------------------+-------------------------+--------------------------------+
|                             autodev_api_balancer Facade Layer                                 |
|             (GeminiBalancerClient, MistralBalancerClient, UnifiedModelRouter)                 |
+-----------------------------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------------------------+
|                              Strict Stage Reservation Guard                                   |
|   - Validates RequestContext (StageEnum, SubTask, CallerID)                                    |
|   - Rejects non-Architecture Critic access to Mistral key (Raises StageAccessDeniedError)        |
+-----------------------------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------------------------+
|                                 Fallback Matrix Engine                                        |
|   - State Machine: Tier 1 (gemini-3.6-flash x Keys 1..6) -> Tier 2 (gemini-3.5-flash x Keys)  |
|   - Catches 429 / 5xx / QuotaExhausted / Timeouts                                             |
|   - Emits ExecutionTelemetry per invocation                                                   |
+-----------------------------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------------------------+
|                            In-Memory Key Pool Manager (Thread-Safe)                           |
|   - 6 Gemini API Keys + 1 Mistral API Key                                                     |
|   - Strategies: Least-Connections | Weighted Round-Robin | Token-Bucket Health Tracking       |
|   - Rate-Limit Cooldown Windows & Exponential Backoff Recovery                                |
|   - Atomic Counters: in_flight, total_requests, errors, successes, latencies                   |
+-----------------------------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------------------------+
|                              Underlying LLM Provider APIs                                     |
|              [Google GenAI Client SDK]          [Mistral AI Client SDK]                       |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. Key Pool & Load Balancing Engine

### 3.1 In-Memory State Tracking Model

Each API key is represented as a first-class stateful record `APIKeyRecord` managed by `KeyPoolManager`.

```python
@dataclass
class APIKeyRecord:
    key_id: str                          # e.g. "gemini_key_1", "gemini_key_2", "mistral_key_1"
    provider: ProviderType               # ProviderType.GEMINI | ProviderType.MISTRAL
    secret_key: str                      # Raw API key (masked in __repr__)
    allowed_stages: Set[StageEnum]       # Stages permitted to lease this key
    allowed_subtasks: Optional[Set[str]] # Specific sub-tasks permitted (e.g. {"architecture"})
    
    # Dynamic Health & Runtime State
    status: KeyStatus = KeyStatus.ACTIVE # ACTIVE, COOLDOWN, RATE_LIMITED, DISABLED
    active_in_flight: int = 0            # Currently active concurrent leases
    total_requests: int = 0              # Monotonic lifetime requests
    total_successes: int = 0             # Monotonic lifetime successes
    total_errors: int = 0                # Monotonic lifetime errors
    consecutive_rate_limits: int = 0     # Number of consecutive 429 errors
    
    # Cooldown & Rate Limit Timing
    cooldown_until: float = 0.0          # Monotonic timestamp (time.monotonic())
    last_used_time: float = 0.0          # Timestamp of last acquisition
    last_error_time: float = 0.0         # Timestamp of last error
    last_error_message: Optional[str] = None
    
    # Token Bucket Rate Limiter
    token_bucket_capacity: float = 60.0  # Max capacity (e.g. RPM)
    token_bucket_tokens: float = 60.0    # Current available tokens
    token_bucket_fill_rate: float = 1.0  # Tokens added per second
    last_bucket_update: float = 0.0
```

### 3.2 Key Selection & Load Balancing Algorithms

The `KeyPoolManager` implements multiple selectable routing strategies:

#### Strategy 1: Least-Connections with Round-Robin Tie-Breaking (Default)
Optimal for multi-agent workloads with variable latency (streaming vs. batch generation):
$$\text{Score}(k) = \text{active\_in\_flight}(k) \times 1000 + (\text{total\_requests}(k) \pmod{1000})$$
1. Filter keys by:
   - Matching Provider (`provider == ProviderType.GEMINI`)
   - Stage Reservation (`is_permitted(key, context)`)
   - Health State (`now >= key.cooldown_until` and `status != DISABLED`)
2. Select key $k^* = \arg\min_{k \in \mathcal{K}_{\text{avail}}} (\text{active\_in\_flight}(k), \text{total\_requests}(k))$.
3. Increment `active_in_flight` and `total_requests` atomically.

#### Strategy 2: Weighted Round-Robin (WRR)
Used when keys have different rate quotas (e.g. Paid Tier 2 vs Free Tier):
- Each key has a static `weight` $W_k$.
- The pool maintains a current round-robin cursor and cycles through keys according to their health and weight coefficients.

#### Strategy 3: Token Bucket Rate Limiting (Leaky Bucket)
- Before leasing key $k$, update tokens:
  $$\text{tokens} \leftarrow \min(C, \text{tokens} + (\text{now} - t_{\text{last}}) \times r)$$
- If $\text{tokens} \ge 1.0$, deduct $1.0$ token and proceed.
- If $\text{tokens} < 1.0$, mark key in momentary backoff ($t_{\text{wait}} = (1.0 - \text{tokens}) / r$) and evaluate next available key.

### 3.3 Rate-Limit Cooldown Windows & Exponential Backoff

When an API call fails with HTTP 429 (Resource Exhausted) or rate limit:
1. `consecutive_rate_limits` is incremented: $N \leftarrow N + 1$.
2. Cooldown duration is calculated:
   $$T_{\text{cooldown}} = \min(T_{\text{max}}, T_{\text{base}} \times 2^{N - 1})$$
   (Default: $T_{\text{base}} = 15.0\text{s}$, $T_{\text{max}} = 300.0\text{s}$). If `Retry-After` header is provided by upstream, $T_{\text{cooldown}} = \max(T_{\text{header}}, T_{\text{base}})$.
3. Key status transitions to `KeyStatus.RATE_LIMITED`.
4. `cooldown_until = time.monotonic() + T_cooldown`.
5. Upon successful request after cooldown, $N$ is reset to $0$ and status transitions back to `KeyStatus.ACTIVE`.

---

## 4. Strict Stage Reservation Guard

### 4.1 Threat Model & Isolation Requirement
In AutoDev, the **Architecture Critic** provides an independent, un-biased structural critique of the system design blueprint against the generated codebase. To ensure model diversity, AutoDev allocates a dedicated **Mistral API key** for this agent.
- **Rule**: The Mistral API key must **NEVER** be leased, dispensed, or used for any non-Architecture Critic component (such as Requirements, Design, CodeGen, Correctness Critic, Completeness Critic, Integration, or Documentation).
- **Rule**: If a non-Architecture Critic component explicitly or implicitly requests a Mistral key, the balancer must reject the request immediately with a fatal `StageAccessDeniedError` and **must not** grant access.
- **Rule**: The Architecture Critic itself may use Mistral as primary, but if Mistral experiences rate limiting (429) or outage, the Fallback Matrix Engine allows fallback to the Gemini pool with `gemini-3.6-flash` and `gemini-3.5-flash`.

### 4.2 Formal Guard Specification

```python
class StrictStageReservationGuard:
    """
    Enforces strict access control policies on API keys based on caller PipelineRequestContext.
    """
    
    @staticmethod
    def validate_access(key_record: APIKeyRecord, context: PipelineRequestContext) -> None:
        """
        Validates whether the given context is permitted to lease the key.
        Raises StageAccessDeniedError on any policy violation.
        """
        if key_record.provider == ProviderType.MISTRAL:
            # Enforce Mistral isolation
            is_critic_stage = (context.stage == StageEnum.CRITICS)
            is_arch_subtask = (
                context.sub_task is not None and 
                context.sub_task.strip().lower() in {"architecture", "architecture_critic", "arch_critic"}
            )
            
            if not (is_critic_stage and is_arch_subtask):
                raise StageAccessDeniedError(
                    f"STAGE RESERVATION VIOLATION: Key '{key_record.key_id}' (Provider: MISTRAL) "
                    f"is strictly reserved for StageEnum.CRITICS with sub_task='architecture'. "
                    f"Denied access to stage='{context.stage}', sub_task='{context.sub_task}', "
                    f"caller_id='{context.caller_id}'."
                )
        
        # Check explicit stage whitelist if configured on the key
        if key_record.allowed_stages and context.stage not in key_record.allowed_stages:
            raise StageAccessDeniedError(
                f"Key '{key_record.key_id}' does not permit access to stage '{context.stage}'."
            )
```

---

## 5. Fallback Matrix Engine & State Machine

### 5.1 Fallback State Machine

The Fallback Matrix manages request retries across key pools and model tiers:

```
[Incoming Pipeline Request]
          |
          v
[Is Request for Architecture Critic?]
   /                              \
 (YES)                            (NO: Standard Gemini Request)
  /                                 \
 v                                   v
[Attempt Mistral Key]          [Tier 1: Primary Model 'gemini-3.6-flash']
[model: mistral-small-latest]       |
  |                                 |--> Lease Key k from Gemini Pool (1..6)
  |-- (Success) --> Return          |--> Execute call
  |                                 |-- (Success) --> Return
  \-- (429 / Error)                 \-- (429 / 5xx / Error)
        |                                 |--> Mark Key k in Cooldown
        v                                 |--> Rotate to Next Available Gemini Key (k+1..6)
  (Fallback to Gemini Pool)               \--> Repeat across all 6 Gemini keys
        |                                       |
        +---------------------------------------+
                        | (All 6 Gemini keys exhausted on Primary Model)
                        v
          [Tier 2: Secondary Model 'gemini-3.5-flash']
                        |
                        |--> Re-evaluate Gemini Pool (1..6) with 'gemini-3.5-flash'
                        |--> Execute call
                        |-- (Success) --> Return with fallback telemetry (downgraded=True)
                        \-- (429 / 5xx / Error)
                              |--> Mark Key in Cooldown
                              \--> Rotate to next Gemini key
                                    |
                                    v (All keys exhausted on Tier 2)
                        [Raise AllKeysExhaustedError]
                        (Include full diagnostic telemetry)
```

### 5.2 Deterministic Transition Rules

Let $\mathcal{K}_{\text{gemini}} = \{k_1, k_2, k_3, k_4, k_5, k_6\}$.
Let $\mathcal{M}_{\text{primary}} = \text{"gemini-3.6-flash"}$.
Let $\mathcal{M}_{\text{secondary}} = \text{"gemini-3.5-flash"}$.

1. **Attempt Sequence**:
   $$\text{Sequence} = \left[ (k, \mathcal{M}_{\text{primary}}) \mid k \in \mathcal{K}_{\text{gemini}} \right] \,\|\, \left[ (k, \mathcal{M}_{\text{secondary}}) \mid k \in \mathcal{K}_{\text{gemini}} \right]$$
2. **Key Ordering**: Ordered dynamically by Least-Connections at each step.
3. **Execution Guard**: No model downgrade to $\mathcal{M}_{\text{secondary}}$ may occur until every eligible key in $\mathcal{K}_{\text{gemini}}$ has been attempted with $\mathcal{M}_{\text{primary}}$ (or found in active rate-limit cooldown).
4. **Telemetry Accumulator**: For every attempted hop, record `AttemptTelemetry(attempt_idx, key_id, model, duration_ms, error_type, status)`.

---

## 6. Concurrency & Thread-Safety Design

### 6.1 Concurrency Target & Verification Scale
- **Target**: Minimum $50+$ simultaneous concurrent requests with zero race conditions, data races, deadlocks, or thread leaks.
- **Environment**: Multi-threaded WSGI/ASGI servers (Uvicorn / FastAPI), LangGraph parallel nodes, and `asyncio` task runners.

### 6.2 Lock Granularity & Critical Section Minimization

```
[Client Thread / Coroutine]
        |
        +---> Enter KeyPoolManager.acquire_lease(...)
        |       |
        |       |--- [ACQUIRE POOL RLOCK] (< 50 microseconds)
        |       |    - Filter candidate keys
        |       |    - Select optimal key (least-connections)
        |       |    - Increment key.active_in_flight
        |       |    - Increment key.total_requests
        |       |--- [RELEASE POOL RLOCK]
        |
        +---> Perform Network I/O (Gemini / Mistral API Call) (500ms - 5000ms)
        |     ** ZERO LOCKS HELD DURING I/O **
        |
        +---> Enter KeyPoolManager.release_lease(...)
                |
                |--- [ACQUIRE POOL RLOCK] (< 50 microseconds)
                |    - Decrement key.active_in_flight
                |    - Update success / error counters
                |    - Update cooldown_until if rate-limited
                |--- [RELEASE POOL RLOCK]
```

### 6.3 Mathematical Proof of Deadlock Freedom
1. **Single Lock Hierarchy**: All internal state mutations across the balancer use a single reentrant mutex (`self._lock = threading.RLock()`) per `KeyPoolManager` instance.
2. **Zero Nested Lock Acquisition**: No thread acquires a second lock while holding `self._lock`.
3. **Zero Lock Holding Across I/O**: Network calls to Google GenAI / Mistral AI are executed strictly outside of the critical section.
4. **Guaranteed Release via Context Manager**:
   ```python
   @contextmanager
   def lease_key(self, context: PipelineRequestContext, provider: ProviderType):
       key_record = self._acquire(context, provider)
       try:
           yield key_record
           self._record_success(key_record)
       except Exception as ex:
           self._record_error(key_record, ex)
           raise
       finally:
           self._release(key_record)
   ```
   Even if the worker thread crashes, encounters a timeout, or throws an unhandled exception, `key.active_in_flight` is guaranteed to decrement cleanly in the `finally` block.

---

## 7. Class Hierarchies, Data Models & Method Signatures

### 7.1 Enums and Data Models (`autodev_api_balancer.models`)

```python
from enum import Enum, unique
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Any, Union
import time
import uuid

@unique
class ProviderType(str, Enum):
    GEMINI = "GEMINI"
    MISTRAL = "MISTRAL"

@unique
class KeyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COOLDOWN = "COOLDOWN"
    RATE_LIMITED = "RATE_LIMITED"
    DISABLED = "DISABLED"

@unique
class BalancingStrategy(str, Enum):
    LEAST_CONNECTIONS = "LEAST_CONNECTIONS"
    ROUND_ROBIN = "ROUND_ROBIN"
    WEIGHTED_ROUND_ROBIN = "WEIGHTED_ROUND_ROBIN"

@dataclass(frozen=True)
class PipelineRequestContext:
    stage: str                          # StageEnum name (e.g. "CRITICS", "CODEGEN", "DESIGN")
    sub_task: Optional[str] = None      # e.g. "architecture", "correctness", "completeness"
    caller_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)

@dataclass
class AttemptTelemetry:
    attempt_number: int
    key_id: str
    provider: ProviderType
    model_name: str
    status: str                         # "SUCCESS" | "RATE_LIMITED" | "ERROR"
    latency_ms: float
    error_message: Optional[str] = None
    http_status_code: Optional[int] = None

@dataclass
class ExecutionTelemetry:
    request_id: str
    context: PipelineRequestContext
    primary_model_requested: str
    final_model_used: str
    key_id_used: str
    provider_used: ProviderType
    total_attempts: int
    fallback_triggered: bool
    model_downgraded: bool
    total_latency_ms: float
    attempts: List[AttemptTelemetry] = field(default_factory=list)
```

### 7.2 Core Exceptions (`autodev_api_balancer.exceptions`)

```python
class BalancerError(Exception):
    """Base exception for all API balancer errors."""
    pass

class StageAccessDeniedError(BalancerError):
    """Raised when a caller attempts to use a reserved key in an unauthorized stage."""
    pass

class AllKeysExhaustedError(BalancerError):
    """Raised when all keys across all model tiers are exhausted or rate-limited."""
    def __init__(self, message: str, telemetry: ExecutionTelemetry):
        super().__init__(message)
        self.telemetry = telemetry

class KeyConfigurationError(BalancerError):
    """Raised when API key configuration is missing or invalid."""
    pass
```

### 7.3 Key Pool Manager Interface (`autodev_api_balancer.key_pool`)

```python
class KeyPoolManager:
    def __init__(
        self,
        strategy: BalancingStrategy = BalancingStrategy.LEAST_CONNECTIONS,
        default_cooldown_seconds: float = 30.0,
        max_cooldown_seconds: float = 300.0,
    ): ...

    def register_key(
        self,
        key_id: str,
        provider: ProviderType,
        secret_key: str,
        allowed_stages: Optional[Set[str]] = None,
        allowed_subtasks: Optional[Set[str]] = None,
        weight: int = 1,
    ) -> None: ...

    def acquire_key(
        self,
        context: PipelineRequestContext,
        provider: ProviderType = ProviderType.GEMINI,
        exclude_key_ids: Optional[Set[str]] = None,
    ) -> APIKeyRecord: ...

    def release_key(
        self,
        key_record: APIKeyRecord,
        success: bool = True,
        error: Optional[Exception] = None,
        http_status: Optional[int] = None,
        latency_ms: float = 0.0,
    ) -> None: ...

    def get_pool_status(self) -> Dict[str, Any]: ...
    def reset_cooldowns(self) -> None: ...
```

### 7.4 Fallback Matrix Engine Interface (`autodev_api_balancer.fallback_engine`)

```python
class FallbackMatrixEngine:
    def __init__(
        self,
        key_pool: KeyPoolManager,
        primary_gemini_model: str = "gemini-3.6-flash",
        secondary_gemini_model: str = "gemini-3.5-flash",
        primary_mistral_model: str = "mistral-small-latest",
    ): ...

    def execute_with_fallback(
        self,
        context: PipelineRequestContext,
        invoke_fn: Callable[[str, str], Any],  # fn(api_key, model_name) -> Result
        target_provider: ProviderType = ProviderType.GEMINI,
    ) -> Tuple[Any, ExecutionTelemetry]: ...

    async def execute_with_fallback_async(
        self,
        context: PipelineRequestContext,
        async_invoke_fn: Callable[[str, str], Awaitable[Any]],
        target_provider: ProviderType = ProviderType.GEMINI,
    ) -> Tuple[Any, ExecutionTelemetry]: ...
```

### 7.5 High-Level Balancer Client Facades (`autodev_api_balancer.client`)

```python
class AutoDevBalancerClient:
    """
    Unified high-level client wrapping Google GenAI and Mistral AI client invocations
    with automatic stage reservation, key pooling, and fallback matrix execution.
    """
    def __init__(self, config: Optional[BalancerConfig] = None): ...

    def generate_gemini_content(
        self,
        context: PipelineRequestContext,
        contents: Any,
        config: Optional[Any] = None,
        primary_model: str = "gemini-3.6-flash",
        secondary_model: str = "gemini-3.5-flash",
    ) -> Tuple[Any, ExecutionTelemetry]: ...

    def generate_gemini_stream(
        self,
        context: PipelineRequestContext,
        contents: Any,
        config: Optional[Any] = None,
        primary_model: str = "gemini-3.6-flash",
        secondary_model: str = "gemini-3.5-flash",
    ) -> Tuple[Iterator[Any], ExecutionTelemetry]: ...

    def chat_mistral(
        self,
        context: PipelineRequestContext,
        messages: List[Dict[str, str]],
        model: str = "mistral-small-latest",
        **kwargs
    ) -> Tuple[Any, ExecutionTelemetry]: ...
```

---

## 8. File Layout & Module Boundaries

### 8.1 Package Structure (`teamwork_projects/autodev_api_balancer`)

```
autodev_api_balancer/
├── pyproject.toml                     # Modern build & packaging spec
├── README.md                          # Architecture & usage documentation
├── autodev_api_balancer/
│   ├── __init__.py                    # Public API exports
│   ├── models.py                      # Enums, Data classes, Telemetry, RequestContext
│   ├── exceptions.py                  # BalancerError, StageAccessDeniedError, AllKeysExhaustedError
│   ├── config.py                      # Environment variable loader & balancer config
│   ├── guards.py                      # StrictStageReservationGuard
│   ├── key_pool.py                    # Thread-safe KeyPoolManager & APIKeyRecord
│   ├── fallback_engine.py             # FallbackMatrixEngine (Sync & Async)
│   ├── client.py                      # AutoDevBalancerClient facade
│   └── telemetry.py                   # Aggregator, distribution metrics & reporters
└── tests/
    ├── __init__.py
    ├── conftest.py                    # Pytest fixtures & mock providers
    ├── test_key_pool.py               # Unit tests: least-connections, round-robin, state mutations
    ├── test_reservation_guard.py      # Unit tests: Mistral stage isolation & access denial
    ├── test_fallback_matrix.py        # Unit tests: 6-key primary -> secondary model fallback
    ├── test_concurrency_load.py       # Load test: 50+ concurrent requests & distribution report
    └── test_rate_limit_simulation.py  # Simulation: 429 errors triggering cooldown & failover
```

---

## 9. AutoDev Backend Integration Blueprint

### 9.1 Environment Variable Loading Strategy
The balancer automatically discovers keys from any of the standard configurations:

```bash
# 1. Direct Indexed Gemini Keys (Recommended)
GEMINI_API_KEY_1="AIzaSy..."
GEMINI_API_KEY_2="AIzaSy..."
GEMINI_API_KEY_3="AIzaSy..."
GEMINI_API_KEY_4="AIzaSy..."
GEMINI_API_KEY_5="AIzaSy..."
GEMINI_API_KEY_6="AIzaSy..."

# 2. Dedicated Mistral Key for Architecture Critic
MISTRAL_API_KEY="mistral_..."

# 3. Backward Compatibility Mapping (AutoDev existing env vars):
# GEMINI_API_KEY_REQUIREMENTS -> gemini_key_1
# GEMINI_API_KEY_DESIGN       -> gemini_key_2
# GEMINI_API_KEY_CODEGEN      -> gemini_key_3
# GEMINI_API_KEY_CRITICS      -> gemini_key_4
# GEMINI_API_KEY_ADJUDICATOR  -> gemini_key_5
# GEMINI_API_KEY_INTEGRATION  -> gemini_key_6
```

### 9.2 Agent Refactoring Plan

#### 1. Architecture Critic (`backend/agents/critics.py`)
```python
# BEFORE: Direct hardcoded client
client = Mistral(api_key=api_key)
response = client.chat.complete(...)

# AFTER: Balancer with Stage Reservation Context & Fallback
context = PipelineRequestContext(stage="CRITICS", sub_task="architecture")
content, telemetry = balancer_client.chat_mistral(
    context=context,
    messages=[{"role": "user", "content": prompt}],
    response_format={"type": "json_object"}
)
```

#### 2. Correctness & Completeness Critics (`backend/agents/critics.py`)
```python
# Calls using Gemini Pool with Automatic Fallback Matrix:
context = PipelineRequestContext(stage="CRITICS", sub_task="correctness")
response, telemetry = balancer_client.generate_gemini_content(
    context=context,
    contents=prompt,
    config=types.GenerateContentConfig(response_schema=CriticFeedback)
)
```

#### 3. CodeGen Agent (`backend/agents/codegen_agent.py`)
```python
context = PipelineRequestContext(stage="CODEGEN", sub_task="generate_code")
stream, telemetry = balancer_client.generate_gemini_stream(
    context=context,
    contents=prompt_content,
    config=types.GenerateContentConfig(...)
)
```

---

## 10. Programmatic Verification & Load Test Specification

To fulfill the Authoritative User Acceptance Criteria, the verification test suite must implement:

### 10.1 Test Matrix

| Test Suite | Target Metric | Assertion / Verification Method |
|---|---|---|
| `test_concurrency_load.py` | 50+ Concurrent Requests | Execute 50–100 parallel threads. Assert 0 errors, 0 deadlocks, and balanced standard deviation across all 6 keys ($\sigma < 2.5$). |
| `test_rate_limit_simulation.py` | 6-Key Primary -> Secondary Fallback | Inject simulated 429s on Keys 1..5. Verify Key 6 is used with `gemini-3.6-flash`. Inject 429 on Key 6. Verify graceful fallback to `gemini-3.5-flash`. |
| `test_reservation_guard.py` | Mistral Key Isolation | Assert `StageAccessDeniedError` for `CODEGEN`, `DESIGN`, `REQUIREMENTS`, `INTEGRATION`, `DOCUMENTATION`, `ADJUDICATOR`, and non-architecture critics. |
| `test_key_pool.py` | Least-Connections Algorithm | Concurrently lease keys; assert minimum active in-flight key is always chosen. |
| `test_recovery_cooldown.py` | Cooldown Window Expiration | Fast-forward monotonic clock; assert rate-limited key returns to `ACTIVE`. |

### 10.2 Distribution Report Schema
The load test generates a summary report in JSON and tabular format:

```
========================= KEY LOAD DISTRIBUTION REPORT =========================
Total Simulated Requests: 120
Concurrency Level:        60 workers
Duration:                 1.42s
Throughput:               84.5 req/sec

Key ID         Provider   Total Req   Successes   Errors   In-Flight   Share (%)
--------------------------------------------------------------------------------
gemini_key_1   GEMINI     20          20          0        0           16.67%
gemini_key_2   GEMINI     20          20          0        0           16.67%
gemini_key_3   GEMINI     20          20          0        0           16.67%
gemini_key_4   GEMINI     20          20          0        0           16.67%
gemini_key_5   GEMINI     20          20          0        0           16.67%
gemini_key_6   GEMINI     20          20          0        0           16.67%
--------------------------------------------------------------------------------
Mistral Key:   MISTRAL    0 requests (Stage Reservation Guard: 100% Isolated)
================================================================================
```

---

## 11. Conclusion & Implementation Readiness

The proposed architecture directly answers all four core requirements ($R1$ through $R4$) of the project prompt with mathematical rigor, thread safety, and clean separation of concerns.

The package is designed for zero external boilerplate, rapid testability via mocked client fixtures, and seamless drop-in integration into the AutoDev backend.
