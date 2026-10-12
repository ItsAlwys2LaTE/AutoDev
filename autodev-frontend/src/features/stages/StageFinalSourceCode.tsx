import React, { useState } from 'react';
import {
  CodeBracketIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useAppStore } from '../../stores/appStore';
import { detectLanguage } from '../ide/languageDetector';
import { handleBeforeMount, patchEditorInstance, patchMonaco } from '../ide/monacoPatcher';
import { ScrollFade } from '../../components/ScrollFade';
import type { GeneratedCodeBase } from '../../types';

export interface StageFinalSourceCodeProps {
  onAdvance?: (targetStage: number) => void;
  className?: string;
}

export const StageFinalSourceCode: React.FC<StageFinalSourceCodeProps> = ({
  onAdvance: _onAdvance,
  className = '',
}) => {
  const storeIntegratedCodebase = useAppStore((s) => s.integratedCodebase);
  const storeCurrentCodebase = useAppStore((s) => s.currentCodebase);
  const isPaused = useAppStore((s) => s.isPaused);
  const setCodebase = useAppStore((s) => s.setCodebase);

  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  // Final source code strictly from integrated or current codebase
  const codebase: GeneratedCodeBase | null = storeIntegratedCodebase || storeCurrentCodebase;
  const files = codebase?.files || [];
  const activeFile = files[activeFileIndex] || files[0] || null;
  const language = activeFile ? detectLanguage(activeFile.file_name) : 'plaintext';

  const handleMount: OnMount = (editor, monaco) => {
    patchEditorInstance(editor);
    if (monaco) {
      patchMonaco(monaco);
    }
  };

  const handleFileContentChange = (newCode: string) => {
    if (!codebase || !activeFile) return;
    const updatedFiles = codebase.files.map((f) =>
      f.file_name === activeFile.file_name ? { ...f, source_code: newCode } : f
    );
    const updatedCodebase = { ...codebase, files: updatedFiles };
    setCodebase(updatedCodebase);
  };

  return (
    <div
      id="stageFinalSourceCode"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-3 space-y-3.5 select-none ${className}`}
    >
      {/* ── Top Bar: Title & Description ── */}
      <div className="space-y-1.5 pb-2 border-b border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] shrink-0">
            <CodeBracketIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
            Final Source Code
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-300">
          Final verified production source codebase resulting from autonomous synthesis, sandbox testing, and multi-critic adjudication.
        </p>
      </div>

      {/* ── Main Source Code Workspace (File Explorer + Monaco Editor) ── */}
      <div
        id="finalCodeContainer"
        className="flex-1 min-h-[500px] flex flex-col md:flex-row border border-white/[0.07] rounded-3xl overflow-hidden bg-slate-950/[0.25] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        {/* Left Pane: File Explorer */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-slate-950/[0.12] backdrop-blur-md flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-white/10 flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <DocumentTextIcon className="w-3.5 h-3.5 text-white/80" />
              Files ({files.length})
            </span>
          </div>

          <ScrollFade className="flex-1 overflow-y-auto p-2 space-y-1">
            {files.length === 0 ? (
              <p className="text-xs text-slate-500 p-2 italic">No files available</p>
            ) : (
              files.map((file, idx) => {
                const isSelected = activeFileIndex === idx;
                return (
                  <button
                    key={file.file_name}
                    type="button"
                    onClick={() => setActiveFileIndex(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 text-white font-semibold border border-white/20 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                    }`}
                  >
                    <CodeBracketIcon className="w-3.5 h-3.5 text-white/60 shrink-0" />
                    <span className="truncate">{file.file_name}</span>
                  </button>
                );
              })
            )}
          </ScrollFade>
        </div>

        {/* Right Pane: Code Editor Surface */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#1e1e1e] flex flex-col">
          {/* Top file tab header */}
          <div className="px-3.5 py-2.5 border-b border-white/10 bg-slate-950/[0.12] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <CodeBracketIcon className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span className="truncate max-w-[280px] sm:max-w-md text-white font-semibold">
                {activeFile?.file_name || 'No file selected'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 uppercase bg-white/[0.06] px-2 py-0.5 rounded-md border border-white/10">
              {language}
            </span>
          </div>

          {/* Editor Pane */}
          <div className="flex-1 h-full relative">
            {!activeFile ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs p-6 text-center">
                <p>No source file selected or available.</p>
              </div>
            ) : (
              <Editor
                key={`final-${activeFileIndex}-${activeFile.file_name}`}
                path={`final://${activeFile.file_name}`}
                height="100%"
                language={language}
                value={activeFile.source_code ?? ''}
                theme="vs-dark"
                options={{
                  readOnly: !isPaused,
                  automaticLayout: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  tabSize: 2,
                  renderWhitespace: 'selection',
                  padding: { top: 8, bottom: 8 },
                }}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                onChange={(val) => {
                  if (val !== undefined && isPaused) {
                    handleFileContentChange(val);
                  }
                }}
                loading={
                  <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs gap-2">
                    <svg className="animate-spin h-4 w-4 text-white/70" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading final source code...</span>
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageFinalSourceCode;
