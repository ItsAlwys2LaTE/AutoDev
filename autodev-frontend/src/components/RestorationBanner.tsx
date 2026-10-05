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
      }mb-6 p-4 rounded-xl border border-blue-500/40 bg-blue-900/40 text-blue-200 flex items-center justify-between shadow-lg fade-in ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-blue-400 animate-ping"></span>
        <span id="restorationBannerText" className="text-sm font-semibold tracking-wide">
          {message}
        </span>
      </div>
      <button
        type="button"
        onClick={dismissRestorationBanner}
        className="text-xs text-blue-300 hover:text-white px-2 py-1 rounded transition-colors focus:outline-none"
      >
        Dismiss X
      </button>
    </div>
  );
};

export default RestorationBanner;
