/**
 * AutoDev Stores & State Persistence Hub
 *
 * Single export surface for Zustand stores and persistence bridge.
 */

import type { AutoDevStateV1 } from '../types';
import { useAppStore } from './appStore';
import { useSessionStore } from './sessionStore';
import {
  savePersistedState,
  clearPersistedState,
} from './persistence';

export * from './appStore';
export * from './sessionStore';
export * from './persistence';

/**
 * Aggregates state across useAppStore and useSessionStore into a complete AutoDevStateV1 object.
 * Strictly replicates legacy backend/index.html:getCurrentState() structure.
 */
export function captureCurrentState(): AutoDevStateV1 {
  const snapshot = useAppStore.getState().toSnapshot();
  const sessionUsage = useSessionStore.getState().sessionUsage;

  return {
    ...snapshot,
    sessionUsage: { ...sessionUsage },
  };
}

/**
 * Hydrates useAppStore and useSessionStore from a validated AutoDevStateV1 snapshot.
 */
export function hydrateStores(persisted: AutoDevStateV1): void {
  if (!persisted) return;

  // Hydrate persistent pipeline store (also calculates derived steppers & restoration banner)
  useAppStore.getState().loadSnapshot(persisted);

  // Hydrate transient session usage
  if (persisted.sessionUsage) {
    useSessionStore.getState().setSessionUsage(persisted.sessionUsage);
  }
}

/**
 * Convenience helper to persist the current store snapshot.
 */
export function persistState(immediate: boolean = false): void {
  savePersistedState(captureCurrentState(), immediate);
}

/**
 * Convenience helper to immediately flush state synchronously.
 */
export function persistStateSync(): void {
  savePersistedState(captureCurrentState(), true);
}

/**
 * Deep workspace reset: purges storage, cancels timers, resets both stores.
 */
export function resetAllStores(): void {
  clearPersistedState();
  useAppStore.getState().requestNewProduct();
  useSessionStore.getState().resetSessionStore();
}
