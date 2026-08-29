from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument
from retry import with_exponential_backoff
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error

def generate_requirements_stream(feature_request: str):
    """
    Takes a plain text feature request and yields a stream of JSON text 
    representing a structured RequirementsDocument.
    """
    keys = get_gemini_keys_for_stage("REQUIREMENTS")
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

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def get_stream(model_name: str):
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

        print(f"Agent is generating structured requirements stream using Gemini 3.6-flash (key {idx+1}/{len(keys)})...")
        try:
            response = get_stream("gemini-3.6-flash")
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
            print(f"Primary model (3.6-flash) failed on key {idx+1}: {e}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on gemini-3.6-flash...")
                continue
            else:
                print("Falling back to gemini-3.5-flash-lite...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def get_fallback_stream(model_name: str):
                        return fb_client.models.generate_content_stream(
                            model=model_name,
                            contents=prompt_content,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                temperature=0.2, 
                                response_mime_type="application/json",
                                response_schema=RequirementsDocument,
                            )
                        )
                    try:
                        response = get_fallback_stream("gemini-3.5-flash-lite")
                        for chunk in response:
                            yield chunk.text
                        return
                    except Exception as fallback_error:
                        print(f"Fallback model on key {fb_idx+1} failed: {fallback_error}")
                        if fb_idx + 1 < len(keys):
                            continue
                        yield f'{{"error": "Both primary and fallback models failed. Last error: {fallback_error}"}}'
                        return
