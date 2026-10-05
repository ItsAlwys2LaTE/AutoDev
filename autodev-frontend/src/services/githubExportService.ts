/**
 * AutoDev GitHub Export Service
 * 
 * Provides client-side export to GitHub using the Git Data Trees REST API
 * for atomic single-commit delivery of generated codebases.
 */

import type {
  GitHubExportPayload,
  GitHubExportResult,
  GitHubExportStatus,
  GitHubExportFile,
  StoredGitHubCredentials,
} from '../types/github';
import type { GeneratedCodeBase, RequirementsDocument, CodeFile } from '../types';
import { sanitizeLucideImports, sanitizeRequirementsTxt } from '../utils/zipExporter';
import { createFallbackReadme, createFallbackUserGuide } from '../features/pipeline/revisionLoop';

export const SESSION_STORAGE_PAT_KEY = 'autodev_github_pat';
export const SESSION_STORAGE_USER_KEY = 'autodev_github_username';
export const SESSION_STORAGE_REPO_KEY = 'autodev_github_reponame';

/**
 * Retrieves stored GitHub credentials from browser sessionStorage.
 */
export function getStoredGitHubCredentials(): StoredGitHubCredentials {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return {};
  }
  try {
    const token = window.sessionStorage.getItem(SESSION_STORAGE_PAT_KEY) || undefined;
    const username = window.sessionStorage.getItem(SESSION_STORAGE_USER_KEY) || undefined;
    return { token, username };
  } catch {
    return {};
  }
}

/**
 * Saves GitHub credentials to browser sessionStorage.
 */
export function saveStoredGitHubCredentials(credentials: StoredGitHubCredentials): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }
  try {
    if (credentials.token) {
      window.sessionStorage.setItem(SESSION_STORAGE_PAT_KEY, credentials.token);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_PAT_KEY);
    }
    if (credentials.username) {
      window.sessionStorage.setItem(SESSION_STORAGE_USER_KEY, credentials.username);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_USER_KEY);
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

/**
 * Clears stored GitHub credentials from browser sessionStorage.
 */
export function clearStoredGitHubCredentials(): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_PAT_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_USER_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_REPO_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Prepares and normalizes codebase files for export.
 * Ensures requirements.txt and lucide imports are sanitized,
 * and guarantees fallback README.md and USER_GUIDE.md exist.
 */
export function prepareExportFiles(
  codebase?: GeneratedCodeBase | { files: CodeFile[] } | CodeFile[] | Record<string, string> | null,
  requirements?: RequirementsDocument | null
): GitHubExportFile[] {
  let rawFiles: CodeFile[] = [];

  if (Array.isArray(codebase)) {
    rawFiles = codebase;
  } else if (codebase && 'files' in codebase && Array.isArray(codebase.files)) {
    rawFiles = codebase.files;
  } else if (codebase && typeof codebase === 'object') {
    rawFiles = Object.entries(codebase).map(([file_name, source_code]) => ({
      file_name,
      source_code: typeof source_code === 'string' ? source_code : String(source_code || ''),
    }));
  }

  const exportMap = new Map<string, string>();

  rawFiles.forEach((file) => {
    const rawPath = (file.file_name || file.path || '').trim();
    if (!rawPath) return;

    // Normalize path by stripping leading slashes or dots
    const normalizedPath = rawPath.replace(/^\.?\/+/, '');
    const lower = normalizedPath.toLowerCase();

    let content = file.source_code || '';
    if (lower === 'requirements.txt') {
      content = sanitizeRequirementsTxt(content);
    } else if (
      lower.endsWith('.js') ||
      lower.endsWith('.jsx') ||
      lower.endsWith('.ts') ||
      lower.endsWith('.tsx')
    ) {
      content = sanitizeLucideImports(content);
    }

    exportMap.set(normalizedPath, content);
  });

  // Check if README.md exists (case-insensitive)
  const hasReadme = Array.from(exportMap.keys()).some(
    (p) => p.toLowerCase() === 'readme.md'
  );
  if (!hasReadme) {
    const fallbackReadme = createFallbackReadme(requirements, { files: rawFiles });
    exportMap.set('README.md', fallbackReadme.source_code);
  }

  // Check if USER_GUIDE.md exists (case-insensitive)
  const hasUserGuide = Array.from(exportMap.keys()).some(
    (p) => p.toLowerCase() === 'user_guide.md'
  );
  if (!hasUserGuide) {
    const fallbackUserGuide = createFallbackUserGuide(requirements);
    exportMap.set('USER_GUIDE.md', fallbackUserGuide.source_code);
  }

  return Array.from(exportMap.entries()).map(([path, content]) => ({
    path,
    content,
  }));
}

