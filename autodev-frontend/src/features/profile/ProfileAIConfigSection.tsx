import React, { useState, useEffect } from 'react';
import {
  CpuChipIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';

export interface ProfileAIConfigSectionProps {
  className?: string;
}

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Recommended: High-speed reasoning & code synthesis' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Deep architectural decomposition & arbitration' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Fast, cost-effective multimodal baseline' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Long-context analysis & heavy documentation' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', description: 'Ultra-low latency execution mode' },
];

export const ProfileAIConfigSection: React.FC<ProfileAIConfigSectionProps> = ({
  className = '',
}) => {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  // Stored state initialization
  const [useCustomKey, setUseCustomKey] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('autodev_use_custom_key');
      if (stored !== null) return stored === '1';
    }
    return user?.ai_config?.use_custom_key ?? false;
  });

  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem('autodev_user_api_key') ||
        localStorage.getItem('autodev_user_api_key') ||
        ''
      );
    }
    return '';
  });

  const [primaryModel, setPrimaryModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('autodev_primary_model');
      if (stored) return stored;
    }
    return user?.ai_config?.primary_model || 'gemini-2.5-flash';
  });

  const [fallbackModel, setFallbackModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('autodev_fallback_model');
      if (stored) return stored;
    }
    return user?.ai_config?.fallback_model || 'gemini-1.5-flash';
  });

  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync from user prop on initial load
  useEffect(() => {
    if (user?.ai_config) {
      if (!sessionStorage.getItem('autodev_use_custom_key')) {
        setUseCustomKey(user.ai_config.use_custom_key);
      }
      if (!localStorage.getItem('autodev_primary_model')) {
        setPrimaryModel(user.ai_config.primary_model || 'gemini-2.5-flash');
      }
      if (!localStorage.getItem('autodev_fallback_model')) {
        setFallbackModel(user.ai_config.fallback_model || 'gemini-1.5-flash');
      }
    }
  }, [user]);

  const showToast = (message: string, title?: string) => {
    try {
      useSessionStore.getState().showSuccessToast(message, title || 'AI Configuration');
    } catch {
      // ignore
    }
  };

  const showWarningToast = (message: string, title?: string) => {
    try {
      useSessionStore.getState().showWarningToast(message, title || 'AI Configuration');
    } catch {
      // ignore
    }
  };

  // Toggle Key Mode
  const handleToggleKeyMode = (custom: boolean) => {
    setUseCustomKey(custom);
    setTestResult(null);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('autodev_use_custom_key', custom ? '1' : '0');
    }

    if (custom) {
      showToast('Switched to Custom API Key. System will use your personal key.', 'API Key');
    } else {
      showToast('Switched to AutoDev Default Keys. 7-key rotation active.', 'API Key');
    }

    // Persist preference to user profile
    updateProfile({
      ai_config: {
        use_custom_key: custom,
        primary_model: primaryModel,
        fallback_model: fallbackModel,
      },
    }).catch(() => {
      // ignore offline errors
    });
  };

  // Test Custom Key
  const handleTestKey = async () => {
    const trimmed = customApiKey.trim();
    if (!trimmed) {
      setTestResult({ success: false, message: 'Please enter a valid Gemini API key to test.' });
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);

    try {
      // Lightweight verification call to Google Generative Language API
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`
      );

      if (res.ok) {
        setTestResult({
          success: true,
          message: 'Key validated successfully. Connection to Google Gemini API confirmed.',
        });
        showToast('Custom API Key verified successfully.', 'Key Verified');
      } else {
        const errorData = await res.json().catch(() => null);
        const detail = errorData?.error?.message || 'Invalid API key or unauthorized.';
        setTestResult({
          success: false,
          message: `Validation failed: ${detail}`,
        });
        showWarningToast(`API Key Error: ${detail}`, 'Verification Failed');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Could not connect to Gemini API. Check your network connection.',
      });
      showWarningToast('Network error during key validation.', 'Connection Error');
    } finally {
      setIsTestingKey(false);
    }
  };

  // Save Full AI Configuration
  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      if (typeof window !== 'undefined') {
        if (customApiKey.trim()) {
          sessionStorage.setItem('autodev_user_api_key', customApiKey.trim());
          localStorage.setItem('autodev_user_api_key', customApiKey.trim());
        } else {
          sessionStorage.removeItem('autodev_user_api_key');
          localStorage.removeItem('autodev_user_api_key');
        }
        localStorage.setItem('autodev_primary_model', primaryModel);
        localStorage.setItem('autodev_fallback_model', fallbackModel);
        sessionStorage.setItem('autodev_use_custom_key', useCustomKey ? '1' : '0');
      }

      await updateProfile({
        ai_config: {
          use_custom_key: useCustomKey,
          primary_model: primaryModel,
          fallback_model: fallbackModel,
        },
      });

      showToast('AI and model configuration saved successfully.', 'Saved');
    } catch (err: any) {
      showWarningToast(err?.message || 'Failed to save configuration to server.', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetToDefaults = () => {
    setUseCustomKey(false);
    setPrimaryModel('gemini-2.5-flash');
    setFallbackModel('gemini-1.5-flash');
    setTestResult(null);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('autodev_use_custom_key', '0');
      localStorage.setItem('autodev_primary_model', 'gemini-2.5-flash');
      localStorage.setItem('autodev_fallback_model', 'gemini-1.5-flash');
    }

    updateProfile({
      ai_config: {
        use_custom_key: false,
        primary_model: 'gemini-2.5-flash',
        fallback_model: 'gemini-1.5-flash',
      },
    }).catch(() => {});

    showToast('Reset to default AutoDev 7-key balancer and models.', 'Reset Complete');
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* ── 1. Operational Mode Summary Card ── */}
      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <CpuChipIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Active Engine Mode</h3>
            <p className="text-xs text-slate-400">
              {useCustomKey
                ? 'User Custom API Key (Single User Quota)'
                : 'AutoDev KeyBalancer (7-Key Automated Rotation System)'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono">
          <span className={`w-2 h-2 rounded-full ${useCustomKey ? 'bg-indigo-400' : 'bg-emerald-400'} animate-pulse`} />
          <span className="text-slate-300">{useCustomKey ? 'Custom Mode' : 'Default Balancer'}</span>
        </div>
      </div>

      {/* ── 2. API Key Selection Toggle ── */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
          <KeyIcon className="w-3.5 h-3.5" />
          <span>API Key Management</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option A: Default System */}
          <button
            type="button"
            onClick={() => handleToggleKeyMode(false)}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              !useCustomKey
                ? 'bg-white border-slate-300/80 text-slate-900 shadow-sm dark:bg-white/10 dark:border-white/30 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.2)]'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:bg-white/[0.02] dark:border-white/[0.07] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">AutoDev Default Keys</span>
              {!useCustomKey && <CheckCircleIcon className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Uses AutoDev's automated 7-key round-robin rotation balancer across all stages.
            </p>
          </button>

          {/* Option B: Enter Your Own Key */}
          <button
            type="button"
            onClick={() => handleToggleKeyMode(true)}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              useCustomKey
                ? 'bg-white border-slate-300/80 text-slate-900 shadow-sm dark:bg-white/10 dark:border-white/30 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.2)]'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:bg-white/[0.02] dark:border-white/[0.07] dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Enter Your Own API Key</span>
              {useCustomKey && <CheckCircleIcon className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Provide your personal Gemini API key. Overrides the 7-key system for all pipeline requests.
            </p>
          </button>
        </div>

        {/* Custom Key Input Drawer */}
        {useCustomKey && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-3 animate-element shadow-xs">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Personal Google Gemini API Key</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Stored securely in session</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={customApiKey}
                  onChange={(e) => {
                    setCustomApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="AIzaSy..."
                  className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-2xl p-3 pr-10 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-mono focus:border-slate-500 dark:focus:border-white/30 focus:outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isTestingKey || !customApiKey.trim()}
                onClick={handleTestKey}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-sm dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isTestingKey ? (
                  <>
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-slate-600 dark:text-slate-300" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              {testResult && (
                <div
                  className={`text-xs flex items-center gap-1.5 font-medium ${
                    testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
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
          </div>
        )}
      </div>

      {/* ── 3. Model Selection ── */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
        <h3 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono font-semibold flex items-center gap-1.5">
          <SparklesIcon className="w-3.5 h-3.5" />
          <span>Model Selection</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Primary Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Primary Synthesis Model</label>
            <select
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-slate-500 dark:focus:border-white/30 focus:outline-none cursor-pointer shadow-xs"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {m.label} ({m.id})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {AVAILABLE_MODELS.find((m) => m.id === primaryModel)?.description}
            </p>
          </div>

          {/* Fallback Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Fallback Resilience Model</label>
            <select
              value={fallbackModel}
              onChange={(e) => setFallbackModel(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-slate-500 dark:focus:border-white/30 focus:outline-none cursor-pointer shadow-xs"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {m.label} ({m.id})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {AVAILABLE_MODELS.find((m) => m.id === fallbackModel)?.description}
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. Save and Reset Controls ── */}
      <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleResetToDefaults}
          className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-300 dark:hover:text-white transition-all cursor-pointer"
        >
          Reset to Defaults
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveConfig}
          className="px-6 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 shadow-sm dark:bg-white/15 dark:hover:bg-white/25 dark:text-white dark:border-white/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save AI Configuration'}
        </button>
      </div>
    </div>
  );
};

export default ProfileAIConfigSection;
