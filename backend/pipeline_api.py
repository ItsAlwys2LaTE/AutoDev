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
    print("?? PIPELINE QUEUE STATUS:")
    for k, v in stage_counts.items():
        print(f"  - {k}: {v}")
    print("--------------------------------------------------\n")

@router.post("/api/pipeline/init")
def pipeline_init(payload: PipelineInitInput):
    global scheduler
    from key_balancer import get_generation_mode
    active_mode = payload.generation_mode or payload.mode or get_generation_mode() or "QUICK"
    mode = str(active_mode).upper()
    max_revs = 2 if mode == "QUICK" else 3
    scheduler = PipelineScheduler(
        config=PipelineConfig(
            max_revisions=max_revs,
            generation_mode=mode,
            cycle_policy=CycleResolutionPolicy.ABORT
        )
    )
    records = []
    for c in payload.components:
        records.append(ComponentStateRecord(
            component_id=c.get("component_id", ""),
            name=c.get("component_name", c.get("component_id", "Unnamed")),
            dependencies=c.get("dependencies") or c.get("dependencies_on") or [],
            priority_order=c.get("priority_order", 0),
            max_revisions=max_revs,
        ))
    success = scheduler.register_components(records)
    if not success:
        raise HTTPException(status_code=400, detail="Cyclic dependencies detected in components")
    return {"status": "ok", "mode": mode, "max_revisions": max_revs}

@router.get("/api/pipeline/tick")
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

@router.post("/api/pipeline/complete")
def pipeline_complete(payload: CompleteStageInput):
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
        stage_upper = (payload.stage or "").upper()
        verdict_lower = (payload.verdict or "pass").lower()

        if stage_upper == "CRITICS":
            if verdict_lower == "pass":
                print(format_phase_transition(comp_name, "CRITICS", "COMPLETED", primary_model, "CRITICS", mode=mode, extra="Verdict: PASS"))
            elif verdict_lower == "revise":
                extra_msg = f"Revision {payload.revision_count}" if payload.revision_count else "Revision"
                codegen_model = "gemini-3.7-flash"
                print(format_phase_transition(comp_name, "CRITICS", "CODEGEN", codegen_model, "CODEGEN", mode=mode, extra=extra_msg))
    if scheduler.is_pipeline_finished():
        print("development completed")
    return {"success": success}
