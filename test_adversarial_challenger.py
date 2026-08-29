#!/usr/bin/env python3
"""
test_adversarial_challenger.py - Empirical Adversarial Challenge and Stress Test Suite

Probes:
1. Complex DAG pathologies (nested cycles, long cycle rings, disconnected cyclic subgraphs, missing deps).
2. Extreme Concurrency & Load (30-100 components, deep chains, wide multi-layer pyramids).
3. Multi-threaded contention & race conditions (simultaneous concurrent ticks and completions).
4. Stage lease expiration, epoch fencing, consecutive timeouts, and watchdog eviction.
5. Max revision exhaustion, quarantine circuit breaker, and downstream cascade stalls.
6. Stage mutual exclusion invariants, active assignment polling stability, & zero deadlock guarantees.
"""

import concurrent.futures
import os
import random
import sys
import threading
import time
import pytest
from typing import Any, Dict, List, Set, Tuple

# Ensure backend directory is in python search path
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
        StageMutex,
    )
    from autodev_pipeline.dag_engine import PipelineDAG
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
        StageMutex,
    )
    from backend.autodev_pipeline.dag_engine import PipelineDAG
    from backend.autodev_pipeline.scheduler import PipelineScheduler


def get_current_scheduler() -> PipelineScheduler:
    """Returns active scheduler instance."""
    if "pipeline_api" in sys.modules and hasattr(sys.modules["pipeline_api"], "scheduler"):
        return sys.modules["pipeline_api"].scheduler
    if "backend.pipeline_api" in sys.modules and hasattr(sys.modules["backend.pipeline_api"], "scheduler"):
        return sys.modules["backend.pipeline_api"].scheduler
    return pipeline_api.scheduler


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# ==============================================================================
# 1. Complex DAG Pathologies & Cycles
# ==============================================================================

