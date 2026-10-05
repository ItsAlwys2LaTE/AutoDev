import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { resetAllStores } from '../stores/index';
import { pipelineRewind } from '../api/endpoints';
import {
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export interface PauseModifyFABProps {
  className?: string;
}

export function PauseModifyFAB({ className = '' }: PauseModifyFABProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const storeIsPaused = useAppStore((s) => s.isPaused);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storePipelineActive = useAppStore((s) => s.pipelineActive);
  const storeIsComponentMode = useAppStore((s) => s.isComponentMode);
  const storePostCompletionVisible = useAppStore((s) => s.postCompletionVisible);

  const pauseDevelopment = useAppStore((s) => s.pauseDevelopment);
  const resumeDevelopment = useAppStore((s) => s.resumeDevelopment);
  const detectModifications = useAppStore((s) => s.detectModifications);
  const invalidateDownstreamPhases = useAppStore((s) => s.invalidateDownstreamPhases);
  const resumeFromRevision = useAppStore((s) => s.resumeFromRevision);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const retryDevelopment = useAppStore((s) => s.retryDevelopment);
  const requestNewProduct = useAppStore((s) => s.requestNewProduct);

  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const pipelineActive = isSSR ? (liveStore?.pipelineActive ?? storePipelineActive) : storePipelineActive;
  const isComponentMode = isSSR ? (liveStore?.isComponentMode ?? storeIsComponentMode) : storeIsComponentMode;
  const postCompletionVisible = isSSR ? (liveStore?.postCompletionVisible ?? storePostCompletionVisible) : storePostCompletionVisible;

  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  // Hide completely when pipeline is idle, aborted, completed, or post-completion is visible
  if (
    pipelineStatus === 'idle' ||
    pipelineStatus === 'aborted' ||
    pipelineStatus === 'completed' ||
    postCompletionVisible === true
  ) {
    return null;
  }

  const handlePause = () => {
    pauseDevelopment();
  };

  const handleResumeClick = async () => {
    const mods = detectModifications();
    const hasMods = Boolean(mods.earliestModifiedPhase);

    let targetStage: string | undefined = undefined;
    let earliestTarget: string | undefined = undefined;

    if (mods.earliestModifiedPhase) {
      if (isComponentMode && mods.earliestModifiedPhase === 'component_dag' && mods.earliestModifiedComponentId) {
        targetStage = mods.modifiedComponentTargetStage || 'DESIGN';
        earliestTarget = `component ${mods.earliestModifiedComponentId} (${targetStage})`;
      } else {
        targetStage = mods.earliestModifiedPhase;
        earliestTarget = mods.earliestModifiedPhase;
      }
    } else {
      const currentInFlight = useAppStore.getState().pausedAtPhase || useAppStore.getState().inFlightPhase;
      targetStage = currentInFlight || 'component_dag';
      earliestTarget = 'none';
    }

    if (mods.earliestModifiedPhase) {
      const patch = invalidateDownstreamPhases(
        mods.earliestModifiedPhase,
        isComponentMode,
        mods.restartFromRevision,
        mods.earliestModifiedComponentId,
        mods.modifiedComponentTargetStage,
        mods.subsequentComponentIds
      );
      useAppStore.setState(patch);

      if (isComponentMode && mods.earliestModifiedPhase === 'component_dag' && mods.earliestModifiedComponentId) {
        try {
          await pipelineRewind({
            component_id: mods.earliestModifiedComponentId,
            target_stage: (targetStage as any) || mods.modifiedComponentTargetStage || 'DESIGN',
            invalidate_dependents: true,
            subsequent_component_ids: mods.subsequentComponentIds || [],
          });
        } catch (e) {
          console.warn('[PauseModifyFAB] Failed to rewind pipeline on backend:', e);
        }
      }

      if (mods.restartFromRevision !== null && mods.restartFromRevision !== undefined) {
        resumeFromRevision(mods.restartFromRevision);
      } else {
        useAppStore.setState({ pausedAtPhase: null });
        setInFlightPhase(mods.earliestModifiedPhase);
        resumeDevelopment({
          targetStage,
          modificationsDetected: hasMods,
          earliestTarget,
          earliestPhase: mods.earliestModifiedPhase || undefined,
          earliestComponentId: mods.earliestModifiedComponentId || undefined,
        });
      }
    } else {
      resumeDevelopment({
        targetStage,
        modificationsDetected: false,
        earliestTarget: 'none',
      });
    }
  };

  const handleRestartConfirm = async () => {
    setShowRestartConfirm(false);
    if (typeof (window as any).restartDevelopment === 'function') {
      await (window as any).restartDevelopment();
    } else if (typeof (window as any).retryDevelopment === 'function') {
      await (window as any).retryDevelopment();
    } else {
      retryDevelopment();
    }
  };

  const handleRequestNewProduct = () => {
    if (typeof resetAllStores === 'function') {
      resetAllStores();
    } else {
      requestNewProduct();
    }
  };

  return (
    <div
      className={`absolute bottom-6 left-6 z-50 flex flex-col items-start space-y-3 pointer-events-auto ${className}`}
    >
      {/* Restart Development Confirmation Modal */}
      {showRestartConfirm && (
        <div
          id="fabRestartConfirmModal"
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl w-80 mb-3 animate-in fade-in slide-in-from-bottom-5 text-left"
        >
          <div className="flex items-center space-x-2 text-amber-600 mb-3">
            <ArrowPathIcon className="w-6 h-6" />
            <h3 className="font-semibold text-sm text-slate-900">Restart Development</h3>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Are you sure you want to restart development? All current progress will be reset.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              id="fabRestartCancelBtn"
              type="button"
              onClick={() => setShowRestartConfirm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="fabRestartConfirmBtn"
              type="button"
              onClick={handleRestartConfirm}
              className="px-3 py-1.5 text-xs text-white bg-amber-500 hover:bg-amber-600 font-medium rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              Restart
            </button>
          </div>
        </div>
      )}

      {/* Action Controls: 3 Circular Buttons on Pause, Single Circular FAB when Running */}
      {isPaused ? (
        <div
          id="fabExpandedActionGroup"
          className="flex flex-col items-start gap-3"
        >
          {/* 1. Top: Request New Product (star icon) */}
          <button
            id="fabRequestNewProductBtn"
            data-testid="requestNewProductFabBtn"
            type="button"
            onClick={handleRequestNewProduct}
            title="Request New Product"
            aria-label="Request New Product"
            className="group relative w-12 h-12 rounded-full flex items-center justify-center shadow-md bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer ring-2 ring-slate-200/50"
          >
            <SparklesIcon className="w-5 h-5" />
            <span className="absolute left-14 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-slate-700 font-medium z-50">
              Request New Product
            </span>
          </button>

          {/* 2. Middle: Restart Development (redo arrow) */}
          <button
            id="fabRestartDevBtn"
            data-testid="restartDevFabBtn"
            type="button"
            onClick={() => setShowRestartConfirm(true)}
            title="Restart Development"
            aria-label="Restart Development"
            className="group relative w-12 h-12 rounded-full flex items-center justify-center shadow-md bg-amber-500 hover:bg-amber-600 text-white transition-all cursor-pointer ring-2 ring-amber-500/30"
          >
            <ArrowPathIcon className="w-5 h-5" />
            <span className="absolute left-14 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-slate-700 font-medium z-50">
              Restart Development
            </span>
          </button>

          {/* 3. Bottom: Resume (play icon) */}
          <button
            id="fabResumeDevBtn"
            data-testid="resumeDevFabBtn"
            type="button"
            onClick={handleResumeClick}
            title="Resume Development"
            aria-label="Resume Development"
            className="group relative w-12 h-12 rounded-full flex items-center justify-center shadow-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer ring-2 ring-emerald-600/30"
          >
            <PlayIcon className="w-5 h-5 ml-0.5" />
            <span className="absolute left-14 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-slate-700 font-medium z-50">
              Resume Development
            </span>
          </button>
        </div>
      ) : (pipelineStatus === 'running' || pipelineActive) ? (
        /* Single Circular Floating Button During Active Running Development */
        <button
          id="pauseDevFabBtn"
          type="button"
          onClick={handlePause}
          title="Pause Development"
          aria-label="Pause Development"
          className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-xl ring-4 ring-blue-600/20 cursor-pointer transition-all"
        >
          <PauseIcon className="w-7 h-7" />
          <span className="sr-only">Pause &amp; Modify</span>
        </button>
      ) : null}
    </div>
  );
}

export default PauseModifyFAB;
