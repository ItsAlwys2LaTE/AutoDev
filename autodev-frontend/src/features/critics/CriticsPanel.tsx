/**
 * AutoDev Unified Critics & Adjudication Panel Island
 * 
 * Wraps CriticsOutput and AdjudicatorDecision into the #criticOutputSection container,
 * providing the mount point for #react-critics-panel.
 */

import { useAppStore } from '../../stores/appStore';
import { CriticsOutput } from './CriticsOutput';
import { AdjudicatorDecision } from './AdjudicatorDecision';

export interface CriticsPanelProps {
  onGenerateDocs?: () => void;
  onDownloadZip?: () => void;
  className?: string;
}

export function CriticsPanel({
  onGenerateDocs,
  onDownloadZip,
  className = '',
}: CriticsPanelProps) {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const sFeedbacks = useAppStore((s) => s.criticEvaluations);
  const sDecisions = useAppStore((s) => s.adjudicatorDecisions);
  const sInFlightPhase = useAppStore((s) => s.inFlightPhase);
  const sPipelineStatus = useAppStore((s) => s.pipelineStatus);

  const storeFeedbacks = isSSR ? (liveStore?.criticEvaluations ?? []) : sFeedbacks;
  const storeDecisions = isSSR ? (liveStore?.adjudicatorDecisions ?? []) : sDecisions;
  const inFlightPhase = isSSR ? (liveStore?.inFlightPhase ?? null) : sInFlightPhase;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? 'idle') : sPipelineStatus;

  const isVisible =
    storeFeedbacks.length > 0 ||
    storeDecisions.length > 0 ||
    inFlightPhase === 'single_critics' ||
    inFlightPhase === 'documentation' ||
    pipelineStatus === 'completed';

  if (!isVisible) {
    return null;
  }

  return (
    <div
      id="criticOutputSection"
      className={`bg-slate-900 rounded-xl shadow-md border border-slate-800 p-6 fade-in transition-all duration-200 ${className}`}
    >
      <CriticsOutput />
      <AdjudicatorDecision
        onGenerateDocs={onGenerateDocs}
        onDownloadZip={onDownloadZip}
      />
    </div>
  );
}
