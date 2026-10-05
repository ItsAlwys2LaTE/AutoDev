/**
 * AutoDev GitHub Export Types
 * Defines interfaces and types for one-click GitHub repository export and commit functionality.
 */

export type GitHubExportStatus =
  | 'idle'
  | 'validating_token'
  | 'checking_repo'
  | 'creating_repo'
  | 'preparing_commit'
  | 'uploading_tree'
  | 'finalizing_commit'
  | 'success'
  | 'error';

export interface GitHubExportFile {
  path: string;
  content: string;
}

export interface GitHubExportPayload {
  username: string;
  repoName: string;
  token: string;
  rememberToken?: boolean;
  files: GitHubExportFile[];
  isPrivate?: boolean;
  commitMessage?: string;
  description?: string;
}

export interface GitHubExportResult {
  success: boolean;
  repoUrl?: string;
  commitSha?: string;
  error?: string;
}

export interface StoredGitHubCredentials {
  username?: string;
  token?: string;
}

export interface GitHubExportStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}
