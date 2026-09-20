import os
import tarfile
import io
import json
import threading
import docker
import re
import ast
from typing import Optional, List, Any
from models import GeneratedCodeBase, ExecutionResult, SystemDesignBlueprint, ComponentSpec, ComponentDecomposition
from golden_stacks import enforce_golden_dependencies, has_test_files, is_test_file
try:
    from golden_stacks import sanitize_python_source
except ImportError:
    sanitize_python_source = None

def is_python_test_file(file_name: str) -> bool:
    """Detects whether a file is an executable Python test file."""
    if not file_name or not isinstance(file_name, str):
        return False
    norm = file_name.replace('\\', '/').split('/')[-1].lower()
    if not norm.endswith('.py'):
        return False
    if norm.startswith('test_') or norm.endswith('_test.py'):
        return True
    return is_test_file(file_name)

def create_tar_from_codebase(codebase: GeneratedCodeBase) -> bytes:
    """Creates an in-memory tarball of the codebase to inject into the Docker container."""
    codebase = enforce_golden_dependencies(codebase)
    tar_stream = io.BytesIO()
    with tarfile.open(fileobj=tar_stream, mode='w') as tar:
        for file_obj in codebase.files:
            # Sanitize path to prevent absolute path extraction issues in Docker
            safe_name = file_obj.file_name.replace('\\', '/')
            if safe_name.startswith('./'):
                safe_name = safe_name[2:]
            safe_name = safe_name.lstrip('/')
            
            file_data = file_obj.source_code.encode('utf-8')
            tarinfo = tarfile.TarInfo(name=safe_name)
            tarinfo.size = len(file_data)
            tar.addfile(tarinfo, io.BytesIO(file_data))
    tar_stream.seek(0)
    return tar_stream.read()

def _coerce_dict(obj: Any) -> Optional[dict]:
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj
    if isinstance(obj, str):
        s = obj.strip()
        if s.startswith("{") and s.endswith("}"):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
    return None

def _extract_codebase_files(codebase: Any):
    if codebase is None:
        return []
    raw = getattr(codebase, 'files', None)
    if raw is None and isinstance(codebase, dict):
        raw = codebase.get('files', [])
    if not raw:
        return []
    class _FileProxy:
        def __init__(self, f):
            if isinstance(f, dict):
                self.file_name = f.get('file_name', '') or ''
                self.source_code = f.get('source_code', '') or ''
            else:
                self.file_name = getattr(f, 'file_name', '') or ''
                self.source_code = getattr(f, 'source_code', '') or ''
    return [_FileProxy(f) for f in raw]

def resolve_component_docker_image(
    component: Optional[Any] = None,
    decomposition: Optional[Any] = None,
    default: Optional[str] = None
) -> Optional[str]:
    """
    Resolves Docker image by checking component-specific override first,
    falling back to shared_docker_image from decomposition.
    """
    comp_dict = _coerce_dict(component)
    if component is not None:
        img = comp_dict.get("docker_image") if comp_dict is not None else getattr(component, "docker_image", None)
        if img and str(img).strip():
            return str(img).strip()
    decomp_dict = _coerce_dict(decomposition)
    if decomposition is not None:
        img = decomp_dict.get("shared_docker_image") if decomp_dict is not None else getattr(decomposition, "shared_docker_image", None)
        if img and str(img).strip():
            return str(img).strip()
    return default

def resolve_component_tech_stack(
    component: Optional[Any] = None,
    decomposition: Optional[Any] = None,
    default: Optional[List[str]] = None
) -> List[str]:
    """
    Resolves tech stack by checking component-specific override first,
    falling back to shared_tech_stack from decomposition.
    """
    comp_dict = _coerce_dict(component)
    if component is not None:
        stack = comp_dict.get("tech_stack") if comp_dict is not None else getattr(component, "tech_stack", None)
        if stack:
            cleaned = [str(s).strip() for s in stack if str(s).strip()]
            if cleaned:
                return cleaned
    decomp_dict = _coerce_dict(decomposition)
    if decomposition is not None:
        stack = decomp_dict.get("shared_tech_stack") if decomp_dict is not None else getattr(decomposition, "shared_tech_stack", None)
        if stack:
            cleaned = [str(s).strip() for s in stack if str(s).strip()]
            if cleaned:
                return cleaned
    return default or []

