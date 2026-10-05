/**
 * AutoDev Component Track Mini-Pipeline
 *
 * Implements Milestone 2 R2:
 * - Master component track accordion matching #workspace-${cId} and #body-${cId}
 * - Header with Component Name, ID (#status-id-${cId}), Priority Order, and active highlighting
 * - 10-state lifecycle status badges (#status-${cId}) with pulsing dot animations matching legacy CSS
 * - Mini-pipeline stage execution:
 *   1. DESIGN: calls generateDesign(), shows blueprint in #blueprint-container-${cId} and
 *      #design-text-${cId}, auto-advances in QUICK mode, 30s countdown / approval button
 *      (#design-approve-btn-${cId}, #approve-design-${cId}) in COMPLEX mode, calls
 *      completeStage('DESIGN', 'approve')
 *   2. CODEGEN: calls generateCode(), differential patching if revision, shows code in isolated
 *      Monaco editor (#monaco-${cId}), file explorer (#file-list-${cId}), revision tabs (#rev-tabs-${cId}),
 *      auto-advances in QUICK mode, 30s countdown / approval in COMPLEX mode, calls completeStage('CODEGEN', 'approve')
 *   3. CRITICS: executes code via executeCode(), parses logs (#exec-logs-${cId}), calls runCritics(),
 *      shows feedback cards (#critic-cards-${cId}) and adjudicator decision (#verdict-box-${cId}),
 *      auto-passes if composite <= 2.0 or early-stop delta <= 1.0; otherwise queues revision up
 *      to dynamic budget. Once passed, calls completeStage('CRITICS', 'pass') and locks component.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  CheckCircleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import {
  generateDesign,
  generateCode,
  parseBlueprint,
  executeCode,
  runCritics,
  pipelineComplete,
} from '../../api/endpoints';
import { safeJsonParse } from '../../utils/jsonParser';
import { mergeDifferentialCodebase, isDifferentialPayload } from '../ide/merger';
import {
  calculateCompositeScore,
  calculateDynamicBudget,
  isEarlyStopDelta,
} from './revisionLoop';
import { ComponentFileExplorer } from './ComponentFileExplorer';
import { ComponentMonaco } from './ComponentMonaco';
import { ComponentCriticTabs } from './ComponentCriticTabs';
import { withJsonRetry, JsonParseExhaustedError } from '../../utils/jsonRetry';
import type {
  ComponentSpec,
  SystemDesignBlueprint,
  GeneratedCodeBase,
} from '../../types';

export interface ComponentTrackProps {
  /** The decomposed component specification */
  component: ComponentSpec;
  /** Custom wrapper CSS class */
  className?: string;
  /** Force expand accordion body initially */
  defaultExpanded?: boolean;
}

/**
 * Returns exact 10-state visual styling and labels matching legacy CSS.
 */
export function getTrackStatusConfig(status: string = 'queued'): {
  badgeText: string;
  badgeClass: string;
  dotClass: string;
} {
  const s = status ? status.toLowerCase() : 'queued';
  switch (s) {
    case 'queued':
      return {
        badgeText: 'Queued for Design',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700',
        dotClass: 'w-2 h-2 rounded-full bg-slate-400 shrink-0',
      };
    case 'designing':
      return {
        badgeText: 'Designing...',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
        dotClass:
          'w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)] shrink-0',
      };
    case 'waiting_design':
    case 'waiting_code':
      return {
        badgeText: 'Action Required',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse',
        dotClass:
          'w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)] shrink-0',
      };
    case 'coding_queued':
      return {
        badgeText: 'Queued for Code',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700',
        dotClass: 'w-2 h-2 rounded-full bg-slate-400 shrink-0',
      };
    case 'coding':
      return {
        badgeText: 'Coding...',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30',
        dotClass:
          'w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)] shrink-0',
      };
    case 'critic_queued':
      return {
        badgeText: 'Queued for Tests',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700',
        dotClass: 'w-2 h-2 rounded-full bg-slate-400 shrink-0',
      };
    case 'executing':
      return {
        badgeText: 'Executing...',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30',
        dotClass:
          'w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)] shrink-0',
      };
    case 'critiquing':
      return {
        badgeText: 'Evaluating...',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30',
        dotClass:
          'w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)] shrink-0',
      };
    case 'waiting_critic':
      return {
        badgeText: 'Action Required',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse',
        dotClass:
          'w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)] shrink-0',
      };
    case 'passed':
    case 'completed':
      return {
        badgeText: 'Passed',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
        dotClass:
          'w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)] shrink-0',
      };
    case 'failed':
    case 'quarantined':
      return {
        badgeText: 'Failed',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-red-500/20 text-red-400 border border-red-500/30',
        dotClass:
          'w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] shrink-0',
      };
    default:
      return {
        badgeText: 'Queued for Design',
        badgeClass:
          'text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700',
        dotClass: 'w-2 h-2 rounded-full bg-slate-400 shrink-0',
      };
  }
}

/**
 * Formats SystemDesignBlueprint JSON into structured legacy plain text.
 */
export function formatBlueprintToText(bp: SystemDesignBlueprint): string {
  let out = `ARCHITECTURE OVERVIEW:\n${bp.architecture_overview || 'N/A'}\n\n`;
  out += `TECH STACK: ${(bp.tech_stack || []).join(', ')}\n`;
  out += `DOCKER IMAGE: ${bp.docker_image || 'N/A'}\n`;
  out += `DEV SERVER COMMAND: ${bp.dev_server_command || 'NONE'}\n`;
  out += `DEV SERVER PORT: ${bp.dev_server_port ?? 0}\n`;
  out += `RUN TESTS COMMAND: ${bp.run_tests_command || 'pytest'}\n\n`;
  out += `FILES TO GENERATE:`;
  (bp.files || []).forEach((f, i) => {
    out += `\n\n${i + 1}. ${f.file_name}\n`;
    out += `   Purpose: ${f.purpose || 'Component source file'}\n`;
    out += `   Dependencies: ${(f.dependencies || []).join(', ') || 'None'}\n`;
    out += `   Pseudocode:\n${(f.pseudocode || '')
      .split('\n')
      .map((l) => '     ' + l)
      .join('\n')}`;
  });
  return out;
}

