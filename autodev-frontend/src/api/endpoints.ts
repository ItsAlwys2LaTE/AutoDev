/**
 * AutoDev Typed Endpoints Suite
 * Wraps all 18 backend endpoints with full TypeScript types,
 * resilient fetch integration, and SSE streaming subscription.
 */

import {
  fetchWithAutoRetry,
  consumeStream,
  StreamCallbacks,
  StreamResult,
  RetryOptions,
  ApiError,
  isAbortError,
} from './client';

import type {
  RequirementsRequest,
  RequirementsDocument,
  DecomposeRequest,
  IntegrateRequest,
  DesignRequest,
  SystemDesignBlueprint,
  CodeGenRequest,
  ParseRequirementsRequest,
  ParseBlueprintRequest,
  ExecuteCodeRequest,
  ExecutionResult,
  RunCriticsRequest,
  RunCriticsResponse,
  DocumentationRequest,
  PostCompletionModifyRequest,
  PostCompletionModifyResponse,
  PostCompletionQueryRequest,
  PreviewStartRequest,
  PreviewResponse,
  PipelineInitRequest,
  PipelineInitResponse,
  PipelineTickResponse,
  PipelineCompleteRequest,
  PipelineCompleteResponse,
  LogMessage,
  LogCategory,
  ClassifyIntentRequest,
  ClassifyIntentResponse,
} from '../types/api';

const API_BASE = ''; // Relies on Vite development proxy or same-origin in production

export interface RequestOptions extends RetryOptions {
  headers?: Record<string, string>;
}

// ============================================================================
// 1. Static Root Endpoint
// ============================================================================

/**
 * Endpoint 1: GET /
 * Verifies frontend root and backend serving status.
 */
export async function checkRoot(options?: RequestOptions): Promise<{ status: string }> {
  const response = await fetchWithAutoRetry(`${API_BASE}/`, {
    method: 'GET',
    ...options,
  });
  return { status: response.ok ? 'ok' : 'error' };
}

// ============================================================================
// 2. SDLC Phase 1: Requirements Generation (Streaming)
// ============================================================================

/**
 * Endpoint 2: POST /api/generate-requirements
 * Initiates the requirements generation stream.
 */
export async function generateRequirements(
  data: RequirementsRequest,
  callbacks?: StreamCallbacks,
  options?: RequestOptions
): Promise<StreamResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/generate-requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return consumeStream(response, callbacks);
}

// ============================================================================
// 2.5. Pre-Pipeline Gate: Intent Classification (JSON)
// ============================================================================

/**
 * Endpoint 2.5: POST /api/classify-intent
 * Classifies user intent before pipeline launch. Returns structured JSON.
 * Used by FeatureRequestInput to decide: proceed, clarify, or direct-answer.
 * Falls back gracefully to software_request on service failure or network error.
 */
