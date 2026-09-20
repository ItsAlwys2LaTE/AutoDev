"""
backend/agents/revision_extractor.py - Broken File Identification Engine.

Part of AutoDev's Differential Targeted Revision & Surgical Patching Architecture.
Parses test execution logs (pytest, vitest, jest, in-memory AST syntax gate, bundler/compiler errors)
and Critic reports to isolate the minimal set of failing files, reconcile against the active
codebase file tree, resolve missing dependency manifests, and generate compact architectural manifests.
"""

from typing import List, Optional, Union, Any, Set, Dict
import ast
import os
import posixpath
import re
import sys
from pydantic import BaseModel, Field

# Ensure models module can be imported across various invocation contexts
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from models import CodeFile, GeneratedCodeBase, SystemDesignBlueprint, FileBlueprint
except ImportError:
    try:
        from backend.models import CodeFile, GeneratedCodeBase, SystemDesignBlueprint, FileBlueprint
    except ImportError:
        CodeFile = Any  # type: ignore
        GeneratedCodeBase = Any  # type: ignore
        SystemDesignBlueprint = Any  # type: ignore
        FileBlueprint = Any  # type: ignore


# ---------------------------------------------------------------------------
# Standard Library / Built-in Constants
# ---------------------------------------------------------------------------

PYTHON_STDLIB_MODULES: Set[str] = getattr(sys, "stdlib_module_names", set()) or {
    "abc", "argparse", "array", "ast", "asyncio", "base64", "bisect", "builtins",
    "bz2", "calendar", "cmath", "cmd", "code", "codecs", "collections", "colorsys",
    "compileall", "concurrent", "configparser", "contextlib", "contextvars", "copy",
    "copyreg", "cProfile", "csv", "ctypes", "curses", "dataclasses", "datetime",
    "dbm", "decimal", "difflib", "dis", "distutils", "doctest", "email", "encodings",
    "enum", "errno", "faulthandler", "fcntl", "filecmp", "fileinput", "fnmatch",
    "fractions", "ftplib", "functools", "gc", "getopt", "getpass", "gettext", "glob",
    "graphlib", "gzip", "hashlib", "heapq", "hmac", "html", "http", "imaplib",
    "imghdr", "imp", "importlib", "inspect", "io", "ipaddress", "itertools", "json",
    "keyword", "linecache", "locale", "logging", "lzma", "mailbox", "mailcap",
    "marshal", "math", "mimetypes", "mmap", "modulefinder", "multiprocessing",
    "netrc", "nntplib", "numbers", "operator", "optparse", "os", "pathlib", "pdb",
    "pickle", "pickletools", "pkgutil", "platform", "plistlib", "poplib", "posix",
    "pprint", "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr", "pydoc",
    "queue", "quopri", "random", "re", "readline", "reprlib", "resource", "rlcompleter",
    "runpy", "sched", "secrets", "select", "selectors", "shelve", "shlex", "shutil",
    "signal", "site", "smtpd", "smtplib", "sndhdr", "socket", "socketserver", "sqlite3",
    "ssl", "stat", "statistics", "string", "stringprep", "struct", "subprocess",
    "sunau", "symtable", "sys", "sysconfig", "syslog", "tabnanny", "tarfile", "telnetlib",
    "tempfile", "termios", "test", "textwrap", "threading", "time", "timeit", "tkinter",
    "token", "tokenize", "trace", "traceback", "tracemalloc", "tty", "turtle",
    "turtledemo", "types", "typing", "unicodedata", "unittest", "urllib", "uu",
    "uuid", "venv", "warnings", "wave", "weakref", "webbrowser", "wsgiref", "xdrlib",
    "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo"
}

NODE_STDLIB_MODULES: Set[str] = {
    "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
    "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
    "events", "fs", "fs/promises", "http", "http2", "https", "inspector", "module",
    "net", "os", "path", "path/posix", "path/win32", "perf_hooks", "process",
    "punycode", "querystring", "readline", "repl", "stream", "stream/consumers",
    "stream/promises", "stream/web", "string_decoder", "sys", "timers",
    "timers/promises", "tls", "trace_events", "tty", "url", "util", "util/types",
    "v8", "vm", "wasi", "worker_threads", "zlib"
}

# ---------------------------------------------------------------------------
# Regular Expression Patterns & Escape Stripping
# ---------------------------------------------------------------------------

# ANSI terminal escape sequence pattern (ECMA-48 CSI and 2-byte sequences)
RE_ANSI_ESCAPE = re.compile(r'\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')


def strip_ansi(text: str) -> str:
    """Strips ANSI terminal color and cursor escape sequences from text."""
    if not text:
        return ""
    return RE_ANSI_ESCAPE.sub("", text)


# JavaScript / TypeScript Grammar & Component Detection Patterns
JS_RESERVED_KEYWORDS: Set[str] = {
    "function", "class", "async", "default", "interface", "abstract",
    "enum", "type", "new", "const", "let", "var", "import", "export",
    "return", "throw", "typeof", "void", "null", "undefined", "true", "false",
    "yield", "await", "extends", "implements", "static", "this",
    "case", "catch", "continue", "debugger", "do", "else", "finally",
    "for", "if", "in", "instanceof", "switch", "try", "while", "with",
}

REACT_IMPORT_PATTERN = re.compile(
    r'''(?x)
    (?:
        \bimport\s+[\s\S]*?\s+from\s+['"]react(?:-[a-z]+|/[a-z]+)?['"]
      | \brequire\s*\(\s*['"]react(?:-[a-z]+|/[a-z]+)?['"]\s*\)
      | \bfrom\s+['"]react(?:-[a-z]+|/[a-z]+)?['"]
      | \bReact\.(?:Component|PureComponent|memo|forwardRef|useState|useEffect|createElement)\b
    )
    '''
)

JSX_MARKUP_PATTERN = re.compile(
    r'''(?x)
    (?<![A-Za-z0-9_$])
    (?:
        <[A-Z][A-Za-z0-9_]*\b(?:\s+[^>]*?|\s*)(?:/?>)
      | </[A-Za-z0-9_.]+>
      | <(?:div|span|button|p|a|input|form|section|header|footer|nav|main|ul|ol|li|table|tr|td|h[1-6])\b(?:\s+[^>]*?|\s*)(?:/?>)
      | </?>
    )
    '''
)

