from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode

PRIMARY_MODEL = "gemini-2.5-flash"
FALLBACK_MODEL = "gemini-2.0-flash-lite"

def generate_requirements_stream(feature_request: str, mode: str = None):
    """
    Takes a plain text feature request and yields a stream of JSON text 
    representing a structured RequirementsDocument.
    """
    primary_model, secondary_model = resolve_models_for_mode(
        mode, primary_model=PRIMARY_MODEL, secondary_model=FALLBACK_MODEL
    )
    keys = get_gemini_keys_for_stage("REQUIREMENTS", mode=mode)
    primary_key = os.environ.get("GEMINI_API_KEY_REQUIREMENTS")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        raise ValueError("GEMINI_API_KEY_REQUIREMENTS is not set in the environment variables.")


    system_prompt = """
    You are an expert Technical Product Manager. Your job is to take a vague or 
    high-level feature request from a user and translate it into a strict, highly 
    structured Requirements Document.
    Break the request down into logical User Stories and define exhaustive, highly 
    specific, and testable Acceptance Criteria (ACs) for each. 
    The system supports ANY mainstream programming language (frontend or backend). 
    Structure the requirements agnostically, or respect any specific tech stack requested by the user.
    The downstream engineering agents will rely ENTIRELY on your ACs to write code, 
    so be precise about edge cases, inputs, and expected outputs.
    CRITICAL INSTRUCTION: You MUST explicitly include Acceptance Criteria for robustness. This includes boundary limits (e.g., maximum input lengths), handling of negative numbers/invalid inputs, error states, and all complex edge cases. Do not assume the downstream team will handle edge cases unless you document them.
    """

    prompt_content = feature_request

    def _try_stream(key, model_name):
        """Attempt a single streaming call. Returns an iterator or raises."""
        client = genai.Client(api_key=key)
        return client.models.generate_content_stream(
            model=model_name,
            contents=prompt_content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2, 
                response_mime_type="application/json",
                response_schema=RequirementsDocument,
            )
        )

    # Phase 1: Try primary model across all keys
    for idx, key in enumerate(keys):
        print(f"Requirements Agent: trying {primary_model} (Model: {primary_model}) on key {idx+1}/{len(keys)}...")
        try:
            response = _try_stream(key, primary_model)
            for chunk in response:
                if getattr(chunk, 'text', None):
                    yield chunk.text
                if getattr(chunk, 'usage_metadata', None):
                    last_usage = chunk.usage_metadata
            if 'last_usage' in dir() and last_usage:
                yield f"\n__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
            return
        except Exception as e:
            yield '\n__RESET__\n'
            print(f"Requirements Agent: {primary_model} failed on key {idx+1}: {e}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                continue
            # If it's NOT a rate limit error, or we've exhausted primary keys, go to fallback
            break

    # Phase 2: Try fallback model across all keys
    print(f"Requirements Agent: falling back to {secondary_model} (Model: {secondary_model})...")
    for fb_idx, fb_key in enumerate(keys):
        print(f"Requirements Agent: trying {secondary_model} (Model: {secondary_model}) on key {fb_idx+1}/{len(keys)}...")
        try:
            response = _try_stream(fb_key, secondary_model)
            for chunk in response:
                if getattr(chunk, 'text', None):
                    yield chunk.text
            return
        except Exception as fallback_error:
            yield '\n__RESET__\n'
            print(f"Requirements Agent: {secondary_model} failed on key {fb_idx+1}: {fallback_error}")
            if fb_idx + 1 < len(keys):
                continue
            yield f'{{"error": "All models failed in Requirements Agent. Last error: {fallback_error}"}}'
            return

