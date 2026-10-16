import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  type ComponentPropsWithoutRef,
} from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { gsap } from 'gsap';
import { cn } from '../lib/utils';
import { ScrollFade } from './ScrollFade';

export interface SmoothInputProps
  extends Omit<ComponentPropsWithoutRef<'textarea'>, 'onChange'> {
  as?: 'input' | 'textarea';
  type?: 'text' | 'password';
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
  caretColorClass?: string;
  autoResize?: boolean;
  minHeight?: number | string;
  maxHeight?: number | string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
}

export const SmoothInput = React.forwardRef<
  HTMLTextAreaElement | HTMLInputElement,
  SmoothInputProps
>(({
  as = 'textarea',
  type = 'text',
  className = '',
  wrapperClassName = '',
  wrapperStyle,
  caretColorClass = 'text-white/80 font-semibold',
  autoResize = true,
  minHeight = 100,
  maxHeight = 260,
  value,
  defaultValue,
  onChange,
  onKeyDown,
  onKeyUp,
  onClick,
  onSelect,
  onScroll,
  onBlur,
  onFocus,
  placeholder,
  style,
  rows = 3,
  disabled = false,
  ...props
}, ref) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [caretHeight, setCaretHeight] = useState<number | string>('1.35em');
  const [caretFontSize, setCaretFontSize] = useState<string | number>('16px');
  const caretX = useMotionValue(0);
  const caretY = useMotionValue(0);
  const caretOpacity = useMotionValue(1);
  const hasInitializedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const mirrorBeforeRef = useRef<HTMLSpanElement>(null);
  const mirrorMarkerRef = useRef<HTMLSpanElement>(null);
  const mirrorAfterRef = useRef<HTMLSpanElement>(null);
  const cursorVisualRef = useRef<HTMLSpanElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const prefersReducedMotion = useReducedMotion();

  useImperativeHandle(ref, () => inputRef.current as any);

  const isControlled = value !== undefined;
  const inputValue = isControlled ? String(value) : String(internalValue);

  const springConfig = prefersReducedMotion
    ? { stiffness: 10000, damping: 100, mass: 0.1 }
    : { stiffness: 500, damping: 32, mass: 0.45 };

  const springCaretX = useSpring(caretX, springConfig);
  const springCaretY = useSpring(caretY, springConfig);

  // Constant Blink GSAP tween matching TextType.tsx title cursor
  useEffect(() => {
    if (cursorVisualRef.current) {
      gsap.set(cursorVisualRef.current, { opacity: 1 });
      const tween = gsap.to(cursorVisualRef.current, {
        opacity: 0,
        duration: 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
      });
      tweenRef.current = tween;
      return () => {
        tween.kill();
      };
    }
  }, []);

  const resetBlink = useCallback(() => {
    if (cursorVisualRef.current) {
      gsap.set(cursorVisualRef.current, { opacity: 1 });
      tweenRef.current?.restart();
    }
  }, []);

  const adjustHeight = useCallback(() => {
    if (as !== 'textarea' || !autoResize) return;
    const target = inputRef.current as HTMLTextAreaElement | null;
    if (!target) return;

    const minH =
      typeof minHeight === 'number'
        ? minHeight
        : parseFloat(String(minHeight)) || 100;

    const maxH =
      typeof maxHeight === 'number'
        ? maxHeight
        : parseFloat(String(maxHeight)) || 260;

    const prevScrollTop = target.scrollTop;

    // Reset height temporarily to compute accurate scrollHeight
    target.style.height = 'auto';

    const scrollH = target.scrollHeight;

    if (scrollH > maxH) {
      target.style.height = `${maxH}px`;
      target.style.overflowY = 'auto';
    } else {
      const targetH = Math.max(minH, scrollH);
      target.style.height = `${targetH}px`;
      target.style.overflowY = 'hidden';
    }

    target.scrollTop = prevScrollTop;
  }, [as, autoResize, minHeight, maxHeight]);

  const updateCaretFromInput = useCallback(
    (target: HTMLTextAreaElement | HTMLInputElement) => {
      const selectionStart = target.selectionStart ?? 0;
      const selectionEnd = target.selectionEnd ?? 0;
      const hasSelection = selectionStart !== selectionEnd;

      if (hasSelection || disabled) {
        caretOpacity.set(0);
        return;
      }

      const container = containerRef.current;
      const mirror = mirrorRef.current;
      const mirrorBefore = mirrorBeforeRef.current;
      const mirrorMarker = mirrorMarkerRef.current;
      const mirrorAfter = mirrorAfterRef.current;

      if (!container || !mirror || !mirrorBefore || !mirrorMarker || !mirrorAfter) {
        return;
      }

      const styles = window.getComputedStyle(target);

      // Match typography
      mirror.style.fontFamily = styles.fontFamily;
      mirror.style.fontSize = styles.fontSize;
      mirror.style.fontWeight = styles.fontWeight;
      mirror.style.fontStyle = styles.fontStyle;
      mirror.style.letterSpacing = styles.letterSpacing;
      mirror.style.lineHeight = styles.lineHeight;
      mirror.style.textTransform = styles.textTransform;
      mirror.style.textIndent = styles.textIndent;
      mirror.style.tabSize = styles.tabSize;

      // Match padding and borders
      mirror.style.paddingTop = styles.paddingTop;
      mirror.style.paddingRight = styles.paddingRight;
      mirror.style.paddingBottom = styles.paddingBottom;
      mirror.style.paddingLeft = styles.paddingLeft;
      mirror.style.borderTopWidth = styles.borderTopWidth;
      mirror.style.borderRightWidth = styles.borderRightWidth;
      mirror.style.borderBottomWidth = styles.borderBottomWidth;
      mirror.style.borderLeftWidth = styles.borderLeftWidth;
      mirror.style.borderStyle = styles.borderStyle;

      if (as === 'textarea') {
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordBreak = 'break-word';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.boxSizing = 'border-box';
        mirror.style.width = `${target.offsetWidth || target.clientWidth}px`;
      } else {
        mirror.style.whiteSpace = 'pre';
        mirror.style.wordBreak = 'normal';
        mirror.style.overflowWrap = 'normal';
        mirror.style.boxSizing = styles.boxSizing;
        mirror.style.width = `${target.offsetWidth || target.clientWidth}px`;
      }

      const text = target.value || '';
      const validStart = Math.min(Math.max(0, selectionStart), text.length);
      const textBefore = text.slice(0, validStart);
      const textAfter = text.slice(validStart);

      mirrorBefore.textContent = textBefore;
      mirrorMarker.textContent = '|';
      mirrorAfter.textContent = textAfter;

      if (styles.fontSize) {
        setCaretFontSize(styles.fontSize);
      }

      const containerRect = container.getBoundingClientRect();
      const markerRect = mirrorMarker.getBoundingClientRect();

      let computedX = markerRect.left - containerRect.left - target.scrollLeft;
      let computedY = markerRect.top - containerRect.top - target.scrollTop;

      // Fallback if measurement rect is unavailable
      if (markerRect.width === 0 && markerRect.height === 0) {
        computedX = parseFloat(styles.paddingLeft) || 24;
        computedY = parseFloat(styles.paddingTop) || 24;
      }

      const isVisible =
        computedY >= -30 &&
        computedY <= target.clientHeight + 30 &&
        computedX >= -30 &&
        computedX <= target.clientWidth + 30;

      if (!hasInitializedRef.current && isVisible) {
        caretX.jump(computedX);
        caretY.jump(computedY);
        hasInitializedRef.current = true;
      } else {
        caretX.set(computedX);
        caretY.set(computedY);
      }

      if (markerRect.height > 0) {
        setCaretHeight(markerRect.height);
      } else {
        const lineH = parseFloat(styles.lineHeight) || (parseFloat(styles.fontSize) * 1.5) || 24;
        setCaretHeight(lineH);
      }

      caretOpacity.set(isVisible ? 1 : 0);
    },
    [as, disabled, caretX, caretY, caretOpacity]
  );

  const updateCaretRef = useRef(updateCaretFromInput);
  updateCaretRef.current = updateCaretFromInput;

  useEffect(() => {
    adjustHeight();
    const input = inputRef.current;
    if (input) {
      updateCaretRef.current(input);
      const rafId = requestAnimationFrame(() => {
        if (inputRef.current) {
          updateCaretRef.current(inputRef.current);
        }
      });
      const timer = setTimeout(() => {
        if (inputRef.current) {
          updateCaretRef.current(inputRef.current);
        }
      }, 50);
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer);
      };
    }
  }, [inputValue, adjustHeight]);

  useEffect(() => {
    const input = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return;

    adjustHeight();

    const updateCaret = () => {
      adjustHeight();
      updateCaretRef.current(input);
    };

    const handleSelectionChange = () => {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          updateCaretRef.current(inputRef.current);
        }
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.fonts?.addEventListener('loadingdone', updateCaret);
    void document.fonts?.ready?.then(updateCaret);
    input.addEventListener('scroll', updateCaret);

    const resizeObserver = new ResizeObserver(updateCaret);
    resizeObserver.observe(container);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.fonts?.removeEventListener('loadingdone', updateCaret);
      input.removeEventListener('scroll', updateCaret);
      resizeObserver.disconnect();
    };
  }, [adjustHeight]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
    resetBlink();
    const target = e.target;
    adjustHeight();
    updateCaretRef.current(target);
    requestAnimationFrame(() => {
      adjustHeight();
      updateCaretRef.current(target);
    });
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    resetBlink();
    onKeyDown?.(e as any);
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      adjustHeight();
      updateCaretRef.current(target);
    });
  };

  const handleInputKeyUp = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    resetBlink();
    onKeyUp?.(e as any);
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      adjustHeight();
      updateCaretRef.current(target);
    });
  };

  const handleInputClick = (
    e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    resetBlink();
    onClick?.(e as any);
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      updateCaretRef.current(target);
    });
  };

  const handleInputSelect = (
    e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const target = e.currentTarget;
    updateCaretRef.current(target);
  };

  const handleInputScroll = (
    e: React.UIEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    onScroll?.(e as any);
    const target = e.currentTarget;
    updateCaretRef.current(target);
  };

  const handleInputBlur = (
    e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    onBlur?.(e as React.FocusEvent<HTMLTextAreaElement>);
  };

  const handleInputFocus = (
    e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    resetBlink();
    const target = e.target;
    adjustHeight();
    requestAnimationFrame(() => {
      updateCaretRef.current(target);
    });
    onFocus?.(e as React.FocusEvent<HTMLTextAreaElement>);
  };

  return (
    <div
      ref={containerRef}
      className={cn('smooth-input-container relative w-full', wrapperClassName)}
      style={{ caretColor: 'transparent', ...wrapperStyle }}
    >
        {as === 'textarea' ? (
          <ScrollFade fadeSize={24} className="w-full">
            <textarea
              {...props}
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              rows={rows}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                'w-full bg-transparent outline-none resize-none font-sans',
                className
              )}
              style={{
                minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
                maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
                background: 'transparent',
                backgroundColor: 'transparent',
                ...style,
                caretColor: 'transparent',
              }}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onKeyUp={handleInputKeyUp}
              onClick={handleInputClick}
              onSelect={handleInputSelect}
              onScroll={handleInputScroll}
              onBlur={handleInputBlur}
              onFocus={handleInputFocus}
            />
          </ScrollFade>
        ) : (
          <input
            {...(props as any)}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              'w-full bg-transparent outline-none font-sans',
              className
            )}
            style={{
              background: 'transparent',
              backgroundColor: 'transparent',
              ...style,
              caretColor: 'transparent',
            }}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onKeyUp={handleInputKeyUp}
            onClick={handleInputClick}
            onSelect={handleInputSelect}
            onScroll={handleInputScroll}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
          />
        )}

        {/* Off-screen measurement mirror */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 left-0 select-none overflow-hidden"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <span ref={mirrorBeforeRef} />
          <span ref={mirrorMarkerRef}>|</span>
          <span ref={mirrorAfterRef} />
        </div>

        {/* Animated Caret matching TextType title cursor */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-30 select-none flex items-center"
          style={{
            x: springCaretX,
            y: springCaretY,
            opacity: caretOpacity,
            height: caretHeight,
          }}
        >
          <span
            ref={cursorVisualRef}
            className={cn(
              'inline-block select-none pointer-events-none leading-none',
              caretColorClass
            )}
            style={{
              fontSize: caretFontSize,
              fontFamily: 'inherit',
            }}
          >
            |
          </span>
        </motion.div>
      </div>
  );
});

SmoothInput.displayName = 'SmoothInput';

export default SmoothInput;
