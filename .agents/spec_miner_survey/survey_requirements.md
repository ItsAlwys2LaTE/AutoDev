# AutoDev API Key Balancer & Model Fallback Engine
## Requirements Specification & Architectural Survey Report

**Document Version:** 1.0.0  
**Date:** 2026-08-29  
**Author:** Requirements Specification Miner (`spec_miner_survey`)  
**Target Repository:** `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer`  
**Integration Scope:** `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend`  
**Authoritative Reference:** `ORIGINAL_REQUEST.md` (Follow-up — 2026-08-29T07:10:58Z)

---

## 1. Executive Summary & Authoritative Directives

The AutoDev multi-agent software development system executes autonomous workflows consisting of multiple discrete stages: **Phase 0 (Decomposition)**, **Phase 1 (Requirements)**, **Phase 2 (Design)**, **Phase 2b (CodeGen)**, **Phase 3 (Arbitration / Critics: Correctness, Completeness, Architecture)**, **Phase 3b (Adjudication)**, **Phase 4 (Integration)**, and **Documentation**. 

During high-concurrency multi-component execution, concurrent LLM API calls against Google Gemini frequently encounter rate limits (`HTTP 429 Too Many Requests`, `RESOURCE_EXHAUSTED`, quota throttling), while static 1-to-1 environment variable key bindings (`GEMINI_API_KEY_DESIGN`, `GEMINI_API_KEY_CODEGEN`, etc.) lead to severe hotspotting, uneven quota burn, and cascading pipeline failures. Furthermore, the specialized **Mistral API Key** designated for structural architectural evaluation must remain strictly isolated and inaccessible to general pipeline tasks to prevent unauthorized quota drain.

The **AutoDev API Key Balancer** (`autodev_api_balancer`) provides:
1. **R1: 6 Gemini API Keys Pool & Dynamic Load Balancing**: Centralized management, concurrency tracking, and fair-share rotation of 6 Gemini API keys across all AutoDev pipeline stages.
2. **R2: Strict Mistral Key Isolation**: Cryptographic/authorization gate ensuring the 1 Mistral API key is exclusively dispensed to the **Architecture Critic** stage, with strict exception rejection for any unauthorized caller.
3. **R3: Robust Multi-Tier Fallback Matrix**: Sequential rotation across all 6 Gemini keys on the primary model (`gemini-3.6-flash`) upon rate limits or transient errors, transitioning to the secondary model (`gemini-3.5-flash`) **only when all 6 keys are exhausted** on the primary model.
4. **R4: Production Python Module & Backend Integration**: Modular, thread-safe, high-performance Python package (`autodev_balancer`) with zero-overhead drop-in wrappers supporting both synchronous (`generate_content`) and streaming (`generate_content_stream`) generation for the AutoDev backend.

---

## 2. Codebase Baseline & Integration Context

### 2.1 Current AutoDev Agent & LLM Call Topology

Inspection of `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend` reveals the existing LLM interaction points:

