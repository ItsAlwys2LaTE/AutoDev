# Project: AutoDev API Key Management and Load Balancer (`autodev_api_balancer`)

## Architecture
The AutoDev API Key Balancer is a modular, high-throughput, thread-safe Python subsystem designed for multi-agent software engineering pipelines. It provides intelligent load balancing across 6 Gemini API keys, strict isolation of 1 Mistral API key for the Architecture Critic stage, a multi-tier fallback matrix (primary `gemini-3.6-flash` rotated across all 6 keys before degrading to secondary `gemini-3.5-flash`), and drop-in integration wrappers for the AutoDev backend.

```
+------------------------------------------------------------------------------------------------+
|                                    AutoDev Pipeline Stages                                     |
|  [Requirements]  [Design]  [CodeGen]  [Architecture Critic]  [Integration]  [Documentation]    |
+------------------------------------+--------------------------+--------------------------------+
                                     |                          |
                                     v                          v
+------------------------------------------------------------------------------------------------+
|                         autodev_balancer Facade Layer (AutoDevLLMClient)                       |
|           - Synchronous JSON & Streaming Text generation                                       |
|           - Context injection (StageEnum, SubTask, ComponentID)                                |
+------------------------------------+-----------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------------------------------+
|                               Strict Stage Reservation Guard                                   |
|   - Validates caller StageEnum                                                                 |
|   - Strictly restricts Mistral key to StageEnum.CRITIC_ARCHITECTURE (raises StageAccessDenied) |
|   - Prevents any non-critic or Gemini stage from accessing Mistral                             |
+------------------------------------+-----------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------------------------------+
|                                  Fallback Matrix Engine                                        |
|   - Tier 1: Primary Model (`gemini-3.6-flash`) rotated across all 6 Gemini keys on 429/error   |
|   - Tier 2: Secondary Model (`gemini-3.5-flash`) across keys ONLY when all 6 primary exhausted  |
|   - Tier 3: Architecture Critic: Mistral -> Gemini Pool fallback                               |
|   - Emits structured ExecutionTelemetry & Audit Traces                                         |
+------------------------------------+-----------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------------------------------+
|                            Thread-Safe In-Memory Key Pool Manager                              |
|   - 6 Gemini Keys + 1 Mistral Key Records                                                      |
|   - Strategies: Least-Connections (default), Weighted Round-Robin, LRU, Token-Bucket           |
|   - Dynamic Cooldown Windows with Exponential Backoff & Self-Healing Decay                     |
|   - Sub-millisecond threading.RLock & asyncio.Lock synchronization                             |
+------------------------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Configuration & Key Discovery | Resilient loader for 6 Gemini keys + 1 Mistral key from comma-separated, numbered, or legacy AutoDev env vars | M1 | Survey / R1 |
| 2 | Core Domain Models & Enums | Enums (`StageEnum`, `ProviderEnum`, `ModelNameEnum`, `KeyStatus`) and records (`APIKeyRecord`, `LeaseToken`, `ExecutionTelemetry`) | M1 | Survey / R1 |
| 3 | Strict Mistral Stage Reservation Guard | Isolation gate enforcing Mistral key dispensation exclusively to `CRITIC_ARCHITECTURE`, raising `StageAccessDeniedError` on violations | M1 | Survey / R2 |
| 4 | Thread-Safe Key Pool Manager | Centralized pool with atomic acquire/release context manager and in-flight accounting under 50+ concurrency | M2 | Survey / R1 |
| 5 | Pluggable Load-Balancing Strategies | Least-Connections with tie-breaking (default), Weighted Round-Robin, LRU, and Token-Bucket strategies | M2 | Survey / R1 |
| 6 | Cooldown & Health State Tracking | Exponential backoff for 429/5xx errors, self-healing cooldown timestamp decay, error categorization | M2 | Survey / R1, R3 |
| 7 | Multi-Tier Fallback Matrix Engine | Sequential rotation across 6 Gemini keys on `gemini-3.6-flash` before gracefully degrading to `gemini-3.5-flash` | M3 | Survey / R3 |
| 8 | Architecture Critic Fallback Route | Primary execution on Mistral with failover to Gemini key pool on rate limits | M3 | Survey / R2, R3 |
| 9 | Unified AutoDev LLM Client Facade | Drop-in `AutoDevLLMClient` with sync JSON validation and streaming chunk generator for AutoDev backend integration | M3 | Survey / R4 |
| 10 | Tier 1 Feature Coverage Tests | Unit tests for pool initialization, lease context manager, balancing algorithms, and stage routing | M4 | Survey / Acceptance |
| 11 | Tier 2 Boundary & Corner Case Tests | Tests for pool exhaustion, invalid stage tokens, burst stampedes, cooldown expiry, and exception safety | M4 | Survey / Acceptance |
| 12 | Tier 3 Cross-Feature Combination Tests | Multi-stage pipeline concurrency, parallel critics contention, cascade failovers during load surges | M4 | Survey / Acceptance |
| 13 | AutoDev Backend Integration Adapters | Drop-in adapter module connecting AutoDev agents (`requirements_agent`, `design_agent`, `codegen_agent`, `critics`) to balancer | M4 | Survey / R4 |
| 14 | Tier 4 High-Concurrency Load Test Harness | Standalone load-test simulating >=50 concurrent pipeline requests with mock LLM backend | M5 | Survey / Acceptance |
| 15 | Statistical Distribution Reporting | Distribution report calculating Chi-Square goodness-of-fit, CV <= 0.15, and spread ratios across 6 Gemini keys | M5 | Survey / Acceptance |
| 16 | Primary Key Exhaustion Assertion Test | Programmatic verification asserting rotation of all 6 keys on primary 3.6-flash before downgrade to 3.5-flash | M5 | Survey / Acceptance |
| 17 | Strict Mistral Isolation Assertion Test | Empirical verification asserting 0 Mistral tokens dispensed to non-Architecture Critic stages | M5 | Survey / Acceptance |
| 18 | Final E2E Test Pass & Coverage Hardening (Tier 5) | 100% pass of all test tiers, adversarial challenger audit, zero gaps, clean forensic audit | M6 | Survey / Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Models, Config & Reservation Guard | `models.py`, `config.py`, `exceptions.py`, `guard.py` | none | PLANNED |
| M2 | Key Pool, Strategies & Health | `pool.py`, `strategies.py`, `health.py` | M1 | PLANNED |
| M3 | Fallback Engine & Unified Client | `fallback.py`, `client.py`, `router.py`, `telemetry.py` | M1, M2 | PLANNED |
| M4 | E2E Tests (Tiers 1-3) & Backend Adapters | `tests/test_tier1_*.py`, `tests/test_tier2_*.py`, `tests/test_tier3_*.py`, `autodev_balancer/adapter.py` | M1, M2, M3 | PLANNED |
| M5 | 50+ Concurrent Load Test & Assertions (Tier 4) | `tests/load_test_harness.py`, `tests/run_all_verifications.py` | M1, M2, M3, M4 | PLANNED |
| M6 | Final Verification & Adversarial Hardening (Tier 5) | Full test execution, coverage audit, adversarial edge cases, forensic integrity audit | M1, M2, M3, M4, M5 | PLANNED |

## Interface Contracts
### `autodev_balancer.models`
- `StageEnum`: `REQUIREMENTS`, `MASTER_ARCHITECT`, `DESIGN`, `CODEGEN`, `CRITIC_CORRECTNESS`, `CRITIC_ARCHITECTURE`, `CRITIC_COMPLETENESS`, `ADJUDICATOR`, `INTEGRATOR`, `DOCUMENTATION`
- `ProviderEnum`: `GEMINI = "gemini"`, `MISTRAL = "mistral"`
- `ModelNameEnum`: `GEMINI_3_6_FLASH = "gemini-3.6-flash"`, `GEMINI_3_5_FLASH = "gemini-3.5-flash"`, `MISTRAL_SMALL = "mistral-small-latest"`
- `KeyStatus`: `ACTIVE = "active"`, `COOLDOWN = "cooldown"`, `RATE_LIMITED = "rate_limited"`, `DISABLED = "disabled"`
- `RequestContext`: `stage: StageEnum`, `sub_task: Optional[str]`, `component_id: Optional[str]`, `request_id: str`

### `autodev_balancer.guard`
- `StrictStageReservationGuard.validate_access(stage: StageEnum, provider: ProviderEnum) -> None` (Raises `StageAccessDeniedError` if `provider == ProviderEnum.MISTRAL and stage != StageEnum.CRITIC_ARCHITECTURE`)

### `autodev_balancer.pool`
- `KeyPoolManager.acquire_key(provider: ProviderEnum, context: RequestContext, model: Optional[str] = None, exclude_key_ids: Optional[Set[str]] = None) -> LeaseToken`
- `KeyPoolManager.release_key(lease: LeaseToken, success: bool = True, error: Optional[Exception] = None) -> None`
- `KeyPoolManager.get_pool_status() -> Dict[str, Any]`

### `autodev_balancer.fallback`
- `FallbackMatrixEngine.execute_with_fallback(stage: StageEnum, prompt: str, system_instruction: Optional[str] = None, generation_config: Optional[Dict] = None, streaming: bool = False, caller_fn: Optional[Callable] = None) -> FallbackResult`

### `autodev_balancer.client`
- `AutoDevLLMClient.generate_content(stage: StageEnum, prompt: str, schema: Optional[Type[BaseModel]] = None, **kwargs) -> Any`
- `AutoDevLLMClient.generate_content_stream(stage: StageEnum, prompt: str, **kwargs) -> Iterator[str]`

## Code Layout
```
C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer\
├── autodev_balancer/
│   ├── __init__.py
│   ├── models.py             # Enums, Data classes, RequestContext, LeaseToken
│   ├── exceptions.py         # StageAccessDeniedError, AllKeysExhaustedError, etc.
│   ├── config.py             # Resilient key discovery and configuration loader
│   ├── guard.py              # Strict Stage Reservation Guard
│   ├── health.py             # Health tracker, exponential cooldown & backoff
│   ├── strategies.py         # Least-Connections, Weighted Round-Robin, LRU, Token-Bucket
│   ├── pool.py               # Thread-safe KeyPoolManager with RLock & in-flight tracking
│   ├── fallback.py           # Multi-tier Fallback Matrix Engine
│   ├── router.py             # Request router mapping stages & providers
│   ├── client.py             # Unified AutoDevLLMClient facade (sync & streaming)
│   ├── adapter.py            # Drop-in compatibility layer for AutoDev backend
│   └── telemetry.py          # Metrics, distribution calculations & reporting
├── tests/
│   ├── __init__.py
│   ├── conftest.py           # Pytest fixtures, mock LLM backends & key pools
│   ├── test_tier1_features.py       # Tier 1: Feature coverage unit tests
│   ├── test_tier2_boundaries.py     # Tier 2: Boundary & corner case tests
│   ├── test_tier3_combinations.py   # Tier 3: Cross-feature interaction tests
│   ├── load_test_harness.py         # Tier 4: >=50 concurrent requests load test
│   └── run_all_verifications.py     # Master runner checking all acceptance criteria
├── pyproject.toml / setup.py
└── README.md
```
