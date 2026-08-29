# E2E Test Infra: AutoDev API Key Balancer (`autodev_api_balancer`)

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on internal implementation private variables.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + High-Concurrency Workload Testing.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | Configuration & Key Discovery | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Core Models & Enums | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Strict Mistral Stage Reservation Guard | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 4 | Thread-Safe Key Pool Manager | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Pluggable Load-Balancing Strategies | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 6 | Cooldown & Health State Tracking | ORIGINAL_REQUEST §R1, R3 | 5 | 5 | ✓ | ✓ |
| 7 | Multi-Tier Fallback Matrix Engine | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 8 | Architecture Critic Fallback Route | ORIGINAL_REQUEST §R2, R3 | 5 | 5 | ✓ | ✓ |
| 9 | Unified AutoDev LLM Client Facade | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: `pytest` and programmatic runner `tests/run_all_verifications.py`.
- Load Test Runner: `python tests/load_test_harness.py --concurrency 50 --requests 300`.
- Directory Layout: `C:\Users\Anupam Sharma\teamwork_projects\autodev_api_balancer\tests\`

## Acceptance Criteria Thresholds & Invariants
1. **Concurrency**: Programmatic load test simulating $\ge 50$ concurrent requests across AutoDev stages.
2. **Distribution**: Statistical fairness metric verifying even distribution across the 6 Gemini keys:
   - Chi-Square test: $\chi^2 \le 11.070$ ($p \ge 0.05$, $df=5$)
   - Coefficient of Variation: $CV \le 0.15$
   - Spread ratio: $\max(requests)/\min(requests) \le 1.30$
3. **Primary Model Exhaustion Rotation**: When rate limits/errors occur, the fallback matrix MUST rotate across all 6 Gemini keys on primary model `gemini-3.6-flash` before issuing any lease for secondary model `gemini-3.5-flash`.
4. **Strict Mistral Isolation**: Assert that 0 Mistral tokens are dispensed to non-Architecture Critic components under any circumstances (with $100\%$ rejection rate for unauthorized stages).
