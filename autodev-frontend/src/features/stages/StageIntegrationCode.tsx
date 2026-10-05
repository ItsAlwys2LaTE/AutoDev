import React, { useState } from 'react';
import {
  CodeBracketIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { IntegrationMonacoView } from '../integration/IntegrationMonacoView';
import type { GeneratedCodeBase } from '../../types';

export interface StageIntegrationCodeProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageIntegrationCode: React.FC<StageIntegrationCodeProps> = ({
  onAdvance,
  className = '',
}) => {
  const storeIntegratedCodebase = useAppStore((s) => s.integratedCodebase);
  const storeCurrentCodebase = useAppStore((s) => s.currentCodebase);
  const storeActiveFileIndex = useAppStore((s) => s.activeFileIndex);
  const setActiveFileIndex = useAppStore((s) => s.setActiveFileIndex);
  const isDiffMode = useAppStore((s) => s.isDiffMode);
  const setIsDiffMode = useAppStore((s) => s.setIsDiffMode);
  const isPaused = useAppStore((s) => s.isPaused);
  const revisionHistory = useAppStore((s) => s.revisionHistory) || [];
  const activeRevisionIndex = useAppStore((s) => s.activeRevisionIndex) || 0;
  const setActiveRevisionIndex = useAppStore((s) => s.setActiveRevisionIndex);
  const setCodebase = useAppStore((s) => s.setCodebase);

  const [localFileIndex, setLocalFileIndex] = useState(storeActiveFileIndex || 0);

  const codebase: GeneratedCodeBase | null = storeIntegratedCodebase || storeCurrentCodebase;

  const handleFileChange = (fileName: string, newCode: string) => {
    if (!codebase) return;
    const updatedFiles = codebase.files.map((f) =>
      f.file_name === fileName ? { ...f, source_code: newCode } : f
    );
    const updatedCodebase = { ...codebase, files: updatedFiles };
    setCodebase(updatedCodebase);
  };

  return (
    <div
      id="stageIntegrationCode"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-4 space-y-4 select-none ${className}`}
    >
      {/* ── Top Bar: Title & Final Source Code Pill ── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <CodeBracketIcon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              INTEGRATION AGENT
            </h2>
            <span
              id="finalSourceCodePill"
              className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200"
            >
              Final Source Code
            </span>
          </div>
        </div>

        <button
          id="advanceToLivePreviewBtn"
          type="button"
          onClick={() => onAdvance(9)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <span>Live Preview</span>
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Monaco Editor Surface ── */}
      <div className="flex-1 min-h-[450px] rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-md">
        <IntegrationMonacoView
          codebase={codebase}
          activeFileIndex={localFileIndex}
          activeRevisionIndex={activeRevisionIndex}
          revisionHistory={revisionHistory}
          isReadOnly={!isPaused}
          isDiffMode={isDiffMode}
          onSelectFile={(idx) => {
            setLocalFileIndex(idx);
            setActiveFileIndex(idx);
          }}
          onSelectRevision={(idx) => setActiveRevisionIndex(idx)}
          onToggleDiff={() => setIsDiffMode(!isDiffMode)}
          onFileContentChange={handleFileChange}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default StageIntegrationCode;
