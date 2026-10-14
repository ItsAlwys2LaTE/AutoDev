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
 * 3. 11-Stage Main System Lifecycle:
 *    - Stage 1: Product Request ("What are we developing today?", START DEVELOPMENT button, Enter trigger)
 *    - Stage 2: Product Enquiry Agent (Conditional; rendered only on clarification questions)
 *    - Stage 3: Requirements Agent (Synthesized specs and acceptance criteria)
 *    - Stage 4: Decomposition Agent (2x2 parallel component cards)
 *    - Stage 5: Component Pipeline Dashboard (Pill toggle + nested dropdowns)
 *    - Stage 6: Integration Agent (Common stage with Codegen, Testing, and Evaluation agent tabs)
 *    - Stage 7: Final Source Code (Dedicated finalized codebase inspection without revision tabs)
 *    - Stage 8: Live Preview (Mobile / Desktop / Tablet switcher)
 *    - Stage 9: Development Results (Success/fail status, ZIP download, GitHub commit, Gantt chart, "REQUEST NEW PRODUCT" trigger)
 *    - Stage 10: Post-Development Request (3-option pill toggle, dynamic placeholders)
 *    - Stage 11: Feature Request / Bug Fix Execution (Codegen, Testing, Arbitration with auto-return to Stage 9)
 * 4. Maximized Central Workspace occupying majority viewport height below top bar.
 * 5. Dynamic Edge-Hover Navigation: Ghosted left (<) and right (>) chevron buttons revealed only on extreme edge hover.
 * 6. Floating Pause/Resume Widget (PauseModifyFAB): Floating outside of the central stage container on the left.
 * 7. Strictly zero emojis across UI, markup, and source code.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, type Variants } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Non-blocking slide animation variants for smooth, instant stage container switching
