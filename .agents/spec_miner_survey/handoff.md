# 5-Component Handoff Report: AutoDev API Key Balancer Specification Mining

**Agent:** Spec Miner (`spec_miner_survey`)  
**Parent Agent:** `4c811fbd-d1b3-4bb4-919c-10f5990b2db1`  
**Timestamp:** 2026-08-29T12:44:30+05:30  
**Deliverable Path:** `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\spec_miner_survey\survey_requirements.md`  
**Target Project Location:** `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer`

---

### 1. Observation

1. **Authoritative Request (`ORIGINAL_REQUEST.md`, lines 34–69)**:
   - Follow-up directive dated `2026-08-29T07:10:58Z` mandates designing and implementing a smart API key management system for AutoDev to load-balance 6 Gemini keys, reserve 1 Mistral key strictly for the architecture critic, and implement robust model fallbacks to avoid rate limits.
   - Mandated primary model is `gemini-3.6-flash`; mandated secondary fallback model is `gemini-3.5-flash`.
   - Primary model `gemini-3.6-flash` must rotate across all 6 Gemini keys on failure/rate limit before degrading to `gemini-3.5-flash`.
   - Acceptance criteria require a programmatic Python load-test script simulating $\ge 50$ concurrent requests, verifying even distribution across the 6 Gemini keys, simulated rate-limit fallback across all primary keys before 3.5-flash downgrade, and an assertion proving the Mistral key is never dispensed to a non-Architecture Critic component.

2. **Environment & Key Configuration (`backend/.env`, lines 1–8)**:
   - Discovered 6 Gemini API keys mapped to legacy stage roles:
     `GEMINI_API_KEY_REQUIREMENTS` (line 1)
     `GEMINI_API_KEY_DESIGN` (line 2)
     `GEMINI_API_KEY_CODEGEN` (line 3)
     `GEMINI_API_KEY_CRITICS` (line 4)
     `GEMINI_API_KEY_ADJUDICATOR` (line 5)
     `GEMINI_API_KEY_INTEGRATION` (line 7)
   - Discovered 1 Mistral API key: `MISTRAL_API_KEY` (line 6).

3. **AutoDev Backend LLM Invocation Points**:
   - `backend/agents/requirements_agent.py` (lines 15–73): `GEMINI_API_KEY_REQUIREMENTS`, streaming `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/agents/master_architect.py` (lines 10–91): `GEMINI_API_KEY_ADJUDICATOR`, streaming `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/agents/design_agent.py` (lines 18–95): `GEMINI_API_KEY_DESIGN`, streaming `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/agents/codegen_agent.py` (lines 15–96): `GEMINI_API_KEY_CODEGEN`, streaming `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/agents/critics.py` (lines 15–220):
     - `evaluate_correctness` (lines 15–73): `GEMINI_API_KEY_CRITICS` / `GEMINI_API_KEY_ADJUDICATOR`, synchronous `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
     - `evaluate_architecture` (lines 74–150): `MISTRAL_API_KEY`, synchronous `mistral-small-latest` $\to$ fallback to Gemini `GEMINI_API_KEY_ADJUDICATOR` (`gemini-3.5-flash-lite`).
     - `evaluate_completeness` (lines 154–220): `GEMINI_API_KEY_CRITICS` / `GEMINI_API_KEY_ADJUDICATOR`, synchronous `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/orchestrator.py` (lines 34–85): `node_adjudicator`, synchronous `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/agents/integrator_agent.py` (lines 17–129): `GEMINI_API_KEY_INTEGRATION`, streaming `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/agents/documentation_agent.py` (lines 16–82): `GEMINI_API_KEY_REQUIREMENTS`, streaming `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.
   - `backend/main.py` (lines 142–198): `api_parse_requirements` and `api_parse_blueprint`, synchronous `gemini-3.6-flash` $\to$ `gemini-3.5-flash-lite`.

---

### 2. Logic Chain

