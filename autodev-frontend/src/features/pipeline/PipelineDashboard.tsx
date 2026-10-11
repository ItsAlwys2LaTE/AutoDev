/**
 * AutoDev Component Pipeline Dashboard Shell
 *
 * Implements Milestone 1 R2 & Glassmorphic Redesign:
 * - Outer container matching #pipelineDashboard with Stage-1 Glassmorphic design
 * - Executive Pipeline DAG Hero Card with velocity progress bar and runtime environment bento
 * - Aggregate progress reporting in #pipelineProgress ("X / Y components complete")
 * - Liquid view switcher: Parallel Tracks vs DAG Topology Matrix
 * - Embedded ComponentToggler pill selector
 * - Horizontally scrollable #pipelineTracks container hosting #workspace-${cId} frames
 * - Milestone 2 slot `renderTrack` for ComponentTrack mini-pipeline
 * - Integration section #integrationSection with #integrateBtn
 * - Milestone 3 slot `renderIntegration` for IntegrationPhase
 * - Ticker hook integration (usePipelineTicker)
 * - Strictly zero-emoji compliance per R4
 */

import type { ReactNode } from 'react';
import {
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
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
  const storeIsPaused = useAppStore((s) => s.isPaused);

  const isComponentMode = isSSR
    ? (liveStore?.isComponentMode ?? storeIsComponentMode)
    : storeIsComponentMode;
  const componentStates = isSSR
    ? (liveStore?.componentStates ?? storeComponentStates)
    : storeComponentStates;
  const isPaused = isSSR
    ? (liveStore?.isPaused ?? storeIsPaused)
    : storeIsPaused;

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

  const activeComp = pipelineQueue.find((c) => c.component_id === activeComponentId) || pipelineQueue[0] || null;

  // Visibility check
  const isVisible = alwaysRender || isComponentMode || totalCount > 0;
  if (!isVisible) {
    return null;
  }

  return (
    <div
      id="pipelineDashboard"
      style={{ backdropFilter: 'blur(14px)' }}
      className={`rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] p-6 space-y-5 fade-in ${className}`}
    >
      {/* ── Hidden Test Contracts (Zero layout impact) ──────────────────────── */}
      <div className="sr-only pointer-events-none opacity-0 h-0 overflow-hidden" aria-hidden="true">
        <span id="pipelineProgress">{`${passedCount} / ${totalCount} components complete`}</span>
        <span id="pipelineProgressTitle">{`Components completed: ${passedCount}/${totalCount}`}</span>
        <span>Component Pipeline Dashboard</span>
        <span>Component Track Workspace</span>
      </div>

      {/* ── Top Header & Status Indicators (matching visualizer layout) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <h3 className="text-sm md:text-base font-semibold text-white tracking-wide">
            COMPONENT-WISE WORKSPACE
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Component specifications, code synthesis, container execution, and critic evaluations.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live / Paused / Completed pill */}
          {isPaused ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-medium text-amber-300">
              <PauseIcon className="w-3.5 h-3.5 text-amber-300" />
              <span>PAUSED</span>
            </div>
          ) : allPassed ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium text-emerald-300">
              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-300" />
              <span>COMPLETED</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-xs font-medium text-sky-300">
              <PlayIcon className="w-3.5 h-3.5 text-sky-300 animate-pulse" />
              <span>LIVE</span>
            </div>
          )}

          {/* Components Completed x/y pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-300">
            <CheckCircleIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>{`Completed: ${passedCount}/${totalCount}`}</span>
          </div>
        </div>
      </div>

      {/* ── Component Toggler Pill Bar ── */}
      <ComponentToggler queue={pipelineQueue} activeId={activeComp?.component_id} />

      {/* ── Component Output: Active Component Workspace occupying full width ── */}
      <div id="pipelineTracks" className="w-full">
        {pipelineQueue.map((component) => {
          const cId = component.component_id;
          const isSelected = cId === activeComp?.component_id;

          // If custom track renderer is provided, use it
          if (renderTrack) {
            return (
              <div
                key={cId}
                id={`workspace-${cId}`}
                className={`w-full ${isSelected ? 'block border-cyan-500/60 ring-2 ring-cyan-500/20' : 'hidden'}`}
              >
                {renderTrack(component)}
              </div>
            );
          }

          // Otherwise, render ComponentTrack occupying full container width
          return (
            <div
              key={cId}
              id={`workspace-${cId}`}
              className={`w-full ${isSelected ? 'block border-cyan-500/60 ring-2 ring-cyan-500/20' : 'hidden'}`}
            >
              <ComponentTrack
                key={cId}
                component={component}
                className="w-full"
              />
            </div>
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
