import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export interface SimpleProductFallbackProps {
  onProceed: () => void;
  isProcessing: boolean;
  remainingSeconds?: number;
  isCountdownActive?: boolean;
  className?: string;
}

export function SimpleProductFallback({
  onProceed,
  isProcessing,
  remainingSeconds = 30,
  isCountdownActive = false,
  className = '',
}: SimpleProductFallbackProps) {
  return (
    <div
      id="decomposeSimpleMsg"
      style={{ backdropFilter: 'blur(14px)' }}
      className={`rounded-2xl p-6 text-center border border-slate-200 dark:border-white/[0.07] bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] my-4 ${className}`}
    >
      <CheckCircleIcon className="w-8 h-8 text-slate-800 dark:text-white/80 mx-auto mb-2" />
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
        Simple Product Detected
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No decomposition needed. Proceeding with single-pass pipeline...
      </p>

      <button
        id="simpleDesignBtn"
        type="button"
        onClick={onProceed}
        disabled={isProcessing}
        className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/10 dark:hover:bg-white/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed border border-slate-800 dark:border-white/20 font-semibold py-3.5 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-sm cursor-pointer"
      >
        <span>
          {isProcessing
            ? 'Generating Architecture Blueprint...'
            : isCountdownActive
            ? `Execute SYS.ARCH_MAPPER (Single Pass) (${remainingSeconds}s)`
            : 'Execute SYS.ARCH_MAPPER (Single Pass)'}
        </span>
        {isProcessing ? (
          <svg
            id="simpleDesignSpinner"
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <ArrowRightIcon className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );
}

export default SimpleProductFallback;
