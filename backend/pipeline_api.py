from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from autodev_pipeline.scheduler import PipelineScheduler
from autodev_pipeline.models import (
    ComponentStateRecord,
    StageEnum,
    ComponentStatus,
    PipelineConfig,
    CycleResolutionPolicy,
)

router = APIRouter()
scheduler = PipelineScheduler(config=PipelineConfig(cycle_policy=CycleResolutionPolicy.ABORT))

class PipelineInitInput(BaseModel):
    components: List[Dict[str, Any]]
    generation_mode: Optional[str] = None
    mode: Optional[str] = None

PipelineInitRequest = PipelineInitInput

class CompleteStageInput(BaseModel):
    component_id: str
    stage: str
    verdict: Optional[str] = "pass"
    revision_plan: Optional[str] = None
    force_proceed: Optional[bool] = False
    revision_count: Optional[int] = None
    mode: Optional[str] = None
    generation_mode: Optional[str] = None
    dynamic_budget: Optional[int] = None

CompleteStageRequest = CompleteStageInput


class PipelinePauseRequest(BaseModel):
    session_id: Optional[str] = None
    sessionId: Optional[str] = None
    reason: Optional[str] = "User requested development pause"
    active_phase: Optional[str] = None
    activePhase: Optional[str] = None
    active_component_id: Optional[str] = None
    activeComponentId: Optional[str] = None

PipelinePauseInput = PipelinePauseRequest


class PipelinePauseResponse(BaseModel):
    status: str = "paused"
    paused: Optional[bool] = True
    paused_at: float
    active_leases_count: int
    already_paused: Optional[bool] = False
    message: Optional[str] = "Pipeline successfully paused"


class PipelineResumeRequest(BaseModel):
    session_id: Optional[str] = None
    sessionId: Optional[str] = None
    target_phase: Optional[str] = None
    targetPhase: Optional[str] = None
    target_stage: Optional[str] = None
    targetStage: Optional[str] = None
    modifications_detected: Optional[bool] = None
    modificationsDetected: Optional[bool] = None
    earliest_phase: Optional[str] = None
    earliestPhase: Optional[str] = None
    earliest_component_id: Optional[str] = None
    earliestComponentId: Optional[str] = None
    earliest_target: Optional[str] = None
    earliestTarget: Optional[str] = None

PipelineResumeInput = PipelineResumeRequest


class PipelineResumeResponse(BaseModel):
    status: str = "resumed"
    paused: Optional[bool] = False
    paused_duration: float
    extended_leases_count: int
    already_active: Optional[bool] = False
    message: Optional[str] = "Pipeline successfully resumed"


class PipelineRestartRequest(BaseModel):
    session_id: Optional[str] = None
    sessionId: Optional[str] = None
    reason: Optional[str] = "user_restart"

PipelineRestartInput = PipelineRestartRequest


class PipelineRestartResponse(BaseModel):
    status: str = "restarted"
    cleared_components: int
    released_reservations: int
    cleared_files: Optional[List[str]] = None
    message: Optional[str] = "Pipeline state completely purged"


class PipelineRewindRequest(BaseModel):
    component_id: str
    target_stage: Optional[str] = "CRITICS"
    invalidate_dependents: Optional[bool] = True
    subsequent_component_ids: Optional[List[str]] = None
    session_id: Optional[str] = None
    sessionId: Optional[str] = None

PipelineRewindInput = PipelineRewindRequest


class PipelineRewindResponse(BaseModel):
    success: bool
    component_id: str
    target_stage: str
    invalidated_dependents: List[str]
    message: Optional[str] = "Component successfully rewound"


