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
 * 4. Zero extra text or intrusive countdown indicators in the UI.
 */
export function usePausableAutoAdvance({
  durationMs,
  onAdvance,
  targetStage,
  enabled,
  stageKey = 'default',
}: UsePausableAutoAdvanceOptions) {
  const isPaused = useAppStore((s) => s.isPaused);
  const remainingMsRef = useRef<number>(durationMs);
  const startTimeRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFiredRef = useRef<boolean>(false);
  const prevStageKeyRef = useRef<string>(stageKey);

  // If stage key changed (e.g. rewind, restart, or session transition), reset timer
  if (prevStageKeyRef.current !== stageKey) {
    prevStageKeyRef.current = stageKey;
    remainingMsRef.current = durationMs;
    startTimeRef.current = null;
    hasFiredRef.current = false;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }

  useEffect(() => {
    // If not enabled or already advanced, do nothing
    if (!enabled || hasFiredRef.current) {
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
        if (onAdvance) {
          onAdvance(targetStage);
        }
      }
    }, remainingMsRef.current);

    // Listen for manual navigation events to instantly cancel the auto-advance timer for this stage
    const handleManualCancel = () => {
      hasFiredRef.current = true;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      startTimeRef.current = null;
      remainingMsRef.current = 0;
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
  }, [enabled, isPaused, targetStage, onAdvance]);

  return {
    remainingMs: remainingMsRef.current,
    hasFired: hasFiredRef.current,
  };
}
