/**
 * AutoDev Integration Monaco Code & Diff View Component
 * 
 * Implements Milestone 3 R3:
 * - Legacy DOM IDs `#codeOutputSection` and `#ideContainer`
 * - Displays header: `Unified Integrated Codebase` or `Unified Integrated Codebase (Revision X/Y)`
 * - Left pane: File explorer sidebar with active file selection
 * - Right pane: Monaco code editor (`@monaco-editor/react`) with:
 *   - Model URI: `integration://rev-${revIndex}/${fileName}`
 *   - Theme: `vs-dark`
 *   - Automatic layout enabled
 *   - Read-only in QUICK mode; fully editable in COMPLEX mode
 *   - DiffEditor comparison when diff mode is toggled
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Editor, { DiffEditor, type OnMount, type OnChange } from '@monaco-editor/react';
import { detectLanguage } from '../ide/languageDetector';
import { handleBeforeMount, patchEditorInstance, patchMonaco } from '../ide/monacoPatcher';
import { LivePreview } from '../ide/LivePreview';
import { IntegrationRevTabs } from './IntegrationRevTabs';
import type { GeneratedCodeBase, CodeFile } from '../../types';
import { ScrollFade } from '../../components/ScrollFade';

export interface IntegrationMonacoViewProps {
  /** Unified integrated codebase */
  codebase: GeneratedCodeBase | null;
  /** Index of the active file in codebase.files */
  activeFileIndex: number;
  /** Index of current active revision */
  activeRevisionIndex: number;
  /** Total or max revision budget */
  maxRevisions?: number;
  /** History of all integration revisions */
  revisionHistory?: Array<{
    label?: string;
    codebase?: GeneratedCodeBase;
    isPostCompletion?: boolean;
  }>;
  /** Read-only flag (true in QUICK mode) */
  isReadOnly?: boolean;
  /** Diff mode active flag */
  isDiffMode?: boolean;
  /** Callback when user selects a file from the list */
  onSelectFile: (index: number) => void;
  /** Callback when user switches revision tabs */
  onSelectRevision: (index: number) => void;
  /** Callback when user toggles diff mode */
  onToggleDiff?: () => void;
  /** Callback when user edits file content in COMPLEX mode */
  onFileContentChange?: (fileName: string, newCode: string) => void;
  /** Callback when editor is focused or edited (to pause countdowns) */
  onFocus?: () => void;
  /** Additional custom class names */
  className?: string;
}

export function resolveLanguage(fileName: string): string {
  if (!fileName) return 'plaintext';
  const clean = fileName.trim().toLowerCase();
  if (clean.endsWith('.go') || clean === 'go.mod') return 'go';
  if (clean.endsWith('.rs') || clean === 'cargo.toml') return 'rust';
  return detectLanguage(fileName);
}