def print_queue_status():
    from collections import defaultdict
    stage_counts = defaultdict(int)
    for c in scheduler.components.values():
        if c.status == ComponentStatus.COMPLETED:
            stage_counts["COMPLETED"] += 1
        elif c.status == ComponentStatus.IN_STAGE:
            stage_name = c.current_stage.name if c.current_stage else "UNKNOWN"
            stage_counts[f"ACTIVE IN {stage_name}"] += 1
    
    # Check queues
    for stage in StageEnum.linear_order():
        norm_stage, queue, _ = scheduler.queue_manager._get_stage_queue(stage)
        if queue:
            stage_counts[f"QUEUED FOR {stage.name}"] += len(queue)
            
    print("\n--------------------------------------------------")
    print("[PIPELINE] Pipeline Queue Status:")
    for k, v in stage_counts.items():
        print(f"  - {k}: {v}")
    print("--------------------------------------------------\n")

@router.post("/api/pipeline/init")
def pipeline_init(payload: PipelineInitInput):
    global scheduler
    from key_balancer import get_generation_mode, get_key_reservation_manager
    get_key_reservation_manager().clear_all()
    active_mode = payload.generation_mode or payload.mode or get_generation_mode() or "QUICK"
    mode = str(active_mode).upper()
    max_revs = 3
    scheduler = PipelineScheduler(
        config=PipelineConfig(
            max_revisions=max_revs,
            generation_mode=mode,
            cycle_policy=CycleResolutionPolicy.ABORT
        )
    )
    seen_ids = set()
    records = []
    for c in payload.components:
        cid = (c.get("component_id") or "").strip()
        if not cid:
            raise HTTPException(status_code=400, detail="Component ID cannot be empty")
        if cid in seen_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate component_id detected: {cid}")
        seen_ids.add(cid)
        deps = c.get("dependencies") or c.get("dependencies_on") or []
        records.append(ComponentStateRecord(
            component_id=cid,
            name=c.get("component_name", cid),
            dependencies=deps,
            priority_order=c.get("priority_order", 0),
            max_revisions=max_revs,
        ))

    valid_ids = set(seen_ids)
    for r in records:
        for dep in r.dependencies:
            if dep == r.component_id:
                raise HTTPException(status_code=400, detail=f"Component '{r.component_id}' cannot depend on itself")
            if dep not in valid_ids:
                raise HTTPException(status_code=400, detail=f"Component '{r.component_id}' references non-existent dependency: '{dep}'")

    success = scheduler.register_components(records)
    if not success:
        raise HTTPException(status_code=400, detail="Cyclic dependencies detected in components")
    return {"status": "ok", "mode": mode, "max_revisions": max_revs}

@router.get("/api/pipeline/tick")
@router.post("/api/pipeline/tick")
def pipeline_tick():
    dispatched = scheduler.tick_schedule()
    assignments = []
    for comp_id, stage, epoch in dispatched:
        assignments.append({
            "component_id": comp_id,
            "stage": stage.value if isinstance(stage, StageEnum) else str(stage),
            "epoch": epoch
        })
    return {"assignments": assignments}


@router.post("/api/pipeline/pause", response_model=PipelinePauseResponse)
def pipeline_pause(payload: Optional[PipelinePauseRequest] = None):
    """
    Freezes the pipeline scheduler, halts stage dispatches, and freezes lease TTL timers
    in StageLockManager and StageSemaphore to suppress watchdog evictions.
    """
    global scheduler
    active_phase = payload.active_phase or payload.activePhase if payload else None
    active_comp = payload.active_component_id or payload.activeComponentId if payload else None

    if scheduler is None:
        import time as _t
        phase_display = active_phase or "requirements"
        comp_display = active_comp or "none"
        print(f"[PAUSE] Development paused. Active phase: {phase_display}, active component: {comp_display}")
        return PipelinePauseResponse(
            status="paused",
            paused=True,
            paused_at=_t.time(),
            active_leases_count=0,
            already_paused=False,
            message="Pipeline successfully paused",
        )

    res = scheduler.pause(active_phase=active_phase, active_component_id=active_comp)
    return PipelinePauseResponse(
        status="paused",
        paused=True,
        paused_at=res["paused_at"],
        active_leases_count=res["active_leases_count"],
        already_paused=res.get("already_paused", False),
        message="Pipeline was already paused" if res.get("already_paused") else "Pipeline successfully paused",
    )


