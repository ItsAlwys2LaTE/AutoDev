import React from 'react';
import {
  CpuChipIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { DecompositionOutput } from '../decomposition/DecompositionOutput';

export interface StageDecompositionProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageDecomposition: React.FC<StageDecompositionProps> = ({
  onAdvance,
  className = '',
}) => {
  const isComponentMode = useAppStore((s) => s.isComponentMode);
  const pipelineQueue = useAppStore((s) => s.pipelineQueue);

  return (
    <div
      id="stageDecomposition"
      className={`h-full flex flex-col max-w-5xl mx-auto px-4 py-4 space-y-4 select-none ${className}`}
    >
      {/* Top Bar for Decomposition Stage */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <CpuChipIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              DECOMPOSITION AGENT
            </h2>
            <p className="text-[11px] text-slate-500">
              Parallel component architecture decomposition, dependency graph, and container images
            </p>
          </div>
        </div>

        {(isComponentMode || (pipelineQueue && pipelineQueue.length > 0)) && (
          <button
            type="button"
            onClick={() => onAdvance(5)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <span>View Pipeline Dashboard</span>
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Decomposition 2x2 Grid View */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <DecompositionOutput
          alwaysRender={true}
          onPipelineLaunched={() => onAdvance(5)}
          onProceedToDesign={() => onAdvance(5)}
        />
      </div>
    </div>
  );
};

export default StageDecomposition;