| AutoDev Agent / Module | Current Env Var Binding | Primary Model | Current Fallback Model | Calling Paradigm | Stage Enum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `agents/requirements_agent.py` | `GEMINI_API_KEY_REQUIREMENTS` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Streaming | `REQUIREMENTS` |
| `agents/master_architect.py` | `GEMINI_API_KEY_ADJUDICATOR` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Streaming | `DECOMPOSITION` |
| `agents/design_agent.py` | `GEMINI_API_KEY_DESIGN` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Streaming | `DESIGN` |
| `agents/codegen_agent.py` | `GEMINI_API_KEY_CODEGEN` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Streaming | `CODEGEN` |
| `agents/critics.py` (`evaluate_correctness`) | `GEMINI_API_KEY_CRITICS` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Synchronous JSON | `CRITIC_CORRECTNESS` |
| `agents/critics.py` (`evaluate_architecture`) | `MISTRAL_API_KEY` | `mistral-small-latest` | `gemini-3.5-flash-lite` (via adjudicator key) | Synchronous JSON | `CRITIC_ARCHITECTURE` |
| `agents/critics.py` (`evaluate_completeness`) | `GEMINI_API_KEY_CRITICS` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Synchronous JSON | `CRITIC_COMPLETENESS` |
| `orchestrator.py` (`node_adjudicator`) | `GEMINI_API_KEY_ADJUDICATOR` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Synchronous JSON | `ADJUDICATOR` |
| `agents/integrator_agent.py` | `GEMINI_API_KEY_INTEGRATION` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Streaming | `INTEGRATION` |
| `agents/documentation_agent.py` | `GEMINI_API_KEY_REQUIREMENTS` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Streaming | `DOCUMENTATION` |
| `main.py` (`api_parse_requirements`) | `GEMINI_API_KEY_REQUIREMENTS` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Synchronous JSON | `REQUIREMENTS` |
| `main.py` (`api_parse_blueprint`) | `GEMINI_API_KEY_DESIGN` | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Synchronous JSON | `DESIGN` |

### 2.2 Critical Deficiencies in Existing Codebase
1. **Key Fragmentation & Hotspotting**: Individual stages are pinned to specific keys. When the `CODEGEN` agent makes heavy iterative requests during self-correction loops, `GEMINI_API_KEY_CODEGEN` burns out immediately while other keys sit idle.
2. **Hardcoded Inadequate Fallback**: Existing agents fallback from `gemini-3.6-flash` to `gemini-3.5-flash-lite` on the *same single key* without ever attempting the 5 other available Gemini keys.
3. **Lack of Mistral Isolation Guards**: While only `evaluate_architecture` currently reads `MISTRAL_API_KEY`, there is no runtime guard preventing any other component or developer from accessing `MISTRAL_API_KEY`.
4. **Discrepancy in Fallback Model Target**: Existing code falls back to `gemini-3.5-flash-lite`, whereas the authoritative requirement explicitly mandates `gemini-3.5-flash`.

---

## 3. Exhaustive Specification: R1 — 6 Gemini Keys Pool & Load Balancing

### 3.1 Key Discovery & Environment Variable Schemas
The system must automatically discover and initialize the 6 Gemini API keys using a resilient, multi-format hierarchy:

```
Priority 1: Explicit Comma-Separated List
   GEMINI_API_KEYS=key1,key2,key3,key4,key5,key6

Priority 2: Numbered Environment Variables
   GEMINI_API_KEY_1=...
   GEMINI_API_KEY_2=...
   GEMINI_API_KEY_3=...
   GEMINI_API_KEY_4=...
   GEMINI_API_KEY_5=...
   GEMINI_API_KEY_6=...

Priority 3: Legacy AutoDev Stage Environment Variables
   GEMINI_API_KEY_REQUIREMENTS=... (Key 1)
   GEMINI_API_KEY_DESIGN=...       (Key 2)
   GEMINI_API_KEY_CODEGEN=...      (Key 3)
   GEMINI_API_KEY_CRITICS=...      (Key 4)
   GEMINI_API_KEY_ADJUDICATOR=...  (Key 5)
   GEMINI_API_KEY_INTEGRATION=...  (Key 6)
```

**Discovery Invariant:**
- Exactly 6 distinct Gemini API keys must be loaded into the active Gemini key pool $P = \{K_1, K_2, K_3, K_4, K_5, K_6\}$. If duplicate keys or missing keys occur, the balancer must validate and warn/raise based on strictness mode (`strict=True` requires 6 distinct valid keys; `lenient=True` deduplicates and balances across available keys with minimum threshold $\ge 1$).

### 3.2 State Tracking Data Model
Each key $K_i \in P$ is encapsulated in a stateful, thread-safe record:

```python
class KeyStatus(str, Enum):
    HEALTHY = "healthy"
    RATE_LIMITED = "rate_limited"
    COOLDOWN = "cooldown"
    EXHAUSTED = "exhausted"
    DISABLED = "disabled"

class KeyRecord:
    key_id: str                      # e.g., "gemini-key-1"
    raw_key: str                     # Actual API key secret
    masked_key: str                  # e.g., "AQ.Ab8R...CQ4R0A"
    provider: ProviderEnum           # ProviderEnum.GEMINI
    status: KeyStatus                # Current operational status
    total_requests: int              # Monotonic total requests processed
    successful_requests: int         # Total successful responses
    failed_requests: int             # Total 4xx/5xx failures
    rate_limited_count: int          # Total 429/quota exhaustions encountered
    active_in_flight: int            # Active concurrent executions currently using this key
    cooldown_until: float            # Epoch timestamp (time.time()) when cooldown expires
    last_used_timestamp: float       # Epoch timestamp of most recent dispatch
    last_error_message: Optional[str]# Verbatim message of last failure
```

### 3.3 Load-Balancing Algorithms
The balancer must support configurable, pluggable selection strategies:

1. **Least-Connections with Fair-Share Fallback (Primary Strategy)**:
   $$\text{Select } K^* = \arg\min_{K \in P_{\text{healthy}}} \left( \alpha \cdot \text{active\_in\_flight}(K) + \beta \cdot \text{total\_requests}(K) \right)$$
   where $\alpha = 10.0, \beta = 1.0$, prioritizing keys with lowest concurrent in-flight load, breaking ties by lowest cumulative requests.
2. **Weighted Round-Robin (WRR) / Smooth Round-Robin**:
   Maintains a monotonic pointer index $i = (i + 1) \pmod 6$, skipping keys that are currently in cooldown or exhausted.
3. **Least-Recently-Used (LRU) Rotation**:
   Selects the healthy key with the oldest `last_used_timestamp`.
4. **Fairness Metric & Distribution Invariant**:
   Under a sustained uniform workload of $N \ge 50$ concurrent requests across 6 healthy keys, the request distribution standard deviation $\sigma$ must satisfy:
   $$\sigma \le 0.20 \cdot \frac{N}{6}$$
   guaranteeing no single key is starved or overloaded.

### 3.4 Concurrency & Thread-Safety Model
AutoDev executes concurrent pipeline stages (e.g., parallel Critic nodes in LangGraph, concurrent component pipelines). The `KeyPool` and `KeyBalancer` must implement re-entrant mutex synchronization (`threading.RLock`) for all state transitions:
- Key lease acquisition (`acquire_key`)
- In-flight counter increment/decrement (`release_key`)
- Cooldown registration (`mark_rate_limited`)
- Status queries and telemetry snapshot generation

---

## 4. Exhaustive Specification: R2 — Strict Mistral Key Isolation

### 4.1 Strict Isolation Principle & Threat Model
The Mistral API Key (`MISTRAL_API_KEY`) is a dedicated high-tier structural evaluation resource reserved **exclusively** for the **Architecture Critic** stage (`evaluate_architecture`).

**Threats Mitigated:**
1. **Accidental Leakage / Pool Poisoning**: Placing the Mistral key in the general balancer rotation pool, causing Gemini endpoints to attempt Gemini calls with Mistral keys.
2. **Stage Impersonation / Unauthorized Bypasses**: Other stages (`CODEGEN`, `DESIGN`, `REQUIREMENTS`, `INTEGRATION`, `DOCUMENTATION`, `CORRECTNESS_CRITIC`, `COMPLETENESS_CRITIC`, `ADJUDICATOR`) attempting to call Mistral to bypass Gemini rate limits.
3. **Direct Unchecked Dispensation**: Components querying the key manager for a raw Mistral key without proving stage identity.

### 4.2 Stage Authorization Contract & Security Barrier
The `MistralKeyRegistry` enforces mandatory stage validation on every access:

