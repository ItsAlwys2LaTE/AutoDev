import React from 'react';
import {
  SparklesIcon,
  CpuChipIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

export interface StageLandingProps {
  onGetStarted: () => void;
  className?: string;
}

export const StageLanding: React.FC<StageLandingProps> = ({
  onGetStarted,
  className = '',
}) => {
  return (
    <div
      id="stageLanding"
      className={`h-full min-h-[80vh] flex flex-col items-center justify-center text-center px-4 py-12 max-w-4xl mx-auto space-y-10 select-none ${className}`}
    >
      {/* Brand Hero */}
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-400/20 text-xs font-mono text-purple-300">
          <SparklesIcon className="w-3.5 h-3.5 text-purple-400" />
          <span>AUTONOMOUS SOFTWARE ENGINEERING ENGINE</span>
        </div>

        <h1 className="font-cursive text-7xl md:text-9xl text-white font-normal italic tracking-wide leading-tight">
          AutoDev
        </h1>

        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-sans leading-relaxed">
          Multi-agent AI pipeline that designs, builds, tests, and self-corrects software from a single prompt.
        </p>
      </div>

      {/* Feature Capability Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full max-w-2xl">
        <div className="p-4 rounded-2xl bg-slate-950/[0.25] backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.2)] flex flex-col items-center text-center gap-1.5">
          <CpuChipIcon className="w-5 h-5 text-purple-400" />
          <span className="text-xs font-semibold text-slate-200">Multi-Agent DAG</span>
          <span className="text-[10px] text-slate-400">Parallel Decomposition</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-950/[0.25] backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.2)] flex flex-col items-center text-center gap-1.5">
          <CommandLineIcon className="w-5 h-5 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">Docker Sandbox</span>
          <span className="text-[10px] text-slate-400">Isolated Verification</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-950/[0.25] backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.2)] flex flex-col items-center text-center gap-1.5">
          <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">Arbitration Loop</span>
          <span className="text-[10px] text-slate-400">3-Critic Consensus</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-950/[0.25] backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.2)] flex flex-col items-center text-center gap-1.5">
          <PlayIcon className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-semibold text-slate-200">Live Preview</span>
          <span className="text-[10px] text-slate-400">Real-Time Containers</span>
        </div>
      </div>

      {/* Primary Call to Action */}
      <div className="pt-2">
        <button
          id="landingGetStartedBtn"
          type="button"
          onClick={onGetStarted}
          className="group px-9 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm shadow-sm border border-white/20 hover:border-white/30 transition-all duration-200 flex items-center gap-3 cursor-pointer backdrop-blur-md"
        >
          <span>Get Started</span>
          <ArrowRightIcon className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="text-[11px] font-mono text-slate-500">
        SYS.v2.5.0 - Emoji-Free Architecture
      </div>
    </div>
  );
};

export default StageLanding;
