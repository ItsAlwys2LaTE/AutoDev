/**
 * AutoDev Session & Transient State Store (Zustand v5)
 * 
 * Manages non-persisted and session-scoped runtime telemetry:
 * 1. sessionUsage: prompt tokens, completion tokens, INR monetary cost calculated at Gemini 1.5 Flash rates
 * 2. activeAbortController: AbortController lifecycle and synchronization with API client
 * 3. countdown: 30s auto-proceed manager in COMPLEX mode with pause-on-user-edit detection
 * 4. networkStatus: online/offline event listener, auto-reconnect tracking, and reconnect count
 * 5. toast: transient feedback notification banners styled for Glassmorphism
 * 
 * Strictly emoji-free per R4.
 */

import { create } from 'zustand';
import type { SessionUsage } from '../types';
import {
  calculateTokenCost,
  calculateTokenCostINR,
  formatSessionCost,
} from '../utils/formatters';

export { calculateTokenCost, calculateTokenCostINR, formatSessionCost };
import {
  setActiveAbortController as syncGlobalAbortController,
  onNetworkOffline,
  onNetworkOnline,
} from '../api/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type CountdownTargetAction =
  | 'requirements'
  | 'decomposition'
  | 'design'
  | 'codegen'
  | 'execution'
  | 'critics'
  | 'integration'
  | 'documentation'
  | string;

export interface CountdownState {
  isRunning: boolean;
  isPaused: boolean;
  remainingSeconds: number;
  initialSeconds: number;
  targetAction: CountdownTargetAction | null;
  pauseReason: string | null;
}

export type NetworkStatus = 'online' | 'offline';

export interface NetworkState {
  status: NetworkStatus;
  isReconnecting: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
  reconnectCount: number;
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  durationMs?: number;
  createdAt: number;
}

export interface SessionStoreState {
  // ── State Slices ──────────────────────────────────────────────────────────
  sessionUsage: SessionUsage;
  activeAbortController: AbortController | null;
  isAborted: boolean;
  countdown: CountdownState;
  network: NetworkState;
  toasts: ToastItem[];

  // ── Session Usage Actions ────────────────────────────────────────────────
  recordTokenUsage: (promptTokens: number | string, completionTokens: number | string) => void;
  updateCost: (promptTokens: number | string, completionTokens: number | string) => void;
  setSessionUsage: (usage: SessionUsage) => void;
  resetSessionUsage: () => void;
  getFormattedCost: () => string;

  // ── AbortController Actions ──────────────────────────────────────────────
  createAbortController: () => AbortController;
  abortCurrentPipeline: (reason?: string) => void;
  abortForPause: (reason?: string) => void;
  abortInFlightForPause: (reason?: string) => void;
  resetAbortController: () => void;

  // ── Countdown Manager Actions ────────────────────────────────────────────
  startCountdown: (
    targetAction: CountdownTargetAction,
    onExpire: () => void,
    seconds?: number,
    mode?: string
  ) => void;
  pauseCountdown: (reason?: string) => void;
  resumeCountdown: () => void;
  cancelCountdown: () => void;

  // ── Network Status Actions ───────────────────────────────────────────────
  setNetworkStatus: (status: NetworkStatus) => void;
  setReconnecting: (isReconnecting: boolean) => void;
  initializeNetworkListeners: () => () => void;

  // ── Toast Notification Actions ───────────────────────────────────────────
  addToast: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  showSuccessToast: (message: string, title?: string, durationMs?: number) => string;
  showErrorToast: (message: string, title?: string, durationMs?: number) => string;
  showWarningToast: (message: string, title?: string, durationMs?: number) => string;
  showInfoToast: (message: string, title?: string, durationMs?: number) => string;

  // ── Store Reset ──────────────────────────────────────────────────────────
  resetSessionStore: () => void;
}

// ============================================================================
// Internal Timer State References
// ============================================================================

let internalCountdownInterval: ReturnType<typeof setInterval> | null = null;
let internalCountdownCallback: (() => void) | null = null;
const activeToastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// ============================================================================
// Initial State Defaults
// ============================================================================

export const initialSessionUsage: SessionUsage = {
  prompt: 0,
  completion: 0,
  cost: 0.0,
};

export const initialCountdown: CountdownState = {
  isRunning: false,
  isPaused: false,
  remainingSeconds: 0,
  initialSeconds: 30,
  targetAction: null,
  pauseReason: null,
};

export const initialNetwork: NetworkState = {
  status:
    typeof navigator !== 'undefined' && 'onLine' in navigator
      ? navigator.onLine
        ? 'online'
        : 'offline'
      : 'online',
  isReconnecting: false,
  lastOnlineAt: null,
  lastOfflineAt: null,
  reconnectCount: 0,
};

// ============================================================================
// Store Creation (Curried Zustand v5)
// ============================================================================