```python
AUTHORIZED_MISTRAL_STAGES = frozenset([
    "CRITIC_ARCHITECTURE",
    "architecture_critic",
    StageEnum.CRITIC_ARCHITECTURE
])

class MistralKeyRegistry:
    def __init__(self, raw_key: str):
        self._raw_key = raw_key
        self._lock = threading.RLock()
        self._usage_metrics = {"requests": 0, "failures": 0}

    def dispense_key(self, stage: Union[str, StageEnum], caller_id: Optional[str] = None) -> str:
        stage_str = stage.value if isinstance(stage, StageEnum) else str(stage)
        if stage_str not in AUTHORIZED_MISTRAL_STAGES:
            raise KeyAccessDeniedError(
                f"SECURITY VIOLATION: Mistral API key access denied for unauthorized stage '{stage_str}'. "
                f"Mistral is strictly isolated for StageEnum.CRITIC_ARCHITECTURE."
            )
        with self._lock:
            self._usage_metrics["requests"] += 1
            return self._raw_key
```

### 4.3 Fallback Isolation Boundary
If `evaluate_architecture` invokes Mistral and receives a rate limit or failure:
- The Architecture Critic may request a fallback Gemini key from the Gemini Key Pool.
- **Under NO circumstances may any Gemini stage fall back to Mistral.** The fallback path is strictly unidirectional:
  $$\text{Mistral} \xrightarrow{\text{fallback}} \text{Gemini Pool (Key 1..6)}$$
  $$\text{Gemini (Any Stage)} \xrightarrow{\text{fallback}} \text{Other Gemini Keys (NEVER Mistral)}$$

---

## 5. Exhaustive Specification: R3 — Robust Fallback Matrix

### 5.1 Hierarchical Fallback Decision Matrix

The fallback engine enforces a 6-tier deterministic fallback state machine:

```
[Incoming Request] (Stage: S, Prompt: P, Config: C)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: Primary Model (`gemini-3.6-flash`) on Selected Key  │
│ Select Key K_i via Least-Connections / Round-Robin          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
          [200 Success]               [429 / Rate Limit]
                │                             │
                ▼                             ▼
        [Return Result]        ┌──────────────────────────────┐
                               │ Mark K_i in Cooldown         │
                               │ Attempt NEXT Key K_j != K_i  │
                               │ on `gemini-3.6-flash`        │
                               └──────────────┬───────────────┘
                                              │
                ┌─────────────────────────────┴─────────────────────────────┐
                │                                                           │
     [Success on K_j (j in 1..6)]                            [All 6 Keys Exhausted on 3.6]
                │                                                           │
                ▼                                                           ▼
        [Return Result]                                ┌─────────────────────────────────────────┐
                                                       │ TIER 2: Secondary Model                 │
                                                       │ (`gemini-3.5-flash`)                    │
                                                       │ DEGRADATION GATE TRIGGERED              │
                                                       └────────────────────┬────────────────────┘
                                                                            │
                                                       ┌────────────────────┴────────────────────┐
                                                       │ Rotate across All 6 Keys (K_1..K_6)     │
                                                       │ on `gemini-3.5-flash`                   │
                                                       └────────────────────┬────────────────────┘
                                                                            │
                                              ┌─────────────────────────────┴─────────────────────────────┐
                                              │                                                           │
                                   [Success on 3.5-flash]                                    [All 6 Keys Exhausted on 3.5]
                                              │                                                           │
                                              ▼                                                           ▼
                                      [Return Result]                                        [Raise AllKeysExhaustedError]
                                                                                             (Detailed Diagnostic Audit)
```

### 5.2 Error Classification Taxonomy

The fallback router must strictly classify errors to prevent useless retries on non-transient failures:

