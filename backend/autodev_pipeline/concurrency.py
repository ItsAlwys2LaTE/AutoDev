"""
AutoDev Concurrency Engine: Lease-Backed Mutexes, Monotonic Epoch Fencing,
Per-Stage Priority Queues, and Atomic 2-Phase Stage Handover Protocol.

File: src/autodev_pipeline/concurrency.py
Milestone: M3 (Concurrency Controller & Stage Handover Protocol)
"""

from __future__ import annotations

import heapq
import threading
import time
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import uuid
from dataclasses import dataclass, field

from autodev_pipeline.models import (
    ComponentStateRecord,
    ComponentStatus,
    LeaseToken,
    PipelineConfig,
    StageEnum,
    StageLockStatus,
)


def _normalize_stage(stage: Union[StageEnum, str]) -> StageEnum:
    """Normalizes StageEnum or string representation to StageEnum."""
    if isinstance(stage, StageEnum):
        return stage
    if isinstance(stage, str):
        try:
            return StageEnum(stage.upper())
        except ValueError:
            # Try case-insensitive match against StageEnum values
            for s in StageEnum:
                if s.value.upper() == stage.upper():
                    return s
            raise ValueError(f"Unknown stage name: '{stage}'")
    raise TypeError(f"Stage must be StageEnum or str, got {type(stage)}")


