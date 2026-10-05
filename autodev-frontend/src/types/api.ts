/**
 * AutoDev API Schema Definitions
 * Maps 1:1 to backend/models.py, backend/main.py, backend/pipeline_api.py, and backend/log_stream.py.
 */

import type {
  AcceptanceCriteria,
  UserStory,
  RequirementsDocument,
  FileBlueprint,
  SystemDesignBlueprint,
  CodeFile,
  GeneratedCodeBase,
  ExecutionResult,
  CriticFeedback,
  AdjudicatorVerdict,
  AdjudicatorDecision,
  ComponentSpec,
  ComponentDecomposition,
  ComponentResult,
  PostCompletionModifyRequest,
  PostCompletionModifyResponse,
  PostCompletionQueryRequest,
  AppMode,
} from './index';

// Re-export common domain types
export type {
  AcceptanceCriteria,
  UserStory,
  RequirementsDocument,
  FileBlueprint,
  SystemDesignBlueprint,
  CodeFile,
  GeneratedCodeBase,
  ExecutionResult,
  CriticFeedback,
  AdjudicatorVerdict,
  AdjudicatorDecision,
  ComponentSpec,
  ComponentDecomposition,
  ComponentResult,
  PostCompletionModifyRequest,
  PostCompletionModifyResponse,
  PostCompletionQueryRequest,
  AppMode,
};

// ============================================================================
// Common & Primitive Types
// ============================================================================

export type GenerationMode = 'QUICK' | 'COMPLEX';

export type PipelineStage =
  | 'REQUIREMENTS'
  | 'DESIGN'
  | 'CODEGEN'
  | 'EXECUTION'
  | 'CRITICS'
  | 'INTEGRATION'
  | 'DOCUMENTATION'
  | 'COMPLETED';

export interface TokenUsage {
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  costInr: number;
}

// ============================================================================
// Phase 1: Requirements Analysis
// ============================================================================

export interface RequirementsRequest {
  feature_request: string;
  mode?: GenerationMode | string;
  generation_mode?: GenerationMode | string | null;
}

// ============================================================================
// Phase 0: Master Architect & Component Decomposition
// ============================================================================

export type DecomposeRequest = RequirementsDocument;

// ============================================================================
// Phase 2: System Design Blueprint
// ============================================================================

export interface DesignRequest {
  requirements: RequirementsDocument;
  component_context?: string | null;
  component_name?: string | null;
  component_id?: string | null;
  revision_count?: number;
  mode?: GenerationMode | string;
  generation_mode?: GenerationMode | string | null;
  component?: ComponentSpec | Record<string, any> | null;
  decomposition?: ComponentDecomposition | Record<string, any> | null;
  docker_image?: string | null;
  tech_stack?: string[] | null;
}

// ============================================================================
// Phase 3 & 4: Code Generation, Codebase, and Sandbox Execution
// ============================================================================

export interface CodeGenRequest {
  requirements: RequirementsDocument;
  blueprint: SystemDesignBlueprint;
  previous_codebase?: GeneratedCodeBase | null;
  revision_plan?: string | null;
  revision_count?: number;
  component_name?: string | null;
  component_id?: string | null;
  mode?: GenerationMode | string | null;
  generation_mode?: GenerationMode | string | null;
}

export interface ExecuteCodeRequest {
  codebase: GeneratedCodeBase;
  blueprint: SystemDesignBlueprint;
  mode?: GenerationMode | string;
  generation_mode?: GenerationMode | string | null;
  component?: ComponentSpec | Record<string, any> | null;
  decomposition?: ComponentDecomposition | Record<string, any> | null;
  docker_image?: string | null;
  tech_stack?: string[] | null;
}

// ============================================================================
// Phase 5: Arbitration, Critics, and Adjudication
// ============================================================================

export interface RunCriticsRequest {
  requirements: RequirementsDocument;
  blueprint: SystemDesignBlueprint;
  codebase: GeneratedCodeBase;
  execution_result: ExecutionResult;
  master_decomposition?: ComponentDecomposition | null;
  component_name?: string | null;
  component_id?: string | null;
  revision_count?: number;
  mode?: GenerationMode | string | null;
  generation_mode?: GenerationMode | string | null;
  previous_composite?: number | null;
  phase?: string | null;
  stage?: string | null;
}