export async function classifyIntent(
  data: ClassifyIntentRequest,
  options?: RequestOptions
): Promise<ClassifyIntentResponse> {
  try {
    const response = await fetchWithAutoRetry(`${API_BASE}/api/classify-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(data),
      ...options,
    });
    return response.json();
  } catch (error: any) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError && error.status === 400) {
      throw error;
    }
    console.warn('[classifyIntent] Classification service failure, falling back to software_request:', error);
    return {
      intent: 'software_request',
      confidence: 0.5,
      reasoning: 'Fallback: intent classifier service failure or network error',
      follow_up_questions: null,
      direct_answer: null,
    };
  }
}

// ============================================================================
// 3. SDLC Phase 0: Master Architect Component Decomposition (Streaming)
// ============================================================================

/**
 * Endpoint 3: POST /api/decompose
 * Initiates component decomposition into DAG.
 */
export async function decompose(
  data: DecomposeRequest,
  callbacks?: StreamCallbacks,
  options?: RequestOptions
): Promise<StreamResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/decompose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return consumeStream(response, callbacks);
}

// ============================================================================
// 4. SDLC Integration: Unified Codebase Integration (Streaming)
// ============================================================================

/**
 * Endpoint 4: POST /api/integrate
 * Integrates decomposed component results into a single codebase.
 */
export async function integrate(
  data: IntegrateRequest,
  callbacks?: StreamCallbacks,
  options?: RequestOptions
): Promise<StreamResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/integrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return consumeStream(response, callbacks);
}

// ============================================================================
// 5. SDLC Phase 2: System Design Blueprint Generation (Streaming)
// ============================================================================

/**
 * Endpoint 5: POST /api/generate-design
 * Generates the file-by-file system design blueprint stream.
 */
export async function generateDesign(
  data: DesignRequest,
  callbacks?: StreamCallbacks,
  options?: RequestOptions
): Promise<StreamResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/generate-design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return consumeStream(response, callbacks);
}

// ============================================================================
// 6. SDLC Phase 3: Code Generation & Surgical Patching (Streaming)
// ============================================================================

/**
 * Endpoint 6: POST /api/generate-code
 * Streams source code generation or surgical differential patch.
 */
export async function generateCode(
  data: CodeGenRequest,
  callbacks?: StreamCallbacks,
  options?: RequestOptions
): Promise<StreamResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/generate-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return consumeStream(response, callbacks);
}

// ============================================================================
// 7. Parser: Parse Raw Text to Requirements Document (JSON)
// ============================================================================

/**
 * Endpoint 7: POST /api/parse-requirements
 * Parses manually edited requirements plain text into structured RequirementsDocument JSON.
 */
export async function parseRequirements(
  data: ParseRequirementsRequest,
  options?: RequestOptions
): Promise<RequirementsDocument> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/parse-requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 8. Parser: Parse Raw Text to System Design Blueprint (JSON)
// ============================================================================

/**
 * Endpoint 8: POST /api/parse-blueprint
 * Parses manually edited blueprint text/JSON into structured SystemDesignBlueprint.
 */
export async function parseBlueprint(
  data: ParseBlueprintRequest,
  options?: RequestOptions
): Promise<SystemDesignBlueprint> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/parse-blueprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 9. SDLC Phase 4: Sandbox Code Execution & Tests (JSON)
// ============================================================================

/**
 * Endpoint 9: POST /api/execute-code
 * Executes tests in Docker container sandbox.
 */
export async function executeCode(
  data: ExecuteCodeRequest,
  options?: RequestOptions
): Promise<ExecutionResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/execute-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 10. SDLC Phase 5: Critics Evaluation & Adjudication (JSON)
// ============================================================================

/**
 * Endpoint 10: POST /api/run-critics
 * Runs synchronous critics evaluation and adjudicates revision verdict.
 */
export async function runCritics(
  data: RunCriticsRequest,
  options?: RequestOptions
): Promise<RunCriticsResponse> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/run-critics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 11. SDLC Phase 3.5: Documentation Generator (Streaming)
// ============================================================================

/**
 * Endpoint 11: POST /api/generate-documentation
 * Generates README.md and ARCHITECTURE.md markdown documentation.
 */
export async function generateDocumentation(
  data: DocumentationRequest,
  callbacks?: StreamCallbacks,
  options?: RequestOptions
): Promise<StreamResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/generate-documentation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return consumeStream(response, callbacks);
}

// ============================================================================
// 12. Post-Completion Control Plane: Modify Codebase (JSON)
// ============================================================================

/**
 * Endpoint 12: POST /api/post-completion/modify
 * Surgically refactors codebase and optionally runs verification sandbox.
 */
export async function postCompletionModify(
  data: PostCompletionModifyRequest,
  options?: RequestOptions
): Promise<PostCompletionModifyResponse> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/post-completion/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 13. Post-Completion Control Plane: Q&A Query (Streaming)
// ============================================================================

/**
 * Endpoint 13: POST /api/post-completion/query
 * Streams conversational technical explanations without modifying files.
 */
export async function postCompletionQuery(
  data: PostCompletionQueryRequest,
  callbacks?: StreamCallbacks,
  options?: RequestOptions
): Promise<StreamResult> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/post-completion/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return consumeStream(response, callbacks);
}

// ============================================================================
// 14. Live Container Preview (JSON)
// ============================================================================

/**
 * Endpoint 14: POST /api/preview/start
 * Starts background Docker container for live browser preview.
 */
export async function startPreview(
  data: PreviewStartRequest,
  options?: RequestOptions
): Promise<PreviewResponse> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/preview/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 15. DAG Scheduler: Initialize Pipeline (JSON)
// ============================================================================

/**
 * Endpoint 15: POST /api/pipeline/init
 * Initializes the component DAG pipeline scheduler.
 */
export async function pipelineInit(
  data: PipelineInitRequest,
  options?: RequestOptions
): Promise<PipelineInitResponse> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/pipeline/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 16. DAG Scheduler: Tick Pipeline (JSON)
// ============================================================================

/**
 * Endpoint 16: GET /api/pipeline/tick
 * Queries the scheduler for newly unblocked component assignments.
 */
export async function pipelineTick(
  sessionId?: string,
  options?: RequestOptions
): Promise<PipelineTickResponse> {
  const url = sessionId
    ? `${API_BASE}/api/pipeline/tick?sessionId=${encodeURIComponent(sessionId)}`
    : `${API_BASE}/api/pipeline/tick`;
  const response = await fetchWithAutoRetry(url, {
    method: 'GET',
    ...options,
  });
  return response.json();
}

// ============================================================================
// 17. DAG Scheduler: Complete Component Stage (JSON)
// ============================================================================

/**
 * Endpoint 17: POST /api/pipeline/complete
 * Reports stage completion for a component and unlocks dependents in DAG.
 */
export async function pipelineComplete(
  data: PipelineCompleteRequest,
  options?: RequestOptions
): Promise<PipelineCompleteResponse> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/pipeline/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

// ============================================================================
// 18. Live Diagnostics: Server-Sent Events (SSE) Log Stream
// ============================================================================

/**
 * Classifies log lines into semantic categories for terminal styling.
 */
export function classifyLogLine(text: string): LogCategory {
  const lower = text.toLowerCase();
  if (lower.includes('differential revision') || lower.includes('broken file')) {
    return 'revision';
  }
  if (
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('traceback') ||
    lower.includes('exception')
  ) {
    return 'error';
  }
  if (lower.includes('warn')) {
    return 'warn';
  }
  if (lower.includes('fallback') || lower.includes('switching to')) {
    return 'warn';
  }
  if (lower.includes('gemini') || lower.includes('agent') || lower.includes('model')) {
    return 'llm';
  }
  if (lower.includes('pass') || lower.includes('success') || lower.includes('completed')) {
    return 'success';
  }
  return 'info';
}

/**
 * Endpoint 18: GET /api/logs/stream
 * Subscribes to real-time Server-Sent Events (SSE) terminal log stream.
 * Returns an unsubscribe teardown function.
 */
export function subscribeLogStream(
  onMessage: (msg: LogMessage) => void,
  onError?: (err: Event) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/api/logs/stream`);

  eventSource.onmessage = (event: MessageEvent) => {
    // Filter keepalive comments
    if (event.data === ': keepalive' || event.data.trim() === '') {
      return;
    }

    const cleanRaw = event.data.replace(/\\n/g, '\n');
    const timestampMatch = cleanRaw.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s*(.*)$/);

    const timestamp = timestampMatch ? timestampMatch[1] : undefined;
    const cleanText = timestampMatch ? timestampMatch[2] : cleanRaw;
    const category = classifyLogLine(cleanText);

    onMessage({
      raw: cleanRaw,
      cleanText,
      timestamp,
      category,
    });
  };

  eventSource.onerror = (err: Event) => {
    if (onError) {
      onError(err);
    }
  };

  return () => {
    eventSource.close();
  };
}

