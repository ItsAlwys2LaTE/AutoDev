import os
import sys
import json
from google import genai
from google.genai import types

try:
    from groq import Groq
except Exception:
    Groq = None

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import ComponentDecomposition, RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult, CriticFeedback
from retry import with_exponential_backoff, format_concise_error
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode

try:
    from backend.golden_stacks import is_test_file, has_test_files
except ImportError:
    try:
        from golden_stacks import is_test_file, has_test_files
    except ImportError:
        import re

        SETUP_CONFIG_EXCLUSIONS = {
            'setuptests.ts', 'setuptests.js', 'src/setuptests.ts', 'src/setuptests.js',
            'vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js',
            'conftest.py', 'jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs',
            'playwright.config.ts', 'playwright.config.js', 'cypress.config.ts', 'cypress.config.js',
        }
        TEST_FILE_PATTERN = re.compile(
            r'(\.(test|spec)\.(jsx?|tsx?|mjs|cjs)$)|(^test_.*\.py$)|(.*_test\.(py|go|rs)$)',
            re.IGNORECASE
        )

        def is_test_file(file_name: str) -> bool:
            if not file_name or not isinstance(file_name, str):
                return False
            normalized = file_name.replace('\\', '/').strip().lower()
            if normalized.startswith('./'):
                normalized = normalized[2:]
            normalized = normalized.lstrip('/')
            base = os.path.basename(normalized)
            if not base:
                return False
            if base in SETUP_CONFIG_EXCLUSIONS or normalized in SETUP_CONFIG_EXCLUSIONS:
                return False
            if base.startswith(('conftest.', 'setuptests.', 'setup_tests.')):
                return False
            parts = normalized.split('/')
            if any(p in ('helpers', 'fixtures', 'mocks', 'utils', '__mocks__') for p in parts[:-1]):
                return False
            if TEST_FILE_PATTERN.search(base):
                return True
            if any(p == '__tests__' for p in parts[:-1]):
                if base.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')):
                    if not base.startswith(('conftest', 'setup', '__init__', 'fixture', 'helper', 'mock', 'util')):
                        if base.endswith('.py'):
                            return bool(re.search(r'(^test_.*\.py$)|(.*_test\.py$)', base, re.IGNORECASE))
                        return True
            return False

        def has_test_files(codebase) -> bool:
            if not codebase:
                return False
            files = getattr(codebase, 'files', None)
            if files is None and isinstance(codebase, dict):
                files = codebase.get('files', None)
            if not files:
                return False
            for f in files:
                fname = f.get('file_name', '') if isinstance(f, dict) else getattr(f, 'file_name', '')
                if is_test_file(fname):
                    return True
            return False


def _extract_files(codebase):
    """Safely extracts a list of file items from codebase (Pydantic model or dict)."""
    if not codebase:
        return []
    if isinstance(codebase, dict):
        return codebase.get("files", []) or []
    if hasattr(codebase, "files"):
        return codebase.files or []
    return []


def _get_file_info(f):
    """Safely extracts (file_name, source_code) from a file object or dict."""
    if isinstance(f, dict):
        return f.get("file_name", ""), f.get("source_code", "")
    return getattr(f, "file_name", ""), getattr(f, "source_code", "")


def _to_json_str(obj):
    """Safely dumps Pydantic models or dicts to JSON string."""
    if obj is None:
        return "None"
    if hasattr(obj, "model_dump_json"):
        return obj.model_dump_json(indent=2)
    if isinstance(obj, (dict, list)):
        return json.dumps(obj, indent=2)
    return str(obj)