def resolve_tech_stack(
    component: Optional[Any] = None,
    decomposition: Optional[Any] = None,
    blueprint: Optional[SystemDesignBlueprint] = None,
    default: Optional[List[str]] = None,
) -> List[str]:
    """
    Resolves tech stack by checking component-specific field first
    (component.tech_stack or blueprint.tech_stack), falling back to
    shared_tech_stack from decomposition, and then default.
    """
    comp_dict = _coerce_dict(component)
    if component is not None:
        stack = comp_dict.get("tech_stack") if comp_dict is not None else getattr(component, "tech_stack", None)
        if stack:
            cleaned = [str(s).strip() for s in stack if str(s).strip()]
            if cleaned:
                return cleaned
    if blueprint is not None:
        bp_stack = getattr(blueprint, "tech_stack", None)
        if bp_stack:
            cleaned = [str(s).strip() for s in bp_stack if str(s).strip()]
            if cleaned:
                return cleaned
    decomp_dict = _coerce_dict(decomposition)
    if decomposition is not None:
        stack = decomp_dict.get("shared_tech_stack") if decomp_dict is not None else getattr(decomposition, "shared_tech_stack", None)
        if stack:
            cleaned = [str(s).strip() for s in stack if str(s).strip()]
            if cleaned:
                return cleaned
    return default or []

def resolve_docker_image(
    blueprint: Optional[SystemDesignBlueprint] = None,
    codebase: Optional[GeneratedCodeBase] = None,
    component: Optional[Any] = None,
    decomposition: Optional[Any] = None,
) -> str:
    """
    Resolves the appropriate Docker container image matching the codebase language runtime.
    Prevents running pure Python microservices in Node/Playwright containers or vice-versa.
    Guarantees that any component with Python test files or pytest test command resolves to python:3.11-slim.
    Checks component-specific docker_image first, falling back to blueprint.docker_image,
    shared_docker_image from decomposition, and codebase heuristics.
    """
    comp_dict = _coerce_dict(component)
    component_image = None
    if component is not None:
        img = comp_dict.get("docker_image") if comp_dict is not None else getattr(component, "docker_image", None)
        if img and str(img).strip():
            component_image = str(img).strip()

    decomp_dict = _coerce_dict(decomposition)
    shared_image = None
    if decomposition is not None:
        s_img = decomp_dict.get("shared_docker_image") if decomp_dict is not None else getattr(decomposition, "shared_docker_image", None)
        if s_img and str(s_img).strip():
            shared_image = str(s_img).strip()

    configured_image = (
        component_image
        or (blueprint.docker_image.strip() if (blueprint and blueprint.docker_image) else None)
        or shared_image
        or ""
    )
    image = configured_image.strip()
    image_lower = image.lower()
    raw_cmd = (blueprint.run_tests_command if blueprint else "").strip().lower()

    codebase_files = _extract_codebase_files(codebase)
    if not codebase_files:
        return image or "python:3.11-slim"

    has_package_json = any(f.file_name.lower() == 'package.json' for f in codebase_files)
    has_requirements_txt = any(f.file_name.lower() == 'requirements.txt' for f in codebase_files)
    has_js_files = any(f.file_name.lower().endswith(('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')) for f in codebase_files)
    has_py_files = any(f.file_name.lower().endswith('.py') for f in codebase_files)
    has_go_files = any(f.file_name.lower().endswith('.go') for f in codebase_files)
    has_rust_files = any(f.file_name.lower().endswith('.rs') for f in codebase_files)
    has_go_mod = any(f.file_name.lower() == 'go.mod' for f in codebase_files)
    has_cargo_toml = any(f.file_name.lower() == 'cargo.toml' for f in codebase_files)

    has_py_test_files = any(is_python_test_file(f.file_name) for f in codebase_files)
    is_pytest_cmd = bool(re.search(r'\b(pytest|python\d?)\b', raw_cmd))

    # Priority 1: If component contains Python test files OR test command invokes pytest/python,
    # resolve to a Python container image. If configured image is already a Python image, use it;
    # otherwise fallback to python:3.11-slim (to prevent running pytest in Node/Playwright containers).
    if has_py_test_files or is_pytest_cmd:
        if "python" in image_lower:
            return image
        return "python:3.11-slim"

    is_python_service = (has_py_files or has_requirements_txt) and not has_package_json and not has_go_files and not has_rust_files
    is_pure_node = (has_package_json or (has_js_files and not has_py_files)) and not has_py_files and not has_go_files and not has_rust_files
    is_go_service = (has_go_files or has_go_mod) and not has_py_files and not has_package_json
    is_rust_service = (has_rust_files or has_cargo_toml) and not has_py_files and not has_package_json

    if is_python_service and ("playwright" in image_lower or "node" in image_lower or "golang" in image_lower or "rust" in image_lower or not image):
        return "python:3.11-slim"

    if is_pure_node and ("python" in image_lower or "golang" in image_lower or "rust" in image_lower or not image):
        return "mcr.microsoft.com/playwright:v1.48.0-jammy"

    if is_go_service and ("python" in image_lower or "playwright" in image_lower or "node" in image_lower or "rust" in image_lower or not image):
        return "golang:1.22-bookworm"

    if is_rust_service and ("python" in image_lower or "playwright" in image_lower or "node" in image_lower or "golang" in image_lower or not image):
        return "rust:1.75-slim"

    return image or "python:3.11-slim"

