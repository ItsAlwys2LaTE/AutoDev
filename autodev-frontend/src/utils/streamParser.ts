/**
 * AutoDev Core Utilities — Stream Parser
 * 
 * Handles streaming responses from FastAPI endpoints:
 * 1. Accumulates incoming text chunks.
 * 2. Detects and handles `\n__RESET__\n` sentinels (clears buffer on LLM retry).
 * 3. Detects and extracts `\n__USAGE__{prompt},{completion}` sentinels (token counts).
 * 4. Provides ReadableStream / Response consumer for fetch streams.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamParseResult {
  /** Clean accumulated text with sentinels stripped */
  cleanText: string;
  /** Token usage metadata if emitted in stream */
  usage: TokenUsage | null;
  /** True if a model retry occurred and buffer was flushed */
  didReset: boolean;
}

export const SENTINEL_RESET = '__RESET__';
export const SENTINEL_USAGE = '__USAGE__';
export const USAGE_REGEX = /(?:\r?\n)?__USAGE__(\d+),(\d+)\s*$/;

/**
 * Extracts the token usage sentinel from the text if present at the end of stream.
 */
export function extractUsageSentinel(text: string): { cleanText: string; usage: TokenUsage | null } {
  const match = text.match(USAGE_REGEX);
  if (!match) {
    return { cleanText: text, usage: null };
  }

  const promptTokens = parseInt(match[1], 10) || 0;
  const completionTokens = parseInt(match[2], 10) || 0;
  const usage: TokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };

  const cleanText = text.slice(0, match.index);
  return { cleanText, usage };
}

/**
 * Handles LLM reset sentinels. If __RESET__ is found, discards all text prior to
 * the last __RESET__ delimiter.
 */
export function handleResetSentinel(text: string): { cleanText: string; didReset: boolean } {
  if (!text.includes(SENTINEL_RESET)) {
    return { cleanText: text, didReset: false };
  }

  const parts = text.split(SENTINEL_RESET);
  let cleanText = parts[parts.length - 1];
  // Strip leading newline left by \n__RESET__\n if present
  if (cleanText.startsWith('\n')) {
    cleanText = cleanText.slice(1);
  } else if (cleanText.startsWith('\r\n')) {
    cleanText = cleanText.slice(2);
  }

  return { cleanText, didReset: true };
}

/**
 * Parses an incoming streaming chunk against an accumulated buffer,
 * handling both __RESET__ and __USAGE__ sentinels.
 * 
 * @param currentBuffer Existing accumulated text.
 * @param incomingChunk Newly received chunk (optional).
 * @returns Clean accumulated text, parsed token usage, and reset status.
 */
export function parseStreamChunk(currentBuffer: string, incomingChunk: string = ''): StreamParseResult {
  const combined = currentBuffer + incomingChunk;
  
  // 1. Process LLM retry sentinel
  const resetResult = handleResetSentinel(combined);
  
  // 2. Process token usage sentinel
  const usageResult = extractUsageSentinel(resetResult.cleanText);

  return {
    cleanText: usageResult.cleanText,
    usage: usageResult.usage,
    didReset: resetResult.didReset,
  };
}

export interface ConsumeStreamOptions {
  /** Callback fired whenever new text is received or updated */
  onChunk?: (cleanAccumulated: string, rawChunk: string) => void;
  /** Callback fired when an LLM retry flush is triggered */
  onReset?: () => void;
  /** Callback fired when token usage sentinel is extracted */
  onUsage?: (usage: TokenUsage) => void;
  /** Abort signal to cancel streaming */
  signal?: AbortSignal;
}

export interface ConsumeStreamResult {
  fullText: string;
  cleanText: string;
  usage: TokenUsage | null;
}

/**
 * Consumes a fetch ReadableStream<Uint8Array> or Response object, parsing chunks and sentinels in real time.
 */
export async function consumeStream(
  streamOrResponse: ReadableStream<Uint8Array> | Response,
  options: ConsumeStreamOptions = {}
): Promise<ConsumeStreamResult> {
  let stream: ReadableStream<Uint8Array> | null = null;
  if ('body' in streamOrResponse) {
    stream = streamOrResponse.body;
  } else {
    stream = streamOrResponse;
  }

  if (!stream) {
    throw new Error('ReadableStream body is null, cannot stream.');
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let finalUsage: TokenUsage | null = null;

  try {
    while (true) {
      if (options.signal?.aborted) {
        await reader.cancel();
        throw new DOMException('Aborted by user', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const parsed = parseStreamChunk(accumulated, chunk);

      if (parsed.didReset && options.onReset) {
        options.onReset();
      }

      if (parsed.usage) {
        finalUsage = parsed.usage;
        if (options.onUsage) {
          options.onUsage(parsed.usage);
        }
      }

      accumulated = parsed.cleanText;

      if (options.onChunk) {
        options.onChunk(accumulated, chunk);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    fullText: accumulated,
    cleanText: accumulated,
    usage: finalUsage,
  };
}
