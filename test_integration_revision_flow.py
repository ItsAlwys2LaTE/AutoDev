import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from main import app
from models import (
    RequirementsDocument, UserStory, AcceptanceCriteria,
    ComponentDecomposition, ComponentSpec, ComponentResult,
    SystemDesignBlueprint, GeneratedCodeBase, CodeFile,
    ExecutionResult, CriticFeedback, AdjudicatorDecision
)
from agents.integrator_agent import generate_integration_stream

def make_sample_requirements():
    return RequirementsDocument(
        project_title="E-Commerce App",
        overview="Full stack store with auth and products",
        user_stories=[
            UserStory(
                title="User Authentication",
                as_a="customer",
                i_want_to="log in",
                so_that="I can access my profile",
                acceptance_criteria=[
                    AcceptanceCriteria(
                        id="AC-1",
                        description="Valid credentials login",
                        expected_behavior="Returns 200 OK and JWT token"
                    )
                ]
            )
        ]
    )

def make_sample_decomposition():
    return ComponentDecomposition(
        is_complex=True,
        project_overview="E-commerce store",
        shared_tech_stack=["Node.js", "Express", "Jest"],
        shared_docker_image="node:20-alpine",
        integration_strategy="Unified server with auth middleware and product catalog routes",
        components=[
            ComponentSpec(
                component_id="auth",
                component_name="Auth Service",
                description="User authentication and JWT session management",
                scoped_requirements="Implement login and register endpoints",
                dependencies_on=[],
                priority_order=1
            )
        ]
    )

def make_component_results():
    return [
        {
            "component_id": "auth",
            "component_name": "Auth Service",
            "blueprint": {
                "architecture_overview": "Auth Module",
                "tech_stack": ["Node.js", "Jest"],
                "docker_image": "node:20-alpine",
                "dev_server_command": "npm start",
                "dev_server_port": 3000,
                "run_tests_command": "npm test",
                "files": [{"file_name": "auth.js", "purpose": "auth", "dependencies": [], "pseudocode": ""}]
            },
            "codebase": {
                "files": [
                    {"file_name": "auth.js", "source_code": "module.exports = { login: () => true };"},
                    {"file_name": "package.json", "source_code": '{"scripts": {"test": "jest"}}'}
                ]
            }
        }
    ]


