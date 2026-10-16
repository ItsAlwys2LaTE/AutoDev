import React, { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { calculateTokenCostINR, formatInr } from '../utils/formatters';

export interface CostDisplayProps {
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  className?: string;
}

export const CostDisplay: React.FC<CostDisplayProps> = ({
  promptTokens,
  completionTokens,
  cost,
  className = '',
}) => {
  const storeUsage = useSessionStore((state) => state.sessionUsage);
  const recordTokenUsage = useSessionStore((state) => state.recordTokenUsage);
  const setSessionUsage = useSessionStore((state) => state.setSessionUsage);

  // If props are passed explicitly, use them; otherwise, use sessionStore
  const p = promptTokens !== undefined ? promptTokens : storeUsage.prompt;
  const c = completionTokens !== undefined ? completionTokens : storeUsage.completion;
  const totalTokens = p + c;

  // Calculate cost using standard utility
  const costValue =
    cost !== undefined
      ? cost
      : promptTokens !== undefined || completionTokens !== undefined
      ? calculateTokenCostINR(p, c)
      : storeUsage.cost;

  const formattedInr = formatInr(costValue);

  // Global window bridges for legacy compatibility
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handler = (prompt: any, completion: any) => {
        recordTokenUsage(prompt, completion);
      };
      (window as any).updateCost = handler;
      (window as any).__reactUpdateCost = handler;

      try {
        Object.defineProperty(window, 'sessionUsage', {
          get: () => useSessionStore.getState().sessionUsage,
          set: (val: any) => setSessionUsage(val),
          configurable: true,
        });
      } catch (e) {
        // Property may already be defined
      }
    }
  }, [recordTokenUsage, setSessionUsage]);

  return (
    <div
      id="costBox"
      style={{ backdropFilter: 'blur(14px)' }}
      className={`text-right bg-white/80 dark:bg-slate-950/[0.25] backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] ${className}`}
    >
      <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-0.5">
        Session Cost (INR)
      </div>
      <div
        id="costDisplay"
        className="text-base sm:text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400"
      >
        {formattedInr}{' '}
        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
          ({totalTokens} tokens)
        </span>
      </div>
    </div>
  );
};

export default CostDisplay;
