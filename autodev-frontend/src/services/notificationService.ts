/**
 * AutoDev System Notification Service
 *
 * Centralized notification dispatcher coordinating essential user-facing notifications:
 * user action confirmations, export results, network changes, and graceful system errors.
 *
 * Design Principles:
 * - Simple & specific notification titles only (no verbose message previews).
 * - Automatic 5-second auto-dismissal indicated by decreasing progress bar.
 * - Zero lifecycle or agent milestone clutter (progress is tracked via Stepper & Terminal).
 * - Strict zero-emoji compliance across all titles and logs.
 */

import { useSessionStore } from '../stores/sessionStore';

// ============================================================================
// Core Notification Primitives
// ============================================================================

export function notifySuccess(message: string, title?: string, durationMs: number = 5000): string {
  return useSessionStore.getState().showSuccessToast(message, title || message, durationMs);
}

export function notifyError(message: string, title?: string, durationMs: number = 5000): string {
  return useSessionStore.getState().showErrorToast(message, title || message, durationMs);
}

export function notifyWarning(message: string, title?: string, durationMs: number = 5000): string {
  return useSessionStore.getState().showWarningToast(message, title || message, durationMs);
}

export function notifyInfo(message: string, title?: string, durationMs: number = 5000): string {
  return useSessionStore.getState().showInfoToast(message, title || message, durationMs);
}

// ============================================================================
// User Action Confirmations & Exports
// ============================================================================

export function notifyGitHubExportSuccess(repoUrl?: string): string {
  const msg = repoUrl
    ? `Codebase committed to GitHub repository successfully: ${repoUrl}`
    : 'Codebase committed to GitHub repository successfully.';
  return notifySuccess(msg, 'GitHub Export Succeeded');
}

export function notifyGitHubExportFailed(errorMsg: string): string {
  return notifyError(
    `Failed to export codebase to GitHub: ${errorMsg}`,
    'GitHub Export Failed'
  );
}

export function notifyZipDownloadStarted(): string {
  return notifySuccess(
    'Finalized project ZIP archive generated and downloaded.',
    'Zip Archive Downloaded'
  );
}

export function notifyClipboardCopied(itemLabel: string = 'Content'): string {
  return notifyInfo(`${itemLabel} copied to clipboard.`, 'Copied to Clipboard');
}

export function notifyPreviewReloaded(): string {
  return notifyInfo('Live preview container refreshed with active codebase.', 'Preview Reloaded');
}

export function notifyDevelopmentRestored(phaseLabel?: string): string {
  const title = phaseLabel ? `Development Restored: ${phaseLabel}` : 'Development Restored';
  const message = phaseLabel ? `Resuming ${phaseLabel}.` : 'Development restored.';
  return notifyInfo(message, title);
}

// ============================================================================
// System, Network & Graceful Error Notifications
// ============================================================================

export function notifyNetworkOffline(): string {
  return notifyWarning(
    'Network connection lost. Waiting to reconnect...',
    'Network Offline'
  );
}

export function notifyNetworkOnline(): string {
  return notifySuccess(
    'Network connection re-established.',
    'Network Restored'
  );
}

export function notifyStreamDisconnected(): string {
  return notifyWarning(
    'Connection to backend telemetry stream lost. Retrying...',
    'Stream Disconnected'
  );
}

export function notifyStorageQuotaWarning(): string {
  return notifyWarning(
    'Local storage quota reached. Older terminal logs pruned to preserve session.',
    'Storage Quota Exceeded'
  );
}

export function notifyValidationError(message: string): string {
  return notifyWarning(message, 'Input Required');
}

export function notifyApiError(err: unknown, customTitle: string = 'Backend Error'): string {
  let message = 'An unexpected server error occurred.';
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object') {
    const maybeDetail = (err as any).detail || (err as any).message;
    if (maybeDetail) message = String(maybeDetail);
  }
  return notifyError(message, customTitle);
}

// ============================================================================
// Global Error & Promise Rejection Handlers
// ============================================================================

export function initializeGlobalErrorNotifications(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    // Benign abort errors and cancellations should be ignored
    if (
      reason?.name === 'AbortError' ||
      reason?.name === 'ApiAbortError' ||
      (typeof reason?.message === 'string' &&
        (reason.message.includes('aborted') ||
          reason.message.includes('canceled') ||
          reason.message.includes('ResizeObserver')))
    ) {
      return;
    }

    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : 'An unexpected async operation error occurred.';

    console.error('[AutoDev Global Error Handler] Unhandled promise rejection:', reason);
    notifyError(message, 'System Error');
  };

  const handleGlobalError = (event: ErrorEvent) => {
    // Ignore harmless browser noise
    if (
      event.message?.includes('ResizeObserver') ||
      event.message?.includes('Script error.')
    ) {
      return;
    }

    console.error('[AutoDev Global Error Handler] Unhandled script error:', event.error || event.message);
    notifyError(event.message || 'An unexpected client error occurred.', 'Application Error');
  };

  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('error', handleGlobalError);

  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('error', handleGlobalError);
  };
}
