import json
from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint
from retry import with_exponential_backoff, format_concise_error
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode

def generate_design_stream(requirements: RequirementsDocument, component_context: str = None, mode: str = None):
    """
    Takes a structured RequirementsDocument and yields a stream of JSON text 
    representing a SystemDesignBlueprint outlining the file structure and logic.
    
    If component_context is provided, the agent will design a scoped blueprint
    for a single component within a larger system.
    """
    primary_model, secondary_model = resolve_models_for_mode(mode)
    keys = get_gemini_keys_for_stage("DESIGN", mode=mode)
    primary_key = os.environ.get("GEMINI_API_KEY_DESIGN")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        raise ValueError("GEMINI_API_KEY_DESIGN is not set in the environment variables.")


    system_prompt = """
    You are an Expert Software Architect. You receive strict Requirements containing 
    User Stories and Acceptance Criteria.
    Your job is to design the technical blueprint. 
    
    CRITICAL FORMATTING INSTRUCTIONS FOR YOUR OUTPUT:
    1. TECH STACK SELECTION & HYBRID VERIFICATION COMMAND: Analyze the requirements and intelligently select the optimal `tech_stack` and verification command (`run_tests_command`). AutoDev operates on a HYBRID VERIFICATION STRATEGY:
       - FRONTEND / UI COMPONENTS: For client-side UI components, React/Vite web applications, interactive dashboards, forms, and HTML/CSS/JS frontend views, verification is performed via PRODUCTION BUILD COMPILATION (`npm run build`) rather than brittle JSDOM unit tests. You MUST set `run_tests_command` strictly to:
         `npm install --no-audit --no-fund && npm run build`
         and you MUST OMIT all test files (`*.test.*`, `*.spec.*`) from the blueprint `files` list.
       - BACKEND / LOGIC COMPONENTS: For backend services, REST/GraphQL APIs, data processing pipelines, algorithmic utilities, and standalone business logic modules (Python, Node/Express backend logic, Go, Rust), verification relies on UNIT TESTS. You MUST set `run_tests_command` to the appropriate test runner (e.g., 'pytest' for Python; 'npm install --no-audit --no-fund && npm test' or 'npm install --no-audit --no-fund && npm run test:unit' for Node.js; 'go test ./...' for Go; 'cargo test' for Rust) and you MUST include comprehensive unit test files in `files`.
       - FULLSTACK / SINGLE-PASS PROJECTS: If the project is primarily a client-side frontend web app (e.g. React SPA with Vite), treat it as a frontend component (`npm install --no-audit --no-fund && npm run build`, omitting test files). If it contains a standalone backend API server or non-UI business logic, include unit tests for the backend logic.
       - Never set `run_tests_command` to run Playwright during fast automated validation cycles.
    2. DOCKER ENVIRONMENT & DEV SERVER COMPATIBILITY: You must specify a lightweight `docker_image` and a strictly compatible `dev_server_command`:
       - STRICT RUNTIME COMPATIBILITY: The `dev_server_command` and `docker_image` MUST be strictly compatible. The runtime executable invoked in `dev_server_command` (e.g. `npm`, `npx`, `python`) MUST exist in the selected `docker_image`.
       - REACT / VITE PROJECTS: For all React/Vite projects, you MUST use `mcr.microsoft.com/playwright:v1.48.0-jammy` as `docker_image`, mandate `npm run dev -- --host 0.0.0.0` as `dev_server_command`, and set `dev_server_port` to 5173. In `package.json`, ensure `"scripts"` contains `"dev": "vite"` (or `"dev": "vite --host 0.0.0.0"`).
       - STRICT PROHIBITION OF PYTHON IN NODE/PLAYWRIGHT IMAGES: You are STRICTLY PROHIBITED from generating `python -m http.server` (or any Python command) whenever the selected Docker image is a Node or Playwright image (e.g., `mcr.microsoft.com/playwright:v1.48.0-jammy` or `node:*`). These container images do NOT have Python installed (`python: not found`). For static HTML/JS projects running in Node/Playwright containers, you MUST use `npx --yes serve -p 8080 -H 0.0.0.0` with `dev_server_port` 8080 (or `npm run dev -- --host 0.0.0.0` if Vite-based).
       - PYTHON PROJECTS: If and only if the Docker image is Python (`python:3.11-slim`), set `dev_server_command` to `python3 -m http.server 8080 --bind 0.0.0.0` (for static HTML/file serving) or framework servers (e.g. `uvicorn main:app --host 0.0.0.0 --port 8000`) with matching `dev_server_port`.
       - 0.0.0.0 HOST BINDING MANDATE: All dev servers MUST explicitly bind to `0.0.0.0` (never `localhost` or `127.0.0.1`) to permit container port forwarding. If no dev server is required (e.g., standalone CLI tool or backend algorithm), set `dev_server_command` to "NONE" and `dev_server_port` to 0.
    3. FILES AND EXTENSIONS: Generate files with the correct extensions for the chosen stack (e.g., .js, .html, .py). Include any necessary configuration or dependency files (e.g., package.json, requirements.txt, vite.config.js). Do NOT place the project inside a root subdirectory; output all files relative to the workspace root (e.g. use 'manage.py' instead of 'my_project/manage.py').
    4. HYBRID TEST & BUILD ARCHITECTURE:
       - For Frontend / UI components (where `run_tests_command` is a build command): DO NOT design or include test files (`*.test.*`, `*.spec.*`) in your blueprint `files` list! Instead, direct all architectural focus and file definitions to complete, robust application source files (components, state management, routing, styles, assets). Ensure `package.json` contains standard build scripts (`"build": "vite build"`).
       - For Backend / Logic components (where `run_tests_command` runs unit tests): You MUST include comprehensive unit test suite files in your blueprint:
         * For Python (pytest): Test files MUST start with `test_` (e.g., 'test_main.py'). ALWAYS design tests to use raw string literals `r"..."` for regular expressions (e.g. `re.search(r"\d+", text)`) to prevent Python 3.12+ `SyntaxWarning` / `SyntaxError` failures.
         * For Node/JS backend services using Vitest: Test files MUST end with `.test.js`, `.test.ts`, `.spec.js`, etc. Test server logic by importing handler/service functions directly. If using MongoDB, use `mongodb-memory-server`. Do NOT use `supertest`.
    5. Architecture Overview: Break it down using clear markers (e.g., "Data Flow:", "Key Components:", "Design Patterns:").
    6. File Order: Present files in a logical dependency order (e.g., Models first, then Services, then Tests, then UI).
    7. Pseudocode: Use proper multi-line formatting, line breaks, and indentation. Clearly annotate classes, methods, inputs, and return types. 
    8. DEFENSIVE DESIGN: Your pseudocode and architecture MUST explicitly account for edge cases, input validation (e.g., max lengths, boundary conditions), error states, and robust error recovery. Do not design only the happy path. Design for production-level robustness.
    9. JAVASCRIPT / NODE STACK CONFIGURATION: For JS/Node projects, enforce modern ES modules (`"type": "module"` in package.json). For backend/logic components requiring unit testing, use Vitest instead of Jest and include `vitest` and `jsdom` in devDependencies. For frontend components, configure standard build tooling (e.g., `vite`, `@vitejs/plugin-react`) without requiring test runners in package.json. Note that `__dirname` is undefined in ES module scope; resolve paths using `process.cwd()` or `import.meta.url`.
    10. REACT ICONS: If designing React apps, remember that "lucide-react" does NOT export brand icons (Facebook, Twitter, Instagram, GitHub, etc.). Do NOT import brand icons from lucide-react. Either use generic icons or use "react-icons" if brand icons are strictly required.
    """

    if component_context:
        system_prompt += """
    
    COMPONENT MODE: You are designing a SINGLE COMPONENT that is part of a larger system. 
    The component context below specifies the tech stack and Docker image you MUST use.
    Design ONLY the files relevant to this specific component. Keep it self-contained and testable.
    Prefix file names with the component identifier if they might conflict with other components 
    during integration (e.g., 'auth-styles.css' instead of 'styles.css'), EXCEPT for package.json 
    and configuration files.
    
    AUTONOMOUS COMPONENT CLASSIFICATION:
    Examine the component's scoped requirements and technical role:
    - If this is a Frontend / UI component (React/Vite, UI view, Admin Panel, Product Detail Page, Shopping Cart, client-side routing): Set `run_tests_command` strictly to `npm install --no-audit --no-fund && npm run build`. Do NOT design or include any test files (`*.test.*`, `*.spec.*`) in `files`. Even if it contains some logic or API calls, if its primary output is a UI, treat it as a Frontend component. For React/Vite components, set `dev_server_command` strictly to `npm run dev -- --host 0.0.0.0` and `dev_server_port` to 5173. NEVER specify `python -m http.server` when the component uses a Node or Playwright image.
    - If this is a pure Backend / Logic component (Standalone API Server, Database Schema, Authentication Service, business algorithms): Set `run_tests_command` to the standard unit test runner (`pytest` or `npm install --no-audit --no-fund && npm test`) and include comprehensive unit test files in `files`.
    - CRITICAL: Never instruct the test suite to start an HTTP server (`app.listen()`) or connect to a real database, as this will hang the sandbox and cause a 180s timeout.
    """

    system_prompt += f"\n\nCRITICAL: Your output MUST strictly match this JSON schema (output RAW JSON only):\n{json.dumps(SystemDesignBlueprint.model_json_schema())}"

    prompt_content = f"Generate a system design for these requirements:\n{requirements.model_dump_json(indent=2)}"
    
    if component_context:
        prompt_content += f"\n\nCOMPONENT CONTEXT:\n{component_context}"

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
                )
            )

        try:
            response = get_stream(primary_model)
            iterator = iter(response)
            first_chunk = next(iterator)
            if getattr(first_chunk, 'text', None):
                yield first_chunk.text
            
            last_usage = first_chunk.usage_metadata
            for chunk in iterator:
                if getattr(chunk, 'text', None):
                    yield chunk.text
                if getattr(chunk, 'usage_metadata', None):
                    last_usage = chunk.usage_metadata
                    
            if last_usage:
                yield f"\n__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
            return
        except Exception as e:
            yield '\n__RESET__\n'
            print(f"Primary model ({primary_model}) failed on key {idx+1} in Design Agent: {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
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
                            )
                        )
                    try:
                        response = get_fallback_stream(secondary_model)
                        for chunk in response:
                            if getattr(chunk, 'text', None):
                                yield chunk.text
                        return
                    except Exception as fallback_error:
                        yield '\n__RESET__\n'
                        print(f"Fallback model ({secondary_model}) on key {fb_idx+1} failed in Design Agent: {format_concise_error(fallback_error)}")
                        if fb_idx + 1 < len(keys):
                            continue
                        yield f'{{"error": "Both primary and fallback models failed in Design Agent. Last error: {format_concise_error(fallback_error)}"}}'
                        return

