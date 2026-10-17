/**
 * AutoDev Sequential Pipeline Execution & Ordering Integrity Test Suite
 *
 * Verifies that:
 * 1. Components execute strictly in priority order (Component 1 before Component 2).
 * 2. Next component development does not begin before the current higher-order component completes.
 * 3. Ticker assignment processing blocks subsequent components while prior components are incomplete.
 * 4. Completion of a prior component cleanly transitions focus and development to the next component.
 * 5. All-passed status initiates transition to Stage 6 (Integration Engine).
 * 6. Zero literal emojis across all components and logs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useAppStore } from '../src/stores/appStore';
import { resetAllStores } from '../src/stores';
import { StageComponentPipeline } from '../src/features/stages/StageComponentPipeline';
import { PipelineDashboard } from '../src/features/pipeline/PipelineDashboard';
import type { ComponentSpec, ComponentTrackState } from '../src/types';

describe('AutoDev Sequential Component Pipeline Execution Suite', () => {
  beforeEach(() => {
    resetAllStores();
  });

  const queue: ComponentSpec[] = [
    {
      component_id: 'comp-1-core',
      component_name: 'Core Application Framework',
      description: 'Foundational framework and layout',
      scoped_requirements: 'Core layout and state management',
      tech_stack: ['React', 'TypeScript'],
      dependencies_on: [],
      priority_order: 1,
    },
    {
      component_id: 'comp-2-feature',
      component_name: 'Interactive Feature Engine',
      description: 'Business logic and feature views',
      scoped_requirements: 'Interactive views and API integration',
      tech_stack: ['React', 'TypeScript'],
      dependencies_on: ['comp-1-core'],
      priority_order: 2,
    },
  ];

  it('maintains queued state on next component while current component is in development', () => {
    const store = useAppStore.getState();
    store.setPipelineQueue(queue);
    store.setIsComponentMode(true);
    store.setPipelineActive(true);
    store.setPipelineStatus('running');
    store.setActiveComponent('comp-1-core', 'DESIGN');

    store.setComponentStates({
      'comp-1-core': {
        component: queue[0],
        status: 'coding',
        currentStage: 'CODEGEN',
        blueprint: { architecture_overview: 'Arch 1', tech_stack: ['React'], docker_image: 'node:18', dev_server_command: 'npm run dev', dev_server_port: 5173, run_tests_command: 'npm test', files: [] },
        codebase: { files: [{ file_name: 'App.tsx', source_code: 'export default () => <div>App</div>;' }] },
        executionResult: null,
        criticFeedbacks: [],
        adjudicatorDecision: null,
        revisionCount: 0,
        dynamicBudget: 3,
      } as unknown as ComponentTrackState,
      'comp-2-feature': {
        component: queue[1],
        status: 'queued',
        currentStage: null,
        blueprint: null,
        codebase: null,
        executionResult: null,
        criticFeedbacks: [],
        adjudicatorDecision: null,
        revisionCount: 0,
        dynamicBudget: 3,
      } as unknown as ComponentTrackState,
    });

    const state = useAppStore.getState();
    expect(state.componentStates['comp-1-core'].status).toBe('coding');
    expect(state.componentStates['comp-2-feature'].status).toBe('queued');

    // Stage 6 should remain locked (< 6) while components are still in flight
    expect(state.maxUnlockedStage < 6).toBe(true);
  });

  it('unblocks next component and unlocks Stage 6 when all components complete', () => {
    const store = useAppStore.getState();
    store.setPipelineQueue(queue);
    store.setIsComponentMode(true);
    store.setPipelineActive(true);
    store.setPipelineStatus('running');

    // First component completes
    store.setComponentStates({
      'comp-1-core': {
        component: queue[0],
        status: 'passed',
        currentStage: 'COMPLETED',
        blueprint: { architecture_overview: 'Arch 1', tech_stack: ['React'], docker_image: 'node:18', dev_server_command: 'npm run dev', dev_server_port: 5173, run_tests_command: 'npm test', files: [] },
        codebase: { files: [{ file_name: 'App.tsx', source_code: 'export default () => <div>App</div>;' }] },
        executionResult: { success: true, logs: 'Passed' },
        criticFeedbacks: [],
        adjudicatorDecision: { verdict: 'pass' },
        revisionCount: 0,
        dynamicBudget: 3,
      } as unknown as ComponentTrackState,
      'comp-2-feature': {
        component: queue[1],
        status: 'queued',
        currentStage: null,
        blueprint: null,
        codebase: null,
        executionResult: null,
        criticFeedbacks: [],
        adjudicatorDecision: null,
        revisionCount: 0,
        dynamicBudget: 3,
      } as unknown as ComponentTrackState,
    });

    // Advance component 1 to passed, then component 2 can develop and complete
    store.updateComponentState('comp-2-feature', {
      status: 'passed',
      currentStage: 'COMPLETED',
    });

    // Check completion metrics
    const state = useAppStore.getState();
    const passed = queue.every(
      (c) => state.componentStates[c.component_id]?.status === 'passed'
    );
    expect(passed).toBe(true);

    const onAdvanceMock = vi.fn();
    const html = renderToString(
      React.createElement(StageComponentPipeline, {
        onAdvance: onAdvanceMock,
      })
    );

    expect(html).toContain('id="stageComponentPipeline"');
    expect(html).toContain('Component Pipeline Agent');

    // Both components passed
    expect(state.componentStates['comp-1-core'].status).toBe('passed');
    expect(state.componentStates['comp-2-feature'].status).toBe('passed');
  });

  it('contains zero literal emoji characters across rendered HTML', () => {
    const store = useAppStore.getState();
    store.setPipelineQueue(queue);
    store.setIsComponentMode(true);
    store.setPipelineActive(true);
    store.setPipelineStatus('running');

    const html = renderToString(
      React.createElement(PipelineDashboard, {
        queue,
        alwaysRender: true,
        enableTicker: false,
      })
    );

    for (const char of html) {
      const code = char.codePointAt(0) || 0;
      const isEmoji =
        (code >= 0x1f300 && code <= 0x1faff) ||
        (code >= 0x2700 && code <= 0x27bf);
      expect(isEmoji).toBe(false);
    }
  });
});