class TestIntegrationSelfCorrectionLoop(unittest.TestCase):
    """
    R2 Acceptance Criteria Verification:
    Asserts that the 3-revision loop successfully fires if the Adjudicator fails the first run.
    """

    @patch("agents.integrator_agent.genai.Client")
    def test_integration_agent_stream_supports_revision_context(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_chunk = MagicMock()
        mock_chunk.text = '{"files": [{"file_name": "index.js", "source_code": "console.log(2);"}]}'
        mock_chunk.usage_metadata = None
        mock_client.models.generate_content_stream.return_value = [mock_chunk]

        prev_codebase = GeneratedCodeBase(files=[
            CodeFile(file_name="index.js", purpose="main", source_code="console.log(1);")
        ])
        revision_plan = "Fix route registration and add missing integration.test.js"

        with patch.dict(os.environ, {"GEMINI_API_KEY_INTEGRATION": "dummy_key"}, clear=True):
            stream = generate_integration_stream(
                requirements=make_sample_requirements(),
                decomposition=make_sample_decomposition(),
                component_results=make_component_results(),
                previous_codebase=prev_codebase,
                revision_plan=revision_plan
            )
            chunks = list(stream)

        call_args = mock_client.models.generate_content_stream.call_args
        contents_sent = call_args.kwargs["contents"]
        self.assertIn("INTEGRATION SELF-CORRECTION LOOP", contents_sent)
        self.assertIn("Fix route registration", contents_sent)
        self.assertEqual(chunks, ['{"files": [{"file_name": "index.js", "source_code": "console.log(2);"}]}'])

    @patch("main.arbitration_engine")
    def test_integration_revision_loop_simulation_first_fails_second_passes(self, mock_engine):
        """
        Simulates end-to-end integration phase execution:
        Run 1: Adjudicator returns verdict='revise'
        Revision 1: Integrator agent receives revision plan -> Adjudicator returns verdict='pass'
        """
        client = TestClient(app)

        decision_revise = AdjudicatorDecision(
            verdict="revise",
            revision_plan="Integration test file is missing e2e workflow assertions."
        )
        decision_pass = AdjudicatorDecision(
            verdict="pass",
            revision_plan="All components properly integrated and tested."
        )

        mock_engine.invoke.side_effect = [
            {
                "feedbacks": [
                    CriticFeedback(critic_name="Correctness", severity_score=0, issues_list=[], overall_comments="Passed"),
                    CriticFeedback(critic_name="Architecture", severity_score=5, issues_list=["Missing integration tests"], overall_comments="Missing tests"),
                    CriticFeedback(critic_name="Completeness", severity_score=0, issues_list=[], overall_comments="Passed"),
                ],
                "decision": decision_revise
            },
            {
                "feedbacks": [
                    CriticFeedback(critic_name="Correctness", severity_score=0, issues_list=[], overall_comments="Passed"),
                    CriticFeedback(critic_name="Architecture", severity_score=0, issues_list=[], overall_comments="Clean"),
                    CriticFeedback(critic_name="Completeness", severity_score=0, issues_list=[], overall_comments="Passed"),
                ],
                "decision": decision_pass
            }
        ]

        # Run 1: Initial integration evaluation returns verdict='revise'
        run1_critics_res = client.post("/api/run-critics", json={
            "requirements": make_sample_requirements().model_dump(),
            "blueprint": {
                "architecture_overview": "Unified",
                "tech_stack": ["Node.js", "Jest"],
                "docker_image": "node:20-alpine",
                "dev_server_command": "npm start",
                "dev_server_port": 3000,
                "run_tests_command": "npm test",
                "files": []
            },
            "codebase": {
                "files": [{"file_name": "app.js", "source_code": "console.log(1)"}]
            },
            "execution_result": {
                "success": True,
                "logs": "PASS test"
            },
            "master_decomposition": make_sample_decomposition().model_dump(),
            "component_name": "Integration",
            "revision_count": 0
        })

        self.assertEqual(run1_critics_res.status_code, 200)
        data1 = run1_critics_res.json()
        self.assertEqual(data1["decision"]["verdict"], "revise")
        self.assertIn("assertions", data1["decision"]["revision_plan"])

        # Run 2: Self-correction triggered with revision_count=1 -> returns verdict='pass'
        run2_critics_res = client.post("/api/run-critics", json={
            "requirements": make_sample_requirements().model_dump(),
            "blueprint": {
                "architecture_overview": "Unified",
                "tech_stack": ["Node.js", "Jest"],
                "docker_image": "node:20-alpine",
                "dev_server_command": "npm start",
                "dev_server_port": 3000,
                "run_tests_command": "npm test",
                "files": []
            },
            "codebase": {
                "files": [
                    {"file_name": "app.js", "source_code": "console.log(1)"},
                    {"file_name": "integration.test.js", "source_code": "test('e2e', () => {});"}
                ]
            },
            "execution_result": {
                "success": True,
                "logs": "PASS all tests"
            },
            "master_decomposition": make_sample_decomposition().model_dump(),
            "component_name": "Integration",
            "revision_count": 1
        })

        self.assertEqual(run2_critics_res.status_code, 200)
        data2 = run2_critics_res.json()
        self.assertEqual(data2["decision"]["verdict"], "pass")

    @patch("main.arbitration_engine")
    def test_integration_revision_loop_stops_at_max_3_revisions(self, mock_engine):
        """
        Verifies that if Adjudicator continually requests revisions,
        the loop tracks revision counts (0, 1, 2, 3) and reaches maximum threshold.
        """
        client = TestClient(app)

        mock_engine.invoke.return_value = {
            "feedbacks": [CriticFeedback(critic_name="Correctness", severity_score=8, issues_list=["Bug"], overall_comments="Bug")],
            "decision": AdjudicatorDecision(verdict="revise", revision_plan="Persistent issue")
        }

        for rev_count in range(4):
            res = client.post("/api/run-critics", json={
                "requirements": make_sample_requirements().model_dump(),
                "blueprint": {
                    "architecture_overview": "Unified",
                    "tech_stack": ["Python"],
                    "docker_image": "python:3.11-slim",
                    "dev_server_command": "NONE",
                    "dev_server_port": 0,
                    "run_tests_command": "pytest",
                    "files": []
                },
                "codebase": {"files": []},
                "execution_result": {"success": False, "logs": "error"},
                "master_decomposition": make_sample_decomposition().model_dump(),
                "component_name": "Integration",
                "revision_count": rev_count
            })
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["decision"]["verdict"], "revise")


if __name__ == "__main__":
    unittest.main()
