import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from executor import resolve_test_runner_command, execute_code, create_tar_from_codebase
from models import GeneratedCodeBase, CodeFile, SystemDesignBlueprint, ExecutionResult

class TestDynamicTestRunnerResolution(unittest.TestCase):
    def test_node_js_stack_resolves_to_npm_test(self):
        blueprint = SystemDesignBlueprint(
            architecture_overview="Node app",
            tech_stack=["Node.js", "Express", "Jest"],
            docker_image="node:20-alpine",
            dev_server_command="npm start",
            dev_server_port=3000,
            run_tests_command="pytest",  # Hardcoded mismatch from agent
            files=[]
        )
        codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="package.json", purpose="deps", source_code='{"scripts": {"test": "jest"}}'),
            CodeFile(file_name="app.test.js", purpose="tests", source_code="test('adds 1 + 2', () => {});")
        ])

        resolved_cmd = resolve_test_runner_command(blueprint, codebase)
        # Should dynamically override pytest to npm test and auto-inject npm install
        self.assertIn("npm test", resolved_cmd)
        self.assertIn("npm install --no-audit --no-fund", resolved_cmd)
        self.assertNotIn("pytest", resolved_cmd)

    def test_python_stack_resolves_to_pytest(self):
        blueprint = SystemDesignBlueprint(
            architecture_overview="Python app",
            tech_stack=["Python", "FastAPI"],
            docker_image="python:3.11-slim",
            dev_server_command="uvicorn main:app",
            dev_server_port=8000,
            run_tests_command="npm test",  # Mismatch
            files=[]
        )
        codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="requirements.txt", purpose="deps", source_code="fastapi\npytest\n"),
            CodeFile(file_name="test_main.py", purpose="tests", source_code="def test_sample(): assert True")
        ])

        resolved_cmd = resolve_test_runner_command(blueprint, codebase)
        self.assertIn("pytest", resolved_cmd)
        self.assertIn("pip install -r requirements.txt", resolved_cmd)
        self.assertNotIn("npm", resolved_cmd)

    def test_static_html_js_stack_resolves_to_npm_test(self):
        blueprint = SystemDesignBlueprint(
            architecture_overview="HTML/CSS/JS frontend",
            tech_stack=["HTML", "CSS", "JavaScript"],
            docker_image="node:20-alpine",
            dev_server_command="python -m http.server 8080",
            dev_server_port=8080,
            run_tests_command="",
            files=[]
        )
        codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="package.json", purpose="deps", source_code='{"devDependencies": {"jest": "^29.0.0"}}'),
            CodeFile(file_name="index.html", purpose="ui", source_code="<div>Hello</div>"),
            CodeFile(file_name="app.test.js", purpose="test", source_code="test('dom', () => {});")
        ])

        resolved_cmd = resolve_test_runner_command(blueprint, codebase)
        self.assertIn("npm test", resolved_cmd)
        self.assertIn("npm install --no-audit --no-fund", resolved_cmd)

    def test_custom_valid_command_preserved(self):
        blueprint = SystemDesignBlueprint(
            architecture_overview="Custom test runner",
            tech_stack=["Python", "pytest"],
            docker_image="python:3.11-slim",
            dev_server_command="python main.py",
            dev_server_port=5000,
            run_tests_command="pytest -v -k test_integration --tb=short",
            files=[]
        )
        codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="requirements.txt", purpose="deps", source_code="pytest\n"),
            CodeFile(file_name="test_integration.py", purpose="test", source_code="def test_int(): pass")
        ])

        resolved_cmd = resolve_test_runner_command(blueprint, codebase)
        self.assertIn("pytest -v -k test_integration --tb=short", resolved_cmd)
        self.assertIn("pip install -r requirements.txt", resolved_cmd)

    def test_tarball_generation(self):
        codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="src/index.js", purpose="main", source_code="console.log('hi');"),
            CodeFile(file_name="\\windows\\path\\file.py", purpose="win", source_code="print('win')")
        ])
        tar_bytes = create_tar_from_codebase(codebase)
        self.assertIsInstance(tar_bytes, bytes)
        self.assertGreater(len(tar_bytes), 0)


class TestDockerExecutionPipelineMock(unittest.TestCase):
    @patch("executor.docker.from_env")
    def test_execute_code_docker_pipeline_successful_run(self, mock_docker_from_env):
        mock_client = MagicMock()
        mock_docker_from_env.return_value = mock_client

        mock_container = MagicMock()
        mock_client.containers.create.return_value = mock_container
        # exec_run returns (exit_code, output_bytes)
        mock_container.exec_run.return_value = (0, b"================ 5 passed in 0.42s ================")

        blueprint = SystemDesignBlueprint(
            architecture_overview="Node test",
            tech_stack=["Node.js", "Jest"],
            docker_image="node:20-alpine",
            dev_server_command="npm start",
            dev_server_port=3000,
            run_tests_command="npm test",
            files=[]
        )
        codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="package.json", purpose="deps", source_code='{}'),
            CodeFile(file_name="test_app.js", purpose="test", source_code='test("a", () => {});')
        ])

        result = execute_code(codebase, blueprint)

        self.assertTrue(result.success)
        self.assertIn("5 passed", result.logs)
        mock_container.start.assert_called_once()
        mock_container.stop.assert_called_once()
        mock_container.remove.assert_called_once_with(force=True)

    @patch("executor.docker.from_env")
    def test_execute_code_docker_pipeline_failure_logs(self, mock_docker_from_env):
        mock_client = MagicMock()
        mock_docker_from_env.return_value = mock_client

        mock_container = MagicMock()
        mock_client.containers.create.return_value = mock_container
        mock_container.exec_run.return_value = (1, b"FAIL: test_calculator_divide_by_zero AssertionError")

        blueprint = SystemDesignBlueprint(
            architecture_overview="Python app",
            tech_stack=["Python", "pytest"],
            docker_image="python:3.11-slim",
            dev_server_command="python app.py",
            dev_server_port=8000,
            run_tests_command="pytest",
            files=[]
        )
        codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="test_app.py", purpose="test", source_code='def test_fail(): assert False')
        ])

        result = execute_code(codebase, blueprint)

        self.assertFalse(result.success)
        self.assertIn("FAIL: test_calculator_divide_by_zero", result.logs)
        mock_container.stop.assert_called_once()
        mock_container.remove.assert_called_once_with(force=True)


if __name__ == "__main__":
    unittest.main()
