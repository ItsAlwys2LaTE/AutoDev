/**
 * AutoDev Core Utilities — ZIP Exporter
 * 
 * Provides client-side and headless ZIP archive generation using JSZip.
 * Features:
 * 1. Exports CodeFile[] collections or filename-to-code maps.
 * 2. Injects requirements.txt openpyxl dependency if pandas is present.
 * 3. Rewrites non-existent brand icons from 'lucide-react' to valid generic Lucide icons.
 * 4. Auto-injects README.md if missing from codebase.
 * 5. Handles client-side browser download triggers with URL revoking.
 */

import JSZip from 'jszip';

export interface CodeFile {
  file_name: string;
  source_code: string;
}

export type ZipExportSource =
  | CodeFile[]
  | { files: CodeFile[] }
  | Record<string, string>;

export interface ZipExportOptions {
  projectTitle?: string;
  fallbackReadmeTitle?: string;
  downloadFilename?: string;
}

/**
 * Mapping of unsupported/brand icons in lucide-react to valid standard icons.
 */
export const LUCIDE_ICON_MAP: Readonly<Record<string, string>> = {
  Facebook: 'Globe',
  Twitter: 'MessageCircle',
  Instagram: 'Camera',
  Youtube: 'Play',
  YouTube: 'Play',
  Linkedin: 'Briefcase',
  LinkedIn: 'Briefcase',
  Github: 'Code',
  GitHub: 'Code',
  Gitlab: 'Code2',
  GitLab: 'Code2',
  Tiktok: 'Music',
  TikTok: 'Music',
  Discord: 'MessageSquare',
  Slack: 'Hash',
  Twitch: 'Tv',
  Reddit: 'MessageCircle',
  Pinterest: 'Pin',
  Snapchat: 'Ghost',
  Whatsapp: 'Phone',
  WhatsApp: 'Phone',
  Telegram: 'Send',
  Medium: 'BookOpen',
  Google: 'Search',
  Chrome: 'Compass',
  Apple: 'Smartphone',
  Android: 'Bot',
  Paypal: 'CreditCard',
  PayPal: 'CreditCard',
  Stripe: 'CreditCard',
  Spotify: 'Music',
  Netflix: 'Tv',
  Amazon: 'ShoppingBag',
};

/**
 * Sanitizes lucide-react imports in JS/TS files by replacing invalid icons with aliases.
 */
export function sanitizeLucideImports(sourceCode: string): string {
  if (!sourceCode || !sourceCode.includes('lucide-react')) {
    return sourceCode;
  }

  return sourceCode.replace(
    /(import\s*\{)([^}]+)(\}\s*from\s*['"]lucide-react['"];?)/g,
    (_match, p1, p2, p3) => {
      const specs = p2.split(',').map((s: string) => {
        const trimmed = s.trim();
        if (!trimmed) return s;

        if (trimmed.includes(' as ')) {
          const [orig] = trimmed.split(' as ').map((x: string) => x.trim());
          if (LUCIDE_ICON_MAP[orig]) {
            return s.replace(orig, LUCIDE_ICON_MAP[orig]);
          }
        } else if (LUCIDE_ICON_MAP[trimmed]) {
          const lead = s.match(/^\s*/)?.[0] || '';
          const trail = s.match(/\s*$/)?.[0] || '';
          return `${lead}${LUCIDE_ICON_MAP[trimmed]} as ${trimmed}${trail}`;
        }
        return s;
      });
      return `${p1}${specs.join(',')}${p3}`;
    }
  );
}

/**
 * Normalizes input source into an array of CodeFile objects.
 */
export function normalizeCodeFiles(source: ZipExportSource): CodeFile[] {
  if (Array.isArray(source)) {
    return source;
  }
  if ('files' in source && Array.isArray(source.files)) {
    return source.files;
  }
  // Record<string, string>
  return Object.entries(source).map(([file_name, source_code]) => ({
    file_name,
    source_code,
  }));
}

/**
 * Sanitizes requirements.txt to include openpyxl if pandas is present.
 */
export function sanitizeRequirementsTxt(sourceCode: string): string {
  if (sourceCode.includes('pandas') && !sourceCode.includes('openpyxl')) {
    return `${sourceCode.trimEnd()}\nopenpyxl>=3.1.2\n`;
  }
  return sourceCode;
}

/**
 * Builds a JSZip instance populated with sanitized files and auto-generated README.
 */
export async function buildZipBlob(
  source: ZipExportSource,
  options: ZipExportOptions = {}
): Promise<Blob> {
  const files = normalizeCodeFiles(source);
  if (files.length === 0) {
    throw new Error('No files provided to export.');
  }

  const zip = new JSZip();

  files.forEach((file) => {
    const lowerName = file.file_name.toLowerCase();

    if (lowerName === 'requirements.txt') {
      const sanitizedReqs = sanitizeRequirementsTxt(file.source_code || '');
      zip.file(file.file_name, sanitizedReqs);
    } else {
      let code = file.source_code || '';
      const isJsTs =
        lowerName.endsWith('.js') ||
        lowerName.endsWith('.jsx') ||
        lowerName.endsWith('.ts') ||
        lowerName.endsWith('.tsx');

      if (isJsTs) {
        code = sanitizeLucideImports(code);
      }
      zip.file(file.file_name, code);
    }
  });

  // Inject README.md if not present in codebase
  const hasReadme = files.some((f) => f.file_name.toLowerCase() === 'readme.md');
  if (!hasReadme) {
    const title = options.projectTitle || options.fallbackReadmeTitle || 'AutoDev Project';
    zip.file('README.md', `# ${title}\n\nGenerated autonomously by AutoDev.\n`);
  }

  // Inject USER_GUIDE.md if not present in codebase
  const hasUserGuide = files.some((f) => f.file_name.toLowerCase() === 'user_guide.md');
  if (!hasUserGuide) {
    const title = options.projectTitle || options.fallbackReadmeTitle || 'AutoDev Project';
    zip.file(
      'USER_GUIDE.md',
      `# ${title} - User Guide\n\nComprehensive user guide generated autonomously by AutoDev.\n`
    );
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Generates and triggers client-side download of a ZIP archive.
 */
export async function exportZip(
  source: ZipExportSource,
  options: ZipExportOptions = {}
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('exportZip download can only be invoked in a browser environment.');
  }

  const blob = await buildZipBlob(source, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const rawName = options.downloadFilename || options.projectTitle || 'project';
  const safeName = rawName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `${safeName}_autodev.zip`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
