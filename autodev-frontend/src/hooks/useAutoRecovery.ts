/**
 * AutoDev In-Flight Auto-Recovery & State Persistence Hook
 *
 * Implements:
 * 1. Bootloader attached on application startup (replicates legacy backend/index.html:initAutoRecovery, lines 2138-2323)
 * 2. 9-Phase In-Flight Auto-Recovery Matrix (replicates legacy backend/index.html:executePhaseRecovery, lines 2087-2134)
 * 3. Status branching:
 *    - 'aborted': Restores UI, preserves generated artifacts, renders control group with "Restart Development" ready
 *    - 'completed': Restores UI, latches post-completion panel and final download button
 *    - 'running' + inFlightPhase: Restores UI, renders #restorationBanner, automatically resumes interrupted phase
 * 4. Dual-storage lifecycle listeners: synchronous save on `beforeunload` and reconnection auto-recovery on `online`
 * 5. Strictly emoji-free professional console logs and UI banners
 */

import { useEffect, useRef } from 'react';
import { useAppStore, formatPhaseLabel } from '../stores/appStore';
import {
  loadPersistedState,
  registerPersistenceLifecycle,
} from '../stores/persistence';
import { hydrateStores, captureCurrentState } from '../stores';
import {
  executeSandboxCode,
  runCriticsEvaluation,
  generateDocumentationPhase,
} from '../features/pipeline/revisionLoop';
import type { AutoDevStateV1 } from '../types';

/**
 * 9-Phase In-Flight Auto-Recovery Matrix
 * Strictly replicates legacy executePhaseRecovery (lines 2087-2134) & document.md §6.9.
 */
export async function executePhaseRecovery(
  phase: string,
  _persistedState?: AutoDevStateV1 | null
): Promise<void> {
  const normalized = (phase || '').toLowerCase().trim();
  console.log(
    `[AutoDev Recovery Matrix] Resuming phase: '${phase}' (normalized: '${normalized}')`
  );

  const store = useAppStore.getState();
  store.setPipelineActive(true);
  store.setPipelineStatus('running');

  // Brief microtask tick to let child React components register window bridges
  await new Promise((resolve) => setTimeout(resolve, 50));

  switch (normalized) {
    case 'requirements':
      if (typeof (window as any).generateRequirements === 'function') {
        await (window as any).generateRequirements();
      } else {
        console.warn(
          '[AutoDev Recovery Matrix] window.generateRequirements not available; waiting for prompt input mount.'
        );
      }
      break;

    case 'decomposition':
      if (typeof (window as any).runDecomposition === 'function') {
        await (window as any).runDecomposition();
      } else if (store.decomposition) {
        if (store.decomposition.is_complex) {
          if (typeof (window as any).startComponentPipeline === 'function') {
            await (window as any).startComponentPipeline();
          }
        } else {
          if (typeof (window as any).generateDesign === 'function') {
            await (window as any).generateDesign();
          }
        }
      }
      break;

    case 'single_design':
    case 'single-pass design':
    case 'design':
      if (typeof (window as any).generateDesign === 'function') {
        await (window as any).generateDesign();
      }
      break;

    case 'single_codegen':
    case 'single-pass codegen':
    case 'codegen':
      if (typeof (window as any).generateSinglePassCode === 'function') {
        await (window as any).generateSinglePassCode();
      } else if (typeof (window as any).generateCode === 'function') {
        await (window as any).generateCode();
      }
      break;

    case 'single_execution':
    case 'sandbox execution':
    case 'execution':
      if (typeof (window as any).runSinglePassExecution === 'function') {
        await (window as any).runSinglePassExecution();
      } else {
        try {
          await executeSandboxCode({ autoAdvance: true });
        } catch (err) {
          console.error('[AutoDev Recovery Matrix] Sandbox execution recovery failed:', err);
        }
      }
      break;

    case 'single_critics':
    case 'critics':
      if (typeof (window as any).runSinglePassCritics === 'function') {
        await (window as any).runSinglePassCritics();
      } else {
        try {
          await runCriticsEvaluation();
        } catch (err) {
          console.error('[AutoDev Recovery Matrix] Critics evaluation recovery failed:', err);
        }
      }
      break;

    case 'component_dag':
    case 'component dag':
    case 'pipeline':
      if (typeof (window as any).resumeComponentPipeline === 'function') {
        (window as any).resumeComponentPipeline();
      } else {
        store.setPipelineActive(true);
        store.setPipelineStatus('running');
      }
      break;

    case 'integration':
      if (typeof (window as any).generateIntegration === 'function') {
        await (window as any).generateIntegration();
      }
      break;

    case 'documentation':
      if (typeof (window as any).generateDocumentation === 'function') {
        await (window as any).generateDocumentation();
      } else {
        try {
          await generateDocumentationPhase();
        } catch (err) {
          console.error('[AutoDev Recovery Matrix] Documentation generation recovery failed:', err);
        }
      }
      break;

    default:
      console.warn(
        `[AutoDev Recovery Matrix] Unrecognized phase '${phase}', falling back to requirements.`
      );
      if (typeof (window as any).generateRequirements === 'function') {
        await (window as any).generateRequirements();
      }
      break;
  }
}

