/**
 * AutoDev Chronological Timeline Metrics Logging & Endscreen Gantt Chart
 * 
 * Implements Milestone 1 (Requirement R1):
 * - Pure React, Tailwind CSS, SVG / CSS grid with zero external charting dependencies
 * - Header displaying total elapsed development time, completed phases count, and components count
 * - View toggling: "Chronological Stream" (waterfall) vs "Component Grouped"
 * - Interactive timeline track visualization with proportional widths and offsets
 * - Distinct phase color-coding with accessible badges
 * - Hover tooltip card showing phase name, component name, timestamps, duration, and status
 * - Strict zero-emoji compliance using Heroicons
 */

import React, { useState, useMemo } from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ArrowPathIcon,
  Squares2X2Icon,
  ListBulletIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../stores/appStore';
import type { TimelineInterval, PipelinePhaseType } from '../types';

export interface DevelopmentGanttChartProps {
  className?: string;
  testIntervals?: TimelineInterval[];
  testTotalDurationMs?: number;
}

interface PhaseStyle {
  label: string;
  barColor: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
}

const PHASE_STYLES: Record<PipelinePhaseType, PhaseStyle> = {
  requirements: {
    label: 'Requirements',
    barColor: 'bg-sky-500',
    badgeBg: 'bg-sky-500/20',
    textColor: 'text-sky-300',
    borderColor: 'border-sky-500/40',
  },
  decomposition: {
    label: 'Decomposition',
    barColor: 'bg-cyan-500',
    badgeBg: 'bg-cyan-500/20',
    textColor: 'text-cyan-300',
    borderColor: 'border-cyan-500/40',
  },
  design: {
    label: 'Design',
    barColor: 'bg-violet-500',
    badgeBg: 'bg-violet-500/20',
    textColor: 'text-violet-300',
    borderColor: 'border-violet-500/40',
  },
  codegen: {
    label: 'Codegen',
    barColor: 'bg-blue-500',
    badgeBg: 'bg-blue-500/20',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/40',
  },
  execution: {
    label: 'Execution',
    barColor: 'bg-amber-500',
    badgeBg: 'bg-amber-500/20',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/40',
  },
  critics: {
    label: 'Critics',
    barColor: 'bg-rose-500',
    badgeBg: 'bg-rose-500/20',
    textColor: 'text-rose-300',
    borderColor: 'border-rose-500/40',
  },
  integration: {
    label: 'Integration',
    barColor: 'bg-teal-500',
    badgeBg: 'bg-teal-500/20',
    textColor: 'text-teal-300',
    borderColor: 'border-teal-500/40',
  },
  documentation: {
    label: 'Documentation',
    barColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/20',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/40',
  },
};

