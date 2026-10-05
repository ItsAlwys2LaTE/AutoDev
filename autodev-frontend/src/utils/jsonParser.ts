/**
 * AutoDev Core Utilities — Robust JSON Parser
 * 
 * Provides hardened JSON sanitization and parsing to safely recover from:
 * 1. Markdown code fence wrapping (```json ... ``` or unclosed ```).
 * 2. LLM retry sentinels (__RESET__) and token usage sentinels (__USAGE__).
 * 3. Windows file path backslash collisions (e.g. \users -> \\users).
 * 4. Regex word boundary backspace collisions (\b -> \\b instead of ASCII 0x08).
 * 5. Non-standard escape sequences (\d, \s, \w, \$ -> \\d, \\s, etc.).
 * 6. Unescaped control characters (newlines, carriage returns, tabs inside strings).
 * 7. Trailing commas in objects ({a: 1,}) and arrays ([1, 2,]).
 * 8. Truncated streaming responses (auto-closes hanging strings, brackets, and braces).
 */

const VALID_SINGLE_ESCAPES = new Set(['"', '\\', '/', 'f', 'n', 'r', 't']);
const HEX_CHARS = new Set('0123456789abcdefABCDEF');

/**
 * Strips surrounding markdown code fences, embedded markdown blocks,
 * and trailing LLM sentinels from a raw string.
 */
export function cleanRawJsonInput(rawInput: string): string {
  if (typeof rawInput !== 'string') return '';
  let str = rawInput;

  // 1. Resolve LLM retry sentinel (__RESET__)
  if (str.includes('__RESET__')) {
    const parts = str.split('__RESET__');
    str = parts[parts.length - 1];
  }

  // 2. Strip anchored __USAGE__ sentinel at the end of the payload
  const usageIdx = str.search(/\r?\n?__USAGE__\d+,\d+\s*$/);
  if (usageIdx !== -1) {
    str = str.slice(0, usageIdx);
  }

  str = str.trim();

  // 3. Extract from markdown fences
  const fenceMatch = str.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    str = fenceMatch[1].trim();
  } else if (str.startsWith('```')) {
    // Truncated markdown fence: starts with ``` but not closed
    const firstEnd = str.indexOf('\n');
    if (firstEnd !== -1) str = str.slice(firstEnd + 1);
    const lastFence = str.lastIndexOf('```');
    if (lastFence !== -1) str = str.slice(0, lastFence);
    str = str.trim();
  } else {
    // Embedded markdown code fence inside explanatory text
    const embeddedMatch = str.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (embeddedMatch) {
      const candidate = embeddedMatch[1].trim();
      if (candidate.startsWith('{') || candidate.startsWith('[')) {
        str = candidate;
      }
    }
  }

  return str;
}

/**
 * Sanitizes JSON strings by escaping unescaped characters, balancing brackets,
 * skipping trailing commas, and recovering from truncated streams.
 */
export function sanitizeJsonString(rawStr: string): string {
  const cleaned = cleanRawJsonInput(rawStr);
  if (!cleaned) return '{}';

  let sanitized = '';
  let inString = false;
  let escapeNext = false;
  const containerStack: Array<'{' | '['> = [];
  const len = cleaned.length;

  for (let i = 0; i < len; i++) {
    const c = cleaned[i];

    if (!inString) {
      if (c === '"') {
        inString = true;
        sanitized += c;
      } else if (c === '{' || c === '[') {
        containerStack.push(c);
        sanitized += c;
      } else if (c === '}' && containerStack.length > 0 && containerStack[containerStack.length - 1] === '{') {
        containerStack.pop();
        sanitized += c;
      } else if (c === ']' && containerStack.length > 0 && containerStack[containerStack.length - 1] === '[') {
        containerStack.pop();
        sanitized += c;
      } else if (c === ',') {
        // Lookahead to skip trailing commas before closing braces/brackets
        let nextIdx = i + 1;
        while (nextIdx < len && /\s/.test(cleaned[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx < len && (cleaned[nextIdx] === '}' || cleaned[nextIdx] === ']')) {
          continue; // Omit trailing comma
        }
        sanitized += c;
      } else {
        sanitized += c;
      }
    } else {
      // Inside a string literal
      if (escapeNext) {
        if (c === 'u') {
          // Lookahead 4 characters for valid hex digits
          const hexCandidate = cleaned.slice(i + 1, i + 5);
          if (hexCandidate.length === 4 && [...hexCandidate].every((h) => HEX_CHARS.has(h))) {
            sanitized += c; // Valid \uXXXX escape
          } else {
            sanitized += '\\' + c; // Invalid Unicode like \users -> \\users
          }
        } else if (c === 'b') {
          // Double-escape \b so regex word boundaries are preserved rather than converted to ASCII 0x08
          sanitized += '\\' + c;
        } else if (VALID_SINGLE_ESCAPES.has(c)) {
          sanitized += c;
        } else {
          // Non-standard escape sequence like \d, \s, \w, \$ -> \\d, \\s
          sanitized += '\\' + c;
        }
        escapeNext = false;
      } else if (c === '\\') {
        sanitized += c;
        escapeNext = true;
      } else if (c === '"') {
        inString = false;
        sanitized += c;
      } else if (c === '\n') {
        sanitized += '\\n';
      } else if (c === '\r') {
        sanitized += '\\r';
      } else if (c === '\t') {
        sanitized += '\\t';
      } else if (c.charCodeAt(0) < 32) {
        // Strip raw ASCII control codes
      } else {
        sanitized += c;
      }
    }
  }

  // Auto-close string if stream was truncated mid-string
  if (inString) {
    if (escapeNext) {
      sanitized += '\\'; // Neutralize hanging backslash
    }
    sanitized += '"';
  }

  // Auto-close unclosed object and array containers to recover valid JSON
  while (containerStack.length > 0) {
    const openChar = containerStack.pop();
    sanitized += openChar === '{' ? '}' : ']';
  }

  return sanitized;
}

/**
 * Robust JSON parser that recovers from malformed markdown, unclosed streams,
 * trailing commas, and escaped regex/path characters.
 * 
 * @throws SyntaxError if JSON cannot be recovered.
 */
export function robustJsonParse<T = unknown>(rawStr: string): T {
  if (typeof rawStr !== 'string') {
    return rawStr as T;
  }
  const sanitized = sanitizeJsonString(rawStr);
  return JSON.parse(sanitized) as T;
}

/**
 * Safe JSON parser wrapper.
 * Returns either parsed data or a legacy-compatible { error: string } fallback object
 * (or user-specified fallback) without throwing.
 */
export function safeJsonParse<T = unknown>(rawStr: string, fallback?: T): T | { error: string } {
  try {
    return robustJsonParse<T>(rawStr);
  } catch (err: unknown) {
    if (fallback !== undefined) {
      return fallback;
    }
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}
