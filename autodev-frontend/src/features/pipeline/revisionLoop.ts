/**
 * AutoDev Single-Pass Revision Loop State Machine & Calculations
 * 
 * Implements Milestone 3 R4:
 * - Dynamic revision budgeting based on Hybrid Approach (Proposal E)
 * - Weighted severity composite: Correctness 50%, Architecture 20%, Completeness 30%
 * - Auto-pass if composite <= 2.0
 * - Dynamic budget calculation: min(5, Math.ceil(composite / 3))
 * - Early stop delta check: delta <= 1.0 (diminishing returns)
 * - Self-correction cycle: executeCode -> runCritics -> Adjudicator decision ->
 *   if rejected & budget remains -> generateCode(isRevision=true) -> executeCode -> runCritics
 * - QUICK mode termination: skips documentation, forces pass if retries exhausted,
 *   enables final download, reveals post-completion
 * - COMPLEX mode termination: MAX REVISIONS display, reveals documentation countdown,
 *   reveals post-completion
 */

import { executeCode as apiExecuteCode, runCritics as apiRunCritics, generateDocumentation as apiGenerateDocs } from '../../api/endpoints';
import { useAppStore } from '../../stores/appStore';
import { useSessionStore } from '../../stores/sessionStore';
import { persistState } from '../../stores';
import { safeJsonParse } from '../../utils/jsonParser';
import { withJsonRetry, JsonParseExhaustedError } from '../../utils/jsonRetry';
import type {
  AppMode,
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
  GeneratedCodeBase,
  SystemDesignBlueprint,
  RequirementsDocument,
} from '../../types';

/**
 * Calculates weighted composite severity score (0 to 10 scale).
 * Weights: Correctness 50%, Architecture 20%, Completeness 30%.
 */
export function calculateCompositeScore(
  correctness: number,
  architecture: number = 0,
  completeness: number = 0
): number {
  const c = Math.max(0, Math.min(10, correctness));
  const a = Math.max(0, Math.min(10, architecture));
  const comp = Math.max(0, Math.min(10, completeness));
  const score = (c * 0.5) + (a * 0.2) + (comp * 0.3);
  return Math.round(score * 100) / 100;
}

/**
 * Calculates dynamic revision budget: min(5, Math.ceil(composite / 3)).
 * Minimum budget is 1, maximum is 5.
 */
export function calculateDynamicBudget(compositeScore: number | null | undefined): number {
  if (compositeScore === null || compositeScore === undefined || isNaN(compositeScore)) {
    return 3;
  }
  if (compositeScore <= 0) return 1;
  const budget = Math.min(5, Math.max(1, Math.ceil(compositeScore / 3)));
  return budget;
}

/**
 * Checks if early stop should be triggered due to diminishing returns.
 * If delta improvement <= 1.0, further revisions yield marginal gain.
 */
export function isEarlyStopDelta(delta: number | null | undefined): boolean {
  if (delta === null || delta === undefined || isNaN(delta)) {
    return false;
  }
  return delta <= 1.0;
}

export interface AdjudicationEvaluationResult {
  isPassed: boolean;
  isEarlyStop: boolean;
  isForcedQuickMode: boolean;
  isMaxRevisions: boolean;
  shouldRetry: boolean;
  isLoopFinished: boolean;
  maxRevs: number;
  verdictLabel: string;
  verdictStatus: 'pass' | 'revise' | 'early_stop' | 'forced_quick' | 'max_revisions' | 'error';
}

/**
 * Pure state machine evaluator for an adjudicator decision given mode and revision count.
 */
