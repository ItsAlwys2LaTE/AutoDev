/**
 * AutoDev Dynamic Test Runner & Integrated Blueprint Synthesis
 * 
 * Implements Milestone 3 R1:
 * - Dynamic test runner detection inspecting codebase files and stack metadata:
 *   - Go files (*.go, go.mod) -> 'go test ./...'
 *   - Rust files (*.rs, Cargo.toml) -> 'cargo test'
 *   - Python files (*.py, requirements.txt) without package.json -> 'pytest'
 *   - package.json present -> 'npm test'
 *   - Fallback keywords (node, javascript, typescript, react, vue, playwright) -> 'npm test', else 'pytest'
 * - Integrated blueprint generator synthesizing SystemDesignBlueprint for unified project
 */

import type {
  CodeFile,
  GeneratedCodeBase,
  ComponentDecomposition,
  SystemDesignBlueprint,
} from '../../types';

export interface DynamicRunnerResult {
  runnerCommand: string;
  inferredLanguage: 'go' | 'rust' | 'python' | 'node' | 'generic';
  matchedFile?: string;
  ruleMatched: string;
  toString(): string;
  valueOf(): string;
}

class DynamicRunnerResultImpl implements DynamicRunnerResult {
  constructor(
    public runnerCommand: string,
    public inferredLanguage: 'go' | 'rust' | 'python' | 'node' | 'generic',
    public ruleMatched: string,
    public matchedFile?: string
  ) {}

  toString(): string {
    return this.runnerCommand;
  }

  valueOf(): string {
    return this.runnerCommand;
  }
}

/**
 * Detects the appropriate dynamic test runner command and inferred language
 * by inspecting codebase files, tech stack keywords, and Docker image names.
 */
export function detectDynamicTestRunner(
  filesOrCodebase: GeneratedCodeBase | CodeFile[] | null | undefined,
  techStackOrDecomp?: string[] | ComponentDecomposition | null,
  dockerImage?: string | null
): DynamicRunnerResult {
  // Normalize files array
  let files: CodeFile[] = [];
  if (filesOrCodebase) {
    if ('files' in filesOrCodebase && Array.isArray(filesOrCodebase.files)) {
      files = filesOrCodebase.files;
    } else if (Array.isArray(filesOrCodebase)) {
      files = filesOrCodebase;
    }
  }

  // Normalize tech stack & docker image
  let techStack: string[] = [];
  let resolvedDockerImage = (dockerImage || '').toLowerCase();

  if (techStackOrDecomp) {
    if (Array.isArray(techStackOrDecomp)) {
      techStack = techStackOrDecomp;
    } else if (typeof techStackOrDecomp === 'object') {
      const decomp = techStackOrDecomp as ComponentDecomposition;
      if (Array.isArray(decomp.shared_tech_stack)) {
        techStack = decomp.shared_tech_stack;
      }
      if (decomp.shared_docker_image) {
        resolvedDockerImage = decomp.shared_docker_image.toLowerCase();
      }
    }
  }

  const stackKeywords = techStack.map((s) => String(s).toLowerCase());

  // Rule 1: Go projects (*.go, go.mod)
  const goFile = files.find((f) => {
    const name = (f?.file_name || '').toLowerCase();
    return name.endsWith('.go') || name === 'go.mod' || name.endsWith('/go.mod');
  });
  if (goFile) {
    return new DynamicRunnerResultImpl(
      'go test ./...',
      'go',
      'Detected Go source files (*.go) or go.mod',
      goFile.file_name
    );
  }

  // Rule 2: Rust projects (*.rs, Cargo.toml)
  const rustFile = files.find((f) => {
    const name = (f?.file_name || '').toLowerCase();
    return name.endsWith('.rs') || name === 'cargo.toml' || name.endsWith('/cargo.toml');
  });
  if (rustFile) {
    return new DynamicRunnerResultImpl(
      'cargo test',
      'rust',
      'Detected Rust source files (*.rs) or Cargo.toml',
      rustFile.file_name
    );
  }

  // File existence checks
  const pkgJsonFile = files.find((f) => {
    const name = (f?.file_name || '').toLowerCase();
    return name === 'package.json' || name.endsWith('/package.json');
  });

  const pythonFile = files.find((f) => {
    const name = (f?.file_name || '').toLowerCase();
    return (
      name.endsWith('.py') ||
      name === 'requirements.txt' ||
      name.endsWith('/requirements.txt')
    );
  });

  // Rule 3: Python without package.json
  if (pythonFile && !pkgJsonFile) {
    return new DynamicRunnerResultImpl(
      'pytest',
      'python',
      'Detected Python source files without package.json',
      pythonFile.file_name
    );
  }

  // Rule 4: Node/Web with package.json present
  if (pkgJsonFile) {
    return new DynamicRunnerResultImpl(
      'npm test',
      'node',
      'Detected package.json manifest',
      pkgJsonFile.file_name
    );
  }

  // Rule 5: Fallback on tech stack / docker image keywords
  const isNodeOrWebStack =
    stackKeywords.some(
      (s) =>
        s.includes('node') ||
        s.includes('javascript') ||
        s.includes('typescript') ||
        s.includes('react') ||
        s.includes('vue')
    ) ||
    resolvedDockerImage.includes('node') ||
    resolvedDockerImage.includes('playwright');

  if (isNodeOrWebStack) {
    return new DynamicRunnerResultImpl(
      'npm test',
      'node',
      'Fallback: Stack or Docker image contains Node/Web keywords'
    );
  }

  // Default fallback
  return new DynamicRunnerResultImpl(
    'pytest',
    'python',
    'Fallback: Defaulted to pytest runner'
  );
}

/**
 * Creates a synthetic SystemDesignBlueprint for the unified integrated project.
 */
export function createIntegratedBlueprint(
  codebase: GeneratedCodeBase | null | undefined,
  decomposition?: ComponentDecomposition | null,
  dynamicTestCmd?: string | DynamicRunnerResult
): SystemDesignBlueprint {
  const filesList = codebase?.files || [];
  const testCmd = dynamicTestCmd
    ? String(dynamicTestCmd)
    : detectDynamicTestRunner(codebase, decomposition).runnerCommand;

  return {
    architecture_overview: 'Unified Integrated Architecture',
    tech_stack: decomposition?.shared_tech_stack || [],
    docker_image: decomposition?.shared_docker_image || 'python:3.11-slim',
    dev_server_command: 'NONE',
    dev_server_port: 0,
    run_tests_command: testCmd,
    files: filesList.map((f) => ({
      file_name: f.file_name,
      purpose: 'Integrated file',
      dependencies: [],
      pseudocode: '',
    })),
  };
}

/** Alias for createIntegratedBlueprint for compatibility */
export const createUnifiedBlueprint = createIntegratedBlueprint;
