# Original User Request

## Initial Request — 2026-08-28T19:08:08Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: small, focused team

This is a single self-contained design task; keep it small and focused. Design a robust pipeline algorithm for a multi-agent development system that prevents crashes, deadlocks, and overlapping tasks across concurrent components. The primary deliverable is a detailed algorithmic design document for the user to evaluate before implementation.

Working directory: ~/teamwork_projects/autodev_pipeline_algo
Integrity mode: development

## Requirements

### R1. State and Concurrency Management
Design an algorithm that governs how components move through stages (e.g., Design, Code, Execute/Critics). It must strictly enforce that no two components can occupy the same pipeline stage simultaneously.

### R2. Edge Case and Crash Prevention
The algorithm must explicitly define how to handle dependency resolution, circular dependencies, and stage timeouts or failures, ensuring the pipeline gracefully recovers or safely stalls without corrupting the state.

## Verification Resources
The algorithm must be evaluated using an independent agent-as-judge model applying a strict adversarial rubric.

## Acceptance Criteria

### Algorithmic Robustness (Adversarial Review)
- [ ] An independent adversarial agent has reviewed the algorithm step-by-step and confirms there are no race conditions or deadlocks.
- [ ] The algorithm provides an explicit, objective mechanism (e.g., locks, queues, DAGs) that prevents task overlap for shared stages.
- [ ] The design document clearly outlines recovery mechanisms for pipeline crashes or stalled components.

## Follow-up — 2026-08-29T07:10:58Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team

Design and implement a smart API key management system for AutoDev to load-balance 6 Gemini keys, reserve 1 Mistral key strictly for the architecture critic, and implement robust model fallbacks to avoid rate limits.

Working directory: ~/teamwork_projects/autodev_api_balancer
Integrity mode: development

## Requirements

### R1. Key Allocation & Load Balancing
The system must manage a pool of 6 Gemini API keys, intelligently tracking and rotating them to distribute request loads evenly across the AutoDev pipeline. The specific state-tracking mechanism (e.g., in-memory vs. DB) is up to the implementation team.

### R2. Strict Key Reservation
The system must ensure that the 1 provided Mistral API key is strictly isolated and exclusively dispensed to the Architecture Critic stage. It cannot be used for any other pipeline tasks.

### R3. Robust Fallback Matrix
The fallback strategy must strictly attempt to route a failed/rate-limited request to another available Gemini key using the primary model (`gemini-3.6-flash`) first. Only if all keys for the primary model are exhausted should it gracefully degrade to the secondary model (`gemini-3.5-flash`).

### R4. Full Implementation
The team must design the architecture and then immediately fully implement the Python modules to handle this logic, ready for integration into the AutoDev backend.

## Acceptance Criteria

### Programmatic Verification
- [ ] A programmatic Python load-test script exists and can be executed.
- [ ] The load test successfully simulates at least 50 concurrent pipeline requests.
- [ ] The load test outputs a distribution report proving that requests are evenly distributed across the 6 Gemini keys without exhausting a single key.
- [ ] A simulated rate-limit test successfully proves the fallback logic routes to another primary key before downgrading to 3.5-flash.
- [ ] A test asserts that the Mistral key is never dispensed to a non-Architecture Critic component.