export function evaluateAdjudicationDecision(
  decision: AdjudicatorDecision | null | undefined,
  mode: AppMode = 'QUICK',
  currentRevisionCount: number = 0,
  fallbackDynamicBudget?: number | null
): AdjudicationEvaluationResult {
  const isQuickMode = mode === 'QUICK';
  // Standard in pipeline phase is 3 revisions
  const defaultRevs = (decision?.dynamic_budget ?? null) ? decision!.dynamic_budget! : 3;

  const maxRevs = decision?.dynamic_budget ?? fallbackDynamicBudget ?? defaultRevs;
  const rawVerdict = (decision?.verdict || '').toLowerCase();
  
  const isEarlyStop = Boolean(
    decision?.early_stop ||
    (decision?.delta !== null && decision?.delta !== undefined && isEarlyStopDelta(decision.delta))
  );

  const autoPassScore = decision?.weighted_composite !== null && decision?.weighted_composite !== undefined && decision.weighted_composite <= 2.0;
  const isPassed = rawVerdict === 'pass' || isEarlyStop || autoPassScore;

  const isRevisionsExhausted = currentRevisionCount >= maxRevs;
  const isLoopFinished = isPassed || isRevisionsExhausted || (!isQuickMode && rawVerdict === 'error');

  const isForcedQuickMode = isQuickMode && isLoopFinished && !isPassed;
  const isMaxRevisions = !isQuickMode && isLoopFinished && !isPassed && isRevisionsExhausted;

  const shouldRetry = !isLoopFinished && !isEarlyStop && (
    (isQuickMode && !isPassed) ||
    (!isQuickMode && rawVerdict === 'revise')
  ) && (currentRevisionCount < maxRevs);

  let verdictLabel = rawVerdict.toUpperCase();
  let verdictStatus: AdjudicationEvaluationResult['verdictStatus'] = 'pass';

  if (isEarlyStop) {
    verdictLabel = 'PASSED (EARLY STOP)';
    verdictStatus = 'early_stop';
  } else if (isForcedQuickMode) {
    verdictLabel = 'PASSED (FORCED QUICK MODE)';
    verdictStatus = 'forced_quick';
  } else if (isMaxRevisions) {
    verdictLabel = `MAX REVISIONS (${maxRevs}/${maxRevs})`;
    verdictStatus = 'max_revisions';
  } else if (isPassed) {
    verdictLabel = 'PASS';
    verdictStatus = 'pass';
  } else if (rawVerdict === 'revise') {
    verdictLabel = currentRevisionCount > 0
      ? `REVISE (Attempt ${currentRevisionCount}/${maxRevs})`
      : 'REVISE';
    verdictStatus = 'revise';
  } else {
    verdictLabel = 'ERROR';
    verdictStatus = 'error';
  }

  return {
    isPassed: isPassed || isForcedQuickMode,
    isEarlyStop,
    isForcedQuickMode,
    isMaxRevisions,
    shouldRetry,
    isLoopFinished,
    maxRevs,
    verdictLabel,
    verdictStatus,
  };
}

export interface RunExecutionOptions {
  codebase?: GeneratedCodeBase | null;
  blueprint?: SystemDesignBlueprint | null;
  mode?: AppMode;
  autoAdvance?: boolean;
}

/**
 * Executes tests in the sandbox container via POST /api/execute-code
 * and synchronizes app and session stores.
 */
export async function executeSandboxCode(options?: RunExecutionOptions): Promise<ExecutionResult> {
  const store = useAppStore.getState();
  const session = useSessionStore.getState();

  session.cancelCountdown();

  const currentCodebase = options?.codebase ?? store.currentCodebase;
  const currentBlueprint = options?.blueprint ?? store.currentBlueprint;
  const mode = options?.mode ?? store.mode;

  if (!currentCodebase) {
    throw new Error('Missing codebase for sandbox execution.');
  }

  store.setInFlightPhase('single_execution');
  store.setPipelineStatus('running');
  store.setStepper(4, 'loading');
  persistState(true);

  const execIntervalId = store.startTimelineInterval({
    phase: 'execution',
    stageName: 'Single-Pass Sandbox Execution',
    label: store.currentRevisionCount === 0 ? 'Sandbox Execution' : `Sandbox Execution (Rev ${store.currentRevisionCount})`,
    revisionIndex: store.currentRevisionCount,
  });

  try {
    const result = await apiExecuteCode({
      codebase: currentCodebase,
      blueprint: currentBlueprint as any,
      mode,
    });

    store.setExecutionResult(result);
    store.setStepper(4, result.success ? 'success' : 'error');
    store.snapshotRevision(
      store.currentRevisionCount === 0
        ? 'Rev 0 (Initial)'
        : `Rev ${store.currentRevisionCount}`
    );

    store.setInFlightPhase('single_critics');
    useAppStore.getState().completeTimelineInterval(execIntervalId, {
      status: result.success ? 'passed' : 'failed',
    });
    persistState(true);

    // Auto-advance to critics evaluation after every execution pass
    // (legacy code always chained executeCode → runCritics)
    if (options?.autoAdvance !== false) {
      setTimeout(() => {
        if (useAppStore.getState().isPaused) return; // <-- PAUSE GUARD
        runCriticsEvaluation({ mode }).catch(console.error);
      }, 100);
    }

    return result;
  } catch (err: any) {
    store.setJsonRetryState(null);
    useAppStore.getState().completeTimelineInterval(execIntervalId, { status: 'failed' });
    if (err instanceof JsonParseExhaustedError) {
      console.error('[Documentation] JSON Parse Exhausted:', err);
      store.setPipelineStatus('idle');
      store.setInFlightPhase(null);
      persistState(true);
      throw err;
    }
    if (err.name === 'AbortError' || store.pipelineStatus === 'aborted') {
      console.log('[AutoDev] Sandbox execution aborted cleanly.');
      throw err;
    }
    store.setStepper(4, 'error');
    store.setInFlightPhase(null);
    persistState(true);
    throw err;
  }
}