@router.post("/api/pipeline/resume", response_model=PipelineResumeResponse)
def pipeline_resume(payload: Optional[PipelineResumeRequest] = None):
    """
    Resumes pipeline scheduler, extends all active stage leases by elapsed paused duration,
    and enables stage dispatch on subsequent ticks.
    """
    global scheduler

    target_stage = None
    mods_detected = False
    earliest_target = None

    if payload:
        target_stage = payload.target_stage or payload.targetStage or payload.target_phase or payload.targetPhase
        mods_detected = bool(payload.modifications_detected or payload.modificationsDetected)
        earliest_target = payload.earliest_target or payload.earliestTarget
        earliest_comp = payload.earliest_component_id or payload.earliestComponentId
        earliest_phase = payload.earliest_phase or payload.earliestPhase
        if not earliest_target:
            if earliest_comp:
                earliest_target = f"component {earliest_comp} ({earliest_phase or target_stage})"
            elif earliest_phase:
                earliest_target = f"phase {earliest_phase}"

    if scheduler is None:
        target_display = target_stage or "requirements"
        mods_str = "yes" if mods_detected else "no"
        rewind_info = earliest_target or "none"
        print(f"[RESUME] Development resumed. Target phase/stage: {target_display}, modifications detected: {mods_str}, earliest rewind target: {rewind_info}")
        return PipelineResumeResponse(
            status="resumed",
            paused=False,
            paused_duration=0.0,
            extended_leases_count=0,
            already_active=False,
            message="Pipeline successfully resumed",
        )

    res = scheduler.resume(
        target_stage=target_stage,
        modifications_detected=mods_detected,
        earliest_target=earliest_target,
    )
    return PipelineResumeResponse(
        status="resumed",
        paused=False,
        paused_duration=res["paused_duration"],
        extended_leases_count=res["extended_leases_count"],
        already_active=res.get("already_active", False),
        message="Pipeline was not paused (already active)" if res.get("already_active") else "Pipeline successfully resumed",
    )


