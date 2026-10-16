/**
 * AutoDev Component Pipeline Matrix Visualizer
 *
 * Implements a matrix-style pipeline visualizer for AutoDev's multi-component DAG execution:
 * - Columns: Phase Agent names (Design Agent, CodeGen Agent, Critic Agent, Integration Agent)
 * - Rows: Time units (T1, T2, T3, ... Tn) representing discrete space-time progression
 * - Cells: Display which components are currently in which agent at that time unit
 * - Component Representation: STRICTLY component numbers (C1, C2, etc.) and their theme colors.
 *   Zero component types, zero full component names, zero raw IDs in cells.
 * - Glassmorphic aesthetics: Apple iOS obsidian glass, frosted badges, crisp specular borders
 * - Multi-component concurrency per agent and dynamic revision loop tracing
 * - Strict zero-emoji compliance
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  DocumentTextIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { usePipelineTicker } from './usePipelineTicker';
import { getComponentTheme } from '../../utils/componentTheme';
import { ModernScrollbar } from '../../components/ModernScrollbar';
import type { ComponentTrackState, TimelineInterval } from '../../types';

export interface PipelineAssemblyLineProps {
  id?: string;
  className?: string;
  onSelectComponent?: (componentId: string) => void;
  enableTicker?: boolean;
}

export type StationKey = 'design' | 'codegen' | 'critics' | 'completed';

export interface AgentColumnConfig {
  key: StationKey;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const PHASE_AGENTS: AgentColumnConfig[] = [
  {
    key: 'design',
    name: 'Design Agent',
    shortName: 'Design',
    icon: DocumentTextIcon,
    accentColor: '#818cf8',
  },
  {
    key: 'codegen',
    name: 'CodeGen Agent',
    shortName: 'CodeGen',
    icon: CodeBracketIcon,
    accentColor: '#38bdf8',
  },
  {
    key: 'critics',
    name: 'Critic Agent',
    shortName: 'Critic',
    icon: ShieldCheckIcon,
    accentColor: '#fb7185',
  },
  {
    key: 'completed',
    name: 'Completed',
    shortName: 'Completed',
    icon: CheckCircleIcon,
    accentColor: '#34d399',
  },
];

export interface MatrixRow {
  timeUnit: string;
  timeIndex: number;
  timestamp: number;
  isActive: boolean;
  cells: Record<StationKey, string[]>;
  revisions?: Record<string, number>;
}

/**
 * Resolves which agent a component currently occupies based on its track state.
 */
export function getComponentAgent(state?: ComponentTrackState | null): StationKey | null {
  if (!state) return null;
  const status = String(state.status || '');
  const stage = String(state.currentStage || '').toUpperCase();

  // Completed column (status passed / COMPLETED, or stage INTEGRATION / COMPLETED)
  if (status === 'passed' || status === 'COMPLETED' || stage === 'INTEGRATION' || stage === 'COMPLETED') {
    return 'completed';
  }
  // Critic Agent (Sandbox execution & Tri-critic arbitration)
  if (
    stage === 'CRITICS' ||
    status === 'executing' ||
    status === 'critiquing' ||
    status === 'waiting_critic' ||
    status === 'critic_queued'
  ) {
    return 'critics';
  }
  // CodeGen Agent (Synthesis & Revision code synthesis)
  if (
    stage === 'CODEGEN' ||
    status === 'coding' ||
    status === 'coding_queued' ||
    status === 'waiting_code' ||
    status === 'revise' ||
    status === 'waiting_revision' ||
    status === 'failed'
  ) {
    return 'codegen';
  }
  // Design Agent
  if (stage === 'DESIGN' || status === 'designing' || status === 'waiting_design') {
    return 'design';
  }
  return null;
}

/**
 * Module-level in-memory cache to preserve snapshot timeline across view mode toggles.
 */
const timelineCache = new Map<string, MatrixRow[]>();

/**
 * Deterministically serializes phase station cell allocations into a canonical string.
 * Uses consistent key and value ordering to prevent JSON object insertion-order mismatches.
 */
export function serializeAllocation(
  cells?: Record<string, string[]> | { design?: string[]; codegen?: string[]; critics?: string[]; completed?: string[] }
): string {
  if (!cells) return '';
  const design = [...(cells.design || [])].sort().join(',');
  const codegen = [...(cells.codegen || [])].sort().join(',');
  const critics = [...(cells.critics || [])].sort().join(',');
  const completed = [...(cells.completed || [])].sort().join(',');
  return `design:[${design}]|codegen:[${codegen}]|critics:[${critics}]|completed:[${completed}]`;
}