export interface RunCriticsOptions {
  requirements?: RequirementsDocument | null;
  blueprint?: SystemDesignBlueprint | null;
  codebase?: GeneratedCodeBase | null;
  executionResult?: ExecutionResult | null;
  mode?: AppMode;
  onRevisionTrigger?: (revCount: number, plan: string) => Promise<void>;
  gracePeriodMs?: number;
}

/**
 * Runs critics evaluation and adjudicates the revision loop step.
 */
export async function runCriticsEvaluation(
  options?: RunCriticsOptions
): Promise<{ feedbacks: CriticFeedback[]; decision: AdjudicatorDecision; evalResult: AdjudicationEvaluationResult }> {
  const store = useAppStore.getState();
  const session = useSessionStore.getState();

  session.cancelCountdown();

  const requirements = options?.requirements ?? store.requirements;
  const blueprint = options?.blueprint ?? store.currentBlueprint;
  const codebase = options?.codebase ?? store.currentCodebase;
  const executionResult = options?.executionResult ?? store.currentExecutionResult;
  const mode = options?.mode ?? store.mode;

  if (!requirements || !blueprint || !codebase || !executionResult) {
    throw new Error('Missing prerequisite phase data for critics evaluation.');
  }

  store.setInFlightPhase('single_critics');
  store.setPipelineStatus('running');
  store.setStepper(5, 'loading');
  persistState(true);

  const criticsIntervalId = store.startTimelineInterval({
    phase: 'critics',
    stageName: 'Single-Pass Critics & Arbitration',
    label: store.currentRevisionCount === 0 ? 'Critics & Arbitration' : `Critics & Arbitration (Rev ${store.currentRevisionCount})`,
    revisionIndex: store.currentRevisionCount,
  });

  try {
    const data = await apiRunCritics({
      requirements,
      blueprint,
      codebase,
      execution_result: executionResult,
      master_decomposition: store.decomposition,
      revision_count: store.currentRevisionCount,
      mode,
      generation_mode: mode,
      previous_composite: store.currentCompositeScore,
    });

    const feedbacks = data.feedbacks || [];
    const decision = data.decision;

    // Update store state
    store.setCriticEvaluations(feedbacks);
    if (decision) {
      store.addAdjudicatorDecision(decision);

      if (decision.weighted_composite !== undefined && decision.weighted_composite !== null) {
        store.setCompositeScore(decision.weighted_composite);
      }
      if (decision.dynamic_budget) {
        store.setDynamicBudget(decision.dynamic_budget);
      }
      if (decision.revision_plan) {
        store.setRevisionPlan(decision.revision_plan);
      }
    }

    const evalResult = evaluateAdjudicationDecision(
      decision,
      mode,
      store.currentRevisionCount,
      store.currentDynamicBudget
    );

    // Update revision history snapshot with evaluation metadata
    const activeIdx = store.revisionHistory.length > 0 ? store.revisionHistory.length - 1 : 0;
    store.updateRevisionMeta(activeIdx, feedbacks, decision);

    store.completeTimelineInterval(criticsIntervalId, {
      status: evalResult.isPassed ? 'passed' : 'revised',
      details: `Verdict: ${evalResult.verdictLabel}`,
    });

    if (evalResult.isLoopFinished) {
      store.setStepper(5, 'success');
      store.setInFlightPhase('documentation');
      persistState(true);

      try {
        await generateDocumentationPhase();
      } catch (docErr) {
        console.error('[RevisionLoop] Automatic doc generation error:', docErr);
      } finally {
        store.setPipelineStatus('completed');
        store.setInFlightPhase(null);
        persistState(true);
      }
    } else if (evalResult.shouldRetry) {
      // Trigger self-correction revision cycle
      const nextRevCount = store.currentRevisionCount + 1;
      store.setRevisionCount(nextRevCount);
      store.setRevisionPlan(decision?.revision_plan || '');
      store.setInFlightPhase('single_codegen');
      persistState(true);

      const delay = options?.gracePeriodMs ?? 3000;
      setTimeout(async () => {
        if (useAppStore.getState().isPaused) return; // <-- PAUSE GUARD
        try {
          if (options?.onRevisionTrigger) {
            await options.onRevisionTrigger(nextRevCount, decision?.revision_plan || '');
          }
        } catch (loopErr) {
          console.error('[RevisionLoop] Self-correction cycle error:', loopErr);
        }
      }, delay);
    }

    return { feedbacks, decision, evalResult };
  } catch (err: any) {
    store.setJsonRetryState(null);
    store.completeTimelineInterval(criticsIntervalId, { status: 'failed' });
    if (err instanceof JsonParseExhaustedError) {
      console.error('[Documentation] JSON Parse Exhausted:', err);
      store.setPipelineStatus('idle');
      store.setInFlightPhase(null);
      persistState(true);
      throw err;
    }
    if (err.name === 'AbortError' || store.pipelineStatus === 'aborted') {
      console.log('[AutoDev] Critics evaluation aborted cleanly.');
      throw err;
    }

    // Standard resilience: auto-retry or force pass after 3 revisions
    const maxCatchRevs = store.currentDynamicBudget || 3;
    if (store.currentRevisionCount < maxCatchRevs) {
      const nextRevCount = store.currentRevisionCount + 1;
      store.setRevisionCount(nextRevCount);
      store.setInFlightPhase('single_codegen');
      persistState(true);

      const delay = options?.gracePeriodMs ?? 2000;
      setTimeout(async () => {
        if (useAppStore.getState().isPaused) return; // <-- PAUSE GUARD
        try {
          if (options?.onRevisionTrigger) {
            await options.onRevisionTrigger(nextRevCount, 'Auto-retry after critic exception');
          }
        } catch (retryErr) {
          console.error('[RevisionLoop] Retry error:', retryErr);
        }
      }, delay);
      throw err;
    } else {
      // Retries exhausted -> force pass
      store.setRevisionCount(maxCatchRevs);
      const forcedDecision: AdjudicatorDecision = {
        verdict: 'pass',
        revision_plan: `Forced proceed after ${maxCatchRevs} retries.\n${err.message}`,
        weighted_composite: 2.0,
        dynamic_budget: maxCatchRevs,
        early_stop: true,
      };
      store.addAdjudicatorDecision(forcedDecision);
      store.setStepper(5, 'success');
      store.setInFlightPhase('documentation');
      persistState(true);

      try {
        await generateDocumentationPhase();
      } catch (docErr) {
        console.error('[RevisionLoop] Fallback doc generation error:', docErr);
      } finally {
        store.setPipelineStatus('completed');
        store.setInFlightPhase(null);
        persistState(true);
      }

      const evalResult = evaluateAdjudicationDecision(forcedDecision, mode, maxCatchRevs);
      return { feedbacks: [], decision: forcedDecision, evalResult };
    }

    store.setStepper(5, 'error');
    persistState(true);
    throw err;
  }
}