/**
 * Initializes auto-recovery from persistent storage.
 * Directly corresponds to legacy initAutoRecovery (lines 2138-2323).
 */
export function initAutoRecovery(): AutoDevStateV1 | null {
  const saved = loadPersistedState();
  if (!saved) {
    return null;
  }

  console.log('[AutoDev] Persisted session detected in StateStore:', saved);

  // 1. Hydrate internal state models and UI into Zustand stores
  hydrateStores(saved);

  // 2. Branch on pipelineStatus
  if (saved.pipelineStatus === 'aborted') {
    console.log('[AutoDev] Session restored in ABORTED status. Ready for retry.');
    return saved;
  }

  if (saved.pipelineStatus === 'completed') {
    console.log('[AutoDev] Session restored in COMPLETED status.');
    return saved;
  }

  if (saved.pipelineStatus === 'running' && saved.inFlightPhase) {
    console.log(`[AutoDev] Resuming active in-flight phase: ${saved.inFlightPhase}`);
    const store = useAppStore.getState();
    store.setPipelineActive(true);
    store.setPipelineStatus('running');

    const label = formatPhaseLabel(saved.inFlightPhase);
    store.showRestorationBanner(
      saved.inFlightPhase,
      `Restored previous development session. Resuming ${label}...`
    );

    // Schedule in-flight phase recovery
    setTimeout(() => {
      executePhaseRecovery(saved.inFlightPhase!, saved).catch((err) => {
        console.error('[AutoDev Recovery Matrix] In-flight phase recovery error:', err);
      });
    }, 100);
  }

  return saved;
}

// Window bridges for legacy parity and integration test harnesses
if (typeof window !== 'undefined') {
  (window as any).initAutoRecovery = initAutoRecovery;
  (window as any).executePhaseRecovery = executePhaseRecovery;
}

/**
 * React hook mounted at application root to enforce persistence lifecycle
 * and in-flight auto-recovery across reloads and reconnects.
 */
/**
 * Registers lifecycle listeners for state persistence and online auto-recovery.
 */
export function registerAutoRecoveryListeners(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Register beforeunload milestone sync flush
  const unregisterLifecycle = registerPersistenceLifecycle(() => captureCurrentState());

  // Register online reconnect listener for network failure immunity
  const handleOnline = () => {
    const current = useAppStore.getState();
    if (current.pipelineStatus === 'running' && current.inFlightPhase) {
      console.log(
        '[AutoDev] Network connection restored. Resuming in-flight phase:',
        current.inFlightPhase
      );
      executePhaseRecovery(current.inFlightPhase).catch((err) => {
        console.error('[AutoDev] Reconnection auto-recovery error:', err);
      });
    }
  };

  window.addEventListener('online', handleOnline);

  return () => {
    unregisterLifecycle();
    window.removeEventListener('online', handleOnline);
  };
}

/**
 * React hook mounted at application root to enforce persistence lifecycle
 * and in-flight auto-recovery across reloads and reconnects.
 */
export function useAutoRecovery(): void {
  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Bootloader: check for saved state and auto-recover
    initAutoRecovery();

    return registerAutoRecoveryListeners();
  }, []);
}

export default useAutoRecovery;
