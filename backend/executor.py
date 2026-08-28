import os
import tarfile
import io
import docker
from models import GeneratedCodeBase, ExecutionResult, SystemDesignBlueprint

def create_tar_from_codebase(codebase: GeneratedCodeBase) -> bytes:
    """Creates an in-memory tarball of the codebase to inject into the Docker container."""
    tar_stream = io.BytesIO()
    with tarfile.open(fileobj=tar_stream, mode='w') as tar:
        for file_obj in codebase.files:
            # We must handle paths with subdirectories carefully
            file_data = file_obj.source_code.encode('utf-8')
            tarinfo = tarfile.TarInfo(name=file_obj.file_name)
            tarinfo.size = len(file_data)
            tar.addfile(tarinfo, io.BytesIO(file_data))
    tar_stream.seek(0)
    return tar_stream.read()

def execute_code(codebase: GeneratedCodeBase, blueprint: SystemDesignBlueprint) -> ExecutionResult:
    """
    Spins up an isolated Docker container based on the blueprint,
    injects the generated source code into memory, executes tests,
    and returns the logs safely.
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
            
            # Format the test command
            run_tests_command = blueprint.run_tests_command
            
            # Auto-inject dependency installation to prevent 'command not found' errors
            has_package_json = any(f.file_name.lower() == 'package.json' for f in codebase.files)
            has_requirements_txt = any(f.file_name.lower() == 'requirements.txt' for f in codebase.files)
            
            if has_package_json and "npm install" not in run_tests_command:
                run_tests_command = f"npm install --no-audit --no-fund && {run_tests_command}"
            elif has_package_json:
                run_tests_command = run_tests_command.replace("npm install", "npm install --no-audit --no-fund")
                
            if has_requirements_txt and "pip install" not in run_tests_command:
                run_tests_command = f"pip install -r requirements.txt && {run_tests_command}"
                
            print(f"Executing docker command: {run_tests_command}")
            
            # Run the tests inside the isolated container
            # We use sh -c to ensure the whole logical string (&&) works
            exit_code, output = container.exec_run(
                cmd=f"sh -c '{run_tests_command}'",
                workdir="/workspace"
            )
            
            logs = output.decode('utf-8', errors='replace')
            success = (exit_code == 0)
            
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
