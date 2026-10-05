export interface JsonRetryOptions {
  maxRetries?: number;           // Default: 3
  fallbackModel?: string;        // Default: 'gemini-3.1-flash-lite'
  phaseName: string;             // For logging: 'CODEGEN', 'DESIGN', etc.
  onRetryAttempt?: (attempt: number, maxAttempts: number, error: Error) => void;
}

export class JsonParseExhaustedError extends Error {
  public readonly phaseName: string;
  public readonly totalAttempts: number;
  
  constructor(message: string, phaseName: string, totalAttempts: number) {
    super(message);
    this.name = 'JsonParseExhaustedError';
    this.phaseName = phaseName;
    this.totalAttempts = totalAttempts;
  }
}

export function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  const msg = String(err).toLowerCase();
  return (
    msg.includes('json') ||
    msg.includes('unexpected token') ||
    msg.includes('unexpected end of json') ||
    msg.includes('parse') ||
    msg.includes('json_parse_failure')
  );
}

export async function withJsonRetry<T>(
  apiCall: (options?: { model?: string }) => Promise<T>,
  parseResult: (raw: T) => any,
  options: JsonRetryOptions,
): Promise<any> {
  const { maxRetries = 3, fallbackModel = 'gemini-3.1-flash-lite', phaseName, onRetryAttempt } = options;
  
  // Attempt 1 to maxRetries: Primary model
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const raw = await apiCall();
      return parseResult(raw);  // throws if JSON parse fails
    } catch (err) {
      if (!isJsonParseError(err)) throw err;  // Non-parse errors propagate immediately
      onRetryAttempt?.(attempt, maxRetries + 1, err as Error);
      console.warn(`[JSON Retry] ${phaseName} attempt ${attempt}/${maxRetries}: ${err}`);
    }
  }
  
  // Final Attempt: Fallback model
  if (fallbackModel) {
    try {
      onRetryAttempt?.(maxRetries + 1, maxRetries + 1, new Error('Switching to fallback model'));
      const raw = await apiCall({ model: fallbackModel });
      return parseResult(raw);
    } catch (err) {
      // All attempts exhausted, fall through to throwing ExhaustedError
      console.warn(`[JSON Retry] ${phaseName} fallback attempt failed: ${err}`);
    }
  }
  
  throw new JsonParseExhaustedError(
    'Please try again after some time',
    phaseName,
    maxRetries + 1,
  );
}
