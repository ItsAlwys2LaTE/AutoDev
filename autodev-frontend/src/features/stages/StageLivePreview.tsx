import React, { useState } from 'react';
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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <PlayIcon className="w-4 h-4 ml-0.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              LIVE PREVIEW
            </h2>
            <p className="text-[11px] text-slate-500">
              Interactive application execution container
            </p>
          </div>
        </div>

        {/* Viewport Switcher Pill */}
        <div className="flex items-center p-1 rounded-full bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewport === 'desktop'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ComputerDesktopIcon className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport('tablet')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewport === 'tablet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <DeviceTabletIcon className="w-3.5 h-3.5" />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewport === 'mobile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <DevicePhoneMobileIcon className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </button>
        </div>

        <button
          id="advanceToResultsBtn"
          type="button"
          onClick={() => onAdvance(10)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <span>Development Results</span>
          <ArrowRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Preview Surface ── */}
      <div className="flex-1 min-h-[450px] flex items-center justify-center p-2 bg-slate-100/60 rounded-3xl border border-slate-200 overflow-hidden">
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
