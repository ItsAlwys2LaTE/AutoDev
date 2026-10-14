import { create } from 'zustand';
import {
  authApi,
  UserProfile,
  UpdateProfileRequest,
} from '../api/authEndpoints';

export type {
  UserProfile,
  SignupRequest,
  LoginRequest,
  GoogleAuthRequest,
  UpdateProfileRequest,
} from '../api/authEndpoints';

export const AUTH_TOKEN_STORAGE_KEY = 'autodev_auth_token';
export const AUTH_USER_STORAGE_KEY = 'autodev_auth_user';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  token: string | null;
  error: string | null;

  // Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (email: string, username: string, password: string, displayName?: string) => Promise<void>;
  googleAuth: (idToken: string, rememberMe?: boolean) => Promise<void>;
  sendOtp: (email: string, purpose?: string) => Promise<void>;
  verifyOtp: (email: string, code: string, purpose?: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: UpdateProfileRequest) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  loadPersistedAuth: () => Promise<void>;
  clearError: () => void;

  // Convenience getters
  getPersonalizedPrompt: () => string;
  getDefaultFramework: () => string;
  getCustomApiKey: () => string | null;
  getModelConfig: () => { primary: string; fallback: string };
}

function persistToken(token: string, remember: boolean): void {
  if (typeof window === 'undefined') return;
  if (remember) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

function clearPersistedToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  token: null,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email: string, password: string, rememberMe: boolean = false) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login({ email, password, remember_me: rememberMe });
      persistToken(res.access_token, rememberMe);
      set({
        isAuthenticated: true,
        token: res.access_token,
        user: res.user,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const msg = err?.body?.detail || err?.message || 'Login failed. Please check your credentials.';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  signup: async (email: string, username: string, password: string, displayName?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.signup({
        email,
        username,
        password,
        display_name: displayName,
      });
      persistToken(res.access_token, false);
      set({
        isAuthenticated: true,
        token: res.access_token,
        user: res.user,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const msg = err?.body?.detail || err?.message || 'Signup failed. Please try again.';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  googleAuth: async (idToken: string, rememberMe: boolean = false) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.googleAuth({ id_token: idToken, remember_me: rememberMe });
      persistToken(res.access_token, rememberMe);
      set({
        isAuthenticated: true,
        token: res.access_token,
        user: res.user,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const msg = err?.body?.detail || err?.message || 'Google authentication failed.';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  sendOtp: async (email: string, purpose: string = 'signup') => {
    try {
      await authApi.sendOtp({ email, purpose });
    } catch (err: any) {
      const msg = err?.body?.detail || err?.message || 'Failed to dispatch verification email.';
      throw new Error(msg);
    }
  },

  verifyOtp: async (email: string, code: string, purpose: string = 'signup') => {
    try {
      const res = await authApi.verifyOtp({ email, otp_code: code, purpose });
      if (res.verified) {
        // Update local user state if currently authenticated
        const currentUser = get().user;
        if (currentUser && currentUser.email.toLowerCase() === email.toLowerCase()) {
          set({
            user: { ...currentUser, email_verified: true },
          });
        }
      }
      return res.verified;
    } catch (err: any) {
      const msg = err?.body?.detail || err?.message || 'Verification code is invalid or has expired.';
      throw new Error(msg);
    }
  },

  logout: () => {
    clearPersistedToken();
    set({
      isAuthenticated: false,
      token: null,
      user: null,
      error: null,
    });
  },

  updateProfile: async (updates: UpdateProfileRequest) => {
    set({ isLoading: true, error: null });
    try {
      const updatedUser = await authApi.updateProfile(updates);
      set({
        user: updatedUser,
        isLoading: false,
      });
    } catch (err: any) {
      const msg = err?.body?.detail || err?.message || 'Failed to update profile settings.';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      set({ isLoading: false, error: null });
    } catch (err: any) {
      const msg = err?.body?.detail || err?.message || 'Password update failed.';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  refreshToken: async () => {
    try {
      const res = await authApi.refreshToken();
      const isLocalStorage = Boolean(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
      persistToken(res.access_token, isLocalStorage);
      set({
        token: res.access_token,
        user: res.user,
        isAuthenticated: true,
      });
    } catch {
      // Non-blocking background token refresh failure
    }
  },

  loadPersistedAuth: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null });
      return;
    }

    set({ isLoading: true, token });
    try {
      const profile = await authApi.getMe();
      set({
        isAuthenticated: true,
        user: profile,
        isLoading: false,
        error: null,
      });
    } catch {
      // Token is stale or invalid; clear it cleanly
      clearPersistedToken();
      set({
        isAuthenticated: false,
        token: null,
        user: null,
        isLoading: false,
      });
    }
  },

  getPersonalizedPrompt: () => {
    const user = get().user;
    return user?.dev_preferences?.personalized_prompt?.trim() || '';
  },

  getDefaultFramework: () => {
    const user = get().user;
    return user?.dev_preferences?.default_framework || 'auto';
  },

  getCustomApiKey: () => {
    if (typeof window === 'undefined') return null;
    return (
      sessionStorage.getItem('autodev_user_api_key') ||
      localStorage.getItem('autodev_user_api_key') ||
      null
    );
  },

  getModelConfig: () => {
    const user = get().user;
    return {
      primary: user?.ai_config?.primary_model || 'gemini-3.5-flash-lite',
      fallback: user?.ai_config?.fallback_model || 'gemini-3.1-flash-lite',
    };
  },
}));
