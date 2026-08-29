import sys
import os
sys.path.append(os.path.abspath('backend'))

from autodev_pipeline.scheduler import PipelineScheduler
from autodev_pipeline.models import ComponentStateRecord, PipelineConfig, CycleResolutionPolicy

scheduler = PipelineScheduler(config=PipelineConfig(cycle_policy=CycleResolutionPolicy.ABORT))

c1 = ComponentStateRecord(component_id="c1", name="C1")
c2 = ComponentStateRecord(component_id="c2", name="C2", dependencies=["c1"])
c3 = ComponentStateRecord(component_id="c3", name="C3", dependencies=["c1"])

scheduler.register_components([c1, c2, c3])

print("TICK 1:", scheduler.tick_schedule())
scheduler.complete_stage_execution("c1", "DESIGN", {"some": "artifact"})
print("TICK 2:", scheduler.tick_schedule())
scheduler.complete_stage_execution("c1", "CODEGEN", {"some": "artifact"})
print("TICK 3:", scheduler.tick_schedule())
scheduler.complete_stage_execution("c1", "CRITICS", {"some": "artifact"}, adjudication_verdict="pass")
print("TICK 4:", scheduler.tick_schedule())
