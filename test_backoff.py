import os
import sys
import unittest
from unittest.mock import MagicMock, patch, call

# Ensure backend is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import google.api_core.exceptions as g_exc
from retry import with_exponential_backoff, is_transient_error
from models import (
    RequirementsDocument,
    SystemDesignBlueprint,
    FileBlueprint,
    GeneratedCodeBase,
    CodeFile,
    ExecutionResult,
    CriticFeedback,
    AdjudicatorDecision,
    ComponentDecomposition,
    ComponentSpec,
)
from agents.requirements_agent import generate_requirements_stream
from agents.design_agent import generate_design_stream
from agents.codegen_agent import generate_code_stream
from agents.critics import evaluate_correctness, evaluate_completeness, evaluate_architecture
from agents.documentation_agent import generate_documentation_stream
from agents.integrator_agent import generate_integration_stream
from agents.master_architect import decompose_requirements_stream
from orchestrator import node_adjudicator


def make_dummy_requirements():
    return RequirementsDocument(
        project_title="Test App",
        overview="A test application",
        user_stories=[],
    )


def make_dummy_blueprint():
    return SystemDesignBlueprint(
        architecture_overview="Modular architecture",
        tech_stack=["Python", "pytest"],
        docker_image="python:3.11-slim",
        dev_server_command="NONE",
        dev_server_port=0,
        run_tests_command="pytest",
        files=[
            FileBlueprint(
                file_name="main.py",
                purpose="Main application logic",
                dependencies=[],
                pseudocode="def main(): pass",
            )
        ],
    )


def make_dummy_codebase():
    return GeneratedCodeBase(
        files=[
            CodeFile(
                file_name="main.py",
                source_code="def main(): return True",
            )
        ]
    )


def make_dummy_decomposition():
    return ComponentDecomposition(
        is_complex=True,
        project_overview="Modular system",
        shared_tech_stack=["Python"],
        shared_docker_image="python:3.11-slim",
        integration_strategy="Direct import",
        components=[],
    )


