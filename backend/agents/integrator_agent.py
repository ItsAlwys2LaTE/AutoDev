import json
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
from retry import with_exponential_backoff, format_concise_error
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode

def generate_integration_stream(
    requirements: RequirementsDocument,
    decomposition: ComponentDecomposition,
    component_results: list,  # List[ComponentResult]
    previous_codebase: Optional[GeneratedCodeBase] = None,
    revision_plan: Optional[str] = None,
    mode: Optional[str] = None,
):
    primary_model, secondary_model = resolve_models_for_mode(mode)
    keys = get_gemini_keys_for_stage("INTEGRATION", mode=mode)
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
       with all dependencies from all components. Remove duplicates and ensure testing dependencies (such as vitest and jsdom for Node or pytest for Python) are present.
    4. DYNAMIC INTEGRATION TESTS & TEST RUNNER ROUTING: Write comprehensive integration test(s) matching the project's selected tech stack:
       - For Python/pytest projects: Generate `test_integration.py` (or `test_app.py`) with pytest assertions testing end-to-end user workflows across components. ALWAYS use raw string literals `r"..."` for all regular expressions to prevent Python 3.12+ `SyntaxWarning` / `SyntaxError` failures.
       - For Node.js/JavaScript/TypeScript projects:
         a) Test Separation: Unit and component tests run under Vitest in JSDOM; end-to-end browser workflows run in Playwright.
         b) File Naming Convention: Name all Playwright browser tests with the `.e2e.test.ts` or `.e2e.spec.ts` suffix, or place them strictly inside an `e2e/` directory (e.g., `e2e/checkout.test.ts`). Never mix Playwright `{ page }` fixtures into unit test files (`*.test.tsx`, `*.test.ts`, `*.test.js`).
          c) Package Scripts & Dev Server Configuration: When generating or updating `package.json`, you MUST configure BOTH development server and test scripts:
             - DEV SERVER SCRIPT: For React/Vite projects, you MUST include `"dev": "vite"` (or `"dev": "vite --host 0.0.0.0"`). For static Node web apps, include `"dev": "npx --yes serve -p 8080 -H 0.0.0.0"`.
             - TEST SCRIPTS:
               * `"test": "vitest run --exclude '**/*.e2e.*' --exclude '**/e2e/**'"`
               * `"test:unit": "vitest run --exclude '**/*.e2e.*' --exclude '**/e2e/**'"`
               * `"test:e2e": "playwright test"`
          d) Blueprint Alignment: The blueprint `run_tests_command` MUST specify `npm test` or `npm run test:unit` for automated sandbox validation cycles, preventing test runner collisions with Playwright fixtures during fast automated feedback loops.
          e) Playwright Setup & WebServer Compatibility: When generating Playwright tests, include `"@playwright/test": "1.48.0"` (EXACTLY this version) in the unified package.json to match docker image binaries. You MUST also generate a `playwright.config.js` with a `webServer` block:
             - For React/Vite projects: `command: 'npm run dev -- --host 0.0.0.0'`, `port: 5173`, `reuseExistingServer: !process.env.CI`.
             - Runtime Compatibility Mandate: `dev_server_command` and the Docker image MUST be strictly compatible. You are STRICTLY PROHIBITED from generating `python -m http.server` in `playwright.config.js` or `package.json` whenever the Docker image is Node or Playwright, as Python is not installed.
             - 0.0.0.0 Host Binding: All dev servers must explicitly bind to `0.0.0.0` to permit port forwarding.
         f) In React/Vite unit tests, Vitest runs in JSDOM with `src/setupTests.ts` pre-loaded (`window.matchMedia`, `ResizeObserver`, `@testing-library/jest-dom` matchers are globally available).
         g) For Vanilla HTML/JS projects, `"type": "module"` is enforced in `package.json`, so `__dirname` is undefined in ES module scope; resolve `index.html` using `process.cwd()` (e.g., `path.resolve(process.cwd(), 'index.html')`) or `import.meta.url`.
       - DATABASE TESTS: If testing a Node backend with MongoDB, use `mongodb-memory-server` to mock the DB in tests. Do NOT try connecting to a real local MongoDB instance.
       - Do NOT use `supertest` or any Node-only HTTP testing library. Vitest runs through Vite which cannot resolve them.
       - IMPORTANT: In ALL .jsx and .tsx test files, you MUST include `import React from 'react';` at the very top.
       - These tests must verify the seams between components (e.g., login -> browse -> add to cart -> checkout).
    5. SHARED STYLING: Ensure all components use consistent styling/theming. If components have separate 
       CSS files, create a shared base stylesheet or merge them.
    6. NO STUBS OR PLACEHOLDERS: Every file must contain complete, working code. Do not use '...', 'TODO', 
       or 'pass'.
    7. NO ROOT SUBDIRECTORIES: Output all files relative to the workspace root. Do NOT nest inside a 
       project subdirectory.
    8. Follow the integration_strategy from the ComponentDecomposition for guidance on routing, shared 
       state, and cross-component wiring.
    9. VITEST & MODERN JS (ESM) MANDATE: For JavaScript/Node/React projects, you MUST use Vitest instead of Jest to fully support modern ES modules (`import`/`export`).
       a) Always add `"type": "module"` in `package.json`.
       b) Include `vitest` and `jsdom` in devDependencies.
       c) Vitest is configured with `environment: 'jsdom'` and auto-loads `src/setupTests.ts` (with `@testing-library/jest-dom` and browser mocks). If generating a custom `vitest.config.js` or `vitest.config.mjs`, include `environment: 'jsdom'`.
       d) At the top of your test files, include `import { describe, it, test, expect } from 'vitest';`.
       e) DO NOT use CommonJS `require()` or `__dirname`. Because `"type": "module"` is enforced in `package.json`, `__dirname` is undefined in ES module scope; use `process.cwd()` (e.g. `path.resolve(process.cwd(), 'index.html')`) or `import.meta.url` for file path resolution.
       f) Do NOT use `supertest`. Test server logic by importing functions directly.
       g) Vite Server Configuration: When generating or modifying `vite.config.js` or `vite.config.ts`, include `server: { host: '0.0.0.0', port: 5173 }` so the development server automatically binds to `0.0.0.0` on port 5173 for Docker container port forwarding.
    10. REACT ICONS: If generating React apps, remember that "lucide-react" does NOT export brand icons (Facebook, Twitter, Instagram, GitHub, etc.). Do NOT import brand icons from lucide-react. Either use generic icons or use "react-icons" if brand icons are strictly required.
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

    system_prompt += f"\n\nCRITICAL: Your output MUST strictly match this JSON schema (output RAW JSON only):\n{json.dumps(GeneratedCodeBase.model_json_schema())}"

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

    print(f"Integration Agent is merging all components into final product using {primary_model} (Model: {primary_model})...")
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
                )
            )

        try:
            response = _get_stream(primary_model)
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
            print(f"Primary model ({primary_model}) on key {idx+1} failed in Integration Agent: {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model}) in Integration Agent...")
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
                            )
                        )
                    try:
                        response = _get_fallback_stream(secondary_model)
                        for chunk in response:
                            if getattr(chunk, 'text', None):
                                yield chunk.text
                        return
                    except Exception as fallback_error:
                        yield '\n__RESET__\n'
                        print(f"Fallback model ({secondary_model}) on key {fb_idx+1} failed in Integration Agent: {format_concise_error(fallback_error)}")
                        if fb_idx + 1 < len(keys):
                            continue
                        yield f'{{"error": "Both models failed in Integration Agent: {format_concise_error(fallback_error)}"}}'
                        return

