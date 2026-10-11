import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  ArrowRightIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import { LivePreview } from '../ide/LivePreview';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface StageLivePreviewProps {
  onAdvance: (targetStage: number) => void;
  className?: string;
}

export const StageLivePreview: React.FC<StageLivePreviewProps> = ({
  onAdvance,
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
        return 'max-w-[375px] h-[667px] border-4 border-zinc-800 rounded-[36px] shadow-[0_0_50px_rgba(0,0,0,0.8)]';
      case 'tablet':
        return 'max-w-[768px] h-[720px] border-4 border-zinc-800 rounded-[28px] shadow-[0_0_50px_rgba(0,0,0,0.8)]';
      case 'desktop':
      default:
        return 'w-full h-full rounded-2xl border border-white/10';
    }
  };

  return (
    <div
      id="stageLivePreview"
      className={`h-full flex flex-col max-w-6xl mx-auto px-4 py-4 space-y-4 select-none ${className}`}
    >
      {/* ── Top Bar: Title & Viewport Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/90">
            <PlayIcon className="w-4 h-4 ml-0.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              LIVE PREVIEW
            </h2>
            <p className="text-[11px] text-slate-400">
              Interactive application execution container
            </p>
          </div>
        </div>

        {/* Viewport Switcher Pill */}
        <div className="flex items-center p-1 rounded-full bg-slate-950/[0.25] border border-white/[0.08] backdrop-blur-md relative">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewport('desktop')}
            className={`relative px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
              viewport === 'desktop'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {viewport === 'desktop' && (
              <motion.div
                layoutId="stageLivePreviewViewportGlider"
                className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
              />
            )}
            <ComputerDesktopIcon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Desktop</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewport('tablet')}
            className={`relative px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
              viewport === 'tablet'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {viewport === 'tablet' && (
              <motion.div
                layoutId="stageLivePreviewViewportGlider"
                className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
              />
            )}
            <DeviceTabletIcon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Tablet</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewport('mobile')}
            className={`relative px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
              viewport === 'mobile'
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {viewport === 'mobile' && (
              <motion.div
                layoutId="stageLivePreviewViewportGlider"
                className="absolute inset-0 rounded-full bg-white/15 border border-white/20 shadow-sm"
                transition={{ type: 'spring', stiffness: 450, damping: 25, mass: 0.8 }}
              />
            )}
            <DevicePhoneMobileIcon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Mobile</span>
          </motion.button>
        </div>

        <button
          id="advanceToResultsBtn"
          type="button"
          onClick={() => onAdvance(10)}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 border border-white/20 transition-all cursor-pointer shadow-md"
        >
          <span>Development Results</span>
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Preview Surface ── */}
      <div
        className="flex-1 min-h-[450px] flex items-center justify-center p-2 bg-slate-950/[0.25] backdrop-blur-md rounded-3xl border border-white/[0.07] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)]"
        style={{ backdropFilter: 'blur(14px)' }}
      >
        <div className={`transition-all duration-300 w-full overflow-hidden flex flex-col ${getViewportDimensions()}`}>
          <LivePreview
            codebase={codebase}
            blueprint={currentBlueprint}
            autoStart={true}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default StageLivePreview;
