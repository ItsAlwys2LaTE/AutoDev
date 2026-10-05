import React, { useState } from 'react';
import {
  RectangleGroupIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { PipelineDashboard } from '../pipeline/PipelineDashboard';

export interface StageComponentPipelineProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export type PipelineViewMode = 'visualizer' | 'componentwise';
export type ComponentPhase = 'design' | 'codegen' | 'testing' | 'arbitration';

export const StageComponentPipeline: React.FC<StageComponentPipelineProps> = ({
  onAdvance,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<PipelineViewMode>('componentwise');
  const [selectedPhase, setSelectedPhase] = useState<ComponentPhase>('codegen');

  const pipelineQueue = useAppStore((s) => s.pipelineQueue) || [];
  const activeComponentId = useAppStore((s) => s.activeComponentId);
  const setActiveComponent = useAppStore((s) => s.setActiveComponent);
  const componentStates = useAppStore((s) => s.componentStates) || {};

  const currentComponentId = activeComponentId || (pipelineQueue.length > 0 ? pipelineQueue[0].component_id : null);
  const selectedComponent = pipelineQueue.find((c) => c.component_id === currentComponentId) || pipelineQueue[0] || null;

  // Completion check
  const passedCount = pipelineQueue.filter((c) => {
    const st = componentStates[c.component_id]?.status;
    return st === 'passed' || st === 'COMPLETED';
  }).length;
  const allPassed = pipelineQueue.length > 0 && passedCount === pipelineQueue.length;

  return (
    <div
      id="stageComponentPipeline"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-4 space-y-4 select-none ${className}`}
    >
      {/* ── Top Bar: Title & Pill Toggle ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <RectangleGroupIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              COMPONENT PIPELINE DASHBOARD
            </h2>
            <p className="text-[11px] text-slate-500">
              {passedCount} / {pipelineQueue.length} components completed
            </p>
          </div>
        </div>

        {/* Pill-shaped toggle: PIPELINE VISUALIZER vs COMPONENTWISE VISUALIZATION */}
        <div className="flex items-center p-1 rounded-full bg-slate-100 border border-slate-200">
          <button
            id="togglePipelineVisualizerBtn"
            type="button"
            onClick={() => setViewMode('visualizer')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              viewMode === 'visualizer'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            PIPELINE VISUALIZER
          </button>
          <button
            id="toggleComponentwiseBtn"
            type="button"
            onClick={() => setViewMode('componentwise')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              viewMode === 'componentwise'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            COMPONENTWISE VISUALIZATION
          </button>
        </div>

        {/* Integration Stage Navigation Button */}
        {allPassed && (
          <button
            id="advanceToIntegrationBtn"
            type="button"
            onClick={() => onAdvance(6)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <span>Proceed to Integration</span>
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Sub-Bar: Nested Dropdowns & Phase Selectors (when in Component-wise mode) ── */}
      {viewMode === 'componentwise' && pipelineQueue.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          {/* Dropdown 1: Component Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Component:</span>
            <div className="relative">
              <select
                id="componentDropdownSelect"
                value={selectedComponent?.component_id || ''}
                onChange={(e) => setActiveComponent(e.target.value)}
                className="appearance-none bg-white border border-slate-300 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                {pipelineQueue.map((comp, idx) => (
                  <option key={comp.component_id} value={comp.component_id} className="bg-white text-slate-900">
                    {`C${idx + 1}: ${comp.component_name || comp.component_id}`}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Phase Selector Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedPhase('design')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedPhase === 'design'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DocumentTextIcon className="w-3.5 h-3.5" />
              <span>Design</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPhase('codegen')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedPhase === 'codegen'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CodeBracketIcon className="w-3.5 h-3.5" />
              <span>Codegen</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPhase('testing')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedPhase === 'testing'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CommandLineIcon className="w-3.5 h-3.5" />
              <span>Testing</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPhase('arbitration')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedPhase === 'arbitration'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheckIcon className="w-3.5 h-3.5" />
              <span>Arbitration</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main View Body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {viewMode === 'visualizer' ? (
          /* PIPELINE VISUALIZER: Pure Black Space with centered "Coming soon!" */
          <div
            id="pipelineVisualizerCanvas"
            className="w-full h-full min-h-[400px] rounded-3xl bg-black border border-white/10 flex flex-col items-center justify-center text-center p-8 select-none"
          >
            <SparklesIcon className="w-8 h-8 text-cyan-400/80 mb-3 animate-pulse" />
            <h3 className="text-xl md:text-2xl font-bold text-white tracking-wider mb-2">
              Coming soon!
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              The high-dimensional node visualizer is currently in synthesis. Use Componentwise Visualization to inspect tracks and code.
            </p>
          </div>
        ) : (
          /* COMPONENTWISE VISUALIZATION */
          <div className="space-y-4">
            {/* Embedded Pipeline Dashboard preserving ticker and legacy track states */}
            <PipelineDashboard
              alwaysRender={true}
              onIntegrate={() => onAdvance(8)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StageComponentPipeline;