const stageSlideVariants: Variants = {
  enter: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? 36 : -36,
    opacity: 0,
    scale: 0.99,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// State & Stores
import { useAppStore } from './stores/appStore';
import { persistState } from './stores';
import { useAutoRecovery } from './hooks';
import { initializeGlobalErrorNotifications } from './services';

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
  LightRays,
  ScrollFade,
  RightSidebar,
  LineSidebar,
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
  StageIntegration,
  StageFinalSourceCode,
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

import { UserProfilePage } from './features/profile/UserProfilePage';
import { useAuthStore } from './stores/authStore';

export type AppCurrentPage = 'landing' | 'signup' | 'main' | 'profile';

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
  const storePostCompletionPrompt = useAppStore((s) => s.postCompletionPrompt);
  const storeProductEnquiryResult = useAppStore((s) => s.productEnquiryResult);

  const isComponentMode = isSSR ? (liveStore?.isComponentMode ?? false) : storeIsComponentMode;
  const pipelineStatus = isSSR ? (liveStore?.pipelineStatus ?? 'idle') : storePipelineStatus;
  const currentCodebase = isSSR ? (liveStore?.currentCodebase ?? null) : storeCurrentCodebase;
  const integratedCodebase = isSSR ? (liveStore?.integratedCodebase ?? null) : storeIntegratedCodebase;
  const postCompletionVisible = isSSR
    ? (Boolean(liveStore?.postCompletionVisible) || Boolean(liveStore?.currentCodebase) || Boolean(liveStore?.integratedCodebase))
    : (storePostCompletionVisible || Boolean(currentCodebase) || Boolean(integratedCodebase));
  const postCompletionPrompt = isSSR
    ? (liveStore?.postCompletionPrompt ?? '')
    : storePostCompletionPrompt;
  const hasPostDevRequest = Boolean(postCompletionPrompt && postCompletionPrompt.trim().length > 0);
  const maxAllowedStage = hasPostDevRequest ? 11 : 10;

  // User profile auth state & persistent session restoration
  const authUser = useAuthStore((s) => s.user);

  useEffect(() => {
    useAuthStore.getState().loadPersistedAuth();
  }, []);

  // Collapsible Right Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Top-Level Page Router State ('landing' | 'signup' | 'main' | 'profile')
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
        if (saved === 'landing' || saved === 'signup' || saved === 'main' || saved === 'profile') {
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

  // Initialize global unhandled error and rejection notification listener
  useEffect(() => {
    const unregister = initializeGlobalErrorNotifications();
    return () => unregister();
  }, []);
  const storeCurrentStage = useAppStore((s) => s.currentStage);
  const storeMaxUnlockedStage = useAppStore((s) => s.maxUnlockedStage);
  const storeMinNavigableStage = useAppStore((s) => s.minNavigableStage);
  const setCurrentStageInStore = useAppStore((s) => s.setCurrentStage);
  const setMaxUnlockedStageInStore = useAppStore((s) => s.setMaxUnlockedStage);
  const setMinNavigableStageInStore = useAppStore((s) => s.setMinNavigableStage);
  const storeFeatureRequest = useAppStore((s) => s.featureRequest);
  const storePipelineQueue = useAppStore((s) => s.pipelineQueue);
  const storeComponentStates = useAppStore((s) => s.componentStates);

  const currentStage = isSSR ? (liveStore?.currentStage ?? 1) : storeCurrentStage;
  const maxUnlockedStage = isSSR ? (liveStore?.maxUnlockedStage ?? 1) : storeMaxUnlockedStage;
  const minNavigableStage = isSSR ? (liveStore?.minNavigableStage ?? 1) : storeMinNavigableStage;
  const currentStageRef = useRef<number>(currentStage);
  currentStageRef.current = currentStage;

  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');

  // Main system navigation handler
  const navigateToStage = useCallback((targetStage: number) => {
    // If requesting new product / stage 1, reset navigation bounds
    if (targetStage === 1) {
      setMinNavigableStageInStore(1);
      setMaxUnlockedStageInStore(1);
      currentStageRef.current = 1;
      setSlideDirection('backward');
      setCurrentStageInStore(1);
      persistState(true);
      return;
    }

    // Moving to stage 2 or beyond permanently locks Stage 1
    setMinNavigableStageInStore(2);

    const livePrompt = useAppStore.getState().postCompletionPrompt;
    const allowStage11 = Boolean(livePrompt && livePrompt.trim().length > 0) || hasPostDevRequest;
    const maxBoundary = allowStage11 ? 11 : 10;
    const clamped = Math.max(1, Math.min(maxBoundary, targetStage));
    const prevStage = currentStageRef.current;

    // Instantly cancel any active auto-advance stage timer on previous stage
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('autodev:cancel-stage-timer', {
          detail: { fromStage: prevStage, toStage: clamped },
        })
      );
    }

    if (clamped > prevStage) {
      setSlideDirection('forward');
    } else if (clamped < prevStage) {
      setSlideDirection('backward');
    }

    currentStageRef.current = clamped;
    setCurrentStageInStore(clamped);
    persistState(true);
  }, [hasPostDevRequest, setCurrentStageInStore, setMaxUnlockedStageInStore, setMinNavigableStageInStore]);

  // Reactive stage unlocking: as soon as a stage completes execution, unlock next stage immediately
  useEffect(() => {
    let unlocked = 1;
    if (storeProductEnquiryResult || storeFeatureRequest) unlocked = Math.max(unlocked, 2);
    if (storeRequirements) unlocked = Math.max(unlocked, 4);
    if (storeDecomposition) unlocked = Math.max(unlocked, 5);
    const queue = storePipelineQueue || [];
    const states = storeComponentStates || {};
    const passedCount = queue.filter((c) => {
      const st = states[c.component_id]?.status;
      return st === 'passed' || st === 'COMPLETED';
    }).length;
    if (queue.length > 0 && passedCount === queue.length) unlocked = Math.max(unlocked, 6);
    if (integratedCodebase) unlocked = Math.max(unlocked, 7);
    if (currentCodebase || integratedCodebase) unlocked = Math.max(unlocked, 8);
    if (postCompletionVisible || pipelineStatus === 'completed') unlocked = Math.max(unlocked, 9);
    if (hasPostDevRequest) unlocked = Math.max(unlocked, 11);

    if (unlocked > maxUnlockedStage) {
      setMaxUnlockedStageInStore(unlocked);
      persistState(true);
    }
  }, [
    storeFeatureRequest,
    storeProductEnquiryResult,
    storeRequirements,
    storeDecomposition,
    storePipelineQueue,
    storeComponentStates,
    integratedCodebase,
    currentCodebase,
    postCompletionVisible,
    pipelineStatus,
    hasPostDevRequest,
    maxUnlockedStage,
    setMaxUnlockedStageInStore,
  ]);

  // When all store outputs are cleared (full reset / request new product), return cleanly to Stage 1
  useEffect(() => {
    if (
      pipelineStatus === 'idle' &&
      !storeRequirements &&
      !storeDecomposition &&
      !integratedCodebase &&
      !currentCodebase &&
      !storeProductEnquiryResult &&
      !storeFeatureRequest &&
      currentStageRef.current > 1
    ) {
      navigateToStage(1);
    }
  }, [
    pipelineStatus,
    storeRequirements,
    storeDecomposition,
    integratedCodebase,
    currentCodebase,
    storeProductEnquiryResult,
    storeFeatureRequest,
    navigateToStage,
  ]);

  // Determine stage bounds:
  // - Stage 1 has NO backward navigation and NO forward arrow navigation.
  // - Stages 2+ can navigate backwards down to minNavigableStage (2).
  // - Forward navigation is allowed only if target stage <= maxUnlockedStage and < maxAllowedStage.
  const canNavigatePrev = currentStage > minNavigableStage && currentStage > 1;
  const canNavigateNext =
    currentStage > 1 &&
    currentStage < maxUnlockedStage &&
    currentStage < maxAllowedStage;

  const getPreviousStage = (curr: number): number => {
    return Math.max(minNavigableStage, curr - 1);
  };

  const getNextStage = (curr: number): number => {
    return Math.min(maxUnlockedStage, Math.min(maxAllowedStage, curr + 1));
  };

  const handlePrevStage = useCallback(() => {
    if (canNavigatePrev) {
      navigateToStage(getPreviousStage(currentStage));
    }
  }, [canNavigatePrev, currentStage, minNavigableStage, navigateToStage]);

  const handleNextStage = useCallback(() => {
    if (canNavigateNext) {
      navigateToStage(getNextStage(currentStage));
    }
  }, [canNavigateNext, currentStage, maxUnlockedStage, maxAllowedStage, navigateToStage]);

  // Smoothly scrolls the active stage workspace container up or down
  const scrollActiveStageContainer = useCallback((direction: 'up' | 'down') => {
    const scrollAmount = direction === 'down' ? 120 : -120;
    let workspace = document.getElementById('centralStageWorkspace');
    if (!workspace) {
      workspace =
        document.getElementById('pageLanding') ||
        document.getElementById('pageSignIn') ||
        document.getElementById('pageUserProfile');
    }

    if (!workspace) {
      if (typeof window !== 'undefined' && typeof window.scrollBy === 'function') {
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      }
      return;
    }

    // 1. Check if user is hovering over any scrollable element inside workspace
    let scrollTarget: HTMLElement | null = null;
    try {
      const hovered = Array.from(workspace.querySelectorAll<HTMLElement>(':hover'));
      for (let i = hovered.length - 1; i >= 0; i--) {
        const el = hovered[i];
        if (el.scrollHeight > el.clientHeight + 4) {
          const style = window.getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            scrollTarget = el;
            break;
          }
        }
      }
    } catch {
      // In SSR or environments without :hover selector support, ignore
    }

    // 2. If not hovering a specific scrollable inner element, find the main scrollable container
    if (!scrollTarget) {
      const candidates = Array.from(
        workspace.querySelectorAll<HTMLElement>(
          '[data-scroll-container], [class*="overflow-y-auto"], [class*="overflow-auto"], div'
        )
      );
      for (const el of candidates) {
        if (el.scrollHeight > el.clientHeight + 4) {
          const style = window.getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            scrollTarget = el;
            break;
          }
        }
      }
    }

    // 3. Fallback to first child or the workspace element itself
    if (!scrollTarget) {
      scrollTarget = (workspace.firstElementChild as HTMLElement) || workspace;
    }

    // Smooth scroll execution
    if (typeof scrollTarget.scrollBy === 'function') {
      scrollTarget.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    } else {
      scrollTarget.scrollTop += scrollAmount;
    }
  }, []);

  // Keyboard navigation listener (ArrowLeft / ArrowRight to change stages, ArrowUp / ArrowDown to scroll)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside text inputs, textareas, or contentEditable elements
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          (activeEl as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      if (e.key === 'ArrowLeft') {
        if (canNavigatePrev) {
          e.preventDefault();
          handlePrevStage();
        }
      } else if (e.key === 'ArrowRight') {
        if (canNavigateNext) {
          e.preventDefault();
          handleNextStage();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollActiveStageContainer('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollActiveStageContainer('down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigatePrev, canNavigateNext, handlePrevStage, handleNextStage, scrollActiveStageContainer]);


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
        return <StageIntegration onAdvance={navigateToStage} />;
      case 7:
        return <StageFinalSourceCode onAdvance={navigateToStage} />;
      case 8:
        return <StageLivePreview onAdvance={navigateToStage} />;
      case 9:
        return <StageDevelopmentResults onAdvance={navigateToStage} />;
      case 10:
        return <StagePostDevRequest onAdvance={navigateToStage} />;
      case 11:
        return <StagePostDevExecution onAdvance={navigateToStage} />;
      default:
        return <StageProductRequest onAdvance={navigateToStage} />;
    }
  };

  // Dark / Light system theme state (persisted in localStorage, defaults to Dark mode)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('autodev_dark_mode');
      if (saved !== null) {
        return saved === '1';
      }
      return true;
    } catch {
      return true;
    }
  });

  // When on landing page, theme is permanently dark. On main page, follows user's isDark setting.
  const isLanding = currentPage === 'landing';
  const effectiveIsDark = isLanding ? true : isDark;

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const html = document.documentElement;
        if (currentPage === 'landing' || isDark) {
          html.classList.add('dark');
          html.classList.remove('light');
        } else {
          html.classList.remove('dark');
          html.classList.add('light');
        }
      }
    } catch {
      // ignore
    }
  }, [isDark, currentPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleThemeEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ isDark?: boolean }>).detail;
      if (detail && typeof detail.isDark === 'boolean') {
        setIsDark(detail.isDark);
      }
    };
    window.addEventListener('autodev:theme-change', handleThemeEvent);
    return () => window.removeEventListener('autodev:theme-change', handleThemeEvent);
  }, []);

  return (
    <div
      className={`min-h-screen w-full select-none relative overflow-x-hidden transition-colors duration-500 ease-in-out ${
        effectiveIsDark ? 'bg-black text-slate-100' : 'bg-white text-slate-900'
      }`}
    >
      {/* ── 3D Ambient Background Layer ── */}
      {/* 1. React Bits LightRays 3D Background (Active on Landing and Sign In over pure dark background) */}
      {(currentPage === 'landing' || currentPage === 'signup') && (
        <div
          id="lightRaysBackgroundLayer"
          className="fixed inset-0 w-screen h-screen pointer-events-none overflow-hidden transition-opacity duration-700 bg-black"
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, backgroundColor: '#000000' }}
          aria-hidden="true"
        >
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={0.6}
            lightSpread={0.9}
            rayLength={1.2}
            followMouse={true}
            mouseInfluence={0.3}
            noiseAmount={0.1}
            distortion={0.05}
            fadeDistance={1.5}
            className="custom-rays w-full h-full"
          />
        </div>
      )}

      {/* 2. React Bits AeroShards 3D Background (Active when entering the Main Development System) */}
      {currentPage !== 'landing' && currentPage !== 'signup' && (
        <div
          id="aeroShardsBackgroundLayer"
          className="fixed inset-0 w-screen h-screen pointer-events-none overflow-hidden transition-opacity duration-700"
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}
          aria-hidden="true"
        >
          <AeroShards
            className="w-full h-full"
            backgroundColor={isDark ? '#000000' : '#ffffff'}
            shardColor="#8258c6"
            accentColor="#a240ff"
            placement="full"
            flow="stream"
            material="pearl"
            detail="balanced"
            effect="none"
            scale={1.5}
            spread={1}
            depth={1}
            speed={0.6}
            spin={1}
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
      )}

      {/* ── Foreground Glassmorphic Application Layer ── */}
      <div className="relative z-10 min-h-screen w-full flex flex-col pointer-events-auto">
        {/* ── Background Terminal UI with SSE streams running ── */}
        <Terminal />

      {/* ── Restoration Banner in DOM ── */}
      <RestorationBanner />

      {/* ── Glass Toast Container (Fixed Top-Center Pill) ── */}
      <GlassToastContainer />

      {/* ── Peripheral Test Invariants (Preserved in DOM for test assertions) ── */}
      <div className="hidden" aria-hidden="true">
        {currentPage !== 'main' && (
          <Header
            variant="glass"
            version="SYS.v2.5.0"
            isDark={isDark}
            onToggleTheme={setIsDark}
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
        <div id="pageLanding" className="min-h-screen w-full flex flex-col items-center justify-center overflow-y-auto bg-transparent text-slate-100 relative z-20">
          {/* Landing Content Surface */}
          <main className="w-full flex-1 flex items-center justify-center py-10 px-4">
            <StageLanding onGetStarted={() => handlePageChange('signup')} />
          </main>
        </div>
      )}

      {currentPage === 'signup' && (
        <div id="pageSignIn" className="min-h-screen w-full flex flex-col justify-between overflow-y-auto">
          {/* Sign In Top Header */}
          <header className="h-16 px-6 sm:px-12 flex items-center justify-between bg-transparent border-none sticky top-0 z-20">
            <div
              onClick={() => handlePageChange('landing')}
              className="relative inline-flex items-center group cursor-pointer"
            >
              <div
                className="absolute -inset-x-4 -inset-y-2 bg-slate-950/15 backdrop-blur-md rounded-full pointer-events-none -z-10"
                style={{ filter: 'blur(16px)' }}
                aria-hidden="true"
              />
              <span
                className="font-cursive text-3xl sm:text-4xl md:text-[42px] text-white/90 group-hover:text-white italic font-normal tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-all select-none"
                style={{ fontFamily: "'Alex Brush', cursive, sans-serif" }}
              >
                AutoDev
              </span>
            </div>
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

      {currentPage === 'profile' && (
        <UserProfilePage
          onBack={() => handlePageChange('main')}
          isDark={isDark}
          onToggleTheme={setIsDark}
        />
      )}

      {currentPage === 'main' && (
        <div id="pageMainSystem" className="h-[100dvh] w-full flex flex-col overflow-hidden relative">
          {/* ── 1. Top Bar (Header with Cursive Logo, Theme Toggle & Specular 3-Strip Sidebar Toggle) ── */}
          <Header
            variant="glass"
            version="SYS.v2.5.0"
            stage={currentStage}
            isDark={isDark}
            onToggleTheme={setIsDark}
            onProfileClick={() => handlePageChange('profile')}
            onMenuClick={() => setIsSidebarOpen((prev) => !prev)}
          />

          {/* ── Collapsible Right Sidebar with Full-Screen Background Blur ── */}
          <RightSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            currentStage={currentStage}
            onOpenProfile={() => handlePageChange('profile')}
            userName={authUser?.display_name || authUser?.username || 'Alex'}
            userEmail={authUser?.email || 'alex@autodev.org'}
          />

          {/* ── 2. Dynamic Edge-Hover Navigation: Left Hover Zone (<) ── */}
          {canNavigatePrev && (
            <div
              id="leftEdgeHoverZone"
              className="fixed left-0 top-16 bottom-0 w-16 sm:w-20 z-40 group flex items-center justify-start pl-3 sm:pl-4 pointer-events-auto"
            >
              <button
                id="stageNavPrevBtn"
                type="button"
                onClick={handlePrevStage}
                title="Previous Stage"
                aria-label="Previous Stage"
                className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/[0.12] hover:border-white/30 backdrop-blur-2xl text-slate-200 hover:text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-105 cursor-pointer"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* ── 3. Dynamic Edge-Hover Navigation: Right Hover Zone (>) ── */}
          {canNavigateNext && (
            <div
              id="rightEdgeHoverZone"
              className="fixed right-0 top-16 bottom-0 w-16 sm:w-20 z-40 group flex items-center justify-end pr-3 sm:pr-4 pointer-events-auto"
            >
              <button
                id="stageNavNextBtn"
                type="button"
                onClick={handleNextStage}
                title="Next Stage"
                aria-label="Next Stage"
                className="w-12 h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/[0.12] hover:border-white/30 backdrop-blur-2xl text-slate-200 hover:text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-105 cursor-pointer"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* ── 4. Main Screen Layout: Stage Title Bar + Maximized Central Workspace (~80vh) ── */}
          <main
            className={`flex-1 w-full ${
              currentStage === 2 ? 'max-w-4xl' : 'max-w-7xl'
            } mx-auto px-4 sm:px-8 py-2 sm:py-3 flex flex-col min-h-0 overflow-hidden`}
          >

            {/* Maximized Central Workspace Container (~80% Viewport Height) - non-blocking sliding stage container */}
            <motion.div
              key={currentStage}
              id="centralStageWorkspace"
              custom={slideDirection}
              variants={stageSlideVariants}
              initial="enter"
              animate="center"
              className={
                currentStage === 1
                  ? 'relative flex-1 w-full flex flex-col overflow-hidden min-h-0'
                  : currentStage === 2
                  ? 'relative flex-1 w-full max-w-4xl mx-auto rounded-2xl md:rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden min-h-0'
                  : 'relative flex-1 w-full rounded-2xl md:rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden min-h-0'
              }
              style={currentStage !== 1 ? { backdropFilter: 'blur(14px)' } : undefined}
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
          </main>

          {/* ── 5. Floating Stage Number & Expanding Line Sidebar Navigation on the Left ── */}
          <LineSidebar
            currentStage={currentStage}
            maxUnlockedStage={maxUnlockedStage}
            minNavigableStage={minNavigableStage}
            onNavigate={navigateToStage}
          />

          {/* ── 6. Floating Pause/Resume Widget Outside the Central Container on the Right ── */}
          <PauseModifyFAB currentStage={currentStage} />
        </div>
      )}
      </div>
    </div>
  );
}
