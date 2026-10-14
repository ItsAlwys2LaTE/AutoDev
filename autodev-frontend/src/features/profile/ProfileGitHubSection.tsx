import React, { useState, useEffect } from 'react';
import {
  CommandLineIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  FolderPlusIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';

export interface ProfileGitHubSectionProps {
  className?: string;
}

export const ProfileGitHubSection: React.FC<ProfileGitHubSectionProps> = ({
  className = '',
}) => {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [username, setUsername] = useState<string>(
    user?.github_config?.username || ''
  );
  const [defaultRepo, setDefaultRepo] = useState<string>(
    user?.github_config?.default_repo || ''
  );
  const [defaultCommitMessage, setDefaultCommitMessage] = useState<string>(
    user?.github_config?.default_commit_message ||
      'Initial commit from AutoDev autonomous software engineering platform'
  );
  const [autoCreateRepo, setAutoCreateRepo] = useState<boolean>(
    user?.github_config?.auto_create_repo ?? true
  );
  const [rememberToken, setRememberToken] = useState<boolean>(
    user?.github_config?.remember_token ?? true
  );

  const [token, setToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem('autodev_github_token') ||
        localStorage.getItem('autodev_github_token') ||
        ''
      );
    }
    return '';
  });

  const [showToken, setShowToken] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    login?: string;
    scopes?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when store user updates
  useEffect(() => {
    if (user?.github_config) {
      if (!username) setUsername(user.github_config.username || '');
      if (!defaultRepo) setDefaultRepo(user.github_config.default_repo || '');
      if (!defaultCommitMessage) {
        setDefaultCommitMessage(
          user.github_config.default_commit_message ||
            'Initial commit from AutoDev autonomous software engineering platform'
        );
      }
      setAutoCreateRepo(user.github_config.auto_create_repo ?? true);
      setRememberToken(user.github_config.remember_token ?? true);
    }
  }, [user]);

  const showToast = (message: string, title?: string) => {
    try {
      useSessionStore.getState().showSuccessToast(message, title || 'GitHub Settings');
    } catch {
      // ignore
    }
  };

  const showWarningToast = (message: string, title?: string) => {
    try {
      useSessionStore.getState().showWarningToast(message, title || 'GitHub Error');
    } catch {
      // ignore
    }
  };

  // Test Personal Access Token with GitHub REST API
  const handleTestToken = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setTestResult({
        success: false,
        message: 'Please enter a GitHub Personal Access Token (PAT) to test.',
      });
      return;
    }

    setIsTestingToken(true);
    setTestResult(null);

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${trimmed}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const scopes = res.headers.get('x-oauth-scopes') || 'default';
        const hasRepoScope = scopes.includes('repo') || scopes.includes('public_repo');

        if (!hasRepoScope) {
          setTestResult({
            success: false,
            message: `Authenticated as ${data.login}, but token lacks 'repo' scope required to push code.`,
            login: data.login,
            scopes,
          });
          showWarningToast("Token lacks 'repo' scope permissions.", 'Scope Warning');
        } else {
          setTestResult({
            success: true,
            message: `Verified successfully. Authenticated as @${data.login} with repo permissions.`,
            login: data.login,
            scopes,
          });
          if (!username) setUsername(data.login);
          showToast(`Verified access for @${data.login}`, 'Token Valid');
        }
      } else {
        const errData = await res.json().catch(() => null);
        const msg = errData?.message || 'Invalid GitHub token or expired credentials.';
        setTestResult({
          success: false,
          message: `Verification failed: ${msg}`,
        });
        showWarningToast(msg, 'Authentication Failed');
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Could not connect to GitHub API. Check your network.',
      });
      showWarningToast('Network connection to GitHub failed.', 'Network Error');
    } finally {
      setIsTestingToken(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Manage browser token storage according to rememberToken toggle
      if (typeof window !== 'undefined') {
        const trimmed = token.trim();
        if (trimmed) {
          if (rememberToken) {
            localStorage.setItem('autodev_github_token', trimmed);
            sessionStorage.setItem('autodev_github_token', trimmed);
          } else {
            sessionStorage.setItem('autodev_github_token', trimmed);
            localStorage.removeItem('autodev_github_token');
          }
        } else {
          localStorage.removeItem('autodev_github_token');
          sessionStorage.removeItem('autodev_github_token');
        }
      }

      await updateProfile({
        github_config: {
          username: username.trim(),
          default_repo: defaultRepo.trim(),
          default_commit_message: defaultCommitMessage.trim(),
          auto_create_repo: autoCreateRepo,
          remember_token: rememberToken,
        },
      });

      showToast('GitHub configuration saved. Modal will pre-fill credentials.');
    } catch (err: any) {
      showWarningToast(err?.message || 'Failed to save GitHub settings.', 'Save Error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* ── 1. Username & Default Repository ── */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
          <CommandLineIcon className="w-3.5 h-3.5" />
          <span>Repository & Identity</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">GitHub Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. octocat"
              className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Default Repository Name</label>
            <input
              type="text"
              value={defaultRepo}
              onChange={(e) => setDefaultRepo(e.target.value)}
              placeholder="e.g. autodev-projects"
              className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── 2. Personal Access Token (PAT) ── */}
      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
            <KeyIcon className="w-3.5 h-3.5" />
            <span>GitHub Personal Access Token (PAT)</span>
          </h3>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=AutoDev+Autonomous+Platform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-indigo-400 hover:underline"
          >
            Generate PAT on GitHub
          </a>
        </div>

        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setTestResult(null);
            }}
            placeholder="ghp_... or github_pat_..."
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 pr-10 text-xs sm:text-sm text-slate-100 placeholder-slate-500 font-mono focus:border-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white"
            title={showToken ? 'Hide token' : 'Show token'}
          >
            {showToken ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>

        {/* Test Token Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={isTestingToken || !token.trim()}
            onClick={handleTestToken}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
          >
            {isTestingToken ? (
              <>
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying Token...</span>
              </>
            ) : (
              <>
                <ShieldCheckIcon className="w-3.5 h-3.5" />
                <span>Test Token &amp; Scopes</span>
              </>
            )}
          </button>

          {testResult && (
            <div
              className={`text-xs flex items-center gap-1.5 font-medium ${
                testResult.success ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircleIcon className="w-4 h-4 shrink-0" />
              ) : (
                <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Remember Token Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer pt-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={rememberToken}
            onChange={(e) => setRememberToken(e.target.checked)}
            className="rounded border-white/20 bg-black/40 accent-white focus:ring-0 cursor-pointer"
          />
          <span>Remember token across browser sessions (stored in local storage)</span>
        </label>
      </div>

      {/* ── 3. Commit Message & Automation Preferences ── */}
      <div className="space-y-4 pt-4 border-t border-white/[0.08]">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
          <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
          <span>Commit &amp; Push Configuration</span>
        </h3>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Default Commit Message</label>
          <input
            type="text"
            value={defaultCommitMessage}
            onChange={(e) => setDefaultCommitMessage(e.target.value)}
            placeholder="Commit message"
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none"
          />
        </div>

        <label className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <FolderPlusIcon className="w-4 h-4 text-emerald-400" />
              <span>Auto-create Remote Repository</span>
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If the destination repository does not exist on your GitHub account, AutoDev will automatically initialize it.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoCreateRepo}
            onChange={(e) => setAutoCreateRepo(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-black/40 accent-white focus:ring-0 cursor-pointer shrink-0"
          />
        </label>
      </div>

      {/* ── 4. Save Controls ── */}
      <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveSettings}
          className="px-6 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Saving Settings...' : 'Save GitHub Settings'}
        </button>
      </div>
    </div>
  );
};

export default ProfileGitHubSection;