export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.max(0, Math.round(durationMs))}ms`;
  }
  const totalSeconds = durationMs / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatTimestamp(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'N/A';
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'N/A';
  }
}

export const DevelopmentGanttChart: React.FC<DevelopmentGanttChartProps> = ({
  className = '',
  testIntervals,
  testTotalDurationMs,
}) => {
  const storeMetrics = useAppStore((s) => s.timelineMetrics);
  const isComponentMode = useAppStore((s) => s.isComponentMode);
  const componentStates = useAppStore((s) => s.componentStates);

  const [viewMode, setViewMode] = useState<'waterfall' | 'grouped'>('waterfall');
  const [hoveredInterval, setHoveredInterval] = useState<TimelineInterval | null>(null);

  // Allow test injection or fallback to store
  const intervals = useMemo(() => {
    return testIntervals || storeMetrics.intervals || [];
  }, [testIntervals, storeMetrics.intervals]);

  // Chronologically sorted intervals
  const sortedIntervals = useMemo(() => {
    return [...intervals].sort((a, b) => a.startTime - b.startTime);
  }, [intervals]);

  // Overall bounds
  const { minTime, totalSpan, totalDurationMs } = useMemo(() => {
    if (intervals.length === 0) {
      return { minTime: 0, totalSpan: 1, totalDurationMs: 0 };
    }
    const computedMin = storeMetrics.pipelineStartTime ?? Math.min(...intervals.map((i) => i.startTime));
    const computedMax = storeMetrics.pipelineEndTime ?? Math.max(
      ...intervals.map((i) => (i.endTime > 0 ? i.endTime : i.startTime + i.durationMs))
    );
    const span = Math.max(1, computedMax - computedMin);
    const totalMs = testTotalDurationMs !== undefined
      ? testTotalDurationMs
      : storeMetrics.totalDurationMs > 0
        ? storeMetrics.totalDurationMs
        : span;

    return {
      minTime: computedMin,
      totalSpan: span,
      totalDurationMs: totalMs,
    };
  }, [intervals, storeMetrics, testTotalDurationMs]);

  // Total completed phases
  const completedCount = useMemo(() => {
    return intervals.filter((i) => i.status === 'completed' || i.status === 'passed').length;
  }, [intervals]);

  // Unique component count
  const componentCount = useMemo(() => {
    const set = new Set<string>();
    intervals.forEach((i) => {
      if (i.componentId) set.add(i.componentId);
      else if (i.componentName) set.add(i.componentName);
    });
    if (set.size > 0) return set.size;
    return Object.keys(componentStates || {}).length;
  }, [intervals, componentStates]);

  // Grouped intervals by component or system
  const groupedIntervals = useMemo(() => {
    const groups: Record<string, { title: string; isComponent: boolean; items: TimelineInterval[] }> = {};

    sortedIntervals.forEach((interval) => {
      const key = interval.componentId
        ? `comp_${interval.componentId}`
        : interval.componentName
          ? `comp_${interval.componentName}`
          : 'system';
      const title = interval.componentName || (key === 'system' ? 'System Pipeline' : 'Component');
      const isComp = key !== 'system';

      if (!groups[key]) {
        groups[key] = {
          title,
          isComponent: isComp,
          items: [],
        };
      }
      groups[key].items.push(interval);
    });

    return Object.values(groups);
  }, [sortedIntervals]);

  // Time ruler ticks (0%, 25%, 50%, 75%, 100%)
  const rulerTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const ms = Math.round(totalSpan * ratio);
      return {
        ratio,
        label: ratio === 0 ? '0s' : `+${formatDuration(ms)}`,
      };
    });
  }, [totalSpan]);

  return (
    <div
      id="developmentGanttChart"
      data-testid="development-gantt-chart"
      className={`bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-lg text-slate-200 transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <ChartBarIcon className="w-3.5 h-3.5" />
            </span>
            <h4 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
              Development Timeline & Gantt Metrics
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Chronological execution breakdown with per-phase durations and component intervals.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            role="tablist"
            aria-label="Timeline View Selection"
            className="inline-flex bg-slate-950 p-1 rounded-lg border border-slate-800"
          >
            <button
              type="button"
              id="ganttToggleWaterfall"
              data-testid="gantt-toggle-waterfall"
              onClick={() => setViewMode('waterfall')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'waterfall'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListBulletIcon className="w-3.5 h-3.5" />
              <span>Chronological Stream</span>
            </button>
            <button
              type="button"
              id="ganttToggleGrouped"
              data-testid="gantt-toggle-grouped"
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'grouped'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Squares2X2Icon className="w-3.5 h-3.5" />
              <span>Component Grouped</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 my-4">
        {/* Total Elapsed Time Badge */}
        <div
          id="ganttTotalDuration"
          data-testid="gantt-total-duration"
          title={`Exact total duration: ${totalDurationMs.toLocaleString()} ms`}
          className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <ClockIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Total Elapsed Time
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-100">
              {formatDuration(totalDurationMs)}
            </div>
          </div>
        </div>

        {/* Total Completed Phases Badge */}
        <div
          id="ganttTotalPhases"
          data-testid="gantt-total-phases"
          className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircleIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Completed Phases
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-100">
              {`${completedCount} / ${intervals.length}`}
            </div>
          </div>
        </div>

        {/* Total Components Badge */}
        {(isComponentMode || componentCount > 0) && (
          <div
            id="ganttTotalComponents"
            data-testid="gantt-total-components"
            className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <CpuChipIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Component Tracks
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-100">
                {`${componentCount} components`}
              </div>
            </div>
          </div>
        )}

        {/* Interval Count Badge */}
        <div
          id="ganttIntervalCount"
          data-testid="gantt-interval-count"
          className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
            <ArrowPathIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Logged Stages
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-100">
              {`${intervals.length} stages`}
            </div>
          </div>
        </div>
      </div>

      {/* Main Gantt Timeline Area */}
      {intervals.length === 0 ? (
        <div
          id="ganttEmptyState"
          data-testid="gantt-empty-state"
          className="py-12 text-center border border-dashed border-slate-800 rounded-lg bg-slate-950/40"
        >
          <ClockIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No timeline intervals recorded yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Intervals are recorded automatically as pipeline stages execute. Metrics will display once pipeline runs.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Time Ruler Bar */}
          <div className="relative pt-2 pb-1 border-b border-slate-800/60 select-none">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-2">
              {rulerTicks.map((tick, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center"
                  style={{
                    position: 'absolute',
                    left: `${tick.ratio * 100}%`,
                    transform: tick.ratio === 0 ? 'none' : tick.ratio === 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  <span className="h-1.5 w-px bg-slate-700 mb-1" />
                  <span>{tick.label}</span>
                </div>
              ))}
            </div>
            <div className="h-5" />
          </div>

          {/* Active Hover Detail Tooltip Card */}
          {hoveredInterval && (
            <div
              id="ganttHoverCard"
              data-testid="gantt-hover-card"
              className="bg-slate-950/95 border border-indigo-500/40 rounded-lg p-3 shadow-xl text-xs flex flex-wrap items-center justify-between gap-3 animate-fadeIn"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    PHASE_STYLES[hoveredInterval.phase]?.badgeBg || 'bg-slate-800'
                  } ${PHASE_STYLES[hoveredInterval.phase]?.textColor || 'text-slate-300'} ${
                    PHASE_STYLES[hoveredInterval.phase]?.borderColor || 'border-slate-700'
                  }`}
                >
                  {PHASE_STYLES[hoveredInterval.phase]?.label || hoveredInterval.phase}
                </span>
                <span className="font-bold text-slate-200">{hoveredInterval.label}</span>
                {hoveredInterval.componentName && (
                  <span className="text-[11px] text-cyan-400 font-medium">
                    Component: {hoveredInterval.componentName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500">Start:</span>{' '}
                  <span className="text-slate-300">{formatTimestamp(hoveredInterval.startTime)}</span>
                </div>
                <div>
                  <span className="text-slate-500">End:</span>{' '}
                  <span className="text-slate-300">{formatTimestamp(hoveredInterval.endTime)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span>{' '}
                  <span className="text-amber-300 font-bold">
                    {hoveredInterval.durationMs.toLocaleString()} ms ({formatDuration(hoveredInterval.durationMs)})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span
                    className={`font-semibold capitalize ${
                      hoveredInterval.status === 'completed' || hoveredInterval.status === 'passed'
                        ? 'text-emerald-400'
                        : hoveredInterval.status === 'revised'
                          ? 'text-amber-400'
                          : hoveredInterval.status === 'failed'
                            ? 'text-rose-400'
                            : 'text-indigo-400'
                    }`}
                  >
                    {hoveredInterval.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Visualization Tracks Container */}
          <div id="ganttTimelineTracks" data-testid="gantt-timeline-tracks" className="space-y-2">
            {viewMode === 'waterfall' ? (
              // Chronological Waterfall View
              sortedIntervals.map((interval, idx) => {
                const style = PHASE_STYLES[interval.phase] || PHASE_STYLES.requirements;
                const leftPercent = Math.max(
                  0,
                  Math.min(98, ((interval.startTime - minTime) / totalSpan) * 100)
                );
                const widthPercent = Math.max(
                  2,
                  Math.min(100 - leftPercent, (Math.max(1, interval.durationMs) / totalSpan) * 100)
                );

                return (
                  <div
                    key={interval.id || idx}
                    data-testid={`gantt-interval-${interval.id || idx}`}
                    onMouseEnter={() => setHoveredInterval(interval)}
                    onMouseLeave={() => setHoveredInterval(null)}
                    className="group bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800/60 hover:border-slate-700/80 rounded-lg p-2.5 transition-all flex flex-col md:flex-row md:items-center gap-2"
                  >
                    {/* Left Stage Label & Metadata Column */}
                    <div className="w-full md:w-64 shrink-0 flex items-center justify-between md:justify-start gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border ${style.badgeBg} ${style.textColor} ${style.borderColor}`}
                        >
                          {style.label}
                        </span>
                        <span
                          title={interval.label}
                          className="text-xs font-semibold text-slate-200 truncate group-hover:text-white"
                        >
                          {interval.label}
                        </span>
                      </div>
                      {interval.componentName && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 rounded shrink-0">
                          {interval.componentName}
                        </span>
                      )}
                    </div>

                    {/* Timeline Track Bar */}
                    <div className="relative flex-1 h-7 bg-slate-900 rounded-md overflow-hidden border border-slate-800/40 flex items-center">
                      {/* Grid background markers */}
                      <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-15">
                        <div className="border-r border-slate-600 h-full" />
                        <div className="border-r border-slate-600 h-full" />
                        <div className="border-r border-slate-600 h-full" />
                        <div className="h-full" />
                      </div>

                      {/* Bar */}
                      <div
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                        className={`absolute h-5 rounded transition-all duration-300 flex items-center px-1.5 shadow-sm cursor-pointer ${
                          style.barColor
                        } ${
                          interval.status === 'failed'
                            ? 'opacity-80 border border-rose-400'
                            : interval.status === 'in_progress'
                              ? 'animate-pulse'
                              : 'opacity-90 hover:opacity-100'
                        }`}
                      >
                        <span className="text-[10px] font-mono font-bold text-white truncate drop-shadow-sm">
                          {formatDuration(interval.durationMs)}
                        </span>
                      </div>
                    </div>

                    {/* Right Duration & Status Badge */}
                    <div className="w-full md:w-28 shrink-0 flex items-center justify-end gap-2 text-right">
                      <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-200">
                        {interval.durationMs.toLocaleString()}ms
                      </span>
                      {interval.status === 'completed' || interval.status === 'passed' ? (
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="Passed" />
                      ) : interval.status === 'failed' ? (
                        <ExclamationCircleIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" title="Failed" />
                      ) : interval.status === 'revised' ? (
                        <ArrowPathIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Revised" />
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              // Component Grouped View
              groupedIntervals.map((group, groupIdx) => (
                <div
                  key={groupIdx}
                  data-testid={`gantt-group-${groupIdx}`}
                  className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center text-xs">
                        {group.isComponent ? (
                          <CpuChipIcon className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <ChartBarIcon className="w-3 h-3 text-indigo-400" />
                        )}
                      </span>
                      <h5 className="text-xs font-bold text-slate-200 tracking-tight">
                        {group.title}
                      </h5>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {group.items.length} stages
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.items.map((interval, iIdx) => {
                      const style = PHASE_STYLES[interval.phase] || PHASE_STYLES.requirements;
                      const leftPercent = Math.max(
                        0,
                        Math.min(98, ((interval.startTime - minTime) / totalSpan) * 100)
                      );
                      const widthPercent = Math.max(
                        2,
                        Math.min(100 - leftPercent, (Math.max(1, interval.durationMs) / totalSpan) * 100)
                      );

                      return (
                        <div
                          key={interval.id || iIdx}
                          onMouseEnter={() => setHoveredInterval(interval)}
                          onMouseLeave={() => setHoveredInterval(null)}
                          className="group bg-slate-900/60 hover:bg-slate-900 p-2 rounded border border-slate-800/40 hover:border-slate-700/60 flex flex-col md:flex-row md:items-center gap-2"
                        >
                          <div className="w-full md:w-56 shrink-0 flex items-center gap-1.5 truncate">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 border ${style.badgeBg} ${style.textColor} ${style.borderColor}`}
                            >
                              {style.label}
                            </span>
                            <span className="text-xs font-medium text-slate-300 truncate group-hover:text-white">
                              {interval.stageName || interval.label}
                            </span>
                          </div>

                          <div className="relative flex-1 h-6 bg-slate-950 rounded overflow-hidden border border-slate-800/40 flex items-center">
                            <div
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                              }}
                              className={`absolute h-4 rounded transition-all duration-300 flex items-center px-1 shadow-sm ${style.barColor} opacity-90 hover:opacity-100 cursor-pointer`}
                            />
                          </div>

                          <div className="w-full md:w-24 shrink-0 text-right text-[11px] font-mono text-slate-400">
                            {formatDuration(interval.durationMs)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
