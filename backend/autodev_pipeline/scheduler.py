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

if not hasattr(StageLockManager, "acquire_stage"):
    StageLockManager.acquire_stage = StageLockManager.try_acquire_stage
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
        self.is_paused: bool = False
        self._paused_at: Optional[float] = None

    @property
    def paused_at_timestamp(self) -> Optional[float]:
        with self._scheduler_lock:
            return self._paused_at

    def pause(
        self,
        paused_at: Optional[float] = None,
        now: Optional[float] = None,
        active_phase: Optional[str] = None,
        active_component_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Freezes pipeline execution, pauses stage lease timers, and prevents stage dispatches.
        Thread-safe and idempotent.
        """
        with self._scheduler_lock:
            inferred_comp = active_component_id
            inferred_phase = active_phase
            if not inferred_comp or not inferred_phase:
                for stage in StageEnum.linear_order():
                    sem = self.lock_manager._get_semaphore(stage)
                    if sem.active_leases:
                        if not inferred_comp:
                            inferred_comp = sem.active_leases[0].component_id
                        if not inferred_phase:
                            inferred_phase = stage.value
                        break

            phase_display = inferred_phase or "requirements"
            comp_display = inferred_comp or "none"

            if self.is_paused:
                print(f"[PAUSE] Development paused. Active phase: {phase_display}, active component: {comp_display}")
                return {
                    "already_paused": True,
                    "paused_at": self._paused_at if self._paused_at is not None else time.time(),
                    "active_leases_count": self.lock_manager.count_active_leases(),
                }

            ts = paused_at if paused_at is not None else (now if now is not None else time.time())
            ts = float(ts)
            self.is_paused = True
            self._paused_at = ts
            self.lock_manager.pause(paused_at=ts)
            active_count = self.lock_manager.count_active_leases()

            print(f"[PAUSE] Development paused. Active phase: {phase_display}, active component: {comp_display}")

            return {
                "already_paused": False,
                "paused_at": ts,
                "active_leases_count": active_count,
            }

    def resume(
        self,
        resume_time: Optional[float] = None,
        now: Optional[float] = None,
        target_stage: Optional[str] = None,
        modifications_detected: Optional[bool] = None,
        earliest_target: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Resumes pipeline execution, extends active leases by paused duration,
        resynchronizes ComponentStateRecord active leases, and unblocks scheduler steps.
        Thread-safe and idempotent.
        """
        with self._scheduler_lock:
            inferred_target = target_stage
            if not inferred_target:
                for stage in StageEnum.linear_order():
                    sem = self.lock_manager._get_semaphore(stage)
                    if sem.active_leases:
                        inferred_target = stage.value
                        break
            if not inferred_target:
                inferred_target = "component_dag"

            mods_str = "yes" if modifications_detected else "no"
            rewind_info = earliest_target or "none"

            if not self.is_paused:
                print(f"[RESUME] Development resumed. Target phase/stage: {inferred_target}, modifications detected: {mods_str}, earliest rewind target: {rewind_info}")
                return {
                    "already_active": True,
                    "paused_duration": 0.0,
                    "extended_leases_count": 0,
                }

            t_now = resume_time if resume_time is not None else (now if now is not None else time.time())
            t_now = float(t_now)
            duration = self.lock_manager.resume(resume_time=t_now)
            self.is_paused = False
            self._paused_at = None

            extended_count = self._sync_component_leases()

            print(f"[RESUME] Development resumed. Target phase/stage: {inferred_target}, modifications detected: {mods_str}, earliest rewind target: {rewind_info}")

            return {
                "already_active": False,
                "paused_duration": duration,
                "extended_leases_count": extended_count,
            }

    def _sync_component_leases(self) -> int:
        """Synchronizes ComponentStateRecord active leases with extended LeaseTokens in semaphores."""
        count = 0
        for stage in StageEnum.linear_order():
            sem = self.lock_manager._get_semaphore(stage)
            for lease in sem.active_leases:
                comp = self.dag.get_component(lease.component_id)
                if comp:
                    comp.active_lease = lease
                    count += 1
        return count

    def reset(self) -> Dict[str, Any]:
        """Completely resets scheduler in-memory state."""
        with self._scheduler_lock:
            cleared_count = len(self.dag.nodes)
            if hasattr(self.dag, "clear"):
                self.dag.clear()
            else:
                self.dag._nodes.clear()
                self.dag._downstream.clear()
                self.dag._upstream.clear()

            if hasattr(self.queue_manager, "clear_all"):
                self.queue_manager.clear_all()
            if hasattr(self.lock_manager, "clear_all"):
                self.lock_manager.clear_all()
            if self.state_store and hasattr(self.state_store, "clear"):
                self.state_store.clear()
            if self.fault_tolerance:
                if hasattr(self.fault_tolerance, "_stalled_components"):
                    self.fault_tolerance._stalled_components.clear()
                if hasattr(self.fault_tolerance, "circuit_breaker") and hasattr(self.fault_tolerance.circuit_breaker, "reset"):
                    self.fault_tolerance.circuit_breaker.reset()

            self.is_paused = False
            self._paused_at = None
            self._is_running = False
            self._event_history.clear()
            print("[RESTART] Development restarted. Restarting development from requirements phase.")
            return {"cleared_components": cleared_count}

    restart = reset

    def rewind_component(
        self,
        component_id: str,
        target_stage: Union[StageEnum, str] = StageEnum.CRITICS,
        invalidate_dependents: bool = True,
        subsequent_component_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Rewinds a component's lifecycle to a specified target stage (e.g. CRITICS, CODEGEN, DESIGN)
        following user edits during pipeline pause.
        1. Revokes any active stage lease held by component_id.
        2. Evicts component_id from all queues.
        3. Resets component status to READY, clears current_stage and active_lease.
        4. Enqueues component_id into target_stage with high priority (is_revision=True).
        5. If invalidate_dependents is True:
           Finds all downstream dependents (and any subsequent components specified).
           Evicts them from queues, revokes any leases, enforces dependency ordering,
           and resets their status to PENDING_DEPS so they redevelop after component_id finishes.
        """
        with self._scheduler_lock:
            norm_target = _normalize_stage(target_stage)
            comp = self.dag.get_component(component_id)
            if not comp:
                return {"success": False, "error": f"Component '{component_id}' not found"}

            from_status = comp.status
            from_stage = comp.current_stage

            # 1. Release active leases across all stages for this component
            for stg in StageEnum.linear_order():
                self.lock_manager.release_stage(stg, component_id)
            comp.active_lease = None
            comp.current_stage = None

            # 2. Evict component from all stage queues
            self.queue_manager.remove_from_all_queues(component_id)

            # 3. Transition component to READY and enqueue into target stage
            comp.transition_to(ComponentStatus.READY)
            self.queue_manager.enqueue(
                norm_target,
                component_id,
                priority_order=comp.priority_order,
                is_revision=True,
            )

            self.log_event(
                TransitionEventType.STATUS_TRANSITION,
                component_id=component_id,
                from_status=from_status,
                to_status=ComponentStatus.READY,
                stage=norm_target,
                metadata={
                    "reason": "USER_REWIND",
                    "previous_stage": from_stage.value if from_stage else None,
                    "target_stage": norm_target.value,
                },
            )

            # 4. Invalidate downstream dependents and subsequent components
            invalidated_ids: Set[str] = set()
            if invalidate_dependents:
                dependents = self.dag.get_downstream_dependents(component_id, transitive=True)
                invalidated_ids.update(dependents)

            if subsequent_component_ids:
                invalidated_ids.update(subsequent_component_ids)

            invalidated_ids.discard(component_id)

            for dep_id in invalidated_ids:
                dep_comp = self.dag.get_component(dep_id)
                if not dep_comp:
                    continue
                dep_from_status = dep_comp.status
                # Release leases and evict from all queues
                for stg in StageEnum.linear_order():
                    self.lock_manager.release_stage(stg, dep_id)
                self.queue_manager.remove_from_all_queues(dep_id)
                dep_comp.active_lease = None
                dep_comp.current_stage = None

                # Enforce dependency edge so dep cannot run until component_id finishes
                self.dag.add_dependency(component_id=dep_id, depends_on_id=component_id)

                dep_comp.status = ComponentStatus.PENDING_DEPS
                self.log_event(
                    TransitionEventType.STATUS_TRANSITION,
                    component_id=dep_id,
                    from_status=dep_from_status,
                    to_status=dep_comp.status,
                    metadata={"reason": f"INVALIDATED_BY_UPSTREAM_REWIND_{component_id}"},
                )

            return {
                "success": True,
                "component_id": component_id,
                "target_stage": norm_target.value,
                "invalidated_dependents": sorted(list(invalidated_ids)),
            }

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
            if self.is_paused:
                return {
                    "unblocked_components": [],
                    "dispatched_stages": {},
                    "expired_leases": [],
                }

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
                while self.lock_manager.has_available_slot(stage):
                    candidate_id = self.queue_manager.peek(stage)
                    if not candidate_id:
                        break
                        
                    comp = self.dag.get_component(candidate_id)
                    if not comp or comp.status != ComponentStatus.READY:
                        # Remove stale entry from queue and try next
                        self.queue_manager.dequeue(stage)
                        continue

                    if not self._can_dispatch_concurrently(stage, comp):
                        break

                    lease = self.lock_manager.try_acquire_stage(stage, candidate_id)
                    if not lease:
                        break  # No slot available (race condition guard)

                    self.queue_manager.dequeue(stage)
                    from_status = comp.status
                    comp.transition_to(ComponentStatus.IN_STAGE, stage=stage, lease=lease)
                    self.log_event(
                        TransitionEventType.STAGE_LEASE_ACQUIRED,
                        component_id=candidate_id,
                        from_status=from_status,
                        to_status=ComponentStatus.IN_STAGE,
                        stage=stage,
                        epoch=lease.epoch,
                    )
                    
                    if "dispatched_stages" not in actions_summary:
                        actions_summary["dispatched_stages"] = {}
                    dispatched_list = actions_summary["dispatched_stages"].setdefault(stage.value, [])
                    dispatched_list.append(candidate_id)

            return actions_summary

    def _can_dispatch_concurrently(
        self,
        stage: StageEnum,
        candidate: ComponentStateRecord,
    ) -> bool:
        """
        Validates that dispatching this candidate into a stage slot does not
        violate DAG ordering constraints.
        """
        semaphore = self.lock_manager._get_semaphore(stage)
        current_holders = semaphore.current_holders

        # A lower-priority component already in stage is fine since candidate has higher/equal priority
        # (lower priority_order value = higher priority)

        # Check if there's a higher-priority component waiting in queue
        queue_items = self.queue_manager.peek_all(stage)
        for queued_id in queue_items:
            if queued_id == candidate.component_id:
                continue
            queued_comp = self.dag.get_component(queued_id)
            if queued_comp and queued_comp.priority_order < candidate.priority_order:
                # A higher-priority component is waiting - don't skip it
                return False

        return True

    def tick_schedule(self) -> List[Tuple[str, StageEnum, int]]:
        """
        Runs a scheduling tick (if not paused) and returns list of dispatched and active (component_id, stage, epoch) tuples.
        Provides compatibility with test harnesses and polling UI clients.
        """
        with self._scheduler_lock:
            if not self.is_paused:
                self.step()
            assignments: List[Tuple[str, StageEnum, int]] = []

            for stage in StageEnum.linear_order():
                semaphore = self.lock_manager._get_semaphore(stage)
                for lease in semaphore.active_leases:
                    assignments.append((lease.component_id, stage, lease.epoch))

            return assignments

    def complete_stage_execution(
        self,
        component_id: str,
        stage: Union[StageEnum, str],
        artifact: Optional[Dict[str, Any]] = None,
        adjudication_verdict: Optional[str] = "pass",
        revision_plan: Optional[str] = None,
        force_proceed: bool = False,
        revision_count: Optional[int] = None,
        dynamic_budget: Optional[int] = None,
    ) -> bool:
        """
        Signals completion of stage processing for a component and executes atomic 2-phase handover.
        """
        with self._scheduler_lock:
            norm_stage = _normalize_stage(stage)
            comp = self.dag.get_component(component_id)
            if not comp:
                return False

            # If component already completed, return True idempotently
            if comp.status == ComponentStatus.COMPLETED:
                return True

            # Recover only from benign desyncs (lease expiry reverted the component to READY for this
            # same stage). Never revive components that were invalidated (PENDING_DEPS/CREATED) or
            # are executing a different stage, so stale completions from aborted runs are ignored.
            if comp.status != ComponentStatus.IN_STAGE or comp.current_stage != norm_stage:
                if comp.status in (ComponentStatus.PENDING_DEPS, ComponentStatus.CREATED):
                    return False
                if comp.status == ComponentStatus.IN_STAGE and comp.current_stage != norm_stage:
                    return False
                comp.status = ComponentStatus.IN_STAGE
                comp.current_stage = norm_stage
                self.queue_manager.remove(norm_stage, comp.component_id)

            lease = comp.active_lease
            if not lease:
                # Adopt the live semaphore lease for this component/stage if one exists
                sem = self.lock_manager._get_semaphore(norm_stage)
                for live in sem.active_leases:
                    if live.component_id == comp.component_id:
                        lease = live
                        break
            if not lease:
                lease = LeaseToken(
                    token_id=str(uuid.uuid4()),
                    component_id=component_id,
                    stage=norm_stage,
                    epoch=0,
                    acquired_at=time.time(),
                    expires_at=time.time() + 300.0,
                    lease_duration_sec=300.0,
                )
            comp.active_lease = lease

            max_cap = 5 if norm_stage == StageEnum.INTEGRATION else 3
            if dynamic_budget is not None:
                budget_to_set = min(max_cap, int(dynamic_budget))
                comp.max_revisions = budget_to_set
            elif norm_stage == StageEnum.INTEGRATION and comp.max_revisions < 5:
                comp.max_revisions = 5
            elif norm_stage != StageEnum.INTEGRATION and comp.max_revisions > 3:
                comp.max_revisions = 3

            if force_proceed:
                self.lock_manager.release_stage(norm_stage, component_id, lease_token=lease)
                comp.active_lease = None
                comp.current_stage = None
                comp.force_proceeded = True
                if revision_count is not None:
                    comp.revision_count = int(revision_count)
                elif comp.revision_count == 0:
                    comp.revision_count = 1
                reason = "Explicitly force-proceeded"
                comp.transition_to(
                    ComponentStatus.COMPLETED,
                    stage=None,
                    lease=None,
                    reason=reason,
                )
                self.log_event(
                    TransitionEventType.STATUS_TRANSITION,
                    component_id=component_id,
                    from_status=ComponentStatus.IN_STAGE,
                    to_status=ComponentStatus.COMPLETED,
                    stage=norm_stage,
                    metadata={"forced_proceed": True, "reason": reason},
                )
                # Unblock downstream dependencies
                ready_ids = self.dag.get_ready_components()
                for cid in ready_ids:
                    dep_comp = self.dag.get_component(cid)
                    if dep_comp and dep_comp.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                        from_st = dep_comp.status
                        dep_comp.transition_to(ComponentStatus.READY)
                        self.log_event(
                            TransitionEventType.DEPENDENCY_RESOLVED,
                            component_id=cid,
                            from_status=from_st,
                            to_status=ComponentStatus.READY,
                        )
                        self.queue_manager.enqueue(
                            StageEnum.DESIGN,
                            cid,
                            priority_order=dep_comp.priority_order,
                        )
                return True

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

            verdict_lower = str(adjudication_verdict).lower() if adjudication_verdict else "pass"

            if verdict_lower == "error":
                self.lock_manager.release_stage(norm_stage, component_id, lease_token=lease)
                comp.active_lease = None
                comp.current_stage = None
                comp.transition_to(
                    ComponentStatus.FAILED,
                    stage=None,
                    lease=None,
                    reason="Frontend reported a fatal error during execution",
                )
                self.log_event(
                    TransitionEventType.STATUS_TRANSITION,
                    component_id=component_id,
                    from_status=ComponentStatus.IN_STAGE,
                    to_status=ComponentStatus.FAILED,
                    stage=norm_stage,
                    metadata={"reason": "verdict was error"},
                )
                return True

            # Handle CRITICS and INTEGRATION stage adjudication
            if norm_stage in (StageEnum.CRITICS, StageEnum.INTEGRATION):
                if verdict_lower == "revise":
                    comp.increment_revision()
                    if comp.has_exceeded_revisions():
                        # Force proceed after revisions exhausted (max_revisions reached)
                        self.lock_manager.release_stage(norm_stage, component_id, lease_token=lease)
                        comp.active_lease = None
                        comp.current_stage = None
                        comp.force_proceeded = True
                        if comp.revision_count == 0:
                            comp.revision_count = 1
                        reason = f"Forced advancement after {comp.revision_count} revisions"
                        comp.transition_to(
                            ComponentStatus.COMPLETED,
                            stage=None,
                            lease=None,
                            reason=reason,
                        )
                        self.log_event(
                            TransitionEventType.STATUS_TRANSITION,
                            component_id=component_id,
                            from_status=ComponentStatus.IN_STAGE,
                            to_status=ComponentStatus.COMPLETED,
                            stage=norm_stage,
                            metadata={
                                "forced_proceed": True,
                                "revision_count": comp.revision_count,
                                "reason": reason,
                            },
                        )
                        # Unblock downstream DAG dependencies so pipeline can finish
                        ready_ids = self.dag.get_ready_components()
                        for cid in ready_ids:
                            dep_comp = self.dag.get_component(cid)
                            if dep_comp and dep_comp.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                                from_st = dep_comp.status
                                dep_comp.transition_to(ComponentStatus.READY)
                                self.log_event(
                                    TransitionEventType.DEPENDENCY_RESOLVED,
                                    component_id=cid,
                                    from_status=from_st,
                                    to_status=ComponentStatus.READY,
                                )
                                self.queue_manager.enqueue(
                                    StageEnum.DESIGN,
                                    cid,
                                    priority_order=dep_comp.priority_order,
                                )
                        return True
                    else:
                        # Return to CODEGEN (or INTEGRATION) with revision priority bonus
                        rev_stage = StageEnum.INTEGRATION if norm_stage == StageEnum.INTEGRATION else StageEnum.CODEGEN
                        StageHandoverProtocol.execute_handover(
                            component=comp,
                            current_stage=norm_stage,
                            lease_token=lease,
                            lock_manager=self.lock_manager,
                            queue_manager=self.queue_manager,
                            next_stage=rev_stage,
                            is_revision=True,
                        )
                        self.log_event(
                            TransitionEventType.STATUS_TRANSITION,
                            component_id=component_id,
                            from_status=ComponentStatus.IN_STAGE,
                            to_status=comp.status,
                            stage=rev_stage,
                            metadata={"revision": comp.revision_count},
                        )
                        return True

                elif verdict_lower != "pass":
                    comp.increment_revision()
                    if comp.has_exceeded_revisions():
                        # FORCE PROCEED after retries exhausted (max_revisions reached)
                        self.lock_manager.release_stage(norm_stage, component_id, lease_token=lease)
                        comp.active_lease = None
                        comp.current_stage = None
                        comp.force_proceeded = True
                        if comp.revision_count == 0:
                            comp.revision_count = 1
                        reason = f"Forced advancement after failed critics ({comp.revision_count} revisions)"
                        comp.transition_to(
                            ComponentStatus.COMPLETED,
                            stage=None,
                            lease=None,
                            reason=reason,
                        )
                        self.log_event(
                            TransitionEventType.STATUS_TRANSITION,
                            component_id=component_id,
                            from_status=ComponentStatus.IN_STAGE,
                            to_status=ComponentStatus.COMPLETED,
                            stage=norm_stage,
                            metadata={
                                "forced_proceed": True,
                                "revision_count": comp.revision_count,
                                "reason": reason,
                            },
                        )
                        ready_ids = self.dag.get_ready_components()
                        for cid in ready_ids:
                            dep_comp = self.dag.get_component(cid)
                            if dep_comp and dep_comp.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                                from_st = dep_comp.status
                                dep_comp.transition_to(ComponentStatus.READY)
                                self.log_event(
                                    TransitionEventType.DEPENDENCY_RESOLVED,
                                    component_id=cid,
                                    from_status=from_st,
                                    to_status=ComponentStatus.READY,
                                )
                                self.queue_manager.enqueue(
                                    StageEnum.DESIGN,
                                    cid,
                                    priority_order=dep_comp.priority_order,
                                )
                        return True
                    else:
                        # Schedule next self-healing revision
                        rev_stage = StageEnum.INTEGRATION if norm_stage == StageEnum.INTEGRATION else StageEnum.CODEGEN
                        StageHandoverProtocol.execute_handover(
                            component=comp,
                            current_stage=norm_stage,
                            lease_token=lease,
                            lock_manager=self.lock_manager,
                            queue_manager=self.queue_manager,
                            next_stage=rev_stage,
                            is_revision=True,
                        )
                        self.log_event(
                            TransitionEventType.STATUS_TRANSITION,
                            component_id=component_id,
                            from_status=ComponentStatus.IN_STAGE,
                            to_status=comp.status,
                            stage=rev_stage,
                            metadata={"revision": comp.revision_count},
                        )
                        return True

            # Standard sequential progression: CRITICS passing concludes the per-component unit lifecycle
            # In QUICK mode, INTEGRATION passing completely bypasses DOCUMENTATION
            is_quick_mode = getattr(self.config, "generation_mode", "QUICK").upper() == "QUICK"
            if norm_stage == StageEnum.CRITICS:
                next_stg = None
            elif norm_stage == StageEnum.INTEGRATION and is_quick_mode:
                next_stg = None
            else:
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
                # Unblock downstream DAG dependencies
                ready_ids = self.dag.get_ready_components()
                for cid in ready_ids:
                    dep_comp = self.dag.get_component(cid)
                    if dep_comp and dep_comp.status in (ComponentStatus.CREATED, ComponentStatus.PENDING_DEPS):
                        from_st = dep_comp.status
                        dep_comp.transition_to(ComponentStatus.READY)
                        self.log_event(
                            TransitionEventType.DEPENDENCY_RESOLVED,
                            component_id=cid,
                            from_status=from_st,
                            to_status=ComponentStatus.READY,
                        )
                        self.queue_manager.enqueue(
                            StageEnum.DESIGN,
                            cid,
                            priority_order=dep_comp.priority_order,
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
        force_proceed: bool = False,
        revision_count: Optional[int] = None,
    ) -> bool:
        """Convenience method to complete CRITICS stage."""
        return self.complete_stage_execution(
            component_id=component_id,
            stage=StageEnum.CRITICS,
            artifact={"verdict": verdict, "revision_plan": revision_plan},
            adjudication_verdict=verdict,
            revision_plan=revision_plan,
            force_proceed=force_proceed,
            revision_count=revision_count,
        )

    def complete_stage_integration(
        self,
        component_id: str,
        epoch: Optional[int] = None,
        artifact: Optional[Dict[str, Any]] = None,
        verdict: Optional[str] = "pass",
        revision_plan: Optional[str] = None,
        force_proceed: bool = False,
        revision_count: Optional[int] = None,
    ) -> bool:
        """Convenience method to complete INTEGRATION stage."""
        return self.complete_stage_execution(
            component_id=component_id,
            stage=StageEnum.INTEGRATION,
            artifact=artifact,
            adjudication_verdict=verdict,
            revision_plan=revision_plan,
            force_proceed=force_proceed,
            revision_count=revision_count,
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
