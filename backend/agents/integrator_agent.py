from google import genai
from google.genai import types
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import (
    RequirementsDocument, ComponentDecomposition, ComponentResult,
    GeneratedCodeBase, SystemDesignBlueprint
)

def generate_integration_stream(
    requirements: RequirementsDocument,
    decomposition: ComponentDecomposition,
    component_results: list  # List[ComponentResult]
):
    api_key = os.environ.get("GEMINI_API_KEY_CODEGEN")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_CODEGEN is not set in the environment variables.")

    client = genai.Client(api_key=api_key)

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
       with all dependencies from all components. Remove duplicates.
    4. INTEGRATION TESTS: Write integration test(s) that verify cross-component interactions work correctly 
       (e.g., "user logs in then adds item to cart then views cart"). These tests should cover the seams 
       between components.
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
        files = codebase.get('files', [])
        for f in files:
            components_context += f"""
    FILE: {f.get('file_name', 'unknown')}
    ```
    {f.get('source_code', '')}
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
    to wire everything together with proper routing/navigation, shared dependencies, and integration tests.
    """

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

    print("Integration Agent is merging all components into the final product...")

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

    except Exception as e:
        print(f"Primary model (3.6-flash) failed in Integration Agent: {e}. Falling back to 3.5-flash-lite...")
        try:
            response = _get_stream("gemini-3.5-flash-lite")
            for chunk in response:
                yield chunk.text
        except Exception as fallback_error:
            yield f'{{"error": "Both models failed in Integration Agent: {fallback_error}"}}'