# AST Pre-flight syntax error from backend/executor.py
AST_SYNTAX_ERROR_PATTERN = re.compile(
    r'PYTHON SYNTAX ERROR in\s+([^\s:]+)\s+line\s+\d+',
    re.IGNORECASE
)

# Pytest session failures / errors: FAILED {file}::{test} or ERROR {file}::{test}
PYTEST_FAILED_ERROR_PATTERN = re.compile(
    r'(?:^|\s)(?:FAILED|ERROR)\s+([^\s:]+?\.py)::',
    re.MULTILINE
)

# Pytest collection errors: ERROR collecting {file}
PYTEST_COLLECTING_PATTERN = re.compile(
    r'(?:^|\s)ERROR\s+collecting\s+([^\s:]+?\.py)',
    re.MULTILINE
)

# Python standard traceback lines: File "{file}", line {lineno}
PY_TRACEBACK_PATTERN = re.compile(
    r'File\s+["\']([^"\']+\.py)["\'],\s+line\s+\d+',
    re.IGNORECASE
)

# Pytest short traceback pointer: {file}:{line}: in {func}
PYTEST_SHORT_TRACEBACK_PATTERN = re.compile(
    r'^\s*([a-zA-Z0-9_./\\-]+\.py):(?:\d+):',
    re.MULTILINE
)

# Standard Python SyntaxError: SyntaxError: ... ({file}, line {lineno})
PY_SYNTAX_ERROR_PATTERN = re.compile(
    r'SyntaxError:.*?\(([^,()]+\.py),\s*line',
    re.IGNORECASE
)

# Vitest / Jest suite failures: FAIL {file}
JS_FAIL_HEADER_PATTERN = re.compile(
    r'(?:^|\s)FAIL\s+([^\s()]+\.(?:jsx?|tsx?|mjs|cjs|vue|svelte))',
    re.MULTILINE
)

# Vitest pointer lines: ❯ {file}:{line}:{col}
VITEST_POINTER_PATTERN = re.compile(
    r'❯\s+([^\s():]+\.(?:jsx?|tsx?|mjs|cjs|vue|svelte|py)):(?:\d+)',
    re.MULTILINE
)

# Node / V8 stack trace pointer lines: at {file}:{line}:{col}
JS_STACK_AT_PATTERN = re.compile(
    r'(?:^|\s+)at\s+(?:async\s+)?(?:.+?\s+\()?(?:file:\/\/)?([^\s():\'\"]+\.(?:jsx?|tsx?|mjs|cjs|vue|svelte|py)):(?:\d+)',
    re.MULTILINE
)

# Vite esbuild & compiler transform errors
VITE_TRANSFORM_PATTERN = re.compile(
    r'(?:\[vite:[^\]]+\]\s+)?Transform failed.*?:\s*([^\s:]+\.(?:jsx?|tsx?|mjs|cjs|css|html|vue|svelte))',
    re.IGNORECASE
)

# Import origin lines: from '{file}' or in '{file}'
JS_IMPORT_ORIGIN_PATTERN = re.compile(
    r'(?:from|in)\s+["\']([^"\'\s]+\.(?:jsx?|tsx?|mjs|cjs|html|css|py))["\']',
    re.IGNORECASE
)

# Rollup unresolved import error: Could not resolve '...' from '{file}'
ROLLUP_RESOLVE_ORIGIN_PATTERN = re.compile(
    r'Could not resolve\s+["\'][^"\']+["\']\s+from\s+["\']([^"\']+)["\']',
    re.IGNORECASE
)

# Critic report file reference patterns
CRITIC_FILE_PATTERNS = [
    # Quoted filenames: 'auth.py', "src/components/Login.tsx", `app/main.py`
    re.compile(r'[\'"`]([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)[\'"`]'),
    # Prefixed filenames: File: app.py, In auth.py, From src/api.ts
    re.compile(r'(?:[Ff]ile|[Ii]n|[Ff]rom|[Aa]t)\s+([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)'),
    # Diagnostic colon references: user_service.py: line 52, routes/api.py:45
    re.compile(r'([a-zA-Z0-9_./\\-]+\.(?:py|jsx?|tsx?|json|html|css|yaml|yml|sql|ini|toml|sh)):(?:(?:\s*line\s*\d+)|\d+)'),
    # Bare filenames with standard source extensions
    re.compile(r'\b([a-zA-Z0-9_./\\-]+\.(?:py|jsx?|tsx?|json|html|css|yaml|yml|sql|ini|toml|sh))\b'),
]

# System / 3rd party false positive path substrings and anchored root prefixes
SYSTEM_SUBSTRINGS = (
    "site-packages",
    "dist-packages",
    "node_modules/",
    ".venv/",
    "venv/",
    "__pycache__/",
    "<frozen",
    "<string>",
    "<stdin>",
    "<unknown>",
    "python3.",
)

SYSTEM_ROOT_PREFIXES = (
    "/usr/",
    "/usr/lib/",
    "/usr/local/lib/",
    "/lib/",
    "/lib64/",
    "/etc/",
    "/var/",
    "/opt/",
    "/proc/",
    "/sys/",
    "/dev/",
    "usr/",
    "lib64/",
)

SYSTEM_PREFIXES = SYSTEM_ROOT_PREFIXES + SYSTEM_SUBSTRINGS

INVALID_EXTENSIONS = {"com", "org", "net", "io", "gov", "edu"}
FALSE_POSITIVE_WORDS = {"e.g.", "i.e.", "etc.", "v1.0", "v2.0", "v3.0"}

# Missing module patterns for dependency manifests
RE_PY_MODULE_NOT_FOUND = re.compile(
    r"ModuleNotFoundError:\s+No module named\s+['\"]([a-zA-Z0-9_.]+)['\"]"
)
RE_PY_IMPORT_FROM = re.compile(
    r"ImportError:\s+cannot import name\s+['\"][^'\"]+['\"]\s+from\s+(?:partially initialized module\s+)?['\"]([a-zA-Z0-9_.]+)['\"]"
)
RE_PY_IMPORT_NO_MODULE = re.compile(
    r"ImportError:\s+No module named\s+['\"]([a-zA-Z0-9_.]+)['\"]"
)

