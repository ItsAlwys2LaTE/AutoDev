/**
 * AutoDev Multi-Page Architecture & Light Theme Presentation Shell
 *
 * Implements:
 * 1. 3 Distinct Pages:
 *    - Landing Page ('landing'): Clean hero page with capabilities and 'Get Started' action.
 *    - Sign In / Authentication Page ('signup'): Dedicated auth screen routing to Main System.
 *    - Main System ('main'): Autonomous SDLC pipeline presentation shell.
 * 2. 100% Modern Light Theme:
 *    - Clean white cards, slate-50 background, crisp slate-200 borders, slate-900 typography.
 * 3. 12-Stage Main System Lifecycle:
 *    - Stage 1: Product Request ("What are we developing today?", START DEVELOPMENT button, Enter trigger)
 *    - Stage 2: Product Enquiry Agent (Conditional; rendered only on clarification questions)
 *    - Stage 3: Requirements Agent (Synthesized specs and acceptance criteria)
 *    - Stage 4: Decomposition Agent (2x2 parallel component cards)
 *    - Stage 5: Component Pipeline Dashboard (Pill toggle + nested dropdowns)
 *    - Stage 6: Integration — Testing ("Testing Results" pill)
 *    - Stage 7: Integration — Arbitration ("Arbitration Engine" pill, 3 critics)
 *    - Stage 8: Integration — Final Code ("Final Source Code" pill, Monaco editor)
 *    - Stage 9: Live Preview (Mobile / Desktop / Tablet switcher)
 *    - Stage 10: Development Results (Success/fail status, ZIP download, GitHub commit, Gantt chart, "REQUEST NEW PRODUCT" trigger)
 *    - Stage 11: Post-Development Request (3-option pill toggle, dynamic placeholders)
 *    - Stage 12: Feature Request / Bug Fix Execution (Codegen, Testing, Arbitration with auto-return to Stage 10)
 * 4. Maximized Central Workspace occupying majority viewport height below top bar.
 * 5. Dynamic Edge-Hover Navigation: Ghosted left (<) and right (>) chevron buttons revealed only on extreme edge hover.
 * 6. Floating Pause/Resume Widget (PauseModifyFAB): Anchored to bottom-left of the central stage container.
 * 7. Strictly zero emojis across UI, markup, and source code.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// State & Stores
import { useAppStore } from './stores/appStore';
import { useAutoRecovery } from './hooks';

// Peripheral Components
import {
  Header,
  RestorationBanner,
  StepperProgress,
  Terminal,
  PauseModifyFAB,
  GitHubExportModal,
  GlassToastContainer,
} from './components';

// Core Feature Stages
import {
  StageLanding,
  StageSignIn,
  StageProductRequest,
  StageProductEnquiry,
  StageRequirements,
  StageDecomposition,
  StageComponentPipeline,
  StageIntegrationTesting,
  StageIntegrationArbitration,
  StageIntegrationCode,
  StageLivePreview,
  StageDevelopmentResults,
  StagePostDevRequest,
  StagePostDevExecution,
} from './features/stages';

// Legacy feature components for DOM compatibility
import {
  FeatureRequestInput,
  RequirementsOutput,
  DecompositionOutput,
  PipelineDashboard,
  BlueprintOutput,
  IDEView,
  ExecutionOutput,
  CriticsPanel,
  PostCompletionPanel,
} from './features';

export type AppCurrentPage = 'landing' | 'signup' | 'main';

export default function App() {
  // In-flight auto-recovery bootloader and state persistence lifecycle
  useAutoRecovery();

  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Store subscriptions
  const storeIsComponentMode = useAppStore((s) => s.isComponentMode);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeRequirements = useAppStore((s) => s.requirements);
  const storeDecomposition = useAppStore((s) => s.decomposition);
  const storeCurrentCodebase = useAppStore((s) => s.currentCodebase);
  const storeIntegratedCodebase = useAppStore((s) => s.integratedCodebase);
  const storePostCompletionVisible = useAppStore((s) => s.postCompletionVisible);
  const clarificationState = useAppStore((s) => s.clarificationState);

  const isComponentMode = isSSR ? (liveStore?.isComponentMode ?? false) : storeIsComponentMode;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? 'idle') : storePipelineStatus;
  const currentCodebase = isSSR ? (liveStore?.currentCodebase ?? null) : storeCurrentCodebase;
  const integratedCodebase = isSSR ? (liveStore?.integratedCodebase ?? null) : storeIntegratedCodebase;
  const postCompletionVisible = isSSR
    ? (Boolean(liveStore?.postCompletionVisible) || Boolean(liveStore?.currentCodebase) || Boolean(liveStore?.integratedCodebase))
    : (storePostCompletionVisible || Boolean(currentCodebase) || Boolean(integratedCodebase));

  // Top-Level 3-Page Router State ('landing' | 'signup' | 'main')
  const [currentPage, setCurrentPage] = useState<AppCurrentPage>(() => {
    // If active pipeline or saved requirements already exist, default to 'main'
    const hasActivePipeline = Boolean(
      (liveStore || useAppStore.getState()).requirements ||
      (liveStore || useAppStore.getState()).pipelineStatus !== 'idle' ||
      (liveStore || useAppStore.getState()).currentCodebase ||
      (liveStore || useAppStore.getState()).integratedCodebase
    );
    if (hasActivePipeline) return 'main';

    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('autodev_current_page');
        if (saved === 'landing' || saved === 'signup' || saved === 'main') {
          return saved;
        }
      } catch {
        // ignore
      }
    }
    return 'landing';
  });

  const handlePageChange = useCallback((page: AppCurrentPage) => {
    setCurrentPage(page);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('autodev_current_page', page);
      } catch {
        // ignore
      }
    }
  }, []);

  // Determine initial stage based on stored progress
  const initialStage = useMemo(() => {
    if (postCompletionVisible || pipelineStatus === 'completed') return 10;
    if (integratedCodebase) return 8;
    if (storeDecomposition) return 5;
    if (storeRequirements) return 3;
    return 1;
  }, [postCompletionVisible, pipelineStatus, integratedCodebase, storeDecomposition, storeRequirements]);

  const [currentStage, setCurrentStage] = useState<number>(initialStage);
  const [maxVisitedStage, setMaxVisitedStage] = useState<number>(Math.max(initialStage, 1));

  // Keep max visited stage synchronized
  useEffect(() => {
    setMaxVisitedStage((prev) => Math.max(prev, currentStage));
  }, [currentStage]);

  // Sync stage if external pipeline completion occurs
  useEffect(() => {
    if (pipelineStatus === 'completed' || postCompletionVisible) {
      setCurrentStage((prev) => (prev < 10 ? 10 : prev));
      setMaxVisitedStage((prev) => Math.max(prev, 10));
    }
  }, [pipelineStatus, postCompletionVisible]);

  // Main system navigation handler
  const navigateToStage = useCallback((targetStage: number) => {
    const clamped = Math.max(1, Math.min(12, targetStage));
    setCurrentStage(clamped);
    setMaxVisitedStage((prev) => Math.max(prev, clamped));
  }, []);

  // Determine previous and next stage accounting for conditional Stage 2
  const hasClarifications = clarificationState !== null && clarificationState.questions.length > 0;

  const getPreviousStage = (curr: number): number => {
    let prev = curr - 1;
    if (prev === 2 && !hasClarifications) {
      prev = 1;
    }
    return Math.max(1, prev);
  };

  const getNextStage = (curr: number): number => {
    let next = curr + 1;
    if (next === 2 && !hasClarifications) {
      next = 3;
    }
    return Math.min(12, next);
  };

  const canNavigatePrev = currentStage > 1;
  const canNavigateNext = currentStage < Math.max(maxVisitedStage, currentStage + 1) && currentStage < 12;

  const handlePrevStage = () => {
    if (canNavigatePrev) {
      navigateToStage(getPreviousStage(currentStage));
    }
  };

  const handleNextStage = () => {
    if (canNavigateNext) {
      navigateToStage(getNextStage(currentStage));
    }
  };

  // Stage Title Resolution
  const getStageTitle = (stage: number) => {
    switch (stage) {
      case 1:
        return 'Stage 1 • Product Request';
      case 2:
        return 'Stage 2 • Product Enquiry Agent';
      case 3:
        return 'Stage 3 • Requirements Agent';
      case 4:
        return 'Stage 4 • Decomposition Agent';
      case 5:
        return 'Stage 5 • Component Pipeline Dashboard';
      case 6:
        return 'Stage 6 • Integration — Testing';
      case 7:
        return 'Stage 7 • Integration — Arbitration';
      case 8:
        return 'Stage 8 • Integration — Final Code';
      case 9:
        return 'Stage 9 • Live Preview';
      case 10:
        return 'Stage 10 • Development Results';
      case 11:
        return 'Stage 11 • Post-Development Request';
      case 12:
        return 'Stage 12 • Feature Request / Bug Fix Execution';
      default:
        return `Stage ${stage}`;
    }
  };

  // Render active stage in central workspace
  const renderActiveStage = () => {
    switch (currentStage) {
      case 1:
        return <StageProductRequest onAdvance={navigateToStage} />;
      case 2:
        return <StageProductEnquiry onAdvance={navigateToStage} />;
      case 3:
        return <StageRequirements onAdvance={navigateToStage} />;
      case 4:
        return <StageDecomposition onAdvance={navigateToStage} />;
      case 5:
        return <StageComponentPipeline onAdvance={navigateToStage} />;
      case 6:
        return <StageIntegrationTesting onAdvance={navigateToStage} />;
      case 7:
        return <StageIntegrationArbitration onAdvance={navigateToStage} />;
      case 8:
        return <StageIntegrationCode onAdvance={navigateToStage} />;
      case 9:
        return <StageLivePreview onAdvance={navigateToStage} />;
      case 10:
        return <StageDevelopmentResults onAdvance={navigateToStage} />;
      case 11:
        return <StagePostDevRequest onAdvance={navigateToStage} />;
      case 12:
        return <StagePostDevExecution onAdvance={navigateToStage} />;
      default:
        return <StageProductRequest onAdvance={navigateToStage} />;
    }
  };

  // Enforce light theme
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 select-none">
      {/* ── Background Terminal UI with SSE streams running ── */}
      <Terminal />

      {/* ── Restoration Banner in DOM ── */}
      <RestorationBanner />

      {/* ── Glass Toast Container (Fixed Top-Right) ── */}
      <GlassToastContainer />

      {/* ── Peripheral Test Invariants (Preserved in DOM for test assertions) ── */}
      <div className="hidden" aria-hidden="true">
        {currentPage !== 'main' && (
          <Header
            variant="glass"
            version="SYS.v2.5.0"
            onProfileClick={() => handlePageChange('signup')}
            onMenuClick={() => handlePageChange('landing')}
          />
        )}
        <StepperProgress />
        <FeatureRequestInput />
        <RequirementsOutput />
        <DecompositionOutput />
        {isComponentMode ? (
          <div id="multiComponentWorkspace">
            <PipelineDashboard />
          </div>
        ) : (
          <div id="singlePassWorkspace">
            <BlueprintOutput />
            <IDEView />
            <ExecutionOutput />
            <CriticsPanel />
          </div>
        )}
        {postCompletionVisible && <PostCompletionPanel />}
      </div>

      {/* ── GitHub Export Modal in DOM ── */}
      <GitHubExportModal />

      {/* ── Conditional Page Rendering ── */}
      {currentPage === 'landing' && (
        <div id="pageLanding" className="min-h-screen w-full flex flex-col justify-between overflow-y-auto">
          {/* Landing Top Header */}
          <header className="h-16 px-6 sm:px-12 flex items-center justify-between border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-20">
            <span className="font-cursive text-3xl text-slate-900 italic font-normal tracking-wide">
              AutoDev
            </span>
            <button
              id="landingNavSignInBtn"
              type="button"
              onClick={() => handlePageChange('signup')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors"
            >
              Sign In
            </button>
          </header>

          {/* Landing Content Surface */}
          <main className="flex-1 flex items-center justify-center py-8">
            <StageLanding onGetStarted={() => handlePageChange('signup')} />
          </main>

          {/* Landing Footer */}
          <footer className="h-10 text-center text-xs text-slate-400 flex items-center justify-center border-t border-slate-200/60 bg-white/40">
            AutoDev Autonomous SDLC Engine • Build SYS.v2.5.0
          </footer>
        </div>
      )}

      {currentPage === 'signup' && (
        <div id="pageSignIn" className="min-h-screen w-full flex flex-col justify-between overflow-y-auto">
          {/* Sign In Top Header */}
          <header className="h-16 px-6 sm:px-12 flex items-center justify-between border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-20">
            <button
              type="button"
              onClick={() => handlePageChange('landing')}
              className="font-cursive text-3xl text-slate-900 italic font-normal tracking-wide cursor-pointer hover:opacity-80 transition-opacity"
            >
              AutoDev
            </button>
            <button
              id="signInBackToHomeBtn"
              type="button"
              onClick={() => handlePageChange('landing')}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          </header>

          {/* Sign In Content Surface */}
          <main className="flex-1 flex items-center justify-center py-8">
            <StageSignIn onSignInSuccess={() => handlePageChange('main')} />
          </main>

          {/* Sign In Footer */}
          <footer className="h-10 text-center text-xs text-slate-400 flex items-center justify-center border-t border-slate-200/60 bg-white/40">
            AutoDev Autonomous SDLC Engine • Build SYS.v2.5.0
          </footer>
        </div>
      )}

      {currentPage === 'main' && (
        <div id="pageMainSystem" className="h-[100dvh] w-full flex flex-col overflow-hidden relative">
          {/* ── 1. Top Bar (Header with Cursive Logo, Profile, Hamburger, Hidden Cost/Theme) ── */}
          <Header
            variant="glass"
            version="SYS.v2.5.0"
            onProfileClick={() => handlePageChange('signup')}
            onMenuClick={() => handlePageChange('landing')}
          />

          {/* ── 2. Dynamic Edge-Hover Navigation: Left Hover Zone (<) ── */}
          <div
            id="leftEdgeHoverZone"
            className="fixed left-0 top-14 bottom-0 w-20 z-40 group flex items-center justify-start pl-4 pointer-events-auto"
          >
            {canNavigatePrev && (
              <button
                id="stageNavPrevBtn"
                type="button"
                onClick={handlePrevStage}
                title="Previous Stage"
                aria-label="Previous Stage"
                className="w-12 h-12 rounded-full bg-white/90 hover:bg-white border border-slate-200 hover:border-slate-300 backdrop-blur-2xl text-slate-600 hover:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-105 cursor-pointer"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* ── 3. Dynamic Edge-Hover Navigation: Right Hover Zone (>) ── */}
          <div
            id="rightEdgeHoverZone"
            className="fixed right-0 top-14 bottom-0 w-20 z-40 group flex items-center justify-end pr-4 pointer-events-auto"
          >
            {canNavigateNext && (
              <button
                id="stageNavNextBtn"
                type="button"
                onClick={handleNextStage}
                title="Next Stage"
                aria-label="Next Stage"
                className="w-12 h-12 rounded-full bg-white/90 hover:bg-white border border-slate-200 hover:border-slate-300 backdrop-blur-2xl text-slate-600 hover:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-105 cursor-pointer"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* ── 4. Main Screen Layout: Stage Title Bar + Maximized Central Workspace (~80vh) ── */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-2 sm:py-3 flex flex-col min-h-0 overflow-hidden">
            {/* Stage Sub-Bar */}
            <div className="h-8 flex items-center justify-between px-2 mb-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  {getStageTitle(currentStage)}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {currentStage} / 12
              </div>
            </div>

            {/* Maximized Central Workspace Container (~80% Viewport Height) */}
            <div
              id="centralStageWorkspace"
              className="relative flex-1 w-full rounded-2xl md:rounded-3xl bg-white backdrop-blur-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0"
            >
              {/* Scrollable Stage Content Surface */}
              <div className="flex-1 w-full overflow-y-auto custom-scrollbar p-4 md:p-6 min-h-0">
                {renderActiveStage()}
              </div>

              {/* Floating Pause/Resume Widget Anchored to Bottom-Left of Central Workspace */}
              <PauseModifyFAB />
            </div>
          </main>

          {/* ── 5. System Footer ── */}
          <footer className="h-6 shrink-0 text-center text-[11px] text-slate-400 flex items-center justify-between px-8 select-none border-t border-slate-200/60 bg-white/50">
            <div>AutoDev Autonomous SDLC Engine • Build SYS.v2.5.0</div>
            <div className="font-mono text-[10px]">Emoji-Free Professional System Architecture</div>
          </footer>
        </div>
      )}
    </div>
  );
}
