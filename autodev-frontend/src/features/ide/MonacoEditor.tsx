/**
 * AutoDev Monaco Code Editor Component
 * 
 * Replaces CDN Monaco with @monaco-editor/react:
 * - Auto-detects language using detectLanguage helper
 * - Theme: vs-dark
 * - Read-only in QUICK mode; editable in COMPLEX mode
 * - User edit/focus triggers countdown pauses
 */

import { useRef } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import { detectLanguage } from './languageDetector';
import type { CodeFile } from '../../types';

export interface MonacoEditorProps {
  file: CodeFile | null;
  isReadOnly?: boolean;
  onChange?: (newContent: string) => void;
  onFocus?: () => void;
  height?: string | number;
  className?: string;
}

export function MonacoEditor({
  file,
  isReadOnly = false,
  onChange,
  onFocus,
  height = '100%',
  className = '',
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);

  const language = file ? detectLanguage(file.file_name) : 'plaintext';
  const value = file?.source_code ?? '';

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Listen to focus event to notify parent (e.g. to pause countdowns in COMPLEX mode)
    editor.onDidFocusEditorText(() => {
      onFocus?.();
    });
  };

  const handleChange: OnChange = (val) => {
    if (val !== undefined && !isReadOnly) {
      onChange?.(val);
    }
  };

  return (
    <div
      id="monacoContainer"
      className={`flex-1 w-full h-full relative overflow-hidden bg-[#1e1e1e] ${className}`}
    >
      <Editor
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
              className="animate-spin h-4 w-4 text-indigo-400"
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
            <span>Loading editor...</span>
          </div>
        }
      />
    </div>
  );
}
