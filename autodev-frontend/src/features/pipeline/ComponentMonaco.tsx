/**
 * AutoDev Isolated Component Monaco Code Editor
 *
 * Implements Milestone 2 R2:
 * - Isolated @monaco-editor/react editor instance per component track mounted in #monaco-${cId}
 * - Unique model URIs (`component://${cId}/rev-${revIndex}/${fileName}`) preventing cross-track model collision
 * - Active file switching with automatic language detection
 * - Read-only in QUICK mode; editable in COMPLEX mode
 * - Auto-pauses running countdowns on focus or content edit
 */

import { useRef } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import { detectLanguage } from '../ide/languageDetector';
import type { GeneratedCodeBase } from '../../types';

export interface ComponentMonacoProps {
  /** Component ID for unique DOM scoping and isolated Monaco model path */
  componentId: string;
  /** Active codebase containing files array */
  codebase: GeneratedCodeBase | null;
  /** Currently selected file index */
  activeFileIndex: number;
  /** Currently selected revision index */
  activeRevisionIndex?: number;
  /** Snapshot revision history */
  revisionHistory?: Array<{ codebase: GeneratedCodeBase }>;
  /** Read-only mode flag (true in QUICK mode) */
  isReadOnly?: boolean;
  /** Callback fired when user selects a file from the explorer */
  onSelectFile?: (index: number) => void;
  /** Callback fired when user switches revision tabs */
  onSelectRevision?: (index: number) => void;
  /** Callback fired when user edits code in COMPLEX mode */
  onFileContentChange?: (fileName: string, newSourceCode: string) => void;
  /** Callback fired when user focuses editor or makes edits (to pause countdowns) */
  onFocus?: () => void;
  /** Custom editor height */
  height?: string | number;
  /** Custom container wrapper CSS classes */
  className?: string;
}

export function ComponentMonaco({
  componentId,
  codebase,
  activeFileIndex = 0,
  activeRevisionIndex = 0,
  isReadOnly = false,
  onFileContentChange,
  onFocus,
  height = '100%',
  className = '',
}: ComponentMonacoProps) {
  const editorRef = useRef<any>(null);

  const files = codebase?.files || [];
  const activeFile = files[activeFileIndex] || files[0] || null;

  // Language auto-detection
  const language = activeFile ? detectLanguage(activeFile.file_name) : 'plaintext';
  const value = activeFile?.source_code ?? '';

  // Unique model URI ensuring complete isolation per track and revision
  const modelUri = activeFile
    ? `component://${componentId}/rev-${activeRevisionIndex}/${activeFile.file_name}`
    : undefined;

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Trigger focus callback to pause any active countdowns (e.g. COMPLEX mode review)
    editor.onDidFocusEditorText(() => {
      onFocus?.();
    });
  };

  const handleChange: OnChange = (val) => {
    if (val !== undefined && !isReadOnly) {
      onFocus?.();
      if (activeFile && onFileContentChange) {
        onFileContentChange(activeFile.file_name, val);
      }
    }
  };

  return (
    <div
      id={`monaco-${componentId}`}
      className={`relative w-full h-full bg-[#1e1e1e] overflow-hidden ${className}`}
    >
      {!activeFile ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs p-6 text-center">
          <p>No source file selected or available.</p>
        </div>
      ) : (
        <Editor
          path={modelUri}
          height={height}
          language={language}
          value={value}
          theme="vs-dark"
          options={{
            readOnly: isReadOnly,
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
          onMount={handleMount}
          onChange={handleChange}
          loading={
            <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs gap-2">
              <svg
                className="animate-spin h-4 w-4 text-cyan-400"
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
              <span>Loading Monaco editor...</span>
            </div>
          }
        />
      )}
    </div>
  );
}