| Error Category | Indicators / Status Codes | Engine Action |
| :--- | :--- | :--- |
| **Rate Limit / Quota** | `HTTP 429`, `ResourceExhausted`, `RESOURCE_EXHAUSTED`, `"quota exceeded"`, `"rate limit"` | Mark current key in cooldown ($T_{\text{cooldown}} = 60\text{s}$). Route immediately to next Gemini key on same model tier. |
| **Server Transient** | `HTTP 503 Service Unavailable`, `HTTP 500 Internal`, `HTTP 502 Bad Gateway`, `SocketTimeout`, `ConnectionReset` | Mark key transient cooldown ($T_{\text{cooldown}} = 5\text{s}$). Route to next Gemini key on same model tier. |
| **Authentication / Key Dead** | `HTTP 401 Unauthorized`, `HTTP 403 Forbidden`, `"API_KEY_INVALID"`, `"PERMISSION_DENIED"` | Permanently mark current key `DISABLED`. Route to next Gemini key. Log critical security alert. |
| **Permanent Request Error** | `HTTP 400 Bad Request`, `SchemaViolation`, `ContextLengthExceeded`, `PromptTooLong`, `InvalidJSON` | **ABORT IMMEDIATELY.** Do NOT rotate keys or degrade models. Raise verbatim client error. |

### 5.3 Cooldown Decay & Automatic Self-Healing
Keys marked in `RATE_LIMITED` cooldown must automatically self-heal once their `cooldown_until` timestamp has elapsed:
$$T_{\text{remaining}} = \max(0.0, K.\text{cooldown\_until} - \text{time.time}())$$
When $T_{\text{remaining}} = 0$, the key's status transitions seamlessly from `COOLDOWN` $\to$ `HEALTHY` without requiring service restarts.

---

## 6. Exhaustive Specification: R4 — Architecture, API Signatures & Integration

### 6.1 Package Layout (`~/teamwork_projects/autodev_api_balancer`)

```
autodev_api_balancer/
├── pyproject.toml
├── README.md
├── src/
│   └── autodev_balancer/
│       ├── __init__.py               # Exports AutoDevLLMClient, KeyBalancer, GeminiKeyPool, MistralKeyRegistry
│       ├── models.py                 # Enums (StageEnum, KeyStatus, ProviderEnum), Pydantic schemas, KeyRecord
│       ├── exceptions.py             # KeyAccessDeniedError, AllKeysExhaustedError, InvalidStageError, etc.
│       ├── key_pool.py               # KeyPool, GeminiKeyPool, MistralKeyRegistry (thread-safe key stores)
│       ├── balancer.py               # KeyBalancer (Least-Connections, WRR, LRU strategies)
│       ├── fallback.py               # FallbackRouter, ExecutionEngine, Retry Matrix
│       ├── client.py                 # AutoDevLLMClient (Unified drop-in wrapper for genai & mistral)
│       └── metrics.py                # Telemetry, Distribution Reporter, Prometheus-compatible metrics
└── tests/
    ├── __init__.py
    ├── conftest.py                   # Mock clients, synthetic keys, fixtures
    ├── test_key_pool.py              # R1 Unit tests: key discovery, state transitions, concurrency
    ├── test_balancer.py              # R1 Unit tests: least-conn, round-robin, distribution fairness
    ├── test_mistral_isolation.py     # R2 Security tests: stage authorization, bypass prevention
    ├── test_fallback_matrix.py       # R3 Fallback tests: 6-key rotation, 3.6 -> 3.5 degradation gate
    ├── test_load_50_concurrent.py    # Acceptance Criteria: 50 concurrent pipeline load test
    ├── test_rate_limit_simulation.py # Acceptance Criteria: Rate-limit key rotation & fallback verification
    └── test_autodev_integration.py   # R4 Integration tests with AutoDev agent mocks
```

### 6.2 Core Class Signatures & Interfaces

