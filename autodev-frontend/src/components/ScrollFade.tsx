import React, { useRef, useState, useEffect, useCallback, useImperativeHandle } from 'react';

export interface ScrollFadeProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  children?: React.ReactNode;
  orientation?: 'vertical' | 'horizontal' | 'both';
  fadeSize?: number; // Size of edge fade in pixels, default: 32
  topFade?: boolean; // Enable top fade, default: true
  bottomFade?: boolean; // Enable bottom fade, default: true
  leftFade?: boolean; // Enable left fade, default: true
  rightFade?: boolean; // Enable right fade, default: true
  className?: string; // Applied to the scrollable container
  style?: React.CSSProperties;
  [key: string]: any;
}

export const ScrollFade = React.forwardRef<HTMLElement, ScrollFadeProps>(
  (
    {
      as = 'div',
      children,
      orientation = 'vertical',
      fadeSize = 32,
      topFade = true,
      bottomFade = true,
      leftFade = true,
      rightFade = true,
      className = '',
      style = {},
      onScroll,
      ...rest
    },
    forwardedRef
  ) => {
    const containerRef = useRef<HTMLElement>(null);
    useImperativeHandle(forwardedRef, () => containerRef.current as HTMLElement);

    const [fadeState, setFadeState] = useState({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });

    const getScrollTarget = useCallback((root: HTMLElement): HTMLElement => {
      if (
        root.tagName === 'TEXTAREA' ||
        root.scrollHeight > root.clientHeight + 2 ||
        root.scrollWidth > root.clientWidth + 2
      ) {
        return root;
      }
      const textarea = root.querySelector('textarea');
      if (textarea) return textarea;
      const scrollable = root.querySelector<HTMLElement>('[data-scroll-container], [class*="overflow"]');
      if (
        scrollable &&
        (scrollable.scrollHeight > scrollable.clientHeight || scrollable.scrollWidth > scrollable.clientWidth)
      ) {
        return scrollable;
      }
      return root;
    }, []);

    const updateFade = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      const el = getScrollTarget(container);

      const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = el;

      // 3px buffer to handle subpixel rounding oscillations
      const canScrollUp = topFade && scrollTop > 3;
      const canScrollDown = bottomFade && scrollTop + clientHeight < scrollHeight - 3;
      const canScrollLeft = leftFade && scrollLeft > 3;
      const canScrollRight = rightFade && scrollLeft + clientWidth < scrollWidth - 3;

      setFadeState((prev) => {
        if (
          prev.top === canScrollUp &&
          prev.bottom === canScrollDown &&
          prev.left === canScrollLeft &&
          prev.right === canScrollRight
        ) {
          return prev;
        }
        return {
          top: canScrollUp,
          bottom: canScrollDown,
          left: canScrollLeft,
          right: canScrollRight,
        };
      });
    }, [topFade, bottomFade, leftFade, rightFade, getScrollTarget]);

    useEffect(() => {
      updateFade();
      const el = containerRef.current;
      if (!el) return;

      const ro = new ResizeObserver(() => {
        updateFade();
      });
      ro.observe(el);
      Array.from(el.children).forEach((child) => ro.observe(child));
      const textarea = el.querySelector('textarea');
      if (textarea) ro.observe(textarea);

      const handleCaptureScroll = () => {
        updateFade();
      };

      el.addEventListener('scroll', handleCaptureScroll, { capture: true, passive: true });
      el.addEventListener('input', handleCaptureScroll, { capture: true, passive: true });

      return () => {
        ro.disconnect();
        el.removeEventListener('scroll', handleCaptureScroll, { capture: true } as any);
        el.removeEventListener('input', handleCaptureScroll, { capture: true } as any);
      };
    }, [updateFade, children]);

    const handleScroll = (e: React.UIEvent<any>) => {
      updateFade();
      if (onScroll) (onScroll as any)(e);
    };

    // Construct dynamic CSS mask-image gradient
    const getMaskStyle = (): React.CSSProperties => {
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      const masks: string[] = [];

      if (isVertical) {
        if (fadeState.top && fadeState.bottom) {
          masks.push(
            `linear-gradient(to bottom, transparent 0%, black ${fadeSize}px, black calc(100% - ${fadeSize}px), transparent 100%)`
          );
        } else if (fadeState.top) {
          masks.push(`linear-gradient(to bottom, transparent 0%, black ${fadeSize}px, black 100%)`);
        } else if (fadeState.bottom) {
          masks.push(
            `linear-gradient(to bottom, black 0%, black calc(100% - ${fadeSize}px), transparent 100%)`
          );
        }
      }

      if (isHorizontal) {
        if (fadeState.left && fadeState.right) {
          masks.push(
            `linear-gradient(to right, transparent 0%, black ${fadeSize}px, black calc(100% - ${fadeSize}px), transparent 100%)`
          );
        } else if (fadeState.left) {
          masks.push(`linear-gradient(to right, transparent 0%, black ${fadeSize}px, black 100%)`);
        } else if (fadeState.right) {
          masks.push(
            `linear-gradient(to right, black 0%, black calc(100% - ${fadeSize}px), transparent 100%)`
          );
        }
      }

      if (masks.length === 0) {
        return {};
      }

      const maskStr = masks.join(', ');
      return {
        WebkitMaskImage: maskStr,
        maskImage: maskStr,
        WebkitMaskComposite: masks.length > 1 ? 'source-in' : undefined,
        maskComposite: masks.length > 1 ? 'intersect' : undefined,
      };
    };

    const Component = (as || 'div') as React.ElementType;

    return (
      <Component
        ref={containerRef}
        onScroll={handleScroll}
        className={`scrollbar-none ${className}`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          ...getMaskStyle(),
          ...style,
        }}
        {...rest}
      >
        {children}
      </Component>
    );
  }
);

ScrollFade.displayName = 'ScrollFade';

export default ScrollFade;
