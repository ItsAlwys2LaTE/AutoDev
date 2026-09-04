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
    generation_mode: Optional[str] = "QUICK"
    mode: Optional[str] = None

PipelineInitRequest = PipelineInitInput

class CompleteStageInput(BaseModel):
    component_id: str
    stage: str
    verdict: Optional[str] = "pass"
    force_proceed: Optional[bool] = False
    generation_mode: Optional[str] = "QUICK"
    mode: Optional[str] = None

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
    mode = (payload.generation_mode or payload.mode or "QUICK").upper()
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
    if dispatched:
        print_queue_status()
    return {"assignments": assignments}

@router.post("/api/pipeline/complete")
def pipeline_complete(payload: CompleteStageInput):
    success = scheduler.complete_stage_execution(
        component_id=payload.component_id,
        stage=payload.stage,
        adjudication_verdict=payload.verdict,
        force_proceed=bool(payload.force_proceed),
    )
    print_queue_status()
    return {"success": success}
