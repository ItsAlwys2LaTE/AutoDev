import React from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { RequirementsOutput } from '../requirements/RequirementsOutput';
import { ScrollFade } from '../../components/ScrollFade';

export interface StageRequirementsProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageRequirements: React.FC<StageRequirementsProps> = ({
  onAdvance,
  className = '',
}) => {
  return (
    <ScrollFade
      id="stageRequirements"
      className={`h-full flex flex-col justify-start max-w-5xl mx-auto px-4 py-4 select-none space-y-6 overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]">
            <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Requirements Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-300">
          Review synthesized system specifications, structured user stories, and testable acceptance criteria derived from your product goals.
        </p>
      </div>

      {/* Main Requirements View */}
      <RequirementsOutput onProceedToDesign={() => onAdvance(4)} />
    </ScrollFade>
  );
};

export default StageRequirements;
