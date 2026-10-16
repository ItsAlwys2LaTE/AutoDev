/**
 * AutoDev Integration Revision Tabs Component
 * 
 * Implements Milestone 3 R2:
 * - Legacy DOM ID `#integrationRevTabs` (`flex gap-1 mb-3 flex-wrap`)
 * - Revision selector buttons (`Initial`, `Rev 1`, `Rev 2`...)
 * - Visual styling for active vs inactive tabs, including post-completion revisions
 * - Diff mode toggle button (`#diffToggleBtn`) when revisions exist
 */

import { motion } from 'framer-motion';

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
      className={`flex items-center gap-1 mb-3 flex-wrap border-b border-white/10 pb-0.5 ${className}`}
    >
      <div className="relative flex items-center p-0.5 rounded-full bg-slate-100 dark:bg-slate-950/[0.25] border border-slate-200 dark:border-white/[0.08] backdrop-blur-sm gap-1">
        {revisionHistory.map((rev, i) => {
          const isSelected = activeRevisionIndex === i;
          const isPostRun = Boolean(rev.isPostCompletion);
          const label = rev.label || (i === 0 ? 'Initial' : `Rev ${i}`);

          return (
            <motion.button
              key={`rev-tab-${i}`}
              type="button"
              whileTap={{ scale: 0.95 }}
              className={`relative px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                isSelected
                  ? isPostRun
                    ? 'text-emerald-300 font-bold'
                    : 'text-slate-900 dark:text-white font-bold'
                  : isPostRun
                  ? 'text-emerald-400/80 hover:text-emerald-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              onClick={() => onSelectRevision(i)}
            >
              {isSelected && (
                <motion.div
                  layoutId="integrationRevPillActive"
                  className={`absolute inset-0 rounded-full border shadow-sm ${
                    isPostRun
                      ? 'bg-emerald-600/30 border-emerald-500/50'
                      : 'bg-white dark:bg-white/15 border-slate-300/80 dark:border-white/20'
                  }`}
                  transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </motion.button>
          );
        })}
      </div>

      {showDiffBtn && (
        <motion.button
          id="diffToggleBtn"
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onToggleDiff || (() => {})}
          className="ml-auto text-xs px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.08] flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Compare changes against previous revision"
        >
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
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <span>{isDiffMode ? 'Exit Diff View' : 'Compare Diff'}</span>
        </motion.button>
      )}
    </div>
  );
}

export default IntegrationRevTabs;