def resolve_test_runner_command(
    blueprint: SystemDesignBlueprint,
    codebase: GeneratedCodeBase,
    component: Optional[Any] = None,
    decomposition: Optional[Any] = None,
) -> str:
    """
    Dynamically determines the appropriate test runner command based on the
    project's tech stack, file extensions, and Docker image, avoiding hardcoded mismatches.
    """
    raw_cmd = (blueprint.run_tests_command or "").strip() if blueprint else ""
    effective_image = resolve_docker_image(blueprint, codebase, component=component, decomposition=decomposition)
    docker_image_lower = effective_image.lower()
    
    # Normalize tech stack keywords (checking component/decomposition overrides first)
    resolved_stack = resolve_tech_stack(component=component, decomposition=decomposition, blueprint=blueprint)
    tech_stack_lower = [str(s).lower() for s in (resolved_stack or [])]
    
    # Docker image runtime capabilities
    is_python_image = "python" in docker_image_lower
    is_go_image = "golang" in docker_image_lower or "/go" in docker_image_lower
    is_rust_image = "rust" in docker_image_lower or "cargo" in docker_image_lower
    is_node_image = "node" in docker_image_lower or "playwright" in docker_image_lower or "bun" in docker_image_lower

    codebase_files = _extract_codebase_files(codebase)
    has_package_json = any(f.file_name.lower() == 'package.json' for f in codebase_files)
    has_lint_script = False
    has_test_script = False
    has_build_script = False
    if has_package_json:
        for f in codebase_files:
            if f.file_name.lower() == 'package.json':
                try:
                    import json
                    pkg = json.loads(f.source_code)
                    scripts = pkg.get('scripts', {})
                    if 'lint' in scripts:
                        has_lint_script = True
                    if 'test' in scripts:
                        has_test_script = True
                    if 'build' in scripts:
                        has_build_script = True
                except Exception:
                    pass
    has_requirements_txt = any(f.file_name.lower() == 'requirements.txt' for f in codebase_files)
    has_go_mod = any(f.file_name.lower() == 'go.mod' for f in codebase_files)
    has_cargo_toml = any(f.file_name.lower() == 'cargo.toml' for f in codebase_files)
    has_js_files = any(f.file_name.lower().endswith(('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')) for f in codebase_files)
    has_py_files = any(f.file_name.lower().endswith('.py') for f in codebase_files)
    has_go_files = any(f.file_name.lower().endswith('.go') for f in codebase_files)
    has_rust_files = any(f.file_name.lower().endswith('.rs') for f in codebase_files)
    
    is_pure_python = (has_py_files or has_requirements_txt) and not has_package_json and not has_go_files and not has_rust_files
    is_pure_node = (has_package_json or (has_js_files and not has_py_files)) and not has_py_files and not has_go_files and not has_rust_files

    # Match Go strictly with word boundaries to avoid false positives (e.g. google-generativeai, django, mongodb)
    is_go_keyword = any(bool(re.search(r'\b(go|golang)\b', s)) for s in tech_stack_lower)
    is_go_stack = (
        (has_go_files or has_go_mod)
        or (is_go_image and not has_py_files and not has_package_json)
        or (is_go_keyword and (has_go_files or has_go_mod or is_go_image))
    )

    # Match Rust strictly with word boundaries
    is_rust_keyword = any(bool(re.search(r'\b(rust|cargo)\b', s)) for s in tech_stack_lower)
    is_rust_stack = (
        (has_rust_files or has_cargo_toml)
        or (is_rust_image and not has_py_files and not has_package_json)
        or (is_rust_keyword and (has_rust_files or has_cargo_toml or is_rust_image))
    )

    is_node_stack = (
        not is_pure_python and (
            has_package_json
            or (has_js_files and not has_py_files)
            or (is_node_image and not has_py_files)
            or (any(bool(re.search(r'\b(node|javascript|typescript|jest|vitest|npm|react|vue|next|express)\b', s)) for s in tech_stack_lower) and (has_package_json or has_js_files or is_node_image))
        )
    )
    
    is_python_stack = (
        is_pure_python
        or any(bool(re.search(r'\b(python|pytest|django|flask|fastapi)\b', s)) for s in tech_stack_lower)
        or is_python_image
        or has_requirements_txt
        or has_py_files
    )

    tests_present = has_test_files(codebase)
    raw_cmd_lower = raw_cmd.lower()
    raw_has_build = bool(re.search(r'\bbuild\b', raw_cmd_lower))
    raw_is_node_cmd = bool(re.search(r'\b(npm|npx|vitest|jest|vite)\b', raw_cmd_lower))

    # Determine base runner
    has_py_test_files = any(is_python_test_file(f.file_name) for f in codebase_files)
    if (has_go_files or has_go_mod) and (is_go_stack or is_go_image or raw_cmd.startswith("go ")):
        base_cmd = raw_cmd if raw_cmd.startswith("go ") else "go test ./..."
    elif (has_rust_files or has_cargo_toml) and (is_rust_stack or is_rust_image or raw_cmd.startswith("cargo ")):
        base_cmd = raw_cmd if raw_cmd.startswith("cargo ") else "cargo test"
    elif has_py_test_files or (is_python_image and not is_node_stack) or raw_cmd_lower.startswith("pytest") or raw_cmd_lower == "pytest":
        base_cmd = raw_cmd if (raw_cmd and raw_cmd_lower != "none" and not raw_cmd.startswith("npm ")) else "pytest"
    elif is_pure_python or (has_py_files and not has_package_json):
        base_cmd = "pytest"
    elif is_node_stack or (has_package_json and not has_py_files):
        if raw_has_build:
            base_cmd = raw_cmd
        elif not tests_present and (has_build_script or not has_test_script):
            base_cmd = "npm run build"
        elif raw_is_node_cmd and raw_cmd_lower != "none":
            base_cmd = raw_cmd
        else:
            base_cmd = "npm test" if (tests_present or has_test_script) else "npm run build"
    elif (has_py_files or has_requirements_txt) and (raw_cmd_lower == "pytest" or is_python_stack):
        base_cmd = "pytest"
    elif raw_cmd and raw_cmd != "NONE":
        base_cmd = raw_cmd
    elif has_go_files or has_go_mod:
        base_cmd = "go test ./..."
    elif has_rust_files or has_cargo_toml:
        base_cmd = "cargo test"
    elif has_package_json or is_node_stack:
        base_cmd = "npm test" if (tests_present or has_test_script) else "npm run build"
    elif has_py_files or has_requirements_txt or is_python_stack:
        base_cmd = "pytest"
    else:
        base_cmd = "pytest"

    # Safety net: If base_cmd contains npm test but package.json has no test script,
    # or no test files exist in a frontend build stack, fallback to npm run build
    if has_package_json and "npm test" in base_cmd and (not has_test_script or not tests_present):
        if has_build_script or not tests_present:
            base_cmd = base_cmd.replace("npm test", "npm run build")

    # Runtime environment detection for dependency pre-flight injections
    # Check that the runner and container image are strictly compatible with package managers
    is_go_runner = base_cmd.startswith("go ") or "go test" in base_cmd
    is_rust_runner = base_cmd.startswith("cargo ") or "cargo test" in base_cmd
    is_node_runner = base_cmd.startswith("npm ") or base_cmd.startswith("npx ") or "vitest" in base_cmd or "jest" in base_cmd
    is_python_runner = base_cmd.startswith("pytest") or base_cmd.startswith("python")

    is_node_env = (
        (is_node_image or is_node_stack or is_node_runner)
        and not is_python_image
        and not is_go_image
        and not is_rust_image
        and not is_go_runner
        and not is_rust_runner
        and not is_python_runner
    )

    is_python_env = (
        (is_python_image or is_python_stack or is_python_runner)
        and not is_go_image
        and not is_rust_image
        and not is_node_image
        and not is_go_runner
        and not is_rust_runner
        and not is_node_runner
    )

    # Detect if command is a build command (redundant to run lint and prevents build abort on lint warnings)
    is_build_cmd = bool(re.search(r'\bbuild\b', raw_cmd, re.IGNORECASE)) or bool(re.search(r'\bbuild\b', base_cmd, re.IGNORECASE))
    should_lint = has_lint_script and not is_build_cmd

    # Auto-inject dependency installation and pre-flight static analysis ONLY in Node environments
    lint_injection = "npm run lint && " if should_lint else ""
    supertest_stub_cmd = "(mkdir -p node_modules/supertest node_modules/superagent && echo '{\"name\":\"supertest\",\"version\":\"6.3.4\",\"main\":\"index.js\",\"type\":\"module\"}' > node_modules/supertest/package.json 2>/dev/null && cp setupSupertest.js node_modules/supertest/index.js 2>/dev/null && echo '{\"name\":\"superagent\",\"version\":\"8.1.2\",\"main\":\"index.js\",\"type\":\"module\"}' > node_modules/superagent/package.json 2>/dev/null && cp setupSupertest.js node_modules/superagent/index.js 2>/dev/null || true) && "

    if is_node_env and has_package_json and "npm install" not in base_cmd:
        base_cmd = f"npm install --no-audit --no-fund && {supertest_stub_cmd}{lint_injection}{base_cmd}"
    elif is_node_env and has_package_json and "npm install" in base_cmd and "--no-audit" not in base_cmd:
        replacement = f"npm install --no-audit --no-fund && {supertest_stub_cmd}npm run lint" if should_lint else f"npm install --no-audit --no-fund && {supertest_stub_cmd}"
        base_cmd = base_cmd.replace("npm install", replacement)

    # Guard against Playwright version mismatch
    if "playwright" in docker_image_lower and "npm install" in base_cmd:
        match = re.search(r"v(\d+\.\d+\.\d+)", docker_image_lower)
        if match:
            pw_version = match.group(1)
            # Override whatever npm installed from package.json with the exact version the container has browsers for
            base_cmd = base_cmd.replace("npm install", f"npm install && npm install @playwright/test@{pw_version} --no-audit --no-fund --save-exact", 1)

    # Auto-inject Python dependencies ONLY in Python environments or when running pytest
    is_pytest_runner = "pytest" in base_cmd or is_python_runner
    if (is_python_env or is_pytest_runner) and not is_go_runner and not is_rust_runner and not is_node_runner and "pip install" not in base_cmd:
        pip_install_cmd = (
            "(pip install --break-system-packages pytest pytest-asyncio httpx -r requirements.txt 2>/dev/null || "
            "pip install pytest pytest-asyncio httpx -r requirements.txt 2>/dev/null || "
            "pip install --break-system-packages pytest pytest-asyncio httpx 2>/dev/null || "
            "pip install pytest pytest-asyncio httpx 2>/dev/null || "
            "python3 -m pip install --break-system-packages pytest pytest-asyncio httpx 2>/dev/null || "
            "true) && "
        )
        base_cmd = f"{pip_install_cmd}{base_cmd}"

    return base_cmd

