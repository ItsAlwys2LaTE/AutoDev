/**
 * AutoDev Component Numbering & Aesthetic Color Theme System
 * 
 * Provides a lightweight, unified frontend metadata system for decomposed components:
 * - Assigns natural numbers C1, C2, ..., Cn (1-indexed) based on component sequence
 * - Assigns subtle, muted, aesthetic colors matching dark obsidian glassmorphism
 * - Independent of backend component_id (which remains intact for pipeline operations)
 * - Zero emojis
 */

export interface ComponentTheme {
  number: string;
  index: number;
  name: string;
  color: string;
  bgTint: string;
  borderTint: string;
  badgeBg: string;
  badgeText: string;
  colorLight?: string;
  colorDark?: string;
  badgeTextLight?: string;
  badgeTextDark?: string;
}

/**
 * Curated palette of soft, muted aesthetic hues matching AutoDev's dark obsidian glassmorphism.
 * Low saturation, non-glaring pastel-luminous tones with gentle 5% background tints.
 */
export const COMPONENT_PALETTE: Array<Omit<ComponentTheme, 'number' | 'index'>> = [
  {
    name: 'indigo',
    color: '#818cf8',
    bgTint: 'rgba(99, 102, 241, 0.12)',
    borderTint: 'rgba(99, 102, 241, 0.30)',
    badgeBg: 'rgba(99, 102, 241, 0.20)',
    badgeText: '#c7d2fe',
    colorLight: '#4338ca',
    colorDark: '#818cf8',
    badgeTextLight: '#3730a3',
    badgeTextDark: '#c7d2fe',
  },
  {
    name: 'emerald',
    color: '#34d399',
    bgTint: 'rgba(16, 185, 129, 0.12)',
    borderTint: 'rgba(16, 185, 129, 0.30)',
    badgeBg: 'rgba(16, 185, 129, 0.20)',
    badgeText: '#a7f3d0',
    colorLight: '#047857',
    colorDark: '#34d399',
    badgeTextLight: '#065f46',
    badgeTextDark: '#a7f3d0',
  },
  {
    name: 'sky',
    color: '#38bdf8',
    bgTint: 'rgba(14, 165, 233, 0.12)',
    borderTint: 'rgba(14, 165, 233, 0.30)',
    badgeBg: 'rgba(14, 165, 233, 0.20)',
    badgeText: '#bae6fd',
    colorLight: '#0284c7',
    colorDark: '#38bdf8',
    badgeTextLight: '#075985',
    badgeTextDark: '#bae6fd',
  },
  {
    name: 'violet',
    color: '#a78bfa',
    bgTint: 'rgba(139, 92, 246, 0.12)',
    borderTint: 'rgba(139, 92, 246, 0.30)',
    badgeBg: 'rgba(139, 92, 246, 0.20)',
    badgeText: '#ddd6fe',
    colorLight: '#6d28d9',
    colorDark: '#a78bfa',
    badgeTextLight: '#5b21b6',
    badgeTextDark: '#ddd6fe',
  },
  {
    name: 'amber',
    color: '#fbbf24',
    bgTint: 'rgba(245, 158, 11, 0.12)',
    borderTint: 'rgba(245, 158, 11, 0.30)',
    badgeBg: 'rgba(245, 158, 11, 0.20)',
    badgeText: '#fde68a',
    colorLight: '#b45309',
    colorDark: '#fbbf24',
    badgeTextLight: '#92400e',
    badgeTextDark: '#fde68a',
  },
  {
    name: 'teal',
    color: '#2dd4bf',
    bgTint: 'rgba(20, 184, 166, 0.12)',
    borderTint: 'rgba(20, 184, 166, 0.30)',
    badgeBg: 'rgba(20, 184, 166, 0.20)',
    badgeText: '#99f6e4',
    colorLight: '#0f766e',
    colorDark: '#2dd4bf',
    badgeTextLight: '#115e59',
    badgeTextDark: '#99f6e4',
  },
  {
    name: 'rose',
    color: '#fb7185',
    bgTint: 'rgba(244, 63, 94, 0.12)',
    borderTint: 'rgba(244, 63, 94, 0.30)',
    badgeBg: 'rgba(244, 63, 94, 0.20)',
    badgeText: '#fecdd3',
    colorLight: '#be123c',
    colorDark: '#fb7185',
    badgeTextLight: '#9f1239',
    badgeTextDark: '#fecdd3',
  },
  {
    name: 'cyan',
    color: '#22d3ee',
    bgTint: 'rgba(6, 182, 212, 0.12)',
    borderTint: 'rgba(6, 182, 212, 0.30)',
    badgeBg: 'rgba(6, 182, 212, 0.20)',
    badgeText: '#a5f3fc',
    colorLight: '#0e7490',
    colorDark: '#22d3ee',
    badgeTextLight: '#155e75',
    badgeTextDark: '#a5f3fc',
  },
];

/**
 * Curated high-contrast palette for light mode theme.
 * Uses deeper, richer saturation to ensure high readability and contrast against white surfaces.
 */
