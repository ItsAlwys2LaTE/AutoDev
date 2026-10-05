/**
 * AutoDev Surgical Differential Codebase Merger
 * 
 * Handles targeted differential revision patching:
 * 1. When output contains `modified_files` (differential revision schema),
 *    merges them into `currentCodebase.files`, preserving untouched files 100% byte-identical.
 * 2. Normalizes paths for cross-platform consistency (forward slashes, lowercase keys).
 * 3. Appends newly created files introduced during revision.
 * 4. Falls back to full codebase if full `files` array is supplied.
 */

import type { GeneratedCodeBase, CodeFile } from '../../types';

/**
 * Normalizes file paths for reliable dictionary matching.
 * Converts backslashes to forward slashes, strips leading './', and lowercases.
 */
export function normalizePath(path: string): string {
  if (!path || typeof path !== 'string') return '';
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .toLowerCase();
}

/**
 * Checks whether an incoming payload follows the differential revision schema.
 */
export function isDifferentialPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return Array.isArray(payload.modified_files) && !Array.isArray(payload.files);
}

/**
 * Merges a differential patch or full codebase into the existing codebase.
 * 
 * Guarantees:
 * - Untouched files in `currentCodebase` remain 100% byte-identical.
 * - Files modified by the patch have their `source_code` updated.
 * - Any new files introduced in `modified_files` are appended to the codebase.
 */
export function mergeDifferentialCodebase(
  currentCodebase: GeneratedCodeBase | null,
  patchOrCodebase: any
): GeneratedCodeBase {
  if (!patchOrCodebase) {
    return currentCodebase || { files: [] };
  }

  // Case 1: Differential revision schema (`modified_files` present and `files` absent)
  if (
    isDifferentialPayload(patchOrCodebase) &&
    currentCodebase &&
    Array.isArray(currentCodebase.files)
  ) {
    const modMap = new Map<string, CodeFile>();
    for (const file of patchOrCodebase.modified_files) {
      if (file && typeof file.file_name === 'string') {
        modMap.set(normalizePath(file.file_name), file);
      }
    }

    const merged: CodeFile[] = [];
    const seen = new Set<string>();

    // Process existing files
    for (const orig of currentCodebase.files) {
      const key = normalizePath(orig.file_name);
      if (modMap.has(key)) {
        const patchFile = modMap.get(key)!;
        merged.push({
          file_name: orig.file_name, // preserve original casing
          source_code: patchFile.source_code,
        });
        seen.add(key);
      } else {
        // Preserved 100% byte-identical
        merged.push(orig);
        seen.add(key);
      }
    }

    // Process new files added in the differential patch
    for (const mod of patchOrCodebase.modified_files) {
      if (mod && typeof mod.file_name === 'string') {
        const key = normalizePath(mod.file_name);
        if (!seen.has(key)) {
          merged.push({
            file_name: mod.file_name,
            source_code: mod.source_code,
          });
          seen.add(key);
        }
      }
    }

    return { files: merged };
  }

  // Case 2: Full codebase provided (`files` array present)
  if (patchOrCodebase.files && Array.isArray(patchOrCodebase.files)) {
    return { files: [...patchOrCodebase.files] };
  }

  // Case 3: Differential patch without previous codebase
  if (Array.isArray(patchOrCodebase.modified_files)) {
    return { files: [...patchOrCodebase.modified_files] };
  }

  // Case 4: Already a list of CodeFiles
  if (Array.isArray(patchOrCodebase)) {
    return { files: patchOrCodebase };
  }

  return currentCodebase || { files: [] };
}