RE_NODE_FAILED_LOAD_URL = re.compile(
    r"Failed to load url\s+([^\s()]+)"
)
RE_NODE_CANNOT_FIND_MODULE = re.compile(
    r"Cannot find module\s+['\"]([^'\"]+)['\"]"
)
RE_NODE_FAILED_RESOLVE_IMPORT = re.compile(
    r"Failed to resolve import\s+['\"]([^'\"]+)['\"]"
)
RE_NODE_COULD_NOT_RESOLVE = re.compile(
    r"Could not resolve\s+['\"]([^'\"]+)['\"]"
)

# Known configuration files
KNOWN_CONFIG_BASENAMES: Set[str] = {
    "package.json", "package-lock.json", "npm-shrinkwrap.json",
    "yarn.lock", "pnpm-lock.yaml",
    "requirements.txt", "pipfile", "pipfile.lock", "poetry.lock",
    "pyproject.toml", "setup.py", "setup.cfg",
    "pytest.ini", "tox.ini", ".coveragerc",
    "vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs",
    "vitest.config.js", "vitest.config.ts", "vitest.config.mjs", "vitest.config.cjs",
    "jest.config.js", "jest.config.ts", "jest.config.json",
    "tsconfig.json", "tsconfig.node.json", "tsconfig.app.json", "jsconfig.json",
    "tailwind.config.js", "tailwind.config.ts", "postcss.config.js", "postcss.config.cjs",
    "eslint.config.js", ".eslintrc", ".eslintrc.json", ".eslintrc.js", ".prettierrc",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".dockerignore", ".gitignore",
    "setuptests.ts", "setuptests.js", "setupsupertest.js",
}

ENTRY_POINT_BASENAMES: Set[str] = {
    "main.py", "app.py", "server.py", "run.py", "api.py", "wsgi.py", "asgi.py", "__main__.py",
    "index.html",
    "main.tsx", "main.jsx", "main.ts", "main.js",
    "index.tsx", "index.jsx", "index.ts", "index.js",
    "app.tsx", "app.jsx", "app.ts", "app.js",
    "server.js", "server.ts",
}

KNOWN_CONFIG_ROLES: Dict[str, str] = {
    "package.json": "Project manifest defining dependencies and build scripts",
    "package-lock.json": "NPM dependency lock file",
    "yarn.lock": "Yarn dependency lock file",
    "pnpm-lock.yaml": "PNPM dependency lock file",
    "requirements.txt": "Python pip dependencies and package pins",
    "pytest.ini": "Pytest runner configuration and test settings",
    "setup.cfg": "Python package setup configuration",
    "tox.ini": "Tox test environment configuration",
    "tsconfig.json": "TypeScript compiler configuration",
    "tsconfig.node.json": "TypeScript Node environment configuration",
    "tsconfig.app.json": "TypeScript application configuration",
    "index.html": "Main HTML entry point mounting application root",
    "dockerfile": "Docker container runtime definition",
    "docker-compose.yml": "Docker Compose orchestration specification",
    "docker-compose.yaml": "Docker Compose orchestration specification",
    "setuptests.ts": "Test environment setup and browser API polyfill mocks",
    "setuptests.js": "Test environment setup and browser API polyfill mocks",
}


# ---------------------------------------------------------------------------
# Metadata Model
# ---------------------------------------------------------------------------

class ExtractionMetadata(BaseModel):
    """Structured telemetry returned by extract_broken_files_with_metadata."""
    broken_files: List[str] = Field(default_factory=list, description="List of files to include in differential revision")
    is_fallback: bool = Field(default=False, description="True if fallback mechanism was engaged, False if specifically isolated")
    trigger_reason: str = Field(default="", description="Reason: 'specific_log_match', 'empty_logs', 'timeout', 'unparseable_logs', 'critic_match', 'clean_pass'")


# ---------------------------------------------------------------------------
# Path Normalization & False-Positive Filtering
# ---------------------------------------------------------------------------

def _normalize_path(path: str) -> str:
    """Normalizes path separators, collapses traversals, strips container roots, and trims punctuation."""
    if not path:
        return ""
    p = str(path).replace("\\", "/").strip().strip("\"'`").rstrip(":")
    # Strip drive letter e.g. C: or c:
    if len(p) >= 2 and p[1] == ":" and p[0].isalpha():
        p = p[2:]

    # Collapse traversals with posixpath.normpath
    p = posixpath.normpath(p)
    if p == ".":
        return ""

    changed = True
    while changed:
        changed = False
        for prefix in ("/workspace/", "workspace/", "/app/", "./", "/"):
            if p.lower().startswith(prefix):
                p = p[len(prefix):]
                changed = True

    # Strip any remaining leading traversal components like ../
    while p.startswith(("../", "./")):
        if p.startswith("../"):
            p = p[3:]
        elif p.startswith("./"):
            p = p[2:]

    if p == ".":
        return ""
    return p


def _is_false_positive(candidate: str) -> bool:
    """Detects system paths, stdlib modules, node_modules, and non-code tokens with exact prefix anchoring."""
    if not candidate:
        return True
    c_lower = candidate.lower()
    # 1. Universal substring filters
    if any(sub in c_lower for sub in SYSTEM_SUBSTRINGS):
        return True
    # 2. Root-anchored system prefixes
    if c_lower.startswith(SYSTEM_ROOT_PREFIXES):
        return True
    # 3. Known false-positive phrases
    if c_lower in FALSE_POSITIVE_WORDS:
        return True
    # 4. Non-code tokens without extension or web domains
    base = os.path.basename(candidate)
    if "." not in base:
        return True
    ext = base.rsplit(".", 1)[-1].lower()
    if ext in INVALID_EXTENSIONS:
        return True
    return False


