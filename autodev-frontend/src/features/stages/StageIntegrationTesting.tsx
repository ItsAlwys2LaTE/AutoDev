import React, { useState } from 'react';
import {
  CommandLineIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import type { ExecutionResult } from '../../types';

export interface StageIntegrationTestingProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageIntegrationTesting: React.FC<StageIntegrationTestingProps> = ({
  onAdvance,
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
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <CommandLineIcon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              INTEGRATION AGENT
            </h2>
            <span
              id="testingResultsPill"
              className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200"
            >
              Testing Results
            </span>
          </div>
        </div>

        <button
          id="advanceToArbitrationBtn"
          type="button"
          onClick={() => onAdvance(7)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <span>Arbitration Engine</span>
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Revision Tabs ── */}
      {allRevs.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {allRevs.map((rev, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === idx
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {rev.label || `Rev ${idx}`}
            </button>
          ))}
        </div>
      )}

      {/* ── Testing Execution Surface ── */}
      <div className="flex-1 min-h-0 flex flex-col rounded-3xl bg-white border border-slate-200 p-5 shadow-md space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Sandbox Test Run:</span>
            <span
              id="execStatusBadge"
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                passed
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
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

          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5" />
            <span>Isolated Container Execution</span>
          </div>
        </div>

        {/* Monospace Log Viewer */}
        <div className="flex-1 min-h-0 rounded-2xl bg-slate-900 border border-slate-800 p-4 overflow-y-auto custom-scrollbar font-mono text-xs text-slate-200 leading-relaxed shadow-inner">
          <pre id="execLogsOutput" className="whitespace-pre-wrap break-all">
            {logs}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default StageIntegrationTesting;
