/**
 * AutoDev Monaco Diff Viewer Component
 * 
 * Side-by-side differential viewer comparing previous vs current revision:
 * - Uses DiffEditor from @monaco-editor/react
 * - Auto-detects language using detectLanguage helper
 * - Theme: vs-dark
 * - Side-by-side rendering with readOnly: true
 * - Matches #diffContainer
 */

import { DiffEditor } from '@monaco-editor/react';
import { detectLanguage } from './languageDetector';
import type { CodeFile } from '../../types';

export interface DiffViewerProps {
  originalFile: CodeFile | null;
  modifiedFile: CodeFile | null;
  previousRevisionLabel?: string;
  currentRevisionLabel?: string;
  height?: string | number;
  className?: string;
}

export function DiffViewer({
  originalFile,
  modifiedFile,
  previousRevisionLabel = 'Previous Revision',
  currentRevisionLabel = 'Current Revision',
  height = '500px',
  className = '',
}: DiffViewerProps) {
  const fileName = modifiedFile?.file_name || originalFile?.file_name || '';
  const language = detectLanguage(fileName);

  const originalContent = originalFile?.source_code || '';
  const modifiedContent = modifiedFile?.source_code || '';

  return (
    <div
      id="diffContainer"
      className={`flex flex-col border border-slate-700 rounded-lg overflow-hidden mb-6 bg-[#1e1e1e] ${className}`}
      style={{ height }}
    >
      {/* Diff Header Bar */}
      <div className="flex items-center justify-between bg-slate-950 border-b border-slate-800 px-4 py-2 text-xs font-mono">
        <div className="flex items-center gap-3 text-slate-300">
          <span className="font-semibold text-purple-400">{fileName || 'No file selected'}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 capitalize">{language}</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500/80" />
            <span>{previousRevisionLabel} (Original)</span>
          </span>
          <span className="text-slate-600">→</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
            <span>{currentRevisionLabel} (Modified)</span>
          </span>
        </div>
      </div>

      {/* Monaco DiffEditor */}
      <div className="flex-1 w-full relative">
        <DiffEditor
          height="100%"
          language={language}
          original={originalContent}
          modified={modifiedContent}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
            lineNumbers: 'on',
            wordWrap: 'off',
            padding: { top: 8, bottom: 8 },
          }}
          loading={
            <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs gap-2">
              <svg
                className="animate-spin h-4 w-4 text-purple-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading diff viewer...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
