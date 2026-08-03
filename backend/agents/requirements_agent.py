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
    """
    # Fetch the key explicitly from the environment
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in the environment variables.")

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

    print("Agent is thinking and generating structured requirements using Gemini...")
    
    # Make the LLM call, forcing the output to match our Pydantic model
    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=feature_request,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2, # Low temperature for more deterministic, professional output
                response_mime_type="application/json",
                response_schema=RequirementsDocument,
            )
        )
        
        # The new SDK parses it into the Pydantic model automatically if response_schema is set
        if hasattr(response, 'parsed') and response.parsed is not None:
            return response.parsed
        else:
            # Fallback in case of parsing inconsistencies
            return RequirementsDocument.model_validate_json(response.text)
            
    except Exception as e:
        print(f"Error generating requirements: {e}")
        raise