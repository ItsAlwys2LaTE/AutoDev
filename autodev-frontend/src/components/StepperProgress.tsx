import React, { useEffect } from 'react';
import { useAppStore, StepperStatus } from '../stores/appStore';

export interface StepItem {
  step: number;
  label: string;
}

export const DEFAULT_STEPS: StepItem[] = [
  { step: 1, label: 'Requirements' },
  { step: 2, label: 'Decomposition' },
  { step: 3, label: 'Parallel Design' },
  { step: 4, label: 'Parallel Coding' },
  { step: 5, label: 'Final Integration' },
];

export interface StepperProgressProps {
  steps?: StepItem[];
  className?: string;
}

export const StepperProgress: React.FC<StepperProgressProps> = ({
  steps = DEFAULT_STEPS,
  className = '',
}) => {
  const stepperStates = useAppStore((state) => state.stepperStates);
  const setStepper = useAppStore((state) => state.setStepper);

  // Expose window.updateStepper for backward compatibility with legacy scripts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handler = (stepNumber: number, status: StepperStatus) => {
        setStepper(stepNumber, status);
      };
      (window as any).updateStepper = handler;
      (window as any).__reactUpdateStepper = handler;
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).updateStepper;
        delete (window as any).__reactUpdateStepper;
      }
    };
  }, [setStepper]);

  // Calculate connecting progress line percentage
  let progressWidth = 0;
  if (stepperStates[5] === 'success') {
    progressWidth = 100;
  } else {
    for (let s = 5; s >= 1; s--) {
      const st = stepperStates[s];
      if (st === 'success' || st === 'error') {
        progressWidth = Math.max(0, (s - 1) * 25);
        break;
      }
    }
  }

  return (
    <div className={`relative max-w-5xl mx-auto mb-12 ${className}`}>
      {/* Connecting Line */}
      <div className="absolute top-5 left-0 w-full h-1 bg-slate-200 z-0 rounded-full" />
      <div
        id="stepperProgress"
        className="absolute top-5 left-0 h-1 bg-blue-500 z-0 rounded-full transition-all duration-700 ease-in-out"
        style={{ width: `${progressWidth}%` }}
      />

      <div className="flex justify-between items-start relative z-10">
        {steps.map(({ step, label }) => {
          const status: StepperStatus = stepperStates[step] || 'idle';

          let iconStatusClass = 'bg-white text-slate-400 border-2 border-slate-200';
          let textStatusClass = 'text-slate-400';
          let iconContent: React.ReactNode = step;

          if (status === 'loading') {
            iconStatusClass =
              'bg-blue-600 text-white border-2 border-blue-600 animate-pulse shadow-md shadow-blue-500/30';
            textStatusClass = 'text-blue-600';
            iconContent = (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            );
          } else if (status === 'success') {
            iconStatusClass =
              'bg-green-500 text-white border-2 border-green-500 shadow-md shadow-green-500/30';
            textStatusClass = 'text-green-600';
            iconContent = (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            );
          } else if (status === 'error') {
            iconStatusClass =
              'bg-red-500 text-white border-2 border-red-500 shadow-md shadow-red-500/30';
            textStatusClass = 'text-red-600';
            iconContent = (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            );
          }

          return (
            <div key={step} className="flex flex-col items-center w-24">
              <div
                id={`step${step}-icon`}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 z-10 ${iconStatusClass}`}
              >
                {iconContent}
              </div>
              <span
                id={`step${step}-text`}
                className={`text-xs font-semibold mt-2 text-center transition-colors duration-300 ${textStatusClass}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepperProgress;
