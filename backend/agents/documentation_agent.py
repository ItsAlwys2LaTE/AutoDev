import json
from google import genai
from google.genai import types
import os
import sys

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, CodeFile
from retry import with_exponential_backoff, format_concise_error
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode
from pydantic import BaseModel, Field
from typing import List

class DocumentationSet(BaseModel):
    files: List[CodeFile] = Field(description="List of documentation files")


def create_fallback_documentation_set(
    requirements: RequirementsDocument,
    blueprint: SystemDesignBlueprint,
    codebase: GeneratedCodeBase,
) -> DocumentationSet:
    """Generates high-quality fallback README.md and USER_GUIDE.md files deterministically."""
    title = requirements.project_title if requirements and requirements.project_title else "Software Project"
    overview = requirements.overview if requirements and requirements.overview else "Autonomous software application developed with AutoDev."
    tech_stack = ", ".join(blueprint.tech_stack) if blueprint and blueprint.tech_stack else "Fullstack"

    readme_content = f"""# {title}

{overview}

## Architecture & Technology Stack
- **Tech Stack**: {tech_stack}
- **Container Environment**: {blueprint.docker_image if blueprint and blueprint.docker_image else "python:3.11-slim"}

## Codebase Structure
The project contains the following modules:
"""
    if codebase and codebase.files:
        for f in codebase.files:
            readme_content += f"- `{f.file_name}`\n"
    else:
        readme_content += "- Application source files\n"

    readme_content += """
## Getting Started

### Installation
Clone this repository and install necessary dependencies:
```bash
pip install -r requirements.txt
```

### Running the Application
```bash
python main.py
```

### Running Automated Tests
```bash
pytest
```
"""

    user_guide_content = f"""# {title} - User Guide

## Overview
{overview}

## Key Features & Capabilities
"""
    if requirements and requirements.user_stories:
        for idx, story in enumerate(requirements.user_stories, 1):
            user_guide_content += f"### {idx}. {story.title}\n"
            user_guide_content += f"As a {story.as_a}, I want to {story.i_want_to} so that {story.so_that}.\n\n"
            if story.acceptance_criteria:
                user_guide_content += "**Acceptance Criteria:**\n"
                for ac in story.acceptance_criteria:
                    user_guide_content += f"- {ac.description}: {ac.expected_behavior}\n"
                user_guide_content += "\n"
    else:
        user_guide_content += """### 1. Primary Feature Set
Refer to the application specifications in `README.md` for running and interacting with the system.
"""

    return DocumentationSet(files=[
        CodeFile(file_name="README.md", source_code=readme_content.strip()),
        CodeFile(file_name="USER_GUIDE.md", source_code=user_guide_content.strip())
    ])


def generate_documentation_stream(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, mode: str = None):
    primary_model, secondary_model = resolve_models_for_mode(mode)
    keys = get_gemini_keys_for_stage("DOCUMENTATION", mode=mode)
    primary_key = os.environ.get("GEMINI_API_KEY_DOCUMENTATION") or os.environ.get("GEMINI_API_KEY_7") or os.environ.get("GEMINI_API_KEY_REQUIREMENTS") or os.environ.get("GEMINI_API_KEY_1")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    if not keys:
        print("No API keys configured for documentation. Yielding fallback documentation set.")
        fallback = create_fallback_documentation_set(requirements, blueprint, codebase)
        yield fallback.model_dump_json(indent=2)
        return


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

    system_prompt += f"\n\nCRITICAL: Your output MUST strictly match this JSON schema (output RAW JSON only):\n{json.dumps(DocumentationSet.model_json_schema())}"

    prompt_content = f"""
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}

    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}

    FINAL CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """

    print(f"Documentation Agent is generating documentation using {primary_model} (Model: {primary_model})...")
    for idx, key in enumerate(keys):
        try:
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
                    )
                )

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
            print(f"Documentation Agent failed on key {idx+1}: {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model}) in Documentation Agent...")
                for fb_idx, fb_key in enumerate(keys):
                    try:
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
                                )
                            )

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
                        print(f"Fallback model ({secondary_model}) on key {fb_idx+1} failed in Documentation Agent: {format_concise_error(fallback_e)}")
                        if fb_idx + 1 < len(keys):
                            continue
                        print("All documentation model attempts failed. Yielding deterministic fallback documentation set...")
                        fallback = create_fallback_documentation_set(requirements, blueprint, codebase)
                        yield fallback.model_dump_json(indent=2)
                        return


