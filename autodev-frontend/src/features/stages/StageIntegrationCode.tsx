import React, { useState } from 'react';
import {
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { IntegrationMonacoView } from '../integration/IntegrationMonacoView';
import type { GeneratedCodeBase } from '../../types';

export interface StageIntegrationCodeProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageIntegrationCode: React.FC<StageIntegrationCodeProps> = ({
  onAdvance: _onAdvance,
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
      <div className="space-y-1.5 pb-2 border-b border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] shrink-0">
            <CodeBracketIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
            Integration Agent
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-300">
          Unified multi-component source codebase, cross-module assembly, and consolidated build configurations.
        </p>
      </div>

      {/* ── Monaco Editor Surface ── */}
      <div className="flex-1 min-h-[450px]">
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
