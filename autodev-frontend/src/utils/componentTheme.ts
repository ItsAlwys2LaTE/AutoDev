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
}

/**
 * Curated palette of soft, muted aesthetic hues matching AutoDev's dark obsidian glassmorphism.
 * Low saturation, non-glaring pastel-luminous tones with gentle 5% background tints.
 */
export const COMPONENT_PALETTE: Array<Omit<ComponentTheme, 'number' | 'index'>> = [
  {
    name: 'indigo',
    color: '#818cf8',
    bgTint: 'rgba(99, 102, 241, 0.05)',
    borderTint: 'rgba(99, 102, 241, 0.18)',
    badgeBg: 'rgba(99, 102, 241, 0.12)',
    badgeText: '#c7d2fe',
  },
  {
    name: 'emerald',
    color: '#34d399',
    bgTint: 'rgba(16, 185, 129, 0.05)',
    borderTint: 'rgba(16, 185, 129, 0.18)',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeText: '#a7f3d0',
  },
  {
    name: 'sky',
    color: '#38bdf8',
    bgTint: 'rgba(14, 165, 233, 0.05)',
    borderTint: 'rgba(14, 165, 233, 0.18)',
    badgeBg: 'rgba(14, 165, 233, 0.12)',
    badgeText: '#bae6fd',
  },
  {
    name: 'violet',
    color: '#a78bfa',
    bgTint: 'rgba(139, 92, 246, 0.05)',
    borderTint: 'rgba(139, 92, 246, 0.18)',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    badgeText: '#ddd6fe',
  },
  {
    name: 'amber',
    color: '#fbbf24',
    bgTint: 'rgba(245, 158, 11, 0.05)',
    borderTint: 'rgba(245, 158, 11, 0.18)',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeText: '#fde68a',
  },
  {
    name: 'teal',
    color: '#2dd4bf',
    bgTint: 'rgba(20, 184, 166, 0.05)',
    borderTint: 'rgba(20, 184, 166, 0.18)',
    badgeBg: 'rgba(20, 184, 166, 0.12)',
    badgeText: '#99f6e4',
  },
  {
    name: 'rose',
    color: '#fb7185',
    bgTint: 'rgba(244, 63, 94, 0.05)',
    borderTint: 'rgba(244, 63, 94, 0.18)',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeText: '#fecdd3',
  },
  {
    name: 'cyan',
    color: '#22d3ee',
    bgTint: 'rgba(6, 182, 212, 0.05)',
    borderTint: 'rgba(6, 182, 212, 0.18)',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    badgeText: '#a5f3fc',
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
 * Returns the complete theme specification for a component.
 */
export function getComponentTheme(
  identifier: string | number,
  components?: Array<{ component_id?: string }>
): ComponentTheme {
  const index = resolveComponentIndex(identifier, components);
  const paletteItem = COMPONENT_PALETTE[index % COMPONENT_PALETTE.length];
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
