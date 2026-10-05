/**
 * AutoDev Integration Runner Hook
 * 
 * Implements Milestone 3 R5:
 * - Orchestrates `runIntegration(isRevision?: boolean)`
 * - Gathers `requirements`, `decomposition`, `component_results` from Zustand store
 * - Streams code unification from `POST /api/integrate`
 * - Merges differential codebase using `mergeDifferentialCodebase`
 * - Generates synthetic blueprint via `createIntegratedBlueprint`
 * - Executes unified tests in Docker sandbox via `POST /api/execute-code`
 * - Evaluates critics via `POST /api/run-critics` with `component_name: "Integration"`
 * - Revision loop calculation:
 *   - Composite score formula: `(score_corr * 0.5) + (score_arch * 0.2) + (score_comp * 0.3)`
 *   - Auto-pass if `composite <= 2.0`
 *   - Early-stop if `early_stop` true or `delta <= 1.0`
 *   - Dynamic budget: strictly up to 5 revisions (Math.min(5, Math.ceil(composite / 2.0)), default 5)
 *   - Revision branch: if `revCount < budget`, schedules next revision after 1500ms
 *   - Max revision branch: forced pass when max 5 revisions reached
 * - Final project export: `#finalDownloadBtn` triggers `downloadZip()` via JSZip
 * - Updates stepper step 5 to `'success'`
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { integrate, executeCode, runCritics } from '../../api/endpoints';
import { mergeDifferentialCodebase } from '../ide/merger';
import { generateDocumentationPhase } from '../pipeline/revisionLoop';
import { robustJsonParse } from '../../utils/jsonParser';
import { sanitizeLucideImports } from '../../utils/zipExporter';
import {
  detectDynamicTestRunner,
  createIntegratedBlueprint,
} from './dynamicTestRunner';
import type {
  GeneratedCodeBase,
  SystemDesignBlueprint,
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
  RequirementsDocument,
  ComponentDecomposition,
} from '../../types';
import type { IntegrateRequest } from '../../types/api';
import { withJsonRetry, JsonParseExhaustedError } from '../../utils/jsonRetry';

export interface IntegrationRevisionSnapshot {
  codebase: GeneratedCodeBase;
  blueprint?: SystemDesignBlueprint | null;
  executionResult?: ExecutionResult | null;
  feedbacks?: CriticFeedback[];
  decision?: AdjudicatorDecision | null;
  compositeScore?: number | null;
  label?: string;
  isPostCompletion?: boolean;
}

export interface IntegrationCriticEntry {
  exec?: ExecutionResult | null;
  feedbacks?: CriticFeedback[];
  decision?: AdjudicatorDecision | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * Packages and downloads the integrated codebase as a clean production zip file,
 * stripping test files, cleaning test scripts from package.json, sanitizing requirements.txt,
 * and rewriting Lucide icons.
 */
