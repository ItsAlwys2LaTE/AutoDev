#!/usr/bin/env python3
"""
test_pipeline_stress_challenge.py - Empirical Challenger Stress & Adversarial Test Suite

Challenges:
1. Massive 20-Node Multi-Tier DAG Concurrency & State Invariants.
2. Inverted Priority Order Dependency Resolution (Upstream low priority vs Downstream high priority).
3. Poison Pill Quarantine & Cascade Behavior (Max Revisions Exceeded).
4. Multi-Threaded Concurrent Polling & Completion Races.
5. Randomized Monte Carlo Fuzzing with Random Topologies, Prioritizations, and Verdicts.
"""

import sys
import os
import random
import threading
import time
from typing import Dict, List, Set, Tuple

# Ensure backend directory in python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi.testclient import TestClient
import pipeline_api
from main import app
from autodev_pipeline.models import ComponentStatus, StageEnum, LeaseToken
from autodev_pipeline.concurrency import StageLockManager, StageQueueManager
from autodev_pipeline.scheduler import PipelineScheduler


def get_current_scheduler() -> PipelineScheduler:
    if "pipeline_api" in sys.modules and hasattr(sys.modules["pipeline_api"], "scheduler"):
        return sys.modules["pipeline_api"].scheduler
    return pipeline_api.scheduler


def test_challenge_1_massive_20node_dag():
    """
    Challenge 1: Massive 20-Node Multi-Tier DAG.
    Validates high concurrency across DESIGN, CODEGEN, CRITICS stages.
    Enforces Stage Mutex Single-Occupancy Invariant & Dependency Invariant across 20 nodes.
    """
    print("\n--- [CHALLENGE 1] Massive 20-Node Multi-Tier DAG Stress ---")
    client = TestClient(app)

    # 4 layers of 5 nodes each
    # Layer 0: n0_0 .. n0_4 (roots)
    # Layer 1: n1_0 .. n1_4 (each depends on 2 nodes from layer 0)
    # Layer 2: n2_0 .. n2_4 (each depends on 2 nodes from layer 1)
    # Layer 3: n3_0 .. n3_4 (each depends on all nodes from layer 2)
    components = []
    for j in range(5):
        components.append({
            "component_id": f"n0_{j}",
            "priority_order": j + 1,
            "dependencies": []
        })

    for j in range(5):
        components.append({
            "component_id": f"n1_{j}",
            "priority_order": 10 + j,
            "dependencies": [f"n0_{j}", f"n0_{(j+1)%5}"]
        })

    for j in range(5):
        components.append({
            "component_id": f"n2_{j}",
            "priority_order": 20 + j,
            "dependencies": [f"n1_{j}", f"n1_{(j+2)%5}"]
        })

    for j in range(5):
        components.append({
            "component_id": f"n3_{j}",
            "priority_order": 30 + j,
            "dependencies": [f"n2_{k}" for k in range(5)]
        })

    init_resp = client.post("/api/pipeline/init", json={"components": components})
    assert init_resp.status_code == 200, f"Init failed: {init_resp.text}"

    sched = get_current_scheduler()
    assert len(sched.dag.nodes) == 20

    max_ticks = 150
    ticks = 0
    max_concurrent_stages_observed = 0

    while ticks < max_ticks:
        ticks += 1
        tick_data = client.get("/api/pipeline/tick").json()
        assignments = tick_data.get("assignments", [])

        if not assignments and sched.is_pipeline_finished():
            break

        # Check Mutual Exclusion Invariant: <= 1 occupant per stage
        assigned_stages = [a["stage"] for a in assignments]
        assert len(assigned_stages) == len(set(assigned_stages)), (
            f"MUTUAL EXCLUSION VIOLATION on tick {ticks}: duplicate stage assignment in {assignments}"
        )

        max_concurrent_stages_observed = max(max_concurrent_stages_observed, len(assignments))

        # Check Dependency Invariant:
        for a in assignments:
            cid = a["component_id"]
            node = sched.dag.get_component(cid)
            for dep in node.dependencies:
                dep_node = sched.dag.get_component(dep)
                assert dep_node.status == ComponentStatus.COMPLETED, (
                    f"DEPENDENCY VIOLATION: Component {cid} entered stage {a['stage']} while upstream {dep} is {dep_node.status}"
                )

        # Complete assignments with 'pass'
        for a in assignments:
            c_res = client.post(
                "/api/pipeline/complete",
                json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"}
            ).json()
            assert c_res["success"] is True, f"Failed to complete {a}"

    assert sched.is_pipeline_finished() is True, "Pipeline failed to reach finished state within tick budget"
    for cid in sched.dag.nodes:
        assert sched.dag.get_component(cid).status == ComponentStatus.COMPLETED

    print(f"  [PASS] Challenge 1 Passed! 20 nodes completed in {ticks} ticks. Peak stage concurrency: {max_concurrent_stages_observed}/3")


