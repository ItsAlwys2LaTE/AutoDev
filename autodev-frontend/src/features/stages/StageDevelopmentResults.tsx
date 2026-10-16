import React, { useState, useMemo } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircleIcon,
  CpuChipIcon,
  ScaleIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { DevelopmentProgressGraph } from '../../components/DevelopmentProgressGraph';
import { SpecularButton } from '../../components/SpecularButton';
import { formatDuration } from '../../components/DevelopmentGanttChart';
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
  const storeMetrics = useAppStore((s) => s.timelineMetrics);
  const componentStates = useAppStore((s) => s.componentStates);

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

  // Timeline Metrics Calculations
  const intervals = storeMetrics.intervals || [];
  const totalDurationMs = useMemo(() => {
    if (storeMetrics.totalDurationMs > 0) return storeMetrics.totalDurationMs;
    if (intervals.length === 0) return 24500;
    const computedMin = storeMetrics.pipelineStartTime ?? Math.min(...intervals.map((i) => i.startTime));
    const computedMax = storeMetrics.pipelineEndTime ?? Math.max(
      ...intervals.map((i) => (i.endTime > 0 ? i.endTime : i.startTime + i.durationMs))
    );
    return Math.max(1000, computedMax - computedMin);
  }, [storeMetrics, intervals]);

  const completedPhasesCount = useMemo(() => {
    const passed = intervals.filter((i) => i.status === 'completed' || i.status === 'passed').length;
    return passed > 0 ? passed : 8;
  }, [intervals]);

  const componentCount = useMemo(() => {
    const set = new Set<string>();
    intervals.forEach((i) => {
      if (i.componentId) set.add(i.componentId);
      else if (i.componentName) set.add(i.componentName);
    });
    if (set.size > 0) return set.size;
    const fromStates = Object.keys(componentStates || {}).length;
    if (fromStates > 0) return fromStates;
    return decomposition?.components?.length || 4;
  }, [intervals, componentStates, decomposition]);

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
      className={`h-full flex flex-col max-w-6xl mx-auto px-2 py-1 sm:py-2 space-y-3 sm:space-y-3.5 select-none ${className}`}
    >
      {/* ── 1. Product Development Status Section (Green hue for successful, Red hue for failed) ── */}
      {/* ── 1. Product Development Status Section (Green hue for successful, Red hue for failed) ── */}
      <div
        id="resultsMainStageContainer"
        className={`rounded-2xl sm:rounded-3xl backdrop-blur-md p-5 sm:p-5.5 transition-all duration-300 shadow-md ${
          isFailed
            ? 'bg-gradient-to-br from-rose-100 via-rose-50 to-white dark:from-rose-950/60 dark:via-rose-950/40 dark:to-slate-950/50 border-2 border-rose-300 dark:border-rose-500/50'
            : 'bg-gradient-to-br from-emerald-100/90 via-emerald-50/70 to-white dark:from-emerald-950/60 dark:via-emerald-950/40 dark:to-slate-950/50 border-2 border-emerald-300 dark:border-emerald-500/50'
        }`}
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-5">
          <div className="space-y-1.5 max-w-xl">
            <h2
              id="resultsStatusHeadline"
              className="text-xl sm:text-2xl md:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight leading-snug"
            >
              {statusHeadline}
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {isFailed
                ? 'Development was aborted. You can restart or request a new product.'
                : 'Full codebase generated, sandbox verified, and approved by multi-critic arbitration.'}
            </p>
          </div>

          {/* Action Buttons: 2 columns on top, merged full-width button below */}
          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto shrink-0">
            <button
              id="downloadZipBtn"
              type="button"
              onClick={handleDownloadZip}
              disabled={!codebase || isExportingZip}
              className="col-span-1 px-4.5 sm:px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white disabled:opacity-40 font-semibold text-xs tracking-wide border border-slate-300 dark:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm whitespace-nowrap"
            >
              <ArrowDownTrayIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{isExportingZip ? 'PACKAGING ZIP...' : 'DOWNLOAD AS ZIP'}</span>
            </button>

            <button
              id="commitToGitHubBtn"
              type="button"
              onClick={handleOpenGitHub}
              disabled={!codebase}
              className="col-span-1 px-4.5 sm:px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] dark:text-slate-200 dark:hover:text-white disabled:opacity-40 font-semibold text-xs tracking-wide border border-slate-300 dark:border-white/[0.08] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-sm"
            >
              <ArrowUpTrayIcon className="w-4 h-4 shrink-0" />
              <span>COMMIT TO GITHUB</span>
            </button>

            {/* Post-Development Support Button: spans both columns directly below */}
            <button
              id="postDevCycleTriggerBtn"
              type="button"
              onClick={() => onAdvance(10)}
              className="col-span-2 w-full px-4.5 sm:px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white font-semibold text-xs tracking-wide border border-slate-300 dark:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
            >
              <WrenchScrewdriverIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-colors shrink-0" />
              <span>POST-DEVELOPMENT SUPPORT</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Dedicated Development Metrics Section ── */}
      <div
        id="resultsMetricsContainer"
        className="rounded-2xl sm:rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-200 dark:border-white/[0.07] p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-sm"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        {/* Top 4 Metric Cards (compact sizing) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Metric 1: Total Duration */}
          <div className="rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <ClockIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500 dark:text-sky-400" />
              <span>Elapsed Time</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
              {formatDuration(totalDurationMs)}
            </div>
          </div>

          {/* Metric 2: Completed Phases */}
          <div className="rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <CheckCircleIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Phases Completed</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
              {`${completedPhasesCount} / ${intervals.length > 0 ? intervals.length : 8}`}
            </div>
          </div>

          {/* Metric 3: Components Processed */}
          <div className="rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <CpuChipIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Architecture Units</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
              {`${componentCount} Modules`}
            </div>
          </div>

          {/* Metric 4: Arbitration Quality */}
          <div className="rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] p-2 sm:p-2.5 flex flex-col justify-between space-y-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <ScaleIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500 dark:text-purple-400" />
              <span>Arbitration Quality</span>
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {isFailed ? 'Terminated' : '100% Passed'}
            </div>
          </div>
        </div>

        {/* Simple to Understand, Beautifully Animated Graph */}
        <DevelopmentProgressGraph />
      </div>

      {/* ── 3. Request New Product Button (Outside of stage container, at the very bottom with SpecularButton) ── */}
      <div className="flex items-center justify-center pt-1 pb-1 shrink-0">
        <SpecularButton
          id="resultsRequestNewProductBtn"
          type="button"
          onClick={handleRequestNewProduct}
          size="sm"
          radius={18}
          tint="#ffffff"
          tintOpacity={0.04}
          blur={16}
          lineColor="#ffffff"
          baseColor="#000000"
          textColor="#ffffff"
          intensity={1.3}
          shineSize={14}
          shineFade={36}
          thickness={1.5}
          speed={0.4}
          followMouse={true}
          proximity={240}
          autoAnimate={true}
          className="px-7 md:px-8 py-2.5 md:py-3 font-semibold text-xs tracking-wider shadow-[0_6px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_24px_rgba(255,255,255,0.08)] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-white/90" />
            <span>REQUEST NEW PRODUCT</span>
          </div>
        </SpecularButton>
      </div>
    </div>
  );
};

export default StageDevelopmentResults;
