/**
 * AutoDev Component Pipeline Dashboard Shell
 *
 * Implements Milestone 1 R2:
 * - Outer container matching #pipelineDashboard with Glassmorphism design
 * - Aggregate progress reporting in #pipelineProgress ("X / Y components complete")
 * - Embedded ComponentToggler pill selector
 * - Horizontally scrollable #pipelineTracks container hosting #workspace-${cId} frames
 * - Milestone 2 slot `renderTrack` for ComponentTrack mini-pipeline
 * - Integration section #integrationSection with #integrateBtn
 * - Milestone 3 slot `renderIntegration` for IntegrationPhase
 * - Ticker hook integration (usePipelineTicker)
 */

import type { ReactNode } from 'react';
import { RectangleGroupIcon } from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { ComponentToggler } from './ComponentToggler';
import { usePipelineTicker } from './usePipelineTicker';
import { ComponentTrack } from './ComponentTrack';
import { IntegrationPhase } from '../integration/IntegrationPhase';
import type { ComponentSpec } from '../../types';

export interface PipelineDashboardProps {
  /** Optional component queue override (defaults to useAppStore pipelineQueue) */
  queue?: ComponentSpec[];
  /** Optional active component ID override (defaults to useAppStore activeComponentId) */
  activeId?: string | null;
  /** Custom wrapper CSS classes */
  className?: string;
  /** Force rendering even when queue is empty or not in component mode */
  alwaysRender?: boolean;
  /** Enable automatic pipeline ticker polling (default: true) */
  enableTicker?: boolean;
  /** Callback fired when the integrate button is clicked */
  onIntegrate?: () => void;
  /** Milestone 2 slot: render custom component track UI */
  renderTrack?: (component: ComponentSpec) => ReactNode;
  /** Milestone 3 slot: render the complete IntegrationPhase component */
  renderIntegration?: () => ReactNode;
}

export function PipelineDashboard({
  queue: propQueue,
  activeId: propActiveId,
  className = '',
  alwaysRender = false,
  enableTicker = true,
  onIntegrate,
  renderTrack,
  renderIntegration,
}: PipelineDashboardProps) {
  // Support both SSR (useAppStore.getState() in Node / renderToString) and client reactivity (useAppStore hook)
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Store subscriptions
  const storeIsComponentMode = useAppStore((s) => s.isComponentMode);
  const storeQueue = useAppStore((s) => s.pipelineQueue);
  const storeComponentStates = useAppStore((s) => s.componentStates);
  const storeActiveId = useAppStore((s) => s.activeComponentId);

  const isComponentMode = isSSR
    ? (liveStore?.isComponentMode ?? storeIsComponentMode)
    : storeIsComponentMode;
  const componentStates = isSSR
    ? (liveStore?.componentStates ?? storeComponentStates)
    : storeComponentStates;

  const pipelineQueue = propQueue !== undefined
    ? propQueue
    : (isSSR ? (liveStore?.pipelineQueue ?? storeQueue) : storeQueue) ?? [];
  const activeComponentId = propActiveId !== undefined
    ? propActiveId
    : (isSSR ? (liveStore?.activeComponentId ?? storeActiveId) : storeActiveId);

  // Activate ticker hook when in component mode and enabled
  usePipelineTicker({
    enabled: enableTicker && (isComponentMode || alwaysRender),
  });

  // Calculate aggregate completion count
  const passedCount = pipelineQueue.filter((c) => {
    const st = componentStates[c.component_id]?.status;
    return st === 'passed' || st === 'COMPLETED';
  }).length;

  const totalCount = pipelineQueue.length;
  const allPassed = totalCount > 0 && passedCount === totalCount;

  // Visibility check
  const isVisible = alwaysRender || isComponentMode || totalCount > 0;
  if (!isVisible) {
    return null;
  }

  return (
    <div
      id="pipelineDashboard"
      className={`glass-card bg-slate-900 rounded-2xl shadow-md border border-slate-800 p-6 fade-in ${className}`}
    >
      {/* ── Header Section ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="font-semibold text-slate-200 text-lg flex items-center gap-2.5">
          <span className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-sm">
            <RectangleGroupIcon className="w-4 h-4" />
          </span>
          Component Pipeline Dashboard
        </h2>
        <span
          id="pipelineProgress"
          className="text-sm text-slate-400 font-mono bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60"
        >
          {`${passedCount} / ${totalCount} components complete`}
        </span>
      </div>

      {/* ── Component Toggler Pill Bar ──────────────────────────────────────── */}
      <ComponentToggler queue={pipelineQueue} activeId={activeComponentId} />

      {/* ── Parallel Component Tracks Container ─────────────────────────────── */}
      <div
        id="pipelineTracks"
        className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-6 items-start pb-6 custom-scrollbar"
      >
        {pipelineQueue.map((component) => {
          const cId = component.component_id;

          // If M2 custom track renderer is provided, use it
          if (renderTrack) {
            return (
              <div key={cId} id={`workspace-${cId}`} className="snap-center">
                {renderTrack(component)}
              </div>
            );
          }

          // Otherwise, render ComponentTrack as default
          return (
            <ComponentTrack
              key={cId}
              component={component}
              className="snap-center"
            />
          );
        })}
      </div>

      {/* ── Integration Section ─────────────────────────────────────────────── */}
      <div
        id="integrationSection"
        className={`border-t border-slate-700/80 pt-6 mt-6 transition-all duration-300 ${
          allPassed ? 'block' : 'hidden'
        }`}
      >
        {renderIntegration ? (
          renderIntegration()
        ) : (
          <IntegrationPhase
            allPassed={allPassed}
            renderWithoutContainer
            onIntegrationStart={onIntegrate}
            onIntegrationComplete={() => {
              if (onIntegrate) onIntegrate();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default PipelineDashboard;