#### `autodev_balancer.models`
```python
class StageEnum(str, Enum):
    REQUIREMENTS = "REQUIREMENTS"
    DECOMPOSITION = "DECOMPOSITION"
    DESIGN = "DESIGN"
    CODEGEN = "CODEGEN"
    CRITIC_CORRECTNESS = "CRITIC_CORRECTNESS"
    CRITIC_ARCHITECTURE = "CRITIC_ARCHITECTURE"
    CRITIC_COMPLETENESS = "CRITIC_COMPLETENESS"
    ADJUDICATOR = "ADJUDICATOR"
    INTEGRATION = "INTEGRATION"
    DOCUMENTATION = "DOCUMENTATION"

class ModelTier(str, Enum):
    PRIMARY_GEMINI = "gemini-3.6-flash"
    SECONDARY_GEMINI = "gemini-3.5-flash"
    MISTRAL_PRIMARY = "mistral-small-latest"
```

#### `autodev_balancer.client.AutoDevLLMClient`
```python
class AutoDevLLMClient:
    def __init__(self, config: Optional[BalancerConfig] = None):
        """Initializes Gemini Key Pool (6 keys) and Mistral Registry (1 key)."""
        ...

    def generate_content(
        self,
        stage: Union[str, StageEnum],
        contents: Any,
        system_instruction: Optional[str] = None,
        response_schema: Optional[Type[BaseModel]] = None,
        temperature: float = 0.2,
        preferred_model: Optional[str] = None
    ) -> Any:
        """
        Executes synchronous generation with automatic key balancing, 
        strict stage isolation for Mistral, and full 6-key fallback matrix.
        """
        ...

    def generate_content_stream(
        self,
        stage: Union[str, StageEnum],
        contents: Any,
        system_instruction: Optional[str] = None,
        response_schema: Optional[Type[BaseModel]] = None,
        temperature: float = 0.2,
        preferred_model: Optional[str] = None
    ) -> Iterator[str]:
        """
        Executes streaming generation yielding text chunks, with transparent
        failover to next key / secondary model if failure occurs at stream init.
        """
        ...

    def get_metrics_report(self) -> BalancerMetricsReport:
        """Returns distribution report and telemetry for all keys and models."""
        ...
```

---

