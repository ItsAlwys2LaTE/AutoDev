import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { LivePreview } from '../ide/LivePreview';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface StageLivePreviewProps {
  onAdvance?: (targetStage: number) => void;
  className?: string;
}

export const StageLivePreview: React.FC<StageLivePreviewProps> = ({
  onAdvance: _onAdvance,
  className = '',
}) => {
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const storeIntegratedCodebase = useAppStore((s) => s.integratedCodebase);
  const storeCurrentCodebase = useAppStore((s) => s.currentCodebase);
  const currentBlueprint = useAppStore((s) => s.currentBlueprint);

  const codebase = storeIntegratedCodebase || storeCurrentCodebase;

  const getViewportDimensions = () => {
    switch (viewport) {
      case 'mobile':
        return 'w-[375px] max-w-full h-full max-h-[700px] border-[6px] border-zinc-800/90 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] bg-zinc-950';
      case 'tablet':
        return 'w-[768px] max-w-full h-full max-h-[720px] border-[6px] border-zinc-800/90 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] bg-zinc-950';
      case 'desktop':
      default:
        return 'w-full h-full rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-slate-950/[0.25]';
    }
  };

  return (
    <div
      id="stageLivePreview"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-3 space-y-3.5 select-none ${className}`}
    >
      {/* ── Top Bar: Title & Viewport Switcher ── */}
      <div className="space-y-1.5 pb-2 border-b border-white/[0.07]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] shrink-0">
              <PlayIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 ml-0.5" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
              Live Preview
            </h2>
          </div>

          {/* Viewport Switcher Pill */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-slate-950/[0.25] border border-white/[0.08] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_16px_rgba(0,0,0,0.1)] shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewport('desktop')}
              className={`relative px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                viewport === 'desktop'
                  ? 'text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {viewport === 'desktop' && (
                <motion.div
                  layoutId="stageLivePreviewViewportGlider"
                  className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                  transition={{ type: 'spring', stiffness: 450, damping: 26, mass: 0.8 }}
                />
              )}
              <ComputerDesktopIcon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Desktop</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewport('tablet')}
              className={`relative px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                viewport === 'tablet'
                  ? 'text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {viewport === 'tablet' && (
                <motion.div
                  layoutId="stageLivePreviewViewportGlider"
                  className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                  transition={{ type: 'spring', stiffness: 450, damping: 26, mass: 0.8 }}
                />
              )}
              <DeviceTabletIcon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Tablet</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewport('mobile')}
              className={`relative px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                viewport === 'mobile'
                  ? 'text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {viewport === 'mobile' && (
                <motion.div
                  layoutId="stageLivePreviewViewportGlider"
                  className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                  transition={{ type: 'spring', stiffness: 450, damping: 26, mass: 0.8 }}
                />
              )}
              <DevicePhoneMobileIcon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Mobile</span>
            </motion.button>
          </div>
        </div>
        <p className="text-xs md:text-sm text-slate-300">
          Interactive fullstack application execution container with live preview, auto-reload, and multi-device simulation.
        </p>
      </div>

      {/* ── Preview Surface ── */}
      <div
        className="flex-1 min-h-[480px] flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-950/[0.25] backdrop-blur-md rounded-3xl border border-white/[0.07] overflow-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] relative"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div
          className={`transition-all duration-300 mx-auto my-auto flex flex-col overflow-hidden ${getViewportDimensions()}`}
        >
          {/* Simulated Mobile Device Header */}
          {viewport === 'mobile' && (
            <div className="pt-2 pb-1 bg-zinc-950 flex items-center justify-center shrink-0">
              <div className="w-20 h-3.5 bg-zinc-900 rounded-full flex items-center justify-end pr-2 shadow-inner">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700/80" />
              </div>
            </div>
          )}

          {/* Simulated Tablet Device Header */}
          {viewport === 'tablet' && (
            <div className="pt-1.5 pb-1 bg-zinc-950 flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-zinc-700/80 shadow-inner" />
            </div>
          )}

          {/* Core Live Preview Workspace */}
          <div className="flex-1 w-full min-h-0 overflow-hidden flex flex-col">
            <LivePreview
              codebase={codebase}
              blueprint={currentBlueprint}
              autoStart={true}
              className="w-full h-full"
            />
          </div>

          {/* Simulated Device Home Indicator Footer */}
          {viewport === 'mobile' && (
            <div className="py-1.5 bg-zinc-950 flex items-center justify-center shrink-0">
              <div className="w-28 h-1 bg-white/20 rounded-full" />
            </div>
          )}
          {viewport === 'tablet' && (
            <div className="py-1.5 bg-zinc-950 flex items-center justify-center shrink-0">
              <div className="w-32 h-1 bg-white/20 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StageLivePreview;
