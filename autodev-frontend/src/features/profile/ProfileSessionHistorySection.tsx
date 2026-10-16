import React, { useState, useEffect, useCallback } from 'react';
import {
  ClockIcon,
  CircleStackIcon,
  CurrencyRupeeIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  FolderArrowDownIcon,
} from '@heroicons/react/24/outline';
import { sessionApi, SessionRecord, SessionStats } from '../../api/authEndpoints';
import { useSessionStore } from '../../stores/sessionStore';

export interface ProfileSessionHistorySectionProps {
  className?: string;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export const ProfileSessionHistorySection: React.FC<ProfileSessionHistorySectionProps> = ({
  className = '',
}) => {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionData = useCallback(async (pageNum: number = 1, showRefresh: boolean = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [statsRes, listRes] = await Promise.all([
        sessionApi.getSessionStats().catch(() => ({
          total_sessions: 0,
          total_tokens_used: 0,
          total_cost_inr: 0,
        })),
        sessionApi.listSessions(pageNum, 10).catch(() => ({
          sessions: [],
          total: 0,
          page: 1,
          limit: 10,
        })),
      ]);

      setStats(statsRes);
      setSessions(listRes.sessions || []);
      setPage(listRes.page || 1);
      const limit = listRes.limit || 10;
      setTotalPages(Math.max(1, Math.ceil((listRes.total || 0) / limit)));
    } catch (err: any) {
      setError(err?.message || 'Could not load sessions.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionData(1);
  }, [fetchSessionData]);

  const handleDownloadZip = async (session: SessionRecord) => {
    if (session.status === 'aborted') return;

    setDownloadingId(session.id);
    try {
      const blob = await sessionApi.downloadProjectZip(session.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (session.project_name || 'autodev-project')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
      a.download = `${safeName}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      try {
        useSessionStore.getState().showSuccessToast(
          `Downloaded archive for ${session.project_name}`,
          'ZIP Export Complete'
        );
      } catch {
        // ignore
      }
    } catch (err: any) {
      try {
        useSessionStore.getState().showWarningToast(
          err?.message || 'Failed to download project files from database.',
          'Download Failed'
        );
      } catch {
        // ignore
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* ── 1. Top Three Development Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Sessions */}
        <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.12)] space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs uppercase font-mono tracking-wider">Total Sessions</span>
            <ClockIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {stats?.total_sessions ?? 0}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active engineering sessions</span>
          </div>
        </div>

        {/* Card 2: Total Tokens */}
        <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.12)] space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs uppercase font-mono tracking-wider">Tokens Consumed</span>
            <CircleStackIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {(stats?.total_tokens_used ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Prompt &amp; synthesis tokens across all stages
          </p>
        </div>

        {/* Card 3: Total Cost (INR) */}
        <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.12)] space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs uppercase font-mono tracking-wider">Total Cost (INR)</span>
            <CurrencyRupeeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            ₹{(stats?.total_cost_inr ?? 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Calculated at standard Gemini conversion rates
          </p>
        </div>
      </div>

      {/* ── 2. Session List Header ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Development Session History</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Chronological log of past autonomous development runs with metrics and ZIP archives.
          </p>
        </div>

        <button
          type="button"
          disabled={isRefreshing || isLoading}
          onClick={() => fetchSessionData(page, true)}
          className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-xs"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <InformationCircleIcon className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-2">
          <ArrowPathIcon className="w-6 h-6 animate-spin text-slate-800 dark:text-white" />
          <span className="text-xs font-mono">Retrieving session records from MongoDB Atlas...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && sessions.length === 0 && (
        <div className="py-14 border border-dashed border-slate-300 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] flex flex-col items-center justify-center text-center p-6 space-y-2">
          <FolderArrowDownIcon className="w-10 h-10 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Sessions Recorded Yet</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Start a new product development lifecycle from the main workspace to log performance statistics and download generated codebases.
          </p>
        </div>
      )}

      {/* ── 3. Chronological Sessions Table / Cards ── */}
      {!isLoading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((sess) => {
            const isCompleted = sess.status === 'completed';
            const isAborted = sess.status === 'aborted';
            const isDownloading = downloadingId === sess.id;

            return (
              <div
                key={sess.id}
                className="p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
              >
                {/* Left: Project Info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {sess.project_name || 'Untitled Application'}
                    </h4>

                    {/* Status Badge */}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                        <CheckCircleIcon className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    )}
                    {isAborted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300">
                        <XCircleIcon className="w-3 h-3" />
                        <span>Aborted</span>
                      </span>
                    )}
                    {!isCompleted && !isAborted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {sess.feature_request && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 max-w-xl">
                      {sess.feature_request}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono flex-wrap pt-0.5">
                    <span>{sess.created_at ? new Date(sess.created_at).toLocaleString() : 'N/A'}</span>
                    <span>•</span>
                    <span>Duration: {formatDuration(sess.duration_ms)}</span>
                    <span>•</span>
                    <span>{((sess.total_prompt_tokens || 0) + (sess.total_completion_tokens || 0)).toLocaleString()} tokens</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">₹{(sess.total_cost_inr || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Right: Download Action */}
                <div className="shrink-0">
                  <button
                    type="button"
                    disabled={isAborted || isDownloading}
                    onClick={() => handleDownloadZip(sess)}
                    title={isAborted ? 'Codebase unavailable for aborted session' : 'Download Complete Project as ZIP'}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      isAborted
                        ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-black/20 border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-white'
                    }`}
                  >
                    {isDownloading ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-300" />
                        <span>Packing ZIP...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownTrayIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Download ZIP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => fetchSessionData(page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 disabled:opacity-30 cursor-pointer shadow-xs"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => fetchSessionData(page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 disabled:opacity-30 cursor-pointer shadow-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileSessionHistorySection;