## 7. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| F1 | Key Pool | Multi-Format Key Discovery | Automatically discovers 6 Gemini keys and 1 Mistral key from comma-separated list, numbered env vars, or legacy stage env vars. | Environment variables (`.env`, `os.environ`) | `GeminiKeyPool` (6 keys), `MistralKeyRegistry` (1 key) | Raises `ConfigurationError` if insufficient distinct keys found in strict mode. | `ORIGINAL_REQUEST.md` & `backend/.env` |
| F2 | Load Balancing | Least-Connections Fair-Share Balancer | Dispatches Gemini requests to the healthy key with minimum active in-flight requests and lowest cumulative count. | Incoming request (`stage`, `payload`) | Leased `KeyRecord` | Skips keys in cooldown; raises `AllKeysExhaustedError` if 0 healthy keys. | `ORIGINAL_REQUEST.md` R1 |
| F3 | Load Balancing | Smooth Round-Robin & LRU Strategy | Alternative configurable balancing strategies for predictable cyclic rotation and least-recently-used dispatch. | Strategy enum (`StrategyEnum.ROUND_ROBIN` / `LRU`) | Next healthy `KeyRecord` | Bypasses exhausted keys; thread-safe atomic pointer update. | Algorithmic Survey |
| F4 | Isolation | Cryptographic / Stage Authorization Gate | Strictly restricts `MISTRAL_API_KEY` dispensation exclusively to `CRITIC_ARCHITECTURE`. | `stage: StageEnum` | Mistral raw key | Raises `KeyAccessDeniedError` for any non-architecture stage. | `ORIGINAL_REQUEST.md` R2 |
| F5 | Fallback Matrix | 6-Key Primary Model Rotation | Upon 429 rate limit on `gemini-3.6-flash`, rotates through all 6 Gemini keys before downgrading model. | Failed request, HTTP 429 | Retry response from alternate key on `gemini-3.6-flash` | Moves to Tier 2 only after all 6 keys fail. | `ORIGINAL_REQUEST.md` R3 |
| F6 | Fallback Matrix | Secondary Model Degradation Gate | Transitions to `gemini-3.5-flash` only when all 6 primary keys are exhausted. Rotates across all 6 keys on 3.5. | Exhaustion signal across all 6 keys | Degraded response using `gemini-3.5-flash` | Raises `AllKeysExhaustedError` if all 6 keys fail on 3.5 as well. | `ORIGINAL_REQUEST.md` R3 |
| F7 | Error Handling | Error Classification & Fast-Fail | Distinguishes transient rate limits (429/503) from permanent request errors (400/schema violation) to prevent useless key burning. | Caught `Exception` | Error classification enum | Fast-fails permanent errors without retrying. | `backend/autodev_pipeline/fault_tolerance.py` |
| F8 | Streaming | Failover Streaming Generator | Wraps `generate_content_stream` with transparent key failover on stream initiation failure. | Stream generator call | Iterator yielding text chunks and usage tokens | Yields error payload if all fallback tiers fail. | `backend/agents/*.py` |
| F9 | Observability | Real-Time Metrics & Distribution Reporter | Tracks per-key requests, failures, in-flight load, standard deviation, and fairness index. | Telemetry query | `BalancerMetricsReport` (JSON/Dict) | Always succeeds (in-memory lock-protected). | `ORIGINAL_REQUEST.md` AC |
| F10 | Backend Adapter | Drop-in AutoDev Integration Adapter | Provides zero-friction integration for AutoDev agents, replacing scattered `genai.Client` instances. | AutoDev Agent calls | Pydantic model or streaming text | Formats responses to match AutoDev Pydantic schemas. | `backend/agents/` |

---

## 8. Edge Cases & Boundary Conditions

| # | Feature | Input / Scenario | Observed / Expected Behavior |
|---|---|---|---|
| E1 | Key Discovery | `.env` contains duplicate keys across stage variables (e.g. `GEMINI_API_KEY_CODEGEN == GEMINI_API_KEY_INTEGRATION`). | System detects duplicates, logs a warning, and in lenient mode deduplicates to distinct keys; in strict mode requires 6 distinct keys. |
| E2 | Key Discovery | Fewer than 6 Gemini keys defined in environment. | System logs diagnostic warning, operates with available $M < 6$ keys with adjusted rotation, or raises `ConfigurationError` if strict mode enabled. |
| E3 | Load Balancing | 50 concurrent pipeline requests arriving simultaneously within $\le 10\text{ms}$. | Atomic lock ensures concurrent threads acquire keys without race conditions; requests are distributed evenly across keys with $\le 20\%$ variance. |
| E4 | Mistral Isolation | `CODEGEN` agent passes `stage="CODEGEN"` while requesting Mistral model. | Balancer immediately raises `KeyAccessDeniedError`; request is rejected without issuing any network call. |
| E5 | Mistral Isolation | Adversarial caller passes `stage="CRITIC_CORRECTNESS"` or spoofed stage string. | Balancer checks stage against `AUTHORIZED_MISTRAL_STAGES` whitelist; raises `KeyAccessDeniedError`. |
| E6 | Fallback Matrix | Keys 1, 2, 3, 4, 5 hit 429 rate limit on `gemini-3.6-flash`, Key 6 succeeds. | Request succeeds on Key 6 using `gemini-3.6-flash`; model is NOT degraded to `gemini-3.5-flash`. Keys 1-5 placed in cooldown. |
| E7 | Fallback Matrix | All 6 keys hit 429 rate limit on `gemini-3.6-flash`. | Degradation gate opens; balancer switches to `gemini-3.5-flash` and attempts Key 1..6. First available succeeds. |
| E8 | Fallback Matrix | Permanent schema error (HTTP 400 or invalid prompt syntax). | Error classifier marks error as PERMANENT; balancer fails fast immediately without burning remaining keys. |
| E9 | Fallback Matrix | All 6 keys hit 429 on BOTH `gemini-3.6-flash` AND `gemini-3.5-flash`. | Balancer raises `AllKeysExhaustedError` containing comprehensive diagnostic breakdown of all key cooldowns and timestamps. |
| E10 | Streaming | Stream fails mid-transmission after 5 chunks yielded. | Mid-stream failure cannot silently restart without duplicate tokens; raises `StreamInterruptedError` with partial buffer and diagnostic log. |
| E11 | Cooldown Decay | Key 1 in 60s cooldown; 61s elapses. | On next request, key 1's `cooldown_until` is expired; status transitions to `HEALTHY` and key is re-admitted to active balancer pool. |
| E12 | Concurrency | Thread crash while holding an in-flight key lease. | Context manager (`with balancer.lease(stage) as key:`) ensures `active_in_flight` count is decremented in `finally` block even on unhandled exception. |

