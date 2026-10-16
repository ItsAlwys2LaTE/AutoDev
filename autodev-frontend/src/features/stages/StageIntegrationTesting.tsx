import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CommandLineIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import type { ExecutionResult } from '../../types';
import { ModernScrollbar } from '../../components/ModernScrollbar';

export interface StageIntegrationTestingProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageIntegrationTesting: React.FC<StageIntegrationTestingProps> = ({
  onAdvance: _onAdvance,
  className = '',
}) => {
  const storeExecutionResult = useAppStore((s) => s.currentExecutionResult);
  const executionLogs = useAppStore((s) => s.executionLogs);
  const integrationRevisionHistory = useAppStore((s) => s.integrationRevisionHistory) || [];
  const revisionHistory = useAppStore((s) => s.revisionHistory) || [];

  const [activeTab, setActiveTab] = useState<number>(0);

  // Revisions to display
  const allRevs = integrationRevisionHistory.length > 0 ? integrationRevisionHistory : revisionHistory;
  const currentItem = allRevs[activeTab];
  const execResult: ExecutionResult | null = currentItem?.executionResult || storeExecutionResult || null;
  const logs = execResult?.logs || executionLogs || 'No sandbox test execution logs available.';
  const passed = execResult?.success ?? true;

  return (
    <div
      id="stageIntegrationTesting"
      className={`h-full flex flex-col max-w-5xl mx-auto px-4 py-4 space-y-4 select-none ${className}`}
    >
      {/* ── Top Bar: Title & Testing Results Pill ── */}
      <div className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-800 dark:text-white/90 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] shrink-0">
            <CommandLineIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800 dark:text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
            Integration Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
          Sandbox test suite execution across the unified codebase and all component integration boundaries.
        </p>
      </div>

      {/* ── Revision Tabs ── */}
      {allRevs.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="relative flex items-center p-0.5 rounded-full bg-slate-100 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] backdrop-blur-sm gap-1">
            {allRevs.map((rev, idx) => {
              const isActive = activeTab === idx;
              return (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(idx)}
                  className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="stageIntegrationTestingRevGlider"
                      className="absolute inset-0 rounded-full bg-white dark:bg-white/15 border border-slate-200 dark:border-white/20 shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                    />
                  )}
                  <span className="relative z-10">{rev.label || `Rev ${idx}`}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Testing Execution Surface ── */}
      <div
        className="flex-1 min-h-0 flex flex-col rounded-3xl bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md border border-slate-200 dark:border-white/[0.07] p-5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] space-y-4"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        {/* Status Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sandbox Test Run:</span>
            <span
              id="execStatusBadge"
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                passed
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-400/30'
              }`}
            >
              {passed ? (
                <>
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>PASSED</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="w-3.5 h-3.5" />
                  <span>FAILED</span>
                </>
              )}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5" />
            <span>Isolated Container Execution</span>
          </div>
        </div>

        {/* Monospace Log Viewer with ModernScrollbar */}
        <ModernScrollbar
          className="flex-1 min-h-0 rounded-2xl bg-slate-950 text-slate-100 dark:bg-black/50 dark:text-slate-200 border border-slate-800 dark:border-white/[0.07] shadow-inner overflow-hidden"
          viewportClassName="p-4 font-mono text-xs leading-relaxed text-slate-100 dark:text-slate-200"
        >
          <pre
            id="execLogsOutput"
            className="whitespace-pre-wrap break-all text-slate-100 dark:text-slate-200 font-mono"
            style={{ color: '#f1f5f9' }}
          >
            {logs}
          </pre>
        </ModernScrollbar>
      </div>
    </div>
  );
};

export default StageIntegrationTesting;