class TestExponentialBackoffDecorator(unittest.TestCase):
    """
    Direct unit tests for the @with_exponential_backoff decorator.
    """

    @patch("time.sleep")
    def test_transient_error_retries_and_succeeds_on_3rd_attempt(self, mock_sleep):
        """
        Acceptance Criteria:
        Objectively proves that the decorator retries 2 times and succeeds on the 3rd attempt.
        Delays should be 1.0s then 2.0s.
        """
        call_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def sample_llm_call():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise g_exc.ServiceUnavailable(f"503 Service Unavailable (attempt {call_count})")
            return "SUCCESS_RESPONSE"

        result = sample_llm_call()

        self.assertEqual(result, "SUCCESS_RESPONSE")
        self.assertEqual(call_count, 3, "Should have been called exactly 3 times (1 initial + 2 retries)")
        self.assertEqual(mock_sleep.call_count, 2, "time.sleep should have been called 2 times")
        mock_sleep.assert_has_calls([call(1.0), call(2.0)])

    @patch("time.sleep")
    def test_transient_error_fails_4_times_and_bubbles_up(self, mock_sleep):
        """
        Acceptance Criteria:
        Objectively proves that if the mock fails 4 times in a row, the decorator
        correctly bubbles up the exception. Delays should be 1.0s, 2.0s, 4.0s.
        """
        call_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def sample_llm_call():
            nonlocal call_count
            call_count += 1
            raise g_exc.ServiceUnavailable(f"503 Service Unavailable (attempt {call_count})")

        with self.assertRaises(g_exc.ServiceUnavailable):
            sample_llm_call()

        self.assertEqual(call_count, 4, "Should have attempted 4 times (1 initial + 3 retries) before raising")
        self.assertEqual(mock_sleep.call_count, 3, "time.sleep should have been called 3 times")
        mock_sleep.assert_has_calls([call(1.0), call(2.0), call(4.0)])

    @patch("time.sleep")
    def test_resource_exhausted_429_retried(self, mock_sleep):
        """
        Verifies that 429 ResourceExhausted is also recognized as transient and retried.
        """
        call_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def sample_429_call():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise g_exc.ResourceExhausted("429 Resource Exhausted")
            return "RECOVERED_FROM_429"

        result = sample_429_call()
        self.assertEqual(result, "RECOVERED_FROM_429")
        self.assertEqual(call_count, 2)
        mock_sleep.assert_called_once_with(1.0)

    @patch("time.sleep")
    def test_permanent_error_not_retried(self, mock_sleep):
        """
        Verifies that permanent errors (e.g. invalid api key or invalid argument)
        fail immediately without burning retry attempts or sleeping.
        """
        call_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0)
        def sample_permanent_error():
            nonlocal call_count
            call_count += 1
            raise ValueError("invalid_api_key provided")

        with self.assertRaises(ValueError):
            sample_permanent_error()

        self.assertEqual(call_count, 1, "Permanent error must abort on the 1st attempt")
        mock_sleep.assert_not_called()

    @patch("time.sleep")
    def test_generator_stream_retries_on_initial_iteration_and_succeeds(self, mock_sleep):
        """
        Verifies that generator streams where the network call fails during initial chunk
        iteration (e.g. next(gen)) are transparently retried with exponential backoff.
        """
        gen_creation_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def sample_stream_call():
            nonlocal gen_creation_count
            gen_creation_count += 1
            current_call = gen_creation_count
            def _stream_gen():
                if current_call < 3:
                    raise g_exc.ServiceUnavailable(f"503 Stream Init Failed (attempt {current_call})")
                yield f"chunk_a_call_{current_call}"
                yield f"chunk_b_call_{current_call}"
            return _stream_gen()

        stream = sample_stream_call()
        chunks = list(stream)

        self.assertEqual(chunks, ["chunk_a_call_3", "chunk_b_call_3"])
        self.assertEqual(gen_creation_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        mock_sleep.assert_has_calls([call(1.0), call(2.0)])

    @patch("time.sleep")
    def test_generator_stream_exhausts_retries_and_bubbles_up(self, mock_sleep):
        """
        Verifies that if generator stream iteration fails 4 times consecutively,
        the exception bubbles up after sleeping [1.0, 2.0, 4.0].
        """
        gen_creation_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def sample_failing_stream():
            nonlocal gen_creation_count
            gen_creation_count += 1
            current_call = gen_creation_count
            def _stream_gen():
                raise g_exc.ServiceUnavailable(f"503 Stream Init Failed (attempt {current_call})")
                yield "never"
            return _stream_gen()

        stream = sample_failing_stream()
        with self.assertRaises(g_exc.ServiceUnavailable):
            list(stream)

        self.assertEqual(gen_creation_count, 4)
        self.assertEqual(mock_sleep.call_count, 3)
        mock_sleep.assert_has_calls([call(1.0), call(2.0), call(4.0)])

    @patch("time.sleep")
    def test_generator_stream_midstream_drop_fails_fast_without_duplicate_yields(self, mock_sleep):
        """
        Verifies that if a stream fails mid-flight after yielding items, it raises immediately
        so callers/fallbacks handle it cleanly rather than re-yielding duplicate data.
        """
        @with_exponential_backoff(max_retries=3, initial_delay=1.0)
        def sample_midstream_drop():
            def _stream_gen():
                yield "first_chunk"
                raise g_exc.ServiceUnavailable("503 midstream connection reset")
                yield "second_chunk"
            return _stream_gen()

        stream = sample_midstream_drop()
        collected = []
        with self.assertRaises(g_exc.ServiceUnavailable):
            for chunk in stream:
                collected.append(chunk)

        self.assertEqual(collected, ["first_chunk"])
        mock_sleep.assert_not_called()


class TestAgentFallbackIntegration(unittest.TestCase):
    """
    Integration tests proving that backend agents retry transient errors via the decorator
    and only trigger their fallback logic if all retry attempts are exhausted.
    """

    def setUp(self):
        self.env_patcher = patch.dict(os.environ, {
            "GEMINI_API_KEY_REQUIREMENTS": "test_req_key",
            "GEMINI_API_KEY_DESIGN": "test_design_key",
            "GEMINI_API_KEY_CODEGEN": "test_codegen_key",
            "GEMINI_API_KEY_CRITICS": "test_critics_key",
            "GEMINI_API_KEY_ADJUDICATOR": "test_adjudicator_key",
            "GEMINI_API_KEY_INTEGRATION": "test_integration_key",
            "MISTRAL_API_KEY": "test_mistral_key",
        })
        self.env_patcher.start()

    def tearDown(self):
        self.env_patcher.stop()

    # -------------------------------------------------------------------------
    # 1. REQUIREMENTS AGENT
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.requirements_agent.genai.Client")
    def test_requirements_agent_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"project_title": "Test App", "overview": "Desc", "user_stories": []}'
        mock_chunk.usage_metadata = MagicMock(prompt_token_count=10, candidates_token_count=20)
        mock_stream = [mock_chunk]

        # Fails 2 times with ServiceUnavailable, succeeds on 3rd call
        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 1st attempt"),
            g_exc.ServiceUnavailable("503 2nd attempt"),
            mock_stream,
        ]

        chunks = list(generate_requirements_stream("Build a todo app"))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        # Verify that all calls were to primary model and never fallback
        for call_args in mock_client.models.generate_content_stream.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

        self.assertIn("Test App", "".join(chunks))

    @patch("time.sleep")
    @patch("agents.requirements_agent.genai.Client")
    def test_requirements_agent_with_lazy_generator_stream_succeeds_on_3rd_retry(self, mock_client_cls, mock_sleep):
        """
        Tests the real-world SDK behavior where generate_content_stream returns a generator
        object immediately and the 503 is raised when the generator is iterated.
        """
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"project_title": "Lazy Generator App", "overview": "Desc", "user_stories": []}'
        mock_chunk.usage_metadata = MagicMock(prompt_token_count=15, candidates_token_count=25)

        stream_creation_count = 0

        def fake_generate_stream(*args, **kwargs):
            nonlocal stream_creation_count
            stream_creation_count += 1
            call_num = stream_creation_count
            def _gen():
                if call_num < 3:
                    raise g_exc.ServiceUnavailable(f"503 stream failure on call {call_num}")
                yield mock_chunk
            return _gen()

        mock_client.models.generate_content_stream.side_effect = fake_generate_stream

        chunks = list(generate_requirements_stream("Build a lazy generator app"))

        self.assertEqual(stream_creation_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        mock_sleep.assert_has_calls([call(1.0), call(2.0)])
        for call_args in mock_client.models.generate_content_stream.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

        self.assertIn("Lazy Generator App", "".join(chunks))

    @patch("time.sleep")
    @patch("agents.requirements_agent.genai.Client")
    def test_requirements_agent_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_chunk = MagicMock()
        fallback_chunk.text = '{"project_title": "Fallback App", "overview": "Desc", "user_stories": []}'
        fallback_stream = [fallback_chunk]

        # Primary fails 4 times (1 initial + 3 retries), fallback succeeds
        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            fallback_stream,
        ]

        chunks = list(generate_requirements_stream("Build a todo app"))

        # 4 primary attempts + 1 fallback attempt = 5 total
        self.assertEqual(mock_client.models.generate_content_stream.call_count, 5)
        self.assertEqual(mock_sleep.call_count, 3)

        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content_stream.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")
        self.assertIn("Fallback App", "".join(chunks))

    # -------------------------------------------------------------------------
    # 2. DESIGN AGENT
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.design_agent.genai.Client")
    def test_design_agent_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"tech_stack": ["python"], "files": []}'
        mock_chunk.usage_metadata = None
        mock_stream = [mock_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_stream,
        ]

        reqs = make_dummy_requirements()
        chunks = list(generate_design_stream(reqs))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        for call_args in mock_client.models.generate_content_stream.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("agents.design_agent.genai.Client")
    def test_design_agent_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_chunk = MagicMock()
        fallback_chunk.text = '{"tech_stack": ["python"], "files": []}'
        fallback_stream = [fallback_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            fallback_stream,
        ]

        reqs = make_dummy_requirements()
        chunks = list(generate_design_stream(reqs))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content_stream.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")

    # -------------------------------------------------------------------------
    # 3. CODEGEN AGENT
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.codegen_agent.genai.Client")
    def test_codegen_agent_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"files": []}'
        mock_chunk.usage_metadata = None
        mock_stream = [mock_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_stream,
        ]

        reqs = make_dummy_requirements()
        blueprint = make_dummy_blueprint()
        chunks = list(generate_code_stream(reqs, blueprint))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        for call_args in mock_client.models.generate_content_stream.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("agents.codegen_agent.genai.Client")
    def test_codegen_agent_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_chunk = MagicMock()
        fallback_chunk.text = '{"files": []}'
        fallback_stream = [fallback_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            fallback_stream,
        ]

        reqs = make_dummy_requirements()
        blueprint = make_dummy_blueprint()
        chunks = list(generate_code_stream(reqs, blueprint))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content_stream.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")

    # -------------------------------------------------------------------------
    # 4. CRITICS AGENTS
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.critics.genai.Client")
    def test_correctness_critic_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_feedback = CriticFeedback(critic_name="Correctness Critic (Gemini)", severity_score=0, issues_list=[], overall_comments="Passed")
        mock_response = MagicMock()
        mock_response.parsed = mock_feedback

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_response,
        ]

        reqs = make_dummy_requirements()
        exec_res = ExecutionResult(success=True, logs="All passed", exit_code=0)
        feedback = evaluate_correctness(reqs, exec_res)

        self.assertEqual(mock_client.models.generate_content.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        self.assertEqual(feedback.severity_score, 0)
        for call_args in mock_client.models.generate_content.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("agents.critics.genai.Client")
    def test_correctness_critic_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_feedback = CriticFeedback(critic_name="Correctness Critic (Gemini)", severity_score=0, issues_list=[], overall_comments="Fallback Passed")
        mock_response = MagicMock()
        mock_response.parsed = fallback_feedback

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            mock_response,
        ]

        reqs = make_dummy_requirements()
        exec_res = ExecutionResult(success=True, logs="All passed", exit_code=0)
        feedback = evaluate_correctness(reqs, exec_res)

        self.assertEqual(mock_client.models.generate_content.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")

    @patch("time.sleep")
    @patch("agents.critics.genai.Client")
    def test_completeness_critic_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_feedback = CriticFeedback(critic_name="Completeness Critic (Gemini)", severity_score=0, issues_list=[], overall_comments="Complete")
        mock_response = MagicMock()
        mock_response.parsed = mock_feedback

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_response,
        ]

        reqs = make_dummy_requirements()
        blueprint = make_dummy_blueprint()
        codebase = make_dummy_codebase()
        feedback = evaluate_completeness(reqs, blueprint, codebase)

        self.assertEqual(mock_client.models.generate_content.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        for call_args in mock_client.models.generate_content.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("agents.critics.genai.Client")
    def test_completeness_critic_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_feedback = CriticFeedback(critic_name="Completeness Critic (Gemini)", severity_score=0, issues_list=[], overall_comments="Fallback Complete")
        mock_response = MagicMock()
        mock_response.parsed = fallback_feedback

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            mock_response,
        ]

        reqs = make_dummy_requirements()
        blueprint = make_dummy_blueprint()
        codebase = make_dummy_codebase()
        feedback = evaluate_completeness(reqs, blueprint, codebase)

        self.assertEqual(mock_client.models.generate_content.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")

    # -------------------------------------------------------------------------
    # 5. DOCUMENTATION AGENT
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.documentation_agent.genai.Client")
    def test_documentation_agent_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"files": []}'
        mock_chunk.usage_metadata = None
        mock_stream = [mock_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_stream,
        ]

        reqs = make_dummy_requirements()
        blueprint = make_dummy_blueprint()
        codebase = make_dummy_codebase()
        chunks = list(generate_documentation_stream(reqs, blueprint, codebase))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        for call_args in mock_client.models.generate_content_stream.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("agents.documentation_agent.genai.Client")
    def test_documentation_agent_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_chunk = MagicMock()
        fallback_chunk.text = '{"files": [{"file_name": "README.md", "source_code": "Fallback"}]}'
        fallback_chunk.usage_metadata = None
        fallback_stream = [fallback_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            fallback_stream,
        ]

        reqs = make_dummy_requirements()
        blueprint = make_dummy_blueprint()
        codebase = make_dummy_codebase()
        chunks = list(generate_documentation_stream(reqs, blueprint, codebase))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content_stream.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")

    # -------------------------------------------------------------------------
    # 6. INTEGRATOR AGENT
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.integrator_agent.genai.Client")
    def test_integrator_agent_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"files": []}'
        mock_chunk.usage_metadata = None
        mock_stream = [mock_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_stream,
        ]

        reqs = make_dummy_requirements()
        decomp = make_dummy_decomposition()
        chunks = list(generate_integration_stream(reqs, decomp, []))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        for call_args in mock_client.models.generate_content_stream.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("agents.integrator_agent.genai.Client")
    def test_integrator_agent_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_chunk = MagicMock()
        fallback_chunk.text = '{"files": [{"file_name": "index.html", "source_code": "Fallback"}]}'
        fallback_chunk.usage_metadata = None
        fallback_stream = [fallback_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            fallback_stream,
        ]

        reqs = make_dummy_requirements()
        decomp = make_dummy_decomposition()
        chunks = list(generate_integration_stream(reqs, decomp, []))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content_stream.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")

    # -------------------------------------------------------------------------
    # 7. MASTER ARCHITECT AGENT
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.master_architect.genai.Client")
    def test_master_architect_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"is_complex": false, "components": []}'
        mock_chunk.usage_metadata = None
        mock_stream = [mock_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_stream,
        ]

        reqs = make_dummy_requirements()
        chunks = list(decompose_requirements_stream(reqs))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        for call_args in mock_client.models.generate_content_stream.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("agents.master_architect.genai.Client")
    def test_master_architect_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_chunk = MagicMock()
        fallback_chunk.text = '{"is_complex": false, "components": []}'
        fallback_chunk.usage_metadata = None
        fallback_stream = [fallback_chunk]

        mock_client.models.generate_content_stream.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            fallback_stream,
        ]

        reqs = make_dummy_requirements()
        chunks = list(decompose_requirements_stream(reqs))

        self.assertEqual(mock_client.models.generate_content_stream.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content_stream.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")

    # -------------------------------------------------------------------------
    # 8. ADJUDICATOR (Orchestrator)
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("orchestrator.genai.Client")
    def test_adjudicator_succeeds_on_3rd_retry_without_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_decision = AdjudicatorDecision(verdict="pass", revision_plan="Approved")
        mock_response = MagicMock()
        mock_response.parsed = mock_decision

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_response,
        ]

        state = {
            "requirements": make_dummy_requirements(),
            "blueprint": make_dummy_blueprint(),
            "codebase": make_dummy_codebase(),
            "execution_result": ExecutionResult(success=True, logs="OK", exit_code=0),
            "master_decomposition": None,
            "feedbacks": [],
            "decision": None,
            "revision_count": 0,
        }

        out = node_adjudicator(state)
        self.assertEqual(out["decision"].verdict, "pass")
        self.assertEqual(mock_client.models.generate_content.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        for call_args in mock_client.models.generate_content.call_args_list:
            self.assertEqual(call_args.kwargs.get("model"), "gemini-3.6-flash")

    @patch("time.sleep")
    @patch("orchestrator.genai.Client")
    def test_adjudicator_fails_4_times_and_triggers_fallback(self, mock_client_cls, mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        fallback_decision = AdjudicatorDecision(verdict="revise", revision_plan="Fallback plan")
        mock_response = MagicMock()
        mock_response.parsed = fallback_decision

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            g_exc.ServiceUnavailable("503 attempt 3"),
            g_exc.ServiceUnavailable("503 attempt 4"),
            mock_response,
        ]

        state = {
            "requirements": make_dummy_requirements(),
            "blueprint": make_dummy_blueprint(),
            "codebase": make_dummy_codebase(),
            "execution_result": ExecutionResult(success=True, logs="OK", exit_code=0),
            "master_decomposition": None,
            "feedbacks": [],
            "decision": None,
            "revision_count": 0,
        }

        out = node_adjudicator(state)
        self.assertEqual(out["decision"].verdict, "revise")
        self.assertEqual(mock_client.models.generate_content.call_count, 5)
        call_models = [c.kwargs.get("model") for c in mock_client.models.generate_content.call_args_list]
        self.assertEqual(call_models[:4], ["gemini-3.6-flash"] * 4)
        self.assertEqual(call_models[4], "gemini-3.5-flash-lite")


    # -------------------------------------------------------------------------
    # 9. ARCHITECTURE CRITIC (Mistral + Gemini Fallback)
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("agents.critics.Mistral")
    def test_architecture_critic_succeeds_on_3rd_retry_without_fallback(self, mock_mistral_cls, mock_sleep):
        mock_mistral = MagicMock()
        mock_mistral_cls.return_value = mock_mistral

        mock_choice = MagicMock()
        mock_choice.message.content = '{"severity_score": 0, "issues_list": [], "overall_comments": "Clean architecture"}'
        mock_resp = MagicMock(choices=[mock_choice])

        mock_mistral.chat.complete.side_effect = [
            Exception("429 rate limit exceeded"),
            Exception("429 rate limit exceeded"),
            mock_resp,
        ]

        blueprint = make_dummy_blueprint()
        codebase = make_dummy_codebase()
        feedback = evaluate_architecture(blueprint, codebase)

        self.assertEqual(mock_mistral.chat.complete.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        self.assertEqual(feedback.severity_score, 0)

    @patch("time.sleep")
    @patch("agents.critics.genai.Client")
    @patch("agents.critics.Mistral")
    def test_architecture_critic_fails_4_times_and_triggers_gemini_fallback(self, mock_mistral_cls, mock_gemini_client_cls, mock_sleep):
        mock_mistral = MagicMock()
        mock_mistral_cls.return_value = mock_mistral

        mock_mistral.chat.complete.side_effect = [
            Exception("429 rate limit attempt 1"),
            Exception("429 rate limit attempt 2"),
            Exception("429 rate limit attempt 3"),
            Exception("429 rate limit attempt 4"),
        ]

        mock_gemini = MagicMock()
        mock_gemini_client_cls.return_value = mock_gemini

        fallback_feedback = CriticFeedback(critic_name="Architecture Critic (Mistral)", severity_score=1, issues_list=["Minor issue"], overall_comments="Fallback used")
        mock_gemini_resp = MagicMock()
        mock_gemini_resp.parsed = fallback_feedback
        mock_gemini.models.generate_content.return_value = mock_gemini_resp

        blueprint = make_dummy_blueprint()
        codebase = make_dummy_codebase()
        feedback = evaluate_architecture(blueprint, codebase)

        self.assertEqual(mock_mistral.chat.complete.call_count, 4)
        self.assertEqual(mock_gemini.models.generate_content.call_count, 1)
        self.assertEqual(feedback.severity_score, 1)

    # -------------------------------------------------------------------------
    # 10. MAIN API PARSE ENDPOINTS
    # -------------------------------------------------------------------------
    @patch("time.sleep")
    @patch("main.genai.Client")
    def test_api_parse_requirements_succeeds_on_3rd_retry(self, mock_client_cls, mock_sleep):
        from main import api_parse_requirements, TextUpdateInput
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_reqs = make_dummy_requirements()
        mock_response = MagicMock()
        mock_response.parsed = mock_reqs

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_response,
        ]

        result = api_parse_requirements(TextUpdateInput(text="Sample requirements text"))
        self.assertEqual(mock_client.models.generate_content.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        self.assertEqual(result.project_title, "Test App")

    @patch("time.sleep")
    @patch("main.genai.Client")
    def test_api_parse_blueprint_succeeds_on_3rd_retry(self, mock_client_cls, mock_sleep):
        from main import api_parse_blueprint, TextUpdateInput
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_bp = make_dummy_blueprint()
        mock_response = MagicMock()
        mock_response.parsed = mock_bp

        mock_client.models.generate_content.side_effect = [
            g_exc.ServiceUnavailable("503 attempt 1"),
            g_exc.ServiceUnavailable("503 attempt 2"),
            mock_response,
        ]

        result = api_parse_blueprint(TextUpdateInput(text="Sample blueprint text"))
        self.assertEqual(mock_client.models.generate_content.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        self.assertEqual(result.architecture_overview, "Modular architecture")


class TestAsyncExponentialBackoff(unittest.IsolatedAsyncioTestCase):
    """
    Unit tests proving async coroutine and async generator stream backoff support.
    """

    @patch("asyncio.sleep")
    async def test_async_coroutine_succeeds_on_3rd_retry(self, mock_async_sleep):
        call_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        async def sample_async_llm():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise g_exc.ServiceUnavailable(f"503 async failure (attempt {call_count})")
            return "ASYNC_SUCCESS"

        result = await sample_async_llm()
        self.assertEqual(result, "ASYNC_SUCCESS")
        self.assertEqual(call_count, 3)
        self.assertEqual(mock_async_sleep.call_count, 2)
        mock_async_sleep.assert_has_calls([call(1.0), call(2.0)])

    @patch("asyncio.sleep")
    async def test_async_coroutine_fails_4_times_and_bubbles_up(self, mock_async_sleep):
        call_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        async def sample_failing_async_llm():
            nonlocal call_count
            call_count += 1
            raise g_exc.ServiceUnavailable(f"503 async failure (attempt {call_count})")

        with self.assertRaises(g_exc.ServiceUnavailable):
            await sample_failing_async_llm()

        self.assertEqual(call_count, 4)
        self.assertEqual(mock_async_sleep.call_count, 3)
        mock_async_sleep.assert_has_calls([call(1.0), call(2.0), call(4.0)])

    @patch("asyncio.sleep")
    async def test_async_generator_stream_succeeds_on_3rd_retry(self, mock_async_sleep):
        gen_creation_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        async def sample_async_gen():
            nonlocal gen_creation_count
            gen_creation_count += 1
            current = gen_creation_count
            if current < 3:
                raise g_exc.ServiceUnavailable(f"503 async stream init failure {current}")
            yield f"async_chunk_1_call_{current}"
            yield f"async_chunk_2_call_{current}"

        chunks = []
        async for item in sample_async_gen():
            chunks.append(item)

        self.assertEqual(chunks, ["async_chunk_1_call_3", "async_chunk_2_call_3"])
        self.assertEqual(gen_creation_count, 3)
        self.assertEqual(mock_async_sleep.call_count, 2)
        mock_async_sleep.assert_has_calls([call(1.0), call(2.0)])

    @patch("asyncio.sleep")
    async def test_async_generator_stream_exhausts_retries_and_bubbles_up(self, mock_async_sleep):
        gen_creation_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        async def sample_failing_async_gen():
            nonlocal gen_creation_count
            gen_creation_count += 1
            raise g_exc.ServiceUnavailable(f"503 persistent async failure")
            yield "never"

        with self.assertRaises(g_exc.ServiceUnavailable):
            async for _ in sample_failing_async_gen():
                pass

        self.assertEqual(gen_creation_count, 4)
        self.assertEqual(mock_async_sleep.call_count, 3)
        mock_async_sleep.assert_has_calls([call(1.0), call(2.0), call(4.0)])

    @patch("asyncio.sleep")
    async def test_async_generator_midstream_drop_fails_fast(self, mock_async_sleep):
        @with_exponential_backoff(max_retries=3, initial_delay=1.0)
        async def sample_async_midstream_drop():
            yield "first_async_chunk"
            raise g_exc.ServiceUnavailable("503 midstream disconnect")
            yield "second_async_chunk"

        chunks = []
        with self.assertRaises(g_exc.ServiceUnavailable):
            async for chunk in sample_async_midstream_drop():
                chunks.append(chunk)

        self.assertEqual(chunks, ["first_async_chunk"])
        mock_async_sleep.assert_not_called()


class TestDecoratorEdgeCases(unittest.TestCase):
    """
    Edge case tests for @with_exponential_backoff and is_transient_error.
    """

    @patch("time.sleep")
    def test_jitter_enabled_adds_random_delay(self, mock_sleep):
        call_count = 0

        @with_exponential_backoff(max_retries=2, initial_delay=1.0, jitter=True)
        def call_with_jitter():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise g_exc.ServiceUnavailable("503")
            return "OK"

        result = call_with_jitter()
        self.assertEqual(result, "OK")
        self.assertEqual(mock_sleep.call_count, 1)
        sleep_arg = mock_sleep.call_args[0][0]
        self.assertGreaterEqual(sleep_arg, 1.0)
        self.assertLessEqual(sleep_arg, 1.5)

    @patch("time.sleep")
    def test_max_delay_capping(self, mock_sleep):
        call_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=10.0, backoff_factor=4.0, max_delay=15.0)
        def call_capped():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise g_exc.ServiceUnavailable("503")
            return "CAPPED"

        result = call_capped()
        self.assertEqual(result, "CAPPED")
        self.assertEqual(mock_sleep.call_count, 2)
        # Attempt 0: min(10.0 * 1, 15.0) = 10.0; Attempt 1: min(10.0 * 4, 15.0) = 15.0
        mock_sleep.assert_has_calls([call(10.0), call(15.0)])

    @patch("time.sleep")
    def test_custom_retryable_exceptions(self, mock_sleep):
        class CustomTransientError(Exception):
            pass

        call_count = 0

        @with_exponential_backoff(max_retries=2, retryable_exceptions=(CustomTransientError,))
        def call_custom():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise CustomTransientError("temporary custom error")
            return "CUSTOM_OK"

        result = call_custom()
        self.assertEqual(result, "CUSTOM_OK")
        self.assertEqual(call_count, 2)
        self.assertEqual(mock_sleep.call_count, 1)

    @patch("time.sleep")
    def test_zero_max_retries_aborts_immediately(self, mock_sleep):
        call_count = 0

        @with_exponential_backoff(max_retries=0)
        def call_zero_retries():
            nonlocal call_count
            call_count += 1
            raise g_exc.ServiceUnavailable("503")

        with self.assertRaises(g_exc.ServiceUnavailable):
            call_zero_retries()

        self.assertEqual(call_count, 1)
        mock_sleep.assert_not_called()

    @patch("time.sleep")
    def test_on_retry_callback_invoked(self, mock_sleep):
        callback_records = []

        def on_retry_fn(exc, attempt, delay):
            callback_records.append((type(exc), attempt, delay))

        @with_exponential_backoff(max_retries=2, initial_delay=2.0, on_retry=on_retry_fn)
        def call_with_callback():
            if len(callback_records) < 2:
                raise g_exc.ServiceUnavailable("503")
            return "DONE"

        result = call_with_callback()
        self.assertEqual(result, "DONE")
        self.assertEqual(len(callback_records), 2)
        self.assertEqual(callback_records[0][1], 1)
        self.assertEqual(callback_records[0][2], 2.0)
        self.assertEqual(callback_records[1][1], 2)
        self.assertEqual(callback_records[1][2], 4.0)

    @patch("time.sleep")
    def test_client_error_400_not_retried(self, mock_sleep):
        call_count = 0

        @with_exponential_backoff(max_retries=3)
        def call_bad_request():
            nonlocal call_count
            call_count += 1
            err = Exception("400 Bad Request: invalid input format")
            err.status_code = 400
            raise err

        with self.assertRaises(Exception) as ctx:
            call_bad_request()

        self.assertEqual(call_count, 1)
        mock_sleep.assert_not_called()
        self.assertIn("400", str(ctx.exception))

    def test_is_transient_error_classification(self):
        # Transient errors
        self.assertTrue(is_transient_error(g_exc.ServiceUnavailable("503 Service Unavailable")))
        self.assertTrue(is_transient_error(g_exc.ResourceExhausted("429 Quota Exceeded")))
        self.assertTrue(is_transient_error(g_exc.InternalServerError("500 Internal Server Error")))
        self.assertTrue(is_transient_error(ConnectionResetError("Connection reset by peer")))
        self.assertTrue(is_transient_error(TimeoutError("Request timed out")))
        self.assertTrue(is_transient_error(Exception("429 rate limit exceeded")))
        self.assertTrue(is_transient_error(Exception("503 Backend server is temporarily unavailable")))

        # Response object status codes
        resp_503_err = Exception("upstream service failed")
        mock_resp_503 = MagicMock()
        mock_resp_503.status_code = 503
        resp_503_err.response = mock_resp_503
        self.assertTrue(is_transient_error(resp_503_err))

        resp_400_err = Exception("client payload invalid")
        mock_resp_400 = MagicMock()
        mock_resp_400.status_code = 400
        resp_400_err.response = mock_resp_400
        self.assertFalse(is_transient_error(resp_400_err))

        # Permanent errors
        self.assertFalse(is_transient_error(ValueError("invalid_api_key provided")))
        self.assertFalse(is_transient_error(Exception("401 Unauthorized: invalid credentials")))
        self.assertFalse(is_transient_error(Exception("403 Forbidden: permission denied")))
        self.assertFalse(is_transient_error(Exception("404 Not Found")))
        self.assertFalse(is_transient_error(Exception("Schema_violation in output")))
        self.assertFalse(is_transient_error(Exception("Context_length_exceeded")))

    @patch("time.sleep")
    def test_custom_iterator_stream_succeeds_on_3rd_retry(self, mock_sleep):
        """Tests that a non-generator custom Iterator class retries and succeeds on attempt 3."""
        attempt_count = 0

        class CustomStreamIterator:
            def __init__(self, attempt):
                self.attempt = attempt
                self.items = [f"item_{attempt}_a", f"item_{attempt}_b"]
                self.idx = 0

            def __iter__(self):
                return self

            def __next__(self):
                if self.attempt < 3:
                    raise g_exc.ServiceUnavailable(f"503 Service Unavailable on attempt {self.attempt}")
                if self.idx < len(self.items):
                    item = self.items[self.idx]
                    self.idx += 1
                    return item
                raise StopIteration

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def get_custom_stream():
            nonlocal attempt_count
            attempt_count += 1
            return CustomStreamIterator(attempt_count)

        result_stream = get_custom_stream()
        items = list(result_stream)

        self.assertEqual(items, ["item_3_a", "item_3_b"])
        self.assertEqual(attempt_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        mock_sleep.assert_has_calls([call(1.0), call(2.0)])

    @patch("time.sleep")
    def test_custom_iterator_stream_fails_4_times_and_bubbles_up(self, mock_sleep):
        """Tests that a non-generator custom Iterator class exhausts retries and bubbles up."""
        attempt_count = 0

        class FailingCustomStream:
            def __init__(self, attempt):
                self.attempt = attempt

            def __iter__(self):
                return self

            def __next__(self):
                raise g_exc.ServiceUnavailable(f"503 Stream Error attempt {self.attempt}")

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def get_failing_stream():
            nonlocal attempt_count
            attempt_count += 1
            return FailingCustomStream(attempt_count)

        stream = get_failing_stream()
        with self.assertRaises(g_exc.ServiceUnavailable):
            list(stream)

        self.assertEqual(attempt_count, 4)
        self.assertEqual(mock_sleep.call_count, 3)
        mock_sleep.assert_has_calls([call(1.0), call(2.0), call(4.0)])

    @patch("time.sleep")
    def test_sync_generator_function_preservation_and_backoff(self, mock_sleep):
        """Tests that inspect.isgeneratorfunction returns True and retries on transient errors."""
        attempt_count = 0

        @with_exponential_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
        def my_gen_fn():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise g_exc.ServiceUnavailable(f"503 on gen attempt {attempt_count}")
            yield "gen_chunk_1"
            yield "gen_chunk_2"

        import inspect
        self.assertTrue(inspect.isgeneratorfunction(my_gen_fn))

        gen = my_gen_fn()
        items = list(gen)
        self.assertEqual(items, ["gen_chunk_1", "gen_chunk_2"])
        self.assertEqual(attempt_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
        mock_sleep.assert_has_calls([call(1.0), call(2.0)])


if __name__ == "__main__":
    unittest.main()


