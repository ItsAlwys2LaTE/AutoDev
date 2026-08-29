# Handoff Report: AutoDev API Key Balancer Testing & Verification Suite Architecture

**Agent:** Testing & Verification Survey Explorer (`explorer_test_survey`)  
**Working Directory:** `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\explorer_test_survey`  
**Date:** 2026-08-29  
**Handoff Type:** Hard Handoff (Task Complete)  

---

## 1. Observation

1. **Authoritative Requirements in `ORIGINAL_REQUEST.md` (Follow-up 2026-08-29T07:10:58Z lines 42–69)**:
   - "Design and implement a smart API key management system for AutoDev to load-balance 6 Gemini keys, reserve 1 Mistral key strictly for the architecture critic, and implement robust model fallbacks to avoid rate limits."
   - "Working directory: ~/teamwork_projects/autodev_api_balancer"
   - Acceptance criteria explicitly mandates:
     * A programmatic Python load-test script exists and can be executed.
     * The load test simulates at least 50 concurrent pipeline requests.
     * Output distribution report proving even load distribution across 6 Gemini keys without exhausting a single key.
     * Simulated rate-limit test proving fallback logic routes to another primary key before downgrading to 3.5-flash.
     * Test asserting Mistral key is never dispensed to a non-Architecture Critic component.

2. **Existing AutoDev Key Management & LLM Calls in `backend/`**:
   - `backend/agents/critics.py:19-20, 78, 123, 157-158`: Correctness and Completeness critics read `GEMINI_API_KEY_CRITICS` / `GEMINI_API_KEY_ADJUDICATOR`; Architecture critic reads `MISTRAL_API_KEY` (with ad-hoc fallback to `GEMINI_API_KEY_ADJUDICATOR` and `gemini-3.5-flash-lite`).
   - `backend/agents/codegen_agent.py:15`: Reads `GEMINI_API_KEY_CODEGEN`.
   - `backend/agents/design_agent.py:18`: Reads `GEMINI_API_KEY_DESIGN`.
   - `backend/agents/master_architect.py:10`: Reads `GEMINI_API_KEY_ADJUDICATOR`.
   - `backend/agents/requirements_agent.py:15`: Reads `GEMINI_API_KEY_REQUIREMENTS`.
   - `backend/agents/integrator_agent.py:17`: Reads `GEMINI_API_KEY_INTEGRATION`.
   - `backend/agents/documentation_agent.py:16`: Reads `GEMINI_API_KEY_REQUIREMENTS`.
   - Observation: Keys were partitioned by hardcoded role without load balancing or inter-key pooling.

3. **Existing Concurrency & Infrastructure**:
   - AutoDev uses FastAPI with multithreaded / asynchronous execution, where LangGraph executes 3 parallel critics simultaneously (`backend/orchestrator.py:100-124`), generating bursts of 3 simultaneous LLM requests per component.

---

## 2. Logic Chain

1. **Load Balancing & Statistical Rigor (R1)**:
   - *Premise (from Observation 1)*: 50+ concurrent requests must be distributed evenly across 6 Gemini keys.
   - *Inference*: Deterministic algorithms like Weighted Round-Robin and Least-Connections with atomic in-flight tracking guarantee uniform request dispersal.
   - *Verification Metric*: Under uniform request generation across 6 keys ($E_i = N/6$), we enforce Pearson Chi-Square ($\chi^2 = \sum \frac{(O_i - E_i)^2}{E_i} \le 11.070$ for $df=5, \alpha=0.05$), Coefficient of Variation ($CV = \frac{\sigma}{\mu} \le 0.15$), and Max/Min ratio $\le 1.30$.

