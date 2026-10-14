/**
 * AutoDev Component Track File Explorer
 *
 * Implements Milestone 2 R2:
 * - Per-track file list sidebar matching #file-list-${cId}
 * - Active file highlighting
 * - File count badge
 * - Interactive file selection
 */

import {
  DocumentTextIcon,
  CodeBracketIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import type { CodeFile } from '../../types';
import { ModernScrollbar } from '../../components/ModernScrollbar';

export interface ComponentFileExplorerProps {
  componentId: string;
  files: CodeFile[];
  activeFileIndex: number;
  onSelectFile: (index: number) => void;
  className?: string;
  isLoading?: boolean;
}

function getFileIcon(fileName: string) {
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith('.py') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.html') ||
    lower.endsWith('.css')
  ) {
    return <CodeBracketIcon className="w-4 h-4 text-slate-300 shrink-0" />;
  }
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return <DocumentTextIcon className="w-4 h-4 text-slate-300 shrink-0" />;
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return <DocumentTextIcon className="w-4 h-4 text-slate-300 shrink-0" />;
  }
  return <DocumentIcon className="w-4 h-4 text-slate-400 shrink-0" />;
}

export function ComponentFileExplorer({
  componentId,
  files = [],
  activeFileIndex = 0,
  onSelectFile,
  className = '',
  isLoading = false,
}: ComponentFileExplorerProps) {
  return (
    <div
      id={`file-list-${componentId}`}
      className={`w-full md:w-1/3 bg-slate-950/[0.15] backdrop-blur-md border-b md:border-b-0 md:border-r border-white/[0.07] flex flex-col overflow-hidden select-none ${className}`}
    >
      {/* Explorer Header */}
      <div className="p-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-white/[0.07] bg-slate-950/[0.2] flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <span>Files</span>
        </span>
        <span
          id={`file-count-${componentId}`}
          className="text-[11px] font-mono text-slate-300 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded"
        >
          {`${files.length} ${files.length === 1 ? 'file' : 'files'}`}
        </span>
      </div>

      {/* File List with ModernScrollbar */}
      <ModernScrollbar
        className="flex-1 min-h-0"
        viewportClassName="py-1 divide-y divide-white/[0.04]"
        role="tree"
        aria-label={`Files for component ${componentId}`}
      >
        {isLoading ? (
          <div className="p-4 text-xs text-slate-400 font-mono italic text-center animate-pulse">
            Synthesizing codebase...
          </div>
        ) : files.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 italic text-center">
            No source files generated yet.
          </div>
        ) : (
          files.map((file, index) => {
            const isActive = index === activeFileIndex;
            return (
              <button
                key={`${file.file_name}-${index}`}
                id={`file-item-${componentId}-${index}`}
                type="button"
                onClick={() => onSelectFile(index)}
                className={`file-item w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center gap-2 truncate transition-colors duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white font-medium border-l-2 border-white shadow-inner'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
                title={file.file_name}
                aria-selected={isActive}
                role="treeitem"
              >
                {getFileIcon(file.file_name)}
                <span className="truncate font-mono text-xs">{file.file_name}</span>
              </button>
            );
          })
        )}
      </ModernScrollbar>
    </div>
  );
}
