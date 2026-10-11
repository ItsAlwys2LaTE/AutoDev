"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "../../lib/utils";

export interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  viewportClassName?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
  orientation?: "vertical" | "horizontal" | "both";
  hideScrollbar?: boolean;
}

export interface ScrollBarProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar> {
  thumbClassName?: string;
  orientation?: "vertical" | "horizontal";
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      viewportClassName,
      viewportRef,
      children,
      orientation = "vertical",
      hideScrollbar = false,
      ...props
    },
    ref
  ) => {
    return (
      <ScrollAreaPrimitive.Root
        ref={ref}
        data-slot="scroll-area"
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          data-slot="scroll-area-viewport"
          className={cn(
            "size-full rounded-[inherit] transition-[color,box-shadow] outline-none",
            viewportClassName
          )}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        {!hideScrollbar &&
          (orientation === "vertical" || orientation === "both") && (
            <ScrollBar orientation="vertical" />
          )}
        {!hideScrollbar &&
          (orientation === "horizontal" || orientation === "both") && (
            <ScrollBar orientation="horizontal" />
          )}
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  }
);
ScrollArea.displayName = "ScrollArea";

function ScrollBar({
  className,
  thumbClassName,
  orientation = "vertical",
  ...props
}: ScrollBarProps) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-0.5 transition-colors select-none z-10",
        orientation === "vertical"
          ? "h-full w-2.5 border-l border-transparent"
          : "w-full h-2.5 flex-col border-t border-transparent",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-transparent",
        "data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative flex-1 rounded-full bg-white/20 hover:bg-white/40 active:bg-white/60 transition-colors shadow-xs",
          thumbClassName
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
export { ScrollArea as ModernScrollbar, ScrollBar as ModernScrollBar };
export default ScrollArea;