def evaluate_correctness(requirements: RequirementsDocument, execution_result: ExecutionResult, codebase: GeneratedCodeBase = None, master_decomposition: ComponentDecomposition = None, component_name: str = None, mode: str = None, component_id: str = None) -> CriticFeedback:
    critic_name = "Correctness Critic (Gemini)"
    primary_model, secondary_model = resolve_models_for_mode(mode)
    
    keys = get_gemini_keys_for_stage("CRITICS", mode=mode, component_id=component_id)
    if not keys:
        primary_key = os.environ.get("GEMINI_API_KEY_CRITICS") or os.environ.get("GEMINI_API_KEY")
        if primary_key:
            keys = [primary_key.strip()]
        else:
            return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI API keys are not set.")

    # Partition codebase files into test files vs application files
    all_files = _extract_files(codebase)
    test_files = []
    app_files = []
    for f in all_files:
        name, src = _get_file_info(f)
        if is_test_file(name):
            test_files.append((name, src))
        else:
            app_files.append((name, src))

    # Detect if test files exist using has_test_files and partitioned test_files
    tests_present = has_test_files(codebase) or len(test_files) > 0
    mode_label = "Test-Driven Mode (B)" if tests_present else "Build-Verification & Code Review Mode (A)"
    print(f"Running {critic_name} (Model: {primary_model}, Mode: {mode_label})...")

    exec_logs = _to_json_str(execution_result)
    reqs_json = _to_json_str(requirements)

    exec_success = True
    if execution_result is not None:
        if isinstance(execution_result, dict):
            exec_success = bool(execution_result.get("success", False))
        elif hasattr(execution_result, "success"):
            exec_success = bool(execution_result.success)

    component_context = ""
    if master_decomposition and component_name:
        component_context = f"""
EVALUATING SPECIFIC COMPONENT: {component_name}
MASTER ARCHITECTURE PLAN:
{_to_json_str(master_decomposition)}

CRITICAL INSTRUCTION: This codebase is ONLY a single component ({component_name}) of the master plan. DO NOT flag missing functionality or Acceptance Criteria if they logically belong to a different component described in the master plan! ONLY evaluate against THIS component's scoped requirements.
"""

    if not tests_present:
        # Mode A (No Test Files):
        app_code = "\n\n".join([f"// File: {name}\n{src}" for name, src in app_files]) if app_files else "No application source code available."
        build_status = "PASSED" if exec_success else "FAILED"

        prompt = f"""EVALUATION MODE: BUILD VERIFICATION & DIRECT SOURCE CODE REVIEW
NOTE: This component uses automated build verification (e.g., 'npm run build' / 'vite build') instead of isolated unit tests.
Build Verification Status: {build_status}

Evaluate the CORRECTNESS of the application source code directly against the Requirements and Acceptance Criteria.
{component_context}

APPLICATION SOURCE CODE:
{app_code}

BUILD & VERIFICATION EXECUTION LOGS:
{exec_logs}

REQUIREMENTS DOCUMENT:
{reqs_json}

CRITICAL INSTRUCTIONS:
1. DO NOT penalize or flag the code for missing test files or lack of test executions. The build verification ({build_status}) has confirmed that the code compiles, bundles, and satisfies static type/syntax checks.
2. If Build Verification FAILED (Build Verification Status: FAILED), flag compiler/bundler errors from the execution logs with a high severity score (7-10).
3. If Build Verification PASSED, inspect the APPLICATION SOURCE CODE directly to verify it implements all user stories, acceptance criteria, UI state management, and functional correctness.
4. Check for functional correctness: verify state management, UI component logic, event listeners, calculation accuracy, and data binding. Flag any logical bugs, broken imports, missing event handlers, or unmet acceptance criteria.
5. If the implementation satisfies all acceptance criteria without defects, assign severity_score: 0 (or <= 2 for minor observations) and empty issues_list: [].
"""
        system_instruction = f"You are the {critic_name}. Evaluate the application source code against requirements strictly. Output a severity_score (0-10, where <=2 passes) and a list of specific issues."
    else:
        # Mode B (Test Files Present):
        test_code = "\n\n".join([f"// File: {name}\n{src}" for name, src in test_files]) if test_files else "No test code available."

        prompt = f"""EVALUATION MODE: TEST-DRIVEN VERIFICATION (Automated test suite detected)

Evaluate the CORRECTNESS of the code based on the execution logs AND the test source code.
Did the tests pass? Are the tests actually testing the Acceptance Criteria, or are they trivial no-ops?
Execution Sandbox Status: {"PASSED" if exec_success else "FAILED"}
{component_context}

TEST SOURCE CODE:
{test_code}

EXECUTION LOGS:
{exec_logs}

REQUIREMENTS DOCUMENT:
{reqs_json}

CRITICAL INSTRUCTIONS:
1. Check that the tests ACTUALLY test functionality against acceptance criteria, not just trivial assertions/no-ops. Flag any test that is a no-op or placeholder, even if it passes.
2. Verify that test cases thoroughly validate the Acceptance Criteria defined in the requirements.
3. If the sandbox execution failed (Execution Sandbox Status: FAILED, non-zero exit code, runner crash, compiler errors, or test assertion failures in the execution logs), you MUST assign a failing severity_score (6-10) and detail the errors from the execution logs in issues_list. You are STRICTLY PROHIBITED from awarding severity <= 2 when execution failed.
4. If and only if the execution passed without error and all tests meaningfully validate the requirements, assign severity_score: 0 (or <= 2) and empty issues_list: [].
"""
        system_instruction = f"You are the {critic_name}. Evaluate the test suite and execution logs strictly. Output a severity_score (0-10, where <=2 passes) and a list of specific issues."

    def _enforce_execution_status(fb: CriticFeedback) -> CriticFeedback:
        fb.critic_name = critic_name
        # Deterministic Guard: If sandbox execution failed, ensure severity score reflects failure
        if not exec_success and fb.severity_score <= 2:
            fb.severity_score = 8
            if not fb.issues_list:
                fb.issues_list = ["Test suite execution failed in container sandbox (exit code != 0)."]
            fb.overall_comments = f"Execution failed in Docker sandbox. {fb.overall_comments}".strip()
        return fb

    # Try all primary keys with resolved primary model
    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _call_primary():
            response = client.models.generate_content(
                model=primary_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=CriticFeedback,
                )
            )
            if hasattr(response, 'parsed') and response.parsed is not None:
                fb = response.parsed
            else:
                fb = CriticFeedback.model_validate_json(response.text)
            return _enforce_execution_status(fb)

        try:
            return _call_primary()
        except Exception as e:
            print(f"Correctness Critic failed on key {idx+1}/{len(keys)} (Model: {primary_model}): {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _call_fallback():
                        response = fb_client.models.generate_content(
                            model=secondary_model,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=0.1,
                                response_mime_type="application/json",
                                response_schema=CriticFeedback,
                            )
                        )
                        if hasattr(response, 'parsed') and response.parsed is not None:
                            fb = response.parsed
                        else:
                            fb = CriticFeedback.model_validate_json(response.text)
                        return _enforce_execution_status(fb)

                    try:
                        return _call_fallback()
                    except Exception as fallback_e:
                        print(f"Correctness Critic fallback on key {fb_idx+1} failed (Model: {secondary_model}): {format_concise_error(fallback_e)}")
                        if fb_idx + 1 < len(keys):
                            continue
                        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {format_concise_error(fallback_e)}"], overall_comments="Failed to evaluate correctness.")



