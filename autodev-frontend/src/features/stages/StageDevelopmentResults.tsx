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
      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isFailed ? (
              <XCircleIcon className="w-5 h-5 text-rose-500" />
            ) : (
              <CheckBadgeIcon className="w-5 h-5 text-emerald-500" />
            )}
            <span
              className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isFailed
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isFailed ? 'EXECUTION TERMINATED' : 'SDLC VERIFIED & READY'}
            </span>
          </div>
          <h2
            id="resultsStatusHeadline"
            className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight"
          >
            {statusHeadline}
          </h2>
          <p className="text-xs text-slate-500">
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
            className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>{isExportingZip ? 'PACKAGING ZIP...' : 'DOWNLOAD AS ZIP'}</span>
          </button>

          <button
            id="commitToGitHubBtn"
            type="button"
            onClick={handleOpenGitHub}
            disabled={!codebase}
            className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold text-xs tracking-wide border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            <span>COMMIT TO GITHUB</span>
          </button>

          <button
            id="resultsRequestNewProductBtn"
            type="button"
            onClick={handleRequestNewProduct}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>REQUEST NEW PRODUCT</span>
          </button>
        </div>
      </div>

      {/* ── Prominent Trigger for Post-Development Revision Loop ── */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-blue-600" />
            <span>Continuous Product Enhancement</span>
          </h3>
          <p className="text-xs text-slate-600">
            Apply automated feature expansions, targeted bug fixes, or perform deep architectural Q&amp;A.
          </p>
        </div>

        <button
          id="postDevCycleTriggerBtn"
          type="button"
          onClick={() => onAdvance(11)}
          className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold tracking-wider shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>REQUEST NEW FEATURE/ PRODUCT ENQUIRY/ BUG FIXES</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* ── Timeline Gantt Chart ── */}
      <div className="flex-1 min-h-[300px] overflow-y-auto custom-scrollbar rounded-3xl bg-white border border-slate-200 p-5 shadow-md space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <ChartBarIcon className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Pipeline Execution Timeline (Gantt Metrics)
          </h4>
        </div>
        <DevelopmentGanttChart />
      </div>
    </div>
  );
};

export default StageDevelopmentResults;
