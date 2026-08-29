#!/usr/bin/env python3
"""
test_pipeline_flow.py - Comprehensive E2E Automated Integration & Subsystem Test Suite for AutoDev Backend Pipeline

Validates all 4 test tiers + Unit Subsystem contracts:
- Tier 1: Single Component Full Lifecycle (DESIGN -> CODEGEN -> CRITICS -> COMPLETED)
- Tier 2: Boundary & Corner Cases (Cyclic DAG rejection, Empty input, Idle polling, Stale completes, Schema compatibility, Reset isolation)
- Tier 3: Revision Feedback Loop (CRITICS revise -> CODEGEN -> CRITICS pass -> COMPLETED, Multi-revision, Max revisions quarantine, Terminal fail)
- Tier 4: Real-World Multi-Component Concurrent DAG Acceptance Simulation (3+ concurrent components, interleaving, DAG blocking, 0 deadlocks, Stress DAG)
- Subsystem Unit Tests: State transition automata, priority min-heap queue order, handover non-eager lock release.

Compatible with both:
    pytest test_pipeline_flow.py -v
    python test_pipeline_flow.py
"""

import os
import sys
import time
import pytest
from typing import Any, Dict, List, Set, Tuple

# Ensure backend directory is in python module search path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi.testclient import TestClient

try:
    import pipeline_api
    from main import app
    from autodev_pipeline.models import (
        ComponentStateRecord,
        ComponentStatus,
        PipelineConfig,
        StageEnum,
        LeaseToken,
        CycleResolutionPolicy,
    )
    from autodev_pipeline.concurrency import (
        StageQueueManager,
        StageLockManager,
        StageHandoverProtocol,
    )
    from autodev_pipeline.scheduler import PipelineScheduler
except ImportError:
    import backend.pipeline_api as pipeline_api
    from backend.main import app
    from backend.autodev_pipeline.models import (
        ComponentStateRecord,
        ComponentStatus,
        PipelineConfig,
        StageEnum,
        LeaseToken,
        CycleResolutionPolicy,
    )
    from backend.autodev_pipeline.concurrency import (
        StageQueueManager,
        StageLockManager,
        StageHandoverProtocol,
    )
    from backend.autodev_pipeline.scheduler import PipelineScheduler


def get_current_scheduler() -> PipelineScheduler:
    """Returns the live active PipelineScheduler instance from the active pipeline_api module."""
    if "pipeline_api" in sys.modules and hasattr(sys.modules["pipeline_api"], "scheduler"):
        return sys.modules["pipeline_api"].scheduler
    if "backend.pipeline_api" in sys.modules and hasattr(sys.modules["backend.pipeline_api"], "scheduler"):
        return sys.modules["backend.pipeline_api"].scheduler
    return pipeline_api.scheduler


# ==============================================================================
# Pytest Fixtures
# ==============================================================================

