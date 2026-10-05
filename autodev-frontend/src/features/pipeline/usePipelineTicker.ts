/**
 * AutoDev Multi-Component DAG Pipeline Ticker Hook
 *
 * Implements continuous polling of GET /api/pipeline/tick every 2,000ms.
 * Features:
 * - Monotonic epoch fencing preventing duplicate dispatches and race conditions
 * - Stage-to-status mapping (DESIGN -> designing, CODEGEN -> coding, CRITICS -> executing)
 * - Completion detection (pauses when all components pass)
 * - AbortController handling (pauses and aborts on pipeline abort)
 * - Network offline suspension and online recovery
 * - Exponential backoff on server errors
 * - Synchronous localStorage persistence under autodev_state_v1
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import { persistState } from '../../stores';
import { pipelineTick } from '../../api/endpoints';
import type {
  PipelineAssignment,
  PipelineTickResponse,
  ComponentSpec,
  ComponentTrackState,
} from '../../types';

export interface UsePipelineTickerOptions {
  /** Polling interval in milliseconds (default: 2,000ms) */
  intervalMs?: number;
  /** Declarative enable/disable flag (default: true) */
  enabled?: boolean;
  /** Optional session identifier */
  sessionId?: string;
  /** Optional callback fired when a new stage lease assignment is dispatched */
  onAssignmentDispatched?: (assignment: PipelineAssignment) => void;
  /** Optional error callback */
  onError?: (error: Error) => void;
}

export interface UsePipelineTickerReturn {
  /** True if the ticker is currently polling */
  isPolling: boolean;
  /** Timestamp of the last successful tick response */
  lastTickAt: number | null;
  /** Active stage assignments received from the latest tick */
  activeAssignments: PipelineAssignment[];
  /** Latest error encountered during polling (null if clean) */
  error: Error | null;
  /** Total number of network reconnects handled */
  reconnectCount: number;
  /** Manually trigger a single tick out-of-band */
  triggerTick: () => Promise<PipelineTickResponse | null>;
  /** Explicitly pause polling */
  pausePolling: () => void;
  /** Explicitly resume polling */
  resumePolling: () => void;
}

/**
 * Synchronizes aggregate Stepper progress (Steps 3, 4, 5) based on component statuses.
 */
function syncAggregateStepper(
  queue: ComponentSpec[],
  states: Record<string, ComponentTrackState | any>,
  setStepper: (step: number, status: any) => void
) {
  if (!queue || queue.length === 0) return;
  const stateList = queue.map((c) => states[c.component_id] || { status: 'queued' });

  const allPassed = stateList.every((s) => s.status === 'passed' || s.status === 'COMPLETED');
  if (allPassed) {
    setStepper(3, 'success');
    setStepper(4, 'success');
    setStepper(5, 'loading');
    return;
  }

  const anyCodingOrTesting = stateList.some((s) =>
    ['coding_queued', 'coding', 'critic_queued', 'executing', 'critiquing', 'waiting_critic'].includes(s.status)
  );

  if (anyCodingOrTesting) {
    setStepper(3, 'success');
    setStepper(4, 'loading');
    setStepper(5, 'idle');
  } else {
    setStepper(3, 'loading');
    setStepper(4, 'idle');
    setStepper(5, 'idle');
  }
}