export async function downloadIntegratedZip(
  codebase: GeneratedCodeBase | null,
  requirements?: RequirementsDocument | null
): Promise<{ zip: JSZip; blob: Blob }> {
  if (!codebase || !codebase.files || codebase.files.length === 0) {
    throw new Error('No integrated codebase files available to download.');
  }

  const zip = new JSZip();

  codebase.files.forEach((file) => {
    const lower = (file.file_name || '').toLowerCase();

    // 1. Skip transient test files to keep clean production export
    const isTest =
      lower.includes('.test.') ||
      lower.includes('.spec.') ||
      lower.startsWith('test_') ||
      lower.includes('/test_') ||
      lower.startsWith('tests/') ||
      lower.includes('/tests/') ||
      lower.startsWith('__tests__/') ||
      lower.includes('/__tests__/') ||
      lower.startsWith('e2e/') ||
      lower.includes('/e2e/') ||
      lower.includes('playwright.config.') ||
      lower.includes('vitest.config.') ||
      lower.includes('jest.config.');

    if (isTest) return;

    // 2. Clean package.json test scripts and dev dependencies
    if (lower === 'package.json') {
      try {
        const pkg = JSON.parse(file.source_code);
        if (pkg.devDependencies) {
          delete pkg.devDependencies['vitest'];
          delete pkg.devDependencies['jsdom'];
          delete pkg.devDependencies['@playwright/test'];
          delete pkg.devDependencies['jest'];
          if (Object.keys(pkg.devDependencies).length === 0) {
            delete pkg.devDependencies;
          }
        }
        if (pkg.dependencies) {
          delete pkg.dependencies['vitest'];
          delete pkg.dependencies['jsdom'];
          delete pkg.dependencies['@playwright/test'];
          delete pkg.dependencies['jest'];
        }
        if (pkg.scripts && pkg.scripts.test) {
          delete pkg.scripts.test;
        }
        zip.file(file.file_name, JSON.stringify(pkg, null, 2));
        return;
      } catch {
        zip.file(file.file_name, file.source_code);
        return;
      }
    }

    // 3. Clean requirements.txt (remove pytest references)
    if (lower === 'requirements.txt') {
      const cleaned = (file.source_code || '')
        .split('\n')
        .filter((line) => !line.trim().toLowerCase().startsWith('pytest'))
        .join('\n');
      zip.file(file.file_name, cleaned);
      return;
    }

    // 4. Sanitize lucide-react brand icons in JS/TS source code
    let source = file.source_code || '';
    const isJsTs =
      lower.endsWith('.js') ||
      lower.endsWith('.jsx') ||
      lower.endsWith('.ts') ||
      lower.endsWith('.tsx');

    if (isJsTs && source.includes('lucide-react')) {
      source = sanitizeLucideImports(source);
    }

    zip.file(file.file_name, source);
  });

  // 5. Inject README.md if missing
  const hasReadme = codebase.files.some(
    (f) => (f.file_name || '').toLowerCase() === 'readme.md'
  );
  if (!hasReadme) {
    const title = requirements?.project_title || 'AutoDev Project';
    zip.file(
      'README.md',
      `# ${title}\n\nGenerated autonomously by AutoDev multi-component pipeline.\n`
    );
  }

  // 6. Inject USER_GUIDE.md if missing
  const hasUserGuide = codebase.files.some(
    (f) => (f.file_name || '').toLowerCase() === 'user_guide.md'
  );
  if (!hasUserGuide) {
    const title = requirements?.project_title || 'AutoDev Project';
    const overview = requirements?.overview || 'AutoDev multi-component application.';
    let guideContent = `# ${title} - User Guide\n\n## Overview\n${overview}\n\n## Getting Started\nRefer to README.md for setup and installation instructions.\n`;
    if (requirements?.user_stories && requirements.user_stories.length > 0) {
      guideContent += '\n## Feature Guide\n';
      requirements.user_stories.forEach((story, idx) => {
        guideContent += `\n### Feature ${idx + 1}: ${story.title}\nAs a ${story.as_a}, I want to ${story.i_want_to} so that ${story.so_that}.\n`;
        if (story.acceptance_criteria && story.acceptance_criteria.length > 0) {
          guideContent += 'Acceptance Criteria:\n';
          story.acceptance_criteria.forEach((ac) => {
            guideContent += `- ${ac.description}: ${ac.expected_behavior}\n`;
          });
        }
      });
    }
    zip.file('USER_GUIDE.md', guideContent);
  }


  // 6. Generate Blob
  const blob = await zip.generateAsync({ type: 'blob' });

  // 7. Trigger browser download if DOM environment is available
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (requirements?.project_title || 'autodev_project')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      a.download = `${safeName}_autodev.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore download errors in non-browser environments
    }
  }

  return { zip, blob };
}

export function useIntegrationRunner() {
  const store = useAppStore();
  const session = useSessionStore();

  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const [isIntegrating, setIsIntegrating] = useState(false);
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const [isEvaluatingCritics, setIsEvaluatingCritics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [integratedCodebase, setIntegratedCodebaseState] = useState<GeneratedCodeBase | null>(
    (isSSR ? liveStore?.integratedCodebase : store.integratedCodebase) || null
  );
  const [currentExecutionResult, setCurrentExecutionResult] = useState<ExecutionResult | null>(
    (isSSR ? liveStore?.currentExecutionResult : store.currentExecutionResult) || null
  );

  const [revisionCount, setRevisionCount] = useState<number>(
    (isSSR ? liveStore?.integrationRevisionCount : store.integrationRevisionCount) || 0
  );
  const [revisionPlan, setRevisionPlan] = useState<string | null>(
    (isSSR ? liveStore?.integrationRevisionPlan : store.integrationRevisionPlan) || null
  );
  const [dynamicBudget, setDynamicBudget] = useState<number>(
    (isSSR ? liveStore?.integrationDynamicBudget : store.integrationDynamicBudget) || 5
  );
  const [compositeScore, setCompositeScore] = useState<number | null>(
    (isSSR ? liveStore?.lastIntegrationComposite : store.lastIntegrationComposite) || null
  );
  const [lastCompositeScore, setLastCompositeScore] = useState<number | null>(
    (isSSR ? liveStore?.lastIntegrationComposite : store.lastIntegrationComposite) || null
  );

  const [revisionHistory, setRevisionHistory] = useState<IntegrationRevisionSnapshot[]>(
    (isSSR
      ? (liveStore?.integrationRevisionHistory as any)
      : (store.integrationRevisionHistory as any)) || []
  );
  const [activeRevisionIndex, setActiveRevisionIndex] = useState<number>(
    isSSR
      ? liveStore?.integrationActiveRevisionIndex ?? 0
      : store.integrationActiveRevisionIndex >= 0
      ? store.integrationActiveRevisionIndex
      : 0
  );

  const [criticHistory, setCriticHistory] = useState<IntegrationCriticEntry[]>(
    store.integrationCriticHistory || []
  );
  const [activeCriticIndex, setActiveCriticIndex] = useState<number>(
    store.integrationActiveCriticIndex >= 0 ? store.integrationActiveCriticIndex : 0
  );

  const [activeFileIndex, setActiveFileIndex] = useState<number>(store.activeFileIndex || 0);
  const [isDiffMode, setIsDiffMode] = useState<boolean>(store.isDiffMode || false);

  const [isPassed, setIsPassed] = useState<boolean>(false);
  const [isEarlyStop, setIsEarlyStop] = useState<boolean>(false);
  const [isForcedQuickMode, setIsForcedQuickMode] = useState<boolean>(false);
  const [isMaxRevisions, setIsMaxRevisions] = useState<boolean>(false);
  const [verdictLabel, setVerdictLabel] = useState<string>('PENDING');

  // Mutable refs ensuring zero-staleness across async timer callbacks and closures
  const revisionTimeoutRef = useRef<any>(null);
  const revisionCountRef = useRef<number>(revisionCount);
  const revisionPlanRef = useRef<string | null>(revisionPlan);
  const dynamicBudgetRef = useRef<number>(dynamicBudget);
  const lastCompositeScoreRef = useRef<number | null>(lastCompositeScore);
  const integratedCodebaseRef = useRef<GeneratedCodeBase | null>(integratedCodebase);
  const revisionHistoryRef = useRef<IntegrationRevisionSnapshot[]>(revisionHistory);
  const criticHistoryRef = useRef<IntegrationCriticEntry[]>(criticHistory);

  // Keep refs in sync with state
  useEffect(() => {
    revisionCountRef.current = revisionCount;
  }, [revisionCount]);

  useEffect(() => {
    revisionPlanRef.current = revisionPlan;
  }, [revisionPlan]);

  useEffect(() => {
    dynamicBudgetRef.current = dynamicBudget;
  }, [dynamicBudget]);

  useEffect(() => {
    lastCompositeScoreRef.current = lastCompositeScore;
  }, [lastCompositeScore]);

  useEffect(() => {
    integratedCodebaseRef.current = integratedCodebase;
  }, [integratedCodebase]);

  useEffect(() => {
    revisionHistoryRef.current = revisionHistory;
  }, [revisionHistory]);

  useEffect(() => {
    criticHistoryRef.current = criticHistory;
  }, [criticHistory]);

  // Sync with store state changes if updated externally
  useEffect(() => {
    if (store.integratedCodebase && !integratedCodebase) {
      setIntegratedCodebaseState(store.integratedCodebase);
      integratedCodebaseRef.current = store.integratedCodebase;
    }
  }, [store.integratedCodebase]);

  // Hydrate from store revision history if present on reload
  useEffect(() => {
    if (
      store.integrationRevisionHistory &&
      store.integrationRevisionHistory.length > 0 &&
      revisionHistory.length === 0
    ) {
      const hyd = store.integrationRevisionHistory as any as IntegrationRevisionSnapshot[];
      setRevisionHistory(hyd);
      revisionHistoryRef.current = hyd;
    }
    if (
      store.integrationCriticHistory &&
      store.integrationCriticHistory.length > 0 &&
      criticHistory.length === 0
    ) {
      setCriticHistory(store.integrationCriticHistory);
      criticHistoryRef.current = store.integrationCriticHistory;
    }
  }, [store.integrationRevisionHistory, store.integrationCriticHistory]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (revisionTimeoutRef.current) {
        clearTimeout(revisionTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Main integration pipeline orchestration function.
   * Accepts explicit targetRevCount and targetPlan to completely prevent closure staleness.
   */
  const runIntegration = useCallback(
    async (
      isRevision: boolean = false,
      targetRevCount?: number,
      targetPlan?: string | null
    ) => {
      // Clear any pending timers
      if (revisionTimeoutRef.current) {
        clearTimeout(revisionTimeoutRef.current);
        revisionTimeoutRef.current = null;
      }

      // Cancel countdowns
      session.cancelCountdown();

      setIsIntegrating(true);
      setError(null);

      const currentStore = useAppStore.getState();
      const currentMode = currentStore.mode;

      currentStore.setPipelineStatus('running');
      currentStore.setInFlightPhase('integration');
      currentStore.setStepper(5, 'loading');

      // Determine current revision count and plan with zero-staleness guarantee
      let currentRevCount = 0;
      let activePlan: string | null = null;

      if (isRevision) {
        currentRevCount =
          targetRevCount !== undefined
            ? targetRevCount
            : revisionCountRef.current || 1;
        activePlan =
          targetPlan !== undefined
            ? targetPlan
            : revisionPlanRef.current;
      } else {
        // Initial integration run: reset all revision states and refs
        currentRevCount = 0;
        activePlan = null;
        revisionCountRef.current = 0;
        revisionPlanRef.current = null;
        dynamicBudgetRef.current = 5;
        lastCompositeScoreRef.current = null;
        revisionHistoryRef.current = [];
        criticHistoryRef.current = [];

        setRevisionCount(0);
        setRevisionPlan(null);
        setDynamicBudget(5);
        setLastCompositeScore(null);
        setRevisionHistory([]);
        setActiveRevisionIndex(0);
        setCriticHistory([]);
        setActiveCriticIndex(0);
        setIsPassed(false);
        setIsEarlyStop(false);
        setIsForcedQuickMode(false);
        setIsMaxRevisions(false);
        setVerdictLabel('INTEGRATING');

        currentStore.setIntegrationRevisionInfo(0, null, 5, null);
      }

      try {
        // 1. Gather inputs from store
        const defaultRequirements: RequirementsDocument = {
          project_title: 'Integrated Project',
          overview: 'Unified integrated codebase',
          user_stories: [],
        };

        const defaultDecomposition: ComponentDecomposition = {
          is_complex: false,
          project_overview: 'Unified system',
          shared_tech_stack: [],
          shared_docker_image: 'python:3.11-slim',
          components: [],
          integration_strategy: 'Direct module integration',
        };

        const requirements: RequirementsDocument = currentStore.requirements || defaultRequirements;
        const decomposition: ComponentDecomposition = currentStore.decomposition || defaultDecomposition;
        const componentResults = currentStore.componentResults;
        const previousBase = isRevision
          ? integratedCodebaseRef.current || currentStore.integratedCodebase
          : null;

        const payload: IntegrateRequest = {
          requirements,
          decomposition,
          component_results: componentResults,
          previous_codebase: isRevision ? previousBase : null,
          revision_plan: isRevision ? activePlan : null,
          revision_count: currentRevCount,
          mode: currentMode,
          generation_mode: currentStore.generationMode || currentMode,
        };

        // 2. Call POST /api/integrate with streaming
        const intCodegenIntervalId = currentStore.startTimelineInterval({
          phase: 'integration',
          stageName: 'Integration Codebase Synthesis',
          label: currentRevCount === 0 ? 'Integration Codegen' : `Integration Codegen (Rev ${currentRevCount})`,
          revisionIndex: currentRevCount,
        });

        const parsed = await withJsonRetry(
          async () => {
            let innerText = '';
            
            await integrate(
              payload,
              {
                onChunk: (fullText) => {
                  innerText = fullText;
                },
                onReset: () => {
                  innerText = '';
                },
                onUsage: (promptTokens, candidateTokens) => {
                  session.recordTokenUsage(promptTokens, candidateTokens);
                },
              },
              { signal: session.activeAbortController?.signal }
            );
            return innerText;
          },
          (raw) => {
            const p = robustJsonParse<any>(raw);
            if (!p) {
              throw new Error('Failed to parse integration response JSON from server.');
            }
            if (p.error && !p.files && !p.modified_files) {
              if (p.json_parse_failure) throw new JsonParseExhaustedError(p.error, 'INTEGRATION', p.attempts);
              throw new Error(p.error);
            }
            return p;
          },
          {
            phaseName: 'INTEGRATION',
            onRetryAttempt: (attempt, max) => {
              useAppStore.getState().setJsonRetryState({
                isRetrying: true,
                currentAttempt: attempt,
                maxAttempts: max,
                phaseName: 'INTEGRATION',
                usingFallback: attempt > 3,
              });
            }
          }
        );
        useAppStore.getState().setJsonRetryState(null);

        const mergedCodebase = mergeDifferentialCodebase(previousBase, parsed);
        setIntegratedCodebaseState(mergedCodebase);
        integratedCodebaseRef.current = mergedCodebase;
        currentStore.setIntegratedCodebase(mergedCodebase);
        currentStore.setCurrentCodebase(mergedCodebase);
        currentStore.completeTimelineInterval(intCodegenIntervalId, { status: 'completed' });

        // 4. Detect dynamic test runner and synthesize blueprint
        const dynamicRunner = detectDynamicTestRunner(mergedCodebase, decomposition);
        const unifiedBlueprint = createIntegratedBlueprint(
          mergedCodebase,
          decomposition,
          dynamicRunner.runnerCommand
        );
        currentStore.setCurrentBlueprint(unifiedBlueprint);

        // Initialize snapshot
        const snapshot: IntegrationRevisionSnapshot = {
          codebase: JSON.parse(JSON.stringify(mergedCodebase)),
          blueprint: unifiedBlueprint,
          executionResult: null,
          feedbacks: [],
          decision: null,
          compositeScore: null,
          label: currentRevCount === 0 ? 'Initial' : `Rev ${currentRevCount}`,
        };

        setRevisionHistory((prev) => {
          const next = [...prev];
          next[currentRevCount] = snapshot;
          revisionHistoryRef.current = next;
          return next;
        });
        setActiveRevisionIndex(currentRevCount);

        setIsIntegrating(false);

        // 5. Execute sandbox tests via POST /api/execute-code
        setIsExecutingCode(true);
        const intExecIntervalId = currentStore.startTimelineInterval({
          phase: 'execution',
          stageName: 'Integration Sandbox Execution',
          label: currentRevCount === 0 ? 'Integration Execution' : `Integration Execution (Rev ${currentRevCount})`,
          revisionIndex: currentRevCount,
        });

        const execRes = await executeCode({
          codebase: mergedCodebase,
          blueprint: unifiedBlueprint,
        });

        setCurrentExecutionResult(execRes);
        currentStore.setExecutionResult(execRes);
        snapshot.executionResult = execRes;
        setIsExecutingCode(false);
        currentStore.completeTimelineInterval(intExecIntervalId, {
          status: execRes.success ? 'passed' : 'failed',
        });

        // 6. Run critics evaluation via POST /api/run-critics
        setIsEvaluatingCritics(true);
        const intCriticsIntervalId = currentStore.startTimelineInterval({
          phase: 'critics',
          stageName: 'Integration Critics & Arbitration',
          label: currentRevCount === 0 ? 'Integration Critics' : `Integration Critics (Rev ${currentRevCount})`,
          revisionIndex: currentRevCount,
        });

        const currentCriticIdx = currentRevCount;
        const initialCriticEntry: IntegrationCriticEntry = {
          exec: execRes,
          feedbacks: [],
          decision: null,
          loading: true,
          error: null,
        };

        setCriticHistory((prev) => {
          const next = [...prev];
          next[currentCriticIdx] = initialCriticEntry;
          criticHistoryRef.current = next;
          return next;
        });
        setActiveCriticIndex(currentCriticIdx);

        const criticsRes = await runCritics({
          requirements,
          blueprint: unifiedBlueprint,
          codebase: mergedCodebase,
          execution_result: execRes,
          master_decomposition: decomposition,
          component_name: 'Integration',
          component_id: 'integration',
          phase: 'integration',
          stage: 'INTEGRATION',
          revision_count: currentRevCount,
          mode: currentMode,
          generation_mode: currentMode,
          previous_composite: lastCompositeScoreRef.current,
        });

        const feedbacks = criticsRes.feedbacks || [];
        const decision = criticsRes.decision || null;

        snapshot.feedbacks = feedbacks;
        snapshot.decision = decision;

        // 7. Calculate composite score: (score_corr * 0.5) + (score_arch * 0.2) + (score_comp * 0.3)
        let score_corr = 0;
        let score_arch = 0;
        let score_comp = 0;

        for (const fb of feedbacks) {
          const name = (fb.critic_name || '').toLowerCase();
          if (name.includes('correctness')) score_corr = fb.severity_score;
          else if (name.includes('architecture')) score_arch = fb.severity_score;
          else if (name.includes('completeness')) score_comp = fb.severity_score;
        }

        const calculatedScore = (score_corr * 0.5) + (score_arch * 0.2) + (score_comp * 0.3);
        const currentComposite =
          decision?.weighted_composite !== undefined && decision?.weighted_composite !== null
            ? decision.weighted_composite
            : Math.round(calculatedScore * 100) / 100;

        snapshot.compositeScore = currentComposite;
        setCompositeScore(currentComposite);
        lastCompositeScoreRef.current = currentComposite;

        // Early stop delta check: delta <= 1.0
        const computedDelta =
          lastCompositeScoreRef.current !== null && lastCompositeScoreRef.current !== currentComposite
            ? lastCompositeScoreRef.current - currentComposite
            : (decision?.delta ?? null);

        const isEarlyStopDelta = Boolean(
          decision?.early_stop || (computedDelta !== null && computedDelta <= 1.0)
        );

        // Auto-pass if composite <= 2.0
        const isAutoPass = currentComposite <= 2.0;

        // Standard budget for integration phase is strictly up to 5 revisions
        const calculatedBudget = Math.min(5, Math.max(1, decision?.dynamic_budget ?? 5));

        const activeBudget = calculatedBudget;
        setDynamicBudget(activeBudget);
        dynamicBudgetRef.current = activeBudget;

        const rawVerdict = (decision?.verdict || '').toLowerCase();
        const passedCondition = isEarlyStopDelta || isAutoPass || rawVerdict === 'pass';

        currentStore.completeTimelineInterval(intCriticsIntervalId, {
          status: passedCondition ? 'passed' : 'revised',
          details: `Composite: ${currentComposite.toFixed(2)}, Verdict: ${rawVerdict}`,
        });

        // Update critic history entry
        const finalCriticEntry: IntegrationCriticEntry = {
          exec: execRes,
          feedbacks,
          decision,
          loading: false,
          error: null,
        };

        setCriticHistory((prev) => {
          const updated = [...prev];
          updated[currentCriticIdx] = finalCriticEntry;
          criticHistoryRef.current = updated;
          return updated;
        });

        // Update completed snapshot in revision history
        setRevisionHistory((prev) => {
          const updated = [...prev];
          updated[currentRevCount] = snapshot;
          revisionHistoryRef.current = updated;
          return updated;
        });

        // Synchronize with persistent Zustand store
        currentStore.addIntegrationRevision({
          revisionNumber: currentRevCount,
          label: snapshot.label || (currentRevCount === 0 ? 'Initial' : `Rev ${currentRevCount}`),
          timestamp: Date.now(),
          codebase: mergedCodebase,
          blueprint: unifiedBlueprint,
          executionResult: execRes,
          criticFeedbacks: feedbacks,
          decision,
          compositeScore: currentComposite,
        });
        currentStore.setIntegrationActiveRevisionIndex(currentRevCount);
        currentStore.addIntegrationCriticEvaluation(feedbacks, decision);
        currentStore.setIntegrationActiveCriticIndex(currentRevCount);

        setIsEvaluatingCritics(false);

        // 8. Revision loop arbitration branching
        if (passedCondition) {
          // Passed branch
          setIsPassed(true);
          setIsEarlyStop(isEarlyStopDelta);
          const finalLabel = isEarlyStopDelta ? 'PASSED (EARLY STOP)' : 'PASS';
          setVerdictLabel(finalLabel);

          currentStore.setIntegrationRevisionInfo(
            currentRevCount,
            null,
            activeBudget,
            currentComposite
          );
          currentStore.setStepper(5, 'success');
          currentStore.setInFlightPhase('documentation');
          persistState(true);

          try {
            const finalCode = await generateDocumentationPhase({
              codebase: mergedCodebase,
            });
            setIntegratedCodebaseState(finalCode);
            integratedCodebaseRef.current = finalCode;
            currentStore.setIntegratedCodebase(finalCode);
            currentStore.setCurrentCodebase(finalCode);
          } catch (docErr) {
            console.error('[IntegrationRunner] Auto doc generation error:', docErr);
          } finally {
            currentStore.setPipelineStatus('completed');
            currentStore.setInFlightPhase(null);
            persistState(true);
          }
        } else {
          // Rejection / Revision required branch
          const nextRevPlan =
            decision?.revision_plan || 'Adjudicator requested fixes for integration issues.';
          setRevisionPlan(nextRevPlan);
          revisionPlanRef.current = nextRevPlan;

          if (currentRevCount < activeBudget) {
            // Budget remains: Schedule next revision
            const nextCount = currentRevCount + 1;
            setRevisionCount(nextCount);
            revisionCountRef.current = nextCount;
            setLastCompositeScore(currentComposite);
            lastCompositeScoreRef.current = currentComposite;
            setVerdictLabel(`REVISION ${nextCount}/${activeBudget}`);

            currentStore.setIntegrationRevisionInfo(
              nextCount,
              nextRevPlan,
              activeBudget,
              currentComposite
            );
            currentStore.setInFlightPhase('integration');
            persistState(true);

            revisionTimeoutRef.current = setTimeout(() => {
              if (useAppStore.getState().isPaused) return; // <-- PAUSE GUARD
              runIntegration(true, nextCount, nextRevPlan);
            }, 1500);
          } else {
            // Budget exhausted: Forced pass
            setIsPassed(true);
            setIsForcedQuickMode(true);
            setIsMaxRevisions(true);
            setVerdictLabel('PASSED (MAX REVISIONS)');

            currentStore.setIntegrationRevisionInfo(
              currentRevCount,
              nextRevPlan,
              activeBudget,
              currentComposite
            );
            currentStore.setStepper(5, 'success');
            currentStore.setInFlightPhase('documentation');
            persistState(true);

            try {
              const finalCode = await generateDocumentationPhase({
                codebase: mergedCodebase,
              });
              setIntegratedCodebaseState(finalCode);
              integratedCodebaseRef.current = finalCode;
              currentStore.setIntegratedCodebase(finalCode);
              currentStore.setCurrentCodebase(finalCode);
            } catch (docErr) {
              console.error('[IntegrationRunner] Auto doc generation error:', docErr);
            } finally {
              currentStore.setPipelineStatus('completed');
              currentStore.setInFlightPhase(null);
              persistState(true);
            }
          }
        }
      } catch (err: any) {
        useAppStore.getState().setJsonRetryState(null);
        if (err instanceof JsonParseExhaustedError) {
          setError(err.message);
          setIsIntegrating(false);
          setIsExecutingCode(false);
          currentStore.setPipelineStatus('idle');
          return;
        }
        if (err.name === 'AbortError' || currentStore.pipelineStatus === 'aborted') {
          return;
        }
        const errMsg = err.message || 'Integration phase encountered an unexpected error.';
        setError(errMsg);
        setIsIntegrating(false);
        setIsExecutingCode(false);
        setIsEvaluatingCritics(false);

        // Force proceed on error
        setIsPassed(true);
        setIsForcedQuickMode(true);
        setVerdictLabel('PASSED (FORCED)');
        currentStore.setStepper(5, 'success');
        currentStore.setInFlightPhase('documentation');
        persistState(true);

        try {
          const activeCode = currentStore.integratedCodebase || currentStore.currentCodebase;
          if (activeCode) {
            const finalCode = await generateDocumentationPhase({ codebase: activeCode });
            setIntegratedCodebaseState(finalCode);
            integratedCodebaseRef.current = finalCode;
            currentStore.setIntegratedCodebase(finalCode);
            currentStore.setCurrentCodebase(finalCode);
          }
        } catch (docErr) {
          console.error('[IntegrationRunner] Fallback doc generation error:', docErr);
        } finally {
          currentStore.setPipelineStatus('completed');
          currentStore.setInFlightPhase(null);
          persistState(true);
        }
      }
    },
    [session]
  );

  /**
   * Triggers client-side ZIP packaging and download of the integrated codebase.
   */
  const downloadZip = useCallback(async () => {
    const currentCodebase =
      integratedCodebaseRef.current ||
      integratedCodebase ||
      useAppStore.getState().integratedCodebase ||
      useAppStore.getState().currentCodebase;
    const requirements = useAppStore.getState().requirements;
    await downloadIntegratedZip(currentCodebase, requirements);
    useAppStore.getState().setStepper(5, 'success');
  }, [integratedCodebase]);

  /**
   * Manual force approve for COMPLEX mode.
   */
  const forceApprove = useCallback(async () => {
    if (revisionTimeoutRef.current) {
      clearTimeout(revisionTimeoutRef.current);
      revisionTimeoutRef.current = null;
    }
    setIsPassed(true);
    setVerdictLabel('APPROVED (MANUAL)');
    const currentStore = useAppStore.getState();
    currentStore.setStepper(5, 'success');
    currentStore.setInFlightPhase('documentation');
    persistState(true);

    try {
      const activeCode = currentStore.integratedCodebase || currentStore.currentCodebase;
      if (activeCode) {
        const finalCode = await generateDocumentationPhase({ codebase: activeCode });
        setIntegratedCodebaseState(finalCode);
        integratedCodebaseRef.current = finalCode;
        currentStore.setIntegratedCodebase(finalCode);
        currentStore.setCurrentCodebase(finalCode);
      }
    } catch (docErr) {
      console.error('[IntegrationRunner] Manual approve doc generation error:', docErr);
    } finally {
      currentStore.setPipelineStatus('completed');
      currentStore.setInFlightPhase(null);
      persistState(true);
    }
  }, []);

  /**
   * Selects active file in Monaco editor.
   */
  const selectFile = useCallback((index: number) => {
    setActiveFileIndex(index);
    useAppStore.getState().setActiveFileIndex(index);
  }, []);

  /**
   * Switches active revision tab, updating code editor, active file,
   * sandbox execution logs, and critic cards to that revision.
   */
  const selectRevision = useCallback((index: number) => {
    const history = revisionHistoryRef.current;
    if (history && history[index]) {
      setActiveRevisionIndex(index);
      const selectedSnapshot = history[index];

      // 1. Update integrated codebase & Monaco view
      setIntegratedCodebaseState(selectedSnapshot.codebase);
      useAppStore.getState().setIntegratedCodebase(selectedSnapshot.codebase);

      // 2. Synchronize execution result and logs to that revision
      if (selectedSnapshot.executionResult) {
        setCurrentExecutionResult(selectedSnapshot.executionResult);
        useAppStore.getState().setExecutionResult(selectedSnapshot.executionResult);
      }

      // 3. Synchronize active critic tab so logs, cards, and verdict match
      setActiveCriticIndex(index);
      useAppStore.getState().setIntegrationActiveRevisionIndex(index);
      useAppStore.getState().setIntegrationActiveCriticIndex(index);

      // 4. Reset active file index to first file of selected revision
      if (selectedSnapshot.codebase?.files && selectedSnapshot.codebase.files.length > 0) {
        setActiveFileIndex(0);
        useAppStore.getState().setActiveFileIndex(0);
      }
    }
  }, []);

  /**
   * Switches active critic history tab and syncs execution result.
   */
  const selectCriticTab = useCallback((index: number) => {
    setActiveCriticIndex(index);
    useAppStore.getState().setIntegrationActiveCriticIndex(index);

    const critics = criticHistoryRef.current;
    if (critics && critics[index]?.exec) {
      setCurrentExecutionResult(critics[index].exec);
      useAppStore.getState().setExecutionResult(critics[index].exec);
    }
  }, []);

  /**
   * Toggles side-by-side diff view.
   */
  const toggleDiffMode = useCallback(() => {
    setIsDiffMode((prev) => {
      const next = !prev;
      useAppStore.getState().setIsDiffMode(next);
      return next;
    });
  }, []);

  /**
   * Updates file content when user edits code in COMPLEX mode.
   */
  const updateFileContent = useCallback((fileName: string, newCode: string) => {
    setIntegratedCodebaseState((prev) => {
      if (!prev || !prev.files) return prev;
      const updatedFiles = prev.files.map((f) =>
        f.file_name.toLowerCase() === fileName.toLowerCase()
          ? { ...f, source_code: newCode }
          : f
      );
      const nextCodebase = { files: updatedFiles };
      integratedCodebaseRef.current = nextCodebase;
      useAppStore.getState().updateCodeFile(fileName, newCode);
      useAppStore.getState().setIntegratedCodebase(nextCodebase);
      return nextCodebase;
    });
  }, []);

  return {
    // Status
    isIntegrating,
    isExecutingCode,
    isEvaluatingCritics,
    isLoopActive: isIntegrating || isExecutingCode || isEvaluatingCritics,
    error,

    // Code & Results
    integratedCodebase,
    currentExecutionResult,

    // Revisions
    revisionCount,
    revisionPlan,
    dynamicBudget,
    compositeScore,
    lastCompositeScore,
    revisionHistory,
    activeRevisionIndex,

    // Critics
    criticHistory,
    activeCriticIndex,

    // Editor view state
    activeFileIndex,
    isDiffMode,

    // Verdict
    isPassed,
    isEarlyStop,
    isForcedQuickMode,
    isMaxRevisions,
    verdictLabel,

    // Actions
    runIntegration,
    selectFile,
    selectRevision,
    selectCriticTab,
    toggleDiffMode,
    updateFileContent,
    downloadZip,
    forceApprove,
  };
}

export default useIntegrationRunner;
