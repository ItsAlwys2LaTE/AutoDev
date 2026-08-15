from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument

def generate_requirements(feature_request: str) -> RequirementsDocument:
    """
    Takes a plain text feature request and uses Gemini to generate 
    a structured RequirementsDocument natively using Pydantic.
    Implements a fallback to gemini-3.5-flash-lite if gemini-3.6-flash fails.
    """
    # Fetch the key explicitly from the environment
    api_key = os.environ.get("GEMINI_API_KEY_REQUIREMENTS")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_REQUIREMENTS is not set in the environment variables.")

    # Initialize the Gemini client by passing the key directly
    client = genai.Client(api_key=api_key)

    system_prompt = """
    You are an expert Technical Product Manager. Your job is to take a vague or 
    high-level feature request from a user and translate it into a strict, highly 
    structured Requirements Document.
    Break the request down into logical User Stories and define exhaustive, highly 
    specific, and testable Acceptance Criteria (ACs) for each. 
    The downstream engineering agents will rely ENTIRELY on your ACs to write code, 
    so be precise about edge cases, inputs, and expected outputs.
    """

    def call_model(model_name: str) -> RequirementsDocument:
        response = client.models.generate_content(
            model=model_name,
            contents=feature_request,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2, 
                response_mime_type="application/json",
                response_schema=RequirementsDocument,
            )
        )
        if hasattr(response, 'parsed') and response.parsed is not None:
            return response.parsed
        else:
            return RequirementsDocument.model_validate_json(response.text)

    print("Agent is thinking and generating structured requirements using Gemini 3.6-flash...")
    
    try:
        # Try main model first
        return call_model("gemini-3.6-flash")
    except Exception as e:
        print(f"Primary model (3.6-flash) failed: {e}")
        print("Falling back to gemini-3.5-flash-lite...")
        try:
            # Fallback to secondary model
            return call_model("gemini-3.5-flash-lite")
        except Exception as fallback_error:
            print(f"Fallback model also failed: {fallback_error}")
            raise Exception(f"Both primary and fallback models failed. Last error: {fallback_error}")