export interface RunCriticsResponse {
  feedbacks: CriticFeedback[];
  decision: AdjudicatorDecision;
  revision_count: number;
}

// ============================================================================
// SDLC Integration Phase
// ============================================================================

export interface IntegrateRequest {
  requirements: RequirementsDocument;
  decomposition: ComponentDecomposition;
  component_results: ComponentResult[];
  previous_codebase?: GeneratedCodeBase | null;
  revision_plan?: string | null;
  revision_count?: number;
  mode?: GenerationMode | string | null;
  generation_mode?: GenerationMode | string | null;
}

// ============================================================================
// Phase 3.5: Documentation Generation
// ============================================================================

export interface DocumentationRequest {
  requirements: RequirementsDocument;
  blueprint: SystemDesignBlueprint;
  codebase: GeneratedCodeBase;
  mode?: GenerationMode | string | null;
  generation_mode?: GenerationMode | string | null;
}

// ============================================================================
// Parser Requests
// ============================================================================

export interface ParseRequirementsRequest {
  text: string;
  mode?: GenerationMode | string;
  generation_mode?: GenerationMode | string | null;
}

export interface ParseBlueprintRequest {
  text: string;
  mode?: GenerationMode | string;
  generation_mode?: GenerationMode | string | null;
}

// ============================================================================
// Live Preview
// ============================================================================

export interface PreviewStartRequest {
  codebase: GeneratedCodeBase;
  blueprint: SystemDesignBlueprint;
  mode?: GenerationMode | string;
  generation_mode?: GenerationMode | string | null;
}

export interface PreviewResponse {
  url: string;
}

// ============================================================================
// DAG Pipeline Scheduler
// ============================================================================

export interface PipelineInitRequest {
  components: Array<Record<string, any>> | ComponentSpec[];
  generation_mode?: GenerationMode | string | null;
  mode?: GenerationMode | string | null;
}

export interface PipelineInitResponse {
  status: string;
  mode: GenerationMode | string;
  max_revisions: number;
}

export interface PipelineAssignment {
  component_id: string;
  stage: string;
  epoch: number;
}

export interface PipelineTickResponse {
  assignments: PipelineAssignment[];
}

export interface PipelineCompleteRequest {
  component_id: string;
  stage: string;
  verdict?: string;
  revision_plan?: string | null;
  force_proceed?: boolean;
  revision_count?: number | null;
  mode?: GenerationMode | string | null;
  generation_mode?: GenerationMode | string | null;
  dynamic_budget?: number | null;
}

export interface PipelineCompleteResponse {
  success: boolean;
}

// ============================================================================
// Live Diagnostics & Logging
// ============================================================================

export type LogCategory = 'error' | 'warn' | 'info' | 'system' | 'llm' | 'revision' | 'success';

export interface LogMessage {
  raw: string;
  cleanText: string;
  timestamp?: string;
  category: LogCategory;
}

// ============================================================================
// Intent Classification & Follow-Up Questions (Pre-Pipeline Gate)
// ============================================================================

/** Intent categories returned by the LLM classifier */
export type UserIntent = 'software_request' | 'ambiguous' | 'not_software';

/** Request payload for POST /api/classify-intent */
export interface ClassifyIntentRequest {
  prompt: string;
  feature_request?: string;
  mode?: GenerationMode | string;
  generation_mode?: GenerationMode | string | null;
  /** Optional context from previous clarification round */
  context?: string | null;
}

/** Response from POST /api/classify-intent. Maps 1:1 to backend IntentClassification. */
export interface ClassifyIntentResponse {
  intent: UserIntent;
  confidence: number;
  reasoning: string;
  follow_up_questions?: string[] | null;
  direct_answer?: string | null;
}

/** State for the follow-up questions clarification UI */
export interface ClarificationState {
  /** The original unmodified prompt */
  originalPrompt: string;
  /** Questions from the LLM classifier */
  questions: string[];
  /** User's answers (parallel array, same length as questions) */
  answers: string[];
  /** How many clarification rounds have occurred (max 2) */
  round: number;
  /** The full classifier response for reference */
  classifierResponse: ClassifyIntentResponse;
}