/**
 * Sanitizes matrix rows by removing any row where all stations are empty,
 * and re-indexing the timeUnit labels sequentially (T1, T2, etc.).
 */
export function sanitizeRows(rows: MatrixRow[]): MatrixRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const validRows = rows.filter((r) => {
    const d = r.cells?.design?.length || 0;
    const c = r.cells?.codegen?.length || 0;
    const cr = r.cells?.critics?.length || 0;
    const comp = r.cells?.completed?.length || 0;
    return d + c + cr + comp > 0;
  });
  return validRows.map((r, idx) => ({
    ...r,
    timeIndex: idx + 1,
    timeUnit: `T${idx + 1}`,
  }));
}

/**
 * Loads stored matrix rows from Zustand store, in-memory cache, or localStorage.
 */
function loadStoredMatrixRows(fingerprint: string): MatrixRow[] {
  if (!fingerprint || fingerprint === 'empty') return [];

  // 1. Check Zustand store
  const storeRows = useAppStore.getState().pipelineMatrixRows;
  if (Array.isArray(storeRows) && storeRows.length > 0) {
    return sanitizeRows(storeRows);
  }

  // 2. Check in-memory module cache
  if (timelineCache.has(fingerprint)) {
    return sanitizeRows(timelineCache.get(fingerprint)!);
  }

  // 3. Check browser localStorage
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`autodev_matrix_rows_v1:${fingerprint}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeRows(parsed);
          timelineCache.set(fingerprint, sanitized);
          return sanitized;
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
}

export const PipelineAssemblyLine: React.FC<PipelineAssemblyLineProps> = ({
  id = 'pipelineVisualizerCanvas',
  className = '',
  onSelectComponent,
  enableTicker = false,
}) => {
  // Support SSR safety
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  // Active Store Subscriptions
  const storeQueue = useAppStore((s) => s.pipelineQueue);
  const storeStates = useAppStore((s) => s.componentStates);
  const storeMetrics = useAppStore((s) => s.timelineMetrics);
  const storeIsPaused = useAppStore((s) => s.isPaused);

  const pipelineQueue = (isSSR ? (liveStore?.pipelineQueue ?? storeQueue) : storeQueue) || [];
  const componentStates = (isSSR ? (liveStore?.componentStates ?? storeStates) : storeStates) || {};
  const timelineMetrics = (isSSR ? (liveStore?.timelineMetrics ?? storeMetrics) : storeMetrics) || { intervals: [] };
  const isPaused = Boolean(isSSR ? (liveStore?.isPaused ?? storeIsPaused) : storeIsPaused);

  // Optional standalone ticker hook (when not paired with PipelineDashboard)
  usePipelineTicker({ enabled: enableTicker });

  // Unique key identifying the current queue session
  const queueFingerprint = useMemo(() => {
    return pipelineQueue.map((c) => c.component_id).join(':') || 'empty';
  }, [pipelineQueue]);

  // Compute current live allocation snapshot
  const currentAllocation = useMemo(() => {
    const allocation: Record<StationKey, string[]> = {
      design: [],
      codegen: [],
      critics: [],
      completed: [],
    };

    for (const spec of pipelineQueue) {
      const cId = spec.component_id;
      const state = componentStates[cId];
      const agent = getComponentAgent(state);
      if (agent) {
        allocation[agent].push(cId);
      }
    }

    return allocation;
  }, [pipelineQueue, componentStates]);

  // Serialized fingerprint of the current allocation to detect state shifts
  const allocationFingerprint = useMemo(() => {
    return serializeAllocation(currentAllocation);
  }, [currentAllocation]);

  // Maintain chronological recorded rows in state with 3-tier persistence
  const initialRows = useMemo(() => loadStoredMatrixRows(queueFingerprint), [queueFingerprint]);
  const [recordedRows, setRecordedRows] = useState<MatrixRow[]>(initialRows);
  const recordedRowsRef = useRef<MatrixRow[]>(initialRows);
  recordedRowsRef.current = recordedRows;

  useEffect(() => {
    if (initialRows.length > 0 && recordedRows.length === 0) {
      setRecordedRows(initialRows);
      recordedRowsRef.current = initialRows;
    }
  }, [initialRows]);

  // Track previous allocation fingerprint initialized from the last loaded row to avoid duplicate rows on mount
  const initialFingerprint = useMemo(() => {
    const rows = recordedRows.length > 0 ? recordedRows : initialRows;
    const sanitized = sanitizeRows(rows);
    if (sanitized.length > 0) {
      const lastRow = sanitized[sanitized.length - 1];
      return serializeAllocation(lastRow.cells);
    }
    return '';
  }, [queueFingerprint, initialRows]);

  const prevAllocationRef = useRef<string>(initialFingerprint);

  // Auto-scroll anchor ref to scroll down smoothly on new time units
  const tableEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If empty pipeline, clear cache and reset
    if (pipelineQueue.length === 0) {
      setRecordedRows([]);
      recordedRowsRef.current = [];
      prevAllocationRef.current = '';
      if (typeof window !== 'undefined' && queueFingerprint !== 'empty') {
        try {
          localStorage.removeItem(`autodev_matrix_rows_v1:${queueFingerprint}`);
        } catch {
          // ignore
        }
      }
      return;
    }

    // Do NOT record any row if all phase stations are completely empty (prevents empty T1 row)
    const hasAnyOccupant =
      currentAllocation.design.length > 0 ||
      currentAllocation.codegen.length > 0 ||
      currentAllocation.critics.length > 0 ||
      currentAllocation.completed.length > 0;

    if (!hasAnyOccupant) {
      return;
    }

    const currentHash = allocationFingerprint;
    const currentRows = recordedRowsRef.current;

    // Check if current allocation matches the last recorded row (prevents duplicates when returning from component inspection)
    const lastRow = currentRows[currentRows.length - 1];
    const lastRowHash = lastRow ? serializeAllocation(lastRow.cells) : '';

    if (
      (currentHash === prevAllocationRef.current || currentHash === lastRowHash) &&
      currentRows.length > 0
    ) {
      prevAllocationRef.current = currentHash;
      return;
    }
    prevAllocationRef.current = currentHash;

    // Capture revision snapshot for all components at this time unit
    const revSnapshot: Record<string, number> = {};
    for (const spec of pipelineQueue) {
      const cId = spec.component_id;
      const st = componentStates[cId];
      if (st?.revisionCount) {
        revSnapshot[cId] = st.revisionCount;
      }
    }

    setRecordedRows((prev) => {
      const sanitizedPrev = sanitizeRows(prev);
      // Mark all past rows as inactive
      const updatedPrev = sanitizedPrev.map((r) => ({ ...r, isActive: false }));
      const nextIndex = updatedPrev.length + 1;
      const newRow: MatrixRow = {
        timeUnit: `T${nextIndex}`,
        timeIndex: nextIndex,
        timestamp: Date.now(),
        isActive: true,
        cells: {
          design: [...currentAllocation.design],
          codegen: [...currentAllocation.codegen],
          critics: [...currentAllocation.critics],
          completed: [...currentAllocation.completed],
        },
        revisions: revSnapshot,
      };
      // Cap at 60 rows to prevent memory exhaustion and browser freezing
      const trimmed = updatedPrev.length >= 60 ? updatedPrev.slice(updatedPrev.length - 59) : updatedPrev;
      const nextRows = [...trimmed, newRow];
      recordedRowsRef.current = nextRows;
      timelineCache.set(queueFingerprint, nextRows);
      useAppStore.getState().setPipelineMatrixRows(nextRows);
      if (typeof window !== 'undefined' && queueFingerprint !== 'empty') {
        try {
          localStorage.setItem(`autodev_matrix_rows_v1:${queueFingerprint}`, JSON.stringify(nextRows));
        } catch {
          // ignore
        }
      }
      return nextRows;
    });
  }, [queueFingerprint, allocationFingerprint, currentAllocation, pipelineQueue, componentStates]);

  // Construct historical rows from timeline metrics if recorded rows are fewer
  const matrixRows = useMemo(() => {
    if (recordedRows.length > 0) {
      return sanitizeRows(recordedRows);
    }

    const hasAnyOccupant =
      currentAllocation.design.length > 0 ||
      currentAllocation.codegen.length > 0 ||
      currentAllocation.critics.length > 0 ||
      currentAllocation.completed.length > 0;

    // Fallback: Reconstruct from timelineMetrics if available
    const intervals: TimelineInterval[] = (timelineMetrics?.intervals || []).filter(
      (inv) => inv.componentId && pipelineQueue.some((c) => c.component_id === inv.componentId)
    );

    if (intervals.length === 0) {
      if (hasAnyOccupant) {
        const initialRow: MatrixRow = {
          timeUnit: 'T1',
          timeIndex: 1,
          timestamp: Date.now(),
          isActive: true,
          cells: currentAllocation,
        };
        return [initialRow];
      }
      return [];
    }

    // Sort distinct event start boundaries
    const startTimestamps = Array.from(new Set(intervals.map((i) => i.startTime))).sort((a, b) => a - b);
    const rows: MatrixRow[] = [];

    startTimestamps.forEach((ts) => {
      const activeAtT: Record<StationKey, string[]> = {
        design: [],
        codegen: [],
        critics: [],
        completed: [],
      };

      for (const inv of intervals) {
        if (!inv.componentId) continue;
        const isRunningAtT = inv.startTime <= ts && (inv.endTime === null || inv.endTime > ts);
        if (!isRunningAtT) continue;

        let agent: StationKey | null = null;
        if (inv.phase === 'design') agent = 'design';
        else if (inv.phase === 'codegen') agent = 'codegen';
        else if (inv.phase === 'execution' || inv.phase === 'critics') agent = 'critics';
        else if (inv.phase === 'integration' || inv.status === 'passed') agent = 'completed';

        if (agent && !activeAtT[agent].includes(inv.componentId)) {
          activeAtT[agent].push(inv.componentId);
        }
      }

      const hasOccupants =
        activeAtT.design.length > 0 ||
        activeAtT.codegen.length > 0 ||
        activeAtT.critics.length > 0 ||
        activeAtT.completed.length > 0;

      if (!hasOccupants) return;

      rows.push({
        timeUnit: `T${rows.length + 1}`,
        timeIndex: rows.length + 1,
        timestamp: ts,
        isActive: false,
        cells: activeAtT,
      });
    });

    if (rows.length > 0) {
      rows[rows.length - 1].isActive = true;
      return rows;
    }

    if (hasAnyOccupant) {
      return [
        {
          timeUnit: 'T1',
          timeIndex: 1,
          timestamp: Date.now(),
          isActive: true,
          cells: currentAllocation,
        },
      ];
    }

    return [];
  }, [recordedRows, timelineMetrics?.intervals, pipelineQueue, currentAllocation]);

  // Smooth auto-scroll down to bottom anchor when rows are added
  useEffect(() => {
    if (tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [matrixRows.length]);

  // Aggregate stats
  const activeCount = useMemo(() => {
    return Object.values(currentAllocation).reduce((acc, list) => acc + list.length, 0);
  }, [currentAllocation]);

  const allCompleted = useMemo(() => {
    if (pipelineQueue.length === 0) return false;
    return currentAllocation.completed.length === pipelineQueue.length;
  }, [pipelineQueue.length, currentAllocation.completed.length]);

  return (
    <div
      id={id}
      className={`relative rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.07] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] flex flex-col gap-6 ${className}`}
      style={{ backdropFilter: 'blur(14px)' }}
    >
      {/* ── Top Header & Status Indicators ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div>
          <h3 className="text-sm md:text-base font-semibold text-white tracking-wide">
            PIPELINE EXECUTION MATRIX
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Space-time agent allocation across discrete development time units.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Units Counter */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-300">
            <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Time Units: {matrixRows.length}</span>
          </div>

          {/* Active Status Badge */}
          {isPaused ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-medium text-amber-300">
              <PauseIcon className="w-3.5 h-3.5 text-amber-300" />
              <span>PAUSED</span>
            </div>
          ) : allCompleted ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium text-emerald-300">
              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-300" />
              <span>COMPLETED</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-xs font-medium text-sky-300">
              <PlayIcon className="w-3.5 h-3.5 text-sky-300 animate-pulse" />
              <span>LIVE ({activeCount} Active)</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Minimalist Component Chip Legend ── */}
      {pipelineQueue.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Components:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {pipelineQueue.map((spec) => {
              const theme = getComponentTheme(spec.component_id, pipelineQueue);
              const revCount = componentStates[spec.component_id]?.revisionCount || 0;
              const asterisks = '*'.repeat(Math.max(0, revCount));
              return (
                <button
                  key={spec.component_id}
                  type="button"
                  onClick={() => onSelectComponent?.(spec.component_id)}
                  style={{
                    backgroundColor: theme.badgeBg,
                    borderColor: theme.borderTint,
                    color: theme.color,
                  }}
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold tracking-wider hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-hidden"
                  title={`Inspect Component ${theme.number}${revCount > 0 ? ` (${revCount} revision${revCount > 1 ? 's' : ''})` : ''}`}
                >
                  {theme.number}{asterisks}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Matrix Table ── */}
      {pipelineQueue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <ClockIcon className="w-8 h-8 text-slate-500 mb-2 stroke-1" />
          <p className="text-sm font-medium text-slate-300">No components in pipeline yet</p>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Components will be allocated to phase agents upon DAG decomposition completion.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-slate-950/60">
          <ModernScrollbar className="w-full max-h-[520px]">
            <div className="min-w-[620px]">
              <table className="w-full border-collapse text-left">
                {/* Table Header: Phase Agent Names as Columns */}
                <thead>
                  <tr className="border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-md">
                    {/* Time Unit Row Label Column */}
                    <th className="py-3.5 px-4 text-xs font-semibold tracking-wider uppercase text-slate-400 w-28 text-left">
                      <div className="flex items-center gap-1.5">
                        <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Time Unit</span>
                      </div>
                    </th>

                    {/* Phase Agent Columns */}
                    {PHASE_AGENTS.map((agent) => {
                      const Icon = agent.icon;
                      return (
                        <th
                          key={agent.key}
                          className="py-3.5 px-4 text-xs font-semibold tracking-wider uppercase text-slate-300 text-center"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                            <span>{agent.name}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Table Body: Time Units as Rows */}
                <tbody>
                  {matrixRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs font-mono text-slate-400">
                        Awaiting component allocation to phase agents...
                      </td>
                    </tr>
                  ) : (
                    matrixRows.map((row) => (
                      <tr
                        key={row.timeUnit}
                        className={`border-b border-white/[0.04] transition-all duration-300 ease-out animate-fadeIn ${
                          row.isActive
                            ? 'bg-white/[0.04] border-l-2 border-l-white/60'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Row Header: Time Unit (T1, T2, ...) */}
                        <td className="py-3.5 px-4 text-left w-28 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-200">
                              {row.timeUnit}
                            </span>
                            {row.isActive && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                  isPaused
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                                }`}
                              >
                                {isPaused ? 'PAUSED' : 'LIVE'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Phase Agent Cells */}
                        {PHASE_AGENTS.map((agent) => {
                          const occupantIds = row.cells[agent.key] || [];
                          return (
                            <td
                              key={agent.key}
                              className="py-3.5 px-4 text-center align-middle"
                            >
                              <div className="flex items-center justify-center gap-2 flex-wrap min-h-[1.75rem]">
                                {occupantIds.length > 0 ? (
                                  occupantIds.map((cId) => {
                                    const theme = getComponentTheme(cId, pipelineQueue);
                                    const revCount = row.revisions?.[cId] ?? (componentStates[cId]?.revisionCount || 0);
                                    const asterisks = '*'.repeat(Math.max(0, revCount));
                                    const badgeLabel = `${theme.number}${asterisks}`;
                                    return (
                                      <button
                                        key={cId}
                                        type="button"
                                        onClick={() => onSelectComponent?.(cId)}
                                        style={{
                                          backgroundColor: theme.badgeBg,
                                          borderColor: theme.borderTint,
                                          color: theme.color,
                                        }}
                                        className="inline-flex items-center justify-center min-w-[2.25rem] px-2.5 py-1 rounded-lg border text-xs font-mono font-bold tracking-wider shadow-xs hover:scale-110 active:scale-95 transition-all duration-300 ease-out animate-fadeIn cursor-pointer focus:outline-hidden"
                                        title={`Inspect Component ${theme.number}${revCount > 0 ? ` (${revCount} revision${revCount > 1 ? 's' : ''})` : ''}`}
                                      >
                                        {badgeLabel}
                                      </button>
                                    );
                                  })
                                ) : (
                                  <span className="text-slate-600/50 font-mono text-xs select-none">
                                    -
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div ref={tableEndRef} className="h-0 w-0 pointer-events-none" aria-hidden="true" />
            </div>
          </ModernScrollbar>
        </div>
      )}

      {/* ── Footer Summary Bar ── */}
      <div className="flex items-center justify-end text-xs text-slate-400 pt-1 border-t border-white/[0.04]">
        <div className="text-[11px] text-slate-400 font-mono">
          Click any component badge to inspect its outputs
        </div>
      </div>
    </div>
  );
};

// Export alias for flexible imports
export const PipelineMatrixVisualizer = PipelineAssemblyLine;
export default PipelineAssemblyLine;