export function ComponentTrack({
  component,
  className = '',
  defaultExpanded,
}: ComponentTrackProps) {
  const cId = component.component_id;

  // SSR safety
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Subscribed state
  const storeMode = useAppStore((s) => s.mode);
  const storeActiveId = useAppStore((s) => s.activeComponentId);
  const storeComponentStates = useAppStore((s) => s.componentStates);
  const storeDecomp = useAppStore((s) => s.decomposition);
  const storeReq = useAppStore((s) => s.requirements);
  const storePipelineStatus = useAppStore((s) => s.pipelineStatus);
  const storeIsPaused = useAppStore((s) => s.isPaused);

  const mode = (isSSR ? liveStore?.mode : storeMode) || 'QUICK';
  const activeComponentId = isSSR
    ? liveStore?.activeComponentId
    : storeActiveId;
  const componentStates = isSSR
    ? liveStore?.componentStates
    : storeComponentStates;
  const decomposition = isSSR ? liveStore?.decomposition : storeDecomp;
  const requirements = isSSR ? liveStore?.requirements : storeReq;
  const pipelineStatus = (isSSR ? liveStore?.pipelineStatus : storePipelineStatus) || 'idle';
  const isPaused = isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused;
  const storeResumeEpoch = useAppStore((s) => s.resumeEpoch);
  const resumeEpoch = isSSR ? (liveStore?.resumeEpoch ?? storeResumeEpoch) : storeResumeEpoch;

  // Store actions
  const setActiveComponent = useAppStore((s) => s.setActiveComponent);
  const updateComponentState = useAppStore((s) => s.updateComponentState);
  const addComponentResult = useAppStore((s) => s.addComponentResult);

  // Active track state
  const trackState = (componentStates && componentStates[cId]) || {};
  const status = trackState.status || 'queued';
  const isActive = activeComponentId === cId;
  const isPassed = status === 'passed' || status === 'COMPLETED';

  // Accordion expansion state
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (defaultExpanded !== undefined) return defaultExpanded;
    return !isPassed;
  });

  useEffect(() => {
    if (isActive && !isPassed) {
      setIsExpanded(true);
    }
  }, [isActive, isPassed]);

  // Local UI / editing state
  const [editedBlueprintText, setEditedBlueprintText] = useState<string>('');
  const [activeFileIndex, setActiveFileIndex] = useState<number>(
    () => trackState?.activeFileIndex ?? 0
  );
  const [activeRevisionIndex, setActiveRevisionIndex] = useState<number>(() => {
    if (trackState?.activeRevisionIndex !== undefined) return trackState.activeRevisionIndex;
    if (trackState?.revisionHistory?.length) return trackState.revisionHistory.length - 1;
    return 0;
  });
  const [activeCriticIndex, setActiveCriticIndex] = useState<number>(() => {
    if (trackState?.activeCriticIndex !== undefined) return trackState.activeCriticIndex;
    if (trackState?.criticHistory?.length) return trackState.criticHistory.length - 1;
    return 0;
  });

  // Countdowns (for COMPLEX mode)
  const [designCountdown, setDesignCountdown] = useState<number | null>(null);
  const [designTimerPaused, setDesignTimerPaused] = useState<boolean>(false);
  const [codeCountdown, setCodeCountdown] = useState<number | null>(null);
  const [codeTimerPaused, setCodeTimerPaused] = useState<boolean>(false);
  const [criticCountdown, setCriticCountdown] = useState<number | null>(null);

  // Concurrency & debounce guards
  const inFlightStageRef = useRef<string | null>(null);
  const runIdRef = useRef<number>(0);
  const lastProcessedEpochByStageRef = useRef<Map<string, number>>(new Map());
  const completedStagesRef = useRef<Map<string, number>>(new Map());
  const completedRevisionsRef = useRef<Map<string, number>>(new Map());
  const isEditingBlueprintRef = useRef<boolean>(false);

  // Reset track execution guards when pipeline is not running
  useEffect(() => {
    if (pipelineStatus !== 'running') {
      inFlightStageRef.current = null;
      lastProcessedEpochByStageRef.current.clear();
      completedStagesRef.current.clear();
      completedRevisionsRef.current.clear();
      setDesignCountdown(null);
      setCodeCountdown(null);
      setCriticCountdown(null);
      setDesignTimerPaused(false);
      setCodeTimerPaused(false);
    }
  }, [pipelineStatus]);

  // Reset blueprint editing ref when unpausing
  useEffect(() => {
    if (!isPaused) {
      isEditingBlueprintRef.current = false;
    }
  }, [isPaused]);

  // Sync blueprint text when blueprint updates
  useEffect(() => {
    if (trackState.blueprint && !isEditingBlueprintRef.current) {
      const formatted = formatBlueprintToText(trackState.blueprint);
      setEditedBlueprintText(formatted);
    }
  }, [trackState.blueprint]);

  // Synchronize active indices with trackState if updated upstream
  useEffect(() => {
    if (trackState.activeFileIndex !== undefined) {
      setActiveFileIndex(trackState.activeFileIndex);
    }
  }, [trackState.activeFileIndex]);

  useEffect(() => {
    if (trackState.activeRevisionIndex !== undefined) {
      setActiveRevisionIndex(trackState.activeRevisionIndex);
    } else if (trackState.revisionHistory?.length) {
      setActiveRevisionIndex(trackState.revisionHistory.length - 1);
    }
  }, [trackState.activeRevisionIndex, trackState.revisionHistory]);

  useEffect(() => {
    if (trackState.activeCriticIndex !== undefined) {
      setActiveCriticIndex(trackState.activeCriticIndex);
    } else if (trackState.criticHistory?.length) {
      setActiveCriticIndex(trackState.criticHistory.length - 1);
    }
  }, [trackState.activeCriticIndex, trackState.criticHistory]);

  // Header click: toggle accordion & set active component
  const handleHeaderClick = () => {
    setIsExpanded((prev) => !prev);
    setActiveComponent(cId);
  };

  // ── MINI-PIPELINE STAGE 1: DESIGN ──────────────────────────────────────────

  const executeDesignStage = useCallback(async () => {
    const curTrack = (useAppStore.getState().componentStates || {})[cId] || {};
    const curEpoch = curTrack.epoch ?? 0;
    if (inFlightStageRef.current === 'DESIGN') return;
    if (useAppStore.getState().isPaused) return;
    if ((completedStagesRef.current.get('DESIGN') ?? 0) >= curEpoch && curEpoch > 0) return;
    inFlightStageRef.current = 'DESIGN';
    const myRun = ++runIdRef.current;
    const startResumeEpoch = useAppStore.getState().resumeEpoch || 0;
    const isStale = () =>
      runIdRef.current !== myRun ||
      useAppStore.getState().isPaused ||
      (useAppStore.getState().resumeEpoch || 0) !== startResumeEpoch;

    const designIntervalId = useAppStore.getState().startTimelineInterval({
      phase: 'design',
      stageName: 'Component Design',
      label: `Design: ${component.component_name}`,
      componentId: cId,
      componentName: component.component_name,
    });

    try {
      setIsExpanded(true);
      updateComponentState(cId, { status: 'designing' });

      // Effective tech stack and Docker image
      const effectiveTechStack =
        component.tech_stack && component.tech_stack.length > 0
          ? component.tech_stack
          : decomposition?.shared_tech_stack || [];
      const effectiveDockerImage =
        component.docker_image || decomposition?.shared_docker_image || '';

      const contextStr =
        'Tech Stack: ' +
        (effectiveTechStack || []).join(', ') +
        '\nDocker Image: ' +
        effectiveDockerImage +
        '\nScoped Requirements:\n' +
        component.scoped_requirements;

      const reqPayload = requirements || {
        project_title: component.component_name,
        overview: component.description,
        user_stories: [],
      };

      const setJsonRetryState = useAppStore.getState().setJsonRetryState;
      const parsedBp = await withJsonRetry(
        async (opts) => {
          return await generateDesign({
            requirements: reqPayload,
            component_context: contextStr,
            component_name: component.component_name,
            component_id: cId,
            component,
            decomposition: decomposition || undefined,
            mode,
            generation_mode: mode,
            model: opts?.model
          } as any);
        },
        (res) => {
          const rawText = (res as any).text || res.cleanedText || res.fullText;
          const p = safeJsonParse(rawText);
          if (p && typeof p === 'object' && 'error' in p && (p as any).error) {
            if ((p as any).json_parse_failure) throw new JsonParseExhaustedError(String((p as any).error), 'DESIGN', (p as any).attempts);
            throw new Error(String((p as any).error));
          }
          return p as SystemDesignBlueprint;
        },
        {
          phaseName: 'DESIGN',
          onRetryAttempt: (attempt, max) => {
            setJsonRetryState({
              isRetrying: true,
              currentAttempt: attempt,
              maxAttempts: max,
              phaseName: 'DESIGN',
              usingFallback: attempt > 3,
            });
          }
        }
      );
      setJsonRetryState(null);

      if (isStale()) {
        useAppStore.getState().completeTimelineInterval(designIntervalId, { status: 'failed' });
        return;
      }

      const bpText = formatBlueprintToText(parsedBp);
      setEditedBlueprintText(bpText);

      completedStagesRef.current.set('DESIGN', curEpoch);

      updateComponentState(cId, {
        status: 'coding_queued',
        blueprint: parsedBp,
        currentStage: 'DESIGN',
      });
      useAppStore.getState().completeTimelineInterval(designIntervalId, { status: 'completed' });
      await pipelineComplete({
        component_id: cId,
        stage: 'DESIGN',
        verdict: 'approve',
        mode: 'QUICK',
      });
    } catch (err: any) {
      console.error(`Design error in component ${cId}:`, err);
      useAppStore.getState().completeTimelineInterval(designIntervalId, { status: 'failed' });
      if (!isStale()) {
        updateComponentState(cId, { status: 'failed' });
      }
    } finally {
      if (runIdRef.current === myRun) inFlightStageRef.current = null;
    }
  }, [cId, component, decomposition, requirements, mode, updateComponentState]);

  const handleApproveDesign = useCallback(async () => {
    setDesignCountdown(null);
    let finalBp: SystemDesignBlueprint = trackState.blueprint || {
      architecture_overview: '',
      tech_stack: [],
      docker_image: '',
      dev_server_command: 'NONE',
      dev_server_port: 0,
      run_tests_command: 'pytest',
      files: [],
    };

    if (mode === 'COMPLEX' && editedBlueprintText) {
      try {
        finalBp = await parseBlueprint({ text: editedBlueprintText });
      } catch (e) {
        console.warn('Fallback: could not parse edited blueprint text, using original', e);
      }
    }

    updateComponentState(cId, {
      status: 'coding_queued',
      blueprint: finalBp,
    });

    try {
      await pipelineComplete({
        component_id: cId,
        stage: 'DESIGN',
        verdict: 'approve',
        mode,
      });
    } catch (e) {
      console.error('pipelineComplete DESIGN error:', e);
    }
  }, [cId, mode, editedBlueprintText, trackState.blueprint, updateComponentState]);

  // Design countdown timer effect
  useEffect(() => {
    if (designCountdown === null || designCountdown <= 0 || designTimerPaused || isPaused || pipelineStatus !== 'running') return;
    const timer = setInterval(() => {
      setDesignCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleApproveDesign();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [designCountdown, designTimerPaused, handleApproveDesign, isPaused, pipelineStatus]);

  // ── MINI-PIPELINE STAGE 2: CODEGEN ─────────────────────────────────────────

  const executeCodeGenStage = useCallback(async () => {
    const currentTrack = (useAppStore.getState().componentStates || {})[cId] || {};
    const curEpoch = currentTrack.epoch ?? 0;
    const curRev = currentTrack.revisionCount ?? 0;
    const lastCompletedEpoch = completedStagesRef.current.get('CODEGEN') ?? -1;
    const lastCompletedRev = completedRevisionsRef.current.get('CODEGEN') ?? -1;

    if (inFlightStageRef.current === 'CODEGEN') return;
    if (useAppStore.getState().isPaused) return;
    if (curEpoch > 0 && lastCompletedEpoch >= curEpoch && curRev <= lastCompletedRev) return;
    inFlightStageRef.current = 'CODEGEN';
    const myRun = ++runIdRef.current;
    const startResumeEpoch = useAppStore.getState().resumeEpoch || 0;
    const isStale = () =>
      runIdRef.current !== myRun ||
      useAppStore.getState().isPaused ||
      (useAppStore.getState().resumeEpoch || 0) !== startResumeEpoch;

    const codegenIntervalId = useAppStore.getState().startTimelineInterval({
      phase: 'codegen',
      stageName: 'Code Generation',
      label: `Codegen: ${component.component_name}`,
      componentId: cId,
      componentName: component.component_name,
      revisionIndex: currentTrack.revisionCount || 0,
    });

    try {
      setIsExpanded(true);
      updateComponentState(cId, { status: 'coding' });

      const prevCodebase: GeneratedCodeBase | null = currentTrack.codebase
        ? JSON.parse(JSON.stringify(currentTrack.codebase))
        : null;

      const reqPayload = requirements || {
        project_title: component.component_name,
        overview: component.description,
        user_stories: [],
      };

      const res = await generateCode({
        requirements: reqPayload,
        blueprint: currentTrack.blueprint!,
        previous_codebase: prevCodebase,
        revision_plan: currentTrack.revisionPlan || undefined,
        component_name: component.component_name,
        component_id: cId,
        revision_count: currentTrack.revisionCount || 0,
        generation_mode: mode,
        mode,
      });

      if (isStale()) {
        useAppStore.getState().completeTimelineInterval(codegenIntervalId, { status: 'failed' });
        return;
      }

      const rawText = (res as any).text || res.cleanedText || res.fullText;
      const parsedCode = safeJsonParse(rawText);
      let mergedCodebase: GeneratedCodeBase;

      if (parsedCode && typeof parsedCode === 'object') {
        if (isDifferentialPayload(parsedCode)) {
          mergedCodebase = mergeDifferentialCodebase(prevCodebase, parsedCode);
        } else if (Array.isArray((parsedCode as any).files)) {
          mergedCodebase = parsedCode as GeneratedCodeBase;
        } else {
          mergedCodebase = prevCodebase || { files: [] };
        }
      } else {
        mergedCodebase = prevCodebase || { files: [] };
      }

      const prevHistory = currentTrack.revisionHistory || [];
      const newHistory = [...prevHistory, { codebase: mergedCodebase }];

      updateComponentState(cId, {
        codebase: mergedCodebase,
        revisionHistory: newHistory,
        activeRevisionIndex: newHistory.length - 1,
        activeFileIndex: 0,
        currentStage: 'CODEGEN',
      });

      completedStagesRef.current.set('CODEGEN', curEpoch);
      completedRevisionsRef.current.set('CODEGEN', currentTrack.revisionCount || 0);

      updateComponentState(cId, { status: 'critic_queued' });
      useAppStore.getState().completeTimelineInterval(codegenIntervalId, { status: 'completed' });
      await pipelineComplete({
        component_id: cId,
        stage: 'CODEGEN',
        verdict: 'approve',
        mode: 'QUICK',
      });
    } catch (err: any) {
      console.error(`CodeGen error in component ${cId}:`, err);
      useAppStore.getState().completeTimelineInterval(codegenIntervalId, { status: 'failed' });
      if (!isStale()) {
        updateComponentState(cId, { status: 'failed' });
      }
    } finally {
      if (runIdRef.current === myRun) inFlightStageRef.current = null;
    }
  }, [cId, component, requirements, mode, updateComponentState]);

  const handleApproveCode = useCallback(async () => {
    setCodeCountdown(null);
    updateComponentState(cId, { status: 'critic_queued' });
    try {
      await pipelineComplete({
        component_id: cId,
        stage: 'CODEGEN',
        verdict: 'approve',
        mode,
      });
    } catch (e) {
      console.error('pipelineComplete CODEGEN error:', e);
    }
  }, [cId, mode, updateComponentState]);

  // Code countdown timer effect
  useEffect(() => {
    if (codeCountdown === null || codeCountdown <= 0 || codeTimerPaused || isPaused || pipelineStatus !== 'running') return;
    const timer = setInterval(() => {
      setCodeCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleApproveCode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [codeCountdown, codeTimerPaused, handleApproveCode, isPaused, pipelineStatus]);

  // ── MINI-PIPELINE STAGE 3: CRITICS & ARBITRATION ───────────────────────────

  const approveComponentFinal = useCallback(
    async (isForced: boolean = false) => {
      setCriticCountdown(null);
      const latest = useAppStore.getState().componentStates[cId] || trackState;

      updateComponentState(cId, { status: 'passed' });

      addComponentResult({
        component_id: cId,
        component_name: component.component_name,
        blueprint: latest.blueprint || {
          architecture_overview: '',
          tech_stack: [],
          docker_image: '',
          dev_server_command: 'NONE',
          dev_server_port: 0,
          run_tests_command: 'pytest',
          files: [],
        },
        codebase: latest.codebase || { files: [] },
        execution_result: latest.executionResult || { success: true, logs: 'Passed' },
      });

      try {
        await pipelineComplete({
          component_id: cId,
          stage: 'CRITICS',
          verdict: isForced ? 'revise' : 'pass',
          force_proceed: isForced,
          revision_count: latest.revisionCount || 0,
          dynamic_budget: latest.dynamicBudget,
          mode,
        });
      } catch (e) {
        console.error('pipelineComplete CRITICS error:', e);
      }

      setIsExpanded(false);

      // Find next uncompleted component in queue and switch active component so it starts/expands
      const queue = useAppStore.getState().pipelineQueue || [];
      const states = useAppStore.getState().componentStates || {};
      const nextComp = queue.find(
        (c) =>
          c.component_id !== cId &&
          states[c.component_id]?.status !== 'passed' &&
          states[c.component_id]?.status !== 'COMPLETED'
      );
      if (nextComp) {
        setActiveComponent(nextComp.component_id);
      }
    },
    [cId, component, mode, trackState, updateComponentState, addComponentResult, setActiveComponent]
  );

  const executeCriticsStage = useCallback(async () => {
    const currentTrack = (useAppStore.getState().componentStates || {})[cId] || {};
    const curEpoch = currentTrack.epoch ?? 0;
    const curRev = currentTrack.revisionCount ?? 0;
    const lastCompletedEpoch = completedStagesRef.current.get('CRITICS') ?? -1;
    const lastCompletedRev = completedRevisionsRef.current.get('CRITICS') ?? -1;

    if (inFlightStageRef.current === 'CRITICS') return;
    if (useAppStore.getState().isPaused) return;
    if (curEpoch > 0 && lastCompletedEpoch >= curEpoch && curRev <= lastCompletedRev) return;
    inFlightStageRef.current = 'CRITICS';
    const myRun = ++runIdRef.current;
    const startResumeEpoch = useAppStore.getState().resumeEpoch || 0;
    const isStale = () =>
      runIdRef.current !== myRun ||
      useAppStore.getState().isPaused ||
      (useAppStore.getState().resumeEpoch || 0) !== startResumeEpoch;
    let currentPhaseIntervalId: string | null = null;

    try {
      setIsExpanded(true);
      updateComponentState(cId, { status: 'executing' });

      // Sub-Phase 1: Sandbox Execution
      currentPhaseIntervalId = useAppStore.getState().startTimelineInterval({
        phase: 'execution',
        stageName: 'Sandbox Execution',
        label: `Execution: ${component.component_name}`,
        componentId: cId,
        componentName: component.component_name,
        revisionIndex: currentTrack.revisionCount || 0,
      });

      const exec = await executeCode({
        codebase: currentTrack.codebase || { files: [] },
        blueprint: currentTrack.blueprint || {
          architecture_overview: '',
          tech_stack: [],
          docker_image: '',
          dev_server_command: 'NONE',
          dev_server_port: 0,
          run_tests_command: 'pytest',
          files: [],
        },
        component,
        decomposition: decomposition || undefined,
        mode,
        generation_mode: mode,
      });

      if (isStale()) {
        useAppStore.getState().completeTimelineInterval(currentPhaseIntervalId, { status: 'failed' });
        currentPhaseIntervalId = null;
        return;
      }

      useAppStore.getState().completeTimelineInterval(currentPhaseIntervalId, {
        status: exec.success ? 'passed' : 'failed',
      });
      currentPhaseIntervalId = null;

      updateComponentState(cId, {
        status: 'critiquing',
        executionResult: exec,
      });

      // Sub-Phase 2: Multi-Critic Arbitration
      currentPhaseIntervalId = useAppStore.getState().startTimelineInterval({
        phase: 'critics',
        stageName: 'Critics & Arbitration',
        label: `Critics: ${component.component_name}`,
        componentId: cId,
        componentName: component.component_name,
        revisionIndex: currentTrack.revisionCount || 0,
      });

      const reqPayload = requirements || {
        project_title: component.component_name,
        overview: component.description,
        user_stories: [],
      };

      const criticRes = await runCritics({
        requirements: reqPayload,
        blueprint: currentTrack.blueprint!,
        codebase: currentTrack.codebase!,
        execution_result: exec,
        master_decomposition: decomposition || undefined,
        component_name: component.component_name,
        component_id: cId,
        revision_count: currentTrack.revisionCount || 0,
        mode,
        generation_mode: mode,
        previous_composite: currentTrack.lastComposite ?? null,
      });

      if (isStale()) {
        useAppStore.getState().completeTimelineInterval(currentPhaseIntervalId, { status: 'failed' });
        currentPhaseIntervalId = null;
        return;
      }

      const { feedbacks, decision } = criticRes;

      // Mathematical Adjudication
      const corr =
        feedbacks.find((f) => f.critic_name.toLowerCase().includes('correctness'))
          ?.severity_score ?? 0;
      const arch =
        feedbacks.find((f) => f.critic_name.toLowerCase().includes('architecture'))
          ?.severity_score ?? 0;
      const comp =
        feedbacks.find((f) => f.critic_name.toLowerCase().includes('completeness'))
          ?.severity_score ?? 0;

      const composite =
        decision?.weighted_composite ?? calculateCompositeScore(corr, arch, comp);
      const rawBudget =
        decision?.dynamic_budget ?? calculateDynamicBudget(composite);
      const budget = Math.min(3, rawBudget);
      const isEarlyStop = Boolean(
        decision?.early_stop ||
          (decision?.delta !== null &&
            decision?.delta !== undefined &&
            isEarlyStopDelta(decision.delta))
      );
      const isAutoPass = composite <= 2.0;
      const rawVerdict = (decision?.verdict || '').toLowerCase();
      const isPass = rawVerdict === 'pass' || isEarlyStop || isAutoPass;

      // Update Critic History
      const prevCriticHistory = currentTrack.criticHistory || [];
      const newCriticHistory = [
        ...prevCriticHistory,
        { exec, feedbacks, decision },
      ];

      updateComponentState(cId, {
        criticFeedbacks: feedbacks,
        adjudicatorDecision: decision,
        lastComposite: composite,
        dynamicBudget: budget,
        criticHistory: newCriticHistory,
        activeCriticIndex: newCriticHistory.length - 1,
      });

      completedStagesRef.current.set('CRITICS', curEpoch);
      completedRevisionsRef.current.set('CRITICS', currentTrack.revisionCount || 0);

      useAppStore.getState().completeTimelineInterval(currentPhaseIntervalId, {
        status: isPass ? 'passed' : 'revised',
        details: `Composite: ${composite.toFixed(2)}, Verdict: ${rawVerdict}`,
      });
      currentPhaseIntervalId = null;

      // Branch Decisions
      if (isPass) {
        if (mode === 'QUICK') {
          await approveComponentFinal(false);
        } else {
          updateComponentState(cId, { status: 'waiting_critic' });
          setCriticCountdown(30);
        }
      } else {
        // Revision required
        const currentRevs = currentTrack.revisionCount || 0;
        if (currentRevs < budget) {
          const nextRev = currentRevs + 1;
          completedStagesRef.current.delete('CODEGEN');
          lastProcessedEpochByStageRef.current.delete('CODEGEN');
          inFlightStageRef.current = null;
          updateComponentState(cId, {
            status: 'coding_queued',
            revisionCount: nextRev,
            revisionPlan: decision.revision_plan,
          });

          await pipelineComplete({
            component_id: cId,
            stage: 'CRITICS',
            verdict: 'revise',
            revision_count: nextRev,
            dynamic_budget: budget,
            revision_plan: decision.revision_plan,
            mode,
          });
        } else {
          // Revisions exhausted
          if (mode === 'QUICK') {
            await approveComponentFinal(true);
          } else {
            updateComponentState(cId, { status: 'waiting_critic' });
            setCriticCountdown(30);
          }
        }
      }
    } catch (err: any) {
      console.error(`Critics error in component ${cId}:`, err);
      if (currentPhaseIntervalId) {
        useAppStore.getState().completeTimelineInterval(currentPhaseIntervalId, { status: 'failed' });
      }
      if (!isStale()) {
        updateComponentState(cId, { status: 'failed' });
      }
    } finally {
      if (runIdRef.current === myRun) inFlightStageRef.current = null;
    }
  }, [
    cId,
    component,
    decomposition,
    requirements,
    mode,
    updateComponentState,
    approveComponentFinal,
  ]);

  // Critic countdown timer effect
  useEffect(() => {
    if (criticCountdown === null || criticCountdown <= 0 || isPaused || pipelineStatus !== 'running') return;
    const timer = setInterval(() => {
      setCriticCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          approveComponentFinal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [criticCountdown, approveComponentFinal, isPaused, pipelineStatus]);

  // ── REACTIVE STAGE LEASE DISPATCHER ────────────────────────────────────────

  const prevPausedRef = useRef<boolean>(isPaused);
  const prevResumeEpochRef = useRef<number>(resumeEpoch || 0);
  useEffect(() => {
    if (!isPaused && (resumeEpoch > prevResumeEpochRef.current || prevPausedRef.current)) {
      prevResumeEpochRef.current = resumeEpoch;
      inFlightStageRef.current = null;
      lastProcessedEpochByStageRef.current.clear();
      completedStagesRef.current.clear();
      completedRevisionsRef.current.clear();
      // A critique interrupted by pause was aborted; restart that stage from sandbox execution
      const liveStatus = useAppStore.getState().componentStates?.[cId]?.status;
      if (liveStatus === 'critiquing') {
        updateComponentState(cId, { status: 'executing' });
      }
    }
    prevPausedRef.current = isPaused;
  }, [isPaused, resumeEpoch, cId, updateComponentState]);

  useEffect(() => {
    if (isPaused) return; // <-- PAUSE GUARD
    const curStatus = trackState?.status;
    const curEpoch = trackState?.epoch ?? 0;
    const curRev = trackState?.revisionCount ?? 0;

    // Disregard if already completed
    if (curStatus === 'passed' || curStatus === 'COMPLETED' || curStatus === 'failed') {
      return;
    }

    if (curStatus === 'designing' && inFlightStageRef.current !== 'DESIGN') {
      const lastEpoch = lastProcessedEpochByStageRef.current.get('DESIGN') ?? -1;
      const completedEpoch = completedStagesRef.current.get('DESIGN') ?? -1;
      if ((curEpoch > lastEpoch || curEpoch === 0) && completedEpoch !== curEpoch) {
        lastProcessedEpochByStageRef.current.set('DESIGN', curEpoch);
        executeDesignStage();
      }
    } else if (curStatus === 'coding' && inFlightStageRef.current !== 'CODEGEN') {
      const lastEpoch = lastProcessedEpochByStageRef.current.get('CODEGEN') ?? -1;
      const completedEpoch = completedStagesRef.current.get('CODEGEN') ?? -1;
      const lastCompletedRev = completedRevisionsRef.current.get('CODEGEN') ?? -1;
      const isNewRevision = curRev > lastCompletedRev;
      if (
        (curEpoch > lastEpoch || isNewRevision || (curEpoch === 0 && lastEpoch === -1)) &&
        (completedEpoch !== curEpoch || isNewRevision)
      ) {
        lastProcessedEpochByStageRef.current.set('CODEGEN', curEpoch);
        executeCodeGenStage();
      }
    } else if (curStatus === 'executing' && inFlightStageRef.current !== 'CRITICS') {
      const lastEpoch = lastProcessedEpochByStageRef.current.get('CRITICS') ?? -1;
      const completedEpoch = completedStagesRef.current.get('CRITICS') ?? -1;
      const lastCompletedRev = completedRevisionsRef.current.get('CRITICS') ?? -1;
      const isNewRevision = curRev > lastCompletedRev && lastCompletedRev >= 0;
      if (
        (curEpoch > lastEpoch || isNewRevision || (curEpoch === 0 && lastEpoch === -1)) &&
        (completedEpoch !== curEpoch || isNewRevision)
      ) {
        lastProcessedEpochByStageRef.current.set('CRITICS', curEpoch);
        executeCriticsStage();
      }
    }
  }, [
    trackState?.status,
    trackState?.epoch,
    trackState?.revisionCount,
    executeDesignStage,
    executeCodeGenStage,
    executeCriticsStage,
    isPaused,
  ]);

  // ── UI HELPERS & ACTIVE SLICES ─────────────────────────────────────────────

  const { badgeText, badgeClass, dotClass } = getTrackStatusConfig(status);

  // Active codebase snapshot based on revision tab
  const activeCodebase: GeneratedCodeBase | null =
    trackState.revisionHistory && trackState.revisionHistory[activeRevisionIndex]
      ? trackState.revisionHistory[activeRevisionIndex].codebase
      : trackState.codebase || null;

  const currentFiles = activeCodebase?.files || [];

  const handleSelectFile = (idx: number) => {
    setActiveFileIndex(idx);
    updateComponentState(cId, { activeFileIndex: idx });
  };

  const handleSelectRevision = (revIdx: number) => {
    setActiveRevisionIndex(revIdx);
    setActiveFileIndex(0);
    updateComponentState(cId, {
      activeRevisionIndex: revIdx,
      activeFileIndex: 0,
    });
  };

  const handleFileContentChange = (fileName: string, newContent: string) => {
    setCodeTimerPaused(true);
    const targetCodebase = trackState.codebase || activeCodebase;
    if (!targetCodebase || !targetCodebase.files) return;
    const updatedFiles = targetCodebase.files.map((f: any) => {
      const match =
        f.file_name === fileName ||
        f.path === fileName ||
        (f as any).fileName === fileName ||
        (f as any).filePath === fileName;
      return match ? { ...f, source_code: newContent } : f;
    });
    const updatedCodebase = { ...targetCodebase, files: updatedFiles };
    const revHistory = trackState.revisionHistory || [];
    const updatedHistory =
      revHistory.length > 0
        ? revHistory.map((rev: any, idx: number) =>
            idx === activeRevisionIndex ? { ...rev, codebase: updatedCodebase } : rev
          )
        : [{ codebase: updatedCodebase }];

    updateComponentState(cId, {
      codebase: updatedCodebase,
      revisionHistory: updatedHistory,
    });
  };

  return (
    <div
      id={`workspace-${cId}`}
      tabIndex={0}
      role="region"
      aria-label={`Workspace for ${component.component_name}`}
      className={`min-w-[480px] max-w-[640px] md:min-w-[560px] w-full shrink-0 snap-center rounded-2xl border transition-all duration-200 overflow-hidden mb-4 shadow-sm flex flex-col bg-slate-900/90 dark:bg-slate-900/90 ${
        isActive
          ? 'border-cyan-500/60 ring-2 ring-cyan-500/20 shadow-md'
          : 'border-slate-700/80 dark:border-white/10 hover:border-slate-600'
      } ${className}`}
    >
      {/* ── Accordion Header ───────────────────────────────────────────────── */}
      <div
        className="p-4 bg-slate-800/80 border-b border-slate-700/80 flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-colors select-none"
        onClick={handleHeaderClick}
      >
        <div className="flex items-center gap-3">
          <span className="sr-only">Component Track Workspace</span>
          <span
            id={`status-id-${cId}`}
            className="font-mono text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-medium"
          >
            {`ID: ${cId}`}
          </span>
          <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {`Priority: ${component.priority_order ?? 1}`}
          </span>
          <h3 className="font-bold text-slate-100 text-base tracking-tight truncate max-w-[220px]">
            {component.component_name}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <span
            id={`status-${cId}`}
            className={`inline-flex items-center gap-1.5 ${badgeClass}`}
          >
            <span className={dotClass} />
            <span>{badgeText}</span>
          </span>
          <button
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* ── Accordion Collapsible Body ───────────────────────────────────────── */}
      <div
        id={`body-${cId}`}
        className={`${
          isExpanded ? 'block' : 'hidden'
        } p-6 space-y-8 bg-slate-950/40 divide-y divide-slate-800/60`}
      >
        {/* ── STAGE 1: Architectural Blueprint ────────────────────────────── */}
        <div id={`design-section-${cId}`} className="pt-2 first:pt-0">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-cyan-400 font-bold flex items-center gap-2 text-base">
              <span className="bg-cyan-500 text-white w-6 h-6 rounded-full flex justify-center items-center text-xs shadow-sm">
                1
              </span>
              Architectural Blueprint
            </h4>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {mode} Mode
            </span>
          </div>

          <div id={`blueprint-container-${cId}`} className="mb-4">
            <textarea
              id={`design-text-${cId}`}
              value={editedBlueprintText}
              onChange={(e) => {
                const newText = e.target.value;
                isEditingBlueprintRef.current = true;
                setDesignTimerPaused(true);
                setEditedBlueprintText(newText);
                const currentBp = trackState.blueprint || {
                  architecture_overview: '',
                  tech_stack: [],
                  docker_image: '',
                  dev_server_command: 'NONE',
                  dev_server_port: 0,
                  run_tests_command: 'pytest',
                  files: [],
                };
                updateComponentState(cId, {
                  blueprint: {
                    ...currentBp,
                    architecture_overview: newText,
                  },
                });
              }}
              readOnly={mode === 'QUICK' && !isPaused}
              spellCheck={false}
              rows={9}
              className={`w-full font-mono p-4 rounded-xl text-xs overflow-y-auto shadow-inner border border-slate-700/80 resize-none leading-relaxed transition-colors custom-scrollbar ${
                mode === 'QUICK' && !isPaused
                  ? 'bg-slate-900/60 cursor-not-allowed text-slate-400'
                  : 'bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500'
              }`}
              placeholder="Blueprint specifications will appear once design phase begins..."
            />
          </div>

          {/* Design Action Button */}
          {status === 'waiting_design' ? (
            <button
              id={`design-approve-btn-${cId}`}
              type="button"
              onClick={handleApproveDesign}
              className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <SparklesIcon className="w-5 h-5" />
              <span>
                {designCountdown !== null && designCountdown > 0
                  ? `Approve Design & Generate Code (${designCountdown}s)`
                  : 'Approve Design & Generate Code'}
              </span>
            </button>
          ) : status === 'designing' ? (
            <div className="w-full py-2.5 text-center text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-xl animate-pulse">
              Synthesizing system blueprint...
            </div>
          ) : null}

          {/* Delegated hidden alias for backward compatibility */}
          <button
            id={`approve-design-${cId}`}
            style={{ display: 'none' }}
            aria-hidden="true"
            onClick={handleApproveDesign}
          />
        </div>

        {/* ── STAGE 2: Generated Codebase & IDE ────────────────────────────── */}
        <div id={`code-section-${cId}`} className="pt-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-purple-400 font-bold flex items-center gap-2 text-base">
              <span className="bg-purple-500 text-white w-6 h-6 rounded-full flex justify-center items-center text-xs shadow-sm">
                2
              </span>
              Generated Codebase
            </h4>

            {/* Revision Tabs */}
            <div
              id={`rev-tabs-${cId}`}
              className="flex gap-1.5 overflow-x-auto max-w-xs custom-scrollbar"
            >
              {(trackState.revisionHistory || []).map((_: any, rIdx: number) => {
                const isCur = rIdx === activeRevisionIndex;
                const rLabel = rIdx === 0 ? 'Initial' : `Rev ${rIdx}`;
                return (
                  <button
                    key={rIdx}
                    id={`rev-tab-${cId}-${rIdx}`}
                    type="button"
                    onClick={() => handleSelectRevision(rIdx)}
                    className={`text-xs font-mono px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                      isCur
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500 font-bold'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {rLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monaco & File Explorer Split View */}
          <div className="flex flex-col md:flex-row h-[420px] border border-slate-700/80 rounded-xl overflow-hidden mb-4 bg-[#1e1e1e] shadow-inner">
            <ComponentFileExplorer
              componentId={cId}
              files={currentFiles}
              activeFileIndex={activeFileIndex}
              onSelectFile={handleSelectFile}
              isLoading={status === 'coding'}
            />
            <div className="w-full md:w-2/3 relative h-full">
              <ComponentMonaco
                componentId={cId}
                codebase={activeCodebase}
                activeFileIndex={activeFileIndex}
                activeRevisionIndex={activeRevisionIndex}
                isReadOnly={false}
                onSelectFile={handleSelectFile}
                onSelectRevision={handleSelectRevision}
                onFileContentChange={handleFileContentChange}
                onFocus={() => setCodeTimerPaused(true)}
              />
            </div>
          </div>

          {status === 'coding' ? (
            <div className="w-full py-2.5 text-center text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-xl animate-pulse mb-2">
              Synthesizing component code...
            </div>
          ) : null}

          {/* Hidden alias */}
          <button
            id={`approve-code-${cId}`}
            style={{ display: 'none' }}
            aria-hidden="true"
            onClick={handleApproveCode}
          />
        </div>

        {/* ── STAGE 3: Arbitration & Critics ───────────────────────────────── */}
        <div id={`critic-section-${cId}`} className="pt-6">
          <h4 className="text-rose-400 font-bold flex items-center gap-2 text-base mb-4">
            <span className="bg-rose-500 text-white w-6 h-6 rounded-full flex justify-center items-center text-xs shadow-sm">
              3
            </span>
            Arbitration Feedback
          </h4>

          {status === 'executing' ? (
            <div className="w-full py-2.5 text-center text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-pulse mb-4">
              Executing sandbox tests in container...
            </div>
          ) : status === 'critiquing' ? (
            <div className="w-full py-2.5 text-center text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-pulse mb-4">
              Evaluating quality critics & adjudication...
            </div>
          ) : null}

          <ComponentCriticTabs
            componentId={cId}
            criticHistory={trackState.criticHistory || []}
            activeCriticIndex={activeCriticIndex}
            onSelectCriticTab={setActiveCriticIndex}
            currentExecResult={trackState.executionResult}
            currentFeedbacks={trackState.criticFeedbacks}
            currentDecision={trackState.adjudicatorDecision}
            isMaxRevisions={
              (trackState.revisionCount || 0) >= (trackState.dynamicBudget || 3)
            }
          />

          {/* Component Final Lock / Auto-Revise Button */}
          {isPassed ? (
            <button
              id={`approve-component-${cId}`}
              type="button"
              disabled
              className="w-full bg-slate-800 text-slate-400 font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 border border-slate-700 shadow-inner mt-4"
            >
              <LockClosedIcon className="w-5 h-5 text-emerald-400" />
              <span>Component Locked & Passed</span>
            </button>
          ) : status === 'waiting_critic' ? (
            <button
              id={`approve-component-${cId}`}
              type="button"
              onClick={() => approveComponentFinal(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer mt-4"
            >
              <CheckCircleIcon className="w-5 h-5" />
              <span>
                {criticCountdown !== null && criticCountdown > 0
                  ? `Lock Final Component (${criticCountdown}s)`
                  : 'Lock Final Component'}
              </span>
            </button>
          ) : status === 'coding_queued' && (trackState.revisionCount || 0) > 0 ? (
            <button
              id={`approve-component-${cId}`}
              type="button"
              disabled
              className="w-full bg-orange-600/20 text-orange-400 font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 border border-orange-500/30 shadow-sm animate-pulse mt-4 cursor-not-allowed"
            >
              <span>{`Auto-Revising (Attempt ${trackState.revisionCount}/${trackState.dynamicBudget || 3})...`}</span>
            </button>
          ) : (
            <button
              id={`approve-component-${cId}`}
              style={{ display: 'none' }}
              aria-hidden="true"
              onClick={() => approveComponentFinal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