def _exec_with_timeout(container, cmd: str, workdir: str = "/workspace", timeout_sec: float = 180.0):
    """Executes a command inside the container with a strict timeout limit to avoid blocking indefinitely."""
    result_holder = {}
    error_holder = []

    def target():
        try:
            result_holder["res"] = container.exec_run(cmd=cmd, workdir=workdir)
        except Exception as e:
            error_holder.append(e)

    th = threading.Thread(target=target, daemon=True)
    th.start()
    th.join(timeout=timeout_sec)

    if th.is_alive():
        return 124, f"TIMEOUT: Sandbox test execution exceeded timeout limit ({timeout_sec}s).".encode('utf-8')
    if error_holder:
        raise error_holder[0]
    res = result_holder.get("res")
    if res is None:
        return 1, b"Execution error: No response from container execution."
    return res.exit_code, res.output

def execute_code(
    codebase: GeneratedCodeBase,
    blueprint: SystemDesignBlueprint,
    timeout: int = 180,
    component: Optional[Any] = None,
    decomposition: Optional[Any] = None,
) -> ExecutionResult:
    """
    Spins up an isolated Docker container based on the blueprint,
    injects the generated source code into memory, executes tests dynamically
    based on the tech stack, and returns the logs safely.
    """
    codebase = enforce_golden_dependencies(codebase)

    # --- R3: In-Memory Pre-Flight Python AST Syntax Gate ---
    # Validate syntax of all Python files in-memory before invoking Docker daemon.
    # If unrecoverable syntax errors exist, fail fast with pinpointed error message.
    for file_obj in getattr(codebase, 'files', []):
        fname = file_obj.file_name if hasattr(file_obj, 'file_name') else file_obj.get('file_name', '')
        if fname.lower().endswith('.py'):
            source = file_obj.source_code if hasattr(file_obj, 'source_code') else file_obj.get('source_code', '')
            if sanitize_python_source is not None:
                try:
                    source = sanitize_python_source(source)
                    if hasattr(file_obj, 'source_code'):
                        file_obj.source_code = source
                    elif isinstance(file_obj, dict):
                        file_obj['source_code'] = source
                except Exception:
                    pass
            try:
                ast.parse(source, filename=fname)
            except SyntaxError as e:
                lineno = e.lineno or 1
                msg = e.msg or str(e)
                lines = source.splitlines()
                line_content = lines[lineno - 1] if 1 <= lineno <= len(lines) else (e.text.strip() if e.text else "")
                error_log = f"PYTHON SYNTAX ERROR in {fname} line {lineno}: {msg}\nLine: {line_content}"
                print(error_log)
                return ExecutionResult(success=False, logs=error_log)

    effective_docker_image = resolve_docker_image(blueprint, codebase, component=component, decomposition=decomposition)
    
    try:
        client = docker.from_env()
    except Exception as e:
        return ExecutionResult(success=False, logs=f"FATAL: Could not connect to Docker Daemon. Is Docker Desktop running?\nError: {e}")

    try:
        # Pull image if not exists
        try:
            client.images.get(effective_docker_image)
        except docker.errors.ImageNotFound:
            client.images.pull(effective_docker_image)

        # Create the container in a detached state running a dummy process to keep it alive
        container = client.containers.create(
            image=effective_docker_image,
            command="tail -f /dev/null",
            detach=True,
            working_dir="/workspace"
        )
        
        container.start()
        
        try:
            # Inject the source code
            tar_data = create_tar_from_codebase(codebase)
            container.put_archive("/workspace", tar_data)
            
            # Format the test command dynamically based on the project's tech stack
            run_tests_command = resolve_test_runner_command(blueprint, codebase, component=component, decomposition=decomposition)
                
            print(f"Executing docker command: {run_tests_command}")
            
            # Run the tests inside the isolated container with timeout protection
            # We use sh -c to ensure the whole logical string (&&) works
            exit_code, output = _exec_with_timeout(
                container,
                cmd=f"sh -c '{run_tests_command}'",
                workdir="/workspace",
                timeout_sec=180.0
            )
            
            if isinstance(output, bytes):
                logs = output.decode('utf-8', errors='replace')
            else:
                logs = str(output or "")
            success = (exit_code == 0)
            
            # --- SMOKE TEST PHASE (Proposal B) ---
            if success and blueprint.dev_server_command and str(blueprint.dev_server_command).strip().upper() != "NONE":
                print(f"Tests passed. Running Smoke Test for: {blueprint.dev_server_command}")
                # We start the server in the background, wait 4 seconds, and check if the PID is still alive.
                smoke_cmd = f"sh -c '{blueprint.dev_server_command} > smoke.log 2>&1 & PID=$!; sleep 4; kill -0 $PID 2>/dev/null; STATUS=$?; cat smoke.log; exit $STATUS'"
                smoke_exit, smoke_output = _exec_with_timeout(
                    container,
                    cmd=smoke_cmd,
                    workdir="/workspace",
                    timeout_sec=15.0
                )
                
                smoke_logs = smoke_output.decode('utf-8', errors='replace') if isinstance(smoke_output, bytes) else str(smoke_output or "")
                logs += f"\n\n--- SMOKE TEST LOGS ({blueprint.dev_server_command}) ---\n" + smoke_logs
                
                if smoke_exit != 0:
                    success = False
                    logs += "\nSMOKE TEST FAILED: The development server crashed immediately after starting."
                    print("Smoke test failed (server crashed).")
                else:
                    logs += "\nSMOKE TEST PASSED: The development server booted and stayed alive."
                    print("Smoke test passed.")
            
            print("Execution complete.")
            return ExecutionResult(success=success, logs=logs)
            
        finally:
            # Always clean up the container
            container.stop(timeout=1)
            container.remove(force=True)
            
    except Exception as e:
        print(f"Docker execution error: {e}")
        return ExecutionResult(success=False, logs=f"Docker Sandbox execution failed: {str(e)}")
