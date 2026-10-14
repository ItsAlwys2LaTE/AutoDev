import React, { useRef, useEffect } from 'react';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  className = '',
  autoFocus = true,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split value into array of individual characters padded to length
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const setDigitAt = (index: number, newDigit: string) => {
    const chars = digits.slice();
    chars[index] = newDigit;
    const nextVal = chars.join('').slice(0, length);
    onChange(nextVal);

    if (nextVal.length === length && onComplete) {
      onComplete(nextVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setDigitAt(index, '');
      } else if (index > 0) {
        setDigitAt(index - 1, '');
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const raw = e.target.value;
    const sanitized = raw.replace(/\D/g, '');

    if (!sanitized) {
      setDigitAt(index, '');
      return;
    }

    // If a single digit was typed
    const char = sanitized.slice(-1);
    setDigitAt(index, char);

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();

    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    onChange(pasted);

    if (pasted.length === length && onComplete) {
      onComplete(pasted);
    }

    const nextFocusIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-3 ${className}`}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete="one-time-code"
          value={digit}
          disabled={disabled}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onChange={(e) => handleChange(idx, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${idx + 1}`}
          className={`w-11 h-14 sm:w-12 sm:h-14 text-center font-mono text-xl font-semibold rounded-2xl border transition-all duration-200 focus:outline-none select-none ${
            disabled
              ? 'opacity-40 cursor-not-allowed bg-black/20 border-white/5 text-slate-500'
              : digit
              ? 'border-white/40 bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)]'
              : 'border-white/10 bg-black/30 text-slate-200 hover:border-white/20 focus:border-white/50 focus:bg-white/[0.08] focus:ring-1 focus:ring-white/20'
          }`}
        />
      ))}
    </div>
  );
};

export default OtpInput;