1. **Load Balancing & Pool Management (R1)**:
   - *Observation*: Individual agents are statically tied to single environment variables, causing `GEMINI_API_KEY_CODEGEN` and `GEMINI_API_KEY_CRITICS` to experience severe hotspotting while other keys remain idle.
   - *Deduction*: A centralized `GeminiKeyPool` holding all 6 keys with thread-safe state tracking (`total_requests`, `active_in_flight`, `rate_limited_count`, `cooldown_until`) combined with a Least-Connections / Weighted Round-Robin `KeyBalancer` is required to distribute load evenly and eliminate single-key starvation.

2. **Mistral Isolation & Stage Authorization (R2)**:
   - *Observation*: `MISTRAL_API_KEY` is present in `.env` and currently called only in `evaluate_architecture`, but without runtime access control.
   - *Deduction*: To strictly enforce R2 ("strictly isolated and exclusively dispensed to the Architecture Critic stage"), the key manager must implement a dedicated `MistralKeyRegistry` with mandatory `StageEnum` validation. Any call from non-Architecture Critic stages must immediately raise `KeyAccessDeniedError`.

3. **Fallback Matrix & Degradation Gate (R3)**:
   - *Observation*: Current agent code immediately falls back to `gemini-3.5-flash-lite` on the *same key* upon a 429 error.
   - *Deduction*: To satisfy R3, the fallback engine must first attempt rotation across all other available Gemini keys ($K_1 \dots K_6$) using `gemini-3.6-flash`. Only when all 6 keys are in rate-limit cooldown or exhausted on `gemini-3.6-flash` does the engine transition to `gemini-3.5-flash` across the pool.

4. **Integration & API Architecture (R4)**:
   - *Observation*: AutoDev backend agents use two distinct calling patterns: streaming (`generate_content_stream` yielding chunks and token usage) and synchronous structured JSON validation (`generate_content` with `response_schema`).
   - *Deduction*: The `autodev_balancer` library must provide a unified `AutoDevLLMClient` that implements both `generate_content` and `generate_content_stream` with transparent key failover, error classification, and automatic telemetry reporting.

---

### 3. Caveats

1. **Live Gemini Quota Variations**: Live Google Gemini rate limits depend on project tiers (free tier vs tier 1/2 pay-as-you-go). The balancer uses simulated rate-limiting fixtures for unit/load tests to avoid incurring unnecessary live API costs and to ensure deterministic testing.
2. **Duplicate Keys in Dev Environments**: In development environments, `.env` may contain identical keys across multiple stage variables (e.g. `GEMINI_API_KEY_CODEGEN == GEMINI_API_KEY_INTEGRATION`). The balancer supports a `strict` flag (defaulting to True for production/testing, and lenient deduplication for dev).
3. **Mid-Stream Failover Infeasibility**: If a streaming connection fails *after* several chunks have already been emitted to the client, it cannot transparently restart on another key without causing duplicate content in the downstream consumer. Therefore, streaming failover is applied during connection/initial chunk setup; mid-stream drops raise `StreamInterruptedError`.

---

### 4. Conclusion

The requirement specification and architectural design for the **AutoDev API Key Balancer** have been comprehensively mined, analyzed, and documented in `survey_requirements.md`. All four primary requirements (R1 Key Pool & Balancing, R2 Mistral Isolation, R3 Multi-Tier Fallback Matrix, R4 Module Architecture & Integration) and all five Acceptance Criteria are mapped to exact algorithmic specifications, class interfaces, error models, and verification suites. The project is fully ready for the architecture and implementation phases in `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer`.

---

### 5. Verification Method

1. **Inspect Survey Report**:
   - Path: `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\spec_miner_survey\survey_requirements.md`
   - Verify Sections 1–10, including Features Discovered Table, Edge Cases Table, and Acceptance Criteria Mapping.
2. **Inspect Briefing & Progress**:
   - `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\spec_miner_survey\BRIEFING.md`
   - `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\spec_miner_survey\progress.md`
3. **Verify Existing AutoDev Codebase References**:
   - `backend/.env` (6 Gemini keys, 1 Mistral key)
   - `backend/agents/critics.py` (evaluate_architecture vs evaluate_correctness/completeness)
   - `backend/agents/codegen_agent.py` and `backend/agents/design_agent.py`
