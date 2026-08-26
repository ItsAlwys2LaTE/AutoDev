from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint

def generate_design(requirements: RequirementsDocument) -> SystemDesignBlueprint:
    """
    Takes a structured RequirementsDocument and uses a secondary Gemini API Key 
    to generate a SystemDesignBlueprint outlining the file structure and logic.
    Implements a fallback to gemini-3.5-flash-lite if gemini-3.6-flash fails.
    """
    # Fetch the SECONDARY key explicitly from the environment to avoid rate limits
    api_key = os.environ.get("GEMINI_API_KEY_DESIGN")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_DESIGN is not set in the environment variables.")

    # Initialize the Gemini client using the second key
    client = genai.Client(api_key=api_key)

    system_prompt = """
    You are an Expert Software Architect. You receive strict Requirements containing 
    User Stories and Acceptance Criteria.
    Your job is to design the technical blueprint. 
    
    CRITICAL FORMATTING INSTRUCTIONS FOR YOUR OUTPUT:
    1. Architecture Overview: Do not write a single block of text. Break it down using clear markers (e.g., "Data Flow:", "Key Components:", "Design Patterns:").
    2. File Order: Present files in a logical dependency order (e.g., Models first, then Validators, then Services, then Tests).
    3. Pseudocode: You MUST use proper multi-line formatting, line breaks, and indentation. Write it like clean Python code. Clearly annotate classes, methods, inputs, and return types. Do not compress logic into single lines.

    Output a structured object detailing the architecture overview and the specific 
    files that need to be generated (including a test file). 
    """

    prompt_content = f"Generate a system design for these requirements:\n{requirements.model_dump_json(indent=2)}"

    def call_model(model_name: str) -> SystemDesignBlueprint:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt_content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=SystemDesignBlueprint,
            )
        )
        if hasattr(response, 'parsed') and response.parsed is not None:
            return response.parsed
        else:
            return SystemDesignBlueprint.model_validate_json(response.text)

    print("Design Agent is architecting the blueprint using Gemini 3.6-flash (Key 2)...")

    try:
        # Try main model first
        return call_model("gemini-3.6-flash")
    except Exception as e:
        print(f"Primary model (3.6-flash) failed in Design Agent: {e}")
        print("Falling back to gemini-3.5-flash-lite...")
        try:
            # Fallback to secondary model
            return call_model("gemini-3.5-flash-lite")
        except Exception as fallback_error:
            print(f"Fallback model also failed: {fallback_error}")
            raise Exception(f"Both primary and fallback models failed in Design Agent. Last error: {fallback_error}")
