from google import genai
from google.genai import types
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, ComponentDecomposition
from retry import with_exponential_backoff

def decompose_requirements_stream(requirements: RequirementsDocument):
    api_key = os.environ.get("GEMINI_API_KEY_ADJUDICATOR")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_ADJUDICATOR is not set in the environment variables.")

    client = genai.Client(api_key=api_key)

    system_prompt = """
    You are a Master Software Architect with decades of experience decomposing large-scale systems. 
    You are given a structured Requirements Document (JSON) for a software product.
    
    Your task is to analyze the complexity of the product and decide whether it needs to be decomposed 
    into smaller, independently buildable components.
    
    CRITICAL DECISION RULES:
    1. SIMPLE PRODUCTS (is_complex = false): If the product has 2 or fewer user stories, OR is a single-purpose 
       utility (e.g., "calculator", "email validator", "todo list", "timer app"), set is_complex to false. 
       Return an empty components list. The product will be built in a single pass.
    2. COMPLEX PRODUCTS (is_complex = true): If the product has 3+ user stories spanning multiple distinct 
       functional areas (e.g., auth + catalog + cart + admin), decompose it into components.
    
    DECOMPOSITION RULES (when is_complex = true):
    1. Each component MUST be independently buildable and testable as a standalone mini-application.
    2. NO circular dependencies between components. Use a DAG (directed acyclic graph) ordering.
    3. Foundational components (e.g., shared data models, auth system, database layer) must have lower 
       priority_order numbers so they are built first.
    4. Each component's scoped_requirements MUST be detailed enough for a Design Agent to independently 
       produce a complete architectural blueprint WITHOUT seeing the original full requirements. Include 
       specific user stories, acceptance criteria, UI descriptions, and data models relevant to that component.
    5. The shared_tech_stack and shared_docker_image MUST be consistent across all components to ensure 
       they can be integrated later.
    6. The integration_strategy MUST describe exactly how to wire the components together: shared routing 
       file structure, navigation patterns, shared CSS/theming, state management, and cross-component imports.
    7. Aim for 3-6 components. Fewer than 3 means the product probably isn't complex enough. More than 6 
       means components are too granular and will create integration nightmares.
    8. component_id must be unique kebab-case identifiers (e.g., 'user-auth', 'product-catalog', 'shopping-cart').
    """

    prompt_content = f"""
    REQUIREMENTS DOCUMENT:
    {requirements.model_dump_json(indent=2)}
    
    Analyze this product and produce the ComponentDecomposition.
    """

    @with_exponential_backoff
    def _get_stream(model_name: str):
        return client.models.generate_content_stream(
            model=model_name,
            contents=prompt_content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=ComponentDecomposition,
            )
        )

    print("Master Architect is analyzing product complexity...")

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
        print(f"Primary model (3.6-flash) failed in Master Architect: {e}. Falling back to 3.5-flash-lite...")
        try:
            response = _get_stream("gemini-3.5-flash-lite")
            for chunk in response:
                yield chunk.text
        except Exception as fallback_error:
            yield f'{{"error": "Both models failed in Master Architect: {fallback_error}"}}'