def _extract_file_list(codebase: Any) -> List[Any]:
    """Gracefully extracts file objects from List[CodeFile], GeneratedCodeBase, or List[dict]."""
    if codebase is None:
        return []
    if hasattr(codebase, "files"):
        return codebase.files or []
    if isinstance(codebase, (list, tuple)):
        return list(codebase)
    return []


def _get_filename(file_obj: Any) -> str:
    """Returns filename string from CodeFile or dict."""
    if hasattr(file_obj, "file_name"):
        return file_obj.file_name or ""
    if isinstance(file_obj, dict):
        return file_obj.get("file_name", "") or ""
    return str(file_obj) if file_obj else ""


def _get_source_code(file_obj: Any) -> str:
    """Returns source_code string from CodeFile or dict."""
    if hasattr(file_obj, "source_code"):
        return file_obj.source_code or ""
    if isinstance(file_obj, dict):
        return file_obj.get("source_code", "") or ""
    return ""


def _is_test_file(file_name: str) -> bool:
    """Detects test files across Python, JavaScript, and TypeScript naming conventions."""
    norm = _normalize_path(file_name).lower()
    base = os.path.basename(norm)
    if base.startswith("test_") and base.endswith(".py"):
        return True
    if base.endswith("_test.py"):
        return True
    if re.search(r'\.(?:test|spec)\.[jt]sx?$', base):
        return True
    if "/tests/" in f"/{norm}/" or "/test/" in f"/{norm}/" or "/__tests__/" in f"/{norm}/":
        return True
    return False


def is_config_file(file_name: str) -> bool:
    """Determines whether a file is a configuration, lock, or environment setup file."""
    norm = _normalize_path(file_name).lower()
    base = os.path.basename(norm)
    if base in KNOWN_CONFIG_BASENAMES:
        return True
    if base.startswith(".") and not base.endswith((".js", ".ts", ".py")):
        return True
    if base.endswith((".ini", ".lock", ".toml")):
        return True
    if re.search(r'\.config\.[jt]sx?$', base):
        return True
    if base.startswith("tsconfig") and base.endswith(".json"):
        return True
    return False


def is_entry_point(file_name: str) -> bool:
    """Determines whether a file is an application main entry point."""
    norm = _normalize_path(file_name).lower()
    base = os.path.basename(norm)
    if base in ENTRY_POINT_BASENAMES:
        return True
    if norm in {
        "src/app.tsx", "src/app.jsx", "src/main.tsx", "src/main.jsx",
        "src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js",
        "src/server.ts", "src/server.js"
    }:
        return True
    return False


# ---------------------------------------------------------------------------
# 4-Tier Tree Matching Algorithm
# ---------------------------------------------------------------------------

def _match_candidate_to_codebase(
    candidate: str,
    codebase: List[Any]
) -> List[str]:
    """
    Reconciles a candidate string against the codebase tree using 4 tiers:
    1. Direct exact match
    2. Case-insensitive match
    3. Suffix / Subpath match
    4. Basename match with disambiguation
    Returns original CodeFile.file_name strings.
    """
    cand_norm = _normalize_path(candidate)
    if not cand_norm or _is_false_positive(cand_norm):
        return []

    cb_entries = []
    for f in codebase:
        orig = _get_filename(f)
        if orig:
            cb_entries.append((orig, _normalize_path(orig)))

    # Tier 1: Direct exact match
    for orig, norm in cb_entries:
        if cand_norm == norm:
            return [orig]

    # Tier 2: Case-insensitive match
    for orig, norm in cb_entries:
        if cand_norm.lower() == norm.lower():
            return [orig]

    # Tier 3: Suffix / Subpath match
    tier3 = []
    for orig, norm in cb_entries:
        if norm.lower().endswith("/" + cand_norm.lower()) or cand_norm.lower().endswith("/" + norm.lower()):
            tier3.append(orig)
    if tier3:
        return tier3

    # Tier 4: Basename match with common suffix disambiguation
    cand_base = os.path.basename(cand_norm).lower()
    tier4 = []
    for orig, norm in cb_entries:
        if os.path.basename(norm).lower() == cand_base:
            tier4.append(orig)
    if tier4:
        if len(tier4) > 1:
            tier4.sort(
                key=lambda o: len(os.path.commonprefix([_normalize_path(o).lower()[::-1], cand_norm.lower()[::-1]])),
                reverse=True
            )
            return [tier4[0]]
        return tier4

    return []


# ---------------------------------------------------------------------------
# Critic Report Extraction Helper
# ---------------------------------------------------------------------------

def _extract_critic_text(critic_report: Optional[Union[dict, list, str, Any]]) -> List[str]:
    """Collects all descriptive text fields from critic reports or adjudicator decisions."""
    if not critic_report:
        return []

    texts: List[str] = []
    if isinstance(critic_report, str):
        texts.append(critic_report)
    elif isinstance(critic_report, list):
        for item in critic_report:
            texts.extend(_extract_critic_text(item))
    elif isinstance(critic_report, dict):
        if "issues_list" in critic_report:
            issues = critic_report["issues_list"]
            if isinstance(issues, list):
                for issue in issues:
                    if isinstance(issue, str):
                        texts.append(issue)
                    elif isinstance(issue, dict):
                        for k in ("description", "issue", "comment", "file", "filename"):
                            if k in issue and issue[k]:
                                texts.append(str(issue[k]))
            elif isinstance(issues, str):
                texts.append(issues)
        if "overall_comments" in critic_report and isinstance(critic_report["overall_comments"], str):
            texts.append(critic_report["overall_comments"])
        if "revision_plan" in critic_report and isinstance(critic_report["revision_plan"], str):
            texts.append(critic_report["revision_plan"])
    elif hasattr(critic_report, "model_dump") or hasattr(critic_report, "__dict__"):
        data = critic_report.model_dump() if hasattr(critic_report, "model_dump") else critic_report.__dict__
        texts.extend(_extract_critic_text(data))

    return texts


# ---------------------------------------------------------------------------
# Missing Dependency Manifest Resolution
# ---------------------------------------------------------------------------