def evaluate_architecture(blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, master_decomposition: ComponentDecomposition = None, mode: str = None, component_id: str = None) -> CriticFeedback:
    critic_name = "Architecture Critic (Gemini)"
    primary_model, secondary_model = resolve_models_for_mode(mode)
    print(f"Running {critic_name} (Model: {primary_model})...")

    keys = get_gemini_keys_for_stage("CRITICS", mode=mode, component_id=component_id)
    if not keys:
        primary_key = os.environ.get("GEMINI_API_KEY_ADJUDICATOR") or os.environ.get("GEMINI_API_KEY_CRITICS") or os.environ.get("GEMINI_API_KEY")
        if primary_key:
            keys = [primary_key.strip()]
        else:
            return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI API keys are not set.")

    prompt = f"""
    Evaluate the ARCHITECTURE of the codebase against the blueprint.
    Did the generated code follow the exact file structure and structural logic defined in the blueprint?
    CRITICAL INSTRUCTION: Do NOT flag defensive programming, input validation (e.g., max input lengths), boundary limits, robust error state handling, or edge-case handling as unauthorized "deviations." These are POSITIVE robustness features. You should ONLY flag major structural deviations (e.g., using entirely wrong design patterns, missing required files, or completely ignoring the blueprint's data flow).
    
    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}

    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing functionality if it logically belongs to a different component described in the master plan!
    
    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing files or missing endpoints if they belong to a different component described in the master plan!
        
    CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """

    system_instruction = f"You are the {critic_name}. Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _call_primary():
            response = client.models.generate_content(
                model=primary_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=CriticFeedback,
                )
            )
            if hasattr(response, 'parsed') and response.parsed is not None:
                fb = response.parsed
            else:
                fb = CriticFeedback.model_validate_json(response.text)
            fb.critic_name = critic_name
            return fb

        try:
            return _call_primary()
        except Exception as e:
            print(f"Architecture Critic failed on key {idx+1}/{len(keys)} (Model: {primary_model}): {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _call_fallback():
                        response = fb_client.models.generate_content(
                            model=secondary_model,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=0.1,
                                response_mime_type="application/json",
                                response_schema=CriticFeedback,
                            )
                        )
                        if hasattr(response, 'parsed') and response.parsed is not None:
                            fb = response.parsed
                        else:
                            fb = CriticFeedback.model_validate_json(response.text)
                        fb.critic_name = critic_name
                        return fb

                    try:
                        return _call_fallback()
                    except Exception as fallback_e:
                        print(f"Architecture Critic fallback on key {fb_idx+1} failed (Model: {secondary_model}): {format_concise_error(fallback_e)}")
                        if fb_idx + 1 < len(keys):
                            continue
                        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {format_concise_error(fallback_e)}"], overall_comments="Failed to evaluate architecture.")



