import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CommandLineIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../stores/appStore';
import { useSessionStore } from '../stores/sessionStore';
import { calculateTokenCostINR, formatInr } from '../utils/formatters';
import { ModernScrollbar } from './ModernScrollbar';

export interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentStage: number;
  onOpenProfile: () => void;
  userName?: string;
  userEmail?: string;
  avatarColor?: string;
}

/**
 * Formats elapsed milliseconds into MM:SS or HH:MM:SS digital timer string.
 */
function formatSessionElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Derives a clean, concise software project name when full requirements are still generating.
 */
function deriveSoftwareName(
  projectTitle?: string | null,
  componentName?: string | null,
  featureRequest?: string | null
): string {
  if (projectTitle && projectTitle.trim()) {
    return projectTitle.trim();
  }
  if (componentName && componentName.trim()) {
    return componentName.trim();
  }
  if (featureRequest && featureRequest.trim()) {
    const cleaned = featureRequest
      .trim()
      .replace(
        /^(please\s+)?(build|create|develop|design|make|implement|generate|write)\s+(a|an|the)?\s*/i,
        ''
      )
      .trim();
    if (cleaned) {
      const words = cleaned.split(/\s+/).slice(0, 5).join(' ');
      const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
      return cleaned.split(/\s+/).length > 5 ? `${capitalized}...` : capitalized;
    }
  }
  return 'AutoDev Software Project';
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  currentStage,
  onOpenProfile,
  userName = 'Alex',
  userEmail = 'alex@autodev.org',
  avatarColor,
}) => {
  const isSSR = typeof window === 'undefined';
  const liveAppStore = isSSR ? useAppStore.getState() : null;
  const liveSessionStore = isSSR ? useSessionStore.getState() : null;

  const storeRequirements = useAppStore((s) => s.requirements);
  const storeDecomposition = useAppStore((s) => s.decomposition);
  const storeFeatureRequest = useAppStore((s) => s.featureRequest);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeIsPaused = useAppStore((s) => s.isPaused);
  const storeIsEnquiring = useAppStore((s) => s.isEnquiring);
  const storePostCompletionVisible = useAppStore((s) => s.postCompletionVisible);
  const storeAppSessionUsage = useAppStore((s) => s.sessionUsage);
  const storeComponentStates = useAppStore((s) => s.componentStates);
  const storeMaxUnlockedStage = useAppStore((s) => s.maxUnlockedStage);

  const storeSessionUsage = useSessionStore((s) => s.sessionUsage);

  const requirements = liveAppStore ? liveAppStore.requirements : storeRequirements;
  const decomposition = liveAppStore ? liveAppStore.decomposition : storeDecomposition;
  const featureRequest = liveAppStore ? liveAppStore.featureRequest : storeFeatureRequest;
  const pipelineStatus = liveAppStore ? liveAppStore.pipelineStatus : storePipelineStatus;
  const isPaused = liveAppStore ? liveAppStore.isPaused : storeIsPaused;
  const isEnquiring = liveAppStore ? liveAppStore.isEnquiring : storeIsEnquiring;
  const postCompletionVisible = liveAppStore
    ? liveAppStore.postCompletionVisible
    : storePostCompletionVisible;
  const componentStates = liveAppStore
    ? liveAppStore.componentStates
    : storeComponentStates;
  const maxUnlockedStage = liveAppStore
    ? liveAppStore.maxUnlockedStage
    : storeMaxUnlockedStage;

  // A product is completed if pipelineStatus is completed, postCompletionVisible is true, or highest stage reached delivery (>= 9)
  const isProductCompleted =
    pipelineStatus === 'completed' ||
    Boolean(postCompletionVisible) ||
    (maxUnlockedStage !== undefined && maxUnlockedStage >= 9);

  const rawSessionUsage = liveSessionStore
    ? liveSessionStore.sessionUsage
    : storeSessionUsage.prompt + storeSessionUsage.completion > 0
    ? storeSessionUsage
    : storeAppSessionUsage;

  // Stage-1 visibility rule:
  // Session info (software name + status badge, session time, session cost)
  // ONLY appears after the user clicks Start Development in Stage 1 (i.e. currentStage >= 2 or if product already completed).
  const showSessionInfo = currentStage >= 2 || isProductCompleted;

  // ── 1. Software Name & Compact Status Badge ───────────────────────────────
  const softwareName = useMemo(
    () =>
      deriveSoftwareName(
        requirements?.project_title,
        decomposition?.components?.[0]?.component_name,
        featureRequest
      ),
    [requirements?.project_title, decomposition?.components, featureRequest]
  );

  // True when on Stage 2 (Product Enquiry) after agent finishes enquiring and waiting for user to click "START DEVELOPMENT",
  // strictly during initial pre-development (never when a product has already completed).
  const isWaitingForStage2UserInput =
    !isProductCompleted && currentStage === 2 && !isEnquiring && pipelineStatus !== 'running';

  const isDevelopmentPaused = !isProductCompleted && Boolean(isPaused);

  const compactStatus: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'PAUSED' = useMemo(() => {
    // 1. Completion is authoritative: once a product is completed, inspecting earlier stages never marks it as paused or running
    if (isProductCompleted) {
      return 'COMPLETED';
    }
    // 2. Active user pause or Stage 2 prompt confirmation
    if (isDevelopmentPaused || isWaitingForStage2UserInput) {
      return 'PAUSED';
    }
    // 3. Active execution
    if (
      pipelineStatus === 'running' ||
      isEnquiring ||
      (currentStage >= 3 && currentStage < 9)
    ) {
      return 'RUNNING';
    }
    return 'IDLE';
  }, [
    isProductCompleted,
    isDevelopmentPaused,
    isWaitingForStage2UserInput,
    pipelineStatus,
    isEnquiring,
    currentStage,
  ]);

  // Dynamic background color hue for Session Time card based on project development status
  const sessionTimeStatusHueClass = useMemo(() => {
    switch (compactStatus) {
      case 'RUNNING':
        return 'bg-sky-500/10 dark:bg-sky-950/45 border-sky-300/40 dark:border-sky-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
      case 'COMPLETED':
        return 'bg-emerald-500/10 dark:bg-emerald-950/45 border-emerald-300/40 dark:border-emerald-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
      case 'PAUSED':
        return 'bg-amber-500/10 dark:bg-amber-950/45 border-amber-300/40 dark:border-amber-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
      case 'IDLE':
      default:
        return 'bg-white/60 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
    }
  }, [compactStatus]);

  // ── 2. Development Progress (<stage name> and percentage) ─────────────────
  // Monotonic development progress: tracks the highest stage achieved in development.
  // Navigating back to earlier stages to inspect blueprints or requirements does not decrease progress.
  const stageProgress = useMemo(() => {
    const effectiveStage = isProductCompleted
      ? (currentStage >= 10 ? currentStage : 9)
      : Math.max(currentStage, maxUnlockedStage || 1);

    switch (effectiveStage) {
      case 1:
        return { name: 'Product Request', percentage: 5 };
      case 2:
        return {
          name: 'Product Enquiry Stage',
          percentage: isEnquiring ? 18 : 25,
        };
      case 3:
        return {
          name: 'Requirements Stage',
          percentage: requirements ? 42 : 35,
        };
      case 4:
        return {
          name: 'Decomposition Stage',
          percentage: decomposition ? 58 : 50,
        };
      case 5: {
        const components = decomposition?.components || [];
        if (components.length > 0 && componentStates) {
          const completed = components.filter((c: any) => {
            const s = componentStates[c.component_id]?.status;
            return s === 'passed' || s === 'critic_passed' || s === 'complete';
          }).length;
          const pct = Math.round(60 + (completed / components.length) * 18);
          return { name: 'Component Pipeline Stage', percentage: pct };
        }
        return { name: 'Component Pipeline Stage', percentage: 68 };
      }
      case 6:
        return { name: 'Integration Stage', percentage: 86 };
      case 7:
        return { name: 'Final Source Code Stage', percentage: 92 };
      case 8:
        return { name: 'Live Preview Stage', percentage: 96 };
      case 9:
        return { name: 'Completed Stage', percentage: 100 };
      case 10:
        return { name: 'Post-Dev Support Request (beta)', percentage: 100 };
      case 11:
        return { name: 'Post-Dev Execution (beta)', percentage: 100 };
      default:
        return { name: 'Completed Stage', percentage: 100 };
    }
  }, [
    isProductCompleted,
    currentStage,
    maxUnlockedStage,
    isEnquiring,
    requirements,
    decomposition,
    componentStates,
  ]);

  // ── 3. Session Timer Lifecycle ──
  // - Starts in Stage 2 while Product Enquiry Agent is analyzing (isEnquiring === true)
  // - Stops in Stage 2 while waiting for user input, and resumes only after user clicks "START DEVELOPMENT" in Stage 2 (entering Stage 3)
  // - Stops whenever user pauses development and resumes when user resumes development
  // - Permanently stops at final product delivery (Stage 9) and never restarts on post-development support requests
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerStartRef = useRef<number | null>(null);
  const accumulatedBeforePauseRef = useRef<number>(0);
  const frozenAtDeliveryRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Full reset only when returning to Stage 1 with an idle pipeline (Request New Product)
    if (
      currentStage === 1 &&
      pipelineStatus === 'idle' &&
      !postCompletionVisible &&
      !requirements
    ) {
      timerStartRef.current = null;
      accumulatedBeforePauseRef.current = 0;
      frozenAtDeliveryRef.current = false;
      setElapsedMs(0);
      return;
    }

    // 2. Freeze permanently once final product delivery (Stage 9 or pipeline completion) is reached.
    // Never restart even if user navigates to Stage 10 / Stage 11 for post-development support.
    if (
      currentStage >= 9 ||
      pipelineStatus === 'completed' ||
      postCompletionVisible ||
      isProductCompleted
    ) {
      if (!frozenAtDeliveryRef.current) {
        if (timerStartRef.current !== null) {
          accumulatedBeforePauseRef.current += Date.now() - timerStartRef.current;
          timerStartRef.current = null;
        }
        frozenAtDeliveryRef.current = true;
        setElapsedMs(accumulatedBeforePauseRef.current);
      }
      return;
    }

    // 3. Stop/pause timer when user pauses development OR when in Stage 2 waiting for user input
    const shouldPauseTimer =
      isDevelopmentPaused || isWaitingForStage2UserInput;

    if (shouldPauseTimer) {
      if (timerStartRef.current !== null) {
        accumulatedBeforePauseRef.current += Date.now() - timerStartRef.current;
        timerStartRef.current = null;
      }
      setElapsedMs(accumulatedBeforePauseRef.current);
      return;
    }

    // 4. Active ticking:
    // - In Stage 2 ONLY while Product Enquiry Agent is actively running (isEnquiring === true)
    // - From Stage 3 onwards (after clicking "START DEVELOPMENT" in Stage 2) while not paused/completed
    const shouldTick =
      !frozenAtDeliveryRef.current &&
      ((currentStage === 2 && isEnquiring) ||
        currentStage >= 3 ||
        pipelineStatus === 'running');

    if (shouldTick) {
      if (timerStartRef.current === null) {
        timerStartRef.current = Date.now();
      }

      const updateTick = () => {
        if (timerStartRef.current !== null) {
          setElapsedMs(
            accumulatedBeforePauseRef.current + (Date.now() - timerStartRef.current)
          );
        }
      };

      updateTick();
      const intervalId = setInterval(updateTick, 250);
      return () => clearInterval(intervalId);
    }
  }, [
    currentStage,
    pipelineStatus,
    postCompletionVisible,
    isDevelopmentPaused,
    isWaitingForStage2UserInput,
    isEnquiring,
    requirements,
  ]);

  const formattedSessionTime = useMemo(
    () => formatSessionElapsed(elapsedMs),
    [elapsedMs]
  );

  // ── 3. Session Cost (Includes Pipeline + Post-Development Support Queries & Modifications) ──
  const promptTokens = rawSessionUsage?.prompt || 0;
  const completionTokens = rawSessionUsage?.completion || 0;
  const totalTokens = promptTokens + completionTokens;
  const costValue =
    rawSessionUsage?.cost && rawSessionUsage.cost > 0
      ? rawSessionUsage.cost
      : calculateTokenCostINR(promptTokens, completionTokens);
  const formattedCostInr = formatInr(costValue);

  // ── 4. Live Terminal Window Trigger ──
  const handleOpenLiveTerminal = () => {
    if (typeof window !== 'undefined') {
      if (typeof (window as any).openTerminal === 'function') {
        (window as any).openTerminal();
      } else {
        window.dispatchEvent(new CustomEvent('autodev:open-terminal'));
      }
    }
    onClose();
  };

  // ── 5. User Profile Trigger ──
  const firstAlphabet = (userName?.trim()?.charAt(0) || 'A').toUpperCase();

  const handleProfileClick = () => {
    onClose();
    onOpenProfile();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full-Screen Background Blur Overlay */}
          <motion.div
            id="rightSidebarBackdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 dark:bg-black/55 backdrop-blur-2xl cursor-pointer"
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            aria-hidden="true"
          />

          {/* Glassmorphic Collapsible Right Sidebar (Increased Width) */}
          <motion.aside
            id="rightSidebar"
            aria-label="System Sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 32,
              mass: 0.8,
            }}
            style={{
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
            }}
            className="fixed top-0 right-0 h-[100dvh] w-[350px] sm:w-[410px] md:w-[430px] z-50 bg-white/75 dark:bg-slate-950/[0.28] backdrop-blur-3xl border-l border-white/60 dark:border-white/[0.10] shadow-[-12px_0_40px_rgba(0,0,0,0.06),inset_1px_0_0_rgba(255,255,255,0.7)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.5),inset_1px_0_0_rgba(255,255,255,0.12)] flex flex-col justify-between p-6 text-slate-900 dark:text-slate-100 select-none"
          >
            {/* Close Button Positioned Outside of the Sidebar on the Top-Right */}
            <button
              id="rightSidebarCloseBtn"
              type="button"
              onClick={onClose}
              title="Close Sidebar"
              aria-label="Close Sidebar"
              style={{
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
              className="absolute -left-14 top-4 w-10 h-10 rounded-2xl bg-white/70 hover:bg-white/90 border border-slate-200/80 hover:border-slate-300 text-slate-700 hover:text-black dark:bg-slate-950/[0.35] dark:hover:bg-white/[0.12] dark:border-white/[0.12] dark:hover:border-white/25 dark:text-slate-200 dark:hover:text-white flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-all cursor-pointer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            {/* Top Section: Conditional Session Info + Live Terminal Button */}
            <ModernScrollbar className="flex-1 min-h-0 pr-0.5" viewportClassName="space-y-5">
              {/* Session Information (Only visible after user clicks Start Development in Stage 1) */}
              {showSessionInfo && (
                <div id="sidebarSessionMetricsGroup" className="space-y-4">
                  {/* 1. Software Name & Enlarged Status Badge Directly in Sidebar (Not inside any card container) */}
                  <div id="sidebarSoftwareHeader" className="space-y-2.5 pt-1 pb-2">
                    <h2
                      id="sidebarSoftwareName"
                      className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight leading-snug break-words"
                      title={softwareName}
                    >
                      {softwareName}
                    </h2>

                    <div className="pt-0.5">
                      <span
                        id="sidebarStatusBadge"
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-mono font-bold uppercase tracking-wider border backdrop-blur-md shadow-xs ${
                          compactStatus === 'RUNNING'
                            ? 'bg-sky-500/10 text-sky-800 border-sky-300/60 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-500/50'
                            : compactStatus === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-300/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/50'
                            : compactStatus === 'PAUSED'
                            ? 'bg-amber-500/10 text-amber-800 border-amber-300/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/50'
                            : 'bg-slate-200/50 text-slate-700 border-slate-300/60 dark:bg-slate-900/60 dark:text-slate-300 dark:border-white/15'
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            compactStatus === 'RUNNING'
                              ? 'bg-sky-400 animate-pulse'
                              : compactStatus === 'COMPLETED'
                              ? 'bg-emerald-400'
                              : compactStatus === 'PAUSED'
                              ? 'bg-amber-400'
                              : 'bg-slate-400'
                          }`}
                        />
                        {compactStatus}
                      </span>
                    </div>
                  </div>

                  {/* 2. Development Progress: Right below development status and above session timer */}
                  <div
                    id="sidebarDevelopmentProgressCard"
                    title={`Development Progress: ${stageProgress.name}`}
                    style={{
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                    className="p-4 sm:p-5 rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl border border-slate-200/70 dark:border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.15)] space-y-2.5"
                  >
                    <div
                      id="sidebarDevelopmentProgressText"
                      className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2 leading-snug"
                    >
                      <span className="text-slate-600 dark:text-slate-300 shrink-0">Development Progress:</span>
                      <span
                        id="sidebarDevelopmentProgressValue"
                        className="font-semibold text-slate-900 dark:text-white tracking-tight text-right truncate"
                      >
                        {stageProgress.name}
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="h-1.5 w-full bg-slate-200/60 dark:bg-white/[0.08] rounded-full overflow-hidden">
                      <div
                        id="sidebarDevelopmentProgressBar"
                        className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${stageProgress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* 3. Session Time (Dynamic background hue based on status, no clock icon, no subtitle text, shows "mins") */}
                  <div
                    id="sidebarSessionTimeCard"
                    style={{
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                    className={`p-4 sm:p-5 rounded-2xl backdrop-blur-xl border transition-colors duration-300 flex items-center justify-between ${sessionTimeStatusHueClass}`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Session Time
                    </span>
                    <div
                      id="sidebarSessionTimerValue"
                      className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white tracking-tight"
                    >
                      {formattedSessionTime} mins
                    </div>
                  </div>

                  {/* 3. Session Cost (No rupee SVG, no total tokens label row; format: Cost (Tokens)) */}
                  <div
                    id="sidebarSessionCostCard"
                    style={{
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                    className="p-4 sm:p-5 rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl border border-slate-200/70 dark:border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.15)] flex items-center justify-between gap-3"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
                      Session Cost
                    </span>
                    <span
                      id="sidebarSessionCostValue"
                      className="text-sm sm:text-base font-mono font-bold text-emerald-700 dark:text-emerald-400 text-right"
                    >
                      {formattedCostInr}{' '}
                      <span className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-300">
                        ({totalTokens.toLocaleString()} tokens)
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* 4. The Live Terminal Button (Only SVG and "Live Terminal" text) */}
              <div className="pt-1">
                <button
                  id="sidebarLiveTerminalBtn"
                  type="button"
                  onClick={handleOpenLiveTerminal}
                  style={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }}
                  className="w-full p-4 sm:p-5 rounded-2xl bg-white/60 hover:bg-white/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] backdrop-blur-xl border border-slate-200/70 hover:border-slate-300/80 dark:border-white/[0.08] dark:hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.15)] flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <CommandLineIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-300 transition-colors">
                      Live Terminal
                    </span>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </ModernScrollbar>

            {/* 5. Bottom Section: Username with Email Component (Visible bright white initial) */}
            <div className="pt-4 border-t border-slate-200/60 dark:border-white/[0.08] mt-4">
              <button
                id="sidebarUserAccountBtn"
                type="button"
                onClick={handleProfileClick}
                title="Open User Profile"
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
                className="w-full p-3.5 rounded-2xl bg-white/60 hover:bg-white/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] backdrop-blur-xl border border-slate-200/70 hover:border-slate-300/80 dark:border-white/[0.08] dark:hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.15)] flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Profile Icon: Name's First Alphabet */}
                  <div
                    id="sidebarUserProfileAvatar"
                    style={{ background: avatarColor || 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
                    className="w-10 h-10 rounded-full text-white border border-slate-300 dark:border-white/25 font-bold text-sm flex items-center justify-center shrink-0 shadow-sm overflow-hidden aspect-square"
                  >
                    {firstAlphabet}
                  </div>
                  <div className="text-left min-w-0">
                    <div
                      id="sidebarUserName"
                      className="text-sm font-semibold text-slate-900 dark:text-white truncate"
                    >
                      {userName}
                    </div>
                    <div
                      id="sidebarUserEmail"
                      className="text-xs text-slate-500 dark:text-slate-300 truncate"
                    >
                      {userEmail}
                    </div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default RightSidebar;
