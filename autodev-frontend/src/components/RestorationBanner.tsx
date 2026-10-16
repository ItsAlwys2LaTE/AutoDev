import React from 'react';
import { useAppStore } from '../stores/appStore';

export interface RestorationBannerProps {
  className?: string;
}

export const RestorationBanner: React.FC<RestorationBannerProps> = ({ className = '' }) => {
  const restorationBanner = useAppStore((state) => state.restorationBanner);
  const dismissRestorationBanner = useAppStore((state) => state.dismissRestorationBanner);

  const message = restorationBanner.message || 'Development restored.';

  return (
    <div
      id="restorationBanner"
      className={`hidden ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-slate-800 dark:bg-white/80 animate-ping"></span>
        <span id="restorationBannerText" className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">
          {message}
        </span>
      </div>
      <button
        type="button"
        onClick={dismissRestorationBanner}
        className="text-xs text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-300 dark:border-white/10 transition-colors focus:outline-none cursor-pointer"
      >
        Dismiss X
      </button>
    </div>
  );
};

export default RestorationBanner;
