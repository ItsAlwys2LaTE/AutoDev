/**
 * AutoDev State Persistence & Quota Pruning Middleware
 *
 * Implements:
 * 1. Storage key `autodev_state_v1` and schema version 1 invariants.
 * 2. 3-tier storage hierarchy: localStorage -> sessionStorage -> in-memory cache.
 * 3. 300ms trailing debounce engine with synchronous flush triggers.
 * 4. 3-tier quota pruning defense (log truncation, revision stripping, buffer deletion).
 * 5. Corrupted state recovery, safe JSON parsing, and schema validation.
 *
 * Authoritative Sources:
 * - backend/index.html (StateStore autodev_state_v1, lines 1750-2028, 2230-2550)
 * - autodev-frontend/src/types/index.ts (AutoDevStateV1, Pydantic models)
 */

import type {
  AutoDevStateV1,
  CodeFile,
  RevisionHistoryItem,
} from '../types';

export const STORAGE_KEY = 'autodev_state_v1';
export const SCHEMA_VERSION = 1;
export const DEBOUNCE_MS = 300;
export const LOG_MAX_CHARS = 2000;
export const PRUNED_PLACEHOLDER = '[PRUNED]';

// Module-level in-memory cache and debounce timer
let _inMemoryCache: AutoDevStateV1 | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Checks whether an error is a browser storage quota exhaustion error.
 */
export function isQuotaExceeded(err: unknown): boolean {
  if (!err) return false;
  const e = err as any;
  return (
    e.name === 'QuotaExceededError' ||
    e.code === 22 ||
    e.number === -2147024882 ||
    (typeof e.message === 'string' && e.message.toLowerCase().includes('quota'))
  );
}

/**
 * 3-Tier Quota Pruning Defense.
 * Reduces state payload size while preserving critical pipeline continuity:
 * - Tier 1: Log truncation to last 2000 chars (...[TRUNCATED]...\n)
 * - Tier 2: Intermediary revision source pruning to '[PRUNED]' (keeps Rev 0 baseline and latest Rev intact when length > 2)
 * - Tier 3: Strip transient stream buffers (_rawStreamBuffer)
 */
export function pruneState(state: AutoDevStateV1): AutoDevStateV1 {
  if (!state) return state;
  const copy: AutoDevStateV1 = JSON.parse(JSON.stringify(state));

  // ── Tier 1: Log Truncation ─────────────────────────────────────────────────
  if (typeof copy.executionLogs === 'string' && copy.executionLogs.length > LOG_MAX_CHARS) {
    copy.executionLogs = '...[TRUNCATED]...\n' + copy.executionLogs.slice(-LOG_MAX_CHARS);
  }

  if (
    copy.singlePass?.executionResult?.logs &&
    typeof copy.singlePass.executionResult.logs === 'string' &&
    copy.singlePass.executionResult.logs.length > LOG_MAX_CHARS
  ) {
    copy.singlePass.executionResult.logs =
      '...[TRUNCATED]...\n' + copy.singlePass.executionResult.logs.slice(-LOG_MAX_CHARS);
  }

  if (
    copy.currentExecutionResult?.logs &&
    typeof copy.currentExecutionResult.logs === 'string' &&
    copy.currentExecutionResult.logs.length > LOG_MAX_CHARS
  ) {
    copy.currentExecutionResult.logs =
      '...[TRUNCATED]...\n' + copy.currentExecutionResult.logs.slice(-LOG_MAX_CHARS);
  }

  if (copy.componentStates && typeof copy.componentStates === 'object') {
    Object.keys(copy.componentStates).forEach((cId) => {
      const cs = copy.componentStates[cId];
      if (
        cs?.executionResult?.logs &&
        typeof cs.executionResult.logs === 'string' &&
        cs.executionResult.logs.length > LOG_MAX_CHARS
      ) {
        cs.executionResult.logs =
          '...[TRUNCATED]...\n' + cs.executionResult.logs.slice(-LOG_MAX_CHARS);
      }
    });
  }

  // ── Tier 2: Intermediary Revision Source Pruning ───────────────────────────
  const pruneHistories: Array<keyof Pick<AutoDevStateV1, 'revisionHistory' | 'integrationRevisionHistory'>> = [
    'revisionHistory',
    'integrationRevisionHistory',
  ];

  pruneHistories.forEach((histKey) => {
    const list = copy[histKey] as RevisionHistoryItem[] | undefined;
    if (Array.isArray(list) && list.length > 2) {
      // Keep index 0 (baseline) and index length - 1 (latest) intact
      for (let r = 1; r < list.length - 1; r++) {
        const rev = list[r];
        if (rev?.codebase && Array.isArray(rev.codebase.files)) {
          rev.codebase.files.forEach((f: CodeFile) => {
            if (f) {
              f.source_code = PRUNED_PLACEHOLDER;
            }
          });
        }
      }
    }
  });

  // ── Tier 3: Strip Raw Stream Buffers & Non-Critical Keys ───────────────────
  delete (copy as any)._rawStreamBuffer;

  return copy;
}

/**
 * Validates that an untrusted object adheres strictly to the AutoDevStateV1 contract.
 */
