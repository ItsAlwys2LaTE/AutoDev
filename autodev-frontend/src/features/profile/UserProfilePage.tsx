import React, { useState } from 'react';
import {
  UserCircleIcon,
  CpuChipIcon,
  AdjustmentsHorizontalIcon,
  CommandLineIcon,
  ClockIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { DarkModeToggle } from '../../components/DarkModeToggle';
import { ProfileAccountSection } from './ProfileAccountSection';
import { ProfileAIConfigSection } from './ProfileAIConfigSection';
import { ProfileDevPrefsSection } from './ProfileDevPrefsSection';
import { ProfileGitHubSection } from './ProfileGitHubSection';
import { ProfileSessionHistorySection } from './ProfileSessionHistorySection';

export type ProfileSectionId =
  | 'account'
  | 'ai-config'
  | 'dev-prefs'
  | 'github'
  | 'sessions';

export interface UserProfilePageProps {
  onBack: () => void;
  className?: string;
  isDark?: boolean;
  onToggleTheme?: (isDark: boolean) => void;
}

interface NavSectionItem {
  id: ProfileSectionId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: NavSectionItem[] = [
  {
    id: 'account',
    label: 'Account Management',
    description: 'User profile details, credentials, and password settings',
    icon: UserCircleIcon,
  },
  {
    id: 'ai-config',
    label: 'AI Configuration',
    description: 'Custom Gemini API keys and model routing preferences',
    icon: CpuChipIcon,
  },
  {
    id: 'dev-prefs',
    label: 'Development Preferences',
    description: 'Default framework, personalized prompt, and auto-export',
    icon: AdjustmentsHorizontalIcon,
  },
  {
    id: 'github',
    label: 'GitHub Integration',
    description: 'Repository synchronization, PAT token, and commit config',
    icon: CommandLineIcon,
  },
  {
    id: 'sessions',
    label: 'Session History',
    description: 'Development statistics, past sessions, and project ZIP downloads',
    icon: ClockIcon,
  },
];

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  onBack,
  className = '',
  isDark = true,
  onToggleTheme,
}) => {
  const [activeSection, setActiveSection] = useState<ProfileSectionId>('account');
  const user = useAuthStore((s) => s.user);

  const displayName = user?.display_name || user?.username || 'Developer';
  const email = user?.email || 'developer@autodev.org';
  const avatarLetter = displayName[0]?.toUpperCase() || 'D';

  const activeNav = SECTIONS.find((s) => s.id === activeSection) || SECTIONS[0];

  return (
    <div
      id="pageUserProfile"
      className={`min-h-screen w-full flex flex-col justify-between overflow-y-auto select-none font-sans text-slate-100 ${className}`}
    >
      {/* ── Top Header Bar ── */}
      <header className="h-16 px-6 sm:px-12 flex items-center justify-between bg-transparent border-none sticky top-0 z-20">
        <div
          onClick={onBack}
          className="relative inline-flex items-center group cursor-pointer"
          title="Return to Workspace"
        >
          <div
            className="absolute -inset-x-4 -inset-y-2 bg-slate-950/15 backdrop-blur-md rounded-full pointer-events-none -z-10"
            style={{ filter: 'blur(16px)' }}
            aria-hidden="true"
          />
          <span
            className="font-cursive text-3xl sm:text-4xl md:text-[42px] text-white/90 group-hover:text-white italic font-normal tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-all select-none"
            style={{ fontFamily: "'Alex Brush', cursive, sans-serif" }}
          >
            AutoDev
          </span>
          <span className="sr-only">AutoDev Profile</span>
        </div>

        <div className="flex items-center gap-3">
          {onToggleTheme && (
            <DarkModeToggle isDark={isDark} onToggle={onToggleTheme} />
          )}

          <button
            id="profileBackToWorkspaceBtn"
            type="button"
            onClick={onBack}
            className="text-xs text-slate-300 hover:text-white transition-all cursor-pointer px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md font-semibold flex items-center gap-2 shadow-xs"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Back to Workspace</span>
          </button>
        </div>
      </header>

      {/* ── Main 2-Column Profile Layout ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6 items-stretch">
        {/* Column 1 (Left): Sections Navigation Bar */}
        <aside className="w-full md:w-72 lg:w-80 shrink-0 flex flex-col gap-4">
          {/* Quick Profile Summary Glass Card */}
          <div className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-2xl border border-white/[0.08] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.3)] flex items-center gap-4">
            <div
              className="w-13 h-13 rounded-2xl border border-white/20 flex items-center justify-center text-lg font-bold text-white shadow-inner shrink-0"
              style={{
                backgroundColor: user?.avatar_color || 'rgba(255, 255, 255, 0.15)',
              }}
            >
              {avatarLetter}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white truncate">{displayName}</h2>
              <p className="text-xs text-slate-400 font-mono truncate">{email}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  {user?.role_title || 'Autonomous Engineer'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Items (Desktop: Vertical List, Mobile: Horizontal Tabs) */}
          <nav
            aria-label="Profile Sections"
            className="rounded-3xl bg-slate-950/[0.25] backdrop-blur-2xl border border-white/[0.08] p-2 sm:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.3)] flex flex-row md:flex-col gap-1.5 overflow-x-auto scrollbar-none"
          >
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  id={`nav-${sec.id}`}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl border transition-all duration-200 flex items-center gap-3 cursor-pointer shrink-0 md:shrink ${
                    isActive
                      ? 'bg-white/15 border-white/25 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.2)]'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.08]'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <div className="hidden sm:block min-w-0">
                    <p className="text-xs leading-none truncate">{sec.label}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Column 2 (Right): Active Section Content Surface */}
        <section
          id="profileActiveSectionContainer"
          className="flex-1 min-w-0 rounded-3xl bg-slate-950/[0.25] backdrop-blur-2xl border border-white/[0.08] p-6 sm:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.3)] flex flex-col"
        >
          {/* Section Header */}
          <div className="border-b border-white/[0.08] pb-5 mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {activeNav.label}
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {activeNav.description}
            </p>
          </div>

          {/* Section Body */}
          <div className="flex-1">
            {activeSection === 'account' && (
              <ProfileAccountSection onLoggedOut={onBack} />
            )}
            {activeSection === 'ai-config' && (
              <ProfileAIConfigSection />
            )}
            {activeSection === 'dev-prefs' && (
              <ProfileDevPrefsSection />
            )}
            {activeSection === 'github' && (
              <ProfileGitHubSection />
            )}
            {activeSection === 'sessions' && (
              <ProfileSessionHistorySection />
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default UserProfilePage;
