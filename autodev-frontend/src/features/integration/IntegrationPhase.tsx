/**
 * AutoDev Integration Phase Master Component
 * 
 * Implements Milestone 3 R5 & R6:
 * - Legacy DOM IDs:
 *   - `#integrationSection`
 *   - `#integrateBtn`
 *   - `#integrateSpinner`
 *   - `#finalDownloadBtn`
 * - In QUICK mode: automatically triggers integration synthesis or brief countdown
 * - In COMPLEX mode: initiates 30-second countdown with auto-pause on user interaction
 * - Renders IntegrationMonacoView, IntegrationCriticTabs, and final project ZIP exporter
 */
import { useEffect, useRef } from 'react';
import { ArrowUpTrayIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useIntegrationRunner } from './useIntegrationRunner';
import { IntegrationMonacoView } from './IntegrationMonacoView';
import { IntegrationCriticTabs } from './IntegrationCriticTabs';
import type { GeneratedCodeBase } from '../../types';

export interface IntegrationPhaseProps {
  /** Optional custom CSS classes */
  className?: string;
  /** Explicit all-passed flag from parent dashboard */
  allPassed?: boolean;
  /** Force rendering even if DAG queue has not finished */
  forceRender?: boolean;
  /** Omit outer container when mounted inside an element that already has id="integrationSection" */
  renderWithoutContainer?: boolean;
  /** Custom ID override */
  id?: string;
  /** Callback fired when integration starts */
  onIntegrationStart?: () => void;
  /** Callback fired when integration finishes with pass */
  onIntegrationComplete?: (codebase: GeneratedCodeBase) => void;
  /** Slot for custom download action */
  onDownloadZip?: () => void;
}