export function validatePersistedState(raw: unknown): AutoDevStateV1 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, any>;

  // Strict version validation
  if (obj.version !== SCHEMA_VERSION) {
    console.warn(`[StatePersistence] Rejected state with unsupported version: ${obj.version}`);
    return null;
  }

  // Mandatory fields check
  const mandatoryFields: string[] = [
    'version',
    'timestamp',
    'pipelineStatus',
    'inFlightPhase',
    'currentMode',
    'featureRequest',
    'isComponentMode',
  ];

  for (const field of mandatoryFields) {
    if (obj[field] === undefined) {
      console.warn(`[StatePersistence] Rejected state missing mandatory field: ${field}`);
      return null;
    }
  }

  const validStatuses = ['idle', 'running', 'completed', 'aborted'];
  if (!validStatuses.includes(obj.pipelineStatus)) {
    console.warn(`[StatePersistence] Invalid pipelineStatus: ${obj.pipelineStatus}`);
    return null;
  }

  const validModes = ['QUICK', 'COMPLEX', 'UNIFIED'];
  const modeStr = typeof obj.currentMode === 'string' ? obj.currentMode.trim().toUpperCase() : '';
  if (!validModes.includes(modeStr)) {
    console.warn(`[StatePersistence] Invalid currentMode: ${obj.currentMode}`);
    return null;
  }

  return obj as AutoDevStateV1;
}

/**
 * Persists an AutoDevStateV1 snapshot.
 * Supports 300ms trailing debounce for token streaming and immediate synchronous flush.
 */
export function savePersistedState(state: AutoDevStateV1, immediate: boolean = false): void {
  if (!state) return;
  _inMemoryCache = state;

  if (immediate) {
    flushPersistedState();
  } else {
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer);
    }
    _debounceTimer = setTimeout(() => {
      flushPersistedState();
    }, DEBOUNCE_MS);
  }
}

/**
 * Executes a synchronous flush to localStorage with fallback to sessionStorage and memory.
 */
export function flushPersistedState(): boolean {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }

  const state = _inMemoryCache;
  if (!state) return false;

  let jsonStr: string;
  try {
    jsonStr = JSON.stringify(state);
  } catch (err) {
    console.error('[StatePersistence] JSON serialization error:', err);
    return false;
  }

  let hasLocalStorage = false;
  let hasSessionStorage = false;
  try {
    hasLocalStorage = typeof localStorage !== 'undefined' && localStorage !== null;
  } catch (_) {}
  try {
    hasSessionStorage = typeof sessionStorage !== 'undefined' && sessionStorage !== null;
  } catch (_) {}

  if (!hasLocalStorage && !hasSessionStorage) {
    return false;
  }

  try {
    if (hasLocalStorage) {
      localStorage.setItem(STORAGE_KEY, jsonStr);
    }
    if (hasSessionStorage) {
      try {
        sessionStorage.setItem(STORAGE_KEY, jsonStr);
      } catch (_) {}
    }
    return true;
  } catch (err) {
    if (isQuotaExceeded(err)) {
      console.warn('[StatePersistence] QuotaExceededError trapped. Applying 3-tier prune defense.');
      const pruned = pruneState(state);
      _inMemoryCache = pruned;
      try {
        const prunedStr = JSON.stringify(pruned);
        if (hasLocalStorage) {
          localStorage.setItem(STORAGE_KEY, prunedStr);
        }
        if (hasSessionStorage) {
          try {
            sessionStorage.setItem(STORAGE_KEY, prunedStr);
          } catch (_) {}
        }
        return true;
      } catch (retryErr) {
        console.warn(
          '[StatePersistence] LocalStorage write failed after prune; falling back to sessionStorage:',
          retryErr
        );
        if (hasSessionStorage) {
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
            return true;
          } catch (sessErr) {
            console.error(
              '[StatePersistence] Both localStorage and sessionStorage failed quota limits:',
              sessErr
            );
            return false;
          }
        }
        return false;
      }
    } else {
      console.warn(
        '[StatePersistence] LocalStorage write failed; attempting sessionStorage fallback:',
        err
      );
      if (hasSessionStorage) {
        try {
          sessionStorage.setItem(STORAGE_KEY, jsonStr);
          return true;
        } catch (_) {
          return false;
        }
      }
      return false;
    }
  }
}

/**
 * Loads and validates state from the storage hierarchy:
 * 1. localStorage
 * 2. sessionStorage
 * 3. _inMemoryCache
 */
export function loadPersistedState(): AutoDevStateV1 | null {
  let raw: string | null = null;

  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      raw = localStorage.getItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[StatePersistence] LocalStorage read failed:', e);
  }

  if (!raw) {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage !== null) {
        raw = sessionStorage.getItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[StatePersistence] SessionStorage read failed:', e);
    }
  }

  if (!raw && _inMemoryCache) {
    return _inMemoryCache;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const validated = validatePersistedState(parsed);
    if (validated) {
      _inMemoryCache = validated;
      return validated;
    }
    return null;
  } catch (err) {
    console.error('[StatePersistence] Corrupted JSON in storage:', err);
    return null;
  }
}

/**
 * Purges persisted state across all storage tiers and cancels active debounce timers.
 */
export function clearPersistedState(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  _inMemoryCache = null;

  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (_) {}

  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage !== null) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (_) {}
}

/**
 * Registers window lifecycle event listeners for unloads and network reconnection.
 */
export function registerPersistenceLifecycle(getCurrentState?: () => AutoDevStateV1): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleBeforeUnload = () => {
    if (getCurrentState) {
      savePersistedState(getCurrentState(), true);
    } else {
      flushPersistedState();
    }
  };

  const handleOnline = () => {
    if (getCurrentState) {
      savePersistedState(getCurrentState(), true);
    } else {
      flushPersistedState();
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('online', handleOnline);
  };
}

// Window lifecycle binding for immediate flushes
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushPersistedState();
  });
  window.addEventListener('online', () => {
    flushPersistedState();
  });
}

// ── Internal Getters/Setters for Unit Testing ────────────────────────────────

export function _getInMemoryCache(): AutoDevStateV1 | null {
  return _inMemoryCache;
}

export function _setInMemoryCache(cache: AutoDevStateV1 | null): void {
  _inMemoryCache = cache;
}

export function _getDebounceTimer(): ReturnType<typeof setTimeout> | null {
  return _debounceTimer;
}