def _build_codebase_indices(files: List[Any]):
    """Builds lookup structures for codebase files to distinguish local code from external modules."""
    file_names: List[str] = []
    py_stems: Set[str] = set()
    py_dirs: Set[str] = set()
    py_dotted_paths: Set[str] = set()
    node_stems: Set[str] = set()
    node_paths: Set[str] = set()

    for f in files:
        fname = _get_filename(f)
        if not fname:
            continue
        file_names.append(fname)
        norm = _normalize_path(fname)
        norm_lower = norm.lower()
        parts = norm_lower.split("/")
        base_with_ext = parts[-1]
        stem, ext = os.path.splitext(base_with_ext)

        # Record directory hierarchy
        for i in range(len(parts) - 1):
            py_dirs.add(parts[i])
            py_dirs.add("/".join(parts[:i + 1]))

        if ext in (".py", ".pyw"):
            py_stems.add(stem)
            dotted = norm_lower.rsplit(".", 1)[0].replace("/", ".")
            py_dotted_paths.add(dotted)
            dot_parts = dotted.split(".")
            for j in range(len(dot_parts)):
                py_dotted_paths.add(".".join(dot_parts[j:]))
        elif ext in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".html", ".css"):
            node_stems.add(stem)
            node_stems.add(base_with_ext)
            node_paths.add(norm_lower)
            node_paths.add(norm_lower.rsplit(".", 1)[0])

    return {
        "file_names": file_names,
        "py_stems": py_stems,
        "py_dirs": py_dirs,
        "py_dotted_paths": py_dotted_paths,
        "node_stems": node_stems,
        "node_paths": node_paths,
    }


def _is_local_python_module(pkg: str, indices: dict) -> bool:
    """Returns True if the Python package/module is an internal local file or standard library."""
    clean_pkg = pkg.strip()
    if not clean_pkg:
        return False
    if clean_pkg.startswith("."):
        return True

    pkg_lower = clean_pkg.lower()
    root_mod = pkg_lower.split(".")[0]

    if root_mod in PYTHON_STDLIB_MODULES:
        return True
    if root_mod in indices["py_stems"]:
        return True
    if root_mod in indices["py_dirs"]:
        return True
    if pkg_lower in indices["py_dotted_paths"]:
        return True

    return False


def _is_local_node_module(specifier: str, indices: dict) -> bool:
    """Returns True if the Node specifier is an internal relative/aliased import or built-in."""
    clean_spec = specifier.strip().strip("'\"")
    if not clean_spec:
        return False

    if clean_spec.startswith(("./", "../", "/")):
        return True
    if clean_spec.startswith(("@/", "~/", "#/")):
        return True
    if clean_spec.startswith("node:"):
        return True
    if clean_spec.lower() in NODE_STDLIB_MODULES:
        return True

    spec_lower = clean_spec.lower()
    if spec_lower in indices["node_stems"] or spec_lower in indices["node_paths"]:
        return True

    for p in indices["node_paths"]:
        if p.endswith("/" + spec_lower) or p == spec_lower:
            return True

    return False


def _find_codebase_manifest(manifest_name: str, file_names: List[str]) -> Optional[str]:
    """Finds exact manifest filename in codebase files (case-insensitive basename match)."""
    target = manifest_name.lower()
    for fname in file_names:
        norm = _normalize_path(fname)
        base = os.path.basename(norm).lower()
        if base == target:
            return fname
    return None


def _is_manifest_in_broken(manifest_filename: str, broken_files: List[str]) -> bool:
    """Checks if manifest is already present in broken_files list."""
    if not broken_files:
        return False
    target_base = os.path.basename(_normalize_path(manifest_filename)).lower()
    for bf in broken_files:
        if not bf:
            continue
        bf_base = os.path.basename(_normalize_path(bf)).lower()
        if bf_base == target_base:
            return True
    return False


def should_include_manifest(
    broken_files: List[str],
    test_output: str,
    codebase: List[CodeFile]
) -> List[str]:
    """
    Inspects test execution logs for missing third-party dependencies across
    Python and Node/JS/TS environments and returns a list of manifest file names
    (e.g., 'requirements.txt', 'package.json') that should be appended to broken_files.

    Returns:
        List[str]: Manifest file names from codebase to add, strictly deduplicated.
    """
    if not test_output or not isinstance(test_output, str):
        return []

    clean_output = strip_ansi(test_output)
    safe_broken_files = list(broken_files) if broken_files is not None else []
    files = _extract_file_list(codebase)
    if not files:
        return []

    indices = _build_codebase_indices(files)
    manifests_to_add: List[str] = []

    # 1. Python missing dependency detection
    missing_py_packages: Set[str] = set()
    for match in RE_PY_MODULE_NOT_FOUND.finditer(clean_output):
        missing_py_packages.add(match.group(1).strip())
    for match in RE_PY_IMPORT_FROM.finditer(clean_output):
        missing_py_packages.add(match.group(1).strip())
    for match in RE_PY_IMPORT_NO_MODULE.finditer(clean_output):
        missing_py_packages.add(match.group(1).strip())

    has_external_py_missing = False
    for pkg in missing_py_packages:
        if not _is_local_python_module(pkg, indices):
            has_external_py_missing = True
            break

    if has_external_py_missing:
        req_file = _find_codebase_manifest("requirements.txt", indices["file_names"])
        if req_file and not _is_manifest_in_broken(req_file, safe_broken_files):
            if req_file not in manifests_to_add:
                manifests_to_add.append(req_file)

    # 2. Node / JS / TS missing dependency detection
    missing_node_specifiers: Set[str] = set()
    for match in RE_NODE_FAILED_LOAD_URL.finditer(clean_output):
        missing_node_specifiers.add(match.group(1).strip())
    for match in RE_NODE_CANNOT_FIND_MODULE.finditer(clean_output):
        missing_node_specifiers.add(match.group(1).strip())
    for match in RE_NODE_FAILED_RESOLVE_IMPORT.finditer(clean_output):
        missing_node_specifiers.add(match.group(1).strip())
    for match in RE_NODE_COULD_NOT_RESOLVE.finditer(clean_output):
        missing_node_specifiers.add(match.group(1).strip())

    has_external_node_missing = False
    for spec in missing_node_specifiers:
        if not _is_local_node_module(spec, indices):
            has_external_node_missing = True
            break

    if has_external_node_missing:
        pkg_file = _find_codebase_manifest("package.json", indices["file_names"])
        if pkg_file and not _is_manifest_in_broken(pkg_file, safe_broken_files):
            if pkg_file not in manifests_to_add:
                manifests_to_add.append(pkg_file)

    return manifests_to_add


