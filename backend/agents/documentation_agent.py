from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, CodeFile
from retry import with_exponential_backoff
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode
from pydantic import BaseModel, Field
from typing import List

class DocumentationSet(BaseModel):
    files: List[CodeFile] = Field(description="List of documentation files")

def generate_documentation_stream(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, mode: str = None):
    primary_model, secondary_model = resolve_models_for_mode(mode)
    keys = get_gemini_keys_for_stage("DOCUMENTATION", mode=mode)
    primary_key = os.environ.get("GEMINI_API_KEY_DOCUMENTATION") or os.environ.get("GEMINI_API_KEY_7") or os.environ.get("GEMINI_API_KEY_REQUIREMENTS") or os.environ.get("GEMINI_API_KEY_1")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        raise ValueError("GEMINI_API_KEY_DOCUMENTATION is not set in the environment variables.")


    system_prompt = """
    You are an Expert Technical Writer and Developer Advocate.
    The engineering team has just finished building a software project. 
    You are provided with the Requirements, Architecture Blueprint, and the Final Codebase.

    Your task is to generate the standard documentation files for this project.
    
    CRITICAL INSTRUCTIONS:
    1. Generate exactly two files:
       - 'README.md': A professional README with a project description, setup instructions, and feature overview.
       - 'USER_GUIDE.md': A detailed user guide explaining how to use the specific features outlined in the requirements.
    2. Format the output STRICTLY as a DocumentationSet JSON object containing a list of 'CodeFile' objects.
    3. Use rich markdown formatting (headers, code blocks, bold text) inside the source_code strings.
    """

    prompt_content = f"""
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}

    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}

    FINAL CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def get_stream(model_name: str):
            return client.models.generate_content_stream(
                model=model_name,
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.3,
                    response_mime_type="application/json",
                    response_schema=DocumentationSet,
                )
            )

        print(f"Documentation Agent is generating documentation using {primary_model} (Model: {primary_model}) (key {idx+1}/{len(keys)})...")
        try:
            stream = get_stream(primary_model)
            last_usage = None
            for chunk in stream:
                if getattr(chunk, 'text', None):
                    yield chunk.text
                if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata is not None:
                    last_usage = chunk.usage_metadata
            if last_usage:
                yield f"\n__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
            return
        except Exception as e:
            yield '\n__RESET__\n'
            print(f"Documentation Agent failed on key {idx+1} ({e})")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model}) in Documentation Agent...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def get_fallback_stream(model_name: str):
                        return fb_client.models.generate_content_stream(
                            model=model_name,
                            contents=prompt_content,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                                temperature=0.3,
                                response_mime_type="application/json",
                                response_schema=DocumentationSet,
                            )
                        )
                    try:
                        fallback_stream = get_fallback_stream(secondary_model)
                        last_usage = None
                        for chunk in fallback_stream:
                            if getattr(chunk, 'text', None):
                                yield chunk.text
                            if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata is not None:
                                last_usage = chunk.usage_metadata
                        if last_usage:
                            yield f"\n__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
                        return
                    except Exception as fallback_e:
                        print(f"Fallback model ({secondary_model}) on key {fb_idx+1} failed: {fallback_e}")
                        if fb_idx + 1 < len(keys):
                            continue
                        yield f'{{"error": "API Error during documentation generation: {str(fallback_e)}" }}'
                        return

