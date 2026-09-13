import json
from google import genai
from google.genai import types
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase
from retry import with_exponential_backoff, format_concise_error
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode

PRIMARY_MODEL = "gemini-3.7-flash"
FALLBACK_MODEL = "gemini-3.5-flash-lite"
QUICK_MODEL = "gemini-3.5-flash-lite"

def generate_code_stream(
    requirements: RequirementsDocument, 
    blueprint: SystemDesignBlueprint,
    previous_codebase: GeneratedCodeBase = None,
    revision_plan: str = None,
    mode: str = None,
    primary_model: str = None,
    secondary_model: str = FALLBACK_MODEL,
):
    active_mode = (mode or get_generation_mode()).upper()
    # QUICK mode: strictly use flash-lite (3.7-flash hits rate limits too aggressively)
    # COMPLEX mode: use 3.7-flash with flash-lite fallback
    if active_mode == "QUICK":
        primary_model = QUICK_MODEL
        secondary_model = QUICK_MODEL  # no fallback needed, already at lite
    else:
        primary_model = primary_model or PRIMARY_MODEL
        secondary_model = secondary_model or FALLBACK_MODEL
    keys = get_gemini_keys_for_stage("CODEGEN", mode=mode)
    primary_key = os.environ.get("GEMINI_API_KEY_CODEGEN")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        raise ValueError("GEMINI_API_KEY_CODEGEN is not set in the environment variables.")



    system_prompt = r"""
    You are an Expert Senior Software Engineer. You are provided with a strict Requirements Document (JSON) 
    and a System Design Blueprint (JSON) which defines the `tech_stack`. 
    
    Your task is to write the ACTUAL, production-ready source code for EVERY file listed in the blueprint using the specified language stack.
    
    CRITICAL RULES:
    1. Write COMPLETE code. DO NOT use placeholders like 'pass', 'TODO', or '...'.
    2. HYBRID VERIFICATION STRATEGY (TEST SUITES VS BUILD VERIFICATION):
       Inspect the `SYSTEM BLUEPRINT`'s `run_tests_command` and file list to determine the testing posture:
       - CASE A: FRONTEND / BUILD VERIFICATION (When `run_tests_command` contains `build` or `npm run build`, OR when no test files are listed in the blueprint):
         * DO NOT GENERATE ANY TEST FILES (`*.test.*`, `*.spec.*`, `test_*.py`).
         * DO NOT include unnecessary test dependencies (e.g., `@testing-library/react`, `vitest`, `jsdom`) in `package.json` unless explicitly required by the blueprint.
         * REDIRECT YOUR ENTIRE TOKEN BUDGET: Dedicate 100% of your generated code to writing complete, production-grade, robust application code. Implement rich interactive features, complete UI components, thorough error boundary / error state handling, responsive layout styles (Tailwind CSS), robust input validation, and clean state management.
         * Ensure the project cleanly compiles and builds under `npm run build` with zero syntax, import, or bundling errors.
       - CASE B: BACKEND / LOGIC UNIT TESTING (When `run_tests_command` is a test command such as `pytest`, `npm test`, or `npm run test:unit`, AND/OR test files are listed in the blueprint):
         * You MUST write comprehensive, non-trivial unit tests for all test files listed in the blueprint.
         * For Python (pytest): Test files MUST be prefixed with `test_` and functions must start with `def test_...`. ALWAYS use raw string literals `r"..."` for all regular expressions (e.g. `re.search(r"\d+", text)`) to prevent Python 3.12+ `SyntaxWarning` / `SyntaxError` failures.
         * For JS/Node backend logic: Write tests to run under Vitest (`.test.js`, `.test.ts`, `.spec.js`). 
         * CRITICAL TIMEOUT PREVENTION: NEVER call `app.listen()` or start a real HTTP server in your tests. Test server logic by importing and executing handler functions directly, passing mock Request/Response objects. 
         * NEVER connect to a real database (like `mongodb://localhost`). ALWAYS use `mongodb-memory-server` or mock the database layer. Tests that start servers or real connections will hang the sandbox and fail with a 180s timeout.
         * For async operations, ensure all promises resolve. Use explicit `afterAll` blocks to close mock databases or timers. Do NOT use `supertest`.
    3. EXTERNAL LIBRARIES & DEPENDENCIES: You MUST generate the appropriate package manager file (e.g., package.json, requirements.txt) with all required dependencies. For projects running unit tests, include the necessary test runners ('vitest', 'jsdom', etc.). For frontend projects validated via `npm run build`, ensure build dependencies (such as `vite`, `@vitejs/plugin-react`) and all runtime dependencies are declared. Do NOT include '@playwright/test' in package.json at this stage.
    4. SCHEMA & BLUEPRINT COMPLIANCE: The output must strictly match the GeneratedCodeBase Pydantic schema, containing the exact file_names from the blueprint and their complete source_code. Do NOT invent additional test files that were not specified in the blueprint.
    5. IMPORTS/REQUIRES: EVERY file MUST include ALL necessary import/require statements at the top. Missing imports will cause crashes in the execution sandbox.
    6. NO ROOT SUBDIRECTORIES: Do NOT place the project inside an arbitrary root subdirectory. Output all files relative to the workspace root (e.g. `manage.py`, not `my_project/manage.py`).
    7. IDIOMATIC CODE: Write highly idiomatic code for the chosen language.
    8. ROBUSTNESS: You MUST implement robust edge-case handling, bounds checking (e.g., max lengths), state management, and error recovery to make the system production-ready. Do not just implement the happy path. If the blueprint implies edge cases (or if a senior engineer would normally handle them), implement them.
    9. MODERN JS (ESM) MANDATE: For JavaScript/Node/React projects, enforce modern ES modules (`import`/`export`). Always add `"type": "module"` in `package.json`. If unit tests are present, include `vitest` in devDependencies and import `{ describe, it, test, expect }` from 'vitest'. DO NOT use CommonJS `require()` or `__dirname`. For file path resolution, use `process.cwd()` or `import.meta.url`.
    10. REACT ICONS: If generating React apps, remember that "lucide-react" does NOT export brand icons (Facebook, Twitter, Instagram, GitHub, etc.). Do NOT import brand icons from lucide-react (it will crash the app). Either use generic icons (e.g. Globe, Mail) or use "react-icons" if brand icons are strictly required.
    """

    system_prompt += f"\n\nCRITICAL: Your output MUST strictly match this JSON schema (output RAW JSON only):\n{json.dumps(GeneratedCodeBase.model_json_schema())}"

    prompt_content = f"""
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}
    
    SYSTEM BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}
    
    Generate the complete codebase.
    """

    if previous_codebase and revision_plan:
        prompt_content += f"""
    PREVIOUS CODEBASE (FAILED TESTS/CRITIQUES):
    {previous_codebase.model_dump_json(indent=2)}
    
    REVISION PLAN:
    {revision_plan}
    
    CRITICAL INSTRUCTION: You are in a SELF-CORRECTION LOOP. The previous codebase failed the AI Critics' evaluation. You MUST rewrite the source code to completely resolve the issues listed in the REVISION PLAN above.
    """

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _get_stream(model_name: str):
            return client.models.generate_content_stream(
                model=model_name,
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.3,
                    response_mime_type="application/json",
                )
            )

        try:
            response = _get_stream(primary_model)
            iterator = iter(response)
            first_chunk = next(iterator)
            if getattr(first_chunk, 'text', None):
                yield first_chunk.text
            
            last_usage = first_chunk.usage_metadata
            for chunk in iterator:
                if getattr(chunk, 'text', None):
                    yield chunk.text
                if getattr(chunk, 'usage_metadata', None):
                    last_usage = chunk.usage_metadata
                    
            if last_usage:
                yield f"\n__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
            return
        except Exception as e:
            yield '\n__RESET__\n'
            print(f"Primary model ({primary_model}) failed on key {idx+1} in CodeGen Agent: {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _get_fallback_stream(model_name: str):
                        return fb_client.models.generate_content_stream(
                            model=model_name,
                            contents=prompt_content,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                temperature=0.3,
                                response_mime_type="application/json",
                            )
                        )
                    try:
                        response = _get_fallback_stream(secondary_model)
                        fb_usage = None
                        for chunk in response:
                            if getattr(chunk, 'text', None):
                                yield chunk.text
                            if getattr(chunk, 'usage_metadata', None):
                                fb_usage = chunk.usage_metadata
                        if fb_usage:
                            yield f"\n__USAGE__{fb_usage.prompt_token_count},{fb_usage.candidates_token_count}"
                        return
                    except Exception as fallback_error:
                        yield '\n__RESET__\n'
                        print(f"Fallback model ({secondary_model}) on key {fb_idx+1} failed in CodeGen Agent: {format_concise_error(fallback_error)}")
                        if fb_idx + 1 < len(keys):
                            continue
                        yield f'{{"error": "Both models failed in CodeGen Agent: {format_concise_error(fallback_error)}"}}'
                        return