# ---------------------------------------------------------------------------
# Fallback Resolution Engine
# ---------------------------------------------------------------------------

FAILURE_KEYWORDS = (
    "failed",
    "fail",
    "error",
    "syntaxerror",
    "transform failed",
    "timeout",
    "exit code",
    "killed",
    "segmentation fault",
    "traceback",
)


def _has_failure_indicator(
    test_output: str,
    critic_report: Optional[Union[dict, list, str, Any]] = None
) -> bool:
    """
    Determines whether test execution output or critic reports indicate an actual failure.
    Returns False for clean passing runs without errors or critic feedback.
    """
    output_str = strip_ansi(test_output or "")
    # 1. Empty or whitespace-only logs indicate missing runner or premature process exit
    if not output_str.strip():
        return True
    # 2. Timeout marker from Sandbox Docker executor
    if re.search(r'TIMEOUT:\s+Sandbox test execution exceeded', output_str, re.IGNORECASE):
        return True
    # 3. Known failure keywords in test output
    output_lower = output_str.lower()
    if any(kw in output_lower for kw in FAILURE_KEYWORDS):
        return True
    # 4. Critic or adjudicator report presence
    if bool(critic_report):
        return True
    return False


def resolve_fallback_files(
    codebase: Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]]
) -> List[str]:
    """
    Fallback mechanism when test output is empty, timed out, or unparseable,
    and no specific broken file could be isolated from logs or Critic reports.

    Rules:
      - Small codebases (<= 4 files): Return all non-config application and test files.
      - Large codebases (> 4 files): Return main entry points + all test suites.
    """
    files = _extract_file_list(codebase)
    file_names: List[str] = []
    for f in files:
        fn = _get_filename(f)
        if fn:
            file_names.append(fn)

    if not file_names:
        return []

    total_files = len(file_names)
    non_config_files = [fn for fn in file_names if not is_config_file(fn)]

    # Branch 1: <= 4 files -> return all non-config files
    if total_files <= 4:
        return non_config_files if non_config_files else file_names

    # Branch 2: > 4 files -> return main entry points + test files
    entry_and_tests = [
        fn for fn in file_names
        if is_entry_point(fn) or _is_test_file(fn)
    ]
    if entry_and_tests:
        return entry_and_tests

    # Secondary fallback if no standard entry points or tests matched
    return non_config_files[:3] if non_config_files else file_names[:3]


def is_fallback_mode(
    test_output: str,
    critic_report: Optional[Union[dict, list, str, Any]] = None,
    codebase: Optional[Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]]] = None,
) -> bool:
    """Returns True if test output is empty, timed out, or unparseable, and critic report contains no file names."""
    clean_output = strip_ansi(test_output or "")
    specific = extract_broken_files(clean_output, critic_report, codebase, allow_fallback=False)
    if specific:
        return False
    return _has_failure_indicator(clean_output, critic_report)


# ---------------------------------------------------------------------------
# Codebase Manifest Generator
# ---------------------------------------------------------------------------

def _get_well_known_role(file_name: str) -> Optional[str]:
    """Returns standard architectural summary for canonical config and asset files."""
    norm = _normalize_path(file_name)
    base = os.path.basename(norm).lower()

    if base in KNOWN_CONFIG_ROLES:
        return KNOWN_CONFIG_ROLES[base]
    if re.search(r'^vite\.config\.[jt]sx?$', base):
        return "Vite bundler and dev server configuration"
    if re.search(r'^vitest\.config\.[jt]sx?$', base):
        return "Vitest test runner configuration"
    if re.search(r'^jest\.config\.[jt]sx?$', base):
        return "Jest test runner configuration"
    if re.search(r'^tailwind\.config\.[jt]sx?$', base):
        return "Tailwind CSS configuration"
    if re.search(r'^postcss\.config\.[jt]sx?$', base):
        return "PostCSS styling pipeline configuration"
    if base.endswith((".css", ".scss", ".sass")):
        return "Styling rules and UI presentation styles"
    if base.endswith(".html"):
        return "HTML markup template"
    if base.endswith(".md"):
        return "Project documentation"
    if base.endswith(".json"):
        return "JSON data and application configuration"
    return None


def _summarize_python_file(file_name: str, source_code: str) -> str:
    """Summarizes a Python file via AST inspection with resilient regex fallback."""
    if not source_code or not source_code.strip():
        if _is_test_file(file_name):
            return "Pytest test suite"
        return "Empty Python module"

    try:
        tree = ast.parse(source_code, filename=file_name)

        # 1. Module docstring
        doc = ast.get_docstring(tree)
        if doc:
            first_line = [line.strip() for line in doc.splitlines() if line.strip()]
            if first_line:
                clean_doc = re.sub(r"^[#*\-\s]+", "", first_line[0]).strip()
                if clean_doc:
                    return clean_doc[:100]

        # 2. Classes and functions
        classes = [node.name for node in tree.body if isinstance(node, ast.ClassDef)]
        functions = [
            node.name for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]

        if classes and functions:
            return f"Defines classes: {', '.join(classes[:3])}; functions: {', '.join(functions[:4])}"
        elif classes:
            return f"Defines classes: {', '.join(classes[:4])}"
        elif functions:
            return f"Defines functions: {', '.join(functions[:5])}"

        # 3. Top-level variable assignments
        assignments = [
            target.id for node in tree.body if isinstance(node, ast.Assign)
            for target in node.targets if isinstance(target, ast.Name)
        ]
        if assignments:
            return f"Configuration module defining {', '.join(assignments[:4])}"

        if _is_test_file(file_name):
            return "Pytest unit test suite"
        return "Python module"

    except Exception:
        # Regex fallback for files with syntax errors
        m_doc = re.search(r'^\s*(?:"""|\'\'\')(.*?)(?:"""|\'\'\')', source_code, re.DOTALL)
        if m_doc:
            doc_lines = [line.strip() for line in m_doc.group(1).splitlines() if line.strip()]
            if doc_lines:
                clean_doc = re.sub(r"^[#*\-\s]+", "", doc_lines[0]).strip()
                if clean_doc:
                    return clean_doc[:100]

        classes = re.findall(r'^\s*class\s+([A-Za-z0-9_]+)', source_code, re.MULTILINE)
        functions = re.findall(r'^\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)', source_code, re.MULTILINE)
        if classes or functions:
            parts = []
            if classes:
                parts.append(f"classes: {', '.join(classes[:3])}")
            if functions:
                parts.append(f"functions: {', '.join(functions[:4])}")
            return f"Defines {'; '.join(parts)}"

        if _is_test_file(file_name):
            return "Pytest unit test suite"
        return "Python source file"


