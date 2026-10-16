import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  currentStage?: number;
  className?: string;
}

export function PauseModifyFAB({ currentStage, className = '' }: PauseModifyFABProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const storeIsPaused = useAppStore((s) => s.isPaused);
  const storeIsPauseRequested = useAppStore((s) => s.isPauseRequested);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeIsComponentMode = useAppStore((s) => s.isComponentMode);
  const storePostCompletionVisible = useAppStore((s) => s.postCompletionVisible);

  const requestPause = useAppStore((s) => s.requestPause);
  const cancelPauseRequest = useAppStore((s) => s.cancelPauseRequest);
  const resumeDevelopment = useAppStore((s) => s.resumeDevelopment);
  const detectModifications = useAppStore((s) => s.detectModifications);
  const invalidateDownstreamPhases = useAppStore((s) => s.invalidateDownstreamPhases);
  const resumeFromRevision = useAppStore((s) => s.resumeFromRevision);
  const setInFlightPhase = useAppStore((s) => s.setInFlightPhase);
  const retryDevelopment = useAppStore((s) => s.retryDevelopment);
  const requestNewProduct = useAppStore((s) => s.requestNewProduct);

  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;
  const isPauseRequested = isSSR ? (liveStore?.isPauseRequested ?? storeIsPauseRequested) : storeIsPauseRequested;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? storePipelineStatus) : storePipelineStatus;
  const isComponentMode = isSSR ? (liveStore?.isComponentMode ?? storeIsComponentMode) : storeIsComponentMode;
  const postCompletionVisible = isSSR ? (liveStore?.postCompletionVisible ?? storePostCompletionVisible) : storePostCompletionVisible;

  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  // If in pre-development product request stage (Stage 1), the SDLC has not started yet
  const effStage = currentStage !== undefined ? currentStage : 2;
  if (effStage < 2) {
    return null;
  }

  if (postCompletionVisible) {
    return null;
  }

  // Hide when pipeline is not actively running and not paused/pause-requested
  if (pipelineStatus === 'idle' || pipelineStatus === 'aborted' || pipelineStatus === 'completed') {
    if (!isPaused && !isPauseRequested) {
      return null;
    }
  }

  const handlePause = () => {
    if (isPauseRequested) {
      cancelPauseRequest();
    } else {
      requestPause();
    }
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
      id="pauseResumeControlContainer"
      className={`fixed right-4 sm:right-6 bottom-6 sm:bottom-8 z-40 select-none flex flex-col items-end gap-3 pointer-events-auto ${className}`}
    >
      {/* Restart Development Confirmation Modal */}
      {showRestartConfirm && (
        <div
          id="fabRestartConfirmModal"
          className="bg-white/95 dark:bg-slate-950/[0.45] backdrop-blur-3xl border border-slate-200 dark:border-white/12 rounded-3xl p-5 shadow-2xl w-80 mb-3 animate-in fade-in slide-in-from-bottom-5 text-left"
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          <div className="flex items-center space-x-2 text-amber-500 dark:text-amber-400 mb-3">
            <ArrowPathIcon className="w-6 h-6" />
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Restart Development</h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
            Are you sure you want to restart development? All current pipeline progress will be reset.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              id="fabRestartCancelBtn"
              type="button"
              onClick={() => setShowRestartConfirm(false)}
              className="px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300 dark:border-white/10 rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              Cancel
            </button>
            <button
              id="fabRestartConfirmBtn"
              type="button"
              onClick={handleRestartConfirm}
              className="px-3 py-1.5 text-xs text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 dark:text-white dark:bg-white/15 dark:hover:bg-white/25 dark:border-white/20 font-medium rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              Restart
            </button>
          </div>
        </div>
      )}

      {/* Action Controls: 3 Action Group on Pause, Resting Pause Badge when Active */}
      <AnimatePresence mode="wait">
        {isPaused ? (
          <motion.div
            key="expandedActionGroup"
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            id="fabExpandedActionGroup"
            className="flex flex-col items-end gap-2.5 p-2 rounded-3xl bg-white/80 dark:bg-slate-950/[0.28] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.09] shadow-2xl"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            {/* 1. Top: Request New Product */}
            <button
              id="fabRequestNewProductBtn"
              data-testid="requestNewProductFabBtn"
              type="button"
              onClick={handleRequestNewProduct}
              title="Request New Product"
              aria-label="Request New Product"
              className="group relative w-11 h-11 rounded-2xl flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300/80 dark:border-white/15 backdrop-blur-xl transition-all cursor-pointer shadow-sm hover:scale-105"
            >
              <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              <span className="absolute right-14 px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-300/80 shadow-xl dark:bg-slate-950/90 dark:text-white dark:border-white/15 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-medium z-50 backdrop-blur-xl">
                Request New Product
              </span>
            </button>

            {/* 2. Middle: Restart Development */}
            <button
              id="fabRestartDevBtn"
              data-testid="restartDevFabBtn"
              type="button"
              onClick={() => setShowRestartConfirm(true)}
              title="Restart Development"
              aria-label="Restart Development"
              className="group relative w-11 h-11 rounded-2xl flex items-center justify-center bg-white hover:bg-slate-50 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white border border-slate-300/80 dark:border-white/15 backdrop-blur-xl transition-all cursor-pointer shadow-sm hover:scale-105"
            >
              <ArrowPathIcon className="w-5 h-5 text-amber-600 dark:text-amber-300" />
              <span className="absolute right-14 px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-300/80 shadow-xl dark:bg-slate-950/90 dark:text-white dark:border-white/15 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-medium z-50 backdrop-blur-xl">
                Restart Development
              </span>
            </button>

            {/* 3. Bottom: Resume Development */}
            <button
              id="fabResumeDevBtn"
              data-testid="resumeDevFabBtn"
              type="button"
              onClick={handleResumeClick}
              title="Resume Development"
              aria-label="Resume Development"
              className="group relative w-11 h-11 rounded-2xl flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:hover:bg-emerald-500/40 dark:text-emerald-200 dark:hover:text-white border border-emerald-300 dark:border-emerald-400/40 backdrop-blur-xl transition-all cursor-pointer shadow-sm hover:scale-105"
            >
              <PlayIcon className="w-5 h-5 ml-0.5 text-emerald-600 dark:text-emerald-200" />
              <span className="absolute right-14 px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-300/80 shadow-xl dark:bg-slate-950/90 dark:text-white dark:border-white/15 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-medium z-50 backdrop-blur-xl">
                Resume Development
              </span>
            </button>
          </motion.div>
        ) : (
          /* Resting Glass Badge on the Right Side of the Container */
          <motion.button
            key="restingPauseBadge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            id="pauseDevFabBtn"
            type="button"
            onClick={handlePause}
            title={
              isPauseRequested
                ? 'Pause requested. Waiting for active agent to complete execution... (Click to cancel)'
                : 'Pause Development'
            }
            aria-label={isPauseRequested ? 'Cancel Pending Pause' : 'Pause Development'}
            className={`group flex flex-col items-center justify-center w-12 h-14 rounded-2xl ${
              isPauseRequested
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950/45 dark:hover:bg-amber-950/70 dark:border-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.25)]'
                : 'bg-white/90 hover:bg-white border-slate-300/80 hover:border-slate-400 dark:bg-slate-950/[0.28] dark:hover:bg-slate-950/[0.45] dark:border-white/[0.09] dark:hover:border-white/20 shadow-lg'
            } backdrop-blur-2xl border cursor-pointer transition-all hover:scale-105`}
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <PauseIcon
              className={`w-5 h-5 transition-colors ${
                isPauseRequested
                  ? 'text-amber-600 dark:text-amber-300 animate-pulse'
                  : 'text-slate-700 dark:text-white/90 group-hover:text-purple-600 dark:group-hover:text-purple-300'
              }`}
            />
            <span
              className={`text-[9px] font-mono tracking-widest font-semibold uppercase leading-none mt-1 ${
                isPauseRequested
                  ? 'text-amber-700 dark:text-amber-300 animate-pulse'
                  : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
              }`}
            >
              {isPauseRequested ? 'WAIT' : 'PAUSE'}
            </span>
            <div
              className={`w-4 h-0.5 rounded-full mt-1 ${
                isPauseRequested
                  ? 'bg-amber-500 dark:bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse'
                  : 'bg-purple-500 dark:bg-purple-400/80 shadow-[0_0_6px_rgba(168,85,247,0.8)]'
              }`}
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PauseModifyFAB;