---

## 9. Acceptance Criteria & Test Verification Plan

The implementation in `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer` and its AutoDev integration will be verified against the following criteria:

| Acceptance Criterion | Verification Method | Pass Threshold |
| :--- | :--- | :--- |
| **AC-1: Programmatic Load-Test Execution** | Run `pytest tests/test_load_50_concurrent.py` | Test suite executes to completion with exit code 0. |
| **AC-2: 50+ Concurrent Pipeline Simulation** | Multi-threaded execution of 50 simultaneous agent requests against mock/live balancer. | All 50 requests successfully acquire leases, execute, and release leases without deadlocks. |
| **AC-3: Even Request Distribution Across 6 Keys** | Inspection of `BalancerMetricsReport.distribution` across Keys 1..6. | Each of the 6 keys processes between 12% and 21% of total requests ($\sigma \le 0.20 \cdot \frac{N}{6}$). Zero keys exhausted. |
| **AC-4: Rate-Limit Key Rotation Before Model Downgrade** | Run `pytest tests/test_rate_limit_simulation.py` with synthetic 429 injection on Keys 1..5. | Request succeeds on Key 6 with model `gemini-3.6-flash`. Zero calls made to `gemini-3.5-flash`. |
| **AC-5: Secondary Model Degradation on Full Exhaustion** | Synthetic 429 injection on all 6 keys for `gemini-3.6-flash`. | Balancer transitions to `gemini-3.5-flash` on Key 1 and succeeds. Degradation event logged. |
| **AC-6: Mistral Key Strict Isolation** | Run `pytest tests/test_mistral_isolation.py` attempting access from non-Architecture stages. | 100% of unauthorized stage calls raise `KeyAccessDeniedError`. Architecture Critic succeeds. |
| **AC-7: Seamless AutoDev Backend Integration** | Integration test importing AutoDev agents with `autodev_balancer`. | All AutoDev agents execute end-to-end without modifying prompt schemas or JSON output formats. |

---

## 10. Conclusion & Recommendations for Implementation Team

1. **Standalone Library First**: Implement `autodev_api_balancer` as a clean, standalone Python library in `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer` with exhaustive unit, concurrency, and simulated rate-limit test suites.
2. **Unified Client Adapter**: Provide an `AutoDevLLMClient` that acts as a drop-in replacement for both `genai.Client` and `Mistral`, simplifying agent refactoring.
3. **Thread-Safe Context Manager**: Use Python context managers (`with client.lease(...) as key:`) to ensure guaranteed cleanup of in-flight counters under all crash scenarios.
4. **Integration**: Update `backend/agents/*.py`, `backend/orchestrator.py`, and `backend/main.py` to route all LLM invocations through `AutoDevLLMClient`.
