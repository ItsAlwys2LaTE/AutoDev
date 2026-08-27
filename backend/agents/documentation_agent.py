from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, CodeFile
from pydantic import BaseModel, Field
from typing import List

class DocumentationSet(BaseModel):
    files: List[CodeFile] = Field(description="List of documentation files")

def generate_documentation_stream(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase):
    api_key = os.environ.get("GEMINI_API_KEY_REQUIREMENTS")
    if not api_key:
        raise ValueError("GEMINI_API_KEY_REQUIREMENTS is not set in the environment variables.")

    client = genai.Client(api_key=api_key)

    system_prompt = \"\"\"
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
    \"\"\"

    prompt_content = f\"\"\"
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}

    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}

    FINAL CODEBASE:
    {codebase.model_dump_json(indent=2)}
    \"\"\"

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

    last_usage = None
    try:
        stream = get_stream("gemini-3.6-flash")
        for chunk in stream:
            if chunk.text:
                yield chunk.text
            if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata is not None:
                last_usage = chunk.usage_metadata
        if last_usage:
            yield f"__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
    except Exception as e:
        print(f"Documentation Agent failed: {e}. Falling back to gemini-3.5-flash-lite...")
        try:
            fallback_stream = get_stream("gemini-3.5-flash-lite")
            for chunk in fallback_stream:
                if chunk.text:
                    yield chunk.text
                if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata is not None:
                    last_usage = chunk.usage_metadata
            if last_usage:
                yield f"__USAGE__{last_usage.prompt_token_count},{last_usage.candidates_token_count}"
        except Exception as fallback_e:
            yield f'{{"error": "API Error during documentation generation: {str(fallback_e)}" }}'
