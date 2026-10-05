/**
 * AutoDev Integration Revision Tabs Component
 * 
 * Implements Milestone 3 R2:
 * - Legacy DOM ID `#integrationRevTabs` (`flex gap-1 mb-3 flex-wrap`)
 * - Revision selector buttons (`Initial`, `Rev 1`, `Rev 2`...)
 * - Visual styling for active vs inactive tabs, including post-completion revisions
 * - Diff mode toggle button (`#diffToggleBtn`) when revisions exist
 */

export interface IntegrationRevisionItem {
  label?: string;
  isPostCompletion?: boolean;
  codebase?: any;
}

export interface IntegrationRevTabsProps {
  /** List of recorded integration revisions */
  revisionHistory: IntegrationRevisionItem[];
  /** Currently selected revision index */
  activeRevisionIndex: number;
  /** Whether diff viewer mode is currently active */
  isDiffMode?: boolean;
  /** Callback fired when user clicks a revision tab */
  onSelectRevision: (index: number) => void;
  /** Callback fired when user toggles diff comparison */
  onToggleDiff?: () => void;
  /** Additional custom class names */
  className?: string;
}

export function IntegrationRevTabs({
  revisionHistory = [],
  activeRevisionIndex = 0,
  isDiffMode = false,
  onSelectRevision,
  onToggleDiff,
  className = '',
}: IntegrationRevTabsProps) {
  const showDiffBtn = activeRevisionIndex > 0 || revisionHistory.length > 1;

  if (!revisionHistory || revisionHistory.length === 0) {
    return (
      <div
        id="integrationRevTabs"
        className={`flex gap-1 mb-3 flex-wrap hidden ${className}`}
      />
    );
  }

  return (
    <div
      id="integrationRevTabs"
      className={`flex items-center gap-1 mb-3 flex-wrap border-b border-slate-800/80 pb-0.5 ${className}`}
    >
      <div className="flex gap-1 flex-wrap">
        {revisionHistory.map((rev, i) => {
          const isSelected = activeRevisionIndex === i;
          const isPostRun = Boolean(rev.isPostCompletion);
          const label = rev.label || (i === 0 ? 'Initial' : `Rev ${i}`);

          let stateCls = '';
          if (isSelected) {
            stateCls = isPostRun
              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500 font-bold'
              : 'bg-purple-600/20 text-purple-300 border-purple-500 font-bold';
          } else {
            stateCls = isPostRun
              ? 'bg-slate-800/50 text-emerald-400/80 border-transparent hover:bg-slate-700 hover:text-emerald-300'
              : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700';
          }

          return (
            <button
              key={`rev-tab-${i}`}
              type="button"
              className={`px-3 py-1 rounded-t-lg transition-colors border-b-2 text-xs sm:text-sm cursor-pointer ${stateCls}`}
              onClick={() => onSelectRevision(i)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {showDiffBtn && (
        <button
          id="diffToggleBtn"
          type="button"
          onClick={onToggleDiff || (() => {})}
          className="ml-auto text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Compare changes against previous revision"
        >
          <svg
            className="w-3.5 h-3.5 text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <span>{isDiffMode ? 'Exit Diff View' : 'Compare Diff'}</span>
        </button>
      )}
    </div>
  );
}

export default IntegrationRevTabs;