def _summarize_jsts_file(file_name: str, source_code: str) -> str:
    """Summarizes a JavaScript or TypeScript file via header and export regex parsing."""
    if not source_code or not source_code.strip():
        if _is_test_file(file_name):
            return "Unit and integration test suite"
        return "Empty JavaScript/TypeScript module"

    if _is_test_file(file_name):
        return "Unit and integration test suite"

    # 1. JSDoc header comment
    m_header = re.search(r'^\s*/\*\*\s*([\s\S]*?)\*/', source_code)
    if m_header:
        header_lines = [
            re.sub(r'^[#*\-\s]+', '', line).strip()
            for line in m_header.group(1).splitlines()
            if line.strip()
        ]
        non_empty = [l for l in header_lines if l and not l.startswith('@')]
        if non_empty:
            return non_empty[0][:100]

    # 2. Export symbol extraction
    m_def_decl = re.search(
        r'export\s+default\s+(?:(?:async\s+)?function(?:\s*\*)?|(?:abstract\s+)?class|interface)\s+([A-Za-z0-9_$]+)',
        source_code,
    )
    m_def_inst = re.search(
        r'export\s+default\s+(?:new\s+|(?:React\.)?(?:memo|forwardRef)\s*\(\s*)([A-Za-z0-9_$]+)',
        source_code,
    )
    m_def_id = re.search(r'export\s+default\s+([A-Za-z0-9_$]+)', source_code)

    default_export_name: Optional[str] = None
    if m_def_decl and m_def_decl.group(1) and m_def_decl.group(1) not in JS_RESERVED_KEYWORDS:
        default_export_name = m_def_decl.group(1)
    elif m_def_inst and m_def_inst.group(1) and m_def_inst.group(1) not in JS_RESERVED_KEYWORDS:
        default_export_name = m_def_inst.group(1)
    elif m_def_id and m_def_id.group(1) and m_def_id.group(1) not in JS_RESERVED_KEYWORDS:
        default_export_name = m_def_id.group(1)

    named = re.findall(
        r'export\s+(?:const|let|var|(?:async\s+)?function(?:\s*\*)?|class|interface|type|enum)\s+([A-Za-z0-9_$]+)',
        source_code,
    )
    export_clauses = re.findall(r'export\s*\{\s*([^}]+)\s*\}', source_code)
    for clause in export_clauses:
        for t in clause.split(","):
            token = t.strip().split(" as ")[-1].strip()
            if token and token not in JS_RESERVED_KEYWORDS:
                named.append(token)

    seen = set()
    unique_named = [
        x for x in named
        if x not in JS_RESERVED_KEYWORDS and not (x in seen or seen.add(x))
    ]

    # 3. React component heuristic
    has_jsx_ext = file_name.lower().endswith(('.jsx', '.tsx'))
    has_react_import = bool(REACT_IMPORT_PATTERN.search(source_code))
    has_jsx_markup = bool(JSX_MARKUP_PATTERN.search(source_code))

    is_react_context = has_jsx_ext or has_react_import or has_jsx_markup

    is_react = False
    if is_react_context:
        if (
            (default_export_name and default_export_name[0].isupper())
            or has_jsx_markup
            or has_jsx_ext
            or (unique_named and any(n[0].isupper() for n in unique_named))
        ):
            is_react = True

    if is_react:
        component_name = (
            (default_export_name if (default_export_name and default_export_name[0].isupper()) else None)
            or next((n for n in unique_named if n[0].isupper()), None)
            or default_export_name
            or os.path.splitext(os.path.basename(file_name))[0]
        )
        return f"React component {component_name}"

    if default_export_name:
        return f"Default export: {default_export_name}"

    if unique_named:
        return f"Exports {', '.join(unique_named[:4])}"

    return "JavaScript/TypeScript module"


def generate_codebase_manifest(
    codebase: Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]],
    blueprint: Optional[Union[SystemDesignBlueprint, Dict[str, Any], Any]] = None,
) -> str:
    """
    Generates a compact, 1-line-per-file architectural manifest for the codebase.
    Used in differential revision prompts to maintain global architectural context.
    """
    raw_files = _extract_file_list(codebase)
    if not raw_files:
        return ""

    # Build Tier 1 Blueprint lookup maps
    bp_map: Dict[str, str] = {}
    bp_basename_map: Dict[str, str] = {}

    if blueprint:
        bp_files = []
        if isinstance(blueprint, dict):
            bp_files = blueprint.get("files") or []
        elif hasattr(blueprint, "files"):
            bp_files = getattr(blueprint, "files") or []

        for bp in bp_files:
            bp_name = getattr(bp, "file_name", None) or (bp.get("file_name") if isinstance(bp, dict) else None)
            bp_purpose = getattr(bp, "purpose", None) or (bp.get("purpose") if isinstance(bp, dict) else None)
            if bp_name and bp_purpose:
                clean_p = " ".join(str(bp_purpose).split()).strip()
                if clean_p:
                    bp_map[_normalize_path(bp_name).lower()] = clean_p[:110]
                    bp_basename_map[os.path.basename(_normalize_path(bp_name)).lower()] = clean_p[:110]

    manifest_lines: List[str] = []

    for item in raw_files:
        fname = _get_filename(item)
        source = _get_source_code(item)
        if not fname:
            continue

        norm_fname = _normalize_path(fname).lower()
        base_norm = os.path.basename(norm_fname)

        # Tier 1: Blueprint Fast-Path
        if norm_fname in bp_map:
            role = bp_map[norm_fname]
        elif base_norm in bp_basename_map:
            role = bp_basename_map[base_norm]
        # Tier 4 Fast-Check: Well-Known Configs
        elif _get_well_known_role(fname) is not None:
            role = _get_well_known_role(fname)
        # Tier 2: Python AST Parsing
        elif norm_fname.endswith((".py", ".pyw")):
            role = _summarize_python_file(fname, source)
        # Tier 3: JS/TS Regex Parsing
        elif norm_fname.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")):
            role = _summarize_jsts_file(fname, source)
        # General Fallback
        else:
            role = "Test suite" if _is_test_file(fname) else "Source file"

        clean_role = " ".join(str(role).split()).strip()
        manifest_lines.append(f"- {fname}: {clean_role}")

    return "\n".join(manifest_lines)


