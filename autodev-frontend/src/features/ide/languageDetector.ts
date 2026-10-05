/**
 * AutoDev IDE Language Detector
 * 
 * Auto-detects Monaco editor language mode from file extension.
 * Supports: python, typescript, javascript, json, markdown, html, css, etc.
 */

const EXTENSION_MAP: Readonly<Record<string, string>> = {
  // Python
  py: 'python',
  pyw: 'python',
  pyx: 'python',

  // TypeScript
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',

  // JavaScript
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',

  // Web formats
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',

  // Data & Configuration
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  env: 'ini',
  xml: 'xml',
  sql: 'sql',

  // Documentation
  md: 'markdown',
  markdown: 'markdown',
  txt: 'plaintext',

  // Shell scripts
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  bat: 'bat',
  cmd: 'bat',

  // Docker & Build
  dockerfile: 'dockerfile',
};

/**
 * Detects Monaco language mode from file name or path.
 * Defaults to 'plaintext' if extension is unknown or missing.
 */
export function detectLanguage(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'plaintext';
  }

  const cleanName = fileName.trim().toLowerCase();

  // Special full filenames
  if (cleanName === 'dockerfile' || cleanName.endsWith('/dockerfile') || cleanName.endsWith('\\dockerfile')) {
    return 'dockerfile';
  }
  if (cleanName.endsWith('.env') || cleanName === '.env') {
    return 'ini';
  }
  if (cleanName === 'makefile' || cleanName.endsWith('/makefile')) {
    return 'makefile';
  }

  // Extract extension
  const dotIndex = cleanName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === cleanName.length - 1) {
    return 'plaintext';
  }

  const ext = cleanName.slice(dotIndex + 1);
  return EXTENSION_MAP[ext] || 'plaintext';
}
