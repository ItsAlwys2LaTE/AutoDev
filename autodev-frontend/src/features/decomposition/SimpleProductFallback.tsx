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
      className={`glass-card rounded-xl p-6 text-center border border-emerald-500/20 bg-emerald-500/5 my-4 ${className}`}
    >
      <CheckCircleIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
      <p className="text-lg font-semibold text-emerald-400 mb-1">
        Simple Product Detected
      </p>
      <p className="text-sm text-slate-400">
        No decomposition needed. Proceeding with single-pass pipeline...
      </p>

      <button
        id="simpleDesignBtn"
        type="button"
        onClick={onProceed}
        disabled={isProcessing}
        className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex justify-center items-center gap-2 transition-all shadow-sm cursor-pointer"
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
