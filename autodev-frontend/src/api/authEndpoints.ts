import { fetchWithAutoRetry, ApiError, extractErrorMessage } from './client';
export { extractErrorMessage };

const API_BASE = '';

// ============================================================================
// Types
// ============================================================================

export interface AIConfig {
  use_custom_key: boolean;
  custom_api_key_hash?: string | null;
  primary_model: string;
  fallback_model: string;
}

export interface DevPreferences {
  default_framework: string;
  personalized_prompt: string;
  auto_export: boolean;
}

export interface GitHubConfig {
  username: string;
  default_repo: string;
  default_commit_message: string;
  auto_create_repo: boolean;
  remember_token: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name?: string | null;
  avatar_color: string;
  role_title?: string | null;
  email_verified: boolean;
  auth_provider: string;
  created_at: string;
  ai_config: AIConfig;
  dev_preferences: DevPreferences;
  github_config: GitHubConfig;
}

export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface GoogleAuthRequest {
  id_token: string;
  remember_me?: boolean;
}

export interface SendOtpRequest {
  email: string;
  purpose?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp_code: string;
  purpose?: string;
}

export interface UpdateProfileRequest {
  display_name?: string;
  username?: string;
  email?: string;
  role_title?: string;
  avatar_color?: string;
  ai_config?: Partial<AIConfig>;
  dev_preferences?: Partial<DevPreferences>;
  github_config?: Partial<GitHubConfig>;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface CreateSessionRequest {
  project_name: string;
  feature_request: string;
  mode?: string;
}

export interface UpdateSessionRequest {
  status: string;
  duration_ms?: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  total_cost_inr?: number;
  stages_completed?: string[];
  component_count?: number;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  project_name: string;
  feature_request: string;
  mode: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  duration_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost_inr: number;
  stages_completed: string[];
  component_count: number;
  has_project: boolean;
}

export interface SessionListResponse {
  sessions: SessionRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface SessionStats {
  total_sessions: number;
  total_tokens_used: number;
  total_cost_inr: number;
}

export interface StoreProjectRequest {
  files: Array<{ file_name: string; source_code: string }>;
  readme?: string;
  user_guide?: string;
}

// ============================================================================
// Helper Request Execution
// ============================================================================

async function jsonRequest<T>(url: string, method: string, data?: any): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  };
  if (data !== undefined) {
    init.body = JSON.stringify(data);
  }

  const response = await fetchWithAutoRetry(url, init);
  return (await response.json()) as T;
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  signup: (data: SignupRequest): Promise<AuthResponse> =>
    jsonRequest<AuthResponse>(`${API_BASE}/api/auth/signup`, 'POST', data),

  login: (data: LoginRequest): Promise<AuthResponse> =>
    jsonRequest<AuthResponse>(`${API_BASE}/api/auth/login`, 'POST', data),

  googleAuth: (data: GoogleAuthRequest): Promise<AuthResponse> =>
    jsonRequest<AuthResponse>(`${API_BASE}/api/auth/google`, 'POST', data),

  getAuthConfig: (): Promise<{ google_client_id: string; has_brevo: boolean }> =>
    jsonRequest<{ google_client_id: string; has_brevo: boolean }>(`${API_BASE}/api/auth/config`, 'GET'),

  sendOtp: (data: SendOtpRequest): Promise<{ success: boolean; message: string }> =>
    jsonRequest<{ success: boolean; message: string }>(`${API_BASE}/api/auth/send-otp`, 'POST', data),

  verifyOtp: (data: VerifyOtpRequest): Promise<{ verified: boolean; message: string }> =>
    jsonRequest<{ verified: boolean; message: string }>(`${API_BASE}/api/auth/verify-otp`, 'POST', data),

  getMe: (): Promise<UserProfile> =>
    jsonRequest<UserProfile>(`${API_BASE}/api/auth/me`, 'GET'),

  updateProfile: (data: UpdateProfileRequest): Promise<UserProfile> =>
    jsonRequest<UserProfile>(`${API_BASE}/api/auth/profile`, 'PUT', data),

  changePassword: (data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> =>
    jsonRequest<{ success: boolean; message: string }>(`${API_BASE}/api/auth/password`, 'PUT', data),

  refreshToken: (): Promise<AuthResponse> =>
    jsonRequest<AuthResponse>(`${API_BASE}/api/auth/refresh`, 'POST'),

  deleteAccount: (): Promise<{ deleted: boolean; message: string }> =>
    jsonRequest<{ deleted: boolean; message: string }>(`${API_BASE}/api/auth/account`, 'DELETE'),
};

// ============================================================================
// Session API
// ============================================================================

export const sessionApi = {
  createSession: (data: CreateSessionRequest): Promise<SessionRecord> =>
    jsonRequest<SessionRecord>(`${API_BASE}/api/sessions`, 'POST', data),

  updateSession: (sessionId: string, data: UpdateSessionRequest): Promise<SessionRecord> =>
    jsonRequest<SessionRecord>(`${API_BASE}/api/sessions/${sessionId}`, 'PUT', data),

  listSessions: (page: number = 1, limit: number = 10): Promise<SessionListResponse> =>
    jsonRequest<SessionListResponse>(`${API_BASE}/api/sessions?page=${page}&limit=${limit}`, 'GET'),

  getSessionStats: (): Promise<SessionStats> =>
    jsonRequest<SessionStats>(`${API_BASE}/api/sessions/stats`, 'GET'),

  getSession: (sessionId: string): Promise<SessionRecord> =>
    jsonRequest<SessionRecord>(`${API_BASE}/api/sessions/${sessionId}`, 'GET'),

  deleteSession: (sessionId: string): Promise<{ deleted: boolean; message: string }> =>
    jsonRequest<{ deleted: boolean; message: string }>(`${API_BASE}/api/sessions/${sessionId}`, 'DELETE'),

  storeProject: (sessionId: string, data: StoreProjectRequest): Promise<{ stored: boolean; file_count: number }> =>
    jsonRequest<{ stored: boolean; file_count: number }>(`${API_BASE}/api/sessions/${sessionId}/project`, 'POST', data),

  downloadProjectZip: async (sessionId: string): Promise<Blob> => {
    const response = await fetchWithAutoRetry(`${API_BASE}/api/sessions/${sessionId}/project/download`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, 'Failed to download project ZIP');
    }
    return await response.blob();
  },
};