export interface GenerateDocsOptions {
  requirements?: RequirementsDocument | null;
  blueprint?: SystemDesignBlueprint | null;
  codebase?: GeneratedCodeBase | null;
  mode?: AppMode;
}

/**
 * Phase 3.5: Generates documentation (README.md, ARCHITECTURE.md) and injects into codebase.
 */
/**
 * Helper to generate a fallback README.md if the LLM doc stream fails or omits it.
 */
export function createFallbackReadme(
  requirements?: RequirementsDocument | null,
  codebase?: GeneratedCodeBase | null
): { file_name: string; source_code: string } {
  const title = requirements?.project_title || 'AutoDev Project';
  const overview = requirements?.overview || 'Autonomously generated full-stack software application.';
  let content = `# ${title}\n\n${overview}\n\n## Overview\nThis project was built autonomously by the AutoDev Multi-Agent System.\n\n## Project Structure\n`;
  if (codebase?.files && codebase.files.length > 0) {
    codebase.files.forEach((f) => {
      content += `- \`${f.file_name}\`\n`;
    });
  } else {
    content += `- Application source files\n`;
  }
  content += `\n## Getting Started\n\n### Prerequisites\n- Node.js (v18+) or Python (3.11+) as appropriate for the stack.\n\n### Installation\nInstall required dependencies using your package manager:\n\`\`\`bash\nnpm install\n# or\npip install -r requirements.txt\n\`\`\`\n\n### Running the Application\nFollow the instructions in the project root to start the development server.\n\n## Testing\nExecute the test runner suite:\n\`\`\`bash\nnpm test\n# or\npytest\n\`\`\`\n`;
  return { file_name: 'README.md', source_code: content };
}

