from google import genai
from google.genai import types
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase

def generate_code_stream(
    requirements: RequirementsDocument, 
    blueprint: SystemDesignBlueprint,
    previous_codebase: GeneratedCodeBase = None,
    revision_plan: str = None
):
    api_key = os.environ.get("GEMINI_API_KEY_CODEGEN")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_CODEGEN is not set in the environment variables.")

    client = genai.Client(api_key=api_key)

    system_prompt = """
    You are an Expert Senior Software Engineer. You are provided with a strict Requirements Document (JSON) 
    and a System Design Blueprint (JSON). 
    
    Your task is to write the ACTUAL, production-ready Python source code for EVERY file listed in the blueprint.
    
    CRITICAL RULES:
    1. Write COMPLETE code. DO NOT use placeholders like 'pass', 'TODO', or '...'.
    2. One of the files is a test suite (usually test_something.py). You MUST write comprehensive pytest unit tests that test every single Acceptance Criteria from the Requirements.
    3. STRICT RESTRICTION: DO NOT use external or third-party libraries (e.g., bcrypt, requests, pandas). You MUST only use Python's built-in standard libraries (e.g., hashlib, re, os, json). The execution sandbox does not have pip packages installed, so external imports will crash the tests.
    4. The output must strictly match the GeneratedCodeBase Pydantic schema, containing the exact file_names from the blueprint and their complete source_code.
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

    print("Code Gen Agent is writing source code stream using Gemini 3.6-flash...")

    try:
        response = _get_stream("gemini-3.6-flash")
        iterator = iter(response)
        first_chunk = next(iterator)
        yield first_chunk.text
        if first_chunk.usage_metadata:
            yield f"\n__USAGE__{first_chunk.usage_metadata.prompt_token_count},{first_chunk.usage_metadata.candidates_token_count}"
            
        for chunk in iterator:
            yield chunk.text
            if getattr(chunk, 'usage_metadata', None):
                yield f"\n__USAGE__{chunk.usage_metadata.prompt_token_count},{chunk.usage_metadata.candidates_token_count}"
    except Exception as e:
        print(f"Primary model (3.6-flash) failed in CodeGen Agent: {e}. Falling back to 3.5-flash-lite...")
        try:
            response = _get_stream("gemini-3.5-flash-lite")
            for chunk in response:
                yield chunk.text
        except Exception as fallback_error:
            yield f'{{"error": "Both models failed in CodeGen Agent: {fallback_error}"}}'
