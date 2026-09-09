import os
import tarfile
import io
import threading
import docker
from models import GeneratedCodeBase, ExecutionResult, SystemDesignBlueprint

def create_tar_from_codebase(codebase: GeneratedCodeBase) -> bytes:
    """Creates an in-memory tarball of the codebase to inject into the Docker container."""
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

def resolve_test_runner_command(blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase) -> str:
    """
    Dynamically determines the appropriate test runner command based on the
    project's tech stack, file extensions, and Docker image, avoiding hardcoded mismatches.
    """
    raw_cmd = (blueprint.run_tests_command or "").strip()
    
    # Normalize tech stack keywords
    tech_stack_lower = [str(s).lower() for s in (blueprint.tech_stack or [])]
    docker_image_lower = (blueprint.docker_image or "").lower()
    
    has_package_json = any(f.file_name.lower() == 'package.json' for f in codebase.files)
    has_requirements_txt = any(f.file_name.lower() == 'requirements.txt' for f in codebase.files)
    has_js_files = any(f.file_name.lower().endswith(('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')) for f in codebase.files)
    has_py_files = any(f.file_name.lower().endswith('.py') for f in codebase.files)
    has_go_files = any(f.file_name.lower().endswith('.go') for f in codebase.files)
    has_rust_files = any(f.file_name.lower().endswith('.rs') for f in codebase.files)
    
    is_node_stack = (
        any(k in s for s in tech_stack_lower for k in ("node", "javascript", "typescript", "jest", "vitest", "npm", "react", "vue", "next", "express", "html", "css"))
        or "node" in docker_image_lower
        or (has_package_json and not has_py_files)
        or (has_js_files and not has_py_files)
    )
    
    is_python_stack = (
        any(k in s for s in tech_stack_lower for k in ("python", "pytest", "django", "flask", "fastapi"))
        or "python" in docker_image_lower
        or (has_requirements_txt and not has_js_files)
        or (has_py_files and not has_js_files)
    )
    
    is_go_stack = (
        any(k in s for s in tech_stack_lower for k in ("go", "golang"))
        or "golang" in docker_image_lower
        or has_go_files
    )

    is_rust_stack = (
        any(k in s for s in tech_stack_lower for k in ("rust", "cargo"))
        or "rust" in docker_image_lower
        or has_rust_files
    )

    # Determine base runner
    if is_node_stack and (not raw_cmd or raw_cmd.lower() == "pytest" or raw_cmd == "NONE"):
        base_cmd = "npm test"
    elif is_python_stack and (not raw_cmd or raw_cmd.lower() in ("npm test", "jest", "vitest", "vitest run", "npx vitest run") or raw_cmd == "NONE"):
        base_cmd = "pytest"
    elif is_go_stack and (not raw_cmd or raw_cmd.lower() in ("pytest", "npm test") or raw_cmd == "NONE"):
        base_cmd = "go test ./..."
    elif is_rust_stack and (not raw_cmd or raw_cmd.lower() in ("pytest", "npm test") or raw_cmd == "NONE"):
        base_cmd = "cargo test"
    elif raw_cmd and raw_cmd != "NONE":
        base_cmd = raw_cmd
    elif is_node_stack or has_package_json:
        base_cmd = "npm test"
    elif is_python_stack or has_requirements_txt or has_py_files:
        base_cmd = "pytest"
    else:
        base_cmd = "pytest"

    # Auto-inject dependency installation
    if has_package_json and "npm install" not in base_cmd:
        base_cmd = f"npm install --no-audit --no-fund && {base_cmd}"
    elif has_package_json and "npm install" in base_cmd and "--no-audit" not in base_cmd:
        base_cmd = base_cmd.replace("npm install", "npm install --no-audit --no-fund")

    # Guard against Playwright version mismatch
    if "playwright" in docker_image_lower:
        import re
        match = re.search(r"v(\d+\.\d+\.\d+)", docker_image_lower)
        if match:
            pw_version = match.group(1)
            # Override whatever npm installed from package.json with the exact version the container has browsers for
            base_cmd = base_cmd.replace("npm install", f"npm install && npm install @playwright/test@{pw_version} --no-audit --no-fund --save-exact", 1)

    if has_requirements_txt and "pip install" not in base_cmd:
        base_cmd = f"pip install -r requirements.txt && {base_cmd}"

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

def execute_code(codebase: GeneratedCodeBase, blueprint: SystemDesignBlueprint) -> ExecutionResult:
    """
    Spins up an isolated Docker container based on the blueprint,
    injects the generated source code into memory, executes tests dynamically
    based on the tech stack, and returns the logs safely.
    """
    print(f"Docker Executor is booting up image: {blueprint.docker_image}...")
    
    try:
        client = docker.from_env()
    except Exception as e:
        return ExecutionResult(success=False, logs=f"FATAL: Could not connect to Docker Daemon. Is Docker Desktop running?\nError: {e}")

    try:
        # Pull image if not exists
        try:
            client.images.get(blueprint.docker_image)
        except docker.errors.ImageNotFound:
            print(f"Pulling image {blueprint.docker_image} (this might take a moment)...")
            client.images.pull(blueprint.docker_image)

        # Create the container in a detached state running a dummy process to keep it alive
        container = client.containers.create(
            image=blueprint.docker_image,
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
            run_tests_command = resolve_test_runner_command(blueprint, codebase)
                
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
            print("Cleaning up Docker container...")
            container.stop(timeout=1)
            container.remove(force=True)
            
    except Exception as e:
        print(f"Docker execution error: {e}")
        return ExecutionResult(success=False, logs=f"Docker Sandbox execution failed: {str(e)}")