export const useSessionStore = create<SessionStoreState>()((set, get) => ({
  // Initial state slices
  sessionUsage: { ...initialSessionUsage },
  activeAbortController: null,
  isAborted: false,
  countdown: { ...initialCountdown },
  network: { ...initialNetwork },
  toasts: [],

  // ── Session Usage & Token Economics ───────────────────────────────────────

  recordTokenUsage: (promptTokens, completionTokens) => {
    const pDelta = Math.max(0, parseInt(String(promptTokens), 10) || 0);
    const cDelta = Math.max(0, parseInt(String(completionTokens), 10) || 0);

    if (pDelta === 0 && cDelta === 0) return;

    set((state) => {
      const nextPrompt = state.sessionUsage.prompt + pDelta;
      const nextCompletion = state.sessionUsage.completion + cDelta;
      const nextCost = calculateTokenCost(nextPrompt, nextCompletion).inrCost;

      return {
        sessionUsage: {
          prompt: nextPrompt,
          completion: nextCompletion,
          cost: nextCost,
        },
      };
    });
  },

  updateCost: (promptTokens, completionTokens) =>
    get().recordTokenUsage(promptTokens, completionTokens),

  setSessionUsage: (usage) => {
    const prompt = Math.max(0, parseInt(String(usage.prompt), 10) || 0);
    const completion = Math.max(0, parseInt(String(usage.completion), 10) || 0);
    const cost =
      typeof usage.cost === 'number' && !isNaN(usage.cost)
        ? usage.cost
        : calculateTokenCost(prompt, completion).inrCost;

    set({
      sessionUsage: {
        prompt,
        completion,
        cost,
      },
    });
  },

  resetSessionUsage: () => {
    set({ sessionUsage: { ...initialSessionUsage } });
  },

  getFormattedCost: () => {
    const { prompt, completion } = get().sessionUsage;
    return formatSessionCost(prompt, completion);
  },

  // ── AbortController Management ────────────────────────────────────────────

  createAbortController: () => {
    const current = get().activeAbortController;
    if (current && !current.signal.aborted) {
      current.abort('Superseded by new controller');
    }

    const controller = new AbortController();
    syncGlobalAbortController(controller);

    set({
      activeAbortController: controller,
      isAborted: false,
    });

    return controller;
  },

  abortCurrentPipeline: (reason = 'Development aborted by user') => {
    // 1. Cancel active countdown
    get().cancelCountdown();

    // 2. Signal abort on the active controller
    const controller = get().activeAbortController;
    if (controller && !controller.signal.aborted) {
      controller.abort(reason);
    }
    syncGlobalAbortController(null);

    // 3. Mark state as aborted
    set({
      activeAbortController: null,
      isAborted: true,
    });

    // 4. Emit informational toast
    get().showInfoToast('Development pipeline aborted.');
  },

  abortForPause: (reason = 'Development paused') => {
    // 1. Cancel active countdown
    get().cancelCountdown();

    // 2. Signal abort on the active controller
    const controller = get().activeAbortController;
    if (controller && !controller.signal.aborted) {
      try {
        controller.abort(reason);
      } catch {
        // ignore
      }
    }
    syncGlobalAbortController(null);

    // 3. Mark active controller as null but DO NOT flag isAborted as true
    set({
      activeAbortController: null,
      isAborted: false,
    });
  },

  abortInFlightForPause: (reason = 'Development paused') => {
    get().abortForPause(reason);
  },

  resetAbortController: () => {
    const controller = get().activeAbortController;
    if (controller && !controller.signal.aborted) {
      controller.abort('Reset');
    }
    syncGlobalAbortController(null);

    set({
      activeAbortController: null,
      isAborted: false,
    });
  },

  // ── Countdown Manager (COMPLEX Mode) ──────────────────────────────────────

  startCountdown: (targetAction, onExpire, seconds = 30, mode = 'COMPLEX') => {
    // Disabled strictly in QUICK mode
    if (mode === 'QUICK') {
      get().cancelCountdown();
      return;
    }

    // Clean up any running countdown timer
    get().cancelCountdown();

    const duration = Math.max(1, seconds);
    internalCountdownCallback = onExpire;

    set({
      countdown: {
        isRunning: true,
        isPaused: false,
        remainingSeconds: duration,
        initialSeconds: duration,
        targetAction,
        pauseReason: null,
      },
    });

    internalCountdownInterval = setInterval(() => {
      const currentRemaining = get().countdown.remainingSeconds;

      if (currentRemaining <= 1) {
        // Expiration reached
        if (internalCountdownInterval) {
          clearInterval(internalCountdownInterval);
          internalCountdownInterval = null;
        }

        const callback = internalCountdownCallback;
        internalCountdownCallback = null;

        set((state) => ({
          countdown: {
            ...state.countdown,
            isRunning: false,
            remainingSeconds: 0,
          },
        }));

        if (typeof callback === 'function') {
          callback();
        }
      } else {
        // Tick decrement
        set((state) => ({
          countdown: {
            ...state.countdown,
            remainingSeconds: state.countdown.remainingSeconds - 1,
          },
        }));
      }
    }, 1000);
  },

  pauseCountdown: (reason = 'User edit detected') => {
    const { countdown } = get();
    if (!countdown.isRunning && !countdown.isPaused) return;

    if (internalCountdownInterval) {
      clearInterval(internalCountdownInterval);
      internalCountdownInterval = null;
    }

    set((state) => ({
      countdown: {
        ...state.countdown,
        isRunning: false,
        isPaused: true,
        pauseReason: reason,
      },
    }));
  },

  resumeCountdown: () => {
    const { countdown } = get();
    if (!countdown.isPaused || countdown.remainingSeconds <= 0) return;

    if (internalCountdownInterval) {
      clearInterval(internalCountdownInterval);
    }

    set((state) => ({
      countdown: {
        ...state.countdown,
        isRunning: true,
        isPaused: false,
        pauseReason: null,
      },
    }));

    internalCountdownInterval = setInterval(() => {
      const currentRemaining = get().countdown.remainingSeconds;

      if (currentRemaining <= 1) {
        if (internalCountdownInterval) {
          clearInterval(internalCountdownInterval);
          internalCountdownInterval = null;
        }

        const callback = internalCountdownCallback;
        internalCountdownCallback = null;

        set((state) => ({
          countdown: {
            ...state.countdown,
            isRunning: false,
            remainingSeconds: 0,
          },
        }));

        if (typeof callback === 'function') {
          callback();
        }
      } else {
        set((state) => ({
          countdown: {
            ...state.countdown,
            remainingSeconds: state.countdown.remainingSeconds - 1,
          },
        }));
      }
    }, 1000);
  },

  cancelCountdown: () => {
    if (internalCountdownInterval) {
      clearInterval(internalCountdownInterval);
      internalCountdownInterval = null;
    }
    internalCountdownCallback = null;

    set({ countdown: { ...initialCountdown } });
  },

  // ── Network Status & Reconnection ─────────────────────────────────────────

  setNetworkStatus: (status) => {
    const prevStatus = get().network.status;
    if (prevStatus === status) return;

    const now = Date.now();

    if (status === 'offline') {
      set((state) => ({
        network: {
          ...state.network,
          status: 'offline',
          isReconnecting: true,
          lastOfflineAt: now,
        },
      }));
      get().showWarningToast(
        'Network connection lost. Waiting to reconnect...',
        'Offline',
        0 // Sticky until reconnected
      );
    } else {
      set((state) => ({
        network: {
          ...state.network,
          status: 'online',
          isReconnecting: false,
          lastOnlineAt: now,
          reconnectCount: state.network.reconnectCount + 1,
        },
      }));
      get().showSuccessToast(
        'Network connection re-established. Resuming operations...',
        'Online',
        3000
      );
    }
  },

  setReconnecting: (isReconnecting) => {
    set((state) => ({
      network: {
        ...state.network,
        isReconnecting,
      },
    }));
  },

  initializeNetworkListeners: () => {
    const handleOffline = () => get().setNetworkStatus('offline');
    const handleOnline = () => get().setNetworkStatus('online');

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
    }

    const unsubOffline = onNetworkOffline(handleOffline);
    const unsubOnline = onNetworkOnline(handleOnline);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      }
      unsubOffline();
      unsubOnline();
    };
  },

  // ── Toast Notifications ───────────────────────────────────────────────────

  addToast: ({ type, message, title, durationMs = 4000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newToast: ToastItem = {
      id,
      type,
      message,
      title,
      durationMs,
      createdAt: Date.now(),
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (durationMs > 0) {
      const timeout = setTimeout(() => {
        get().removeToast(id);
      }, durationMs);
      activeToastTimeouts.set(id, timeout);
    }

    return id;
  },

  removeToast: (id) => {
    const timeout = activeToastTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      activeToastTimeouts.delete(id);
    }

    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    activeToastTimeouts.forEach((timeout) => clearTimeout(timeout));
    activeToastTimeouts.clear();
    set({ toasts: [] });
  },

  showSuccessToast: (message, title, durationMs = 4000) =>
    get().addToast({ type: 'success', message, title, durationMs }),

  showErrorToast: (message, title, durationMs = 6000) =>
    get().addToast({ type: 'error', message, title, durationMs }),

  showWarningToast: (message, title, durationMs = 5000) =>
    get().addToast({ type: 'warning', message, title, durationMs }),

  showInfoToast: (message, title, durationMs = 3500) =>
    get().addToast({ type: 'info', message, title, durationMs }),

  // ── Store Reset ──────────────────────────────────────────────────────────

  resetSessionStore: () => {
    // 1. Cancel countdown timer
    get().cancelCountdown();

    // 2. Abort active request and reset controller
    const controller = get().activeAbortController;
    if (controller && !controller.signal.aborted) {
      controller.abort('Session Reset');
    }
    syncGlobalAbortController(null);

    // 3. Clear toasts and timers
    get().clearToasts();

    // 4. Reset store to defaults, keeping real-time network status intact
    set({
      sessionUsage: { ...initialSessionUsage },
      activeAbortController: null,
      isAborted: false,
      countdown: { ...initialCountdown },
      toasts: [],
      network: {
        ...initialNetwork,
        status:
          typeof navigator !== 'undefined' && 'onLine' in navigator
            ? navigator.onLine
              ? 'online'
              : 'offline'
            : 'online',
      },
    });
  },
}));
