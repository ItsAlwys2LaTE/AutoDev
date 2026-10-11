import React, { useState } from 'react';
import {
  CheckBadgeIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  ArrowRightIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { DevelopmentGanttChart } from '../../components/DevelopmentGanttChart';
import { ScrollFade } from '../../components/ScrollFade';
import { exportZip } from '../../utils/zipExporter';

import { resetAllStores } from '../../stores';

export interface StageDevelopmentResultsProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageDevelopmentResults: React.FC<StageDevelopmentResultsProps> = ({
  onAdvance,
  className = '',
}) => {
  const requirements = useAppStore((s) => s.requirements);
  const decomposition = useAppStore((s) => s.decomposition);
  const storeIntegratedCodebase = useAppStore((s) => s.integratedCodebase);
  const storeCurrentCodebase = useAppStore((s) => s.currentCodebase);
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const setGitHubModalOpen = useAppStore((s) => s.setGitHubModalOpen);

  const [isExportingZip, setIsExportingZip] = useState(false);

  const codebase = storeIntegratedCodebase || storeCurrentCodebase;

  // Resolve Product Name
  const productName =
    requirements?.project_title ||
    decomposition?.components?.[0]?.component_name ||
    'AutoDev Project';

  const isFailed = pipelineStatus === 'aborted';
  const statusHeadline = isFailed
    ? `${productName.toUpperCase()} DEVELOPMENT FAILED`
    : `${productName.toUpperCase()} DEVELOPMENT SUCCESSFUL`;

  const handleDownloadZip = async () => {
    if (!codebase) return;
    setIsExportingZip(true);
    try {
      await exportZip(codebase, {
        projectTitle: productName,
        fallbackReadmeTitle: productName,
      });
    } catch (err) {
      console.error('[StageDevelopmentResults] Failed to export ZIP:', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleOpenGitHub = () => {
    if (typeof setGitHubModalOpen === 'function') {
      setGitHubModalOpen(true);
    }
  };

  const handleRequestNewProduct = () => {
    resetAllStores();
    onAdvance(1);
  };

  return (
    <div
      id="stageDevelopmentResults"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-4 space-y-6 select-none ${className}`}
    >
      {/* ── Top Status Header Banner ── */}
      <div
        className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isFailed ? (
              <XCircleIcon className="w-5 h-5 text-rose-400" />
            ) : (
              <CheckBadgeIcon className="w-5 h-5 text-emerald-400" />
            )}
            <span
              className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isFailed
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {isFailed ? 'EXECUTION TERMINATED' : 'SDLC VERIFIED & READY'}
            </span>
          </div>
          <h2
            id="resultsStatusHeadline"
            className="text-xl md:text-2xl font-bold text-white tracking-tight"
          >
            {statusHeadline}
          </h2>
          <p className="text-xs text-slate-400">
            {isFailed
              ? 'Development was aborted. You can restart or request a new product.'
              : 'Full codebase generated, sandbox verified, and approved by multi-critic arbitration.'}
          </p>
        </div>

        {/* Primary Export Actions + Request New Product */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="downloadZipBtn"
            type="button"
            onClick={handleDownloadZip}
            disabled={!codebase || isExportingZip}
            className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-semibold text-xs tracking-wide border border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>{isExportingZip ? 'PACKAGING ZIP...' : 'DOWNLOAD AS ZIP'}</span>
          </button>

          <button
            id="commitToGitHubBtn"
            type="button"
            onClick={handleOpenGitHub}
            disabled={!codebase}
            className="px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 text-slate-200 hover:text-white font-semibold text-xs tracking-wide border border-white/[0.08] transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            <span>COMMIT TO GITHUB</span>
          </button>

          <button
            id="resultsRequestNewProductBtn"
            type="button"
            onClick={handleRequestNewProduct}
            className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center gap-2 cursor-pointer border border-white/20"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>REQUEST NEW PRODUCT</span>
          </button>
        </div>
      </div>

      {/* ── Prominent Trigger for Post-Development Revision Loop ── */}
      <div
        className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-white/80" />
            <span>Continuous Product Enhancement</span>
          </h3>
          <p className="text-xs text-slate-300">
            Apply automated feature expansions, targeted bug fixes, or perform deep architectural Q&amp;A.
          </p>
        </div>

        <button
          id="postDevCycleTriggerBtn"
          type="button"
          onClick={() => onAdvance(11)}
          className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold tracking-wider border border-white/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-md"
        >
          <span>REQUEST NEW FEATURE/ PRODUCT ENQUIRY/ BUG FIXES</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* ── Timeline Gantt Chart with Dynamic ScrollFade ── */}
      <ScrollFade
        className="flex-1 min-h-[300px] overflow-y-auto rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-3"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <ChartBarIcon className="w-4 h-4 text-white/80" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Pipeline Execution Timeline (Gantt Metrics)
          </h4>
        </div>
        <DevelopmentGanttChart />
      </ScrollFade>
    </div>
  );
};

export default StageDevelopmentResults;