/**
 * Helper to generate a fallback USER_GUIDE.md if the LLM doc stream fails or omits it.
 */
export function createFallbackUserGuide(
  requirements?: RequirementsDocument | null
): { file_name: string; source_code: string } {
  const title = requirements?.project_title || 'AutoDev Project';
  const overview = requirements?.overview || 'Application overview and functional capabilities.';
  let content = `# ${title} - User Guide\n\n## Overview\n${overview}\n\n## Usage Instructions\n`;
  if (requirements?.user_stories && requirements.user_stories.length > 0) {
    requirements.user_stories.forEach((story, idx) => {
      content += `\n### Feature ${idx + 1}: ${story.title}\n**Story**: As a ${story.as_a}, I want to ${story.i_want_to} so that ${story.so_that}.\n\n`;
      if (story.acceptance_criteria && story.acceptance_criteria.length > 0) {
        content += `**Acceptance Criteria**:\n`;
        story.acceptance_criteria.forEach((ac) => {
          content += `- **${ac.description}**: ${ac.expected_behavior}\n`;
        });
      }
    });
  } else {
    content += `\n### 1. Interacting with the Application\nLaunch the local server and navigate to the application endpoint in your browser or client.\n`;
  }
  return { file_name: 'USER_GUIDE.md', source_code: content };
}

/**
 * Helper to generate both README.md and USER_GUIDE.md fallback documents.
 */
export function createFallbackDocFiles(
  requirements?: RequirementsDocument | null,
  codebase?: GeneratedCodeBase | null
): Array<{ file_name: string; source_code: string }> {
  return [
    createFallbackReadme(requirements, codebase),
    createFallbackUserGuide(requirements),
  ];
}

