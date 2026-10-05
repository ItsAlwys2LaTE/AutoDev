/**
 * AutoDev Live Preview Component
 * 
 * Re-implements the Live Preview Feature matching the legacy AutoDev implementation exactly:
 * - DOM container #previewContainer and iframe #livePreviewFrame are always present in the DOM
 * - Initial loading UI in #livePreviewFrame srcdoc matching legacy lines 1161-1162
 * - Calls POST /api/preview/start with { codebase, blueprint }
 * - Polls targetUrl using fetch(targetUrl, { mode: 'no-cors' }) every 2000ms up to 30 attempts (60s)
 * - Removes srcdoc and sets iframe.src = targetUrl upon success
 * - On dev server timeout (> 30 attempts), sets exact legacy timeout srcdoc
 * - On error, sets exact legacy error srcdoc
 * - Registers window.renderLivePreview() bridge for global access
 * - Supports hot-reloading on post-completion modification when container is visible
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../stores/appStore';
import type { GeneratedCodeBase, SystemDesignBlueprint } from '../../types';

export interface LivePreviewProps {
  codebase?: GeneratedCodeBase | null;
  blueprint?: SystemDesignBlueprint | null;
  className?: string;
  autoStart?: boolean;
}

export function buildInlinePreviewHtml(codebase: GeneratedCodeBase | null): string | null {
  if (!codebase || !codebase.files || codebase.files.length === 0) return null;

  const indexFile = codebase.files.find(
    (f) =>
      f.file_name.toLowerCase() === 'index.html' ||
      f.file_name.toLowerCase().endsWith('/index.html')
  );

  if (!indexFile) return null;

  let htmlContent = indexFile.source_code || '';

  codebase.files.forEach((file) => {
    const name = file.file_name;
    const lower = name.toLowerCase();

    if (lower.endsWith('.css')) {
      const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(
        '<link[^>]+href=["\'](?:\\./)?' + escaped + '["\'][^>]*>',
        'gi'
      );
      htmlContent = htmlContent.replace(
        regex,
        `<style>\n/* Inlined ${name} */\n${file.source_code}\n</style>`
      );
    } else if (
      (lower.endsWith('.js') || lower.endsWith('.mjs')) &&
      !lower.includes('test') &&
      !lower.includes('config')
    ) {
      const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(
        '<script[^>]+src=["\'](?:\\./)?' + escaped + '["\'][^>]*></script>',
        'gi'
      );
      htmlContent = htmlContent.replace(
        regex,
        `<script>\n/* Inlined ${name} */\n${file.source_code}\n</script>`
      );
    }
  });

  return htmlContent;
}

export function LivePreview({
  codebase,
  blueprint,
  className = '',
  autoStart = true,
}: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pollTimeoutRef = useRef<any>(null);
  const hasStartedRef = useRef<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing live preview...');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInlineMode, setIsInlineMode] = useState<boolean>(false);

  const getFrame = useCallback((): HTMLIFrameElement | null => {
    if (iframeRef.current) return iframeRef.current;
    if (typeof document !== 'undefined') {
      return document.getElementById('livePreviewFrame') as HTMLIFrameElement | null;
    }
    return null;
  }, []);

  const renderLivePreview = useCallback(
    async (forcedCodebase?: GeneratedCodeBase | null, forcedBlueprint?: SystemDesignBlueprint | null) => {
      const storeCodebase = useAppStore.getState().currentCodebase || useAppStore.getState().integratedCodebase;
      const storeBlueprint = useAppStore.getState().currentBlueprint;
      const activeCodebase = forcedCodebase ?? codebase ?? storeCodebase;
      const activeBlueprint = forcedBlueprint ?? blueprint ?? storeBlueprint;

      if (!activeCodebase || !activeCodebase.files || activeCodebase.files.length === 0) {
        return;
      }

      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setServerUrl(null);
      setIsInlineMode(false);
      setLoadingMessage('Spinning up Docker Container... Installing dependencies and starting dev server...');

      const frame = getFrame();
      if (frame) {
        frame.removeAttribute('src');
        frame.removeAttribute('srcdoc');
        frame.srcdoc =
          "<html><body style='font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; color: #666;'><h3>Spinning up Docker Container...</h3><p>Installing dependencies and starting dev server...</p></body></html>";
      }

      const bp: SystemDesignBlueprint = activeBlueprint || {
        architecture_overview: 'Live Preview',
        tech_stack: ['Fullstack'],
        docker_image: 'python:3.11-slim',
        dev_server_command: 'NONE',
        dev_server_port: 0,
        run_tests_command: 'NONE',
        files: [],
      };

      try {
        const response = await fetch('/api/preview/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codebase: activeCodebase,
            blueprint: bp,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: response.statusText || 'Preview server error' }));
          throw new Error(err.detail || 'Preview server error');
        }

        const data = await response.json();
        const targetUrl = data.url;
        let attempts = 0;

        const checkServer = async () => {
          if (attempts > 30) {
            const f = getFrame();
            if (f) {
              f.srcdoc =
                "<html><body style='font-family: sans-serif; color: red; text-align: center; margin-top: 50px;'><h3>Dev server timeout</h3><p>The server didn't start within 60 seconds.</p></body></html>";
            }
            setIsLoading(false);
            setErrorMessage("Dev server timeout: The server didn't start within 60 seconds.");
            return;
          }
          try {
            await fetch(targetUrl, { mode: 'no-cors' });
            const f = getFrame();
            if (f) {
              f.removeAttribute('srcdoc');
              f.src = targetUrl;
            }
            setServerUrl(targetUrl);
            setIsLoading(false);
            setErrorMessage(null);
          } catch {
            attempts++;
            pollTimeoutRef.current = setTimeout(checkServer, 2000);
          }
        };

        checkServer();
      } catch (e: any) {
        console.error('Live Preview Error:', e);
        const errMsg = e?.message || String(e);
        const safeError = errMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        const f = getFrame();
        if (f) {
          f.srcdoc = `<html><body style='font-family: sans-serif; color: red; padding: 20px;'><h3>Failed to host live preview in Docker.</h3><p><strong>Error details:</strong></p><pre style='background: #fee; padding: 10px; border-radius: 4px; overflow: auto;'>${safeError}</pre></body></html>`;
        }
        setIsLoading(false);
        setErrorMessage(errMsg);
      }
    },
    [codebase, blueprint, getFrame]
  );

  // Register window.renderLivePreview bridge
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).renderLivePreview = () => {
      return renderLivePreview();
    };
    return () => {
      delete (window as any).renderLivePreview;
    };
  }, [renderLivePreview]);

  // Auto-start on mount if autoStart is true and codebase exists
  useEffect(() => {
    if (autoStart && !hasStartedRef.current && codebase && codebase.files && codebase.files.length > 0) {
      hasStartedRef.current = true;
      renderLivePreview(codebase, blueprint);
    }
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [autoStart, codebase, blueprint, renderLivePreview]);

  const handleRestart = () => {
    renderLivePreview();
  };

  const handleInlineFallback = () => {
    const storeCodebase = useAppStore.getState().currentCodebase || useAppStore.getState().integratedCodebase;
    const activeCodebase = codebase || storeCodebase;
    const fallback = buildInlinePreviewHtml(activeCodebase);
    if (fallback) {
      const f = getFrame();
      if (f) {
        f.removeAttribute('src');
        f.srcdoc = fallback;
      }
      setIsInlineMode(true);
      setErrorMessage(null);
    }
  };

  const storeCodebase = useAppStore.getState().currentCodebase || useAppStore.getState().integratedCodebase;
  const canShowInlineFallback = Boolean(errorMessage && buildInlinePreviewHtml(codebase || storeCodebase));

  return (
    <div
      id="previewContainer"
      className={`flex-1 w-full bg-white relative flex flex-col h-full ${className}`}
    >
      {/* Top Preview Control Bar */}
      <div className="bg-slate-900 border-b border-slate-700/80 px-3 py-1.5 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-1.5 text-blue-400">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="font-mono text-[11px] truncate max-w-[240px]">
                {loadingMessage}
              </span>
            </div>
          ) : isInlineMode ? (
            <div className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[11px]">
                In-Browser Static Preview
              </span>
            </div>
          ) : serverUrl ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircleIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px] font-semibold truncate max-w-[260px]">
                Container Live: {serverUrl}
              </span>
            </div>
          ) : errorMessage ? (
            <div className="flex items-center gap-1.5 text-rose-400">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px] truncate max-w-[260px]">
                {errorMessage}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 font-mono text-[11px]">Preview Ready</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canShowInlineFallback && !isInlineMode && (
            <button
              type="button"
              onClick={handleInlineFallback}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700/50 hover:bg-cyan-900/60 text-[11px] font-medium transition-colors cursor-pointer"
              title="Render HTML/CSS/JS in-browser without Docker"
            >
              <span>Static Mode</span>
            </button>
          )}

          {serverUrl && (
            <a
              href={serverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-medium"
              title="Open preview in new browser tab"
            >
              <span>Open Tab</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </a>
          )}

          <button
            type="button"
            onClick={handleRestart}
            disabled={isLoading}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 cursor-pointer'
            }`}
            title="Reload and restart container preview"
          >
            <ArrowPathIcon className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Main Preview Frame Host: Always mounted with id="livePreviewFrame" */}
      <div className="flex-1 w-full relative bg-white overflow-hidden">
        <iframe
          id="livePreviewFrame"
          ref={iframeRef}
          title="Live Preview"
          className="w-full h-full border-none bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
}

export default LivePreview;
