import React from 'react';
import { CpuChipIcon } from '@heroicons/react/24/outline';
import { DecompositionOutput } from '../decomposition/DecompositionOutput';
import { ScrollFade } from '../../components/ScrollFade';

export interface StageDecompositionProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageDecomposition: React.FC<StageDecompositionProps> = ({
  onAdvance,
  className = '',
}) => {
  return (
    <ScrollFade
      id="stageDecomposition"
      className={`h-full flex flex-col justify-start max-w-5xl mx-auto px-4 py-4 select-none space-y-6 overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-800 dark:text-white/90 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
            <CpuChipIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800 dark:text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Decomposition Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
          Parallel component architecture decomposition, dependency graph, and container images derived from system specifications.
        </p>
      </div>

      {/* Main Decomposition View */}
      <DecompositionOutput
        alwaysRender={true}
        onPipelineLaunched={() => onAdvance(5)}
        onProceedToDesign={() => onAdvance(5)}
      />
    </ScrollFade>
  );
};

export default StageDecomposition;
