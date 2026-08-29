"""
AutoDev Unified Pipeline Scheduler.

Orchestrates component lifecycles across DAG dependencies, stage priority queues,
mutual exclusion locks, multi-tier watchdogs, and Write-Ahead State Store (WASS).

File: src/autodev_pipeline/scheduler.py
Milestone: M3 & M4 (Unified Runtime Scheduler)
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
import uuid

from autodev_pipeline.concurrency import (
    StageHandoverProtocol,
    StageLockManager,
    StageQueueManager,
    _normalize_stage,
)
from autodev_pipeline.dag_engine import PipelineDAG
from autodev_pipeline.fault_tolerance import (
    FaultToleranceManager,
    WriteAheadStateStore,
)
from autodev_pipeline.models import (
    ComponentStateRecord,
    ComponentStatus,
    CycleResolutionPolicy,
    LeaseToken,
    PipelineConfig,
    PipelineSnapshot,
    StageEnum,
    StateTransitionEvent,
    TransitionEventType,
)


class PipelineScheduler:
    """
    Central orchestration engine driving components through DAG dependencies,
    per-stage priority queues, and lease-backed stage mutexes.
    """

    def __init__(
        self,
        dag: Optional[PipelineDAG] = None,
        config: Optional[PipelineConfig] = None,
        lock_manager: Optional[StageLockManager] = None,
        queue_manager: Optional[StageQueueManager] = None,
        state_store: Optional[WriteAheadStateStore] = None,
        fault_tolerance: Optional[FaultToleranceManager] = None,
    ) -> None:
        self.dag: PipelineDAG = dag or PipelineDAG()
        self.config: PipelineConfig = config or PipelineConfig()
        self.lock_manager: StageLockManager = lock_manager or StageLockManager(self.config)
        self.queue_manager: StageQueueManager = queue_manager or StageQueueManager()
        self.state_store: Optional[WriteAheadStateStore] = (
            state_store
            if state_store is not None
            else (
                WriteAheadStateStore(
                    log_path=self.config.state_log_path,
                    snapshot_path="pipeline_snapshot.json",
                )
                if self.config.enable_wass
                else None
            )
        )
        self.fault_tolerance: Optional[FaultToleranceManager] = (
            fault_tolerance
            if fault_tolerance is not None
            else FaultToleranceManager(
                self.dag, self.queue_manager, self.config, self.state_store
            )
        )
        self._scheduler_lock: threading.RLock = threading.RLock()
        self._is_running: bool = False
        self._event_history: List[StateTransitionEvent] = []

    @property
    def components(self) -> Dict[str, ComponentStateRecord]:
        """Provides direct dictionary access to DAG component records."""
        return self.dag.nodes

    def register_components(self, comp_list: List[ComponentStateRecord]) -> bool:
        """
        Registers a list of component state records into the DAG dependency engine,
        validates graph integrity and circular dependencies.
        """
        with self._scheduler_lock:
            for comp in comp_list:
                if comp.dependencies:
                    comp.status = ComponentStatus.PENDING_DEPS
                else:
                    comp.status = ComponentStatus.CREATED
                self.dag.add_component(comp)
                self.log_event(
                    TransitionEventType.COMPONENT_CREATED,
                    component_id=comp.component_id,
                    to_status=comp.status,
                    metadata={
                        "dependencies": list(comp.dependencies),
                        "priority_order": comp.priority_order,
                        "name": comp.name,
                    },
                )

            # Check cycles
            validation = self.dag.validate_graph()
            if not validation.is_valid:
                if validation.has_cycles:
                    cycle_res = self.dag.resolve_cycles(self.config.cycle_policy)
                    self.log_event(
                        TransitionEventType.CYCLE_RESOLVED,
                        metadata={
                            "policy": self.config.cycle_policy.value,
                            "stalled": cycle_res.stalled_components,
                        },
                    )
                    if not cycle_res.resolved_acyclic and self.config.cycle_policy == CycleResolutionPolicy.ABORT:
                        return False

            return True

    def log_event(
        self,
        event_type: TransitionEventType,
        component_id: Optional[str] = None,
        from_status: Optional[ComponentStatus] = None,
        to_status: Optional[ComponentStatus] = None,
        stage: Optional[Union[StageEnum, str]] = None,
        epoch: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> StateTransitionEvent:
        """
        Creates and logs an immutable state transition event to in-memory audit trail and WASS.
        """
        norm_stage = _normalize_stage(stage) if stage is not None else None
        event = StateTransitionEvent(
            event_id=str(uuid.uuid4()),
            timestamp=time.time(),
            event_type=event_type,
            component_id=component_id,
            from_status=from_status,
            to_status=to_status,
            stage=norm_stage,
            epoch=epoch,
            metadata=metadata or {},
        )
        self._event_history.append(event)
        if self.state_store and hasattr(self.state_store, "log_event"):
            self.state_store.log_event(event)
        return event

    def step(self) -> Dict[str, Any]:
        """
        Executes a single discrete scheduling tick:
        1. Resolves newly unblocked DAG components into READY and enqueues into Q_DESIGN.
        2. Scans and cleans expired leases with epoch fencing.
        3. Dispatches free stages to highest-priority waiting components.
        Returns a summary dictionary of all actions performed in this tick.
        """
        with self._scheduler_lock:
            actions_summary: Dict[str, Any] = {
                "unblocked_components": [],
                "dispatched_stages": {},
                "expired_leases": [],
            }

            # 1. Dependency Resolution
            ready_ids = self.dag.get_ready_components()
            for cid in ready_ids:
                comp = self.dag.get_component(cid)
                if comp and comp.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                    from_status = comp.status
                    comp.transition_to(ComponentStatus.READY)
                    self.log_event(
                        TransitionEventType.DEPENDENCY_RESOLVED,
                        component_id=cid,
                        from_status=from_status,
                        to_status=ComponentStatus.READY,
                    )
                    self.queue_manager.enqueue(
                        StageEnum.DESIGN,
                        cid,
                        priority_order=comp.priority_order,
                    )
                    actions_summary["unblocked_components"].append(cid)

            # 2. Expired Lease Watchdog Sweep
            expired = self.lock_manager.check_and_clean_expired_leases()
            for stg, cid, lse in expired:
                comp = self.dag.get_component(cid)
                if comp and comp.status == ComponentStatus.IN_STAGE:
                    from_status = comp.status
                    comp.transition_to(
                        ComponentStatus.READY,
                        stage=None,
                        lease=None,
                        reason="STAGE_LEASE_EXPIRED",
                    )
                    # Re-enqueue component into stage queue to retry
                    self.queue_manager.enqueue(stg, cid, priority_order=comp.priority_order)
                    self.log_event(
                        TransitionEventType.STAGE_LEASE_EXPIRED,
                        component_id=cid,
                        from_status=from_status,
                        to_status=ComponentStatus.READY,
                        stage=stg,
                        epoch=lse.epoch,
                    )
                    actions_summary["expired_leases"].append((stg.value, cid))

            # 3. Stage Dispatching
            for stage in StageEnum.linear_order():
                if not self.lock_manager.is_stage_occupied(stage):
                    candidate_id = self.queue_manager.peek(stage)
                    if candidate_id:
                        comp = self.dag.get_component(candidate_id)
                        if comp and comp.status == ComponentStatus.READY:
                            lease = self.lock_manager.try_acquire_stage(stage, candidate_id)
                            if lease:
                                self.queue_manager.dequeue(stage)
                                from_status = comp.status
                                comp.transition_to(
                                    ComponentStatus.IN_STAGE, stage=stage, lease=lease
                                )
                                self.log_event(
                                    TransitionEventType.STAGE_LEASE_ACQUIRED,
                                    component_id=candidate_id,
                                    from_status=from_status,
                                    to_status=ComponentStatus.IN_STAGE,
                                    stage=stage,
                                    epoch=lease.epoch,
                                )
                                actions_summary["dispatched_stages"][stage.value] = candidate_id

            return actions_summary

    def tick_schedule(self) -> List[Tuple[str, StageEnum, int]]:
        """
        Runs a scheduling tick and returns list of dispatched (component_id, stage, epoch) tuples.
        Provides compatibility with test harnesses.
        """
        summary = self.step()
        dispatched: List[Tuple[str, StageEnum, int]] = []
        for stage_val, cid in summary["dispatched_stages"].items():
            stg = _normalize_stage(stage_val)
            epoch = self.lock_manager.get_stage_epoch(stg)
            dispatched.append((cid, stg, epoch))
        return dispatched

    def complete_stage_execution(
        self,
        component_id: str,
        stage: Union[StageEnum, str],
        artifact: Optional[Dict[str, Any]] = None,
        adjudication_verdict: Optional[str] = "pass",
        revision_plan: Optional[str] = None,
    ) -> bool:
        """
        Signals completion of stage processing for a component and executes atomic 2-phase handover.
        """
        with self._scheduler_lock:
            norm_stage = _normalize_stage(stage)
            comp = self.dag.get_component(component_id)
            if not comp or comp.status != ComponentStatus.IN_STAGE or comp.current_stage != norm_stage:
                return False

            lease = comp.active_lease
            if not lease:
                return False

            # Attach generated stage artifacts
            if norm_stage == StageEnum.DESIGN:
                comp.blueprint_artifact = artifact or {"blueprint": "synthesized"}
            elif norm_stage == StageEnum.CODEGEN:
                comp.codebase_artifact = artifact or {"codebase": "generated"}
            elif norm_stage == StageEnum.CRITICS:
                comp.execution_result = artifact or {
                    "verdict": adjudication_verdict,
                    "revision_plan": revision_plan,
                }

            # Handle CRITICS stage adjudication
            if norm_stage == StageEnum.CRITICS:
                verdict_lower = str(adjudication_verdict).lower() if adjudication_verdict else "pass"
                if verdict_lower == "revise":
                    comp.increment_revision()
                    if comp.has_exceeded_revisions():
                        # Poison pill limit exceeded: release lock and quarantine
                        self.lock_manager.release_stage(norm_stage, component_id, lease_token=lease)
                        reason = revision_plan or f"Exceeded maximum revision limit ({comp.max_revisions} cycles)"
                        comp.transition_to(
                            ComponentStatus.QUARANTINED,
                            stage=None,
                            lease=None,
                            reason=reason,
                        )
                        self.log_event(
                            TransitionEventType.QUARANTINE_ISOLATED,
                            component_id=component_id,
                            from_status=ComponentStatus.IN_STAGE,
                            to_status=ComponentStatus.QUARANTINED,
                            stage=norm_stage,
                        )
                        if self.fault_tolerance:
                            self.fault_tolerance.trigger_cascade_pause(
                                component_id, reason="UPSTREAM_QUARANTINED"
                            )
                        return True
                    else:
                        # Return to CODEGEN with revision priority bonus
                        StageHandoverProtocol.execute_handover(
                            component=comp,
                            current_stage=norm_stage,
                            lease_token=lease,
                            lock_manager=self.lock_manager,
                            queue_manager=self.queue_manager,
                            next_stage=StageEnum.CODEGEN,
                            is_revision=True,
                        )
                        self.log_event(
                            TransitionEventType.STATUS_TRANSITION,
                            component_id=component_id,
                            from_status=ComponentStatus.IN_STAGE,
                            to_status=comp.status,
                            stage=StageEnum.CODEGEN,
                            metadata={"revision": comp.revision_count},
                        )
                        return True

                elif verdict_lower == "fail":
                    # Terminal critic failure
                    self.lock_manager.release_stage(norm_stage, component_id, lease_token=lease)
                    comp.transition_to(
                        ComponentStatus.FAILED,
                        stage=None,
                        lease=None,
                        reason=revision_plan or "Critic evaluation failed",
                    )
                    self.log_event(
                        TransitionEventType.STATUS_TRANSITION,
                        component_id=component_id,
                        from_status=ComponentStatus.IN_STAGE,
                        to_status=ComponentStatus.FAILED,
                        stage=norm_stage,
                    )
                    if self.fault_tolerance:
                        self.fault_tolerance.trigger_cascade_pause(
                            component_id, reason="UPSTREAM_FAILED"
                        )
                    return True

            # Standard sequential progression
            next_stg = norm_stage.next_stage()
            StageHandoverProtocol.execute_handover(
                component=comp,
                current_stage=norm_stage,
                lease_token=lease,
                lock_manager=self.lock_manager,
                queue_manager=self.queue_manager,
                next_stage=next_stg,
            )

            if next_stg is None:
                self.log_event(
                    TransitionEventType.STATUS_TRANSITION,
                    component_id=component_id,
                    from_status=ComponentStatus.IN_STAGE,
                    to_status=ComponentStatus.COMPLETED,
                )
            else:
                self.log_event(
                    TransitionEventType.STATUS_TRANSITION,
                    component_id=component_id,
                    from_status=ComponentStatus.IN_STAGE,
                    to_status=comp.status,
                    stage=next_stg,
                )

            return True

    def complete_stage_design(
        self,
        component_id: str,
        epoch: Optional[int] = None,
        blueprint: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Convenience method to complete DESIGN stage."""
        return self.complete_stage_execution(
            component_id=component_id,
            stage=StageEnum.DESIGN,
            artifact=blueprint,
        )

    def complete_stage_code(
        self,
        component_id: str,
        epoch: Optional[int] = None,
        codebase: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Convenience method to complete CODEGEN stage."""
        return self.complete_stage_execution(
            component_id=component_id,
            stage=StageEnum.CODEGEN,
            artifact=codebase,
        )

    def complete_stage_critic(
        self,
        component_id: str,
        epoch: Optional[int] = None,
        verdict: str = "pass",
        revision_plan: Optional[str] = None,
    ) -> bool:
        """Convenience method to complete CRITICS stage."""
        return self.complete_stage_execution(
            component_id=component_id,
            stage=StageEnum.CRITICS,
            artifact={"verdict": verdict, "revision_plan": revision_plan},
            adjudication_verdict=verdict,
            revision_plan=revision_plan,
        )

    def complete_stage_integration(
        self,
        component_id: str,
        epoch: Optional[int] = None,
        artifact: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Convenience method to complete INTEGRATION stage."""
        return self.complete_stage_execution(
            component_id=component_id,
            stage=StageEnum.INTEGRATION,
            artifact=artifact,
        )

    def complete_stage_documentation(
        self,
        component_id: str,
        epoch: Optional[int] = None,
        artifact: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Convenience method to complete DOCUMENTATION stage."""
        return self.complete_stage_execution(
            component_id=component_id,
            stage=StageEnum.DOCUMENTATION,
            artifact=artifact,
        )

    def is_pipeline_finished(self) -> bool:
        """
        Returns True if all registered DAG components have reached terminal states:
        COMPLETED, FAILED, QUARANTINED, or STALLED.
        """
        with self._scheduler_lock:
            if not self.dag.nodes:
                return True
            for comp in self.dag.nodes.values():
                if comp.status not in (
                    ComponentStatus.COMPLETED,
                    ComponentStatus.FAILED,
                    ComponentStatus.QUARANTINED,
                    ComponentStatus.STALLED,
                ):
                    return False
            return True

    def create_snapshot(self) -> PipelineSnapshot:
        """Creates an immutable state snapshot of the entire pipeline."""
        with self._scheduler_lock:
            status = "COMPLETED" if self.is_pipeline_finished() else "RUNNING"
            snapshot = PipelineSnapshot(
                snapshot_id=str(uuid.uuid4()),
                timestamp=time.time(),
                pipeline_status=status,
                components={cid: comp for cid, comp in self.dag.nodes.items()},
                stage_leases=self.lock_manager.get_active_leases(),
                event_sequence_num=len(self._event_history),
            )
            return snapshot

    def save_snapshot(self) -> str:
        """Saves current state snapshot to durable state store."""
        with self._scheduler_lock:
            snapshot = self.create_snapshot()
            if self.state_store and hasattr(self.state_store, "save_snapshot"):
                return self.state_store.save_snapshot(snapshot)
            return ""
