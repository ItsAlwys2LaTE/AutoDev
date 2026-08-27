from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument

def generate_requirements_stream(feature_request: str):
    """
    Takes a plain text feature request and yields a stream of JSON text 
    representing a structured RequirementsDocument.
    """
    api_key = os.environ.get("GEMINI_API_KEY_REQUIREMENTS")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_REQUIREMENTS is not set in the environment variables.")

    client = genai.Client(api_key=api_key)

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

    def get_stream(model_name: str):
        return client.models.generate_content_stream(
            model=model_name,
            contents=feature_request,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2, 
                response_mime_type="application/json",
                response_schema=RequirementsDocument,
            )
        )

    print("Agent is thinking and generating structured requirements stream using Gemini 3.6-flash...")
    
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
            
    except Exception as e:
        print(f"Primary model (3.6-flash) failed: {e}")
        print("Falling back to gemini-3.5-flash-lite...")
        try:
            response = get_stream("gemini-3.5-flash-lite")
            for chunk in response:
                yield chunk.text
        except Exception as fallback_error:
            print(f"Fallback model also failed: {fallback_error}")
            yield f'{{"error": "Both primary and fallback models failed. Last error: {fallback_error}"}}'
