import os
import subprocess
import tempfile
import sys
from models import GeneratedCodeBase, ExecutionResult

def execute_code(codebase: GeneratedCodeBase, run_tests_command: str) -> ExecutionResult:
    """
    Creates a temporary directory, writes all generated code files into it,
    runs the dynamically provided test command against the directory, and captures the results.
    """
    print("Sandbox Executor is booting up...")
    
    # We use a temporary directory that automatically cleans itself up
    with tempfile.TemporaryDirectory() as temp_dir:
        
        print(f"Writing {len(codebase.files)} files to temporary workspace: {temp_dir}")
        for file_obj in codebase.files:
            file_path = os.path.join(temp_dir, file_obj.file_name)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(file_obj.source_code)
                
        # Auto-inject dependency installation to prevent 'command not found' errors
        has_package_json = any(f.file_name.lower() == 'package.json' for f in codebase.files)
        has_requirements_txt = any(f.file_name.lower() == 'requirements.txt' for f in codebase.files)
        
        if has_package_json and "npm install" not in run_tests_command:
            run_tests_command = f"npm install --no-audit --no-fund && {run_tests_command}"
        elif has_package_json:
            # Optimize existing npm install to avoid slow audits
            run_tests_command = run_tests_command.replace("npm install", "npm install --no-audit --no-fund")
            
        if has_requirements_txt and "pip install" not in run_tests_command:
            run_tests_command = f"{sys.executable} -m pip install -r requirements.txt && {run_tests_command}"
            
        print(f"Executing sandbox command: {run_tests_command}")
        
        try:
            process = subprocess.run(
                run_tests_command,
                shell=True,
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=90
            )
            
            success = process.returncode == 0
            logs = process.stdout
            if process.stderr:
                logs += f"\n\nSTDERR:\n{process.stderr}"
                
            if process.returncode != 0 and not logs.strip():
                logs = "Command failed with no output."
                
            print("Execution complete.")
            return ExecutionResult(success=success, logs=logs)
            
        except subprocess.TimeoutExpired:
            print("Execution timed out!")
            return ExecutionResult(success=False, logs="Execution timed out after 90 seconds. A process (like npm install) took too long, or a test entered an infinite loop.")
        except Exception as e:
            print(f"Sandbox error: {e}")
            return ExecutionResult(success=False, logs=f"Sandbox execution failed: {str(e)}")
