import React from 'react';
import {
  DocumentTextIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { RequirementsOutput } from '../requirements/RequirementsOutput';

export interface StageRequirementsProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageRequirements: React.FC<StageRequirementsProps> = ({
  onAdvance,
  className = '',
}) => {
  const requirements = useAppStore((s) => s.requirements);

  return (
    <div
      id="stageRequirements"
      className={`h-full flex flex-col max-w-5xl mx-auto px-4 py-4 space-y-4 select-none ${className}`}
    >
      {/* Top Bar for Requirements Stage */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <DocumentTextIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              REQUIREMENTS AGENT
            </h2>
            <p className="text-[11px] text-slate-500">
              Synthesized system specifications, user stories, and acceptance criteria
            </p>
          </div>
        </div>

        {requirements && (
          <button
            type="button"
            onClick={() => onAdvance(4)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <span>Proceed to Decomposition</span>
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Requirements View */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <RequirementsOutput />
      </div>
    </div>
  );
};

export default StageRequirements;
