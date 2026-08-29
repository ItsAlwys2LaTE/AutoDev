import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import google.api_core.exceptions as g_exc
from google.genai import errors as genai_errors

# Ensure backend modules can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from key_balancer import (
    get_all_gemini_keys,
    get_gemini_keys_for_stage,
    is_rate_limit_error,
    execute_with_key_fallback,
    execute_stream_with_key_fallback
)
from models import (
    RequirementsDocument, UserStory, AcceptanceCriteria,
    SystemDesignBlueprint, GeneratedCodeBase, CodeFile,
    ExecutionResult, ComponentDecomposition, ComponentSpec
)
from agents.requirements_agent import generate_requirements_stream
from agents.master_architect import decompose_requirements_stream
from agents.design_agent import generate_design_stream
from agents.codegen_agent import generate_code_stream
from agents.integrator_agent import generate_integration_stream
from agents.critics import evaluate_correctness, evaluate_completeness
from orchestrator import node_adjudicator

def make_dummy_requirements():
    return RequirementsDocument(
        project_title="Test App",
        overview="A test application",
        user_stories=[
            UserStory(
                title="Testing Feature",
                as_a="developer",
                i_want_to="verify key rotation",
                so_that="the system is robust",
                acceptance_criteria=[
                    AcceptanceCriteria(
                        id="AC-1",
                        description="Key balancer rotates on 429",
                        expected_behavior="Request routes to key 2 with gemini-3.6-flash"
                    )
                ]
            )
        ]
    )

def make_dummy_blueprint():
    return SystemDesignBlueprint(
        architecture_overview="Modular architecture",
        tech_stack=["HTML", "CSS", "JavaScript"],
        docker_image="node:20-alpine",
        dev_server_command="npm start",
        dev_server_port=3000,
        run_tests_command="npm test",
        files=[{"file_name": "app.js", "purpose": "Main logic", "dependencies": [], "pseudocode": "init()"}]
    )

class TestKeyBalancerDiscovery(unittest.TestCase):
    def test_key_discovery_from_multiple_env_vars(self):
        env_patch = {
            "GEMINI_API_KEY": "key_base",
            "GEMINI_API_KEYS": "key_csv_1, key_csv_2; key_csv_3",
            "GEMINI_API_KEY_1": "key_num_1",
            "GEMINI_API_KEY_2": "key_num_2",
            "GEMINI_API_KEY_REQUIREMENTS": "key_req",
            "GEMINI_API_KEY_CODEGEN": "key_code",
        }
        with patch.dict(os.environ, env_patch, clear=True):
            all_keys = get_all_gemini_keys()
            self.assertIn("key_base", all_keys)
            self.assertIn("key_csv_1", all_keys)
            self.assertIn("key_csv_2", all_keys)
            self.assertIn("key_csv_3", all_keys)
            self.assertIn("key_num_1", all_keys)
            self.assertIn("key_num_2", all_keys)
            self.assertIn("key_req", all_keys)
            self.assertIn("key_code", all_keys)
            self.assertEqual(len(all_keys), len(set(all_keys)))

    def test_stage_prioritization(self):
        env_patch = {
            "GEMINI_API_KEY_REQUIREMENTS": "key_specific_req",
            "GEMINI_API_KEY_1": "key_pool_1",
            "GEMINI_API_KEY": "key_fallback_default"
        }
        with patch.dict(os.environ, env_patch, clear=True):
            stage_keys = get_gemini_keys_for_stage("REQUIREMENTS")
            self.assertEqual(stage_keys[0], "key_specific_req")
            self.assertIn("key_pool_1", stage_keys)
            self.assertIn("key_fallback_default", stage_keys)

    def test_is_rate_limit_error_detection(self):
        exc_429 = Exception("429 Resource exhausted: Quota exceeded")
        self.assertTrue(is_rate_limit_error(exc_429))

        exc_re = g_exc.ResourceExhausted("Resource has been exhausted")
        self.assertTrue(is_rate_limit_error(exc_re))

        exc_503 = g_exc.ServiceUnavailable("503 Service Unavailable")
        self.assertFalse(is_rate_limit_error(exc_503))


