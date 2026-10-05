import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon, LockClosedIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

export interface StageSignInProps {
  onSignInSuccess: () => void;
  className?: string;
}

export const StageSignIn: React.FC<StageSignInProps> = ({
  onSignInSuccess,
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setErrorMessage(null);
    onSignInSuccess();
  };

  const handleGoogleSignIn = () => {
    onSignInSuccess();
  };

  return (
    <div
      id="stageSignIn"
      className={`h-full min-h-[80vh] flex items-center justify-center p-4 select-none ${className}`}
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="font-cursive text-4xl text-slate-900 font-normal italic tracking-wide">
            Welcome to AutoDev
          </h2>
          <p className="text-xs text-slate-500">
            Sign in to access your autonomous development workspace
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <EnvelopeIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Email Address</span>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 transition-colors focus-within:border-blue-500 focus-within:bg-white">
              <input
                id="signInEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@autodev.org"
                className="w-full bg-transparent text-sm p-3.5 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <LockClosedIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Password</span>
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 transition-colors focus-within:border-blue-500 focus-within:bg-white relative">
              <input
                id="signInPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-transparent text-sm p-3.5 pr-12 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Keep me signed in</span>
            </label>
            <button
              type="button"
              onClick={() => onSignInSuccess()}
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Reset password
            </button>
          </div>

          <button
            id="signInSubmitBtn"
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            Sign In
          </button>
        </form>

        <div className="relative flex items-center justify-center my-4">
          <span className="w-full border-t border-slate-200"></span>
          <span className="px-3 text-xs text-slate-400 bg-white absolute">
            Or continue with
          </span>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-2xl py-3 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer shadow-xs"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <p className="text-center text-xs text-slate-500">
          New to AutoDev?{' '}
          <button
            type="button"
            onClick={() => onSignInSuccess()}
            className="text-blue-600 hover:text-blue-700 font-semibold underline transition-colors"
          >
            Create Account
          </button>
        </p>
      </div>
    </div>
  );
};

export default StageSignIn;
