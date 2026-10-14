/**
 * AutoDev IDE File Explorer Component
 * 
 * Sidebar component matching #fileExplorer:
 * - Displays file list from currentCodebase.files
 * - Active file highlighting (border and background color)
 * - Click-to-switch active file
 * - File type icons and metadata
 */

import {
  DocumentTextIcon,
  CodeBracketIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { ModernScrollbar } from '../../components/ModernScrollbar';
import type { CodeFile } from '../../types';

export interface FileExplorerProps {
  files: CodeFile[];
  activeFileIndex: number;
  onSelectFile: (index: number) => void;
  className?: string;
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
    return <CodeBracketIcon className="w-4 h-4 text-white/80 shrink-0" />;
  }
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return <DocumentTextIcon className="w-4 h-4 text-amber-400 shrink-0" />;
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    return <DocumentTextIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
  }
  return <DocumentIcon className="w-4 h-4 text-slate-400 shrink-0" />;
}

export function FileExplorer({
  files,
  activeFileIndex,
  onSelectFile,
  className = '',
}: FileExplorerProps) {
  return (
    <div
      className={`w-full sm:w-1/3 border-r border-white/10 flex flex-col bg-slate-950/[0.25] backdrop-blur-md ${className}`}
    >
      <div className="p-2.5 text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-white/10 bg-slate-950/[0.25] flex items-center justify-between">
        <span>Explorer</span>
        <span className="text-[11px] font-mono text-slate-300 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded">
          {`${files.length} ${files.length === 1 ? 'file' : 'files'}`}
        </span>
      </div>

      <ModernScrollbar
        id="fileExplorer"
        className="flex-1 min-h-0"
        viewportClassName="py-2 divide-y divide-white/[0.05]"
        role="tree"
        aria-label="Files in project"
      >
        {files.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 italic text-center">
            No source files generated yet.
          </div>
        ) : (
          files.map((file, index) => {
            const isActive = index === activeFileIndex;
            return (
              <button
                key={`${file.file_name}-${index}`}
                type="button"
                onClick={() => onSelectFile(index)}
                className={`file-item w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center gap-2 truncate transition-colors duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white font-medium border-l-2 border-purple-500 shadow-inner'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
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
