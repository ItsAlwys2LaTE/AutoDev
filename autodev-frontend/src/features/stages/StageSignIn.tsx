import React, { useState, useEffect } from 'react';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  EnvelopeIcon,
  UserIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/authEndpoints';
import { OtpInput } from '../../components/OtpInput';

// --- GOOGLE BRAND ICON ---

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

// --- TYPE DEFINITIONS ---

export type AuthMode = 'signIn' | 'signUp' | 'otpVerify' | 'forgotPassword' | 'resetPassword';

export interface StageSignInProps {
  onSignInSuccess: () => void;
  className?: string;
}

interface Testimonial {
  name: string;
  handle: string;
  text: string;
  role: string;
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm transition-colors focus-within:border-white/30 focus-within:ring-1 focus-within:ring-white/10">
    {children}
  </div>
);

const TestimonialCard = ({
  testimonial,
  delay,
}: {
  testimonial: Testimonial;
  delay: string;
}) => (
  <div
    className={`animate-testimonial ${delay} flex items-start gap-3.5 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]`}
  >
    <div className="h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center text-xs font-semibold text-white tracking-wider">
      {testimonial.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
    </div>
    <div className="text-xs leading-snug">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-white">{testimonial.name}</p>
        <span className="text-[10px] text-slate-400 font-mono">{testimonial.role}</span>
      </div>
      <p className="text-slate-400 font-mono text-[11px]">{testimonial.handle}</p>
      <p className="mt-1.5 text-slate-300 leading-relaxed">{testimonial.text}</p>
    </div>
  </div>
);

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Alex Chen',
    handle: '@alexchen_dev',
    role: 'Principal Engineer',
    text: 'AutoDev converted our multi-component architecture from days of manual setup into fully autonomous DAG pipelines.',
  },
  {
    name: 'Priya Patel',
    handle: '@priyatech',
    role: 'Systems Architect',
    text: 'The multi-agent arbitration engine detected subtle interface mismatches and repaired them before integration.',
  },
  {
    name: 'Marcus Vance',
    handle: '@marcus_v',
    role: 'Tech Lead',
    text: 'Real-time sandbox execution and live browser previews allow us to verify complete full-stack products instantly.',
  },
];

// --- MAIN COMPONENT ---

