import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessionStore, type ToastItem } from '../stores/sessionStore';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export interface GlassToastContainerProps {
  toasts?: ToastItem[];
}

export const GlassToastContainer: React.FC<GlassToastContainerProps> = ({ toasts: propToasts }) => {
  const isSSR = typeof window === 'undefined';
  const storeToasts = useSessionStore((s) => s.toasts) || [];
  const toasts = propToasts ?? (isSSR ? (useSessionStore.getState().toasts || []) : storeToasts);
  const removeToast = useSessionStore((s) => s.removeToast);

  if (!toasts || toasts.length === 0) return null;

  const getToastTypeConfig = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
          iconBg: 'bg-emerald-100 border border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30',
          accentBorder: 'border-emerald-400/60 dark:border-emerald-500/30',
          progressBar: 'bg-emerald-600 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
        };
      case 'error':
        return {
          icon: <ExclamationCircleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
          iconBg: 'bg-rose-100 border border-rose-300 dark:bg-rose-500/15 dark:border-rose-500/30',
          accentBorder: 'border-rose-400/60 dark:border-rose-500/35',
          progressBar: 'bg-rose-600 dark:bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]',
        };
      case 'warning':
        return {
          icon: <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
          iconBg: 'bg-amber-100 border border-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30',
          accentBorder: 'border-amber-400/60 dark:border-amber-500/30',
          progressBar: 'bg-amber-600 dark:bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
        };
      case 'info':
      default:
        return {
          icon: <InformationCircleIcon className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />,
          iconBg: 'bg-sky-100 border border-sky-300 dark:bg-cyan-500/15 dark:border-cyan-500/30',
          accentBorder: 'border-sky-400/60 dark:border-cyan-500/25',
          progressBar: 'bg-sky-600 dark:bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
        };
    }
  };

  return (
    <div
      id="glassToastContainer"
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 pointer-events-none max-w-[92vw] sm:max-w-xl w-full"
      role="region"
      aria-label="System Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const config = getToastTypeConfig(toast.type);
          const durationSec = (toast.durationMs && toast.durationMs > 0 ? toast.durationMs : 5000) / 1000;

          return (
            <motion.div
              key={toast.id}
              id={`glassToast-${toast.id}`}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.92, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={`pointer-events-auto relative overflow-hidden rounded-full bg-white/95 dark:bg-slate-950/85 backdrop-blur-2xl border ${config.accentBorder} shadow-[0_12px_36px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.18)] pl-3 pr-3.5 py-2 sm:py-2.5 flex items-center gap-3 text-xs text-slate-900 dark:text-white max-w-full select-none`}
              style={{ backdropFilter: 'blur(20px)' }}
            >
              {/* Type Icon in pill badge */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${config.iconBg}`}
              >
                {config.icon}
              </div>

              {/* Notification Title (Simple & Specific, no message preview) */}
              <div className="flex items-center min-w-0 flex-1 leading-snug">
                <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 tracking-tight truncate">
                  {toast.title || toast.message}
                </span>
              </div>

              {/* Manual Dismiss Button */}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 shrink-0 cursor-pointer ml-1"
                title="Dismiss notification"
                aria-label="Dismiss notification"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>

              {/* Decreasing Progress Bar (Indicates 5-second auto-dismissal) */}
              <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden rounded-b-full">
                <motion.div
                  className={`h-full ${config.progressBar}`}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: durationSec, ease: 'linear' }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default GlassToastContainer;