# ---------------------------------------------------------------------------
# Primary Function: extract_broken_files
# ---------------------------------------------------------------------------

def extract_broken_files(
    test_output: str,
    critic_report: Optional[Union[dict, list, str, Any]] = None,
    codebase: Optional[Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]]] = None,
    allow_fallback: bool = True,
) -> List[str]:
    """
    Extracts the minimal set of broken/failing file paths from test execution logs
    and critic reports, reconciled against the active codebase file tree.

    Parameters:
        test_output: Combined stdout and stderr from test execution.
        critic_report: Feedback report from Critic agents or Adjudicator.
        codebase: Active codebase files for 4-tier tree reconciliation.
        allow_fallback: Whether to engage fallback mechanisms if no broken file is isolated.

    Returns:
        List[str]: Minimal deduplicated list of broken file paths from codebase.
    """
    candidates: Set[str] = set()
    output_str = strip_ansi(test_output or "")

    # 1. In-memory AST pre-flight syntax gate
    for m in AST_SYNTAX_ERROR_PATTERN.finditer(output_str):
        candidates.add(m.group(1))

    # 2. Pytest log patterns
    for m in PYTEST_FAILED_ERROR_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in PYTEST_COLLECTING_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in PY_TRACEBACK_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in PYTEST_SHORT_TRACEBACK_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in PY_SYNTAX_ERROR_PATTERN.finditer(output_str):
        candidates.add(m.group(1))

    # 3. Vitest & Jest log patterns
    for m in JS_FAIL_HEADER_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in VITEST_POINTER_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in JS_STACK_AT_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in VITE_TRANSFORM_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in JS_IMPORT_ORIGIN_PATTERN.finditer(output_str):
        candidates.add(m.group(1))
    for m in ROLLUP_RESOLVE_ORIGIN_PATTERN.finditer(output_str):
        candidates.add(m.group(1))

    # 4. Critic report extraction
    critic_texts = _extract_critic_text(critic_report)
    for text in critic_texts:
        for pat in CRITIC_FILE_PATTERNS:
            for m in pat.finditer(text):
                f = m.group(1)
                if f:
                    candidates.add(f)

    matched_files: List[str] = []
    seen: Set[str] = set()

    if codebase is not None:
        raw_files = _extract_file_list(codebase)

        # 5. Reconcile candidates via 4-tier tree matching
        for cand in candidates:
            matches = _match_candidate_to_codebase(cand, raw_files)
            for m in matches:
                if m not in seen:
                    seen.add(m)
                    matched_files.append(m)

        # 6. Augment with dependency manifests if external modules missing
        manifests = should_include_manifest(matched_files, output_str, raw_files)
        for m in manifests:
            if m not in seen:
                seen.add(m)
                matched_files.append(m)

        # 7. Fallback resolution when no broken files were isolated
        if not matched_files and allow_fallback:
            if _has_failure_indicator(output_str, critic_report):
                return resolve_fallback_files(raw_files)

        return matched_files

    # If codebase is None, return deduplicated cleaned candidates
    for cand in candidates:
        norm = _normalize_path(cand)
        if norm and not _is_false_positive(norm) and norm not in seen:
            seen.add(norm)
            matched_files.append(norm)

    return matched_files


# ---------------------------------------------------------------------------
# Telemetry Function: extract_broken_files_with_metadata
# ---------------------------------------------------------------------------

def extract_broken_files_with_metadata(
    test_output: str,
    critic_report: Optional[Union[dict, list, str, Any]] = None,
    codebase: Optional[Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]]] = None,
    allow_fallback: bool = True,
) -> ExtractionMetadata:
    """
    Extracts broken files and returns structured metadata indicating whether
    fallback mode was triggered and the specific trigger reason.
    """
    output_str = strip_ansi(test_output or "")
    is_empty = not output_str.strip()
    is_timeout = bool(re.search(r'TIMEOUT:\s+Sandbox test execution exceeded', output_str, re.IGNORECASE))

    # 1. Attempt specific extraction without fallback
    specific = extract_broken_files(output_str, critic_report, codebase, allow_fallback=False)

    if specific:
        reason = "critic_match" if (is_empty and critic_report) else "specific_log_match"
        return ExtractionMetadata(broken_files=specific, is_fallback=False, trigger_reason=reason)

    # 2. Clean Pass Validation: If no specific files were matched and no failure occurred, return clean_pass
    if not _has_failure_indicator(output_str, critic_report):
        return ExtractionMetadata(broken_files=[], is_fallback=False, trigger_reason="clean_pass")

    # 3. Determine failure trigger reason for fallback
    reason = "timeout" if is_timeout else ("empty_logs" if is_empty else "unparseable_logs")

    if not allow_fallback or not codebase:
        return ExtractionMetadata(broken_files=[], is_fallback=False, trigger_reason=reason)

    # 4. Engage fallback resolution
    fallback_files = resolve_fallback_files(codebase)
    return ExtractionMetadata(broken_files=fallback_files, is_fallback=True, trigger_reason=reason)
