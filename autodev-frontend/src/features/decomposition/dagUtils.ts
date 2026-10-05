/**
 * AutoDev Directed Acyclic Graph (DAG) Utilities
 *
 * Implements topological depth calculation, priority sorting,
 * cycle detection guards, and decomposition schema validation.
 */

import type { ComponentSpec } from '../../types';

export interface DagEdge {
  from: string;
  to: string;
}

export interface DecompositionValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Calculates topological DAG depth for a component in a component list.
 * If cycles or self-dependencies are detected, guards against infinite recursion.
 */
export function calcDepth(
  compId: string,
  compMap: Map<string, ComponentSpec>,
  visited: Set<string> = new Set()
): number {
  if (visited.has(compId)) {
    return 1; // Cycle fallback
  }

  const newVisited = new Set(visited);
  newVisited.add(compId);

  const comp = compMap.get(compId);
  if (!comp || !comp.dependencies_on || comp.dependencies_on.length === 0) {
    return 1;
  }

  let maxDep = 0;
  for (const depId of comp.dependencies_on) {
    // Guard against self-reference and immediate cycles
    if (depId === compId || newVisited.has(depId)) {
      continue;
    }
    maxDep = Math.max(maxDep, calcDepth(depId, compMap, newVisited));
  }
  return maxDep + 1;
}

/**
 * Calculates topological DAG depth for each component and assigns priority_order.
 * Priority order represents the parallel dependency execution tier (1 = no dependencies).
 */
export function calculateDagDepth(components: ComponentSpec[]): ComponentSpec[] {
  if (!components || components.length === 0) {
    return [];
  }

  const compMap = new Map<string, ComponentSpec>(
    components.map((c) => [c.component_id, c])
  );

  return components.map((c) => ({
    ...c,
    priority_order: calcDepth(c.component_id, compMap),
  }));
}

/**
 * Sorts components by priority_order ascending for sequential or tiered DAG scheduling.
 */
export function sortComponentsByPriority(components: ComponentSpec[]): ComponentSpec[] {
  return [...components].sort((a, b) => (a.priority_order ?? 1) - (b.priority_order ?? 1));
}

/**
 * Derives explicit graph edge pairs ({ from, to }) for visualization.
 */
export function deriveDagEdges(components: ComponentSpec[]): DagEdge[] {
  if (!components) return [];
  return components.flatMap((c) =>
    (c.dependencies_on || []).map((dep) => ({ from: dep, to: c.component_id }))
  );
}

/**
 * Validates decomposition schema integrity according to Master Architect guardrails:
 * 1. Must be a valid non-null object.
 * 2. 'is_complex' must be a boolean.
 * 3. If is_complex is true:
 *    - 'components' must be an array.
 *    - Must have at least 3 components (Master Architect >= 3 rule).
 *    - Every component must have non-empty component_id and component_name.
 *    - All component_id values must be unique.
 *    - No component may depend on itself.
 *    - Dependencies must reference known component IDs.
 */
export function validateDecomposition(decomp: any): DecompositionValidationResult {
  const errors: string[] = [];

  if (!decomp || typeof decomp !== 'object') {
    return { valid: false, errors: ['Decomposition output is null or not an object.'] };
  }

  if (typeof decomp.is_complex !== 'boolean') {
    errors.push("Missing or invalid 'is_complex' boolean field.");
  }

  if (decomp.is_complex) {
    if (!Array.isArray(decomp.components)) {
      errors.push("Complex decomposition requires a 'components' array.");
    } else {
      if (decomp.components.length < 3) {
        errors.push(
          `Master Architect rule violation: Complex decomposition must contain at least 3 components (received ${decomp.components.length}).`
        );
      }

      const seenIds = new Set<string>();
      for (const c of decomp.components) {
        if (!c.component_id || typeof c.component_id !== 'string' || !c.component_id.trim()) {
          errors.push('Found component with missing or empty component_id.');
        } else if (seenIds.has(c.component_id.trim())) {
          errors.push(`Duplicate component_id detected: '${c.component_id.trim()}'.`);
        } else {
          seenIds.add(c.component_id.trim());
        }

        if (!c.component_name || typeof c.component_name !== 'string' || !c.component_name.trim()) {
          errors.push(`Component '${c.component_id || 'unknown'}' has missing or empty component_name.`);
        }
      }

      // Check dependencies
      for (const c of decomp.components) {
        const deps = c.dependencies_on || [];
        for (const dep of deps) {
          if (dep === c.component_id) {
            errors.push(`Component '${c.component_id}' cannot depend on itself.`);
          } else if (!seenIds.has(dep)) {
            errors.push(
              `Component '${c.component_id}' references unknown dependency: '${dep}'.`
            );
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
