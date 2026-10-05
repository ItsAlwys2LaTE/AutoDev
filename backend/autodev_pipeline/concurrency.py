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


def _extend_lease_expiry(self: LeaseToken, delta_sec: float) -> LeaseToken:
    """
    Creates a replacement LeaseToken with extended expiration time shifted by delta_sec.
    Preserves original token_id, component_id, stage, epoch, acquired_at, and lease_duration_sec.
    """
    return LeaseToken(
        token_id=self.token_id,
        component_id=self.component_id,
        stage=self.stage,
        epoch=self.epoch,
        acquired_at=self.acquired_at,
        expires_at=self.expires_at + float(delta_sec),
        lease_duration_sec=self.lease_duration_sec,
    )


if not hasattr(LeaseToken, "extend_expiry"):
    setattr(LeaseToken, "extend_expiry", _extend_lease_expiry)

import autodev_pipeline.models as _models_module
if not hasattr(_models_module, "StageLease"):
    setattr(_models_module, "StageLease", LeaseToken)
if not hasattr(_models_module.LeaseToken, "extend_expiry"):
    setattr(_models_module.LeaseToken, "extend_expiry", _extend_lease_expiry)

StageLease = LeaseToken


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


class StageSemaphore:
    """
    Thread-safe, lease-backed semaphore for a single pipeline stage.
    Supports up to max_slots concurrent occupants with per-slot epoch fencing.
    """

    def __init__(
        self,
        stage: Union[StageEnum, str],
        max_slots: int = 1,
        default_lease_duration: float = 300.0,
    ):
        self.stage: StageEnum = _normalize_stage(stage)
        self.max_slots: int = max_slots
        self.default_lease_duration: float = float(default_lease_duration)
        self._lock: threading.RLock = threading.RLock()
        self._epoch_counter: int = 0
        # Slot pool: maps slot_index -> (component_id, LeaseToken)
        self._slots: Dict[int, Tuple[str, LeaseToken]] = {}
        self._is_paused: bool = False
        self._paused_at: Optional[float] = None

    @property
    def is_paused(self) -> bool:
        """Returns True if the semaphore is currently paused."""
        with self._lock:
            return self._is_paused

    @property
    def paused_at(self) -> Optional[float]:
        """Returns the timestamp when paused, or None if active."""
        with self._lock:
            return self._paused_at

    def pause(self, paused_at: Optional[float] = None, now: Optional[float] = None) -> float:
        """
        Freezes the stage semaphore. While paused:
        - Active leases are NOT expired by cleanup sweeps.
        - Lease eviction countdown is frozen.
        - No new leases can be acquired.
        Idempotent: subsequent calls while paused retain original paused_at timestamp.
        """
        with self._lock:
            if self._is_paused:
                return self._paused_at if self._paused_at is not None else time.time()
            self._is_paused = True
            ts = paused_at if paused_at is not None else (now if now is not None else time.time())
            self._paused_at = float(ts)
            return self._paused_at

    def resume(self, resume_time: Optional[float] = None, now: Optional[float] = None) -> float:
        """
        Resumes the stage semaphore:
        - Extends expires_at for all active leases by the exact paused duration (now - paused_at).
        - Unfreezes eviction countdowns.
        - Resets _is_paused to False and _paused_at to None.
        Returns the elapsed paused duration in seconds (float).
        """
        with self._lock:
            if not self._is_paused:
                return 0.0
            t_now = resume_time if resume_time is not None else (now if now is not None else time.time())
            t_now = float(t_now)
            delta = max(0.0, t_now - (self._paused_at if self._paused_at is not None else t_now))
            for slot_idx in list(self._slots.keys()):
                comp_id, lease = self._slots[slot_idx]
                if hasattr(lease, "extend_expiry"):
                    extended = lease.extend_expiry(delta)
                else:
                    extended = LeaseToken(
                        token_id=lease.token_id,
                        component_id=lease.component_id,
                        stage=lease.stage,
                        epoch=lease.epoch,
                        acquired_at=lease.acquired_at,
                        expires_at=lease.expires_at + delta,
                        lease_duration_sec=lease.lease_duration_sec,
                    )
                self._slots[slot_idx] = (comp_id, extended)
            self._is_paused = False
            self._paused_at = None
            return delta

    @property
    def available_slots(self) -> int:
        """Number of currently unoccupied slots."""
        with self._lock:
            return self.max_slots - len(self._slots)

    @property
    def is_fully_occupied(self) -> bool:
        """Returns True if all concurrency slots are held by valid leases."""
        return self.available_slots == 0

    @property
    def current_holders(self) -> List[str]:
        """Returns list of component IDs currently holding slots."""
        with self._lock:
            return [comp_id for comp_id, _ in self._slots.values()]

    @property
    def active_leases(self) -> List[LeaseToken]:
        """Returns list of active LeaseTokens across all occupied slots."""
        with self._lock:
            return [lease for _, lease in self._slots.values()]

    def _cleanup_expired(self, now: float) -> List[Tuple[int, str, LeaseToken]]:
        """Removes expired leases from slots. While paused, returns [] immediately."""
        with self._lock:
            if self._is_paused:
                return []
            evicted = []
            for slot_idx in list(self._slots.keys()):
                comp_id, lease = self._slots[slot_idx]
                if not lease.is_valid(now):
                    evicted.append((slot_idx, comp_id, lease))
                    del self._slots[slot_idx]
            return evicted

    def try_acquire(
        self,
        component_id: str,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Optional[LeaseToken]:
        """
        Attempts to acquire a slot in the semaphore for component_id.
        Returns a LeaseToken on success, None if all slots are occupied or paused.
        Prevents the same component from acquiring multiple slots.
        """
        with self._lock:
            if self._is_paused:
                return None
            now = time.time() if current_time is None else float(current_time)
            dur = self.default_lease_duration if duration_sec is None else float(duration_sec)

            self._cleanup_expired(now)

            # Prevent duplicate: component already holds a slot
            for comp_id, _ in self._slots.values():
                if comp_id == component_id:
                    return None

            # Find first free slot index
            if len(self._slots) >= self.max_slots:
                return None

            free_slot = next(i for i in range(self.max_slots) if i not in self._slots)

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

            self._slots[free_slot] = (component_id, token)
            return token

    def release(
        self,
        component_id: str,
        lease_token: Optional[LeaseToken] = None,
        epoch: Optional[int] = None,
        current_time: Optional[float] = None,
    ) -> bool:
        """Releases the slot held by component_id. Validates lease if provided."""
        with self._lock:
            for slot_idx, (comp_id, lease) in list(self._slots.items()):
                if comp_id == component_id:
                    if lease_token and lease.token_id != lease_token.token_id:
                        return False
                    if epoch is not None and lease.epoch != epoch:
                        return False
                    del self._slots[slot_idx]
                    return True
            return False

    def renew_lease(
        self,
        component_id: str,
        lease_token: LeaseToken,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Optional[LeaseToken]:
        """Renews a specific component's slot lease."""
        with self._lock:
            now = time.time() if current_time is None else float(current_time)
            dur = self.default_lease_duration if duration_sec is None else float(duration_sec)

            for slot_idx, (comp_id, lease) in self._slots.items():
                if comp_id == component_id:
                    if lease.token_id != lease_token.token_id or lease.epoch != lease_token.epoch:
                        return None
                    if not lease.is_valid(now):
                        return None
                    renewed = lease.renew(duration_sec=dur, current_time=now)
                    self._slots[slot_idx] = (comp_id, renewed)
                    return renewed
            return None

    def force_revoke(self, reason: str = "WATCHDOG_EVICTION") -> List[LeaseToken]:
        """Forcibly revokes ALL active leases and bumps epoch."""
        with self._lock:
            evicted = [lease for _, lease in self._slots.values()]
            self._slots.clear()
            self._epoch_counter += 1
            return evicted

    def check_and_clean_expired(
        self, current_time: Optional[float] = None
    ) -> List[Tuple[str, LeaseToken]]:
        """Returns list of (component_id, expired_lease) and cleans them from slots."""
        with self._lock:
            now = time.time() if current_time is None else float(current_time)
            evicted_data = self._cleanup_expired(now)
            return [(comp_id, lease) for _, comp_id, lease in evicted_data]

    # --- Backward Compatibility Shims ---
    def is_occupied(self, current_time: Optional[float] = None) -> bool:
        """Legacy compat: Returns True if ANY slot is occupied."""
        with self._lock:
            now = time.time() if current_time is None else float(current_time)
            self._cleanup_expired(now)
            return len(self._slots) > 0

    @property
    def current_epoch(self) -> int:
        return self._epoch_counter


# Backward compatibility alias
StageMutex = StageSemaphore


class StageLockManager:
    """
    Centralized coordinator managing stage semaphores for all discrete pipeline stages:
    DESIGN, CODEGEN, CRITICS, INTEGRATION, DOCUMENTATION.
    Provides atomic queries, lease renewals, releases, and expired lease sweeps.
    """

    STAGE_MAX_CONCURRENCY: Dict[StageEnum, int] = {
        StageEnum.DESIGN: 2,
        StageEnum.CODEGEN: 2,
        StageEnum.CRITICS: 2,
        StageEnum.INTEGRATION: 1,
        StageEnum.DOCUMENTATION: 1,
    }

    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        max_conc = getattr(self.config, 'max_stage_concurrency', 2)
        self._semaphores: Dict[StageEnum, StageSemaphore] = {
            stage: StageSemaphore(
                stage,
                max_slots=min(max_conc, self.STAGE_MAX_CONCURRENCY.get(stage, 1)),
                default_lease_duration=self.config.lease_duration_sec
            )
            for stage in StageEnum.linear_order()
        }
        self._manager_lock: threading.RLock = threading.RLock()
        self._is_paused: bool = False
        self._paused_at: Optional[float] = None

    @property
    def is_paused(self) -> bool:
        """Returns True if StageLockManager is currently in paused state."""
        with self._manager_lock:
            return self._is_paused

    @property
    def paused_at(self) -> Optional[float]:
        """Returns timestamp when paused, or None if active."""
        with self._manager_lock:
            return self._paused_at

    def pause(self, paused_at: Optional[float] = None, now: Optional[float] = None) -> float:
        """
        Pauses all stage semaphores atomically under _manager_lock.
        Records paused_at timestamp and propagates pause to all StageSemaphore instances.
        Idempotent: subsequent calls while paused retain original timestamp.
        """
        with self._manager_lock:
            if self._is_paused:
                return self._paused_at if self._paused_at is not None else time.time()
            self._is_paused = True
            ts = paused_at if paused_at is not None else (now if now is not None else time.time())
            self._paused_at = float(ts)
            for sem in self._semaphores.values():
                sem.pause(paused_at=self._paused_at)
            return self._paused_at

    pause_all = pause
    pause_leases = pause

    def resume(self, resume_time: Optional[float] = None, now: Optional[float] = None) -> float:
        """
        Resumes all stage semaphores atomically under _manager_lock.
        Extends expires_at on all active leases by the exact elapsed paused duration.
        Resets _is_paused = False and _paused_at = None.
        Returns the elapsed paused duration in seconds.
        """
        with self._manager_lock:
            if not self._is_paused:
                return 0.0
            t_now = resume_time if resume_time is not None else (now if now is not None else time.time())
            t_now = float(t_now)
            delta = max(0.0, t_now - (self._paused_at if self._paused_at is not None else t_now))
            for sem in self._semaphores.values():
                sem.resume(resume_time=t_now)
            self._is_paused = False
            self._paused_at = None
            return delta

    resume_all = resume
    resume_leases = resume

    def count_active_leases(self) -> int:
        """Returns the total number of occupied slots across all stages."""
        with self._manager_lock:
            return sum(len(sem._slots) for sem in self._semaphores.values())

    def clear_all(self) -> None:
        """Revokes all active leases and resets epoch counters for all stages."""
        with self._manager_lock:
            self._is_paused = False
            self._paused_at = None
            for sem in self._semaphores.values():
                with sem._lock:
                    sem._slots.clear()
                    sem._epoch_counter = 0
                    sem._is_paused = False
                    sem._paused_at = None

    def _get_semaphore(self, stage: Union[StageEnum, str]) -> StageSemaphore:
        """Retrieves the StageSemaphore for the requested stage."""
        norm_stage = _normalize_stage(stage)
        with self._manager_lock:
            if norm_stage not in self._semaphores:
                max_conc = getattr(self.config, 'max_stage_concurrency', 2)
                sem = StageSemaphore(
                    norm_stage,
                    max_slots=min(max_conc, self.STAGE_MAX_CONCURRENCY.get(norm_stage, 1)),
                    default_lease_duration=self.config.lease_duration_sec
                )
                if self._is_paused:
                    sem.pause(paused_at=self._paused_at)
                self._semaphores[norm_stage] = sem
            return self._semaphores[norm_stage]

    # For backwards compatibility and internal access
    def get_mutex(self, stage: Union[StageEnum, str]):
        return self._get_semaphore(stage)

    def try_acquire_stage(
        self,
        stage: Union[StageEnum, str],
        component_id: str,
        duration_sec: Optional[float] = None,
        current_time: Optional[float] = None,
    ) -> Optional[LeaseToken]:
        """Attempts to acquire exclusive lock for the specified stage."""
        return self._get_semaphore(stage).try_acquire(
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
        return self._get_semaphore(stage).renew_lease(
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
        return self._get_semaphore(stage).release(
            component_id, lease_token=lease_token, epoch=epoch, current_time=current_time
        )

    def force_revoke_stage(
        self,
        stage: Union[StageEnum, str],
        reason: str = "WATCHDOG_EVICTION",
    ) -> Optional[LeaseToken]:
        """Forcibly evicts the stage holder and bumps epoch."""
        evicted = self._get_semaphore(stage).force_revoke(reason=reason)
        return evicted[0] if evicted else None

    def is_stage_occupied(
        self,
        stage: Union[StageEnum, str],
        current_time: Optional[float] = None,
    ) -> bool:
        """Checks if stage is currently occupied by a valid unexpired lease."""
        return self._get_semaphore(stage).is_occupied(current_time)
        
    def has_available_slot(self, stage: Union[StageEnum, str]) -> bool:
        """Returns True if at least one slot is free."""
        return self._get_semaphore(stage).available_slots > 0

    def get_stage_holders(self, stage: Union[StageEnum, str]) -> List[str]:
        """Returns ALL current holders (plural)."""
        return self._get_semaphore(stage).current_holders

    def get_stage_holder(self, stage: Union[StageEnum, str]) -> Optional[str]:
        """Returns the current occupant of the stage or None."""
        holders = self.get_stage_holders(stage)
        return holders[0] if holders else None

    def get_stage_epoch(self, stage: Union[StageEnum, str]) -> int:
        """Returns the current epoch of the stage mutex."""
        return self._get_semaphore(stage).current_epoch

    def get_active_leases(self) -> Dict[str, Optional[LeaseToken]]:
        """Returns mapping of stage value to active LeaseToken or None."""
        with self._manager_lock:
            result = {}
            for stage, semaphore in self._semaphores.items():
                active = semaphore.active_leases
                result[stage.value] = active[0] if active else None
            return result

    def check_and_clean_expired_leases(
        self,
        current_time: Optional[float] = None,
    ) -> List[Tuple[StageEnum, str, LeaseToken]]:
        """
        Scans all stages, identifying and revoking expired leases.
        Returns list of tuples: (StageEnum, component_id, evicted_lease).
        Returns [] immediately if paused, suppressing watchdog sweeps.
        """
        with self._manager_lock:
            if self._is_paused:
                return []
            expired_list: List[Tuple[StageEnum, str, LeaseToken]] = []
            now = time.time() if current_time is None else float(current_time)
            for stage, semaphore in self._semaphores.items():
                expired_entries = semaphore.check_and_clean_expired(current_time=now)
                for comp_id, lease in expired_entries:
                    expired_list.append((stage, comp_id, lease))
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
            # Min-heap priority: lower priority_order number = higher dispatch priority (e.g. 0 or 1 before 2).
            # Revisions get a -10000 score bonus to pop before new items.
            score = int(priority_order) - (10000 if is_revision else 0)

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
            _, queue, _ = self._get_stage_queue(stage)
            if not queue:
                return None
            return queue[0].component_id

    def peek_all(self, stage: Union[StageEnum, str]) -> List[str]:
        """Returns all component IDs in the stage queue, in priority order."""
        with self._queue_lock:
            _, queue, _ = self._get_stage_queue(stage)
            if not queue:
                return []
            return [item.component_id for item in sorted(queue)]

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

    def clear_all(self) -> None:
        """Clears all queues and enqueued component sets across all stages."""
        with self._queue_lock:
            for stage in list(self._queues.keys()):
                self._queues[stage].clear()
                self._enqueued_components[stage].clear()
            self._sequence_counter = 0


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
        lock_manager.release_stage(norm_current, component.component_id, lease_token=lease_token)

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
        else:
            # Reached terminal progression (e.g. documentation stage completed or critics passed)
            component.transition_to(ComponentStatus.COMPLETED)

        return True
