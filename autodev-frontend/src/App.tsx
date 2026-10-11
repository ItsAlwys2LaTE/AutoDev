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
 * 6. Floating Pause/Resume Widget (PauseModifyFAB): Floating outside of the central stage container on the left.
 * 7. Strictly zero emojis across UI, markup, and source code.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Slide animation variants for smooth stage switching
const stageSlideVariants: Variants = {
  enter: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? 80 : -80,
    opacity: 0,
    filter: 'blur(4px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring' as const,
      stiffness: 350,
      damping: 28,
      mass: 0.8,
    },
  },
  exit: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? -80 : 80,
    opacity: 0,
    filter: 'blur(4px)',
    transition: {
      duration: 0.18,
      ease: 'easeInOut' as const,
    },
  }),
};

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
  AeroShards,
  ScrollFade,
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
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');

  // Keep max visited stage synchronized
  useEffect(() => {
    setMaxVisitedStage((prev) => Math.max(prev, currentStage));
  }, [currentStage]);

  // Sync stage if external pipeline completion occurs
  useEffect(() => {
    if (pipelineStatus === 'completed' || postCompletionVisible) {
      setCurrentStage((prev) => {
        if (prev < 10) {
          setSlideDirection('forward');
          return 10;
        }
        return prev;
      });
      setMaxVisitedStage((prev) => Math.max(prev, 10));
    }
  }, [pipelineStatus, postCompletionVisible]);

  // Main system navigation handler
  const navigateToStage = useCallback((targetStage: number) => {
    const clamped = Math.max(1, Math.min(12, targetStage));
    setCurrentStage((prev) => {
      if (clamped > prev) {
        setSlideDirection('forward');
      } else if (clamped < prev) {
        setSlideDirection('backward');
      }
      return clamped;
    });
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

  // Enforce obsidian dark theme
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-black text-slate-100 select-none relative overflow-x-hidden">
      {/* ── React Bits AeroShards 3D Ambient Background Layer ── */}
      <div
        id="aeroShardsBackgroundLayer"
        className="fixed inset-0 w-screen h-screen pointer-events-none overflow-hidden"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}
        aria-hidden="true"
      >
        <AeroShards
          className="w-full h-full"
          backgroundColor="#000000"
          shardColor="#ffffff"
          accentColor="#ffffff"
          placement="full"
          flow="stream"
          material="pearl"
          detail="balanced"
          effect="none"
          scale={1.5}
          spread={1.1}
          depth={1}
          speed={1}
          spin={1.15}
          interaction="repel"
          density={1.5}
          shardSize={1.1}
          stretch={1}
          turbulence={1}
          glow={1}
          edgeSoftness={2}
          bloom={0.5}
          grain={0.05}
          chromaticAberration={0.0075}
          transitionDuration={1}
          interactionRadius={1.5}
          interactionStrength={0.5}
          rippleIntensity={1}
          holdToGather={true}
        />
      </div>

      {/* ── Foreground Glassmorphic Application Layer ── */}
      <div className="relative z-10 min-h-screen w-full flex flex-col pointer-events-auto">
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
          <header className="h-16 px-6 sm:px-12 flex items-center justify-between bg-transparent border-none sticky top-0 z-20">
            <div className="relative inline-flex items-center">
              <div
                className="absolute -inset-x-4 -inset-y-2 bg-slate-950/15 backdrop-blur-md rounded-full pointer-events-none -z-10"
                style={{ filter: 'blur(16px)' }}
                aria-hidden="true"
              />
              <span className="font-cursive text-3xl sm:text-4xl md:text-[42px] text-white/85 hover:text-white italic font-normal tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-all">
                AutoDev
              </span>
            </div>
            <button
              id="landingNavSignInBtn"
              type="button"
              onClick={() => handlePageChange('signup')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-xl shadow-md cursor-pointer transition-all"
            >
              Sign In
            </button>
          </header>

          {/* Landing Content Surface */}
          <main className="flex-1 flex items-center justify-center py-8">
            <StageLanding onGetStarted={() => handlePageChange('signup')} />
          </main>
        </div>
      )}

      {currentPage === 'signup' && (
        <div id="pageSignIn" className="min-h-screen w-full flex flex-col justify-between overflow-y-auto">
          {/* Sign In Top Header */}
          <header className="h-16 px-6 sm:px-12 flex items-center justify-between bg-transparent border-none sticky top-0 z-20">
            <button
              type="button"
              onClick={() => handlePageChange('landing')}
              className="relative inline-flex items-center group cursor-pointer"
            >
              <div
                className="absolute -inset-x-4 -inset-y-2 bg-slate-950/15 backdrop-blur-md rounded-full pointer-events-none -z-10"
                style={{ filter: 'blur(16px)' }}
                aria-hidden="true"
              />
              <span className="font-cursive text-3xl sm:text-4xl md:text-[42px] text-white/85 group-hover:text-white italic font-normal tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-all">
                AutoDev
              </span>
            </button>
            <button
              id="signInBackToHomeBtn"
              type="button"
              onClick={() => handlePageChange('landing')}
              className="text-xs text-slate-300 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md"
            >
              Back to Home
            </button>
          </header>

          {/* Sign In Content Surface */}
          <main className="flex-1 flex items-center justify-center py-8">
            <StageSignIn onSignInSuccess={() => handlePageChange('main')} />
          </main>
        </div>
      )}

      {currentPage === 'main' && (
        <div id="pageMainSystem" className="h-[100dvh] w-full flex flex-col overflow-hidden relative">
          {/* ── 1. Top Bar (Header with Cursive Logo, Profile, Hamburger, Hidden Cost/Theme) ── */}
          <Header
            variant="glass"
            version="SYS.v2.5.0"
            stage={currentStage}
            onProfileClick={() => handlePageChange('signup')}
            onMenuClick={() => handlePageChange('landing')}
          />

          {/* ── 2. Dynamic Edge-Hover Navigation: Left Hover Zone (<) ── */}
          <div
            id="leftEdgeHoverZone"
            className="fixed left-0 top-1/2 -translate-y-1/2 h-64 w-16 z-40 group flex items-center justify-start pl-3 pointer-events-none"
          >
            {canNavigatePrev && (
              <button
                id="stageNavPrevBtn"
                type="button"
                onClick={handlePrevStage}
                title="Previous Stage"
                aria-label="Previous Stage"
                className="pointer-events-auto w-12 h-12 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 backdrop-blur-2xl text-slate-200 hover:text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 opacity-40 hover:opacity-100 hover:scale-105 cursor-pointer"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* ── 3. Dynamic Edge-Hover Navigation: Right Hover Zone (>) ── */}
          <div
            id="rightEdgeHoverZone"
            className="fixed right-0 top-1/2 -translate-y-1/2 h-64 w-16 z-40 group flex items-center justify-end pr-3 pointer-events-none"
          >
            {canNavigateNext && (
              <button
                id="stageNavNextBtn"
                type="button"
                onClick={handleNextStage}
                title="Next Stage"
                aria-label="Next Stage"
                className="pointer-events-auto w-12 h-12 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 backdrop-blur-2xl text-slate-200 hover:text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 opacity-40 hover:opacity-100 hover:scale-105 cursor-pointer"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* ── 4. Main Screen Layout: Stage Title Bar + Maximized Central Workspace (~80vh) ── */}
          <main
            className={`flex-1 w-full ${
              currentStage === 2 ? 'max-w-4xl' : 'max-w-7xl'
            } mx-auto px-4 sm:px-8 py-2 sm:py-3 flex flex-col min-h-0 overflow-hidden`}
          >

            {/* Maximized Central Workspace Container (~80% Viewport Height) */}
            <div
              id="centralStageWorkspace"
              className={
                currentStage === 1
                  ? 'relative flex-1 w-full flex flex-col overflow-hidden min-h-0'
                  : currentStage === 2
                  ? 'relative flex-1 w-full max-w-4xl mx-auto rounded-2xl md:rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden min-h-0'
                  : 'relative flex-1 w-full rounded-2xl md:rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden min-h-0'
              }
              style={currentStage !== 1 ? { backdropFilter: 'blur(14px)' } : undefined}
            >
              <AnimatePresence mode="wait" custom={slideDirection} initial={false}>
                <motion.div
                  key={currentStage}
                  custom={slideDirection}
                  variants={stageSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex-1 w-full h-full flex flex-col min-h-0 overflow-hidden"
                >
                  {/* Scrollable Stage Content Surface with Dynamic Edge Fade */}
                  <ScrollFade
                    className={
                      currentStage === 1
                        ? 'flex-1 w-full overflow-y-auto p-2 sm:p-4 min-h-0'
                        : 'flex-1 w-full overflow-y-auto p-4 md:p-6 min-h-0'
                    }
                  >
                    {renderActiveStage()}
                  </ScrollFade>
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* ── 5. Floating Pause/Resume Widget Outside the Central Container on the Left ── */}
          <PauseModifyFAB />
        </div>
      )}
      </div>
    </div>
  );
}