class StageMutex:
    """
    Thread-safe, lease-backed mutual exclusion lock for a single pipeline stage.
    Enforces <= 1 occupancy with strictly monotonic epoch fencing and TTL expiration.
    """

    def __init__(self, stage: Union[StageEnum, str], default_lease_duration: float = 30.0):
        self.stage: StageEnum = _normalize_stage(stage)
        self.default_lease_duration: float = float(default_lease_duration)
        self._lock: threading.RLock = threading.RLock()
        self._current_holder: Optional[str] = None
        self._active_lease: Optional[LeaseToken] = None
        self._epoch_counter: int = 0
        self._status: StageLockStatus = StageLockStatus.FREE

    @property
    def status(self) -> StageLockStatus:
        """Current lock status under thread safety."""
        with self._lock:
            return self._status

    @property
    def current_holder(self) -> Optional[str]:
        """Component ID currently holding the lock, or None."""
        with self._lock:
            return self._current_holder

    @property
    def current_epoch(self) -> int:
        """Current monotonic epoch sequence counter for this stage."""
        with self._lock:
            return self._epoch_counter

    @property
    def active_lease(self) -> Optional[LeaseToken]:
        """Active LeaseToken instance, or None if lock is free."""
        with self._lock:
            return self._active_lease

    def try_acquire(
        self,
        component_id: str,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Optional[LeaseToken]:
        """
        Attempts to acquire exclusive occupancy of the stage for component_id.
        Returns a newly minted LeaseToken on success, or None if currently occupied.
        """
        with self._lock:
            now = time.time() if current_time is None else float(current_time)
            dur = self.default_lease_duration if duration_sec is None else float(duration_sec)

            # Check if active lease exists and is still unexpired
            if self._active_lease is not None:
                if self._active_lease.is_valid(now):
                    return None  # Stage currently held by a valid active lease

                # Active lease has expired: clean up state before granting to new requestor
                self._active_lease = None
                self._current_holder = None
                self._status = StageLockStatus.FREE

            # Increment monotonic epoch fencing token
            self._epoch_counter += 1
            token = LeaseToken(
                token_id=str(uuid.uuid4()),
                component_id=component_id,
                stage=self.stage,
                epoch=self._epoch_counter,
                acquired_at=now,
                expires_at=now + dur,
                lease_duration_sec=dur,
            )

            self._current_holder = component_id
            self._active_lease = token
            self._status = StageLockStatus.HELD
            return token

    def renew_lease(
        self,
        component_id: str,
        lease_token: LeaseToken,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Optional[LeaseToken]:
        """
        Renews an active lease if the presented token matches epoch, token_id, and component_id.
        Returns the renewed LeaseToken, or None if validation fails.
        """
        with self._lock:
            now = time.time() if current_time is None else float(current_time)
            dur = self.default_lease_duration if duration_sec is None else float(duration_sec)

            if self._active_lease is None:
                return None
            if self._active_lease.component_id != component_id:
                return None
            if (
                self._active_lease.token_id != lease_token.token_id
                or self._active_lease.epoch != lease_token.epoch
            ):
                return None
            if not self._active_lease.is_valid(now):
                return None

            renewed = self._active_lease.renew(duration_sec=dur, current_time=now)
            self._active_lease = renewed
            return renewed

    def release(
        self,
        component_id: str,
        lease_token: Optional[LeaseToken] = None,
        epoch: Optional[int] = None,
        current_time: Optional[float] = None,
    ) -> bool:
        """
        Releases the stage mutex. Validates that the releasing party holds the matching active lease.
        Rejects stale release attempts.
        """
        with self._lock:
            if self._active_lease is None:
                return False

            if self._active_lease.component_id != component_id:
                return False

            if lease_token is not None:
                if (
                    self._active_lease.token_id != lease_token.token_id
                    or self._active_lease.epoch != lease_token.epoch
                ):
                    return False
            elif epoch is not None:
                if self._active_lease.epoch != epoch:
                    return False

            self._active_lease = None
            self._current_holder = None
            self._status = StageLockStatus.FREE
            return True

    def force_revoke(self, reason: str = "WATCHDOG_EVICTION") -> Optional[LeaseToken]:
        """
        Forcibly revokes the active lease, increments the epoch to fence out late commits,
        and frees the stage mutex.
        Returns the evicted LeaseToken or None if not held.
        """
        with self._lock:
            evicted = self._active_lease
            self._epoch_counter += 1  # Epoch increment prevents stale late writes
            self._active_lease = None
            self._current_holder = None
            self._status = StageLockStatus.FREE
            return evicted

    def is_occupied(self, current_time: Optional[float] = None) -> bool:
        """
        Checks whether the stage is currently occupied by an active, unexpired lease.
        If an active lease has expired, cleans it up and returns False.
        """
        with self._lock:
            now = time.time() if current_time is None else float(current_time)
            if self._active_lease is None:
                return False
            if not self._active_lease.is_valid(now):
                # Clean up expired lease state
                self._active_lease = None
                self._current_holder = None
                self._status = StageLockStatus.FREE
                return False
            return True


class StageLockManager:
    """
    Centralized coordinator managing stage mutexes for all discrete pipeline stages:
    DESIGN, CODEGEN, CRITICS, INTEGRATION, DOCUMENTATION.
    Provides atomic queries, lease renewals, releases, and expired lease sweeps.
    """

    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self._mutexes: Dict[StageEnum, StageMutex] = {
            stage: StageMutex(stage, default_lease_duration=self.config.lease_duration_sec)
            for stage in StageEnum.linear_order()
        }
        self._manager_lock: threading.RLock = threading.RLock()

    def get_mutex(self, stage: Union[StageEnum, str]) -> StageMutex:
        """Retrieves the StageMutex for the requested stage."""
        norm_stage = _normalize_stage(stage)
        with self._manager_lock:
            if norm_stage not in self._mutexes:
                self._mutexes[norm_stage] = StageMutex(
                    norm_stage, default_lease_duration=self.config.lease_duration_sec
                )
            return self._mutexes[norm_stage]

    def try_acquire_stage(
        self,
        stage: Union[StageEnum, str],
        component_id: str,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Optional[LeaseToken]:
        """Attempts to acquire exclusive lock for the specified stage."""
        return self.get_mutex(stage).try_acquire(
            component_id, duration_sec=duration_sec, current_time=current_time
        )

    def renew_stage_lease(
        self,
        stage: Union[StageEnum, str],
        component_id: str,
        lease_token: LeaseToken,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Optional[LeaseToken]:
        """Renews an active stage lease."""
        return self.get_mutex(stage).renew_lease(
            component_id, lease_token, duration_sec=duration_sec, current_time=current_time
        )

    def release_stage(
        self,
        stage: Union[StageEnum, str],
        component_id: str,
        lease_token: Optional[LeaseToken] = None,
        epoch: Optional[int] = None,
        current_time: Optional[float] = None,
    ) -> bool:
        """Releases the lock on the specified stage."""
        return self.get_mutex(stage).release(
            component_id, lease_token=lease_token, epoch=epoch, current_time=current_time
        )

    def force_revoke_stage(
        self,
        stage: Union[StageEnum, str],
        reason: str = "WATCHDOG_EVICTION",
    ) -> Optional[LeaseToken]:
        """Forcibly evicts the stage holder and bumps epoch."""
        return self.get_mutex(stage).force_revoke(reason=reason)

    def is_stage_occupied(
        self,
        stage: Union[StageEnum, str],
        current_time: Optional[float] = None,
    ) -> bool:
        """Checks if stage is currently occupied by a valid unexpired lease."""
        return self.get_mutex(stage).is_occupied(current_time=current_time)

    def get_stage_holder(self, stage: Union[StageEnum, str]) -> Optional[str]:
        """Returns the current occupant of the stage or None."""
        return self.get_mutex(stage).current_holder

    def get_stage_epoch(self, stage: Union[StageEnum, str]) -> int:
        """Returns the current epoch of the stage mutex."""
        return self.get_mutex(stage).current_epoch

    def get_active_leases(self) -> Dict[str, Optional[LeaseToken]]:
        """Returns mapping of stage value to active LeaseToken or None."""
        with self._manager_lock:
            return {stage.value: mutex.active_lease for stage, mutex in self._mutexes.items()}

    def check_and_clean_expired_leases(
        self,
        current_time: Optional[float] = None,
    ) -> List[Tuple[StageEnum, str, LeaseToken]]:
        """
        Scans all stages, identifying and revoking expired leases.
        Returns list of tuples: (StageEnum, component_id, evicted_lease).
        """
        expired_list: List[Tuple[StageEnum, str, LeaseToken]] = []
        now = time.time() if current_time is None else float(current_time)
        with self._manager_lock:
            for stage, mutex in self._mutexes.items():
                with mutex._lock:
                    if mutex._active_lease is not None and not mutex._active_lease.is_valid(now):
                        evicted_lease = mutex.force_revoke(reason="LEASE_TTL_EXPIRED")
                        if evicted_lease:
                            expired_list.append((stage, evicted_lease.component_id, evicted_lease))
        return expired_list


@dataclass(order=True)
class QueueItem:
    """
    Comparable wrapper for priority queue dispatching.
    Lower priority_score = higher dequeue priority.
    Monotonic arrival_sequence acts as FIFO tie-breaker.
    """
    priority_score: int              # Negative of effective priority for min-heap
    arrival_sequence: int            # Monotonic insertion sequence counter
    component_id: str = field(compare=False)
    enqueued_at: float = field(compare=False, default_factory=time.time)
    metadata: Dict[str, Any] = field(compare=False, default_factory=dict)


class StageQueueManager:
    """
    Thread-safe manager for per-stage priority and FIFO queues.
    Maintains dedicated queues for DESIGN, CODEGEN, CRITICS, INTEGRATION, DOCUMENTATION.
    Prevents duplicate enqueueing and supports dynamic removal.
    """

    def __init__(self) -> None:
        self._queues: Dict[StageEnum, List[QueueItem]] = {
            stage: [] for stage in StageEnum.linear_order()
        }
        self._enqueued_components: Dict[StageEnum, Set[str]] = {
            stage: set() for stage in StageEnum.linear_order()
        }
        self._sequence_counter: int = 0
        self._queue_lock: threading.RLock = threading.RLock()

    def _get_stage_queue(self, stage: Union[StageEnum, str]) -> Tuple[StageEnum, List[QueueItem], Set[str]]:
        norm_stage = _normalize_stage(stage)
        if norm_stage not in self._queues:
            self._queues[norm_stage] = []
            self._enqueued_components[norm_stage] = set()
        return norm_stage, self._queues[norm_stage], self._enqueued_components[norm_stage]

    def enqueue(
        self,
        stage: Union[StageEnum, str],
        component_id: str,
        priority_order: int = 0,
        is_revision: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Enqueues component into stage queue. Revisions receive a +1000 priority bonus.
        Returns True if enqueued, False if component is already in this stage queue.
        """
        with self._queue_lock:
            norm_stage, queue, enqueued_set = self._get_stage_queue(stage)
            if component_id in enqueued_set:
                return False  # Already queued in this stage

            self._sequence_counter += 1
            # Revisions get a 1000-point priority boost to clear feedback loops fast
            effective_priority = int(priority_order) + (1000 if is_revision else 0)
            score = -effective_priority  # Inverted for min-heap

            item = QueueItem(
                priority_score=score,
                arrival_sequence=self._sequence_counter,
                component_id=component_id,
                enqueued_at=time.time(),
                metadata=metadata or {},
            )

            heapq.heappush(queue, item)
            enqueued_set.add(component_id)
            return True

    def dequeue(self, stage: Union[StageEnum, str]) -> Optional[str]:
        """
        Pops and returns the highest-priority component ID from stage queue.
        Returns None if queue is empty.
        """
        with self._queue_lock:
            norm_stage, queue, enqueued_set = self._get_stage_queue(stage)
            if not queue:
                return None
            item = heapq.heappop(queue)
            enqueued_set.discard(item.component_id)
            return item.component_id

    def peek(self, stage: Union[StageEnum, str]) -> Optional[str]:
        """
        Returns the next component ID in queue without removing it.
        Returns None if queue is empty.
        """
        with self._queue_lock:
            norm_stage, queue, _ = self._get_stage_queue(stage)
            if not queue:
                return None
            return queue[0].component_id

    def remove(self, stage: Union[StageEnum, str], component_id: str) -> bool:
        """
        Removes a specific component from a stage queue (e.g. on stall/quarantine).
        Returns True if found and removed, False otherwise.
        """
        with self._queue_lock:
            norm_stage, queue, enqueued_set = self._get_stage_queue(stage)
            if component_id not in enqueued_set:
                return False
            self._queues[norm_stage] = [
                item for item in queue if item.component_id != component_id
            ]
            heapq.heapify(self._queues[norm_stage])
            enqueued_set.discard(component_id)
            return True

    def remove_from_all_queues(self, component_id: str) -> List[StageEnum]:
        """
        Removes component from every stage queue.
        Returns list of stages from which the component was removed.
        """
        removed_stages: List[StageEnum] = []
        with self._queue_lock:
            for stage in list(self._queues.keys()):
                if self.remove(stage, component_id):
                    removed_stages.append(stage)
        return removed_stages

    def is_enqueued(self, stage: Union[StageEnum, str], component_id: str) -> bool:
        """Checks if component is currently queued in the specified stage."""
        with self._queue_lock:
            norm_stage, _, enqueued_set = self._get_stage_queue(stage)
            return component_id in enqueued_set

    def queue_size(self, stage: Union[StageEnum, str]) -> int:
        """Returns the number of components queued in the specified stage."""
        with self._queue_lock:
            norm_stage, queue, _ = self._get_stage_queue(stage)
            return len(queue)

    def size(self, stage: Union[StageEnum, str]) -> int:
        """Alias for queue_size."""
        return self.queue_size(stage)

    def items(self, stage: Union[StageEnum, str]) -> List[str]:
        """Returns sorted list of component IDs queued in the specified stage."""
        with self._queue_lock:
            norm_stage, queue, _ = self._get_stage_queue(stage)
            return [item.component_id for item in sorted(queue)]

    def get_queue_snapshot(self) -> Dict[str, List[str]]:
        """
        Returns a read-only snapshot of all component IDs queued across all stages.
        """
        with self._queue_lock:
            return {
                stage.value: [item.component_id for item in sorted(self._queues[stage])]
                for stage in StageEnum.linear_order()
                if stage in self._queues
            }


class StageHandoverProtocol:
    """
    Atomic 2-Phase Stage Handover Protocol eliminating Coffman Hold-and-Wait deadlock condition.
    Phase 1: Release current stage lock and commit artifacts.
    Phase 2: Enqueue for target next stage and dispatch if target stage is free.
    """

    @staticmethod
    def execute_handover(
        component: ComponentStateRecord,
        current_stage: Union[StageEnum, str],
        lease_token: LeaseToken,
        lock_manager: StageLockManager,
        queue_manager: StageQueueManager,
        next_stage: Optional[Union[StageEnum, str]] = None,
        is_revision: bool = False,
    ) -> bool:
        """
        Executes atomic 2-phase handover.
        Guarantees that component holds zero stage locks before entering the next stage queue.
        """
        norm_current = _normalize_stage(current_stage)
        norm_next = _normalize_stage(next_stage) if next_stage is not None else None

        # PHASE 1: Release current stage lock unconditionally
        released = lock_manager.release_stage(norm_current, component.component_id, lease_token=lease_token)
        if not released:
            return False

        # Clear component active lease and stage association
        component.active_lease = None
        component.current_stage = None

        # PHASE 2: Route component to next destination
        if norm_next is not None:
            component.transition_to(ComponentStatus.READY)
            queue_manager.enqueue(
                norm_next,
                component.component_id,
                priority_order=component.priority_order,
                is_revision=is_revision,
            )
            # Attempt immediate dispatch if target stage is free and component is at head of queue
            if (
                not lock_manager.is_stage_occupied(norm_next)
                and queue_manager.peek(norm_next) == component.component_id
            ):
                new_lease = lock_manager.try_acquire_stage(norm_next, component.component_id)
                if new_lease:
                    queue_manager.dequeue(norm_next)
                    component.transition_to(
                        ComponentStatus.IN_STAGE, stage=norm_next, lease=new_lease
                    )
        else:
            # Reached terminal progression (e.g. documentation stage completed)
            component.transition_to(ComponentStatus.COMPLETED)

        return True