def evaluate_completeness(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, master_decomposition: ComponentDecomposition = None, mode: str = None, component_id: str = None) -> CriticFeedback:
    primary_model, secondary_model = resolve_models_for_mode(mode)
    print(f"Running Completeness Critic (Gemini) (Model: {primary_model})...")
    critic_name = "Completeness Critic (Gemini)"
    
    keys = get_gemini_keys_for_stage("CRITICS", mode=mode, component_id=component_id)
    if not keys:
        primary_key = os.environ.get("GEMINI_API_KEY_CRITICS") or os.environ.get("GEMINI_API_KEY")
        if primary_key:
            keys = [primary_key.strip()]
        else:
            return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI API keys are not set.")
    
    prompt = f"""
    Evaluate the COMPLETENESS of the codebase against the blueprint and requirements.
    Are there any missing edge cases (e.g., division by zero), unhandled exceptions, or logical bugs that break the intended system?
    
    CRITICAL INSTRUCTION: You MUST ONLY suggest fixes for edge cases or bugs that fit WITHIN the provided BLUEPRINT constraints. DO NOT suggest adding new features, scientific notation, new variables (like MAX_LENGTH), or extending the scope beyond what the blueprint defines. Point out crash-bugs and logical gaps only.
    
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}

    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}

    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing functionality if it logically belongs to a different component described in the master plan!
    
    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing files or missing endpoints if they belong to a different component described in the master plan!
        
    CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """
    
    system_instruction = f"You are the {critic_name}. Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _call_primary():
            response = client.models.generate_content(
                model=primary_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=CriticFeedback,
                )
            )
            if hasattr(response, 'parsed') and response.parsed is not None:
                fb = response.parsed
            else:
                fb = CriticFeedback.model_validate_json(response.text)
            fb.critic_name = critic_name
            return fb

        try:
            return _call_primary()
        except Exception as e:
            print(f"Completeness Critic failed on key {idx+1}/{len(keys)} (Model: {primary_model}): {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _call_fallback():
                        response = fb_client.models.generate_content(
                            model=secondary_model,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=0.1,
                                response_mime_type="application/json",
                                response_schema=CriticFeedback,
                            )
                        )
                        if hasattr(response, 'parsed') and response.parsed is not None:
                            fb = response.parsed
                        else:
                            fb = CriticFeedback.model_validate_json(response.text)
                        fb.critic_name = critic_name
                        return fb

                    try:
                        return _call_fallback()
                    except Exception as fallback_e:
                        print(f"Completeness Critic fallback on key {fb_idx+1} failed (Model: {secondary_model}): {format_concise_error(fallback_e)}")
                        if fb_idx + 1 < len(keys):
                            continue
                        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {format_concise_error(fallback_e)}"], overall_comments="Failed to evaluate completeness.")


