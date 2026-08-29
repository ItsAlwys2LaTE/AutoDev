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

class CompleteStageInput(BaseModel):
    component_id: str
    stage: str
    verdict: Optional[str] = "pass"

@router.post("/api/pipeline/init")
def pipeline_init(payload: PipelineInitInput):
    global scheduler
    scheduler = PipelineScheduler(config=PipelineConfig(cycle_policy=CycleResolutionPolicy.ABORT))
    records = []
    for c in payload.components:
        records.append(ComponentStateRecord(
            component_id=c.get("component_id", ""),
            name=c.get("component_name", c.get("component_id", "Unnamed")),
            dependencies=c.get("dependencies") or c.get("dependencies_on") or [],
            priority_order=c.get("priority_order", 0)
        ))
    success = scheduler.register_components(records)
    if not success:
        raise HTTPException(status_code=400, detail="Cyclic dependencies detected in components")
    return {"status": "ok"}

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
        adjudication_verdict=payload.verdict
    )
    return {"success": success}
