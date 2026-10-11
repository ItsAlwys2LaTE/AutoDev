import React from 'react';
import { useAppStore } from '../stores/appStore';

export interface RestorationBannerProps {
  className?: string;
}

export const RestorationBanner: React.FC<RestorationBannerProps> = ({ className = '' }) => {
  const restorationBanner = useAppStore((state) => state.restorationBanner);
  const dismissRestorationBanner = useAppStore((state) => state.dismissRestorationBanner);

  const isVisible = restorationBanner.visible;
  const message = restorationBanner.message || 'Restored previous development session. Resuming...';

  return (
    <div
      id="restorationBanner"
      className={`${
        isVisible ? '' : 'hidden '
      }mb-6 p-4 rounded-2xl border border-white/15 bg-slate-950/[0.2] backdrop-blur-md text-slate-200 flex items-center justify-between shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] fade-in ${className}`}
      style={{ backdropFilter: 'blur(14px)' }}
    >
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-white/80 animate-ping"></span>
        <span id="restorationBannerText" className="text-sm font-semibold tracking-wide text-white">
          {message}
        </span>
      </div>
      <button
        type="button"
        onClick={dismissRestorationBanner}
        className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-colors focus:outline-none cursor-pointer"
      >
        Dismiss X
      </button>
    </div>
  );
};

export default RestorationBanner;
