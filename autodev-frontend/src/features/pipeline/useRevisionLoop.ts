/**
 * AutoDev useRevisionLoop Hook
 * 
 * Provides reactive access to execution, critics evaluation, adjudicator decision,
 * dynamic budget calculations, and self-correction cycles.
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import {
  executeSandboxCode,
  runCriticsEvaluation,
  generateDocumentationPhase,
  calculateCompositeScore,
  calculateDynamicBudget,
  isEarlyStopDelta,
  evaluateAdjudicationDecision,
} from './revisionLoop';
import type {
  ExecutionResult,
  CriticFeedback,
  AdjudicatorDecision,
  GeneratedCodeBase,
} from '../../types';

export function useRevisionLoop() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isEvaluatingCritics, setIsEvaluatingCritics] = useState(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = useAppStore((s) => s.mode);
  const revisionCount = useAppStore((s) => s.currentRevisionCount);
  const dynamicBudget = useAppStore((s) => s.currentDynamicBudget);
  const compositeScore = useAppStore((s) => s.currentCompositeScore);
  const executionResult = useAppStore((s) => s.currentExecutionResult);
  const feedbacks = useAppStore((s) => s.criticEvaluations);
  const decisions = useAppStore((s) => s.adjudicatorDecisions);
  const currentDecision = decisions.length > 0 ? decisions[decisions.length - 1] : null;

  // Execute Sandbox Code
  const executeCode = useCallback(async (): Promise<ExecutionResult | null> => {
    setIsExecuting(true);
    setError(null);
    try {
      const result = await executeSandboxCode({ mode });
      return result;
    } catch (err: any) {
      setError(err.message || 'Execution failed');
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, [mode]);

  // Run Critics Evaluation & Adjudicate
  const runCritics = useCallback(async (): Promise<{
    feedbacks: CriticFeedback[];
    decision: AdjudicatorDecision;
  } | null> => {
    setIsEvaluatingCritics(true);
    setError(null);
    try {
      const result = await runCriticsEvaluation({ mode });
      return { feedbacks: result.feedbacks, decision: result.decision };
    } catch (err: any) {
      setError(err.message || 'Critic evaluation failed');
      return null;
    } finally {
      setIsEvaluatingCritics(false);
    }
  }, [mode]);

  // Generate Documentation (Phase 3.5)
  const generateDocs = useCallback(async (): Promise<GeneratedCodeBase | null> => {
    setIsGeneratingDocs(true);
    setError(null);
    try {
      const result = await generateDocumentationPhase({ mode });
      return result;
    } catch (err: any) {
      setError(err.message || 'Documentation generation failed');
      return null;
    } finally {
      setIsGeneratingDocs(false);
    }
  }, [mode]);

  return {
    isExecuting,
    isEvaluatingCritics,
    isGeneratingDocs,
    error,
    mode,
    revisionCount,
    dynamicBudget,
    compositeScore,
    executionResult,
    feedbacks,
    currentDecision,
    executeCode,
    runCritics,
    generateDocs,
    calculateCompositeScore,
    calculateDynamicBudget,
    isEarlyStopDelta,
    evaluateAdjudicationDecision,
  };
}
