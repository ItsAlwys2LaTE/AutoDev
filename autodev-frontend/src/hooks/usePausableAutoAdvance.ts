import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

export interface UsePausableAutoAdvanceOptions {
  durationMs: number;
  onAdvance?: (targetStage: number) => void;
  targetStage: number;
  enabled: boolean;
  stageKey?: string;
}

/**
 * AutoDev Pausable Stage Auto-Advance Hook
 *
 * Implements:
 * 1. Monotonic countdown before automatically moving to the next stage.
 * 2. Seamlessly pauses the countdown when development is paused (freezing remaining time).
 * 3. Continues countdown from the exact remaining time when development is resumed.
 * 4. Only fires once on first output completion; never re-triggers when navigating back.
 * 5. Zero extra text or intrusive countdown indicators in the UI.
 */
export function usePausableAutoAdvance({
  durationMs,
  onAdvance,
  targetStage,
  enabled,
  stageKey = 'default',
}: UsePausableAutoAdvanceOptions) {
  // Support both SSR (useAppStore.getState()) and client reactivity
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const isPaused = useAppStore((s) => s.isPaused);
  const storeCompleted = useAppStore((s) => Boolean(s.completedAutoAdvanceStages?.[stageKey]));
  const isCompleted = isSSR
    ? Boolean(liveStore?.completedAutoAdvanceStages?.[stageKey])
    : storeCompleted;

  const markAutoAdvanceCompleted = useAppStore((s) => s.markAutoAdvanceCompleted);

  const remainingMsRef = useRef<number>(isCompleted ? 0 : durationMs);
  const startTimeRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFiredRef = useRef<boolean>(isCompleted);
  const prevStageKeyRef = useRef<string>(stageKey);

  // If stage key changed (e.g. rewind, restart, or session transition), reset timer
  if (prevStageKeyRef.current !== stageKey) {
    prevStageKeyRef.current = stageKey;
    remainingMsRef.current = isCompleted ? 0 : durationMs;
    startTimeRef.current = null;
    hasFiredRef.current = isCompleted;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }

  // If already marked completed in store, cancel active timeout and update refs
  useEffect(() => {
    if (isCompleted) {
      hasFiredRef.current = true;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      startTimeRef.current = null;
      remainingMsRef.current = 0;
    }
  }, [isCompleted]);

  useEffect(() => {
    // If not enabled or already completed/advanced, do nothing
    if (!enabled || isCompleted || hasFiredRef.current) {
      return;
    }

    // When paused: freeze timer by computing elapsed time and clearing running timeout
    if (isPaused) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (startTimeRef.current !== null) {
        const elapsed = Date.now() - startTimeRef.current;
        remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
        startTimeRef.current = null;
      }
      return;
    }

    // When unpaused and enabled: check if timer has already elapsed
    if (remainingMsRef.current <= 0) {
      hasFiredRef.current = true;
      markAutoAdvanceCompleted(stageKey);
      if (onAdvance) {
        onAdvance(targetStage);
      }
      return;
    }

    // Start / resume countdown with remaining duration
    startTimeRef.current = Date.now();
    timeoutIdRef.current = setTimeout(() => {
      if (!useAppStore.getState().isPaused && !hasFiredRef.current) {
        hasFiredRef.current = true;
        remainingMsRef.current = 0;
        startTimeRef.current = null;
        useAppStore.getState().markAutoAdvanceCompleted(stageKey);
        if (onAdvance) {
          onAdvance(targetStage);
        }
      }
    }, remainingMsRef.current);

    // Listen for manual navigation events to instantly cancel the auto-advance timer for this stage
    const handleManualCancel = (e: Event) => {
      const customEvt = e as CustomEvent<{ fromStage?: number; toStage?: number }>;
      const STAGE_NUMBER_TO_KEY: Record<number, string> = {
        3: 'stage-3-requirements',
        4: 'stage-4-decomposition',
        5: 'stage-5-pipeline',
        6: 'stage-6-integration',
        7: 'stage-7-final-code',
        8: 'stage-8-live-preview',
        11: 'stage-11-post-dev',
      };
      if (customEvt.detail?.fromStage) {
        const leavingKey = STAGE_NUMBER_TO_KEY[customEvt.detail.fromStage];
        if (leavingKey && leavingKey !== stageKey) {
          return;
        }
      }
      hasFiredRef.current = true;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      startTimeRef.current = null;
      remainingMsRef.current = 0;
      useAppStore.getState().markAutoAdvanceCompleted(stageKey);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('autodev:cancel-stage-timer', handleManualCancel);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('autodev:cancel-stage-timer', handleManualCancel);
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (startTimeRef.current !== null) {
        const elapsed = Date.now() - startTimeRef.current;
        remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
        startTimeRef.current = null;
      }
    };
  }, [enabled, isCompleted, isPaused, targetStage, onAdvance, stageKey, markAutoAdvanceCompleted]);

  return {
    remainingMs: isCompleted ? 0 : remainingMsRef.current,
    hasFired: hasFiredRef.current || isCompleted,
  };
}
