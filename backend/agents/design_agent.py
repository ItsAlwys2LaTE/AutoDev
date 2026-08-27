from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint

def generate_design_stream(requirements: RequirementsDocument):
    """
    Takes a structured RequirementsDocument and yields a stream of JSON text 
    representing a SystemDesignBlueprint outlining the file structure and logic.
    """
    api_key = os.environ.get("GEMINI_API_KEY_DESIGN")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_DESIGN is not set in the environment variables.")

    client = genai.Client(api_key=api_key)

    system_prompt = """
    You are an Expert Software Architect. You receive strict Requirements containing 
    User Stories and Acceptance Criteria.
    Your job is to design the technical blueprint. 
    
    CRITICAL FORMATTING INSTRUCTIONS FOR YOUR OUTPUT:
    1. STRICT PYTHON ONLY: You MUST design this system using ONLY Python standard libraries. DO NOT propose JavaScript, Node.js, or external frameworks.
    2. TEST DRIVEN: You MUST include a test suite file in your file ordering. The test file MUST be named starting with 'test_' (e.g., 'test_main.py') so that pytest can automatically collect it.
    3. Architecture Overview: Do not write a single block of text. Break it down using clear markers (e.g., "Data Flow:", "Key Components:", "Design Patterns:").
    4. File Order: Present files in a logical dependency order (e.g., Models first, then Validators, then Services, then Tests).
    5. Pseudocode: You MUST use proper multi-line formatting, line breaks, and indentation. Write it like clean Python code. Clearly annotate classes, methods, inputs, and return types. Do not compress logic into single lines.

    Output a structured object detailing the architecture overview and the specific 
    file-by-file pseudocode blueprint.
    """

    prompt_content = f"Generate a system design for these requirements:\n{requirements.model_dump_json(indent=2)}"

    def get_stream(model_name: str):
        return client.models.generate_content_stream(
            model=model_name,
            contents=prompt_content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=SystemDesignBlueprint,
            )
        )

    print("Design Agent is architecting the blueprint stream using Gemini 3.6-flash (Key 2)...")

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
        print(f"Primary model (3.6-flash) failed in Design Agent: {e}")
        print("Falling back to gemini-3.5-flash-lite...")
        try:
            response = get_stream("gemini-3.5-flash-lite")
            for chunk in response:
                yield chunk.text
        except Exception as fallback_error:
            print(f"Fallback model also failed: {fallback_error}")
            yield f'{{"error": "Both primary and fallback models failed in Design Agent. Last error: {fallback_error}"}}'