@router.post("/api/pipeline/rewind", response_model=PipelineRewindResponse)
def pipeline_rewind(payload: PipelineRewindRequest):
    """
    Rewinds a specific component's lifecycle to a target stage (CRITICS, CODEGEN, DESIGN)
    and invalidates downstream/subsequent components so they redevelop cleanly.
    """
    global scheduler
    if scheduler is None:
        raise HTTPException(
            status_code=400,
            detail="Pipeline scheduler is not initialized. Please call /api/pipeline/init first."
        )

    res = scheduler.rewind_component(
        component_id=payload.component_id,
        target_stage=payload.target_stage or "CRITICS",
        invalidate_dependents=bool(payload.invalidate_dependents),
        subsequent_component_ids=payload.subsequent_component_ids or [],
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to rewind component"))

    return PipelineRewindResponse(
        success=True,
        component_id=res["component_id"],
        target_stage=res["target_stage"],
        invalidated_dependents=res.get("invalidated_dependents", []),
        message=f"Component '{payload.component_id}' rewound to stage {res['target_stage']}",
    )


@router.post("/api/pipeline/restart", response_model=PipelineRestartResponse)
def pipeline_restart(payload: Optional[PipelineRestartRequest] = None):
    """
    Executes a complete, atomic backend state purge:
    1. Releases all per-stage API key reservations in KeyReservationManager.
    2. Resets PipelineScheduler DAG, queues, and stage semaphore leases.
    3. Truncates or deletes all on-disk pipeline_state.json and snapshot files.
    4. Unpauses the pipeline if previously paused.
    5. Replaces global scheduler singleton with a clean instance.
    """
    global scheduler
    import threading
    from pathlib import Path
    from key_balancer import get_key_reservation_manager, get_generation_mode

    # 1. Clear key reservations
    key_mgr = get_key_reservation_manager()
    lock = getattr(key_mgr, "_lock", None) or threading.RLock()
    with lock:
        reservations = getattr(key_mgr, "_reservations", {})
        released_reservations = sum(len(res) for res in reservations.values())
        key_mgr.clear_all()

    # 2. Reset scheduler in-memory state
    cleared_components = 0
    if scheduler is not None:
        with scheduler._scheduler_lock:
            cleared_components = len(scheduler.components)
            scheduler.reset()
    else:
        print("[RESTART] Development restarted. Restarting development from requirements phase.")

    # 3. Instantiate fresh scheduler
    active_mode = get_generation_mode() or "QUICK"
    mode = str(active_mode).upper()
    scheduler = PipelineScheduler(
        config=PipelineConfig(
            max_revisions=3,
            generation_mode=mode,
            cycle_policy=CycleResolutionPolicy.ABORT,
        )
    )

    # 4. Truncate / delete on-disk state and snapshot files safely on Windows
    target_files = [
        "pipeline_state.json",
        "backend/pipeline_state.json",
        "pipeline_snapshot.json",
        "backend/pipeline_snapshot.json",
    ]
    here = Path(__file__).resolve().parent
    repo_root = here.parent
    base_dirs = [Path.cwd(), here, repo_root]

    cleared_files = []
    seen_paths = set()
    for b_dir in base_dirs:
        for f_name in target_files:
            abs_p = (b_dir / f_name).resolve()
            if abs_p in seen_paths:
                continue
            seen_paths.add(abs_p)
            if abs_p.exists():
                try:
                    abs_p.unlink()
                    cleared_files.append(str(abs_p))
                except OSError:
                    try:
                        with open(abs_p, "w", encoding="utf-8") as f:
                            f.truncate(0)
                        cleared_files.append(str(abs_p))
                    except OSError:
                        pass

    return PipelineRestartResponse(
        status="restarted",
        cleared_components=cleared_components,
        released_reservations=released_reservations,
        cleared_files=cleared_files,
        message="Pipeline state completely purged",
    )

@router.post("/api/pipeline/complete")
def pipeline_complete(payload: CompleteStageInput):
    from key_balancer import get_key_reservation_manager
    get_key_reservation_manager().release_reservation(payload.stage, payload.component_id)

    success = scheduler.complete_stage_execution(
        component_id=payload.component_id,
        stage=payload.stage,
        adjudication_verdict=payload.verdict,
        force_proceed=bool(payload.force_proceed),
        revision_count=payload.revision_count,
        dynamic_budget=payload.dynamic_budget,
    )
    if success:
        from key_balancer import get_generation_mode, resolve_models_for_mode, format_phase_transition
        mode = payload.mode or payload.generation_mode or get_generation_mode() or "QUICK"
        primary_model, _ = resolve_models_for_mode(mode)
        comp_record = scheduler.components.get(payload.component_id)
        comp_name = comp_record.name if comp_record else payload.component_id
        eff_comp_id = payload.component_id or comp_name
        stage_upper = (payload.stage or "").upper()
        verdict_lower = (payload.verdict or "pass").lower()

        if stage_upper == "CRITICS":
            if verdict_lower == "pass":
                print(format_phase_transition(comp_name, "CRITICS", "COMPLETED", primary_model, "CRITICS", mode=mode, extra="Verdict: PASS", component_id=eff_comp_id))
            elif verdict_lower == "revise":
                extra_msg = f"Revision {payload.revision_count}" if payload.revision_count else "Revision"
                codegen_model = "gemini-3.5-flash-lite"
                print(format_phase_transition(comp_name, "CRITICS", "CODEGEN", codegen_model, "CODEGEN", mode=mode, extra=extra_msg, component_id=eff_comp_id))
    if scheduler.is_pipeline_finished():
        print("development completed")
    return {"success": success}
