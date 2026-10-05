/**
 * AutoDev Core Utilities — Formatters & Log Classification
 * 
 * Provides:
 * 1. Token cost calculations: Gemini 1.5 Flash rates ($0.075 / 1M prompt, $0.30 / 1M completion)
 *    converted to INR at ₹84.0/USD.
 * 2. Timestamp formatting: [YYYY-MM-DD HH:mm:ss] adhering to backend LogInterceptor regex.
 * 3. Log level, source, and Tailwind glassmorphism color classification (emoji-free per R4).
 * 4. Structured document formatters (Requirements Document and System Design Blueprint).
 */

export const GEMINI_15_FLASH_RATES = {
  promptCostPerMillionUsd: 0.075,
  completionCostPerMillionUsd: 0.30,
  usdToInrRate: 84.0,
} as const;

export interface CostCalculationResult {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  usdCost: number;
  inrCost: number;
  formattedInr: string;
  summary: string;
}

/**
 * Calculates token cost using Gemini 1.5 Flash rates and converts to INR.
 */
export function calculateTokenCost(
  promptTokens: number | string,
  completionTokens: number | string
): CostCalculationResult {
  const p = Math.max(0, parseInt(String(promptTokens), 10) || 0);
  const c = Math.max(0, parseInt(String(completionTokens), 10) || 0);
  const totalTokens = p + c;

  const usdCost =
    (p / 1_000_000) * GEMINI_15_FLASH_RATES.promptCostPerMillionUsd +
    (c / 1_000_000) * GEMINI_15_FLASH_RATES.completionCostPerMillionUsd;

  const inrCost = usdCost * GEMINI_15_FLASH_RATES.usdToInrRate;
  const formattedInr = `₹${inrCost.toFixed(4)}`;
  const summary = `₹${inrCost.toFixed(4)} (${totalTokens} tokens)`;

  return {
    promptTokens: p,
    completionTokens: c,
    totalTokens,
    usdCost,
    inrCost,
    formattedInr,
    summary,
  };
}

/**
 * Calculates token cost in INR as a numeric amount.
 * Applies Gemini 1.5 Flash tiered rates (prompts/context > 128k tokens use $0.15/$0.60 per 1M).
 */
export function calculateTokenCostINR(
  promptTokens: number | string,
  completionTokens: number | string
): number {
  const p = Math.max(0, parseInt(String(promptTokens), 10) || 0);
  const c = Math.max(0, parseInt(String(completionTokens), 10) || 0);
  const isHighTier = p > 128_000 || c > 128_000;
  const promptRate = isHighTier ? 0.15 : GEMINI_15_FLASH_RATES.promptCostPerMillionUsd;
  const completionRate = isHighTier ? 0.60 : GEMINI_15_FLASH_RATES.completionCostPerMillionUsd;
  const usdCost = (p / 1_000_000) * promptRate + (c / 1_000_000) * completionRate;
  return usdCost * GEMINI_15_FLASH_RATES.usdToInrRate;
}

/**
 * Formats a numeric INR amount or token tuple to fixed 4 decimal places with ₹ currency symbol.
 */
export function formatCostINR(
  amountOrPrompt: number | string,
  completionTokens?: number | string
): string {
  if (completionTokens !== undefined) {
    return calculateTokenCost(amountOrPrompt, completionTokens).formattedInr;
  }
  const amt = typeof amountOrPrompt === 'number' ? amountOrPrompt : parseFloat(String(amountOrPrompt)) || 0;
  return `₹${amt.toFixed(4)}`;
}

/**
 * Formats a numeric INR amount to fixed 4 decimal places with ₹ currency symbol.
 */
export function formatInr(amount: number): string {
  return `₹${amount.toFixed(4)}`;
}

/**
 * Formats session cost string: ₹X.XXXX (Y tokens).
 */
export function formatSessionCost(
  promptTokens: number | string,
  completionTokens: number | string
): string {
  return calculateTokenCost(promptTokens, completionTokens).summary;
}

// ── Timestamp Formatters ──────────────────────────────────────────────────────

export const TIMESTAMP_REGEX = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/;

/**
 * Formats a Date or timestamp into [YYYY-MM-DD HH:mm:ss] format.
 */
export function formatTimestamp(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `[${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}]`;
}

/**
 * Strips leading [YYYY-MM-DD HH:mm:ss] timestamp if present.
 */
export function stripTimestamp(line: string): string {
  return line.replace(TIMESTAMP_REGEX, '').trimStart();
}

/**
 * Ensures line starts with a timestamp [YYYY-MM-DD HH:mm:ss].
 */
export function ensureTimestamp(line: string, date: Date | number = new Date()): string {
  if (TIMESTAMP_REGEX.test(line.trimStart())) {
    return line.trimStart();
  }
  return `${formatTimestamp(date)} ${line.trimStart()}`;
}

// ── Log Level & Color Classification (Emoji-Free) ──────────────────────────

export type LogLevel =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'SUCCESS'
  | 'SYSTEM'
  | 'REVISION'
  | 'FALLBACK'
  | 'MODEL';

export type LogSource = 'Uvicorn' | 'FastAPI' | 'AutoDev' | 'System' | 'Unknown';

export interface ClassifiedLog {
  raw: string;
  cleanText: string;
  timestamp: string | null;
  level: LogLevel;
  source: LogSource;
  colorClass: string;
}

/**
 * Strips all emoji characters to enforce professional emoji-free UI (R4).
 */
export function stripEmojis(str: string): string {
  return str
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu,
      ''
    )
    .replace(/[\u{1F504}\u{23F3}\u{270F}\u{FE0F}\u{1F4C4}\u{1F4E6}\u{1F680}\u{26A0}]/gu, '')
    .trim();
}

