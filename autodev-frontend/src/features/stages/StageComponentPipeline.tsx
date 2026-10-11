import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  RectangleGroupIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { PipelineDashboard } from '../pipeline/PipelineDashboard';
import { PipelineAssemblyLine } from '../pipeline/PipelineAssemblyLine';
import { ScrollFade } from '../../components/ScrollFade';

export interface StageComponentPipelineProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export type PipelineViewMode = 'visualizer' | 'componentwise';

export const StageComponentPipeline: React.FC<StageComponentPipelineProps> = ({
  onAdvance,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<PipelineViewMode>('componentwise');

  const setActiveComponent = useAppStore((s) => s.setActiveComponent);
  const pipelineQueue = useAppStore((s) => s.pipelineQueue) || [];
  const componentStates = useAppStore((s) => s.componentStates) || {};

  // Check if all components have completed
  const passedCount = pipelineQueue.filter((c) => {
    const st = componentStates[c.component_id]?.status;
    return st === 'passed' || st === 'COMPLETED';
  }).length;
  const totalCount = pipelineQueue.length;
  const allPassed = totalCount > 0 && passedCount === totalCount;

  const hasAutoAdvancedRef = useRef(false);

  // Auto-advance to integration phase when all components finish development
  useEffect(() => {
    if (!allPassed) {
      hasAutoAdvancedRef.current = false;
      return;
    }

    if (hasAutoAdvancedRef.current) return;

    const timer = setTimeout(() => {
      hasAutoAdvancedRef.current = true;
      onAdvance(8);
    }, 1500);

    return () => clearTimeout(timer);
  }, [allPassed, onAdvance]);

  return (
    <div
      id="stageComponentPipeline"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-2 space-y-2.5 sm:space-y-3 select-none ${className}`}
    >
      {/* ── Top Header matching Requirements and Decomposition agents with Toggle on right ── */}
      <div className="space-y-1.5 pb-2 border-b border-white/[0.07]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] shrink-0">
              <RectangleGroupIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
              Component Pipeline Agent
            </h2>
          </div>

          {/* Visualizer vs Componentwise Toggle on right side of title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center p-1 rounded-full bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.08] shadow-inner relative">
              <motion.button
                id="togglePipelineVisualizerBtn"
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewMode('visualizer')}
                className={`relative px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  viewMode === 'visualizer'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {viewMode === 'visualizer' && (
                  <motion.div
                    layoutId="stagePipelineViewModeGlider"
                    className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">PIPELINE VISUALIZER</span>
              </motion.button>
              <motion.button
                id="toggleComponentwiseBtn"
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewMode('componentwise')}
                className={`relative px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  viewMode === 'componentwise'
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {viewMode === 'componentwise' && (
                  <motion.div
                    layoutId="stagePipelineViewModeGlider"
                    className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">COMPONENTWISE VISUALIZATION</span>
              </motion.button>
            </div>
          </div>
        </div>

        <p className="text-xs md:text-sm text-slate-300">
          Autonomous parallel component development, code synthesis, container testing, and multi-critic arbitration.
        </p>
      </div>

      {/* ── Main View Body with Dynamic ScrollFade ── */}
      <ScrollFade className="flex-1 min-h-0 overflow-y-auto">
        {/* PIPELINE VISUALIZER: Space-Time Matrix Visualizer */}
        <div className={viewMode === 'visualizer' ? 'block' : 'hidden'}>
          <PipelineAssemblyLine
            id="pipelineVisualizerCanvas"
            enableTicker={false}
            onSelectComponent={(componentId) => {
              setActiveComponent(componentId);
              setViewMode('componentwise');
            }}
          />
        </div>

        {/* COMPONENTWISE VISUALIZATION */}
        <div className={viewMode === 'componentwise' ? 'block' : 'hidden'}>
          <div className="pt-0.5">
            <PipelineDashboard
              alwaysRender={true}
              onIntegrate={() => onAdvance(8)}
            />
          </div>
        </div>
      </ScrollFade>
    </div>
  );
};

export default StageComponentPipeline;
