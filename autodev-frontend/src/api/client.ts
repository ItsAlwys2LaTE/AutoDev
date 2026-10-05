/**
 * AutoDev Resilient API Client
 * Features:
 * - 3-tier exponential backoff retries on network failures
 * - Online/offline listener integration (waits for window 'online' event)
 * - AbortController integration (gracefully ignores user aborts without false alarm errors)
 * - Sentinel-aware streaming parser (__RESET__, __USAGE__)
 */

// ============================================================================
// Custom Error Hierarchy
// ============================================================================

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: any;

  constructor(status: number, statusText: string, body: any) {
    const detail =
      typeof body === 'object' && body?.detail
        ? body.detail
        : typeof body === 'string'
        ? body
        : statusText;
    super(`API Error ${status}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class ApiAbortError extends Error {
  constructor(message: string = 'Operation aborted by user') {
    super(message);
    this.name = 'AbortError';
    Object.setPrototypeOf(this, ApiAbortError.prototype);
  }
}

// ============================================================================
// Global Abort & Network Listener Registration
// ============================================================================

let activeGlobalAbortController: AbortController | null = null;
const offlineListeners = new Set<() => void>();
const onlineListeners = new Set<() => void>();

/**
 * Registers an active AbortController globally so requests automatically attach to it.
 */
export function setActiveAbortController(controller: AbortController | null): void {
  activeGlobalAbortController = controller;
}

export function getActiveAbortController(): AbortController | null {
  return activeGlobalAbortController;
}

/**
 * User-triggered abort helper: halts all active requests cleanly.
 */
export function abortAllActiveRequests(): void {
  if (activeGlobalAbortController) {
    activeGlobalAbortController.abort();
    activeGlobalAbortController = null;
  }
}

/**
 * Subscribes UI components to offline/online connection state transitions.
 */
export function onNetworkOffline(callback: () => void): () => void {
  offlineListeners.add(callback);
  return () => offlineListeners.delete(callback);
}

export function onNetworkOnline(callback: () => void): () => void {
  onlineListeners.add(callback);
  return () => onlineListeners.delete(callback);
}

function notifyOffline(): void {
  offlineListeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error('Error in offline listener', err);
    }
  });
}

function notifyOnline(): void {
  onlineListeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error('Error in online listener', err);
    }
  });
}

// Window lifecycle bindings
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    console.warn('[AutoDev Network] Window offline event detected.');
    notifyOffline();
  });

  window.addEventListener('online', () => {
    console.info('[AutoDev Network] Window online event detected.');
    notifyOnline();
  });
}

/**
 * Returns a promise that resolves immediately if navigator.onLine is true,
 * or awaits the next window 'online' event.
 */
export function waitForOnline(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      resolve();
      return;
    }
    const handler = () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handler);
      }
      resolve();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handler);
    } else {
      resolve();
    }
  });
}

// ============================================================================
// Retry & Network Evaluation Logic
// ============================================================================

export interface RetryOptions {
  retries?: number; // Default: 3
  baseDelayMs?: number; // Default: 1000ms
  backoffFactor?: number; // Default: 2
  maxDelayMs?: number; // Default: 10000ms
  signal?: AbortSignal;
}

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  return err.name === 'AbortError' || err instanceof ApiAbortError || err.code === 20;
}

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof NetworkError) {
    return true;
  }
  const msg = (error as any)?.message?.toLowerCase() || '';
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('connection refused')
  );
}

function calculateDelay(attempt: number, baseMs: number, factor: number, maxMs: number): number {
  const expDelay = baseMs * Math.pow(factor, attempt);
  const jitter = Math.random() * 250;
  return Math.min(maxMs, expDelay + jitter);
}

// ============================================================================
// Core fetchWithAutoRetry Implementation
// ============================================================================

/**
 * Resilient fetch wrapper with auto-retry on network dropouts,
 * exponential backoff, online listener reconnection, and user abort handling.
 */
export async function fetchWithAutoRetry(
  input: RequestInfo | URL,
  init: RequestInit & RetryOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    baseDelayMs = 1000,
    backoffFactor = 2,
    maxDelayMs = 10000,
    ...fetchOptions
  } = init;

  // Automatically attach active global abort signal if none provided
  if (!fetchOptions.signal && activeGlobalAbortController) {
    fetchOptions.signal = activeGlobalAbortController.signal;
  }

  // Pre-flight check: if already aborted, bail immediately
  if (fetchOptions.signal?.aborted) {
    throw new ApiAbortError();
  }

  let attempt = 0;

  while (true) {
    try {
      // Check if aborted before initiating network request
      if (fetchOptions.signal?.aborted) {
        throw new ApiAbortError();
      }

      const response = await fetch(input, fetchOptions);

      // Return immediately for 2xx / successful response
      if (response.ok) {
        return response;
      }

      // Check for transient 502/503/504 gateway failures that warrant retry
      const isTransientServerError = [502, 503, 504].includes(response.status);
      if (isTransientServerError && attempt < retries) {
        attempt++;
        const delay = calculateDelay(attempt - 1, baseDelayMs, backoffFactor, maxDelayMs);
        console.warn(
          `[AutoDev Client] Server returned ${response.status}. Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retries})...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // For non-transient HTTP errors (e.g. 400, 404, 500), parse and throw ApiError
      let errorBody: any = null;
      try {
        const text = await response.text();
        try {
          errorBody = JSON.parse(text);
        } catch {
          errorBody = text;
        }
      } catch {
        errorBody = response.statusText;
      }

      throw new ApiError(response.status, response.statusText, errorBody);
    } catch (err: unknown) {
      // 1. Immediately rethrow aborts without retrying or emitting toasts
      if (isAbortError(err) || fetchOptions.signal?.aborted) {
        throw new ApiAbortError();
      }

      // 2. If it is an ApiError (HTTP status failure), don't retry standard 4xx/500 errors
      if (err instanceof ApiError) {
        throw err;
      }

      // 3. Check for network disconnects
      if (isNetworkError(err) && attempt < retries) {
        attempt++;
        console.warn(
          `[AutoDev Client] Network connection error on request to ${input.toString()}. Waiting for reconnect (attempt ${attempt}/${retries})...`
        );
        notifyOffline();

        // Await online event
        await waitForOnline();
        notifyOnline();

        const delay = calculateDelay(attempt - 1, baseDelayMs, backoffFactor, maxDelayMs);
        console.info(`[AutoDev Client] Network restored. Retrying in ${Math.round(delay)}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Exhausted retries or non-retriable error
      throw err;
    }
  }
}

// ============================================================================
// Streaming & Sentinel Parser Utilities
// ============================================================================

export interface StreamCallbacks {
  onChunk?: (accumulatedText: string, deltaChunk: string) => void;
  onReset?: () => void;
  onUsage?: (promptTokens: number, candidateTokens: number) => void;
}

export interface StreamResult {
  fullText: string;
  cleanedText: string;
  usage?: { prompt: number; candidate: number };
}

/**
 * Consumes a chunked HTTP stream, handling __RESET__ and __USAGE__ sentinels.
 */
export async function consumeStream(
  response: Response,
  callbacks: StreamCallbacks = {}
): Promise<StreamResult> {
  if (!response.body) {
    throw new Error('Response body is null, cannot stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedBuffer = '';
  let tokenUsage: { prompt: number; candidate: number } | undefined = undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedBuffer += chunk;

      // 1. Handle __RESET__ sentinel
      if (accumulatedBuffer.includes('__RESET__')) {
        const parts = accumulatedBuffer.split('__RESET__');
        accumulatedBuffer = parts[parts.length - 1];
        // Strip leading newlines if left behind
        if (accumulatedBuffer.startsWith('\n')) {
          accumulatedBuffer = accumulatedBuffer.slice(1);
        } else if (accumulatedBuffer.startsWith('\r\n')) {
          accumulatedBuffer = accumulatedBuffer.slice(2);
        }
        if (callbacks.onReset) {
          callbacks.onReset();
        }
      }

      // 2. Handle __USAGE__ sentinel
      if (accumulatedBuffer.includes('__USAGE__')) {
        const parts = accumulatedBuffer.split('__USAGE__');
        accumulatedBuffer = parts[0];
        const usageRaw = parts[1]?.trim();
        if (usageRaw) {
          const [pStr, cStr] = usageRaw.split(',');
          const prompt = parseInt(pStr, 10) || 0;
          const candidate = parseInt(cStr, 10) || 0;
          tokenUsage = { prompt, candidate };
          if (callbacks.onUsage) {
            callbacks.onUsage(prompt, candidate);
          }
        }
      }

      if (callbacks.onChunk) {
        callbacks.onChunk(accumulatedBuffer, chunk);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Final trailing strip of __USAGE__ if present
  const usageRegex = /\r?\n__USAGE__\d+,\d+\s*$/;
  const cleanedText = accumulatedBuffer.replace(usageRegex, '').trim();

  return {
    fullText: accumulatedBuffer,
    cleanedText,
    usage: tokenUsage,
  };
}
