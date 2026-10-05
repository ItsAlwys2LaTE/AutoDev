import React from 'react';
import { useSessionStore, type ToastItem } from '../stores/sessionStore';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export const GlassToastContainer: React.FC = () => {
  const toasts = useSessionStore((s) => s.toasts);
  const removeToast = useSessionStore((s) => s.removeToast);

  if (!toasts || toasts.length === 0) return null;

  const renderIcon = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error':
        return <ExclamationCircleIcon className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <InformationCircleIcon className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <div
      id="glassToastContainer"
      className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.9)] p-4 text-xs text-white flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          {renderIcon(toast.type)}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4 className="font-semibold text-xs text-slate-100 mb-0.5 tracking-wide">
                {toast.title}
              </h4>
            )}
            <p className="text-slate-300 leading-relaxed break-words">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default GlassToastContainer;