class TestKeyBalancer429RotationAcrossPrimaryKeys(unittest.TestCase):
    """
    R3 Core Verification:
    Proves that if Key 1 returns a 429 after 3 retries, the system routes the request
    to a second primary key (gemini-3.6-flash) BEFORE falling back to the secondary model.
    """

    @patch("time.sleep")
    @patch("key_balancer.genai.Client")
    def test_execute_stream_rotates_primary_key_on_429_before_model_fallback(self, mock_client_cls, mock_sleep):
        keys = ["PRIMARY_KEY_1", "PRIMARY_KEY_2"]
        
        client1 = MagicMock()
        client2 = MagicMock()
        mock_client_cls.side_effect = [client1, client2]

        client1.models.generate_content_stream.side_effect = [
            g_exc.ResourceExhausted("429 quota exhausted attempt 1"),
            g_exc.ResourceExhausted("429 quota exhausted attempt 2"),
            g_exc.ResourceExhausted("429 quota exhausted attempt 3"),
            g_exc.ResourceExhausted("429 quota exhausted attempt 4"),
        ]

        success_chunk = MagicMock()
        success_chunk.text = '{"status": "success from key 2"}'
        success_chunk.usage_metadata = None
        client2.models.generate_content_stream.return_value = [success_chunk]

        result_stream = list(execute_stream_with_key_fallback(
            stage="TEST_STAGE",
            stream_fn=lambda client, model: client.models.generate_content_stream(model=model, contents="test prompt"),
            custom_keys=keys
        ))

        mock_client_cls.assert_any_call(api_key="PRIMARY_KEY_1")
        mock_client_cls.assert_any_call(api_key="PRIMARY_KEY_2")

        self.assertEqual(client1.models.generate_content_stream.call_count, 4)
        for call in client1.models.generate_content_stream.call_args_list:
            self.assertEqual(call.kwargs["model"], "gemini-3.6-flash")

        self.assertEqual(client2.models.generate_content_stream.call_count, 1)
        self.assertEqual(client2.models.generate_content_stream.call_args.kwargs["model"], "gemini-3.6-flash")
        self.assertEqual(result_stream, ['{"status": "success from key 2"}'])

    @patch("time.sleep")
    @patch("key_balancer.genai.Client")
    def test_execute_stream_falls_back_to_3_5_lite_only_after_all_primary_keys_exhaust_429(self, mock_client_cls, mock_sleep):
        keys = ["PRIMARY_KEY_1", "PRIMARY_KEY_2"]

        client1_prim = MagicMock()
        client2_prim = MagicMock()
        client1_fb = MagicMock()
        mock_client_cls.side_effect = [client1_prim, client2_prim, client1_fb]

        client1_prim.models.generate_content_stream.side_effect = [
            g_exc.ResourceExhausted("429 Key 1 attempt 1"),
            g_exc.ResourceExhausted("429 Key 1 attempt 2"),
            g_exc.ResourceExhausted("429 Key 1 attempt 3"),
            g_exc.ResourceExhausted("429 Key 1 attempt 4"),
        ]
        client2_prim.models.generate_content_stream.side_effect = [
            g_exc.ResourceExhausted("429 Key 2 attempt 1"),
            g_exc.ResourceExhausted("429 Key 2 attempt 2"),
            g_exc.ResourceExhausted("429 Key 2 attempt 3"),
            g_exc.ResourceExhausted("429 Key 2 attempt 4"),
        ]

        fb_chunk = MagicMock()
        fb_chunk.text = '{"status": "fallback 3.5-flash-lite success"}'
        fb_chunk.usage_metadata = None
        client1_fb.models.generate_content_stream.return_value = [fb_chunk]

        result_stream = list(execute_stream_with_key_fallback(
            stage="TEST_STAGE",
            stream_fn=lambda client, model: client.models.generate_content_stream(model=model, contents="test prompt"),
            custom_keys=keys
        ))

        self.assertEqual(client1_prim.models.generate_content_stream.call_count, 4)
        self.assertEqual(client2_prim.models.generate_content_stream.call_count, 4)
        self.assertEqual(client1_fb.models.generate_content_stream.call_count, 1)
        self.assertEqual(client1_fb.models.generate_content_stream.call_args.kwargs["model"], "gemini-3.5-flash-lite")
        self.assertEqual(result_stream, ['{"status": "fallback 3.5-flash-lite success"}'])


class TestRequirementsAgentKeyRotationOn429(unittest.TestCase):
    @patch("time.sleep")
    @patch("agents.requirements_agent.genai.Client")
    def test_requirements_agent_rotates_primary_keys_on_429(self, mock_client_cls, mock_sleep):
        env_patch = {
            "GEMINI_API_KEY_REQUIREMENTS": "KEY_1",
            "GEMINI_API_KEY_CODEGEN": "KEY_2"
        }
        client1 = MagicMock()
        client2 = MagicMock()
        mock_client_cls.side_effect = [client1, client2]

        client1.models.generate_content_stream.side_effect = [
            g_exc.ResourceExhausted("429 quota 1"),
            g_exc.ResourceExhausted("429 quota 2"),
            g_exc.ResourceExhausted("429 quota 3"),
            g_exc.ResourceExhausted("429 quota 4"),
        ]

        chunk = MagicMock()
        chunk.text = '{"project_title": "Rotated App", "overview": "Desc", "user_stories": []}'
        chunk.usage_metadata = None
        client2.models.generate_content_stream.return_value = [chunk]

        with patch.dict(os.environ, env_patch, clear=True):
            chunks = list(generate_requirements_stream("Build something"))

        self.assertEqual(client1.models.generate_content_stream.call_count, 4)
        self.assertEqual(client2.models.generate_content_stream.call_count, 1)
        self.assertEqual(client2.models.generate_content_stream.call_args.kwargs["model"], "gemini-3.6-flash")


class TestCodeGenAgentKeyRotationOn429(unittest.TestCase):
    @patch("time.sleep")
    @patch("agents.codegen_agent.genai.Client")
    def test_codegen_agent_rotates_primary_keys_on_429(self, mock_client_cls, mock_sleep):
        env_patch = {
            "GEMINI_API_KEY_CODEGEN": "KEY_1",
            "GEMINI_API_KEY_DESIGN": "KEY_2"
        }
        client1 = MagicMock()
        client2 = MagicMock()
        mock_client_cls.side_effect = [client1, client2]

        client1.models.generate_content_stream.side_effect = [
            g_exc.ResourceExhausted("429 quota 1"),
            g_exc.ResourceExhausted("429 quota 2"),
            g_exc.ResourceExhausted("429 quota 3"),
            g_exc.ResourceExhausted("429 quota 4"),
        ]

        chunk = MagicMock()
        chunk.text = '{"files": [{"file_name": "app.js", "source_code": "console.log(1)"}]}'
        chunk.usage_metadata = None
        client2.models.generate_content_stream.return_value = [chunk]

        with patch.dict(os.environ, env_patch, clear=True):
            chunks = list(generate_code_stream(make_dummy_requirements(), make_dummy_blueprint()))

        self.assertEqual(client1.models.generate_content_stream.call_count, 4)
        self.assertEqual(client2.models.generate_content_stream.call_count, 1)
        self.assertEqual(client2.models.generate_content_stream.call_args.kwargs["model"], "gemini-3.6-flash")


if __name__ == "__main__":
    unittest.main()
