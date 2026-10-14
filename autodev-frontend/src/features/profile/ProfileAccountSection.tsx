import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  UserIcon,
  EnvelopeIcon,
  BriefcaseIcon,
  ArrowRightOnRectangleIcon,
  TrashIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { authApi } from '../../api/authEndpoints';

export interface ProfileAccountSectionProps {
  onLoggedOut?: () => void;
  className?: string;
}

const AVATAR_PALETTE = [
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Amber', value: '#d97706' },
];

export const ProfileAccountSection: React.FC<ProfileAccountSectionProps> = ({
  onLoggedOut,
  className = '',
}) => {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);

  // Field states
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [roleTitle, setRoleTitle] = useState(user?.role_title || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || '#4f46e5');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // UI state
  const [savingField, setSavingField] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize state when store user updates
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setRoleTitle(user.role_title || '');
      setAvatarColor(user.avatar_color || '#4f46e5');
    }
  }, [user]);

  const showToast = (message: string, title?: string) => {
    try {
      useSessionStore.getState().showSuccessToast(message, title || 'Account Updated');
    } catch {
      // ignore
    }
  };

  const showErrorToast = (message: string) => {
    try {
      useSessionStore.getState().showWarningToast(message, 'Update Failed');
    } catch {
      // ignore
    }
  };

  // 1. Save single profile field
  const handleSaveField = async (fieldName: string, value: string) => {
    setSavingField(fieldName);
    setErrorMessage(null);
    try {
      await updateProfile({ [fieldName]: value.trim() });
      const label =
        fieldName === 'display_name'
          ? 'Display Name'
          : fieldName === 'username'
          ? 'Username'
          : fieldName === 'email'
          ? 'Email Address'
          : 'Role Title';
      showToast(`${label} updated successfully.`);
    } catch (err: any) {
      const msg = err?.message || `Failed to update ${fieldName}.`;
      setErrorMessage(msg);
      showErrorToast(msg);
    } finally {
      setSavingField(null);
    }
  };

  // 2. Avatar color change
  const handleColorSelect = async (color: string) => {
    setAvatarColor(color);
    try {
      await updateProfile({ avatar_color: color });
      showToast('Avatar theme updated.');
    } catch (err: any) {
      showErrorToast(err?.message || 'Failed to update avatar color.');
    }
  };

  // 3. Password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters in length.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Your password was updated successfully.', 'Security');
    } catch (err: any) {
      const msg = err?.message || 'Password update failed. Please check current password.';
      setErrorMessage(msg);
      showErrorToast(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 4. Logout
  const handleLogout = () => {
    logout();
    showToast('You have signed out of your account.', 'Session');
    if (onLoggedOut) onLoggedOut();
  };

  // 5. Delete account
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await authApi.deleteAccount();
      logout();
      showToast('Your account has been deleted permanently.', 'Account Deleted');
      if (onLoggedOut) onLoggedOut();
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete account.';
      setErrorMessage(msg);
      showErrorToast(msg);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isGoogleUser = user?.auth_provider === 'google';
  const initialLetter = (displayName || username || 'D')[0]?.toUpperCase() || 'D';

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-300 flex items-start gap-2.5">
          <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* ── 1. Avatar & Quick Color Customization ── */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        <div
          className="w-18 h-18 rounded-2xl border-2 border-white/20 flex items-center justify-center text-2xl font-bold text-white shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: avatarColor }}
        >
          {initialLetter}
        </div>

        <div className="space-y-2 text-center sm:text-left flex-1">
          <h3 className="text-sm font-semibold text-white">Avatar Accent Theme</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Select a custom accent color for your workspace profile badge and avatar icon.
          </p>

          <div className="flex items-center justify-center sm:justify-start gap-2.5 pt-1">
            {AVATAR_PALETTE.map((pal) => (
              <button
                key={pal.value}
                type="button"
                onClick={() => handleColorSelect(pal.value)}
                title={pal.name}
                className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                  avatarColor.toLowerCase() === pal.value.toLowerCase()
                    ? 'border-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                    : 'border-white/20 hover:scale-110 hover:border-white/60'
                }`}
                style={{ backgroundColor: pal.value }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Editable User Profile Fields ── */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
          Profile Information
        </h3>

        {/* Display Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Display Name</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Chen"
              className="flex-1 bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none transition-colors"
            />
            {displayName.trim() !== (user?.display_name || '').trim() && (
              <button
                type="button"
                disabled={savingField === 'display_name'}
                onClick={() => handleSaveField('display_name', displayName)}
                className="px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {savingField === 'display_name' ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Username</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alex_chen"
              className="flex-1 bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none transition-colors"
            />
            {username.trim() !== (user?.username || '').trim() && (
              <button
                type="button"
                disabled={savingField === 'username'}
                onClick={() => handleSaveField('username', username)}
                className="px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {savingField === 'username' ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {/* Email Address */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <EnvelopeIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Email Address</span>
            </label>
            {user?.email_verified ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                <ExclamationCircleIcon className="w-3.5 h-3.5" />
                <span>Unverified</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@autodev.org"
              className="flex-1 bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none transition-colors"
            />
            {email.trim() !== (user?.email || '').trim() && (
              <button
                type="button"
                disabled={savingField === 'email'}
                onClick={() => handleSaveField('email', email)}
                className="px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {savingField === 'email' ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {/* Role / Job Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <BriefcaseIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Role / Title</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Lead Systems Architect"
              className="flex-1 bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none transition-colors"
            />
            {roleTitle.trim() !== (user?.role_title || '').trim() && (
              <button
                type="button"
                disabled={savingField === 'role_title'}
                onClick={() => handleSaveField('role_title', roleTitle)}
                className="px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {savingField === 'role_title' ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Password Management (Hidden for Google OAuth Users) ── */}
      {!isGoogleUser && (
        <form onSubmit={handleChangePassword} className="space-y-4 pt-4 border-t border-white/[0.08]">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
            <LockClosedIcon className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </h3>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Current Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 pr-10 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-40"
              >
                {isChangingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── 4. Account Details & Metadata ── */}
      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center gap-1.5">
          <ShieldCheckIcon className="w-3.5 h-3.5" />
          <span>Security & Authentication Metadata</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-400">Auth Provider</span>
            <p className="text-xs font-semibold text-white capitalize">
              {user?.auth_provider || 'Local Credentials'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-400">Account Status</span>
            <p className="text-xs font-semibold text-emerald-400">
              {user?.email_verified ? 'Active & Verified' : 'Standard Access'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-400">Member Since</span>
            <p className="text-xs font-semibold text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Member'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 5. Danger Zone: Sign Out & Account Deletion ── */}
      <div className="pt-6 border-t border-rose-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        ) : (
          <div className="w-full sm:w-auto flex items-center gap-2 p-2 rounded-2xl bg-rose-950/40 border border-rose-500/40">
            <span className="text-xs text-rose-300 pl-2">Are you sure?</span>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDeleteAccount}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileAccountSection;
