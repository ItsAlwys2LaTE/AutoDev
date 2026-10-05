/**
 * AutoDev GitHub Export Modal Component
 * 
 * Provides a clean modal dialogue for exporting and committing finalized codebase
 * files to GitHub using the Git Data Trees REST API.
 * 
 * Complies with strict zero-emoji policy and professional developer UX standards.
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowUpTrayIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../stores/appStore';
import {
  exportToGitHub,
  prepareExportFiles,
  getStoredGitHubCredentials,
} from '../services/githubExportService';
import type { GitHubExportResult, GitHubExportStatus } from '../types/github';

export interface GitHubExportModalProps {
  isOpen?: boolean;
  initialStatus?: GitHubExportStatus;
  initialError?: string | null;
  initialResult?: GitHubExportResult | null;
}

export function GitHubExportModal({
  isOpen: propIsOpen,
  initialStatus = 'idle',
  initialError = null,
  initialResult = null,
}: GitHubExportModalProps = {}): React.JSX.Element | null {
  const isSSR = typeof window === 'undefined';
  const liveStore = isSSR ? useAppStore.getState() : null;

  const storeIsOpen = useAppStore((s) => s.isGitHubModalOpen);
  const isOpen = propIsOpen !== undefined ? propIsOpen : (isSSR ? (liveStore?.isGitHubModalOpen ?? false) : storeIsOpen);
  const setOpen = useAppStore((s) => s.setGitHubModalOpen);
  const sCodebase = useAppStore((s) => s.currentCodebase);
  const sIntegratedCodebase = useAppStore((s) => s.integratedCodebase);
  const sRequirements = useAppStore((s) => s.requirements);

  const currentCodebase = isSSR ? (liveStore?.currentCodebase ?? null) : sCodebase;
  const integratedCodebase = isSSR ? (liveStore?.integratedCodebase ?? null) : sIntegratedCodebase;
  const requirements = isSSR ? (liveStore?.requirements ?? null) : sRequirements;

  const [username, setUsername] = useState<string>(() => {
    return getStoredGitHubCredentials().username || '';
  });
  const [repoName, setRepoName] = useState<string>(() => {
    if (requirements?.project_title) {
      return (
        requirements.project_title
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'autodev-project'
      );
    }
    return 'autodev-project';
  });
  const [token, setToken] = useState<string>(() => {
    return getStoredGitHubCredentials().token || '';
  });
  const [showToken, setShowToken] = useState<boolean>(false);
  const [rememberToken, setRememberToken] = useState<boolean>(() => {
    return Boolean(getStoredGitHubCredentials().token);
  });
  const [isPrivate, setIsPrivate] = useState<boolean>(false);

  const [status, setStatus] = useState<GitHubExportStatus>(initialStatus);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(initialError);
  const [result, setResult] = useState<GitHubExportResult | null>(initialResult);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredGitHubCredentials();
      if (stored.username) setUsername(stored.username);
      if (stored.token) {
        setToken(stored.token);
        setRememberToken(true);
      }

      // Generate suggested repo name from requirements project title if available
      if (requirements?.project_title) {
        const slug = requirements.project_title
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        setRepoName(slug || 'autodev-project');
      } else {
        setRepoName((prev) => prev || 'autodev-project');
      }

      setStatus('idle');
      setStatusMessage('');
      setError(null);
      setResult(null);
    }
  }, [isOpen, requirements]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (status !== 'idle' && status !== 'success' && status !== 'error') {
      // Prevent closing while active in-flight request
      return;
    }
    setOpen(false);
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const targetCodebase = integratedCodebase || currentCodebase;
    const preparedFiles = prepareExportFiles(targetCodebase, requirements);

    if (preparedFiles.length === 0) {
      setError('No codebase files found to export. Please ensure code generation has completed.');
      setStatus('error');
      return;
    }

    setStatus('validating_token');
    setStatusMessage('Validating GitHub credentials...');

    try {
      const exportResult = await exportToGitHub(
        {
          username: username.trim(),
          repoName: repoName.trim(),
          token: token.trim(),
          rememberToken,
          isPrivate,
          files: preparedFiles,
          description: requirements?.overview || 'Autonomously generated full-stack software application.',
          commitMessage: `feat: autonomous SDLC delivery by AutoDev (${preparedFiles.length} files)`,
        },
        (newStatus, stepMsg) => {
          setStatus(newStatus);
          if (stepMsg) setStatusMessage(stepMsg);
        }
      );

      if (exportResult.success) {
        setStatus('success');
        setStatusMessage('Codebase successfully exported and committed.');
        setResult(exportResult);
      } else {
        setStatus('error');
        setError(exportResult.error || 'Failed to export codebase to GitHub.');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'An unexpected error occurred during export.');
    }
  };

  const isSubmitting =
    status !== 'idle' && status !== 'success' && status !== 'error';

  return (
    <div
      id="githubExportModal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="githubModalTitle"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <ArrowUpTrayIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 id="githubModalTitle" className="text-base sm:text-lg font-bold text-slate-100">
                Upload to GitHub
              </h2>
              <p className="text-xs text-slate-400">
                Commit finalized codebase directly to a GitHub repository
              </p>
            </div>
          </div>
          <button
            type="button"
            id="githubExportCancelBtn"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Success Screen */}
        {status === 'success' && result ? (
          <div id="githubExportSuccessCard" className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircleIcon className="w-5 h-5 shrink-0" />
                <span>Repository Successfully Published</span>
              </div>
              <p className="text-xs text-emerald-300/90">
                All source files, README.md, and USER_GUIDE.md have been committed atomically to your repository.
              </p>
            </div>

            {result.repoUrl && (
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs space-y-1.5">
                <div className="text-slate-400 font-medium">Repository URL:</div>
                <a
                  id="githubRepoLink"
                  href={result.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1.5 break-all underline underline-offset-2"
                >
                  <span>{result.repoUrl}</span>
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 shrink-0" />
                </a>
                {result.commitSha && (
                  <div className="text-slate-400 font-mono text-[11px] pt-1">
                    Commit SHA: <span className="text-slate-300">{result.commitSha.slice(0, 7)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleExport} className="space-y-4">
            {/* Error Banner */}
            {error && (
              <div
                id="githubExportErrorBanner"
                className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5"
              >
                <ExclamationTriangleIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-rose-300">Export Failed</div>
                  <div className="text-rose-200/90 leading-relaxed">{error}</div>
                </div>
              </div>
            )}

            {/* In-Flight Status Indicator */}
            {isSubmitting && (
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2.5">
                <svg
                  className="animate-spin w-4 h-4 text-indigo-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="font-medium">{statusMessage || 'Processing GitHub export...'}</span>
              </div>
            )}

            {/* Username / Organization */}
            <div className="space-y-1.5">
              <label htmlFor="githubUsernameInput" className="block text-xs font-semibold text-slate-300">
                GitHub Username or Organization <span className="text-rose-400">*</span>
              </label>
              <input
                id="githubUsernameInput"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. octocat or my-organization"
                disabled={isSubmitting}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* Repository Name */}
            <div className="space-y-1.5">
              <label htmlFor="githubRepoInput" className="block text-xs font-semibold text-slate-300">
                Repository Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="githubRepoInput"
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="e.g. my-awesome-app"
                disabled={isSubmitting}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <p className="text-[11px] text-slate-400">
                If this repository does not exist, AutoDev will automatically create it for you.
              </p>
            </div>

            {/* Personal Access Token */}
            <div className="space-y-1.5">
              <label htmlFor="githubTokenInput" className="block text-xs font-semibold text-slate-300">
                Personal Access Token (PAT with repo scope) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="githubTokenInput"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_... or github_pat_..."
                  disabled={isSubmitting}
                  required
                  className="w-full px-3 py-2 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 font-mono"
                />
                <button
                  type="button"
                  id="githubToggleTokenVisibilityBtn"
                  onClick={() => setShowToken(!showToken)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Generate a token at GitHub Settings &gt; Developer settings &gt; Personal access tokens. Requires <span className="font-mono text-slate-300 font-semibold">repo</span> scope.
              </p>
            </div>

            {/* Checkbox Options */}
            <div className="pt-1 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="githubRememberTokenCheckbox"
                  type="checkbox"
                  checked={rememberToken}
                  onChange={(e) => setRememberToken(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-300">
                  Remember credentials in this browser session (sessionStorage)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="githubPrivateRepoCheckbox"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-300">
                  Create private repository (if repository is newly created)
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="githubExportSubmitBtn"
                disabled={isSubmitting || !username.trim() || !repoName.trim() || !token.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/40 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Exporting to GitHub...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                    <span>Commit to GitHub</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default GitHubExportModal;