/**
 * Commits files to a GitHub repository using the Git Data Trees API.
 */
export async function exportToGitHub(
  payload: GitHubExportPayload,
  onStatusUpdate?: (status: GitHubExportStatus, stepMessage?: string) => void
): Promise<GitHubExportResult> {
  const username = (payload.username || '').trim();
  const repoName = (payload.repoName || '').trim();
  const token = (payload.token || '').trim();
  const files = payload.files || [];

  if (!token) {
    return {
      success: false,
      error: 'Personal Access Token is required.',
    };
  }
  if (!username) {
    return {
      success: false,
      error: 'GitHub Username or Organization is required.',
    };
  }
  if (!repoName) {
    return {
      success: false,
      error: 'Repository name is required.',
    };
  }
  if (files.length === 0) {
    return {
      success: false,
      error: 'No files provided to export.',
    };
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // 1. Validate Token & Authenticate User
    onStatusUpdate?.('validating_token', 'Validating GitHub credentials...');
    let userResponse: Response;
    try {
      userResponse = await fetch('https://api.github.com/user', {
        headers,
      });
    } catch {
      return {
        success: false,
        error: 'Failed to connect to GitHub API. Please check your network connection.',
      };
    }

    if (userResponse.status === 401) {
      return {
        success: false,
        error: "Invalid or expired GitHub Personal Access Token. Please verify token permissions.",
      };
    }
    if (userResponse.status === 403) {
      return {
        success: false,
        error: "GitHub API rate limit exceeded or token lacks 'repo' scope.",
      };
    }
    if (!userResponse.ok) {
      return {
        success: false,
        error: `GitHub authentication failed with status ${userResponse.status}.`,
      };
    }

    const authUser = await userResponse.json();
    const authLogin = (authUser.login || '').toLowerCase();

    // 2. Check Repository Existence or Auto-Create
    onStatusUpdate?.('checking_repo', 'Checking repository availability...');
    const repoCheckResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`,
      { headers }
    );

    let defaultBranch = 'main';

    if (repoCheckResponse.status === 200) {
      const existingRepoData = await repoCheckResponse.json();
      defaultBranch = existingRepoData.default_branch || 'main';
    } else if (repoCheckResponse.status === 404) {
      // Create repository
      onStatusUpdate?.('creating_repo', 'Creating repository on GitHub...');
      const isUserRepo = username.toLowerCase() === authLogin;
      const createUrl = isUserRepo
        ? 'https://api.github.com/user/repos'
        : `https://api.github.com/orgs/${encodeURIComponent(username)}/repos`;

      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repoName,
          description: payload.description || 'Generated autonomously by AutoDev',
          private: payload.isPrivate ?? false,
          auto_init: true,
        }),
      });

      if (createResponse.status === 401) {
        return {
          success: false,
          error: 'Invalid or expired GitHub Personal Access Token. Please verify token permissions.',
        };
      }
      if (createResponse.status === 403) {
        return {
          success: false,
          error: "GitHub API rate limit exceeded or token lacks 'repo' scope.",
        };
      }
      if (createResponse.status === 422) {
        // May already exist or invalid name
        const errJson = await createResponse.json().catch(() => null);
        const detailMsg = errJson?.message || 'Unprocessable request.';
        return {
          success: false,
          error: `Unprocessable GitHub request. Verify repository name syntax. (${detailMsg})`,
        };
      }
      if (!createResponse.ok) {
        const errJson = await createResponse.json().catch(() => null);
        const errMsg = errJson?.message || `Status ${createResponse.status}`;
        return {
          success: false,
          error: `Failed to create repository: ${errMsg}`,
        };
      }

      const createdRepoData = await createResponse.json();
      defaultBranch = createdRepoData.default_branch || 'main';
    } else if (repoCheckResponse.status === 401) {
      return {
        success: false,
        error: 'Invalid or expired GitHub Personal Access Token. Please verify token permissions.',
      };
    } else if (repoCheckResponse.status === 403) {
      return {
        success: false,
        error: "GitHub API rate limit exceeded or token lacks 'repo' scope.",
      };
    } else {
      return {
        success: false,
        error: `Unexpected error checking repository (HTTP ${repoCheckResponse.status}).`,
      };
    }

    // 3. Resolve Branch Ref and Base Commit
    onStatusUpdate?.('preparing_commit', 'Resolving branch reference...');
    const refResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
      { headers }
    );

    let baseCommitSha: string | null = null;
    let baseTreeSha: string | null = null;

    if (refResponse.ok) {
      const refData = await refResponse.json();
      baseCommitSha = refData.object?.sha || null;

      if (baseCommitSha) {
        const commitResponse = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/git/commits/${baseCommitSha}`,
          { headers }
        );
        if (commitResponse.ok) {
          const commitData = await commitResponse.json();
          baseTreeSha = commitData.tree?.sha || null;
        }
      }
    }

    // 4. Create Git Tree (Data Trees API for atomic commit)
    onStatusUpdate?.('uploading_tree', 'Uploading file tree to GitHub...');
    const treePayload: {
      base_tree?: string;
      tree: Array<{ path: string; mode: string; type: string; content: string }>;
    } = {
      tree: files.map((file) => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: file.content,
      })),
    };

    if (baseTreeSha) {
      treePayload.base_tree = baseTreeSha;
    }

    const treeResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/git/trees`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(treePayload),
      }
    );

    if (!treeResponse.ok) {
      const errJson = await treeResponse.json().catch(() => null);
      const errMsg = errJson?.message || `HTTP ${treeResponse.status}`;
      return {
        success: false,
        error: `Failed to create Git tree: ${errMsg}`,
      };
    }

    const treeData = await treeResponse.json();
    const newTreeSha = treeData.sha;

    // 5. Create Commit
    onStatusUpdate?.('finalizing_commit', 'Creating commit...');
    const commitMessage =
      payload.commitMessage || 'feat: export autonomously generated codebase from AutoDev';
    const commitBody: {
      message: string;
      tree: string;
      parents: string[];
    } = {
      message: commitMessage,
      tree: newTreeSha,
      parents: baseCommitSha ? [baseCommitSha] : [],
    };

    const commitResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/git/commits`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commitBody),
      }
    );

    if (!commitResponse.ok) {
      const errJson = await commitResponse.json().catch(() => null);
      const errMsg = errJson?.message || `HTTP ${commitResponse.status}`;
      return {
        success: false,
        error: `Failed to create Git commit: ${errMsg}`,
      };
    }

    const commitData = await commitResponse.json();
    const newCommitSha = commitData.sha;

    // 6. Update or Create Branch Reference
    if (baseCommitSha) {
      const updateRefResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/git/refs/heads/${encodeURIComponent(defaultBranch)}`,
        {
          method: 'PATCH',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sha: newCommitSha,
            force: false,
          }),
        }
      );

      if (!updateRefResponse.ok) {
        const errJson = await updateRefResponse.json().catch(() => null);
        const errMsg = errJson?.message || `HTTP ${updateRefResponse.status}`;
        return {
          success: false,
          error: `Failed to update branch reference: ${errMsg}`,
        };
      }
    } else {
      const createRefResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/git/refs`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: `refs/heads/${defaultBranch}`,
            sha: newCommitSha,
          }),
        }
      );

      if (!createRefResponse.ok) {
        const errJson = await createRefResponse.json().catch(() => null);
        const errMsg = errJson?.message || `HTTP ${createRefResponse.status}`;
        return {
          success: false,
          error: `Failed to create branch reference: ${errMsg}`,
        };
      }
    }

    // 7. Persist credentials if rememberToken is enabled
    if (payload.rememberToken) {
      saveStoredGitHubCredentials({
        username,
        token,
      });
    } else {
      clearStoredGitHubCredentials();
    }

    const repoUrl = `https://github.com/${username}/${repoName}`;
    onStatusUpdate?.('success', 'Repository exported successfully.');

    return {
      success: true,
      repoUrl,
      commitSha: newCommitSha,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to export codebase to GitHub due to an unexpected error.',
    };
  }
}
