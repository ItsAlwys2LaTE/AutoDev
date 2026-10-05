/**
 * AutoDev Streaming Hook (useApiStream)
 * 
 * Provides real-time stream consumption for FastAPI chunked text/plain streaming endpoints:
 * 1. Accumulates incoming text chunks in component state.
 * 2. Processes `\n__RESET__\n` sentinels (flushing buffer on LLM retry/failover).
 * 3. Processes `\n__USAGE__{prompt},{candidate}` sentinels (updating INR token cost in stores).
 * 4. Supports AbortSignal for cancellation and integrates with active pipeline controller.
 */

import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import type { StreamCallbacks, StreamResult } from '../api/client';
import { SENTINEL_RESET, SENTINEL_USAGE, USAGE_REGEX } from '../utils/streamParser';

export interface TokenUsageData {
  prompt: number;
  candidate: number;
}

export interface UseApiStreamOptions {
  /** Callback fired whenever new text is received */
  onChunk?: (cleanAccumulated: string, deltaChunk: string) => void;
  /** Callback fired when an LLM retry flush occurs */
  onReset?: () => void;
  /** Callback fired when token usage sentinel is parsed */
  onUsage?: (promptTokens: number, candidateTokens: number) => void;
  /** Callback fired on stream completion */
  onComplete?: (cleanText: string, usage?: TokenUsageData) => void;
  /** Callback fired on stream error */
  onError?: (error: Error) => void;
  /** Optional custom AbortSignal */
  signal?: AbortSignal;
}

export interface UseApiStreamReturn {
  /** The current accumulated clean text */
  streamText: string;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Stream error if any occurred */
  error: Error | null;
  /** Parsed token usage if present */
  usage: TokenUsageData | null;
  /**
   * Consumes a stream from either:
   * A) A Response or ReadableStream<Uint8Array>
   * B) An API caller function that accepts (callbacks, signal)
   */
  startStream: (
    source:
      | Response
      | ReadableStream<Uint8Array>
      | ((callbacks: StreamCallbacks, signal?: AbortSignal) => Promise<StreamResult | any>),
    options?: UseApiStreamOptions
  ) => Promise<string>;
  /** Cancels the active stream */
  abort: (reason?: string) => void;
  /** Resets state (clears stream text and error) */
  reset: () => void;
  /** Direct setter for stream text (e.g. for formatted rich text updates) */
  setStreamText: React.Dispatch<React.SetStateAction<string>>;
}