2. **Strict Mistral Key Isolation (R2)**:
   - *Premise (from Observation 1 & 2)*: Mistral key must be strictly isolated to Architecture Critic (`StageEnum.CRITIC_ARCHITECTURE`).
   - *Inference*: An isolation guard must check the requesting stage enum/token prior to granting a lease. Any non-architecture stage (e.g. `DESIGN`, `CODEGEN`, `DOCUMENTATION`, `CRITIC_CORRECTNESS`) must raise `StrictStageIsolationViolation` and dispense 0 tokens.
   - *Verification Method*: Parameterized unit tests across all 9 non-architecture stages plus high-concurrency fuzz testing (1000 randomized concurrent requests) asserting 0 leaks.

3. **Fallback Matrix & Rotation Priority (R3)**:
   - *Premise (from Observation 1)*: Primary model (`gemini-3.6-flash`) must rotate across all available Gemini keys on 429/timeout before downgrading to `gemini-3.5-flash`.
   - *Inference*: A 2-level hierarchical state machine is required: Level 1 exhausts healthy keys on Primary Model; Level 2 exhausts healthy keys on Secondary Model.
   - *Verification Method*: Mock backend injecting 429 rate limits on Keys 1..5, verifying that Key 6 executes on `gemini-3.6-flash`, and that secondary model `gemini-3.5-flash` is only invoked when all 6 keys fail on primary.

4. **Multi-Tier Test Architecture (R4)**:
   - *Inference*: Structuring tests into 4 distinct tiers (Tier 1: Feature Coverage, Tier 2: Boundary/Edge Cases, Tier 3: Cross-Feature Interactions, Tier 4: Real-World 50+ Concurrent Load Harness) provides 100% coverage across unit, integration, stress, and statistical requirements.

---

## 3. Caveats

1. **Network Simulation vs Live Cloud APIs**: Live Google Gemini and Mistral APIs have dynamic, fluctuating server-side rate limits and network latency. The verification suite relies primarily on high-fidelity mock backends (`MockLLMBackend`) with configurable latencies and error triggers to ensure deterministic, reproducible test execution in automated CI pipelines without incurring LLM API costs.
2. **Environment Variable Configuration**: When running in live production, the balancer can discover either structured indexed keys (`GEMINI_API_KEY_1` .. `_6`) or legacy AutoDev role-based environment variables (`GEMINI_API_KEY_CODEGEN`, etc.) seamlessly.

---

## 4. Conclusion

The testing architecture and programmatic verification specification for `autodev_api_balancer` is fully planned and documented in `survey_testing.md`. 

Key deliverables established:
1. **4-Tier Test Architecture**:
   - Tier 1: 12 Feature Coverage unit & integration tests.
   - Tier 2: 12 Boundary & Edge Case tests.
   - Tier 3: 8 Cross-Feature combination & cascade tests.
   - Tier 4: Real-world 50+ concurrent request load test harness with statistical distribution reporting.
2. **Programmatic Load Test Harness (`load_test_harness.py` / `run_balancer_tests.py`)**:
   - Simulates $\ge 50$ concurrent multi-agent requests across Design, Code, Critics, and Integration stages.
   - Computes Chi-Square goodness-of-fit ($\chi^2 \le 11.070$), $CV \le 0.15$, and Max/Min spread $\le 1.30$.
3. **Acceptance Verification Assertions**:
   - Dedicated assertion proving primary key rotation before `gemini-3.5-flash` downgrade.
   - Dedicated assertion proving 100% strict isolation of the Mistral API key from non-architecture callers.

---

## 5. Verification Method

To independently verify the test survey specification:
1. Inspect the survey report at `c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\.agents\explorer_test_survey\survey_testing.md`.
2. Verify that all 5 acceptance criteria from `ORIGINAL_REQUEST.md` (lines 64–68) are directly mapped to specific test cases in Section 10 (Traceability Matrix).
3. Verify that the load test harness pseudo-code in Section 6 implements Chi-Square distribution calculations and concurrent thread pool execution.
4. Verify that Section 7 provides exact pytest implementations for both primary key rotation before downgrade and strict Mistral isolation.