// ============================================================================
// 19. Pipeline Concurrency & Lifecycle Control (Pause / Resume / Restart)
// ============================================================================

/**
 * Endpoint 19: POST /api/pipeline/pause
 * Pauses pipeline scheduling and freezes lease timers.
 */
export async function pipelinePause(
  data?: {
    session_id?: string;
    sessionId?: string;
    reason?: string;
    active_phase?: string;
    activePhase?: string;
    active_component_id?: string;
    activeComponentId?: string;
  },
  options?: RequestOptions
): Promise<{ status: string; paused_at?: number }> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/pipeline/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data || {}),
    ...options,
  });
  return response.json();
}

/**
 * Endpoint 20: POST /api/pipeline/resume
 * Resumes pipeline scheduling and extends lease expiration times.
 */
export async function pipelineResume(
  data?: {
    session_id?: string;
    sessionId?: string;
    target_phase?: string;
    targetPhase?: string;
    target_stage?: string;
    targetStage?: string;
    modifications_detected?: boolean;
    modificationsDetected?: boolean;
    earliest_phase?: string;
    earliestPhase?: string;
    earliest_component_id?: string;
    earliestComponentId?: string;
    earliest_target?: string;
    earliestTarget?: string;
  },
  options?: RequestOptions
): Promise<{ status: string; paused_duration?: number }> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/pipeline/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data || {}),
    ...options,
  });
  return response.json();
}

/**
 * Endpoint 21: POST /api/pipeline/restart
 * Completely purges pipeline scheduler DAG, leases, and journal state.
 */
export async function pipelineRestart(
  data?: { session_id?: string; sessionId?: string; reason?: string },
  options?: RequestOptions
): Promise<{ status: string }> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/pipeline/restart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data || {}),
    ...options,
  });
  return response.json();
}

/**
 * Endpoint 22: POST /api/pipeline/rewind
 * Rewinds a component to a target stage and invalidates downstream components.
 */
export async function pipelineRewind(
  data: {
    component_id: string;
    target_stage?: string;
    invalidate_dependents?: boolean;
    subsequent_component_ids?: string[];
    session_id?: string;
    sessionId?: string;
  },
  options?: RequestOptions
): Promise<{ success: boolean; component_id: string; target_stage: string; invalidated_dependents: string[] }> {
  const response = await fetchWithAutoRetry(`${API_BASE}/api/pipeline/rewind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(data),
    ...options,
  });
  return response.json();
}

