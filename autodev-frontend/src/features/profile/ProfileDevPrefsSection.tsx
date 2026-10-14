import React, { useState, useEffect } from 'react';
import {
  CodeBracketIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { SmoothInput } from '../../components/SmoothInput';

export interface ProfileDevPrefsSectionProps {
  className?: string;
}

const FRAMEWORK_OPTIONS = [
  { id: 'auto', label: 'Let AutoDev Decide (Automated Analysis)', category: 'Automatic' },
  { id: 'react-ts', label: 'React + TypeScript + Tailwind CSS', category: 'Frontend' },
  { id: 'nextjs', label: 'Next.js (App Router) + TypeScript + Tailwind CSS', category: 'Full-Stack' },
  { id: 'vue-ts', label: 'Vue 3 + TypeScript + Vite + Tailwind CSS', category: 'Frontend' },
  { id: 'fastapi', label: 'FastAPI + Python + Pydantic + Uvicorn', category: 'Backend' },
  { id: 'flask', label: 'Flask + Python + Jinja2', category: 'Backend' },
  { id: 'express-ts', label: 'Express.js + TypeScript + Node.js', category: 'Backend' },
  { id: 'django', label: 'Django + Python + SQLite / PostgreSQL', category: 'Full-Stack' },
  { id: 'html-vanilla', label: 'Modern Vanilla HTML5 + JavaScript + Tailwind CSS', category: 'Frontend' },
];

const PROMPT_MAX_LENGTH = 2000;

export const ProfileDevPrefsSection: React.FC<ProfileDevPrefsSectionProps> = ({
  className = '',
}) => {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [defaultFramework, setDefaultFramework] = useState<string>(
    user?.dev_preferences?.default_framework || 'auto'
  );
  const [personalizedPrompt, setPersonalizedPrompt] = useState<string>(
    user?.dev_preferences?.personalized_prompt || ''
  );
  const [autoExport, setAutoExport] = useState<boolean>(
    user?.dev_preferences?.auto_export ?? false
  );

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // Sync when user prop loads/updates
  useEffect(() => {
    if (user?.dev_preferences) {
      setDefaultFramework(user.dev_preferences.default_framework || 'auto');
      setPersonalizedPrompt(user.dev_preferences.personalized_prompt || '');
      setAutoExport(user.dev_preferences.auto_export ?? false);
    }
  }, [user]);

  const showToast = (message: string, title?: string) => {
    try {
      useSessionStore.getState().showSuccessToast(message, title || 'Preferences Saved');
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setHasSaved(false);
    try {
      await updateProfile({
        dev_preferences: {
          default_framework: defaultFramework,
          personalized_prompt: personalizedPrompt.trim(),
          auto_export: autoExport,
        },
      });
      setHasSaved(true);
      showToast('Development preferences updated and saved.');
      setTimeout(() => setHasSaved(false), 3000);
    } catch (err: any) {
      try {
        useSessionStore.getState().showWarningToast(
          err?.message || 'Failed to update preferences.',
          'Save Error'
        );
      } catch {
        // ignore
      }
    } finally {
      setIsSaving(false);
    }
  };

  const charCount = personalizedPrompt.length;
  const isNearLimit = charCount >= PROMPT_MAX_LENGTH - 200;

  return (
    <div className={`space-y-8 ${className}`}>
      {/* ── 1. Default Framework Selection ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
            <CodeBracketIcon className="w-3.5 h-3.5" />
            <span>Default Language / Framework</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">Applies to new requirements</span>
        </div>

        <select
          value={defaultFramework}
          onChange={(e) => setDefaultFramework(e.target.value)}
          className="w-full bg-slate-900 border border-white/10 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-100 focus:border-white/30 focus:outline-none cursor-pointer"
        >
          {FRAMEWORK_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              [{opt.category}] {opt.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          When set to &quot;Let AutoDev Decide&quot;, the System Architect analyzes product requirements to select optimal libraries. Choosing a specific framework pins that stack across all new sessions.
        </p>
      </div>

      {/* ── 2. Personalized Product Development Textarea (Stage 1 SmoothInput) ── */}
      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-xs uppercase tracking-wider text-white font-mono font-semibold flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Personalized Product Development Preferences</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Persistent instructions injected into the Product Enquiry Agent alongside your Stage 1 prompts.
            </p>
          </div>
          <span
            className={`text-xs font-mono transition-colors ${
              isNearLimit ? 'text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {charCount}/{PROMPT_MAX_LENGTH}
          </span>
        </div>

        {/* SmoothInput Textarea matching Stage 1 */}
        <SmoothInput
          id="personalizedPromptInput"
          as="textarea"
          autoResize={true}
          minHeight={130}
          maxHeight={260}
          maxLength={PROMPT_MAX_LENGTH}
          value={personalizedPrompt}
          onChange={(e) => setPersonalizedPrompt(e.target.value)}
          placeholder="e.g. Use glassmorphism design language with obsidian background, prefer React and Tailwind CSS, write thorough unit tests, avoid emojis in logs and terminal messages..."
          caretColorClass="text-white/80 font-semibold"
          wrapperClassName="rounded-3xl bg-slate-950/[0.25] backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.08)] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all overflow-hidden"
          className="w-full bg-transparent border-none outline-none focus:outline-none transition-all text-xs sm:text-sm text-white placeholder:text-white/35 font-sans leading-relaxed resize-none p-4 sm:p-5"
          style={{ backdropFilter: 'blur(14px)' }}
        />

        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-300">How this works:</strong> Whenever you request a new product in Stage 1, this text is automatically appended to your prompt as persistent architectural guidance, saving you from re-typing your core stylistic or engineering preferences each session.
        </div>
      </div>

      {/* ── 3. Auto-Export on Completion ── */}
      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
          <span>Post-Development Automation</span>
        </h3>

        <label className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-white block">
              Auto-Export on Pipeline Completion
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Automatically trigger GitHub synchronization or codebase ZIP download upon reaching final stage completion.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoExport}
            onChange={(e) => setAutoExport(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-black/40 accent-white focus:ring-0 cursor-pointer shrink-0"
          />
        </label>
      </div>

      {/* ── 4. Save Controls ── */}
      <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
        {hasSaved && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 animate-element">
            <CheckCircleIcon className="w-4 h-4" />
            <span>Saved successfully</span>
          </span>
        )}

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="px-6 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Saving Preferences...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default ProfileDevPrefsSection;