/**
 * Classifies a log line by source, level, and Tailwind color classes.
 */
export function classifyLogMessage(line: string): ClassifiedLog {
  const tsMatch = line.match(/^(\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\])\s*/);
  let timestamp: string | null = null;
  let text = line;

  if (tsMatch) {
    timestamp = tsMatch[1];
    text = line.slice(tsMatch[0].length);
  }

  // Clean emoji characters per R4
  text = stripEmojis(text);

  // Classify source
  let source: LogSource = 'AutoDev';
  if (/uvicorn/i.test(text)) {
    source = 'Uvicorn';
  } else if (/fastapi/i.test(text)) {
    source = 'FastAPI';
  } else if (/\[System\]/i.test(text) || text.startsWith('Connected to') || text.startsWith('Connection to')) {
    source = 'System';
  }

  // Classify level and Tailwind color styling
  let level: LogLevel = 'INFO';
  let colorClass = 'text-slate-300';
  const lower = text.toLowerCase();

  if (lower.includes('differential revision') || lower.includes('broken file') || lower.includes('revising')) {
    level = 'REVISION';
    colorClass = 'text-fuchsia-400 font-bold uppercase tracking-wide';
  } else if (lower.includes('[pause]') || lower.includes('development paused')) {
    level = 'WARNING';
    colorClass = 'text-amber-400 font-bold';
  } else if (lower.includes('[resume]') || lower.includes('development resumed')) {
    level = 'SUCCESS';
    colorClass = 'text-emerald-400 font-bold';
  } else if (lower.includes('[restart]') || lower.includes('development restarted')) {
    level = 'SYSTEM';
    colorClass = 'text-cyan-400 font-bold';
  } else if (
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('traceback') ||
    lower.includes('exception')
  ) {
    level = 'ERROR';
    colorClass = 'text-red-400 font-bold';
  } else if (lower.includes('warn')) {
    level = 'WARNING';
    colorClass = 'text-yellow-400';
  } else if (
    lower.includes('fallback') ||
    lower.includes('switching to') ||
    lower.includes('rotating to')
  ) {
    level = 'FALLBACK';
    colorClass = 'text-amber-300 font-bold';
  } else if (lower.includes('pass') || lower.includes('success') || lower.includes('completed')) {
    level = 'SUCCESS';
    colorClass = 'text-emerald-400';
  } else if (lower.includes('gemini') || lower.includes('agent')) {
    level = 'MODEL';
    colorClass = 'text-cyan-300 font-medium';
  } else if (source === 'System' || lower.includes('[system]')) {
    level = 'SYSTEM';
    colorClass = 'text-blue-400 font-bold';
  }

  return {
    raw: line,
    cleanText: text,
    timestamp,
    level,
    source,
    colorClass,
  };
}

/**
 * Alias for classifyLogMessage.
 */
export const classifyLogLine = classifyLogMessage;

// ── Document Rich Text Formatters (Emoji-Free) ────────────────────────────────

export interface UserStoryFormat {
  title: string;
  as_a: string;
  i_want_to: string;
  so_that: string;
  acceptance_criteria?: Array<{ id: string; description: string; expected_behavior: string }>;
}

export interface RequirementsDocumentFormatData {
  project_title?: string;
  overview?: string;
  user_stories?: UserStoryFormat[];
}

export interface DesignFileSpec {
  file_name: string;
  purpose: string;
  dependencies?: string[];
  pseudocode?: string;
}

export interface SystemDesignBlueprintFormatData {
  architecture_overview?: string;
  files?: DesignFileSpec[];
}

/**
 * Formats a RequirementsDocument into human-readable plain text.
 */
export function formatRequirementsText(data?: RequirementsDocumentFormatData | null): string {
  if (!data) return '';
  let reqText = `PROJECT TITLE:\n${data.project_title || 'N/A'}\n\nOVERVIEW:\n${data.overview || 'N/A'}\n\nUSER STORIES:\n`;
  if (data.user_stories && Array.isArray(data.user_stories)) {
    data.user_stories.forEach((story, i) => {
      reqText += `\n${i + 1}. ${story.title}\n`;
      reqText += `   As a: ${story.as_a}\n`;
      reqText += `   I want to: ${story.i_want_to}\n`;
      reqText += `   So that: ${story.so_that}\n`;
      if (story.acceptance_criteria && Array.isArray(story.acceptance_criteria)) {
        reqText += `   Acceptance Criteria:\n`;
        story.acceptance_criteria.forEach((ac) => {
          reqText += `     • [${ac.id}] ${ac.description}\n`;
          reqText += `       Expected: ${ac.expected_behavior}\n`;
        });
      }
    });
  }
  return reqText;
}

/**
 * Formats a SystemDesignBlueprint into human-readable plain text without emoji characters.
 */
export function formatBlueprintText(data?: SystemDesignBlueprintFormatData | null): string {
  if (!data) return '';
  let bpText = `ARCHITECTURE OVERVIEW:\n${data.architecture_overview || 'N/A'}\n\nFILES TO GENERATE:\n`;
  if (data.files && Array.isArray(data.files)) {
    data.files.forEach((f, i) => {
      bpText += `\n${i + 1}. ${f.file_name}\n`;
      bpText += `   Purpose: ${f.purpose}\n`;
      bpText += `   Dependencies: ${(f.dependencies || []).join(', ') || 'None'}\n`;
      bpText += `   Pseudocode:\n${(f.pseudocode || '')
        .split('\n')
        .map((l) => '     ' + l)
        .join('\n')}\n`;
    });
  }
  return bpText;
}
