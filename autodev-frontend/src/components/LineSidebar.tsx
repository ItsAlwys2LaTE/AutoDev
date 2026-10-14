import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  LockClosedIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export interface StageTimelineItem {
  displayNumber: number; // 1 to 10
  targetStage: number;   // 2 to 11 in internal App stage state
  name: string;
  category: string;
}

export const PIPELINE_STAGES: StageTimelineItem[] = [
  { displayNumber: 1, targetStage: 2, name: 'Product Enquiry', category: 'Specification' },
  { displayNumber: 2, targetStage: 3, name: 'System Requirements', category: 'Analysis' },
  { displayNumber: 3, targetStage: 4, name: 'Architecture Decomposition', category: 'Design' },
  { displayNumber: 4, targetStage: 5, name: 'Component Pipeline', category: 'Implementation' },
  { displayNumber: 5, targetStage: 6, name: 'Integration Engine', category: 'Synthesis' },
  { displayNumber: 6, targetStage: 7, name: 'Final Source Code', category: 'Inspection' },
  { displayNumber: 7, targetStage: 8, name: 'Live Preview', category: 'Simulation' },
  { displayNumber: 8, targetStage: 9, name: 'Development Results', category: 'Delivery' },
  { displayNumber: 9, targetStage: 10, name: 'Post-Dev Support Request', category: 'Maintenance' },
  { displayNumber: 10, targetStage: 11, name: 'Post-Dev Execution', category: 'Evolution' },
];

export interface LineSidebarProps {
  currentStage: number;
  maxUnlockedStage: number;
  minNavigableStage: number;
  onNavigate: (targetStage: number) => void;
  className?: string;
}

export const LineSidebar: React.FC<LineSidebarProps> = ({
  currentStage,
  maxUnlockedStage,
  minNavigableStage,
  onNavigate,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If in pre-development product request stage (Stage 1), the SDLC has not started yet
  if (currentStage < 2) {
    return null;
  }

  // Current stage display number (1-based from Product Enquiry)
  const currentDisplayNumber = Math.max(1, Math.min(10, currentStage - 1));

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const isStageNavigable = (targetStage: number) => {
    if (targetStage < minNavigableStage) return false;
    if (targetStage > maxUnlockedStage) return false;
    return true;
  };

  return (
    <div
      id="lineSidebarContainer"
      className={`fixed left-4 sm:left-6 top-24 sm:top-28 z-40 select-none ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="wait">
        {!isHovered ? (
          /* ── 1. Collapsed Resting Badge: Stage Number on Left Side of Container ── */
          <motion.div
            key="collapsedStageBadge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            id="stageNumberCollapsedBadge"
            className="group flex flex-col items-center justify-center w-12 h-14 rounded-2xl bg-slate-950/45 hover:bg-slate-950/70 backdrop-blur-2xl border border-white/15 hover:border-white/35 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] cursor-pointer transition-all"
            style={{ backdropFilter: 'blur(16px)' }}
          >
            <span className="text-[9px] font-mono tracking-widest text-slate-400 group-hover:text-slate-200 font-semibold uppercase leading-none">
              STAGE
            </span>
            <span className="text-base font-mono font-bold text-white group-hover:text-purple-300 leading-none mt-1 transition-colors">
              {currentDisplayNumber < 10 ? `0${currentDisplayNumber}` : currentDisplayNumber}
            </span>
            <div className="w-4 h-0.5 rounded-full bg-purple-400/80 mt-1 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
          </motion.div>
        ) : (
          /* ── 2. Expanded Floating Line Sidebar: All Pipeline Stages in Order ── */
          <motion.div
            key="expandedLineSidebar"
            initial={{ opacity: 0, scale: 0.95, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            id="lineSidebarExpandedPanel"
            className="w-72 sm:w-80 rounded-3xl bg-slate-950/[0.88] backdrop-blur-3xl border border-white/15 p-4 sm:p-5 shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.14)] text-white"
            style={{ backdropFilter: 'blur(24px)' }}
          >
            {/* Header with Title and Current Stage Indicator */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  SDLC Pipeline
                </h3>
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-[10px] font-mono font-bold text-purple-300">
                {`STAGE ${currentDisplayNumber}/10`}
              </div>
            </div>

            {/* Vertical Line Timeline List */}
            <div className="relative space-y-1.5 pl-6">
              {/* Continuous Background Vertical Line */}
              <div
                className="absolute left-[9px] top-2.5 bottom-2.5 w-0.5 bg-white/10 rounded-full"
                aria-hidden="true"
              />

              {PIPELINE_STAGES.map((stage) => {
                const isCurrent = stage.targetStage === currentStage;
                const navigable = isStageNavigable(stage.targetStage);
                const isCompleted = stage.targetStage < currentStage && navigable;

                return (
                  <div
                    key={stage.displayNumber}
                    className="relative flex items-center"
                  >
                    {/* Timeline Node Pip on the Vertical Line */}
                    <div
                      className={`absolute -left-6 w-5 h-5 flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'z-10'
                          : 'z-0'
                      }`}
                    >
                      {isCurrent ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-white ring-4 ring-purple-500/40 shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
                      ) : isCompleted ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      ) : navigable ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-700" />
                      )}
                    </div>

                    {/* Stage Row Button */}
                    <button
                      type="button"
                      disabled={!navigable}
                      onClick={() => {
                        if (navigable) {
                          onNavigate(stage.targetStage);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left transition-all ${
                        isCurrent
                          ? 'bg-white/15 border border-white/25 text-white font-semibold shadow-sm'
                          : navigable
                          ? 'hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer'
                          : 'opacity-35 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-mono text-[11px] font-bold shrink-0 ${
                            isCurrent
                              ? 'text-purple-300'
                              : navigable
                              ? 'text-slate-400'
                              : 'text-slate-600'
                          }`}
                        >
                          {stage.displayNumber < 10 ? `0${stage.displayNumber}` : stage.displayNumber}
                        </span>
                        <span className="text-xs truncate">
                          {stage.name}
                        </span>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isCurrent ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/25 border border-purple-400/30 text-purple-200">
                            Active
                          </span>
                        ) : isCompleted ? (
                          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
                        ) : !navigable ? (
                          <LockClosedIcon className="w-3 h-3 text-slate-600" />
                        ) : null}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LineSidebar;