export async function generateDocumentationPhase(
  options?: GenerateDocsOptions
): Promise<GeneratedCodeBase> {
  const store = useAppStore.getState();
  const session = useSessionStore.getState();

  session.cancelCountdown();

  const requirements = options?.requirements ?? store.requirements;
  const codebase = options?.codebase ?? store.integratedCodebase ?? store.currentCodebase;
  const blueprint =
    options?.blueprint ??
    store.currentBlueprint ??
    (requirements
      ? {
          architecture_overview: requirements.overview || 'System Architecture',
          tech_stack: ['Fullstack'],
          docker_image: 'python:3.11-slim',
          dev_server_command: 'NONE',
          dev_server_port: 0,
          run_tests_command: 'NONE',
          files: [],
        }
      : null);
  const mode = options?.mode ?? store.mode;

  if (!requirements || !blueprint || !codebase || !codebase.files) {
    throw new Error('Missing prerequisite data for documentation generation.');
  }

  store.setInFlightPhase('documentation');
  store.setPipelineStatus('running');
  persistState(true);

  const docIntervalId = store.startTimelineInterval({
    phase: 'documentation',
    stageName: 'Documentation Generation',
    label: 'Documentation (README & User Guide)',
  });

  try {
    const parsedObj = await withJsonRetry(
      async (opts) => {
        let text = '';
        const streamResult = await apiGenerateDocs(
          {
            requirements,
            blueprint,
            codebase,
            mode,
            generation_mode: mode,
            model: opts?.model,
          } as any,
          {
            onChunk: (accumulated) => {
              text = accumulated;
            },
            onReset: () => {
              text = '';
            }
          }
        );
        return streamResult?.cleanedText || text;
      },
      (raw) => {
        const p = safeJsonParse(raw) as any;
        if (p && p.error) {
           if (p.json_parse_failure) throw new JsonParseExhaustedError(p.error, 'DOCUMENTATION', p.attempts);
        }
        return p;
      },
      {
        phaseName: 'DOCUMENTATION',
        onRetryAttempt: (attempt, max) => {
          store.setJsonRetryState({
            isRetrying: true,
            currentAttempt: attempt,
            maxAttempts: max,
            phaseName: 'DOCUMENTATION',
            usingFallback: attempt > 3,
          });
        }
      }
    );
    store.setJsonRetryState(null);
    let docFiles = (parsedObj?.files && Array.isArray(parsedObj.files)) ? parsedObj.files : [];

    // Ensure both README.md and USER_GUIDE.md are present
    const hasReadme = docFiles.some((f: any) => (f.file_name || '').toLowerCase() === 'readme.md');
    const hasUserGuide = docFiles.some((f: any) => (f.file_name || '').toLowerCase() === 'user_guide.md');

    if (!hasReadme) {
      docFiles.push(createFallbackReadme(requirements, codebase));
    }
    if (!hasUserGuide) {
      docFiles.push(createFallbackUserGuide(requirements));
    }

    // Append doc files to codebase
    const updatedFiles = [...codebase.files];
    docFiles.forEach((docFile: any) => {
      const idx = updatedFiles.findIndex((f) => f.file_name === docFile.file_name);
      if (idx >= 0) {
        updatedFiles[idx] = docFile;
      } else {
        updatedFiles.push(docFile);
      }
    });

    const updatedCodebase: GeneratedCodeBase = { files: updatedFiles };
    store.setCodebase(updatedCodebase);
    if (store.integratedCodebase || store.isComponentMode) {
      store.setIntegratedCodebase(updatedCodebase);
    }
    // Note: Do NOT switch Monaco editor away from active code file

    useAppStore.getState().completeTimelineInterval(docIntervalId, { status: 'completed' });
    store.setPipelineStatus('completed');
    store.setInFlightPhase(null);
    persistState(true);

    return updatedCodebase;
  } catch (err: any) {
    store.setJsonRetryState(null);
    if (err.name === 'AbortError' || store.pipelineStatus === 'aborted') {
      console.log('[AutoDev] Documentation generation aborted cleanly.');
      useAppStore.getState().completeTimelineInterval(docIntervalId, { status: 'failed' });
      throw err;
    }

    // Resilience: If documentation generation fails or retries are exhausted,
    // generate comprehensive fallback documentation so the user ALWAYS receives README.md and USER_GUIDE.md
    console.warn('[Documentation] Generating fallback documentation due to error:', err);
    const fallbackFiles = createFallbackDocFiles(requirements, codebase);
    const updatedFiles = [...codebase.files];
    fallbackFiles.forEach((docFile) => {
      const idx = updatedFiles.findIndex((f) => f.file_name === docFile.file_name);
      if (idx >= 0) {
        updatedFiles[idx] = docFile;
      } else {
        updatedFiles.push(docFile);
      }
    });

    const fallbackCodebase: GeneratedCodeBase = { files: updatedFiles };
    store.setCodebase(fallbackCodebase);
    if (store.integratedCodebase || store.isComponentMode) {
      store.setIntegratedCodebase(fallbackCodebase);
    }

    useAppStore.getState().completeTimelineInterval(docIntervalId, { status: 'completed' });
    store.setPipelineStatus('completed');
    store.setInFlightPhase(null);
    persistState(true);
    return fallbackCodebase;
  }
}

// Window bridges for legacy parity and recovery matrix
if (typeof window !== 'undefined') {
  (window as any).runSinglePassCritics = () => runCriticsEvaluation();
  (window as any).generateDocumentation = () => generateDocumentationPhase();
}
