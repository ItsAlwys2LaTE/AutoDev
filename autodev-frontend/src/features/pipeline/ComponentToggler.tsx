import { useAppStore } from '../../stores/appStore';
import type { ComponentSpec } from '../../types';

export interface StatusConfig {
  dotClass: string;
  badgeText: string;
  badgeClass: string;
}

export function getComponentStatusConfig(status: string = 'queued'): StatusConfig {
  const s = status ? status.toLowerCase() : 'queued';
  if (s === 'passed' || s === 'completed') {
    return {
      dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
      badgeText: 'Passed',
      badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    };
  }
  if (
    s === 'designing' ||
    s === 'coding' ||
    s === 'executing' ||
    s === 'critiquing' ||
    s === 'in_stage'
  ) {
    return {
      dotClass: 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]',
      badgeText:
        s === 'designing'
          ? 'Designing...'
          : s === 'coding'
          ? 'Coding...'
          : s === 'executing'
          ? 'Executing Tests...'
          : 'Evaluating...',
      badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    };
  }
  if (s.includes('waiting') || s === 'stalled') {
    return {
      dotClass: 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]',
      badgeText: 'Action Required',
      badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    };
  }
  if (s === 'failed' || s === 'quarantined') {
    return {
      dotClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
      badgeText: 'Failed',
      badgeClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    };
  }
  // Default queued
  return {
    dotClass: 'bg-slate-400 dark:bg-slate-500',
    badgeText:
      s === 'coding_queued'
        ? 'Queued for Code'
        : s === 'critic_queued'
        ? 'Queued for Tests'
        : 'Queued for Design',
    badgeClass: 'text-slate-400 bg-slate-800 border-slate-700',
  };
}

export interface ComponentTogglerProps {
  /** Component queue list; defaults to useAppStore pipelineQueue */
  queue?: ComponentSpec[];
  /** Active component ID; defaults to useAppStore activeComponentId */
  activeId?: string | null;
  /** Selection callback */
  onSelectComponent?: (componentId: string) => void;
  /** Wrapper class name */
  className?: string;
}

export function ComponentToggler({
  queue: propQueue,
  activeId: propActiveId,
  onSelectComponent,
  className = '',
}: ComponentTogglerProps) {
  // Support both SSR (useAppStore.getState() in Node / renderToString) and client reactivity (useAppStore hook)
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const storeQueue = useAppStore((s) => s.pipelineQueue);
  const storeActiveId = useAppStore((s) => s.activeComponentId);
  const storeComponentStates = useAppStore((s) => s.componentStates);
  const setActiveComponent = useAppStore((s) => s.setActiveComponent);

  const queue = propQueue !== undefined
    ? propQueue
    : (isSSR ? (liveStore?.pipelineQueue ?? storeQueue) : storeQueue) ?? [];
  const activeId = propActiveId !== undefined
    ? propActiveId
    : (isSSR ? (liveStore?.activeComponentId ?? storeActiveId) : storeActiveId);
  const componentStates = isSSR
    ? (liveStore?.componentStates ?? storeComponentStates)
    : storeComponentStates;

  if (queue.length === 0) {
    return null;
  }

  const handlePillClick = (componentId: string) => {
    setActiveComponent(componentId);
    if (onSelectComponent) {
      onSelectComponent(componentId);
    }

    // Smoothly scroll the corresponding workspace into view safely
    if (typeof document !== 'undefined') {
      const workspaceEl = document.getElementById(`workspace-${componentId}`);
      if (workspaceEl && typeof workspaceEl.scrollIntoView === 'function') {
        workspaceEl.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }
  };

  return (
    <div className={`flex justify-center mb-6 ${className}`}>
      <div
        id="componentToggler"
        role="tablist"
        aria-label="Component Workspace Selector"
        className="inline-flex bg-slate-800/90 dark:bg-slate-800/90 p-1.5 rounded-full shadow-inner overflow-x-auto max-w-full custom-scrollbar items-center gap-1 border border-slate-700/60"
      >
        {queue.map((component) => {
          const cId = component.component_id;
          const isActive = activeId === cId;
          const status = componentStates[cId]?.status || 'queued';
          const { dotClass } = getComponentStatusConfig(status);

          return (
            <button
              key={cId}
              id={`toggler-pill-${cId}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`workspace-${cId}`}
              type="button"
              onClick={() => handlePillClick(cId)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer ${
                isActive
                  ? 'bg-slate-700 text-white shadow-sm ring-1 ring-cyan-500/50 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 transition-colors ${dotClass}`}
                aria-hidden="true"
              />
              <span className="truncate max-w-[160px] sm:max-w-[200px]">
                {component.component_name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ComponentToggler;