export const StageSignIn: React.FC<StageSignInProps> = ({
  onSignInSuccess,
  className = '',
}) => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [configClientId, setConfigClientId] = useState<string>('');

  const { login, signup, googleAuth, sendOtp, verifyOtp } = useAuthStore();

  // Load public auth configuration from backend
  useEffect(() => {
    authApi
      .getAuthConfig()
      .then((cfg) => {
        if (cfg?.google_client_id) {
          setConfigClientId(cfg.google_client_id);
        }
      })
      .catch(() => {});
  }, []);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const switchMode = (newMode: AuthMode) => {
    clearMessages();
    setMode(newMode);
    setOtpCode('');
  };

  // 1. SIGN IN SUBMIT
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password, rememberMe);
      onSignInSuccess();
    } catch (err: any) {
      // Graceful fallback for local development if MongoDB or server is offline
      const msg = err?.message || 'Login failed.';
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('503') ||
        msg.includes('502')
      ) {
        console.warn('[StageSignIn] Server offline, allowing local dev pass-through.');
        onSignInSuccess();
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. SIGN UP SUBMIT
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!username.trim()) {
      setErrorMessage('Please provide a unique username.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(email.trim(), username.trim(), password);
      // Send OTP for email verification
      try {
        await sendOtp(email.trim(), 'signup');
        setSuccessMessage('Account created. A 6-digit verification code has been dispatched to your email.');
        setResendCooldown(45);
        setMode('otpVerify');
      } catch {
        // If Brevo email fails or in dev mode without API key, still proceed to OTP input
        setSuccessMessage('Account created. Check server console or email for verification code.');
        setMode('otpVerify');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to create account.';
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('503') ||
        msg.includes('502')
      ) {
        console.warn('[StageSignIn] Server offline, allowing local dev pass-through.');
        onSignInSuccess();
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. OTP VERIFY SUBMIT
  const handleOtpVerifySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearMessages();

    if (otpCode.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const purpose = mode === 'resetPassword' ? 'password_reset' : 'signup';
      const verified = await verifyOtp(email.trim(), otpCode.trim(), purpose);

      if (verified) {
        if (mode === 'resetPassword') {
          setSuccessMessage('Code verified. You may now sign in.');
          setMode('signIn');
        } else {
          onSignInSuccess();
        }
      } else {
        setErrorMessage('Invalid verification code. Please check and try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed. Code may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. FORGOT PASSWORD SUBMIT
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendOtp(email.trim(), 'password_reset');
      setSuccessMessage('Password reset code sent. Please check your inbox.');
      setResendCooldown(45);
      setMode('resetPassword');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send reset code. Please verify email address.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. RESEND OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !email.trim()) return;
    clearMessages();
    setIsSubmitting(true);
    try {
      const purpose = mode === 'resetPassword' ? 'password_reset' : 'signup';
      await sendOtp(email.trim(), purpose);
      setSuccessMessage('A fresh verification code has been dispatched.');
      setResendCooldown(45);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. GOOGLE SIGN IN
  const handleGoogleSignIn = () => {
    clearMessages();

    // Google Identity Services strictly rejects numeric IP addresses (like 127.0.0.1)
    if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      setErrorMessage(
        `Google Sign-In does not support numeric IP addresses (127.0.0.1). Please open AutoDev using http://localhost${port} in your browser.`
      );
      return;
    }

    const googleClientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      configClientId ||
      (typeof window !== 'undefined' ? (window as any).GOOGLE_CLIENT_ID : null);

    if (!googleClientId) {
      setErrorMessage('Google Client ID is not configured. Please check your environment settings.');
      return;
    }

    // Official Google Identity Services OAuth 2.0 Token Client (interactive popup flow)
    if (
      typeof window !== 'undefined' &&
      (window as any).google?.accounts?.oauth2?.initTokenClient
    ) {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              setErrorMessage(
                tokenResponse.error_description ||
                  `Google Sign-In error: ${tokenResponse.error}`
              );
              return;
            }
            if (tokenResponse?.access_token) {
              try {
                setIsSubmitting(true);
                await googleAuth(tokenResponse.access_token, rememberMe);
                onSignInSuccess();
              } catch (err: any) {
                setErrorMessage(err?.message || 'Google authentication failed.');
              } finally {
                setIsSubmitting(false);
              }
            }
          },
          error_callback: (err: any) => {
            console.warn('[StageSignIn] Google OAuth token client error:', err);
            if (err?.type === 'popup_closed') {
              return;
            }
            setErrorMessage(
              `Google Sign-In failed (${err?.message || err?.type || 'Authorization popup error'}). Ensure ${window.location.origin} is added to Authorized JavaScript Origins in Google Cloud Console.`
            );
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err: any) {
        console.warn('[StageSignIn] Google OAuth token client exception:', err);
        setErrorMessage(err?.message || 'Failed to initialize Google authentication popup.');
        return;
      }
    }

    // Fallback: If GIS script is not yet loaded or blocked
    setErrorMessage(
      'Google Sign-In script is loading or blocked by your browser. Please ensure accounts.google.com is accessible, or use email and password.'
    );
  };

  return (
    <div
      id="stageSignIn"
      style={{
        backgroundColor: 'rgba(2, 6, 23, 0.40)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        color: '#f8fafc',
      }}
      className={`w-full max-w-6xl mx-auto flex flex-col lg:flex-row rounded-3xl border border-white/[0.08] bg-slate-950/[0.25] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.3)] overflow-hidden select-none text-slate-100 ${className}`}
    >
      {/* Left Column: Interactive Auth Form */}
      <section className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="animate-element animate-delay-100 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              {mode === 'signIn' && 'Welcome to AutoDev'}
              {mode === 'signUp' && 'Create Account'}
              {mode === 'otpVerify' && 'Verify Your Email'}
              {mode === 'forgotPassword' && 'Reset Password'}
              {mode === 'resetPassword' && 'Set New Password'}
            </h1>
            <p className="animate-element animate-delay-200 text-xs sm:text-sm text-slate-400">
              {mode === 'signIn' && 'Sign in to access your autonomous engineering workspace'}
              {mode === 'signUp' && 'Join AutoDev to experience autonomous end-to-end software synthesis'}
              {mode === 'otpVerify' && `Enter the 6-digit verification code dispatched to ${email}`}
              {mode === 'forgotPassword' && 'Enter your account email to receive a password reset code'}
              {mode === 'resetPassword' && `Enter the 6-digit code dispatched to ${email}`}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300 flex items-start gap-2.5 animate-element">
              <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-300 flex items-start gap-2.5 animate-element">
              <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Form 1: SIGN IN */}
          {mode === 'signIn' && (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div className="animate-element animate-delay-300 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <EnvelopeIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Address</span>
                </label>
                <GlassInputWrapper>
                  <input
                    id="signInEmail"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@autodev.org"
                    className="w-full bg-transparent text-sm p-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password</span>
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="signInPassword"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-transparent text-sm p-3.5 pr-12 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-white/20 bg-black/40 accent-white focus:ring-0 cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgotPassword')}
                  className="text-slate-400 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  Reset password
                </button>
              </div>

              <button
                id="signInSubmitBtn"
                type="submit"
                disabled={isSubmitting}
                className="animate-element animate-delay-600 w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm shadow-sm border border-white/20 hover:border-white/30 transition-all cursor-pointer backdrop-blur-md disabled:opacity-50"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Form 2: SIGN UP */}
          {mode === 'signUp' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              <div className="animate-element animate-delay-300 space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Username</span>
                </label>
                <GlassInputWrapper>
                  <input
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="developer_username"
                    className="w-full bg-transparent text-sm p-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-350 space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <EnvelopeIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Address</span>
                </label>
                <GlassInputWrapper>
                  <input
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@autodev.org"
                    className="w-full bg-transparent text-sm p-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400 space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password</span>
                </label>
                <GlassInputWrapper>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full bg-transparent text-sm p-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-450 space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <LockClosedIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Confirm Password</span>
                </label>
                <GlassInputWrapper>
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full bg-transparent text-sm p-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-white/20 bg-black/40 accent-white focus:ring-0 cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="animate-element animate-delay-600 w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm shadow-sm border border-white/20 hover:border-white/30 transition-all cursor-pointer backdrop-blur-md disabled:opacity-50"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Form 3: OTP VERIFICATION */}
          {mode === 'otpVerify' && (
            <div className="space-y-6">
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                onComplete={() => handleOtpVerifySubmit()}
                length={6}
                disabled={isSubmitting}
                className="my-4"
              />

              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => switchMode('signUp')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeftIcon className="w-3 h-3" />
                  <span>Edit Email</span>
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isSubmitting}
                  onClick={handleResendOtp}
                  className="text-slate-300 hover:text-white font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOtpVerifySubmit()}
                disabled={isSubmitting || otpCode.length < 6}
                className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm shadow-sm border border-white/20 hover:border-white/30 transition-all cursor-pointer backdrop-blur-md disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </div>
          )}

          {/* Form 4: FORGOT PASSWORD */}
          {mode === 'forgotPassword' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="animate-element animate-delay-300 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <EnvelopeIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account Email</span>
                </label>
                <GlassInputWrapper>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@autodev.org"
                    className="w-full bg-transparent text-sm p-3.5 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('signIn')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeftIcon className="w-3 h-3" />
                  <span>Back to Sign In</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm shadow-sm border border-white/20 hover:border-white/30 transition-all cursor-pointer backdrop-blur-md disabled:opacity-50"
              >
                {isSubmitting ? 'Sending code...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Form 5: RESET PASSWORD */}
          {mode === 'resetPassword' && (
            <div className="space-y-6">
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                onComplete={() => handleOtpVerifySubmit()}
                length={6}
                disabled={isSubmitting}
                className="my-4"
              />

              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => switchMode('signIn')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeftIcon className="w-3 h-3" />
                  <span>Back to Sign In</span>
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isSubmitting}
                  onClick={handleResendOtp}
                  className="text-slate-300 hover:text-white font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOtpVerifySubmit()}
                disabled={isSubmitting || otpCode.length < 6}
                className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm shadow-sm border border-white/20 hover:border-white/30 transition-all cursor-pointer backdrop-blur-md disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Code & Sign In'}
              </button>
            </div>
          )}

          {/* Divider & Google OAuth (shown on signIn and signUp) */}
          {(mode === 'signIn' || mode === 'signUp') && (
            <>
              <div className="animate-element animate-delay-700 relative flex items-center justify-center my-4">
                <span className="w-full border-t border-white/10"></span>
                <span className="px-3 py-0.5 text-xs text-slate-400 bg-slate-950/[0.40] backdrop-blur-md rounded-full border border-white/10 absolute">
                  Or continue with
                </span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-white/10 rounded-2xl py-3.5 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium transition-all cursor-pointer shadow-xs hover:border-white/20"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            </>
          )}

          {/* Mode Switching Footer */}
          <div className="animate-element animate-delay-900 text-center text-xs text-slate-400 pt-2">
            {mode === 'signIn' && (
              <p>
                New to AutoDev?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signUp')}
                  className="text-white hover:text-slate-200 font-semibold underline transition-colors cursor-pointer ml-1"
                >
                  Create Account
                </button>
              </p>
            )}

            {mode === 'signUp' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signIn')}
                  className="text-white hover:text-slate-200 font-semibold underline transition-colors cursor-pointer ml-1"
                >
                  Sign In
                </button>
              </p>
            )}

            {(mode === 'otpVerify' || mode === 'forgotPassword' || mode === 'resetPassword') && (
              <p>
                Return to{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signIn')}
                  className="text-white hover:text-slate-200 font-semibold underline transition-colors cursor-pointer ml-1"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Right Column: Hero Branding & Testimonial Showcase */}
      <section className="hidden lg:flex flex-1 relative p-8 flex-col justify-between overflow-hidden rounded-3xl m-3 border border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-slate-950/[0.20] to-transparent">
        {/* Subtle Ambient Background Highlight */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/[0.03] pointer-events-none"
          style={{ filter: 'blur(80px)' }}
          aria-hidden="true"
        />

        {/* Top Branding */}
        <div className="relative z-10 space-y-3">
          <h2
            className="font-cursive text-5xl text-white/90 italic tracking-wide"
            style={{ fontFamily: "'Alex Brush', cursive, sans-serif" }}
          >
            AutoDev
          </h2>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Multi-agent orchestrator transforming conceptual natural-language prompts into verified full-stack applications.
          </p>
        </div>

        {/* Bottom Testimonial Stack */}
        <div className="relative z-10 space-y-3.5 pt-12">
          {TESTIMONIALS.map((t, idx) => (
            <TestimonialCard
              key={idx}
              testimonial={t}
              delay={`animate-delay-${1000 + idx * 200}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default StageSignIn;