export const COMPONENT_PALETTE_LIGHT: Array<Omit<ComponentTheme, 'number' | 'index'>> = [
  {
    name: 'indigo',
    color: '#4338ca',
    bgTint: 'rgba(99, 102, 241, 0.15)',
    borderTint: 'rgba(99, 102, 241, 0.38)',
    badgeBg: 'rgba(99, 102, 241, 0.22)',
    badgeText: '#3730a3',
    colorLight: '#4338ca',
    colorDark: '#818cf8',
    badgeTextLight: '#3730a3',
    badgeTextDark: '#c7d2fe',
  },
  {
    name: 'emerald',
    color: '#047857',
    bgTint: 'rgba(16, 185, 129, 0.15)',
    borderTint: 'rgba(16, 185, 129, 0.38)',
    badgeBg: 'rgba(16, 185, 129, 0.22)',
    badgeText: '#065f46',
    colorLight: '#047857',
    colorDark: '#34d399',
    badgeTextLight: '#065f46',
    badgeTextDark: '#a7f3d0',
  },
  {
    name: 'sky',
    color: '#0284c7',
    bgTint: 'rgba(14, 165, 233, 0.15)',
    borderTint: 'rgba(14, 165, 233, 0.38)',
    badgeBg: 'rgba(14, 165, 233, 0.22)',
    badgeText: '#075985',
    colorLight: '#0284c7',
    colorDark: '#38bdf8',
    badgeTextLight: '#075985',
    badgeTextDark: '#bae6fd',
  },
  {
    name: 'violet',
    color: '#6d28d9',
    bgTint: 'rgba(139, 92, 246, 0.15)',
    borderTint: 'rgba(139, 92, 246, 0.38)',
    badgeBg: 'rgba(139, 92, 246, 0.22)',
    badgeText: '#5b21b6',
    colorLight: '#6d28d9',
    colorDark: '#a78bfa',
    badgeTextLight: '#5b21b6',
    badgeTextDark: '#ddd6fe',
  },
  {
    name: 'amber',
    color: '#b45309',
    bgTint: 'rgba(245, 158, 11, 0.15)',
    borderTint: 'rgba(245, 158, 11, 0.38)',
    badgeBg: 'rgba(245, 158, 11, 0.22)',
    badgeText: '#92400e',
    colorLight: '#b45309',
    colorDark: '#fbbf24',
    badgeTextLight: '#92400e',
    badgeTextDark: '#fde68a',
  },
  {
    name: 'teal',
    color: '#0f766e',
    bgTint: 'rgba(20, 184, 166, 0.15)',
    borderTint: 'rgba(20, 184, 166, 0.38)',
    badgeBg: 'rgba(20, 184, 166, 0.22)',
    badgeText: '#115e59',
    colorLight: '#0f766e',
    colorDark: '#2dd4bf',
    badgeTextLight: '#115e59',
    badgeTextDark: '#99f6e4',
  },
  {
    name: 'rose',
    color: '#be123c',
    bgTint: 'rgba(244, 63, 94, 0.15)',
    borderTint: 'rgba(244, 63, 94, 0.38)',
    badgeBg: 'rgba(244, 63, 94, 0.22)',
    badgeText: '#9f1239',
    colorLight: '#be123c',
    colorDark: '#fb7185',
    badgeTextLight: '#9f1239',
    badgeTextDark: '#fecdd3',
  },
  {
    name: 'cyan',
    color: '#0e7490',
    bgTint: 'rgba(6, 182, 212, 0.15)',
    borderTint: 'rgba(6, 182, 212, 0.38)',
    badgeBg: 'rgba(6, 182, 212, 0.22)',
    badgeText: '#155e75',
    colorLight: '#0e7490',
    colorDark: '#22d3ee',
    badgeTextLight: '#155e75',
    badgeTextDark: '#a5f3fc',
  },
];

/**
 * Deterministically resolves a component's 0-based index from its index, C-number, or ID.
 */
export function resolveComponentIndex(
  identifier: string | number,
  components?: Array<{ component_id?: string }>
): number {
  if (typeof identifier === 'number') {
    return Math.max(0, Math.floor(identifier));
  }

  const str = String(identifier).trim();

  // If already in C1, C2 format
  const cMatch = /^C(\d+)$/i.exec(str);
  if (cMatch) {
    return Math.max(0, parseInt(cMatch[1], 10) - 1);
  }

  // If list of components is supplied, lookup by component_id
  if (components && Array.isArray(components)) {
    const foundIdx = components.findIndex(
      (c) => c && c.component_id && c.component_id.toLowerCase() === str.toLowerCase()
    );
    if (foundIdx !== -1) {
      return foundIdx;
    }
  }

  // Fallback: simple deterministic hash of the identifier string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % COMPONENT_PALETTE.length;
}

/**
 * Returns the natural component number string (e.g. "C1", "C2", ..., "Cn").
 */
export function getComponentNumber(
  identifier: string | number,
  components?: Array<{ component_id?: string }>
): string {
  const index = resolveComponentIndex(identifier, components);
  return `C${index + 1}`;
}

/**
 * Checks whether light mode theme is active in the document.
 */
function isLightMode(): boolean {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('light') || !document.documentElement.classList.contains('dark');
  }
  return false;
}

/**
 * Returns the complete theme specification for a component, adapting colors to light or dark mode.
 */
export function getComponentTheme(
  identifier: string | number,
  components?: Array<{ component_id?: string }>,
  forceDark?: boolean
): ComponentTheme {
  const index = resolveComponentIndex(identifier, components);
  const activeIsLight = forceDark === undefined ? isLightMode() : !forceDark;
  const palette = activeIsLight ? COMPONENT_PALETTE_LIGHT : COMPONENT_PALETTE;
  const paletteItem = palette[index % palette.length];
  return {
    ...paletteItem,
    number: `C${index + 1}`,
    index,
  };
}

/**
 * Formats a component title with its component number prefix (e.g. "C1: BigBasket Backend Services").
 * Prevents redundant double-prefixing if already formatted.
 */
export function formatComponentTitle(componentNumber: string, componentName: string): string {
  if (!componentName) return componentNumber;
  const trimmed = componentName.trim();
  const alreadyPrefixedRegex = /^C\d+:\s*/i;
  if (alreadyPrefixedRegex.test(trimmed)) {
    return trimmed;
  }
  return `${componentNumber}: ${trimmed}`;
}