class TestAdversarialDAGPathologies:
    """Probes graph edge cases, intricate cycle structures, and disconnected components."""

    def test_disconnected_subgraph_with_cycle_rejection(self, client: TestClient):
        """
        Subgraph 1: A -> B (valid acyclic)
        Subgraph 2: X -> Y -> Z -> X (cyclic)
        Expected: Init must reject with HTTP 400.
        """
        payload = {
            "components": [
                {"component_id": "comp-A", "dependencies": [], "priority_order": 1},
                {"component_id": "comp-B", "dependencies": ["comp-A"], "priority_order": 2},
                {"component_id": "comp-X", "dependencies": ["comp-Z"], "priority_order": 3},
                {"component_id": "comp-Y", "dependencies": ["comp-X"], "priority_order": 4},
                {"component_id": "comp-Z", "dependencies": ["comp-Y"], "priority_order": 5},
            ]
        }
        res = client.post("/api/pipeline/init", json=payload)
        assert res.status_code == 400
        assert "Cyclic" in res.json().get("detail", "")

    def test_large_cycle_ring_50_nodes(self, client: TestClient):
        """A 50-node circular dependency ring must be detected and rejected."""
        n = 50
        components = []
        for i in range(n):
            dep = f"ring-{(i - 1) % n}"
            components.append({
                "component_id": f"ring-{i}",
                "dependencies": [dep],
                "priority_order": i
            })
        res = client.post("/api/pipeline/init", json={"components": components})
        assert res.status_code == 400

    def test_figure_eight_double_cycle(self, client: TestClient):
        """Figure-eight graph sharing common pivot node C: (A->B->C->A) and (C->D->E->C)."""
        payload = {
            "components": [
                {"component_id": "C-A", "dependencies": ["C-C"], "priority_order": 1},
                {"component_id": "C-B", "dependencies": ["C-A"], "priority_order": 2},
                {"component_id": "C-C", "dependencies": ["C-B", "C-E"], "priority_order": 3},
                {"component_id": "C-D", "dependencies": ["C-C"], "priority_order": 4},
                {"component_id": "C-E", "dependencies": ["C-D"], "priority_order": 5},
            ]
        }
        res = client.post("/api/pipeline/init", json=payload)
        assert res.status_code == 400

    def test_disconnected_independent_subgraphs_execution(self, client: TestClient):
        """5 completely independent 2-node subgraphs executing concurrently."""
        components = []
        for g in range(5):
            components.append({
                "component_id": f"g{g}-root",
                "dependencies": [],
                "priority_order": g * 2 + 1
            })
            components.append({
                "component_id": f"g{g}-leaf",
                "dependencies": [f"g{g}-root"],
                "priority_order": g * 2 + 2
            })
        init_res = client.post("/api/pipeline/init", json={"components": components})
        assert init_res.status_code == 200

        max_ticks = 60
        ticks = 0
        while ticks < max_ticks:
            ticks += 1
            t_data = client.get("/api/pipeline/tick").json()
            assigns = t_data.get("assignments", [])
            sched = get_current_scheduler()
            if sched.is_pipeline_finished() and not assigns:
                break
            for a in assigns:
                client.post("/api/pipeline/complete", json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"})

        sched = get_current_scheduler()
        assert sched.is_pipeline_finished()
        for g in range(5):
            assert sched.dag.get_component(f"g{g}-root").status == ComponentStatus.COMPLETED
            assert sched.dag.get_component(f"g{g}-leaf").status == ComponentStatus.COMPLETED


# ==============================================================================
# 2. Extreme Concurrency & Large Scale Topologies
# ==============================================================================

class TestAdversarialConcurrencyAndLoad:
    """Stress-tests pipeline with 30-100 components, deep chains, and wide layers."""

    def test_wide_30_independent_components_load(self, client: TestClient):
        """30 concurrent independent components competing for stages."""
        n = 30
        components = [
            {"component_id": f"wide-c{i:02d}", "dependencies": [], "priority_order": i}
            for i in range(n)
        ]
        res = client.post("/api/pipeline/init", json={"components": components})
        assert res.status_code == 200

        sched = get_current_scheduler()
        ticks = 0
        max_ticks = 150
        while ticks < max_ticks:
            ticks += 1
            t_data = client.get("/api/pipeline/tick").json()
            assigns = t_data.get("assignments", [])
            if sched.is_pipeline_finished() and not assigns:
                break
            # Verify mutual exclusion across assigned stages
            stages = [a["stage"] for a in assigns]
            assert len(stages) == len(set(stages)), f"Stage conflict detected in tick {ticks}: {assigns}"

            for a in assigns:
                c_res = client.post(
                    "/api/pipeline/complete",
                    json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"}
                ).json()
                assert c_res["success"] is True

        assert sched.is_pipeline_finished()
        for i in range(n):
            assert sched.dag.get_component(f"wide-c{i:02d}").status == ComponentStatus.COMPLETED

    def test_deep_linear_chain_20_nodes(self, client: TestClient):
        """A 20-node deep sequential dependency chain (c0 -> c1 -> ... -> c19)."""
        n = 20
        components = [
            {
                "component_id": f"chain-{i:02d}",
                "dependencies": [f"chain-{i-1:02d}"] if i > 0 else [],
                "priority_order": i
            }
            for i in range(n)
        ]
        res = client.post("/api/pipeline/init", json={"components": components})
        assert res.status_code == 200

        sched = get_current_scheduler()
        ticks = 0
        max_ticks = 150
        while ticks < max_ticks:
            ticks += 1
            t_data = client.get("/api/pipeline/tick").json()
            assigns = t_data.get("assignments", [])
            if sched.is_pipeline_finished() and not assigns:
                break
            for a in assigns:
                cid = a["component_id"]
                idx = int(cid.split("-")[1])
                if idx > 0:
                    parent_id = f"chain-{idx-1:02d}"
                    assert sched.dag.get_component(parent_id).status == ComponentStatus.COMPLETED
                client.post(
                    "/api/pipeline/complete",
                    json={"component_id": cid, "stage": a["stage"], "verdict": "pass"}
                )

        assert sched.is_pipeline_finished()
        for i in range(n):
            assert sched.dag.get_component(f"chain-{i:02d}").status == ComponentStatus.COMPLETED

    def test_pyramid_multi_layer_dag(self, client: TestClient):
        """
        4-layer pyramid DAG:
        Layer 1: 4 roots (r0, r1, r2, r3)
        Layer 2: 3 nodes (m0 deps r0,r1; m1 deps r1,r2; m2 deps r2,r3)
        Layer 3: 2 nodes (p0 deps m0,m1; p1 deps m1,m2)
        Layer 4: 1 sink  (s0 deps p0,p1)
        """
        components = [
            {"component_id": "r0", "dependencies": [], "priority_order": 1},
            {"component_id": "r1", "dependencies": [], "priority_order": 2},
            {"component_id": "r2", "dependencies": [], "priority_order": 3},
            {"component_id": "r3", "dependencies": [], "priority_order": 4},
            {"component_id": "m0", "dependencies": ["r0", "r1"], "priority_order": 5},
            {"component_id": "m1", "dependencies": ["r1", "r2"], "priority_order": 6},
            {"component_id": "m2", "dependencies": ["r2", "r3"], "priority_order": 7},
            {"component_id": "p0", "dependencies": ["m0", "m1"], "priority_order": 8},
            {"component_id": "p1", "dependencies": ["m1", "m2"], "priority_order": 9},
            {"component_id": "s0", "dependencies": ["p0", "p1"], "priority_order": 10},
        ]
        res = client.post("/api/pipeline/init", json={"components": components})
        assert res.status_code == 200

        sched = get_current_scheduler()
        ticks = 0
        max_ticks = 80
        while ticks < max_ticks:
            ticks += 1
            t_data = client.get("/api/pipeline/tick").json()
            assigns = t_data.get("assignments", [])
            if sched.is_pipeline_finished() and not assigns:
                break
            for a in assigns:
                client.post("/api/pipeline/complete", json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"})

        assert sched.is_pipeline_finished()
        assert sched.dag.get_component("s0").status == ComponentStatus.COMPLETED

    def test_100_components_random_dag_stress(self, client: TestClient):
        """
        Generates 100 components with random forward dependencies (guaranteed DAG).
        Drives the entire 100-component DAG to COMPLETED status without deadlocks.
        """
        rng = random.Random(42)
        n = 100
        components = []
        for i in range(n):
            cid = f"rand-{i:03d}"
            # Can only depend on earlier components to guarantee DAG
            deps = []
            if i > 0:
                num_deps = rng.randint(0, min(3, i))
                deps = [f"rand-{p:03d}" for p in rng.sample(range(i), num_deps)]
            components.append({
                "component_id": cid,
                "dependencies": deps,
                "priority_order": i
            })

        res = client.post("/api/pipeline/init", json={"components": components})
        assert res.status_code == 200

        sched = get_current_scheduler()
        ticks = 0
        max_ticks = 400
        while ticks < max_ticks:
            ticks += 1
            t_data = client.get("/api/pipeline/tick").json()
            assigns = t_data.get("assignments", [])
            if sched.is_pipeline_finished() and not assigns:
                break
            for a in assigns:
                client.post("/api/pipeline/complete", json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"})

        assert sched.is_pipeline_finished()
        for i in range(n):
            assert sched.dag.get_component(f"rand-{i:03d}").status == ComponentStatus.COMPLETED


# ==============================================================================
# 3. Multi-Threaded Contention & Race Conditions
# ==============================================================================

class TestAdversarialThreadContention:
    """Probes thread safety under simultaneous multi-threaded calls to tick and complete."""

    def test_concurrent_multi_threaded_ticks_and_completions(self, client: TestClient):
        """
        10 components in pipeline.
        8 worker threads concurrently hammering /api/pipeline/tick and /api/pipeline/complete.
        Enforces 0 race conditions, 0 deadlocks, clean completion.
        """
        n = 10
        components = [
            {"component_id": f"th-comp-{i}", "dependencies": [], "priority_order": i}
            for i in range(n)
        ]
        init_res = client.post("/api/pipeline/init", json={"components": components})
        assert init_res.status_code == 200

        stop_event = threading.Event()
        errors = []

        def worker_loop(worker_id: int):
            while not stop_event.is_set():
                try:
                    res = client.get("/api/pipeline/tick")
                    if res.status_code == 200:
                        data = res.json()
                        assigns = data.get("assignments", [])
                        for a in assigns:
                            comp_res = client.post(
                                "/api/pipeline/complete",
                                json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"}
                            )
                            if comp_res.status_code != 200:
                                errors.append(f"Worker {worker_id} HTTP error: {comp_res.text}")
                    else:
                        errors.append(f"Worker {worker_id} tick failed: {res.status_code}")
                except Exception as ex:
                    errors.append(f"Worker {worker_id} exception: {ex}")
                time.sleep(0.005)

        # Run 8 concurrent worker threads
        threads = [threading.Thread(target=worker_loop, args=(i,)) for i in range(8)]
        for t in threads:
            t.start()

        # Wait until scheduler finishes or timeout (15 seconds)
        start_t = time.time()
        sched = get_current_scheduler()
        while time.time() - start_t < 15.0:
            if sched.is_pipeline_finished():
                break
            time.sleep(0.05)

        stop_event.set()
        for t in threads:
            t.join()

        assert not errors, f"Errors encountered during multi-threaded hammering: {errors}"
        assert sched.is_pipeline_finished(), "Pipeline failed to finish under multi-threaded load!"
        for i in range(n):
            assert sched.dag.get_component(f"th-comp-{i}").status == ComponentStatus.COMPLETED


# ==============================================================================
# 4. Lease Expiration, Epoch Fencing, and Watchdog Eviction
# ==============================================================================

class TestAdversarialLeaseAndEpochFencing:
    """Validates lock manager TTL expiration, epoch bump fencing, and re-enqueueing."""

    def test_lease_expiration_watchdog_and_epoch_bump(self):
        """
        Direct engine test: Lease expires -> check_and_clean_expired_leases evicts holder,
        bumps epoch, frees mutex, and re-enqueues component.
        """
        config = PipelineConfig(lease_duration_sec=0.1)  # 100ms lease
        dag = PipelineDAG()
        rec = ComponentStateRecord(component_id="exp-comp", name="exp-comp")
        dag.add_component(rec)
        sched = PipelineScheduler(dag=dag, config=config)

        # 1. Step: Unblock and dispatch DESIGN
        s1 = sched.step()
        assert "exp-comp" in s1["unblocked_components"]
        assert s1["dispatched_stages"].get("DESIGN") == "exp-comp"
        assert rec.status == ComponentStatus.IN_STAGE
        orig_epoch = rec.active_lease.epoch

        # 2. Wait for lease to expire
        time.sleep(0.2)

        # 3. Next step cleans expired lease and re-enqueues
        s2 = sched.step()
        assert ("DESIGN", "exp-comp") in s2["expired_leases"]
        # Immediately re-dispatched with a new lease and higher epoch
        assert s2["dispatched_stages"].get("DESIGN") == "exp-comp"
        assert rec.status == ComponentStatus.IN_STAGE
        assert rec.active_lease.epoch > orig_epoch

    def test_consecutive_lease_timeouts_recovery(self):
        """A component experiencing 3 consecutive timeouts recovers on 4th attempt."""
        config = PipelineConfig(lease_duration_sec=0.05)
        dag = PipelineDAG()
        rec = ComponentStateRecord(component_id="flaky-comp", name="flaky-comp")
        dag.add_component(rec)
        sched = PipelineScheduler(dag=dag, config=config)

        # Step 1: Initial dispatch
        sched.step()
        epochs = [rec.active_lease.epoch]

        # 3 timeouts
        for _ in range(3):
            time.sleep(0.1)
            sched.step()
            epochs.append(rec.active_lease.epoch)

        # Ensure epochs are strictly increasing
        for idx in range(len(epochs) - 1):
            assert epochs[idx] < epochs[idx + 1]

        # Complete stage with active lease
        assert sched.complete_stage_design("flaky-comp") is True
        assert rec.status == ComponentStatus.READY

    def test_stale_lease_release_rejection(self):
        """Releasing with a stale lease token or epoch must return False."""
        lm = StageLockManager()
        lease1 = lm.try_acquire_stage(StageEnum.DESIGN, "comp1")
        assert lease1 is not None

        # Create a fake/stale lease token
        stale_token = LeaseToken(
            token_id="fake-id",
            component_id="comp1",
            stage=StageEnum.DESIGN,
            epoch=lease1.epoch - 1,
            acquired_at=time.time(),
            expires_at=time.time() + 10,
            lease_duration_sec=10,
        )
        assert lm.release_stage(StageEnum.DESIGN, "comp1", lease_token=stale_token) is False
        assert lm.is_stage_occupied(StageEnum.DESIGN) is True

        # Valid release succeeds
        assert lm.release_stage(StageEnum.DESIGN, "comp1", lease_token=lease1) is True
        assert lm.is_stage_occupied(StageEnum.DESIGN) is False


# ==============================================================================
# 5. Revision Loops, Max Revisions, Quarantine & Cascade Stalls
# ==============================================================================

class TestAdversarialRevisionAndQuarantine:
    """Probes circuit breakers when components fail critics or exceed max revisions."""

    def test_quarantine_on_max_revisions_and_cascade_stall(self, client: TestClient):
        """
        comp-upstream (max_revisions=2) continuously revises until QUARANTINED.
        comp-downstream depends on comp-upstream.
        Verify comp-upstream reaches QUARANTINED and comp-downstream remains blocked (stalled/pending).
        """
        payload = {
            "components": [
                {"component_id": "c-upstream", "dependencies": [], "priority_order": 1},
                {"component_id": "c-downstream", "dependencies": ["c-upstream"], "priority_order": 2},
            ]
        }
        res = client.post("/api/pipeline/init", json=payload)
        assert res.status_code == 200

        sched = get_current_scheduler()
        # Set max_revisions to 2 on upstream
        sched.dag.get_component("c-upstream").max_revisions = 2

        # Step 1: DESIGN -> pass
        client.get("/api/pipeline/tick")
        client.post("/api/pipeline/complete", json={"component_id": "c-upstream", "stage": "DESIGN", "verdict": "pass"})

        # Step 2: CODEGEN -> pass
        client.get("/api/pipeline/tick")
        client.post("/api/pipeline/complete", json={"component_id": "c-upstream", "stage": "CODEGEN", "verdict": "pass"})

        # Revision 1: CRITICS -> revise
        client.get("/api/pipeline/tick")
        client.post("/api/pipeline/complete", json={"component_id": "c-upstream", "stage": "CRITICS", "verdict": "revise"})
        assert sched.dag.get_component("c-upstream").revision_count == 1

        # Revision 1 re-codegen -> pass
        client.get("/api/pipeline/tick")
        client.post("/api/pipeline/complete", json={"component_id": "c-upstream", "stage": "CODEGEN", "verdict": "pass"})

        # Revision 2: CRITICS -> revise (hits max_revisions=2 -> QUARANTINE)
        client.get("/api/pipeline/tick")
        client.post("/api/pipeline/complete", json={"component_id": "c-upstream", "stage": "CRITICS", "verdict": "revise"})

        up_comp = sched.dag.get_component("c-upstream")
        down_comp = sched.dag.get_component("c-downstream")

        assert up_comp.status == ComponentStatus.QUARANTINED
        # Downstream must never be unblocked or completed
        assert down_comp.status in (ComponentStatus.STALLED, ComponentStatus.PENDING_DEPS)
        assert sched.is_pipeline_finished() is True


# ==============================================================================
# 6. Frontend Polling Contract & Idempotency
# ==============================================================================

class TestAdversarialFrontendPollingContract:
    """Verifies that rapid polling does not duplicate leases or corrupt client view."""

    def test_repeated_polling_while_holding_lease(self, client: TestClient):
        """
        When a component is in DESIGN stage, multiple GET /api/pipeline/tick calls must return
        the active assignment with constant epoch, without re-entering or double-locking.
        """
        payload = {
            "components": [
                {"component_id": "poll-comp", "dependencies": [], "priority_order": 1}
            ]
        }
        client.post("/api/pipeline/init", json=payload)

        # 1st tick: dispatches DESIGN
        t1 = client.get("/api/pipeline/tick").json()
        assert len(t1["assignments"]) == 1
        assign1 = t1["assignments"][0]
        assert assign1["component_id"] == "poll-comp"
        assert assign1["stage"] == "DESIGN"
        epoch1 = assign1["epoch"]

        # Poll 10 times consecutively without completing
        for i in range(10):
            t_sub = client.get("/api/pipeline/tick").json()
            assert len(t_sub["assignments"]) == 1
            assign_sub = t_sub["assignments"][0]
            assert assign_sub["component_id"] == "poll-comp"
            assert assign_sub["stage"] == "DESIGN"
            assert assign_sub["epoch"] == epoch1

        # Now complete DESIGN
        c_res = client.post("/api/pipeline/complete", json={"component_id": "poll-comp", "stage": "DESIGN", "verdict": "pass"}).json()
        assert c_res["success"] is True

        # Next tick: dispatches CODEGEN
        t2 = client.get("/api/pipeline/tick").json()
        assert len(t2["assignments"]) == 1
        assign2 = t2["assignments"][0]
        assert assign2["stage"] == "CODEGEN"

    def test_invalid_verdict_strings_handled_safely(self, client: TestClient):
        """Unexpected verdict strings in complete calls default to standard progression."""
        client.post("/api/pipeline/init", json={"components": [{"component_id": "verdict-comp", "priority_order": 1}]})
        client.get("/api/pipeline/tick")

        # Complete with unexpected verdict
        res = client.post("/api/pipeline/complete", json={
            "component_id": "verdict-comp",
            "stage": "DESIGN",
            "verdict": "custom_arbitrary_string"
        }).json()
        assert res["success"] is True


if __name__ == "__main__":
    pytest.main(["-v", __file__])
