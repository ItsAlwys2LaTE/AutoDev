from google import genai
from google.genai import types
import os
import sys
from typing import Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import (
    RequirementsDocument, ComponentDecomposition, ComponentResult,
    GeneratedCodeBase, SystemDesignBlueprint
)
from retry import with_exponential_backoff
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error

def generate_integration_stream(
    requirements: RequirementsDocument,
    decomposition: ComponentDecomposition,
    component_results: list,  # List[ComponentResult]
    previous_codebase: Optional[GeneratedCodeBase] = None,
    revision_plan: Optional[str] = None
):
    keys = get_gemini_keys_for_stage("INTEGRATION")
    primary_key = os.environ.get("GEMINI_API_KEY_INTEGRATION")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        raise ValueError("GEMINI_API_KEY_INTEGRATION is not set in the environment variables.")

    system_prompt = """
    You are an Expert Integration Engineer. You are given:
    1. The original full Requirements Document for the product.
    2. A ComponentDecomposition that describes the integration strategy.
    3. Multiple ComponentResult objects, each containing a fully tested component's blueprint and codebase.
    
    Your task is to merge ALL component codebases into a SINGLE, unified GeneratedCodeBase that works 
    as one cohesive application.
    
    CRITICAL INTEGRATION RULES:
    1. MERGE ALL FILES: Include every source file from every component. If two components have files 
       with the same name (e.g., both have 'styles.css'), you MUST merge their contents intelligently 
       or rename them to avoid collisions (e.g., 'auth-styles.css', 'catalog-styles.css') and update 
       all references.
    2. UNIFIED ENTRY POINT: Generate a single main entry point file (e.g., 'index.html' with navigation/routing, 
       or 'app.py' with all route registrations). This file must wire all components together with proper 
       navigation (tabs, sidebar, or page routing).
    3. CONSOLIDATED DEPENDENCIES: Merge all package.json or requirements.txt files into ONE unified manifest 
       with all dependencies from all components. Remove duplicates and ensure testing dependencies (such as jest for Node or pytest for Python) are present.
    4. DYNAMIC INTEGRATION TESTS: Write comprehensive integration test(s) matching the project's selected tech stack:
       - For Python/pytest projects: Generate `test_integration.py` (or `test_app.py`) with pytest assertions testing end-to-end user workflows across components.
       - For Node.js/JavaScript/TypeScript projects: Generate `integration.test.js` or `app.test.js` using Jest/npm test to verify cross-component interactions and state flows.
       - These tests must verify the seams between components (e.g., login -> browse -> add to cart -> checkout).
    5. SHARED STYLING: Ensure all components use consistent styling/theming. If components have separate 
       CSS files, create a shared base stylesheet or merge them.
    6. NO STUBS OR PLACEHOLDERS: Every file must contain complete, working code. Do not use '...', 'TODO', 
       or 'pass'.
    7. NO ROOT SUBDIRECTORIES: Output all files relative to the workspace root. Do NOT nest inside a 
       project subdirectory.
    8. Follow the integration_strategy from the ComponentDecomposition for guidance on routing, shared 
       state, and cross-component wiring.
    """

    # Build the component results context
    components_context = ""
    for cr in component_results:
        components_context += f"""
    --- COMPONENT: {cr.get('component_name', cr.get('component_id', 'unknown'))} (ID: {cr.get('component_id', 'unknown')}) ---
    BLUEPRINT:
    {cr.get('blueprint', {})}
    
    FILES:
    """
        codebase = cr.get('codebase', {})
        files = codebase.get('files', []) if isinstance(codebase, dict) else (getattr(codebase, 'files', []) or [])
        for f in files:
            f_name = f.get('file_name', 'unknown') if isinstance(f, dict) else getattr(f, 'file_name', 'unknown')
            f_code = f.get('source_code', '') if isinstance(f, dict) else getattr(f, 'source_code', '')
            components_context += f"""
    FILE: {f_name}
    ```
    {f_code}
    ```
    """

    prompt_content = f"""
    ORIGINAL FULL REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}
    
    DECOMPOSITION & INTEGRATION STRATEGY:
    Project Overview: {decomposition.project_overview}
    Shared Tech Stack: {decomposition.shared_tech_stack}
    Shared Docker Image: {decomposition.shared_docker_image}
    Integration Strategy: {decomposition.integration_strategy}
    
    COMPONENT RESULTS (all individually tested and passing):
    {components_context}
    
    Now merge ALL components into a single, unified GeneratedCodeBase. Follow the integration strategy 
    to wire everything together with proper routing/navigation, shared dependencies, and tech-stack appropriate integration tests.
    """

    if previous_codebase and revision_plan:
        prompt_content += f"""
    PREVIOUS INTEGRATED CODEBASE (FAILED ARBITRATION / TESTS):
    {previous_codebase.model_dump_json(indent=2)}
    
    REVISION PLAN & FEEDBACK:
    {revision_plan}
    
    CRITICAL INSTRUCTION: You are in an INTEGRATION SELF-CORRECTION LOOP. The previous integrated codebase failed evaluation.
    You MUST rewrite the integrated codebase to resolve all issues identified in the REVISION PLAN while preserving complete functionality.
    """

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _get_stream(model_name: str):
            return client.models.generate_content_stream(
                model=model_name,
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.3,
                    response_mime_type="application/json",
                    response_schema=GeneratedCodeBase,
                )
            )

        print(f"Integration Agent is merging all components into final product using Gemini 3.6-flash (key {idx+1}/{len(keys)})...")
        try:
            response = _get_stream("gemini-3.6-flash")
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
            yield '\n__RESET__\n'
            print(f"Primary model (3.6-flash) on key {idx+1} failed in Integration Agent: {e}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on gemini-3.6-flash...")
                continue
            else:
                print("Falling back to gemini-3.5-flash-lite in Integration Agent...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _get_fallback_stream(model_name: str):
                        return fb_client.models.generate_content_stream(
                            model=model_name,
                            contents=prompt_content,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                temperature=0.3,
                                response_mime_type="application/json",
                                response_schema=GeneratedCodeBase,
                            )
                        )
                    try:
                        response = _get_fallback_stream("gemini-3.5-flash-lite")
                        for chunk in response:
                            yield chunk.text
                        return
                    except Exception as fallback_error:
                        yield '\n__RESET__\n'
                        print(f"Fallback model on key {fb_idx+1} failed in Integration Agent: {fallback_error}")
                        if fb_idx + 1 < len(keys):
                            continue
                        yield f'{{"error": "Both models failed in Integration Agent: {fallback_error}"}}'
                        return