export function IntegrationMonacoView({
  codebase,
  activeFileIndex = 0,
  activeRevisionIndex = 0,
  maxRevisions,
  revisionHistory = [],
  isReadOnly = false,
  isDiffMode = false,
  onSelectFile,
  onSelectRevision,
  onToggleDiff,
  onFileContentChange,
  onFocus,
  className = '',
}: IntegrationMonacoViewProps) {
  const editorRef = useRef<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const files = codebase?.files || [];
  const activeFile: CodeFile | null = files[activeFileIndex] || files[0] || null;

  // Title string reflecting revision state
  const titleText =
    activeRevisionIndex > 0
      ? `Unified Integrated Codebase (Revision ${activeRevisionIndex}${
          maxRevisions ? `/${maxRevisions}` : ''
        })`
      : 'Unified Integrated Codebase';

  const language = activeFile ? resolveLanguage(activeFile.file_name) : 'plaintext';
  const modelUri = activeFile
    ? `integration://rev-${activeRevisionIndex}/${activeFile.file_name}`
    : undefined;

  // Resolve previous revision file for DiffEditor comparison
  let previousFile: CodeFile | null = null;
  if (isDiffMode && activeRevisionIndex > 0 && revisionHistory[activeRevisionIndex - 1]) {
    const prevCodebase = revisionHistory[activeRevisionIndex - 1].codebase;
    if (prevCodebase && prevCodebase.files && activeFile) {
      previousFile =
        prevCodebase.files.find(
          (f) => f.file_name.toLowerCase() === activeFile.file_name.toLowerCase()
        ) || null;
    }
  }

  const handleMount: OnMount = (editor, monaco) => {
    patchEditorInstance(editor);
    if (monaco) {
      patchMonaco(monaco);
    }
    editorRef.current = editor;
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
      id="codeOutputSection"
      className={`rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] p-6 fade-in text-slate-100 ${className}`}
      style={{ backdropFilter: 'blur(14px)' }}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <div>
            <h3
              id="codeOutputTitle"
              className="text-lg font-bold text-slate-100 flex items-center gap-2"
            >
              <span>{titleText}</span>
              {isReadOnly && (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                  Read Only
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated and unified multi-component source tree
            </p>
          </div>
        </div>
      </div>

      {/* Revision selector tabs & diff toggle */}
      {revisionHistory && revisionHistory.length > 0 && (
        <IntegrationRevTabs
          revisionHistory={revisionHistory}
          activeRevisionIndex={activeRevisionIndex}
          isDiffMode={isDiffMode}
          onSelectRevision={onSelectRevision}
          onToggleDiff={onToggleDiff}
        />
      )}

      {/* IDE Container */}
      <div
        id="ideContainer"
        className="flex flex-col md:flex-row h-[550px] border border-white/[0.07] rounded-2xl overflow-hidden bg-black/25 backdrop-blur-md"
      >
        {/* Left Pane: File Explorer */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-slate-950/[0.12] backdrop-blur-md flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-white/10 flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-white/80"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              Files
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.08]">
              {files.length}
            </span>
          </div>

          <ScrollFade className="flex-1 overflow-y-auto p-2 space-y-1">
            {files.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 font-mono text-center">
                No files available
              </div>
            ) : (
              files.map((file, idx) => {
                const isSelected = (activeFileIndex === idx) || (!files[activeFileIndex] && idx === 0);
                return (
                  <button
                    key={`file-${file.file_name}-${idx}`}
                    type="button"
                    onClick={() => onSelectFile(idx)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer truncate ${
                      isSelected
                        ? 'bg-white/15 text-white border border-white/20 font-semibold shadow-xs'
                        : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 border border-transparent'
                    }`}
                    title={file.file_name}
                  >
                    <svg
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isSelected ? 'text-white' : 'text-slate-500'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="truncate">{file.file_name}</span>
                  </button>
                );
              })
            )}
          </ScrollFade>
        </div>

        {/* Right Pane: Monaco Editor / Diff Editor / Live Preview */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#1e1e1e] flex flex-col">
          {/* File bar header with Code Editor / Live Preview toggle */}
          <div className="px-3 py-1.5 border-b border-white/10 bg-slate-950/[0.12] flex items-center justify-between text-xs">
            <div className="relative flex items-center p-0.5 rounded-full bg-slate-900 border border-slate-700/60 backdrop-blur-sm">
              <motion.button
                type="button"
                id="tabCode"
                onClick={() => setIsPreviewOpen(false)}
                whileTap={{ scale: 0.95 }}
                className={`relative px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  !isPreviewOpen
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {!isPreviewOpen && (
                  <motion.div
                    layoutId="integrationPreviewToggleGlider"
                    className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">Code Editor</span>
              </motion.button>
              <motion.button
                type="button"
                id="tabPreview"
                onClick={() => setIsPreviewOpen(true)}
                whileTap={{ scale: 0.95 }}
                className={`relative px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  isPreviewOpen
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isPreviewOpen && (
                  <motion.div
                    layoutId="integrationPreviewToggleGlider"
                    className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">Live Preview</span>
              </motion.button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="truncate max-w-[180px] text-slate-200 font-semibold">
                {activeFile?.file_name || 'No file selected'}
              </span>
              <span className="text-[11px] text-slate-500 uppercase">{language}</span>
            </div>
          </div>

          <div className="flex-1 h-full relative">
            {isPreviewOpen ? (
              <LivePreview codebase={codebase} />
            ) : !activeFile ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs p-6 text-center">
                <p>No source file selected or available.</p>
              </div>
            ) : isDiffMode ? (
              <DiffEditor
                height="100%"
                language={language}
                original={previousFile?.source_code || ''}
                modified={activeFile.source_code || ''}
                theme="vs-dark"
                beforeMount={handleBeforeMount}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  automaticLayout: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  fontFamily:
                    'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
                  lineNumbers: 'on',
                  wordWrap: 'off',
                  padding: { top: 8, bottom: 8 },
                }}
                loading={
                  <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-white/70"
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
                    <span>Loading Diff comparison...</span>
                  </div>
                }
              />
            ) : (
              <Editor
                key={modelUri || `integration-${activeRevisionIndex}-${activeFileIndex}`}
                path={modelUri}
                height="100%"
                language={language}
                value={activeFile.source_code ?? ''}
                theme="vs-dark"
                options={{
                  readOnly: isReadOnly,
                  automaticLayout: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  fontFamily:
                    'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  tabSize: 2,
                  renderWhitespace: 'selection',
                  padding: { top: 8, bottom: 8 },
                }}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                onChange={handleChange}
                loading={
                  <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-white/70"
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
        </div>
      </div>
    </div>
  );
}

export default IntegrationMonacoView;
