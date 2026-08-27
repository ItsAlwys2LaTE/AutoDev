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
                
        print(f"Executing sandbox command: {run_tests_command}")
        if run_tests_command.strip().upper() == "NONE":
            return ExecutionResult(success=True, logs="Static files generated successfully. No automated unit tests required for this stack.")
            
        try:
            process = subprocess.run(
                run_tests_command,
                shell=True,
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=20
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
            return ExecutionResult(success=False, logs="Execution timed out after 15 seconds.")
        except Exception as e:
            print(f"Sandbox error: {e}")
            return ExecutionResult(success=False, logs=f"Sandbox execution failed: {str(e)}")
