"""
AutoDev Robust Pipeline Algorithm Package.

Formal concurrency, DAG dependency scheduling, and atomic state recovery engine
for multi-agent software development systems.
"""

from autodev_pipeline.models import (
    StageEnum,
    ComponentStatus,
    StageLockStatus,
    CycleResolutionPolicy,
    TransitionEventType,
    LeaseToken,
    ComponentStateRecord,
    PipelineConfig,
    StateTransitionEvent,
    PipelineSnapshot,
)

from autodev_pipeline.dag_engine import (
    DAGValidationResult,
    TopologicalPlan,
    CycleResolutionResult,
    PipelineDAG,
)

from autodev_pipeline.concurrency import (
    StageMutex,
    StageLockManager,
    QueueItem,
    StageQueueManager,
    StageHandoverProtocol,
)

from autodev_pipeline.fault_tolerance import (
    MultiTierWatchdog,
    PoisonPillCircuitBreaker,
    CascadePauseEngine,
    WriteAheadStateStore,
    CrashRecoveryEngine,
    FaultToleranceManager,
)

from autodev_pipeline.scheduler import (
    PipelineScheduler,
)

__all__ = [
    # Models & Enums (M1)
    "StageEnum",
    "ComponentStatus",
    "StageLockStatus",
    "CycleResolutionPolicy",
    "TransitionEventType",
    "LeaseToken",
    "ComponentStateRecord",
    "PipelineConfig",
    "StateTransitionEvent",
    "PipelineSnapshot",
    # DAG Engine & Cycle Resolution (M2)
    "DAGValidationResult",
    "TopologicalPlan",
    "CycleResolutionResult",
    "PipelineDAG",
    # Concurrency Controller & Stage Handover (M3)
    "StageMutex",
    "StageLockManager",
    "QueueItem",
    "StageQueueManager",
    "StageHandoverProtocol",
    # Fault Tolerance & Crash Recovery (M4)
    "MultiTierWatchdog",
    "PoisonPillCircuitBreaker",
    "CascadePauseEngine",
    "WriteAheadStateStore",
    "CrashRecoveryEngine",
    "FaultToleranceManager",
    # Unified Pipeline Scheduler (M3 & M4)
    "PipelineScheduler",
]