export function useApiStream(defaultOptions: UseApiStreamOptions = {}): UseApiStreamReturn {
  const [streamText, setStreamText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [usage, setUsage] = useState<TokenUsageData | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback((reason = 'Stream cancelled by user') => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(reason);
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abort('Stream reset');
    setStreamText('');
    setError(null);
    setUsage(null);
    setIsStreaming(false);
  }, [abort]);

  const processTextChunk = useCallback(
    (
      rawBuffer: string,
      delta: string,
      callbacks?: {
        onChunk?: (text: string, delta: string) => void;
        onReset?: () => void;
        onUsage?: (p: number, c: number) => void;
      }
    ): { cleanText: string; usage: TokenUsageData | null } => {
      let buffer = rawBuffer + delta;
      let detectedUsage: TokenUsageData | null = null;

      // 1. Process __RESET__ sentinel
      if (buffer.includes(SENTINEL_RESET)) {
        const parts = buffer.split(SENTINEL_RESET);
        buffer = parts[parts.length - 1];
        if (buffer.startsWith('\n')) {
          buffer = buffer.slice(1);
        } else if (buffer.startsWith('\r\n')) {
          buffer = buffer.slice(2);
        }
        callbacks?.onReset?.();
      }

      // 2. Process __USAGE__ sentinel
      if (buffer.includes(SENTINEL_USAGE)) {
        const parts = buffer.split(SENTINEL_USAGE);
        buffer = parts[0];
        const usageRaw = parts[1]?.trim();
        if (usageRaw) {
          const match = usageRaw.match(/^(\d+),(\d+)/);
          if (match) {
            const prompt = parseInt(match[1], 10) || 0;
            const candidate = parseInt(match[2], 10) || 0;
            detectedUsage = { prompt, candidate };

            // Update store (useAppStore delegates to sessionStore and updates state)
            try {
              useAppStore.getState().updateCost(prompt, candidate);
            } catch {
              // fallback
            }

            callbacks?.onUsage?.(prompt, candidate);
          }
        }
      }

      callbacks?.onChunk?.(buffer, delta);
      return { cleanText: buffer, usage: detectedUsage };
    },
    []
  );

  const startStream = useCallback(
    async (
      source:
        | Response
        | ReadableStream<Uint8Array>
        | ((callbacks: StreamCallbacks, signal?: AbortSignal) => Promise<StreamResult | any>),
      options: UseApiStreamOptions = {}
    ): Promise<string> => {
      const mergedOptions = { ...defaultOptions, ...options };
      
      // Setup abort controller
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Connect upstream abort signal if provided
      if (mergedOptions.signal) {
        if (mergedOptions.signal.aborted) {
          controller.abort(mergedOptions.signal.reason);
        } else {
          mergedOptions.signal.addEventListener('abort', () => {
            controller.abort(mergedOptions.signal?.reason);
          });
        }
      }

      setIsStreaming(true);
      setError(null);
      setUsage(null);
      setStreamText('');

      let accumulated = '';
      let finalUsage: TokenUsageData | null = null;

      try {
        if (typeof source === 'function') {
          // Caller function (e.g. generateRequirements wrapper)
          const callbacks: StreamCallbacks = {
            onChunk: (accText, delta) => {
              accumulated = accText;
              setStreamText(accText);
              mergedOptions.onChunk?.(accText, delta);
            },
            onReset: () => {
              accumulated = '';
              setStreamText('');
              mergedOptions.onReset?.();
            },
            onUsage: (promptTokens, candidateTokens) => {
              const u = { prompt: promptTokens, candidate: candidateTokens };
              finalUsage = u;
              setUsage(u);
              try {
                useAppStore.getState().updateCost(promptTokens, candidateTokens);
              } catch {}
              mergedOptions.onUsage?.(promptTokens, candidateTokens);
            },
          };

          const result = await source(callbacks, controller.signal);
          if (result && typeof result === 'object') {
            if ('cleanedText' in result) {
              accumulated = result.cleanedText;
            } else if ('fullText' in result) {
              accumulated = result.fullText;
            }
            if (result.usage) {
              finalUsage = result.usage;
              setUsage(result.usage);
            }
          }
        } else {
          // Direct Response or ReadableStream
          let readable: ReadableStream<Uint8Array> | null = null;
          if ('body' in source) {
            readable = source.body;
          } else {
            readable = source;
          }

          if (!readable) {
            throw new Error('ReadableStream body is null; unable to stream.');
          }

          const reader = readable.getReader();
          const decoder = new TextDecoder('utf-8');

          try {
            while (true) {
              if (controller.signal.aborted) {
                await reader.cancel();
                throw new DOMException('Stream aborted by user', 'AbortError');
              }

              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const { cleanText, usage: parsedUsage } = processTextChunk(
                accumulated,
                chunk,
                {
                  onChunk: (text, delta) => mergedOptions.onChunk?.(text, delta),
                  onReset: () => mergedOptions.onReset?.(),
                  onUsage: (p, c) => mergedOptions.onUsage?.(p, c),
                }
              );

              accumulated = cleanText;
              setStreamText(accumulated);

              if (parsedUsage) {
                finalUsage = parsedUsage;
                setUsage(parsedUsage);
              }
            }
          } finally {
            reader.releaseLock();
          }
        }

        // Clean trailing usage sentinels
        const cleanFinal = accumulated.replace(USAGE_REGEX, '').trim();
        setStreamText(cleanFinal);

        mergedOptions.onComplete?.(cleanFinal, finalUsage || undefined);
        return cleanFinal;
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          console.info('[useApiStream] Stream aborted cleanly.');
          return accumulated;
        }
        const streamErr = err instanceof Error ? err : new Error(String(err));
        setError(streamErr);
        mergedOptions.onError?.(streamErr);
        throw streamErr;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [defaultOptions, processTextChunk]
  );

  return {
    streamText,
    isStreaming,
    error,
    usage,
    startStream,
    abort,
    reset,
    setStreamText,
  };
}

export default useApiStream;
