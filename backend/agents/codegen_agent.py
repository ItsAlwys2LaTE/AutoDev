from google import genai
from google.genai import types
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase

def generate_code(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint) -> GeneratedCodeBase:
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

    def _call_gemini(model_name: str) -> GeneratedCodeBase:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt_content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.3,
                response_mime_type="application/json",
                response_schema=GeneratedCodeBase,
            )
        )
        if hasattr(response, 'parsed') and response.parsed is not None:
            return response.parsed
        else:
            return GeneratedCodeBase.model_validate_json(response.text)

    print("Code Gen Agent is writing source code using Gemini 3.6-flash...")

    try:
        return _call_gemini("gemini-3.6-flash")
    except Exception as e:
        print(f"Primary model (3.6-flash) failed in CodeGen Agent: {e}. Falling back to 3.5-flash-lite...")
        try:
            return _call_gemini("gemini-3.5-flash-lite")
        except Exception as fallback_error:
            raise Exception(f"Both models failed in CodeGen Agent: {fallback_error}")