export function usePipelineTicker(options: UsePipelineTickerOptions = {}): UsePipelineTickerReturn {
  const {
    intervalMs = 2000,
    enabled = true,
    sessionId,
    onAssignmentDispatched,
    onError,
  } = options;

  // Support both SSR (useAppStore.getState() in Node / renderToString) and client reactivity (useAppStore hook)
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Store subscriptions
  const storeIsComponentMode = useAppStore((s) => s.isComponentMode);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeIsPaused = useAppStore((s) => s.isPaused);
  const storePipelineActive = useAppStore((s) => s.pipelineActive);
  const storePipelineQueue = useAppStore((s) => s.pipelineQueue);
  const storeComponentStates = useAppStore((s) => s.componentStates);
  const storeResumeEpoch = useAppStore((s) => s.resumeEpoch);

  const isComponentMode = isSSR ? (liveStore?.isComponentMode ?? storeIsComponentMode) : storeIsComponentMode;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;
  const pipelineActive = isSSR ? (liveStore?.pipelineActive ?? storePipelineActive) : storePipelineActive;
  const pipelineQueue = isSSR ? (liveStore?.pipelineQueue ?? storePipelineQueue) : storePipelineQueue;
  const componentStates = isSSR ? (liveStore?.componentStates ?? storeComponentStates) : storeComponentStates;
  const resumeEpoch = isSSR ? (liveStore?.resumeEpoch ?? storeResumeEpoch) : storeResumeEpoch;

  // Store actions
  const updateComponentState = useAppStore((s) => s.updateComponentState);
  const setStepper = useAppStore((s) => s.setStepper);

  // Local hook state
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const [activeAssignments, setActiveAssignments] = useState<PipelineAssignment[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [isPausedManually, setIsPausedManually] = useState<boolean>(false);

  // Refs for tracking mutable lifecycle state across intervals
  const inFlightRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastProcessedLeasesRef = useRef<Map<string, { stage: string; epoch: number }>>(new Map());
  const failureCountRef = useRef<number>(0);
  const isOnlineRef = useRef<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Check if all components have passed
  const allComponentsPassed =
    pipelineQueue.length > 0 &&
    pipelineQueue.every((c) => {
      const st = componentStates[c.component_id]?.status;
      return st === 'passed' || st === 'COMPLETED';
    });

  const shouldPoll =
    enabled &&
    !isPausedManually &&
    !isPaused &&
    isComponentMode &&
    pipelineStatus === 'running' &&
    pipelineActive &&
    !allComponentsPassed;

  // Reset polling lifecycle and lease tracking when pipeline stops or resets
  useEffect(() => {
    if (!shouldPoll) {
      if (pipelineStatus !== 'running') {
        lastProcessedLeasesRef.current.clear();
        failureCountRef.current = 0;
      }
      inFlightRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [shouldPoll, pipelineStatus]);

  // Single tick execution
  const executeTick = useCallback(async (): Promise<PipelineTickResponse | null> => {
    if (inFlightRef.current) {
      return null;
    }

    if (!isOnlineRef.current) {
      return null;
    }

    inFlightRef.current = true;
    abortControllerRef.current = new AbortController();

    try {
      const data = await pipelineTick(sessionId, {
        signal: abortControllerRef.current.signal,
      });

      // Verify pipeline is still actively running
      const currentStatus = useAppStore.getState().pipelineStatus;
      if (currentStatus !== 'running') {
        return null;
      }

      failureCountRef.current = 0;
      setError(null);
      setLastTickAt(Date.now());

      const assignments = data.assignments || [];
      setActiveAssignments(assignments);

      let stateChanged = false;
      const latestStates = useAppStore.getState().componentStates;

      for (const assign of assignments) {
        const compId = assign.component_id;
        const stageUpper = String(assign.stage).toUpperCase();
        const incomingEpoch = Number(assign.epoch) || 0;

        const currentState = latestStates[compId];
        // Check if component already passed (never regress passed components)
        if (currentState?.status === 'passed' || currentState?.status === 'COMPLETED') {
          continue;
        }

        // Monotonic epoch check
        const cached = lastProcessedLeasesRef.current.get(compId);
        const isQueuedWaiting =
          !currentState ||
          currentState.status === 'queued' ||
          currentState.status === 'coding_queued' ||
          currentState.status === 'critic_queued' ||
          currentState.status === 'waiting_design' ||
          currentState.status === 'waiting_code' ||
          currentState.status === 'waiting_critic';

        if (cached && !isQueuedWaiting) {
          // If same epoch and same stage, already dispatched; keep active without re-dispatching
          if (incomingEpoch === cached.epoch && cached.stage === stageUpper) {
            continue;
          }
          // If same stage and incoming epoch is strictly less than what we've processed, discard as stale
          if (cached.stage === stageUpper && incomingEpoch < cached.epoch) {
            continue;
          }
          // If different stage: discard only if incoming is an earlier linear stage AND not waiting for revision
          if (cached.stage !== stageUpper) {
            const stageOrder: Record<string, number> = {
              DESIGN: 1,
              CODEGEN: 2,
              CRITICS: 3,
              INTEGRATION: 4,
              DOCUMENTATION: 5,
            };
            const incomingRank = stageOrder[stageUpper] || 0;
            const cachedRank = stageOrder[cached.stage] || 0;
            const isRevisionTransition =
              cached.stage === 'CRITICS' && stageUpper === 'CODEGEN';
            const isWaitingRevision =
              isRevisionTransition ||
              (currentState?.status === 'coding_queued' && stageUpper === 'CODEGEN') ||
              (currentState?.status === 'critic_queued' && stageUpper === 'CRITICS');

            if (incomingRank < cachedRank && !isWaitingRevision && incomingEpoch <= cached.epoch) {
              continue;
            }
          }
        }

        // Determine target status according to stage without stomping in-flight or interactive review sub-states
        let targetStatus: string | null = null;
        if (stageUpper === 'DESIGN') {
          if (
            !currentState ||
            currentState.status === 'queued' ||
            currentState.status === 'stalled'
          ) {
            targetStatus = 'designing';
          }
        } else if (stageUpper === 'CODEGEN') {
          if (
            !currentState ||
            currentState.status === 'coding_queued' ||
            currentState.status === 'queued'
          ) {
            targetStatus = 'coding';
          }
        } else if (stageUpper === 'CRITICS') {
          if (
            !currentState ||
            currentState.status === 'critic_queued' ||
            currentState.status === 'queued'
          ) {
            targetStatus = 'executing';
          }
        }

        // Update lease cache
        lastProcessedLeasesRef.current.set(compId, {
          stage: stageUpper,
          epoch: incomingEpoch,
        });

        if (targetStatus) {
          updateComponentState(compId, {
            status: targetStatus,
            currentStage: stageUpper,
            epoch: incomingEpoch,
          });
          stateChanged = true;

          // If no component is active or active component is already passed, focus the newly running component
          const curActiveId = useAppStore.getState().activeComponentId;
          const curActiveStatus = curActiveId ? latestStates[curActiveId]?.status : null;
          if (!curActiveId || curActiveStatus === 'passed' || curActiveStatus === 'COMPLETED') {
            useAppStore.getState().setActiveComponent(compId, stageUpper as any);
          }

          if (onAssignmentDispatched) {
            onAssignmentDispatched(assign);
          }
        }
      }

      // Synchronize Stepper and localStorage if any state updated
      const updatedQueue = useAppStore.getState().pipelineQueue;
      const updatedStates = useAppStore.getState().componentStates;
      syncAggregateStepper(updatedQueue, updatedStates, setStepper);

      if (stateChanged) {
        persistState(true);
      }

      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null;
      }
      failureCountRef.current += 1;
      const tickError = err instanceof Error ? err : new Error(String(err));
      setError(tickError);
      if (onError) {
        onError(tickError);
      }
      return null;
    } finally {
      inFlightRef.current = false;
      abortControllerRef.current = null;
    }
  }, [
    sessionId,
    updateComponentState,
    setStepper,
    onAssignmentDispatched,
    onError,
  ]);

  // Online / Offline listener handling
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      isOnlineRef.current = true;
      setReconnectCount((prev) => prev + 1);
      if (shouldPoll) {
        executeTick();
      }
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [shouldPoll, executeTick]);

  // Main polling interval loop with backoff calculation
  useEffect(() => {
    if (!shouldPoll) {
      setIsPolling(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    setIsPolling(true);

    // Initial immediate tick upon entering active polling
    executeTick();

    // Calculate interval with exponential backoff on failure
    let currentInterval = intervalMs;
    if (failureCountRef.current === 1) {
      currentInterval = Math.max(intervalMs, 2000);
    } else if (failureCountRef.current === 2) {
      currentInterval = Math.max(intervalMs, 4000);
    } else if (failureCountRef.current >= 3) {
      currentInterval = Math.min(10000, Math.max(intervalMs, 8000));
    }

    const timer = setInterval(() => {
      executeTick();
    }, currentInterval);

    return () => {
      clearInterval(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [shouldPoll, intervalMs, executeTick]);

  // Abort cleanup when pipelineStatus switches to aborted
  useEffect(() => {
    if (pipelineStatus === 'aborted') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsPolling(false);
    }
  }, [pipelineStatus]);

  // Reset lease cache on new session or queue reset
  useEffect(() => {
    if (pipelineQueue.length === 0 || pipelineStatus === 'idle') {
      lastProcessedLeasesRef.current.clear();
      setActiveAssignments([]);
    }
  }, [pipelineQueue.length, pipelineStatus]);

  // Reset lease cache and re-trigger ticker when development is resumed / rewound / unpaused
  const prevResumeEpochRef = useRef<number>(resumeEpoch || 0);
  const prevIsPausedRef = useRef<boolean>(isPaused);
  useEffect(() => {
    const epochChanged = Boolean(resumeEpoch && resumeEpoch > prevResumeEpochRef.current);
    const unpaused = Boolean(prevIsPausedRef.current && !isPaused);
    prevIsPausedRef.current = isPaused;

    if (epochChanged || unpaused) {
      if (epochChanged && resumeEpoch) {
        prevResumeEpochRef.current = resumeEpoch;
      }
      lastProcessedLeasesRef.current.clear();
      setActiveAssignments([]);
      if (pipelineStatus === 'running' && !isPaused) {
        executeTick();
      }
    }
  }, [resumeEpoch, pipelineStatus, isPaused, executeTick]);

  const pausePolling = useCallback(() => {
    setIsPausedManually(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsPolling(false);
  }, []);

  const resumePolling = useCallback(() => {
    setIsPausedManually(false);
  }, []);

  return {
    isPolling,
    lastTickAt,
    activeAssignments,
    error,
    reconnectCount,
    triggerTick: executeTick,
    pausePolling,
    resumePolling,
  };
}

export default usePipelineTicker;