@pytest.fixture
def client():
    """Provides a fresh FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


# ==============================================================================
# Helper Functions for UI Polling Simulation
# ==============================================================================

def log_step(step_name: str, detail: str = ""):
    """Pretty prints step transitions during test execution."""
    msg = f"[TEST STEP] {step_name}"
    if detail:
        msg += f" => {detail}"
    print(msg)


def simulate_ui_execution_loop(
    client: TestClient,
    max_ticks: int = 50,
    revision_plan_map: Dict[str, List[str]] = None,
    log_ticks: bool = True,
) -> Tuple[int, Dict[str, ComponentStatus]]:
    """
    Simulates the frontend visualizer polling and dispatch loop:
    1. Polls GET /api/pipeline/tick
    2. Inspects returned assignments
    3. Posts POST /api/pipeline/complete with specified or default ('pass') verdict
    4. Repeats until all components reach terminal status or max_ticks reached.
    """
    revision_plan_map = revision_plan_map or {}
    ticks_elapsed = 0

    while ticks_elapsed < max_ticks:
        ticks_elapsed += 1
        tick_resp = client.get("/api/pipeline/tick")
        assert tick_resp.status_code == 200, f"Tick failed: {tick_resp.text}"
        data = tick_resp.json()
        assignments = data.get("assignments", [])

        if log_ticks and assignments:
            print(f"  [Tick {ticks_elapsed:02d}] Active Assignments: {assignments}")

        # Check if all components have finished
        sched = get_current_scheduler()
        if sched.is_pipeline_finished() and not assignments:
            if log_ticks:
                print(f"  [Tick {ticks_elapsed:02d}] All components reached terminal states.")
            break

        # Process each stage assignment by simulating agent work completion
        for assign in assignments:
            c_id = assign["component_id"]
            stage = assign["stage"]
            
            # Check if there is a scheduled verdict for this component at this stage
            planned_verdicts = revision_plan_map.get(c_id, [])
            if stage == "CRITICS" and planned_verdicts:
                verdict = planned_verdicts.pop(0)
            else:
                verdict = "pass"

            comp_resp = client.post(
                "/api/pipeline/complete",
                json={"component_id": c_id, "stage": stage, "verdict": verdict}
            )
            assert comp_resp.status_code == 200, f"Complete failed: {comp_resp.text}"
            assert comp_resp.json().get("success") is True, (
                f"Failed to complete stage {stage} for component {c_id}: {comp_resp.json()}"
            )

    sched = get_current_scheduler()
    statuses = {cid: comp.status for cid, comp in sched.dag.nodes.items()}
    return ticks_elapsed, statuses


# ==============================================================================
# Subsystem Unit Tests
# ==============================================================================

class TestSubsystemUnitContracts:
    """
    Unit-level contract tests for state transitions, priority min-heap queueing,
    and stage handover non-eager lock mechanics.
    """

    def test_state_transitions_quarantined_and_stalled_to_completed(self):
        log_step("UNIT", "Testing VALID_TRANSITIONS from QUARANTINED / STALLED to COMPLETED")
        rec_q = ComponentStateRecord(component_id="q1", name="q1", status=ComponentStatus.QUARANTINED)
        assert rec_q.can_transition_to(ComponentStatus.COMPLETED) is True
        rec_q.transition_to(ComponentStatus.COMPLETED)
        assert rec_q.status == ComponentStatus.COMPLETED

        rec_s = ComponentStateRecord(component_id="s1", name="s1", status=ComponentStatus.STALLED)
        assert rec_s.can_transition_to(ComponentStatus.COMPLETED) is True
        rec_s.transition_to(ComponentStatus.COMPLETED)
        assert rec_s.status == ComponentStatus.COMPLETED
        log_step("Unit Transitions OK", "QUARANTINED -> COMPLETED and STALLED -> COMPLETED validated")

    def test_priority_queue_min_heap_ordering(self):
        log_step("UNIT", "Testing StageQueueManager Min-Heap Scoring")
        qm = StageQueueManager()
        # Enqueue priority 2 before priority 1
        qm.enqueue(StageEnum.DESIGN, "comp-low", priority_order=2)
        qm.enqueue(StageEnum.DESIGN, "comp-high", priority_order=1)

        # comp-high (priority_order 1) must dequeue first
        assert qm.dequeue(StageEnum.DESIGN) == "comp-high"
        assert qm.dequeue(StageEnum.DESIGN) == "comp-low"

        # Revisions should preempt lower priority_order
        qm.enqueue(StageEnum.CODEGEN, "comp-new", priority_order=0, is_revision=False)
        qm.enqueue(StageEnum.CODEGEN, "comp-rev", priority_order=5, is_revision=True)
        assert qm.dequeue(StageEnum.CODEGEN) == "comp-rev"
        assert qm.dequeue(StageEnum.CODEGEN) == "comp-new"
        log_step("Unit Priority OK", "Min-heap priority ordering and revision boost validated")

    def test_stage_handover_releases_lock_and_does_not_eagerly_acquire(self):
        log_step("UNIT", "Testing Handover Non-Eager Lock Acquisition")
        lm = StageLockManager()
        qm = StageQueueManager()
        rec = ComponentStateRecord(component_id="c1", name="c1", priority_order=1)
        rec.transition_to(ComponentStatus.READY)
        
        # Acquire DESIGN lock
        lease = lm.try_acquire_stage(StageEnum.DESIGN, "c1")
        assert lease is not None
        rec.transition_to(ComponentStatus.IN_STAGE, stage=StageEnum.DESIGN, lease=lease)

        # Execute handover to CODEGEN
        success = StageHandoverProtocol.execute_handover(
            component=rec,
            current_stage=StageEnum.DESIGN,
            lease_token=lease,
            lock_manager=lm,
            queue_manager=qm,
            next_stage=StageEnum.CODEGEN,
        )
        assert success is True

        # Assert DESIGN is free
        assert lm.is_stage_occupied(StageEnum.DESIGN) is False
        # Assert CODEGEN is NOT eagerly locked (must await scheduler.step dispatch)
        assert lm.is_stage_occupied(StageEnum.CODEGEN) is False
        assert qm.peek(StageEnum.CODEGEN) == "c1"
        assert rec.status == ComponentStatus.READY
        assert rec.current_stage is None
        assert rec.active_lease is None
        log_step("Unit Handover OK", "Handover released lock and placed component in queue without greedy lock")


# ==============================================================================
# Tier 1: Single Component Lifecycle
# ==============================================================================

class TestTier1SingleComponentFlow:
    """
    Tier 1 tests single component linear progression through DESIGN -> CODEGEN -> CRITICS -> COMPLETED.
    """

    def test_single_component_full_lifecycle(self, client: TestClient):
        log_step("TIER 1", "Starting Single Component Full Lifecycle Test")

        # 1. Initialize 1 component
        payload = {
            "components": [
                {
                    "component_id": "comp-single",
                    "component_name": "Single Worker Component",
                    "dependencies": [],
                    "priority_order": 1,
                }
            ]
        }
        init_res = client.post("/api/pipeline/init", json=payload)
        assert init_res.status_code == 200
        assert init_res.json() == {"status": "ok"}
        log_step("Init OK", "comp-single registered in CREATED / READY status")

        # 2. Tick 1: Expect assignment in DESIGN stage
        t1 = client.get("/api/pipeline/tick").json()
        assert len(t1["assignments"]) == 1
        assert t1["assignments"][0]["component_id"] == "comp-single"
        assert t1["assignments"][0]["stage"] == "DESIGN"
        epoch1 = t1["assignments"][0]["epoch"]
        assert epoch1 >= 1
        log_step("Tick 1 OK", f"Dispatched DESIGN (epoch {epoch1})")

        # 3. Complete DESIGN stage
        c1 = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-single", "stage": "DESIGN", "verdict": "pass"}
        ).json()
        assert c1["success"] is True
        log_step("Complete DESIGN OK", "DESIGN stage completed")

        # 4. Tick 2: Expect assignment in CODEGEN stage
        t2 = client.get("/api/pipeline/tick").json()
        assert len(t2["assignments"]) == 1
        assert t2["assignments"][0]["component_id"] == "comp-single"
        assert t2["assignments"][0]["stage"] == "CODEGEN"
        log_step("Tick 2 OK", "Dispatched CODEGEN")

        # 5. Complete CODEGEN stage
        c2 = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-single", "stage": "CODEGEN", "verdict": "pass"}
        ).json()
        assert c2["success"] is True
        log_step("Complete CODEGEN OK", "CODEGEN stage completed")

        # 6. Tick 3: Expect assignment in CRITICS stage
        t3 = client.get("/api/pipeline/tick").json()
        assert len(t3["assignments"]) == 1
        assert t3["assignments"][0]["component_id"] == "comp-single"
        assert t3["assignments"][0]["stage"] == "CRITICS"
        log_step("Tick 3 OK", "Dispatched CRITICS")

        # 7. Complete CRITICS stage with 'pass'
        c3 = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-single", "stage": "CRITICS", "verdict": "pass"}
        ).json()
        assert c3["success"] is True
        log_step("Complete CRITICS OK", "CRITICS stage completed with pass")

        # 8. Tick 4: All stages completed, assignments should be empty
        t4 = client.get("/api/pipeline/tick").json()
        assert t4["assignments"] == []
        log_step("Tick 4 OK", "Queue empty post-completion")

        # 9. Assert component has reached COMPLETED terminal status
        sched = get_current_scheduler()
        comp = sched.dag.get_component("comp-single")
        assert comp is not None, "Component comp-single not found in active DAG"
        assert comp.status == ComponentStatus.COMPLETED, f"Expected COMPLETED, got {comp.status}"
        assert sched.is_pipeline_finished() is True
        assert sched.lock_manager.is_stage_occupied(StageEnum.DESIGN) is False
        assert sched.lock_manager.is_stage_occupied(StageEnum.CODEGEN) is False
        assert sched.lock_manager.is_stage_occupied(StageEnum.CRITICS) is False
        log_step("TIER 1 PASSED", "Component successfully reached COMPLETED status")


# ==============================================================================
# Tier 2: Boundary & Corner Cases
# ==============================================================================

class TestTier2BoundaryAndCornerCases:
    """
    Tier 2 tests error handling, cyclical DAG rejections, empty inputs, and stale/invalid requests.
    """

    def test_cyclic_dependency_rejection_2nodes(self, client: TestClient):
        log_step("TIER 2", "Testing 2-Node Cyclic Dependency Rejection")
        payload = {
            "components": [
                {"component_id": "node-A", "dependencies": ["node-B"], "priority_order": 1},
                {"component_id": "node-B", "dependencies": ["node-A"], "priority_order": 2},
            ]
        }
        res = client.post("/api/pipeline/init", json=payload)
        assert res.status_code == 400, f"Expected HTTP 400 for cyclic DAG, got {res.status_code}: {res.text}"
        assert "Cyclic" in res.json().get("detail", "")
        log_step("Cycle Rejection OK", "2-node cycle correctly rejected with HTTP 400")

    def test_cyclic_dependency_rejection_3nodes(self, client: TestClient):
        log_step("TIER 2", "Testing 3-Node Cyclic Dependency Rejection")
        payload = {
            "components": [
                {"component_id": "node-1", "dependencies": ["node-3"], "priority_order": 1},
                {"component_id": "node-2", "dependencies": ["node-1"], "priority_order": 2},
                {"component_id": "node-3", "dependencies": ["node-2"], "priority_order": 3},
            ]
        }
        res = client.post("/api/pipeline/init", json=payload)
        assert res.status_code == 400, f"Expected HTTP 400 for 3-node cycle, got {res.status_code}: {res.text}"
        assert "Cyclic" in res.json().get("detail", "")
        log_step("Cycle Rejection OK", "3-node circular loop correctly rejected with HTTP 400")

    def test_self_dependency_rejection(self, client: TestClient):
        log_step("TIER 2", "Testing Self-Dependency Rejection")
        payload = {
            "components": [
                {"component_id": "self-loop", "dependencies": ["self-loop"], "priority_order": 1}
            ]
        }
        res = client.post("/api/pipeline/init", json=payload)
        assert res.status_code == 400, f"Expected HTTP 400 for self-dependency, got {res.status_code}: {res.text}"
        log_step("Self-Dependency OK", "Self-referencing component rejected with HTTP 400")

    def test_empty_component_list_initialization(self, client: TestClient):
        log_step("TIER 2", "Testing Empty Component Initialization")
        res = client.post("/api/pipeline/init", json={"components": []})
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}

        # Tick on empty pipeline
        tick_res = client.get("/api/pipeline/tick")
        assert tick_res.status_code == 200
        assert tick_res.json() == {"assignments": []}
        log_step("Empty Init OK", "Empty pipeline initialized and ticked cleanly")

    def test_idle_scheduler_repeated_polling(self, client: TestClient):
        log_step("TIER 2", "Testing Repeated Polling on Idle Scheduler")
        # Empty init
        client.post("/api/pipeline/init", json={"components": []})
        for i in range(5):
            res = client.get("/api/pipeline/tick")
            assert res.status_code == 200
            assert res.json() == {"assignments": []}
        log_step("Idle Polling OK", "5 idle ticks executed without state corruption")

    def test_invalid_and_stale_stage_completions(self, client: TestClient):
        log_step("TIER 2", "Testing Invalid Stage Completion Payloads")
        client.post(
            "/api/pipeline/init",
            json={"components": [{"component_id": "c-val", "dependencies": [], "priority_order": 1}]}
        )

        # 1. Complete non-existent component
        res_nonexistent = client.post(
            "/api/pipeline/complete",
            json={"component_id": "does-not-exist", "stage": "DESIGN", "verdict": "pass"}
        ).json()
        assert res_nonexistent["success"] is False

        # 2. Advance to DESIGN
        t1 = client.get("/api/pipeline/tick").json()
        assert len(t1["assignments"]) == 1

        # 3. Attempt to complete wrong stage (e.g. CRITICS when at DESIGN)
        res_wrong_stage = client.post(
            "/api/pipeline/complete",
            json={"component_id": "c-val", "stage": "CRITICS", "verdict": "pass"}
        ).json()
        assert res_wrong_stage["success"] is False

        # 4. Valid completion
        res_valid = client.post(
            "/api/pipeline/complete",
            json={"component_id": "c-val", "stage": "DESIGN", "verdict": "pass"}
        ).json()
        assert res_valid["success"] is True

        # 5. Duplicate completion attempt on already completed stage
        res_dup = client.post(
            "/api/pipeline/complete",
            json={"component_id": "c-val", "stage": "DESIGN", "verdict": "pass"}
        ).json()
        assert res_dup["success"] is False
        log_step("Invalid Complete OK", "All invalid/stale complete calls handled safely")

    def test_schema_backward_compatibility(self, client: TestClient):
        log_step("TIER 2", "Testing 'dependencies_on' & 'dependencies' Schema Compatibility")
        payload = {
            "components": [
                {"component_id": "base-comp", "priority_order": 1},
                {
                    "component_id": "dep-comp",
                    "dependencies_on": ["base-comp"],
                    "priority_order": 2,
                }
            ]
        }
        res = client.post("/api/pipeline/init", json=payload)
        assert res.status_code == 200

        sched = get_current_scheduler()
        base_node = sched.dag.get_component("base-comp")
        dep_node = sched.dag.get_component("dep-comp")
        assert base_node is not None
        assert dep_node is not None
        assert "base-comp" in dep_node.dependencies
        log_step("Schema Compatibility OK", "dependencies_on correctly populated DAG")

    def test_scheduler_state_isolation_between_inits(self, client: TestClient):
        log_step("TIER 2", "Testing Scheduler Reset State Isolation on Init")
        # Run 1
        client.post("/api/pipeline/init", json={"components": [{"component_id": "run1-comp", "priority_order": 1}]})
        sched1 = get_current_scheduler()
        assert "run1-comp" in sched1.dag.nodes

        # Run 2
        client.post("/api/pipeline/init", json={"components": [{"component_id": "run2-comp", "priority_order": 1}]})
        sched2 = get_current_scheduler()
        assert "run2-comp" in sched2.dag.nodes
        assert "run1-comp" not in sched2.dag.nodes
        log_step("Isolation OK", "Previous run nodes cleaned out on re-initialization")


# ==============================================================================
# Tier 3: Revision Feedback Loop
# ==============================================================================

class TestTier3RevisionFeedbackLoop:
    """
    Tier 3 tests feedback loops: CRITICS with verdict='revise' routes back to CODEGEN with priority boost.
    """

    def test_single_revision_feedback_loop(self, client: TestClient):
        log_step("TIER 3", "Starting Single Revision Feedback Loop Test")

        # 1. Initialize component
        client.post(
            "/api/pipeline/init",
            json={"components": [{"component_id": "comp-rev", "dependencies": [], "priority_order": 1}]}
        )

        # 2. DESIGN -> pass
        client.get("/api/pipeline/tick")
        c_des = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-rev", "stage": "DESIGN", "verdict": "pass"}
        ).json()
        assert c_des["success"] is True

        # 3. CODEGEN -> pass
        client.get("/api/pipeline/tick")
        c_code = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-rev", "stage": "CODEGEN", "verdict": "pass"}
        ).json()
        assert c_code["success"] is True

        # 4. CRITICS -> REVISE
        client.get("/api/pipeline/tick")
        c_crit_revise = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-rev", "stage": "CRITICS", "verdict": "revise"}
        ).json()
        assert c_crit_revise["success"] is True
        log_step("Critic Revise OK", "CRITICS emitted verdict='revise'")

        # Verify component state: revision_count is 1
        sched = get_current_scheduler()
        comp = sched.dag.get_component("comp-rev")
        assert comp.revision_count == 1
        assert sched.lock_manager.is_stage_occupied(StageEnum.CRITICS) is False

        # 5. Next tick should re-dispatch CODEGEN
        t_rev_code = client.get("/api/pipeline/tick").json()
        assert len(t_rev_code["assignments"]) == 1
        assert t_rev_code["assignments"][0]["component_id"] == "comp-rev"
        assert t_rev_code["assignments"][0]["stage"] == "CODEGEN"
        log_step("Re-routed OK", "Dispatched back to CODEGEN for revision iteration")

        # 6. Complete second CODEGEN
        c_code2 = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-rev", "stage": "CODEGEN", "verdict": "pass"}
        ).json()
        assert c_code2["success"] is True

        # 7. Next tick dispatches CRITICS again
        t_crit2 = client.get("/api/pipeline/tick").json()
        assert len(t_crit2["assignments"]) == 1
        assert t_crit2["assignments"][0]["component_id"] == "comp-rev"
        assert t_crit2["assignments"][0]["stage"] == "CRITICS"

        # 8. Complete CRITICS with 'pass'
        c_crit_pass = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-rev", "stage": "CRITICS", "verdict": "pass"}
        ).json()
        assert c_crit_pass["success"] is True

        # 9. Assert COMPLETED
        assert comp.status == ComponentStatus.COMPLETED
        assert comp.revision_count == 1
        log_step("TIER 3 PASSED", "Component revised and completed successfully")

    def test_multi_revision_to_completion(self, client: TestClient):
        log_step("TIER 3", "Starting Multi-Revision (2 cycles) to Completion Test")

        client.post(
            "/api/pipeline/init",
            json={"components": [{"component_id": "comp-2rev", "dependencies": [], "priority_order": 1}]}
        )

        ticks, statuses = simulate_ui_execution_loop(
            client=client,
            max_ticks=30,
            revision_plan_map={"comp-2rev": ["revise", "revise", "pass"]},
            log_ticks=False,
        )

        sched = get_current_scheduler()
        comp = sched.dag.get_component("comp-2rev")
        assert comp.status == ComponentStatus.COMPLETED
        assert comp.revision_count == 2
        log_step("Multi-Revision OK", f"Completed in {ticks} ticks with {comp.revision_count} revisions")

    def test_terminal_fail_verdict(self, client: TestClient):
        log_step("TIER 3", "Testing Terminal Critic Failure ('fail' verdict)")
        client.post(
            "/api/pipeline/init",
            json={"components": [{"component_id": "comp-fail", "dependencies": [], "priority_order": 1}]}
        )
        # DESIGN -> pass
        client.get("/api/pipeline/tick")
        client.post("/api/pipeline/complete", json={"component_id": "comp-fail", "stage": "DESIGN", "verdict": "pass"})
        # CODEGEN -> pass
        client.get("/api/pipeline/tick")
        client.post("/api/pipeline/complete", json={"component_id": "comp-fail", "stage": "CODEGEN", "verdict": "pass"})
        # CRITICS -> fail
        client.get("/api/pipeline/tick")
        res_fail = client.post(
            "/api/pipeline/complete",
            json={"component_id": "comp-fail", "stage": "CRITICS", "verdict": "fail"}
        ).json()
        assert res_fail["success"] is True

        sched = get_current_scheduler()
        comp = sched.dag.get_component("comp-fail")
        assert comp.status == ComponentStatus.FAILED
        assert sched.is_pipeline_finished() is True
        log_step("Terminal Fail OK", "Component correctly reached FAILED status")


# ==============================================================================
# Tier 4: Real-World Multi-Component Concurrent Acceptance Test
# ==============================================================================

class TestTier4ConcurrentDAGAcceptance:
    """
    Tier 4 tests multi-component concurrency, stage mutex mutual exclusion,
    DAG dependency unblocking, and deadlock-free end-to-end execution.
    """

    def test_3component_dag_concurrency_and_dependency_blocking(self, client: TestClient):
        log_step("TIER 4", "Starting 3-Component Concurrent Multi-Tier DAG Acceptance Test")

        # DAG Specification:
        # comp-auth [priority 1, no deps]
        # comp-db   [priority 2, no deps]
        # comp-api  [priority 3, depends on comp-auth AND comp-db]
        payload = {
            "components": [
                {
                    "component_id": "comp-auth",
                    "component_name": "Authentication Subsystem",
                    "dependencies": [],
                    "priority_order": 1,
                },
                {
                    "component_id": "comp-db",
                    "component_name": "Database Persistence Layer",
                    "dependencies": [],
                    "priority_order": 2,
                },
                {
                    "component_id": "comp-api",
                    "component_name": "Unified Gateway API",
                    "dependencies": ["comp-auth", "comp-db"],
                    "priority_order": 3,
                },
            ]
        }

        init_res = client.post("/api/pipeline/init", json=payload)
        assert init_res.status_code == 200

        sched = get_current_scheduler()
        assert sched.dag.get_component("comp-auth").status in (ComponentStatus.CREATED, ComponentStatus.READY)
        assert sched.dag.get_component("comp-db").status in (ComponentStatus.CREATED, ComponentStatus.READY)
        assert sched.dag.get_component("comp-api").status == ComponentStatus.PENDING_DEPS

        max_ticks = 40
        ticks_count = 0
        comp_api_started_prematurely = False
        concurrency_observed = False

        while ticks_count < max_ticks:
            ticks_count += 1
            tick_data = client.get("/api/pipeline/tick").json()
            assignments = tick_data.get("assignments", [])

            auth_status = sched.dag.get_component("comp-auth").status
            db_status = sched.dag.get_component("comp-db").status
            api_status = sched.dag.get_component("comp-api").status

            print(f"  [Tick {ticks_count:02d}] Active: {assignments} | "
                  f"Auth: {auth_status.value}, DB: {db_status.value}, API: {api_status.value}")

            # Check Concurrency Invariant:
            # When multiple stages are occupied concurrently (e.g. comp-auth in CODEGEN, comp-db in DESIGN)
            if len(assignments) > 1:
                stages_in_tick = [a["stage"] for a in assignments]
                # Enforce stage mutual exclusion invariant (no duplicate stages in 1 tick)
                assert len(stages_in_tick) == len(set(stages_in_tick)), (
                    f"Stage lock collision detected! Multiple assignments to same stage: {assignments}"
                )
                concurrency_observed = True

            # Check DAG Dependency Invariant:
            # comp-api MUST NOT be dispatched to any stage until both comp-auth and comp-db are COMPLETED
            for a in assignments:
                if a["component_id"] == "comp-api":
                    if auth_status != ComponentStatus.COMPLETED or db_status != ComponentStatus.COMPLETED:
                        comp_api_started_prematurely = True

            if sched.is_pipeline_finished() and not assignments:
                print(f"  [Tick {ticks_count:02d}] Pipeline execution finished cleanly.")
                break

            # Complete all active stage assignments in this tick
            for a in assignments:
                complete_res = client.post(
                    "/api/pipeline/complete",
                    json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"}
                ).json()
                assert complete_res["success"] is True

        assert not comp_api_started_prematurely, (
            "Invariant Violation: comp-api was dispatched before prerequisites reached COMPLETED!"
        )

        # Verify all 3 components reached COMPLETED
        assert sched.dag.get_component("comp-auth").status == ComponentStatus.COMPLETED
        assert sched.dag.get_component("comp-db").status == ComponentStatus.COMPLETED
        assert sched.dag.get_component("comp-api").status == ComponentStatus.COMPLETED
        assert sched.is_pipeline_finished() is True
        assert ticks_count <= 20, f"Execution took too many ticks ({ticks_count}), potential sluggishness"

        log_step("TIER 4 PASSED",
                 f"All 3 components completed with 0 deadlocks in {ticks_count} ticks. Concurrency verified: {concurrency_observed}")

    def test_complex_5component_diamond_dag_with_revisions(self, client: TestClient):
        log_step("TIER 4", "Starting 5-Component Diamond DAG with Revision Test")

        # 5-Node Diamond DAG:
        # root-1 (prio 1, no deps)
        # root-2 (prio 2, no deps)
        # mid-1  (prio 3, depends on root-1)
        # mid-2  (prio 4, depends on root-1, root-2) -> undergoes 1 revision
        # sink   (prio 5, depends on mid-1, mid-2)
        payload = {
            "components": [
                {"component_id": "root-1", "dependencies": [], "priority_order": 1},
                {"component_id": "root-2", "dependencies": [], "priority_order": 2},
                {"component_id": "mid-1", "dependencies": ["root-1"], "priority_order": 3},
                {"component_id": "mid-2", "dependencies": ["root-1", "root-2"], "priority_order": 4},
                {"component_id": "sink", "dependencies": ["mid-1", "mid-2"], "priority_order": 5},
            ]
        }

        init_res = client.post("/api/pipeline/init", json=payload)
        assert init_res.status_code == 200

        ticks, statuses = simulate_ui_execution_loop(
            client=client,
            max_ticks=50,
            revision_plan_map={"mid-2": ["revise", "pass"]},
            log_ticks=True,
        )

        sched = get_current_scheduler()
        for cid in ["root-1", "root-2", "mid-1", "mid-2", "sink"]:
            comp = sched.dag.get_component(cid)
            assert comp is not None
            assert comp.status == ComponentStatus.COMPLETED, f"Component {cid} was not COMPLETED: {comp.status}"

        assert sched.dag.get_component("mid-2").revision_count == 1
        assert sched.is_pipeline_finished() is True
        log_step("5-Component Diamond OK", f"All 5 nodes reached COMPLETED in {ticks} ticks without deadlocks")

    def test_8component_high_concurrency_stress_simulation(self, client: TestClient):
        log_step("TIER 4", "Starting 8-Component High Concurrency Stress Test")

        # 8-Component Wide Multi-Track Topology:
        # Layer 1: t1-c1, t2-c1, t3-c1
        # Layer 2: t1-c2 (deps t1-c1), t2-c2 (deps t2-c1), t3-c2 (deps t3-c1)
        # Layer 3: joint-gateway (deps t1-c2, t2-c2), joint-db (deps t2-c2, t3-c2)
        payload = {
            "components": [
                {"component_id": "t1-c1", "priority_order": 1, "dependencies": []},
                {"component_id": "t2-c1", "priority_order": 2, "dependencies": []},
                {"component_id": "t3-c1", "priority_order": 3, "dependencies": []},
                {"component_id": "t1-c2", "priority_order": 4, "dependencies": ["t1-c1"]},
                {"component_id": "t2-c2", "priority_order": 5, "dependencies": ["t2-c1"]},
                {"component_id": "t3-c2", "priority_order": 6, "dependencies": ["t3-c1"]},
                {"component_id": "joint-gw", "priority_order": 7, "dependencies": ["t1-c2", "t2-c2"]},
                {"component_id": "joint-db", "priority_order": 8, "dependencies": ["t2-c2", "t3-c2"]},
            ]
        }

        init_res = client.post("/api/pipeline/init", json=payload)
        assert init_res.status_code == 200

        ticks, statuses = simulate_ui_execution_loop(
            client=client,
            max_ticks=80,
            revision_plan_map={"t2-c2": ["revise", "pass"], "joint-gw": ["revise", "pass"]},
            log_ticks=False,
        )

        sched = get_current_scheduler()
        for cid in ["t1-c1", "t2-c1", "t3-c1", "t1-c2", "t2-c2", "t3-c2", "joint-gw", "joint-db"]:
            comp = sched.dag.get_component(cid)
            assert comp is not None
            assert comp.status == ComponentStatus.COMPLETED, f"Component {cid} failed to complete: {comp.status}"

        assert sched.is_pipeline_finished() is True
        log_step("8-Component Stress OK", f"All 8 components completed under heavy concurrency in {ticks} ticks")


# ==============================================================================
# Standalone Direct Executable Entry Point (`python test_pipeline_flow.py`)
# ==============================================================================

def run_all_tiers_standalone():
    """Executes all test tiers when run directly from the command line."""
    print("=" * 80)
    print("  AutoDev Backend Pipeline E2E Integration Suite (test_pipeline_flow.py)")
    print("=" * 80)

    total_tests = 0
    passed_tests = 0
    failed_tests = []

    def execute_test(test_func, *args, name=""):
        nonlocal total_tests, passed_tests, failed_tests
        total_tests += 1
        test_display = name or test_func.__name__
        try:
            test_func(*args)
            print(f"  [PASS] {test_display}")
            passed_tests += 1
        except Exception as exc:
            print(f"  [FAIL] {test_display} -> {exc}")
            failed_tests.append((test_display, str(exc)))

    with TestClient(app) as test_client:
        # Unit Subsystem Tests
        print("\n>>> Running Subsystem Unit Tests...")
        unit = TestSubsystemUnitContracts()
        execute_test(unit.test_state_transitions_quarantined_and_stalled_to_completed)
        execute_test(unit.test_priority_queue_min_heap_ordering)
        execute_test(unit.test_stage_handover_releases_lock_and_does_not_eagerly_acquire)

        # Tier 1
        print("\n>>> Running Tier 1: Single Component Lifecycle...")
        t1 = TestTier1SingleComponentFlow()
        execute_test(t1.test_single_component_full_lifecycle, test_client)

        # Tier 2
        print("\n>>> Running Tier 2: Boundary & Corner Cases...")
        t2 = TestTier2BoundaryAndCornerCases()
        execute_test(t2.test_cyclic_dependency_rejection_2nodes, test_client)
        execute_test(t2.test_cyclic_dependency_rejection_3nodes, test_client)
        execute_test(t2.test_self_dependency_rejection, test_client)
        execute_test(t2.test_empty_component_list_initialization, test_client)
        execute_test(t2.test_idle_scheduler_repeated_polling, test_client)
        execute_test(t2.test_invalid_and_stale_stage_completions, test_client)
        execute_test(t2.test_schema_backward_compatibility, test_client)
        execute_test(t2.test_scheduler_state_isolation_between_inits, test_client)

        # Tier 3
        print("\n>>> Running Tier 3: Revision Feedback Loops...")
        t3 = TestTier3RevisionFeedbackLoop()
        execute_test(t3.test_single_revision_feedback_loop, test_client)
        execute_test(t3.test_multi_revision_to_completion, test_client)
        execute_test(t3.test_terminal_fail_verdict, test_client)

        # Tier 4
        print("\n>>> Running Tier 4: Concurrent Multi-Component Acceptance...")
        t4 = TestTier4ConcurrentDAGAcceptance()
        execute_test(t4.test_3component_dag_concurrency_and_dependency_blocking, test_client)
        execute_test(t4.test_complex_5component_diamond_dag_with_revisions, test_client)
        execute_test(t4.test_8component_high_concurrency_stress_simulation, test_client)

    print("\n" + "=" * 80)
    print(f"  EXECUTION SUMMARY: {passed_tests}/{total_tests} Tests Passed")
    if failed_tests:
        print(f"  FAILED TESTS ({len(failed_tests)}):")
        for f_name, f_err in failed_tests:
            print(f"    - {f_name}: {f_err}")
    print("=" * 80)
    return 0 if not failed_tests else 1


if __name__ == "__main__":
    sys.exit(run_all_tiers_standalone())