def test_challenge_2_inverted_priority_dependencies():
    """
    Challenge 2: Inverted Priority Order Dependency Resolution.
    Tests that a high-priority downstream component (priority_order=0) does NOT jump ahead
    of its prerequisite low-priority upstream component (priority_order=100).
    """
    print("\n--- [CHALLENGE 2] Inverted Priority Order Dependencies ---")
    client = TestClient(app)

    payload = {
        "components": [
            {"component_id": "upstream-slow", "priority_order": 100, "dependencies": []},
            {"component_id": "downstream-fast", "priority_order": 0, "dependencies": ["upstream-slow"]},
            {"component_id": "independent-fast", "priority_order": 1, "dependencies": []},
        ]
    }
    init_res = client.post("/api/pipeline/init", json=payload)
    assert init_res.status_code == 200

    sched = get_current_scheduler()

    # Tick 1: independent-fast (prio 1) and upstream-slow (prio 100) are ready.
    # independent-fast should get DESIGN first.
    t1 = client.get("/api/pipeline/tick").json()
    assert len(t1["assignments"]) == 1
    assert t1["assignments"][0]["component_id"] == "independent-fast"
    assert t1["assignments"][0]["stage"] == "DESIGN"

    # Complete independent-fast DESIGN
    client.post("/api/pipeline/complete", json={"component_id": "independent-fast", "stage": "DESIGN", "verdict": "pass"})

    # Tick 2: independent-fast moves to CODEGEN, upstream-slow gets DESIGN. downstream-fast MUST NOT be dispatched.
    t2 = client.get("/api/pipeline/tick").json()
    assigned_ids = {a["component_id"] for a in t2["assignments"]}
    assert "downstream-fast" not in assigned_ids
    assert "upstream-slow" in assigned_ids
    assert "independent-fast" in assigned_ids

    # Complete both
    for a in t2["assignments"]:
        client.post("/api/pipeline/complete", json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"})

    # Advance until completion
    ticks = 2
    while ticks < 20 and not sched.is_pipeline_finished():
        ticks += 1
        t = client.get("/api/pipeline/tick").json()
        for a in t["assignments"]:
            if a["component_id"] == "downstream-fast":
                # Ensure upstream-slow is COMPLETED
                assert sched.dag.get_component("upstream-slow").status == ComponentStatus.COMPLETED
            client.post("/api/pipeline/complete", json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"})

    assert sched.dag.get_component("downstream-fast").status == ComponentStatus.COMPLETED
    assert sched.dag.get_component("upstream-slow").status == ComponentStatus.COMPLETED
    assert sched.dag.get_component("independent-fast").status == ComponentStatus.COMPLETED
    print(f"  [PASS] Challenge 2 Passed! Inverted priorities respected DAG blocking.")


def test_challenge_3_poison_pill_quarantine_and_cascade():
    """
    Challenge 3: Poison Pill Quarantine (Exceeded Max Revisions).
    Tests that when a component fails CRITICS with 'revise' > 3 times, it enters QUARANTINED,
    and downstream components do not hang or block the scheduler.
    """
    print("\n--- [CHALLENGE 3] Poison Pill Quarantine & Revision Budget ---")
    client = TestClient(app)

    payload = {
        "components": [
            {"component_id": "poison-node", "priority_order": 1, "dependencies": []},
            {"component_id": "dependent-node", "priority_order": 2, "dependencies": ["poison-node"]},
            {"component_id": "healthy-node", "priority_order": 3, "dependencies": []},
        ]
    }
    client.post("/api/pipeline/init", json=payload)
    sched = get_current_scheduler()

    # Advance poison-node through DESIGN & CODEGEN
    # Tick 1: DESIGN
    t1 = client.get("/api/pipeline/tick").json()
    for a in t1["assignments"]:
        client.post("/api/pipeline/complete", json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"})

    # Run loop where poison-node always receives 'revise'
    revision_count = 0
    ticks = 1
    while ticks < 40:
        ticks += 1
        t = client.get("/api/pipeline/tick").json()
        assignments = t.get("assignments", [])
        if not assignments:
            break

        for a in assignments:
            cid = a["component_id"]
            stage = a["stage"]
            if cid == "poison-node" and stage == "CRITICS":
                verdict = "revise"
                revision_count += 1
            else:
                verdict = "pass"

            client.post("/api/pipeline/complete", json={"component_id": cid, "stage": stage, "verdict": verdict})

    poison_comp = sched.dag.get_component("poison-node")
    healthy_comp = sched.dag.get_component("healthy-node")
    dep_comp = sched.dag.get_component("dependent-node")

    assert poison_comp.status == ComponentStatus.QUARANTINED, f"Expected QUARANTINED, got {poison_comp.status}"
    assert poison_comp.revision_count == 3
    assert healthy_comp.status == ComponentStatus.COMPLETED
    # dependent-node should be STALLED or PENDING_DEPS (cannot complete because upstream was quarantined)
    assert dep_comp.status in (ComponentStatus.PENDING_DEPS, ComponentStatus.STALLED)
    assert sched.is_pipeline_finished() is True

    print(f"  [PASS] Challenge 3 Passed! Poison node quarantined after 3 revisions; healthy node completed cleanly.")


def test_challenge_4_multithreaded_concurrency_race():
    """
    Challenge 4: Multi-Threaded Concurrent Polling and Completion Race.
    Launches multiple concurrent client threads simulating high-frequency polling
    and completing to verify thread safety and lock integrity.
    """
    print("\n--- [CHALLENGE 4] Multi-Threaded Polling & Completion Races ---")
    client = TestClient(app)

    payload = {
        "components": [
            {"component_id": f"worker-{i}", "priority_order": i, "dependencies": []}
            for i in range(6)
        ]
    }
    client.post("/api/pipeline/init", json=payload)
    sched = get_current_scheduler()

    stop_event = threading.Event()
    errors = []
    completed_assignments = []
    lock = threading.Lock()

    def poller_worker(worker_idx: int):
        try:
            while not stop_event.is_set():
                resp = client.get("/api/pipeline/tick")
                if resp.status_code != 200:
                    errors.append(f"Worker {worker_idx} tick status {resp.status_code}")
                    break
                data = resp.json()
                assignments = data.get("assignments", [])

                for a in assignments:
                    # Attempt stage completion
                    c_resp = client.post(
                        "/api/pipeline/complete",
                        json={"component_id": a["component_id"], "stage": a["stage"], "verdict": "pass"}
                    )
                    if c_resp.status_code == 200:
                        c_data = c_resp.json()
                        if c_data.get("success"):
                            with lock:
                                completed_assignments.append((a["component_id"], a["stage"]))
                time.sleep(0.01)
        except Exception as e:
            errors.append(f"Worker {worker_idx} exception: {e}")

    threads = [threading.Thread(target=poller_worker, args=(i,)) for i in range(4)]
    for th in threads:
        th.start()

    # Let threads run until pipeline finishes or timeout
    start_time = time.time()
    while time.time() - start_time < 5.0:
        if sched.is_pipeline_finished():
            break
        time.sleep(0.05)

    stop_event.set()
    for th in threads:
        th.join()

    assert not errors, f"Errors encountered during multithreaded test: {errors}"
    assert sched.is_pipeline_finished() is True, "Pipeline did not finish in multithreaded test"
    for i in range(6):
        assert sched.dag.get_component(f"worker-{i}").status == ComponentStatus.COMPLETED

    print(f"  [PASS] Challenge 4 Passed! 6 components completed concurrently under 4 worker threads without race conditions.")


def test_challenge_5_randomized_monte_carlo_fuzzing():
    """
    Challenge 5: Randomized Monte Carlo Fuzzing.
    Generates 10 randomized acyclic DAG topologies with variable sizes (5-10 nodes),
    random priority orders, and random critic verdicts ('pass', 'revise').
    Validates deadlock-freedom, state consistency, and invariants across all runs.
    """
    print("\n--- [CHALLENGE 5] Randomized Monte Carlo Fuzzing (10 DAG Runs) ---")
    client = TestClient(app)
    random.seed(42)

    for run_idx in range(10):
        num_nodes = random.randint(5, 10)
        node_ids = [f"fuzz_r{run_idx}_n{i}" for i in range(num_nodes)]
        components = []

        # Build random DAG (forward edges only i < j guarantees acyclicity)
        for i in range(num_nodes):
            cid = node_ids[i]
            deps = []
            if i > 0:
                # Randomly pick 0-2 upstream dependencies from lower indices
                num_deps = random.randint(0, min(2, i))
                deps = random.sample(node_ids[:i], num_deps)
            prio = random.randint(0, 10)
            components.append({
                "component_id": cid,
                "priority_order": prio,
                "dependencies": deps
            })

        init_res = client.post("/api/pipeline/init", json={"components": components})
        assert init_res.status_code == 200, f"Run {run_idx} init failed: {init_res.text}"

        sched = get_current_scheduler()
        max_ticks = 80
        ticks = 0

        while ticks < max_ticks:
            ticks += 1
            t = client.get("/api/pipeline/tick").json()
            assignments = t.get("assignments", [])

            if not assignments and sched.is_pipeline_finished():
                break

            # Invariant 1: Mutex mutual exclusion
            stgs = [a["stage"] for a in assignments]
            assert len(stgs) == len(set(stgs)), f"Run {run_idx} Stage collision: {assignments}"

            # Invariant 2: Dependency prerequisites
            for a in assignments:
                cid = a["component_id"]
                node = sched.dag.get_component(cid)
                for dep in node.dependencies:
                    dep_node = sched.dag.get_component(dep)
                    assert dep_node.status == ComponentStatus.COMPLETED, (
                        f"Run {run_idx} Dep invariant failed: {cid} in {a['stage']} while dep {dep} is {dep_node.status}"
                    )

            # Complete with 80% pass, 20% revise
            for a in assignments:
                cid = a["component_id"]
                stage = a["stage"]
                node = sched.dag.get_component(cid)
                if stage == "CRITICS" and node.revision_count < 2 and random.random() < 0.25:
                    verdict = "revise"
                else:
                    verdict = "pass"
                c_res = client.post(
                    "/api/pipeline/complete",
                    json={"component_id": cid, "stage": stage, "verdict": verdict}
                ).json()
                assert c_res["success"] is True

        assert sched.is_pipeline_finished() is True, f"Run {run_idx} timed out without finishing"
        for cid in node_ids:
            assert sched.dag.get_component(cid).status in (ComponentStatus.COMPLETED, ComponentStatus.QUARANTINED)

    print(f"  [PASS] Challenge 5 Passed! 10 randomized Monte Carlo DAG configurations completed with 0 deadlocks.")


if __name__ == "__main__":
    print("=" * 80)
    print("  AutoDev Empirical Challenger Stress Test Suite")
    print("=" * 80)
    test_challenge_1_massive_20node_dag()
    test_challenge_2_inverted_priority_dependencies()
    test_challenge_3_poison_pill_quarantine_and_cascade()
    test_challenge_4_multithreaded_concurrency_race()
    test_challenge_5_randomized_monte_carlo_fuzzing()
    print("\n" + "=" * 80)
    print("  ALL 5 EMPIRICAL CHALLENGES PASSED PERFECTLY!")
    print("=" * 80)
