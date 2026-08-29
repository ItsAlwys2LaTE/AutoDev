from google import genai
from google.genai import types
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase
from retry import with_exponential_backoff
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error

def generate_code_stream(
    requirements: RequirementsDocument, 
    blueprint: SystemDesignBlueprint,
    previous_codebase: GeneratedCodeBase = None,
    revision_plan: str = None
):
    keys = get_gemini_keys_for_stage("CODEGEN")
    primary_key = os.environ.get("GEMINI_API_KEY_CODEGEN")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        raise ValueError("GEMINI_API_KEY_CODEGEN is not set in the environment variables.")

    system_prompt = """
    You are an Expert Senior Software Engineer. You are provided with a strict Requirements Document (JSON) 
    and a System Design Blueprint (JSON) which defines the `tech_stack`. 
    
    Your task is to write the ACTUAL, production-ready source code for EVERY file listed in the blueprint using the specified language stack.
    
    CRITICAL RULES:
    1. Write COMPLETE code. DO NOT use placeholders like 'pass', 'TODO', or '...'.
    2. TEST SUITE: You MUST write comprehensive unit tests using the appropriate framework. No project is exempt. For Python (pytest), test files MUST be prefixed with `test_` (e.g., `test_models.py`) and test functions must start with `def test_...` for auto-discovery. For JS/HTML apps, test the DOM logic using Jest.
    3. EXTERNAL LIBRARIES & DEPENDENCIES: You MUST generate the appropriate package manager file (e.g., package.json, requirements.txt) with all required dependencies. For JS/HTML projects, you must include testing libraries like 'jest' and 'jest-environment-jsdom' in the package.json.
    4. SCHEMA COMPLIANCE: The output must strictly match the GeneratedCodeBase Pydantic schema, containing the exact file_names from the blueprint and their complete source_code.
    5. IMPORTS/REQUIRES: EVERY file MUST include ALL necessary import/require statements at the top. Missing imports will cause crashes in the execution sandbox.
    6. NO ROOT SUBDIRECTORIES: Do NOT place the project inside an arbitrary root subdirectory. Output all files relative to the workspace root (e.g. `manage.py`, not `my_project/manage.py`).
    7. IDIOMATIC CODE: Write highly idiomatic code for the chosen language.
    8. ROBUSTNESS: You MUST implement robust edge-case handling, bounds checking (e.g., max lengths), state management, and error recovery to make the system production-ready. Do not just implement the happy path. If the blueprint implies edge cases (or if a senior engineer would normally handle them), implement them.
    """

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
                    response_schema=GeneratedCodeBase,
                )
            )

        print(f"Code Gen Agent is writing source code stream using Gemini 3.6-flash (key {idx+1}/{len(keys)})...")
        try:
            response = _get_stream("gemini-3.6-flash")
            iterator = iter(response)
            first_chunk = next(iterator)
            yield first_chunk.text
            
            last_usage = first_chunk.usage_metadata
            for chunk in iterator:
                yield chunk.text
                if getattr(chunk, 'usage_metadata', None):
                    last_usage = chunk.usage_metadata
                    
            if last_usage:
                yield f"\n__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
            return
        except Exception as e:
            print(f"Primary model (3.6-flash) failed on key {idx+1} in CodeGen Agent: {e}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on gemini-3.6-flash...")
                continue
            else:
                print("Falling back to gemini-3.5-flash-lite...")
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
                                response_schema=GeneratedCodeBase,
                            )
                        )
                    try:
                        response = _get_fallback_stream("gemini-3.5-flash-lite")
                        for chunk in response:
                            yield chunk.text
                        return
                    except Exception as fallback_error:
                        print(f"Fallback model on key {fb_idx+1} failed in CodeGen Agent: {fallback_error}")
                        if fb_idx + 1 < len(keys):
                            continue
                        yield f'{{"error": "Both models failed in CodeGen Agent: {fallback_error}"}}'
                        return
