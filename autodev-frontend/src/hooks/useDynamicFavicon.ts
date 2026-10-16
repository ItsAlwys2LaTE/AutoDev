/**
 * Dynamic Favicon Hook & Canvas Rendering Engine
 *
 * Implements a dynamic browser tab favicon for the AutoDev platform:
 * 1. Base Mark: High-DPI canvas badge with dark obsidian background (#120F17)
 *    and a white letter "A" rendered in the Alex Brush cursive script font.
 * 2. Status Light: Top-right status indicator that dynamically pulses/blinks
 *    with a vibrant blue color (#3B82F6 / #60A5FA) during active product development
 *    (pipelineStatus === 'running' && !isPaused), matching the Claude website indicator.
 * 3. Idle / Resting State: When development is paused, idle, completed, or aborted,
 *    the blinking timer is suspended and the clean static brand badge is displayed.
 * 4. Font Readiness Detection: Listens to document.fonts.ready to guarantee
 *    the Alex Brush font glyph is fully rasterized without fallback artifacts.
 * 5. Strictly zero emojis across all code, markup, and logs.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

export interface FaviconRenderOptions {
  isDeveloping: boolean;
  isBlinkOn?: boolean;
}

/**
 * Generates an SVG representation of the AutoDev dynamic favicon.
 * Used directly or as a reliable fallback when canvas 2D context is unavailable.
 */
export function generateFaviconSvg(options: FaviconRenderOptions): string {
  const { isDeveloping, isBlinkOn = true } = options;

  let statusLightMarkup = '';
  if (isDeveloping) {
    if (isBlinkOn) {
      statusLightMarkup = `
  <defs>
    <filter id="blue-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#3B82F6" flood-opacity="0.9"/>
    </filter>
  </defs>
  <circle cx="48" cy="15" r="4.5" fill="#3B82F6" filter="url(#blue-glow)" />
  <circle cx="47.5" cy="14.2" r="1.5" fill="#BFDBFE" />`;
    } else {
      statusLightMarkup = `
  <circle cx="48" cy="15" r="4.5" fill="rgba(59, 130, 246, 0.25)" stroke="rgba(59, 130, 246, 0.5)" stroke-width="1" />`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="#120F17" stroke="rgba(255, 255, 255, 0.14)" stroke-width="1.5" />
  <text x="31" y="44" font-family="'Alex Brush', cursive, sans-serif" font-size="44" fill="#FFFFFF" text-anchor="middle">A</text>${statusLightMarkup}
</svg>`;
}

/**
 * Draws the AutoDev dynamic favicon onto an HTML5 canvas element.
 */
export function renderFaviconCanvas(
  canvas: HTMLCanvasElement,
  options: FaviconRenderOptions
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const { isDeveloping, isBlinkOn = true } = options;
  const size = 64;

  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;

  ctx.clearRect(0, 0, size, size);

  // 1. Dark obsidian circular badge background
  ctx.save();
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#120F17';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 2. White "A" in Alex Brush font
  ctx.save();
  ctx.font = 'normal 44px "Alex Brush", cursive, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', 31, 35);
  ctx.restore();

  // 3. Status light on top-right (active development pulse)
  if (isDeveloping) {
    ctx.save();
    if (isBlinkOn) {
      // Radiant glowing blue LED
      ctx.shadowColor = 'rgba(59, 130, 246, 0.9)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(48, 15, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#3B82F6';
      ctx.fill();

      // Specular highlight core
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(47.5, 14.2, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#BFDBFE';
      ctx.fill();
    } else {
      // Dim resting phase of the blink cycle
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(48, 15, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  return true;
}

/**
 * Returns a data URL representing the favicon based on current options.
 * Uses canvas PNG when available, falling back gracefully to SVG data URI.
 */
export function generateFaviconDataUrl(options: FaviconRenderOptions): string {
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const rendered = renderFaviconCanvas(canvas, options);
      if (rendered) {
        return canvas.toDataURL('image/png');
      }
    } catch {
      // Fallback below
    }
  }

  const svg = generateFaviconSvg(options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Updates or creates the document <link rel="icon"> tag with the provided data URL.
 */
export function updateDocumentFavicon(dataUrl: string): void {
  if (typeof document === 'undefined') return;

  try {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.id = 'dynamic-favicon';
      document.head.appendChild(link);
    }
    link.href = dataUrl;
  } catch {
    // Non-blocking in sandboxed environments
  }
}

/**
 * React hook that manages the AutoDev dynamic favicon lifecycle.
 * Automatically synchronizes with pipeline development activity and font readiness.
 */
export function useDynamicFavicon(): void {
  const pipelineStatus = useAppStore((s) => s.pipelineStatus);
  const pipelineActive = useAppStore((s) => s.pipelineActive);
  const isPaused = useAppStore((s) => s.isPaused);

  const isDeveloping = (pipelineStatus === 'running' || pipelineActive) && !isPaused;
  const isDevelopingRef = useRef(isDeveloping);
  isDevelopingRef.current = isDeveloping;

  useEffect(() => {
    let blinkState = true;
    let timerId: number | null = null;

    const applyFavicon = (on: boolean) => {
      const dataUrl = generateFaviconDataUrl({
        isDeveloping: isDevelopingRef.current,
        isBlinkOn: on,
      });
      updateDocumentFavicon(dataUrl);
    };

    if (isDeveloping) {
      // Render immediately with active bright blue indicator
      applyFavicon(true);

      // Start blinking interval (600ms cadence)
      timerId = window.setInterval(() => {
        blinkState = !blinkState;
        applyFavicon(blinkState);
      }, 600);
    } else {
      // Render static brand badge without status dot
      applyFavicon(false);
    }

    // Re-render when Alex Brush font finishes loading
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        applyFavicon(isDevelopingRef.current ? blinkState : false);
      }).catch(() => {
        // Ignore font load errors
      });
    }

    return () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
      }
    };
  }, [isDeveloping]);
}

export default useDynamicFavicon;