export function IntegrationPhase({
  className = '',
  allPassed: propAllPassed,
  forceRender = false,
  renderWithoutContainer = false,
  id = 'integrationSection',
  onIntegrationStart,
  onIntegrationComplete,
  onDownloadZip,
}: IntegrationPhaseProps) {
  const store = useAppStore();
  const session = useSessionStore();

  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const runner = useIntegrationRunner();
  const hasAutoTriggeredRef = useRef(false);

  // Check if all components in DAG have reached terminal status
  const pipelineQueue = isSSR
    ? (liveStore?.pipelineQueue ?? store.pipelineQueue ?? [])
    : (store.pipelineQueue ?? []);
  const componentStates = isSSR
    ? (liveStore?.componentStates ?? store.componentStates ?? {})
    : (store.componentStates ?? {});

  const passedCount = pipelineQueue.filter((c) => {
    const st = componentStates[c.component_id]?.status;
    return st === 'passed' || st === 'COMPLETED';
  }).length;
  const totalCount = pipelineQueue.length;
  const computedAllPassed = totalCount > 0 && passedCount === totalCount;
  const allPassed = propAllPassed !== undefined ? propAllPassed : computedAllPassed;

  const shouldRender = forceRender || allPassed || Boolean(runner.integratedCodebase);

  // Reset auto-trigger guard when pipeline is not running or components reset
  useEffect(() => {
    if (!allPassed || store.pipelineStatus !== 'running') {
      hasAutoTriggeredRef.current = false;
    }
  }, [allPassed, store.pipelineStatus]);

  // Auto-trigger in QUICK mode, 30s countdown in COMPLEX mode
  useEffect(() => {
    if (!allPassed || hasAutoTriggeredRef.current || runner.integratedCodebase) {
      return;
    }

    hasAutoTriggeredRef.current = true;
    const timer = setTimeout(() => {
      onIntegrationStart?.();
      runner.runIntegration();
    }, 500);
    return () => clearTimeout(timer);
  }, [allPassed, runner.integratedCodebase]);

  // Handle completion callback
  useEffect(() => {
    if (runner.isPassed && runner.integratedCodebase) {
      onIntegrationComplete?.(runner.integratedCodebase);
    }
  }, [runner.isPassed, runner.integratedCodebase]);

  const handleIntegrateClick = () => {
    session.cancelCountdown();
    onIntegrationStart?.();
    runner.runIntegration();
  };

  const handleDownloadClick = async () => {
    if (onDownloadZip) {
      onDownloadZip();
    } else {
      await runner.downloadZip();
    }
  };

  const handleEditorFocus = () => {
    if (session.countdown.targetAction === 'integration') {
      session.pauseCountdown('User interacting with integrated code');
    }
  };

  // Window bridge for legacy script blocks and recovery matrix
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).generateIntegration = () => runner.runIntegration();
    }
  }, [runner.runIntegration]);

  // Remaining countdown seconds
  const isCountdownActive =
    session.countdown.targetAction === 'integration' &&
    session.countdown.isRunning &&
    session.countdown.remainingSeconds > 0;

  const buttonText = runner.isIntegrating
    ? 'Synthesizing Unified Codebase...'
    : runner.isExecutingCode
    ? 'Running Sandbox Verification...'
    : runner.isEvaluatingCritics
    ? 'Arbitration Engine Evaluating...'
    : isCountdownActive
    ? `Integrate All Components (${session.countdown.remainingSeconds}s)`
    : runner.revisionCount > 0
    ? `Re-Integrate Components (Rev ${runner.revisionCount})`
    : 'Integrate All Components';

  const content = (
    <div className="space-y-6">
      {/* ── Top Header matching Requirements, Decomposition, and Pipeline agents ── */}
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
          Multi-component codebase unification, dependency resolution, and full-stack integration synthesis.
        </p>
      </div>

      {/* ── Integration Action Toolbar ─────────────────────────────── */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 text-emerald-400 font-semibold text-sm">
          <svg
            className="w-5 h-5 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            {allPassed
              ? 'All components passed! Ready to integrate into the final product.'
              : 'Multi-component integration pipeline ready.'}
          </span>
        </div>

        <p className="text-slate-400 text-xs max-w-lg mx-auto leading-relaxed">
          Master Architect and Integrator Agent will combine all component modules, test
          suites, and configuration files into the unified codebase.
        </p>

        <button
          id="integrateBtn"
          type="button"
          onClick={handleIntegrateClick}
          disabled={runner.isLoopActive}
          className="w-full bg-white/10 hover:bg-white/20 active:scale-[0.99] border border-white/20 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span>{buttonText}</span>
          {runner.isLoopActive && (
            <svg
              id="integrateSpinner"
              className="animate-spin h-5 w-5 text-white"
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
          )}
        </button>

        {/* Pulsing Revision Badge */}
        {runner.verdictLabel.startsWith('REVISION') && (
          <div className="flex justify-center pt-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase border bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
              {runner.verdictLabel}
            </span>
          </div>
        )}
      </div>

      {/* ── Integrated Codebase Monaco View ───────────────────────── */}
      {(() => {
        const activeCodebase =
          runner.integratedCodebase ||
          (isSSR ? liveStore?.integratedCodebase : store.integratedCodebase) ||
          null;

        return (
          <>
            {(activeCodebase || runner.revisionHistory.length > 0) && (
              <IntegrationMonacoView
                codebase={activeCodebase}
                activeFileIndex={runner.activeFileIndex}
                activeRevisionIndex={runner.activeRevisionIndex}
                maxRevisions={runner.dynamicBudget}
                revisionHistory={runner.revisionHistory}
                isReadOnly={
                  ((isSSR ? liveStore?.mode : store.mode) ?? 'QUICK') === 'QUICK' &&
                  !((isSSR ? liveStore?.isPaused : store.isPaused) ?? false)
                }
                isDiffMode={runner.isDiffMode}
                onSelectFile={runner.selectFile}
                onSelectRevision={runner.selectRevision}
                onToggleDiff={runner.toggleDiffMode}
                onFileContentChange={runner.updateFileContent}
                onFocus={handleEditorFocus}
              />
            )}

            {/* ── Critic Feedback & Adjudicator Evaluation ──────────────── */}
            {(runner.criticHistory.length > 0 || runner.currentExecutionResult) && (
              <IntegrationCriticTabs
                criticHistory={runner.criticHistory}
                activeCriticIndex={runner.activeCriticIndex}
                executionResult={runner.currentExecutionResult}
                isLoading={runner.isEvaluatingCritics}
                error={runner.error}
                onSelectCriticTab={runner.selectCriticTab}
              />
            )}

            {/* ── Phase 3.5 Documentation Status (#docGenerationSection) ── */}
            {store.inFlightPhase === 'documentation' && (
              <div id="docGenerationSection" className="pt-4 border-t border-white/[0.08]">
                <div className="p-3.5 bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] rounded-xl flex items-center gap-3 text-slate-200 text-sm">
                  <svg className="animate-spin h-4 w-4 shrink-0 text-white/80" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="font-medium">Auto-generating README.md &amp; USER_GUIDE.md documentation...</span>
                </div>
              </div>
            )}

            {/* ── Final Project Export & GitHub Buttons (#finalDownloadBtn, #uploadGithubBtn) ───────── */}
            {(runner.isPassed ||
              runner.isMaxRevisions ||
              runner.isForcedQuickMode ||
              Boolean(activeCodebase)) && (
              <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="finalDownloadBtn"
                  type="button"
                  onClick={handleDownloadClick}
                  disabled={store.inFlightPhase === 'documentation'}
                  className={`w-full flex-1 font-bold py-3.5 px-4 rounded-xl flex justify-center items-center gap-2 shadow-md transition-all duration-200 border ${
                    store.inFlightPhase === 'documentation'
                       ? 'bg-white/5 border-white/10 text-slate-400 cursor-not-allowed'
                       : 'bg-white/10 hover:bg-white/20 border-white/20 text-white cursor-pointer'
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>
                    {store.inFlightPhase === 'documentation'
                      ? 'Generating Documentation (README.md & USER_GUIDE.md)...'
                      : 'Download Project Archive (.zip)'}
                  </span>
                </button>
                <button
                  id="uploadGithubBtn"
                  type="button"
                  onClick={() => store.setGitHubModalOpen(true)}
                  disabled={store.inFlightPhase === 'documentation'}
                  className={`w-full sm:w-auto font-bold py-3.5 px-5 rounded-xl flex justify-center items-center gap-2 shadow-md transition-all duration-200 shrink-0 border ${
                    store.inFlightPhase === 'documentation'
                      ? 'bg-white/5 border-white/10 text-slate-400 cursor-not-allowed'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.08] text-slate-200 hover:text-white cursor-pointer'
                  }`}
                >
                  <ArrowUpTrayIcon className="w-5 h-5 text-white shrink-0" />
                  <span>Upload to GitHub</span>
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );

  if (renderWithoutContainer) {
    return content;
  }

  return (
    <div
      id={id}
      className={`border-t border-slate-700/80 pt-6 mt-6 transition-all duration-300 ${
        shouldRender ? 'block' : 'hidden'
      } ${className}`}
    >
      {content}
    </div>
  );
}

export default IntegrationPhase;
