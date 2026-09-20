import json
from google import genai
from google.genai import types
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, ComponentDecomposition, ComponentSpec, validate_decomposition
from retry import with_exponential_backoff, format_concise_error
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode

def decompose_requirements_stream(requirements: RequirementsDocument, mode: str = None, max_retries: int = 2):
    primary_model, secondary_model = resolve_models_for_mode(mode)
    keys = get_gemini_keys_for_stage("DECOMPOSITION", mode=mode)
    primary_key = os.environ.get("GEMINI_API_KEY_MASTER_ARCHITECT") or os.environ.get("GEMINI_API_KEY_2") or os.environ.get("GEMINI_API_KEY_ADJUDICATOR")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        raise ValueError("GEMINI_API_KEY_MASTER_ARCHITECT is not set in the environment variables.")

    system_prompt = """
    You are a Master Software Architect with decades of experience decomposing large-scale systems. 
    You are given a structured Requirements Document (JSON) for a software product.
    
    Your task is to analyze the complexity of the product and decide whether it needs to be decomposed 
    into smaller, independently buildable components.
    
    CRITICAL DECISION RULES:
    1. SIMPLE PRODUCTS (is_complex = false): ONLY if the product has 2 or fewer user stories AND is a trivial single-purpose 
       utility (e.g., a basic "calculator", "string reverser", or "simple counter"), set is_complex to false. 
       Return an empty components list. The product will be built in a single pass.
    2. COMPLEX PRODUCTS (is_complex = true): If the product has 3+ user stories, OR multiple distinct functional areas/views 
       (e.g., layout + feature modules + data view + analytics), you MUST set is_complex to true and decompose it into 3-6 components. 
       For fullstack applications, you MUST sub-decompose across both backend and frontend layers to produce at least 3 components.
       NEVER lump a product with 3+ user stories into 1 or 2 components!
    
    DECOMPOSITION RULES (when is_complex = true):
    1. Each component MUST be independently buildable and testable as a standalone mini-application.
    2. NO circular dependencies between components. Use a DAG (directed acyclic graph) ordering.
    3. Foundational components (e.g., core layout, shared models/context, auth system, data layer) must have lower 
       priority_order numbers so they are built first.
    4. Each component's scoped_requirements MUST be detailed enough for a Design Agent to independently 
       produce a complete architectural blueprint WITHOUT seeing the original full requirements. Include 
       specific user stories, acceptance criteria, UI descriptions, data models, and dev server expectations (e.g. React/Vite UI components requiring `npm run dev -- --host 0.0.0.0` on port 5173 bound to 0.0.0.0).
    5. DOCKER IMAGE & DEV SERVER COMPATIBILITY (HETEROGENEOUS STACKS SUPPORT):
       - Homogeneous Systems: If all components share the same runtime (e.g., pure React frontend app or pure Python backend), `shared_docker_image` and `shared_tech_stack` apply uniformly across all components.
       - Heterogeneous / Fullstack Systems: AutoDev natively supports heterogeneous multi-runtime architectures. For fullstack applications with distinct backend and frontend technologies (e.g., Python/FastAPI backend and React/Vite frontend), individual components CAN and MUST specify their own per-component `docker_image` (e.g., `python:3.11-slim` vs `mcr.microsoft.com/playwright:v1.48.0-jammy`) and per-component `tech_stack` overrides in `ComponentSpec`. The top-level `shared_docker_image` and `shared_tech_stack` act as the global default / integration runtime.
       - DEV SERVER COMPATIBILITY: `dev_server_command` and `docker_image` must be strictly compatible for each component and in the final integrated application.
       - PROHIBIT PYTHON HTTP SERVER: You are STRICTLY PROHIBITED from specifying or suggesting `python -m http.server` in `integration_strategy` or component requirements whenever a component or shared image is Node or Playwright, as Python is not installed in those containers.
       - REACT/VITE MANDATE: For React/Vite projects, mandate that the dev server runs via `npm run dev -- --host 0.0.0.0` on port 5173. All dev servers must bind to `0.0.0.0` to permit port forwarding.
    6. INTEGRATION STRATEGY & LIVE PREVIEW: The integration_strategy MUST describe exactly how to wire the components together: shared routing, navigation patterns, shared CSS/theming, state management, cross-component imports, AND the unified dev server startup configuration (e.g., `npm run dev -- --host 0.0.0.0` on port 5173 bound to 0.0.0.0 for React/Vite).
    7. Aim for 3-6 components. Any complex project MUST have at least 3 components; fewer than 3 components for a complex project is strictly invalid and will trigger an automated validation error. More than 6 components are too granular and will create integration nightmares.
    8. component_id must be unique kebab-case identifiers (e.g., 'user-auth', 'product-catalog', 'shopping-cart').
    9. CLEAN STACK SEPARATION (NO MONOLITHIC MIXED-STACK COMPONENTS) & MANDATORY SUB-DECOMPOSITION PER LAYER:
       When a product involves both backend and frontend layers:
       - Clean Stack Separation (No Monolithic Mixed-Stack Components): You are STRICTLY PROHIBITED from decomposing a project into a monolithic component that contains both a Python backend service and a React/Node frontend client. Backend API services (Python/FastAPI) and Frontend UIs (React/Vite) MUST be separate, isolated components in the DAG with independent tech stacks and Docker images (`docker_image` and `tech_stack` per component).
       - Mandatory Sub-Decomposition Per Layer (Enforce >= 3 Components): You are STRICTLY PROHIBITED from decomposing a complex fullstack application into merely 2 monolithic components (e.g., just 'backend-api' and 'frontend-ui'). Decomposing into < 3 components violates architectural standards and will trigger an automated validation failure and retry. You MUST sub-decompose each layer into smaller, independently buildable components to achieve a total of 3-6 components:
         * Sub-decompose Backend Layer: Split the backend into multiple distinct domain services or API components (e.g., 'auth-service', 'data-api', 'analytics-service', 'worker-service'), each specifying `docker_image: "python:3.11-slim"` and `tech_stack: ["Python", "FastAPI", "pytest"]`.
         * Sub-decompose Frontend Layer: Split the frontend into distinct client-side view/feature components (e.g., 'auth-views', 'dashboard-ui', 'admin-portal', 'interactive-workspace'), each specifying `docker_image: "mcr.microsoft.com/playwright:v1.48.0-jammy"` and `tech_stack: ["React", "Vite", "Tailwind CSS"]`.
         * Total Component Count: The resulting DAG MUST contain at least 3 components (target: 3-6 components). Any complex project output with fewer than 3 components is strictly invalid.
       - Component Dependencies & Communication: Frontend components declare dependencies on the backend service components they communicate with (`dependencies_on: ['auth-service']`). Components communicate strictly via REST API / JSON endpoints over HTTP, NOT by sharing code files or mixing package.json and requirements.txt in the same container.
       - Integration Strategy: In `integration_strategy`, describe how all components integrate, including API endpoints, routing, state management, and dev server proxying (e.g., Vite dev server proxying `/api` to `http://localhost:8000` or configuring `API_BASE_URL`).
       - Frontend-Only or Backend-Only Systems: If the project is purely a rich frontend application or purely a backend microservice, decompose it into 3-6 distinct functional components across its feature areas, all sharing the same appropriate `shared_docker_image`.
    """

    system_prompt += f"\n\nCRITICAL: Your output MUST strictly match this JSON schema (output RAW JSON only):\n{json.dumps(ComponentDecomposition.model_json_schema())}"

    base_prompt_content = f"""
    REQUIREMENTS DOCUMENT:
    {requirements.model_dump_json(indent=2)}
    
    Analyze this product and produce the ComponentDecomposition.
    """

    current_prompt = base_prompt_content

    for attempt in range(max_retries + 1):
        chunks = []
        last_usage = None
        success = False

        for idx, key in enumerate(keys):
            chunks = []
            last_usage = None
            client = genai.Client(api_key=key)

            @with_exponential_backoff
            def _get_stream(model_name: str, prompt_text: str):
                return client.models.generate_content_stream(
                    model=model_name,
                    contents=prompt_text,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.2,
                        response_mime_type="application/json",
                    )
                )

            try:
                response = _get_stream(primary_model, current_prompt)
                for chunk in response:
                    if getattr(chunk, 'text', None):
                        chunks.append(chunk.text)
                    if getattr(chunk, 'usage_metadata', None):
                        last_usage = chunk.usage_metadata
                success = True
                break
            except Exception as e:
                print(f"Primary model ({primary_model}) on key {idx+1} failed in Master Architect: {format_concise_error(e)}")
                if is_rate_limit_error(e) and idx + 1 < len(keys):
                    print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                    continue
                else:
                    print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
                    for fb_idx, fb_key in enumerate(keys):
                        chunks = []
                        last_usage = None
                        fb_client = genai.Client(api_key=fb_key)

                        @with_exponential_backoff
                        def _get_fallback_stream(model_name: str, prompt_text: str):
                            return fb_client.models.generate_content_stream(
                                model=model_name,
                                contents=prompt_text,
                                config=types.GenerateContentConfig(
                                    system_instruction=system_prompt,
                                    temperature=0.2,
                                    response_mime_type="application/json",
                                )
                            )
                        try:
                            response = _get_fallback_stream(secondary_model, current_prompt)
                            for chunk in response:
                                if getattr(chunk, 'text', None):
                                    chunks.append(chunk.text)
                                if getattr(chunk, 'usage_metadata', None):
                                    last_usage = chunk.usage_metadata
                            success = True
                            break
                        except Exception as fallback_error:
                            print(f"Fallback model ({secondary_model}) on key {fb_idx+1} failed in Master Architect: {format_concise_error(fallback_error)}")
                            if fb_idx + 1 < len(keys):
                                continue
                            yield '\n__RESET__\n'
                            yield f'{{"error": "Both models failed in Master Architect: {format_concise_error(fallback_error)}"}}'
                            return
                    if success:
                        break

        if not success:
            yield '\n__RESET__\n'
            yield '{"error": "Failed to generate decomposition from any available model."}'
            return

        full_text = "".join(chunks)
        try:
            validate_decomposition(full_text, requirements=requirements)
            # Post-LLM validation passed! Yield full validated content
            for text_chunk in chunks:
                yield text_chunk
            if last_usage:
                yield f"\n__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
            return
        except (ValueError, Exception) as ve:
            print(f"Post-LLM validation guard failed on attempt {attempt+1}/{max_retries+1}: {ve}")
            if attempt < max_retries:
                yield '\n__RESET__\n'
                current_prompt = base_prompt_content + f"\n\nCRITICAL ARCHITECTURAL REJECTION ON PREVIOUS ATTEMPT: {ve}\nYou MUST decompose this complex product into at least 3-6 distinct components across both backend and frontend layers!"
                continue
            else:
                yield '\n__RESET__\n'
                yield f'{{"error": "Decomposition validation failed after retries: {format_concise_error(ve)}"}}'
                return

def decompose_requirements(requirements: RequirementsDocument, mode: str = None, max_retries: int = 2) -> ComponentDecomposition:
    """
    Synchronously generates and validates component decomposition, enforcing >= 3 components for complex projects.
    """
    generator = decompose_requirements_stream(requirements, mode=mode, max_retries=max_retries)
    full_text = ""
    for chunk in generator:
        if "__RESET__" in chunk:
            parts = chunk.split("__RESET__")
            full_text = parts[-1]
            chunk = ""
        if "__USAGE__" in chunk:
            chunk = chunk.split("__USAGE__")[0]
        full_text += chunk
    return validate_decomposition(full_text, requirements=requirements)


