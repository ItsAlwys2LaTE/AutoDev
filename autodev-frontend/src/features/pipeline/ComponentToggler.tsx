import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import type { ComponentSpec } from '../../types';
import { ScrollFade } from '../../components/ScrollFade';

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
    badgeClass: 'text-slate-400 bg-white/[0.04] border border-white/[0.07]',
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
      <ScrollFade
        id="componentToggler"
        role="tablist"
        aria-label="Component Workspace Selector"
        orientation="horizontal"
        className="inline-flex bg-slate-950/[0.12] backdrop-blur-md p-1.5 rounded-full shadow-inner overflow-x-auto max-w-full items-center gap-1 border border-white/[0.08] custom-scrollbar"
      >
        {queue.map((component) => {
          const cId = component.component_id;
          const isActive = activeId === cId;
          const status = componentStates[cId]?.status || 'queued';
          const { dotClass } = getComponentStatusConfig(status);

          return (
            <motion.button
              key={cId}
              id={`toggler-pill-${cId}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`workspace-${cId}`}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePillClick(cId)}
              className={`relative px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors duration-150 whitespace-nowrap flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="componentTogglerActivePill"
                  className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                  transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-colors ${dotClass}`}
                  aria-hidden="true"
                />
                <span className="truncate max-w-[160px] sm:max-w-[200px]">
                  {component.component_name}
                </span>
              </span>
            </motion.button>
          );
        })}
      </ScrollFade>
    </div>
  );
}

export default ComponentToggler;
