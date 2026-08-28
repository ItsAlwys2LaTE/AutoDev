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
    1. TECH STACK SELECTION: Analyze the requirements and intelligently select the optimal `tech_stack`. ALL projects, including static frontends (HTML/CSS/JS), MUST have automated tests. Identify the exact terminal `run_tests_command`. For Node/JS projects, ensure it includes dependency installation (e.g., 'npm install && npm test'). For static frontends, use 'npm install && npm test' with Jest and JSDOM to test DOM logic.
    2. DOCKER ENVIRONMENT: You must specify a lightweight `docker_image` (e.g., 'node:20-alpine' for React/JS, 'python:3.11-slim' for Python) that contains the necessary runtime. Specify the `dev_server_command` to run the app (e.g., 'npm run dev -- --host 0.0.0.0' for Vite, 'python -m http.server 8080' for static HTML) and the internal `dev_server_port` it listens on (e.g., 5173, 8080). Dev servers MUST bind to 0.0.0.0 to allow port forwarding.
    3. FILES AND EXTENSIONS: Generate files with the correct extensions for the chosen stack (e.g., .js, .html, .py). Include any necessary configuration or dependency files (e.g., package.json, requirements.txt, vite.config.js). Do NOT place the project inside a root subdirectory; output all files relative to the workspace root (e.g. use 'manage.py' instead of 'my_project/manage.py').
    4. TEST DRIVEN: You MUST include a comprehensive test suite file in your blueprint (e.g., 'test_main.py' or 'app.test.js') for every single project.
    4. Architecture Overview: Break it down using clear markers (e.g., "Data Flow:", "Key Components:", "Design Patterns:").
    5. File Order: Present files in a logical dependency order (e.g., Models first, then Services, then Tests, then UI).
    6. Pseudocode: Use proper multi-line formatting, line breaks, and indentation. Clearly annotate classes, methods, inputs, and return types. 
    7. DEFENSIVE DESIGN: Your pseudocode and architecture MUST explicitly account for edge cases, input validation (e.g., max lengths, boundary conditions), error states, and robust error recovery. Do not design only the happy path. Design for production-level robustness.

    Output a structured object detailing the architecture overview, the chosen tech stack, and the specific file-by-file pseudocode blueprint.
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
