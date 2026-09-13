import os
import sys
import json
import logging
from typing import Generator, List, Optional, Set, Tuple, Union, Any

# Ensure import paths resolve correctly
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_current_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from google import genai
from google.genai import types

from models import (
    CodeFile,
    GeneratedCodeBase,
    SystemDesignBlueprint,
    RefactorOutput,
)
from retry import with_exponential_backoff, format_concise_error
from key_balancer import (
    get_gemini_keys_for_stage,
    is_rate_limit_error,
    resolve_models_for_mode,
    get_generation_mode,
)

logger = logging.getLogger("autodev.refactor_agent")

REFACTOR_SYSTEM_PROMPT = r"""
You are an Expert Senior Software Engineer and Precision Refactoring Specialist.
You are given:
1. An existing, functional software codebase (JSON).
2. The System Design Blueprint detailing the architecture and tech stack.
3. A user request to modify styling/theming, add a new feature, fix a bug, or adjust behavior.

YOUR MISSION:
Implement the requested changes with surgical precision.

CRITICAL REFACTORING LAWS:
1. SELECTIVE OUTPUT (DO NOT REWRITE EVERYTHING):
   - You must identify the MINIMAL set of files required to satisfy the user request.
   - Return ONLY files that are modified or newly created in the `modified_files` array.
   - DO NOT include files that remain unchanged. Leaving untouched files out of your output guarantees they remain byte-identical.
2. COMPLETE SOURCE CODE (NO PLACEHOLDERS / NO DIFFS):
   - For every file in `modified_files`, you MUST provide the ENTIRE, complete, runnable source code for that file.
   - NEVER use diff notation (`+`, `-`), ellipsis (`...`), `TODO`, or placeholders (`/* existing code unchanged */`). The file will overwrite the existing file completely.
3. PRESERVE EXISTING ARCHITECTURE & CONTRACTS:
   - Respect the existing language, framework, styling methodology (e.g. Tailwind CSS, CSS modules), and naming conventions.
   - If adding a form field or UI component, update the relevant component, state handlers, and validation schemas.
   - If adding a new file, ensure other modified files import and utilize it properly.
4. DEPENDENCY DISCIPLINE:
   - If a new external library is strictly required, update `package.json` or `requirements.txt` and include it in `modified_files`.
   - For React projects, modern ES modules (`"type": "module"`) are mandatory. Do NOT use CommonJS `require()`.
   - Never import brand icons from "lucide-react" (it will crash the app).
5. DEFENSIVE PROGRAMMING:
   - Ensure the updated code compiles cleanly and passes build verification (`npm run build` or unit tests).
   - In Python, ALWAYS use raw string literals `r"..."` for all regular expressions (e.g. `re.search(r"\d+", text)`).
"""

QUERY_SYSTEM_PROMPT = """
You are a Principal Software Architect and Lead Codebase Mentor.
You are provided with an existing, functional application codebase and its technical blueprint.
A developer or stakeholder is asking a technical question about the system.

YOUR INSTRUCTIONS:
1. Provide a comprehensive, accurate, and crystal-clear technical explanation answering the user's question.
2. Cite specific files, functions, components, state hooks, and architectural patterns present in the codebase.
3. FORMAT AS CLEAN, WELL-STRUCTURED HUMAN-READABLE TEXT (NOT RAW MARKDOWN):
   Format your explanation cleanly and professionally, structured like technical Project Requirements and System Design specifications:
   - Use clear, capitalized section headers followed by a colon (e.g. OVERVIEW:, ARCHITECTURE & KEY PATTERNS:, IMPLEMENTATION DETAILS:, RELEVANT FILES & FUNCTIONS:, RECOMMENDATIONS:).
   - Use clean bullet points (•) with clear indentation for lists.
   - For code references, cite the exact file path and function name clearly (e.g. "File: src/App.tsx -> Function: handleCheckout()").
   - For code snippets, format them with 2-space indentation under a clear label (e.g. "CODE EXAMPLE:\n  const [state, setState] = useState(initialState);").
   - Avoid raw markdown syntax clutter: do NOT use excessive hashes (###), raw asterisks (**bold**), or raw pipe table syntax (|---|---|). Write clean, human-readable text.
4. If asked about extending or integrating the application, provide concrete recommendations aligned with the existing architecture.
5. YOU ARE STRICTLY AN ANALYST AND ADVISOR. You do NOT modify any files. The codebase must remain 100% untouched.
"""


def merge_refactored_codebase(
    original_codebase: GeneratedCodeBase,
    refactor_output: RefactorOutput,
) -> Tuple[GeneratedCodeBase, List[str]]:
    """
    Merges modified/new files from RefactorOutput into the original codebase.

    Guarantees:
    1. Untouched files retain their exact original CodeFile instances and byte contents (100% byte-identical).
    2. Modified files are replaced in-place, preserving the original file_name casing.
    3. Newly created files are appended to the codebase.
    4. Path normalization handles mixed slashes ('\\' vs '/') and './' prefixes cleanly.
    """
    def normalize_path(path: str) -> str:
        if not path:
            return ""
        return path.replace("\\", "/").strip().lstrip("./").lower()

    if not original_codebase or not hasattr(original_codebase, "files") or original_codebase.files is None:
        original_files: List[CodeFile] = []
    else:
        original_files = original_codebase.files

    if not refactor_output or not hasattr(refactor_output, "modified_files") or not refactor_output.modified_files:
        return GeneratedCodeBase(files=list(original_files)), []

    # Map normalized path to CodeFile
    mod_map = {normalize_path(f.file_name): f for f in refactor_output.modified_files if f and f.file_name}

    merged_files: List[CodeFile] = []
    touched_paths: Set[str] = set()
    modified_file_names: List[str] = []

    # 1. Process existing files: preserve or replace
    for original_file in original_files:
        orig_name = original_file.file_name if hasattr(original_file, "file_name") else original_file.get("file_name", "")
        norm_orig = normalize_path(orig_name)
        if norm_orig in mod_map:
            updated_file = mod_map[norm_orig]
            upd_code = updated_file.source_code if hasattr(updated_file, "source_code") else updated_file.get("source_code", "")
            merged_files.append(CodeFile(
                file_name=orig_name,
                source_code=upd_code,
            ))
            touched_paths.add(norm_orig)
            modified_file_names.append(orig_name)
        else:
            # Untouched: keep EXACT original object reference and byte content if CodeFile
            if isinstance(original_file, CodeFile):
                merged_files.append(original_file)
            else:
                orig_code = original_file.source_code if hasattr(original_file, "source_code") else original_file.get("source_code", "")
                merged_files.append(CodeFile(file_name=orig_name, source_code=orig_code))

    # 2. Process genuinely new files (not present in original codebase)
    for mod_file in refactor_output.modified_files:
        if not mod_file:
            continue
        mod_name = mod_file.file_name if hasattr(mod_file, "file_name") else mod_file.get("file_name", "")
        if not mod_name:
            continue
        norm_mod = normalize_path(mod_name)
        if norm_mod not in touched_paths:
            safe_name = mod_name.replace("\\", "/").strip().lstrip("./")
            mod_code = mod_file.source_code if hasattr(mod_file, "source_code") else mod_file.get("source_code", "")
            merged_files.append(CodeFile(
                file_name=safe_name,
                source_code=mod_code,
            ))
            touched_paths.add(norm_mod)
            modified_file_names.append(safe_name)

    return GeneratedCodeBase(files=merged_files), modified_file_names


def _extract_refactor_output(resp: Any) -> RefactorOutput:
    """Helper to parse RefactorOutput from SDK response."""
    if hasattr(resp, "parsed") and resp.parsed is not None:
        if isinstance(resp.parsed, RefactorOutput):
            return resp.parsed
        return RefactorOutput.model_validate(resp.parsed)

    text = getattr(resp, "text", "") or ""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return RefactorOutput.model_validate_json(text.strip())


def refactor_codebase(
    prompt: str,
    codebase: GeneratedCodeBase,
    blueprint: Optional[SystemDesignBlueprint] = None,
    mode: Optional[str] = None,
) -> RefactorOutput:
    """
    Executes selective codebase refactoring with Gemini API key rotation and model fallback.
    Returns RefactorOutput containing summary and ONLY modified/new files.
    """
    active_mode = (mode or get_generation_mode()).upper()
    primary_model, secondary_model = resolve_models_for_mode(active_mode)

    keys = get_gemini_keys_for_stage("CODEGEN", mode=active_mode)
    primary_key = (
        os.environ.get("GEMINI_API_KEY_CODEGEN")
        or os.environ.get("GEMINI_API_KEY_REQUIREMENTS")
        or os.environ.get("GEMINI_API_KEY_1")
    )
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys

    if not keys:
        raise ValueError("No Gemini API keys configured for refactoring.")

    prompt_content = f"""USER REFACTORING REQUEST:
{prompt}

EXISTING CODEBASE:
{codebase.model_dump_json(indent=2) if hasattr(codebase, 'model_dump_json') else json.dumps(codebase)}
"""
    if blueprint:
        prompt_content += f"""
SYSTEM DESIGN BLUEPRINT:
{blueprint.model_dump_json(indent=2) if hasattr(blueprint, 'model_dump_json') else json.dumps(blueprint)}
"""

    prompt_content += f"""
Analyze the codebase and execute the requested modification with surgical precision.
Return ONLY the files that were modified or newly created matching this JSON schema:
{json.dumps(RefactorOutput.model_json_schema())}
"""

    last_error: Optional[Exception] = None

    # Multi-tier invocation with key rotation
    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _call_primary():
            resp = client.models.generate_content(
                model=primary_model,
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=REFACTOR_SYSTEM_PROMPT,
                    temperature=0.2,
                    response_mime_type="application/json",
                    response_schema=RefactorOutput,
                ),
            )
            return _extract_refactor_output(resp)

        try:
            return _call_primary()
        except Exception as e:
            last_error = e
            logger.warning(f"Refactor primary model ({primary_model}) failed on key {idx+1}/{len(keys)}: {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                continue

            # Fallback to secondary model across all keys
            for fb_idx, fb_key in enumerate(keys):
                fb_client = genai.Client(api_key=fb_key)

                @with_exponential_backoff
                def _call_fallback():
                    resp = fb_client.models.generate_content(
                        model=secondary_model,
                        contents=prompt_content,
                        config=types.GenerateContentConfig(
                            system_instruction=REFACTOR_SYSTEM_PROMPT,
                            temperature=0.2,
                            response_mime_type="application/json",
                            response_schema=RefactorOutput,
                        ),
                    )
                    return _extract_refactor_output(resp)

                try:
                    return _call_fallback()
                except Exception as fb_err:
                    last_error = fb_err
                    logger.warning(f"Refactor fallback model ({secondary_model}) failed on key {fb_idx+1}/{len(keys)}: {format_concise_error(fb_err)}")
                    if fb_idx + 1 < len(keys):
                        continue
                    raise fb_err

    if last_error:
        raise last_error
    raise RuntimeError("Failed to refactor codebase across all available keys and models.")


def stream_codebase_query(
    prompt: str,
    codebase: GeneratedCodeBase,
    blueprint: Optional[SystemDesignBlueprint] = None,
    mode: Optional[str] = None,
) -> Generator[str, None, None]:
    """
    Streams a conversational technical explanation answering the user's query about the codebase.
    Guarantees 0 file mutations.
    """
    active_mode = (mode or get_generation_mode()).upper()
    primary_model, secondary_model = resolve_models_for_mode(active_mode)

    keys = get_gemini_keys_for_stage("DOCUMENTATION", mode=active_mode)
    primary_key = (
        os.environ.get("GEMINI_API_KEY_DOCUMENTATION")
        or os.environ.get("GEMINI_API_KEY_7")
        or os.environ.get("GEMINI_API_KEY_CODEGEN")
        or os.environ.get("GEMINI_API_KEY_1")
    )
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys

    if not keys:
        yield "Error: No Gemini API keys configured for codebase query."
        return

    prompt_content = f"""USER QUERY:
{prompt}

APPLICATION CODEBASE (READ-ONLY):
{codebase.model_dump_json(indent=2) if hasattr(codebase, 'model_dump_json') else json.dumps(codebase)}
"""
    if blueprint:
        prompt_content += f"""
SYSTEM DESIGN BLUEPRINT:
{blueprint.model_dump_json(indent=2) if hasattr(blueprint, 'model_dump_json') else json.dumps(blueprint)}
"""

    prompt_content += "\nPlease provide a thorough, accurate explanation based strictly on the provided codebase."

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _get_stream(model_name: str):
            return client.models.generate_content_stream(
                model=model_name,
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=QUERY_SYSTEM_PROMPT,
                    temperature=0.3,
                ),
            )

        try:
            stream = _get_stream(primary_model)
            for chunk in stream:
                if getattr(chunk, "text", None):
                    yield chunk.text
            return
        except Exception as e:
            yield "\n__RESET__\n"
            logger.warning(f"Query streaming failed on key {idx+1}/{len(keys)}: {format_concise_error(e)}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                continue

            # Fallback to secondary model
            for fb_idx, fb_key in enumerate(keys):
                fb_client = genai.Client(api_key=fb_key)

                @with_exponential_backoff
                def _get_fb_stream(model_name: str):
                    return fb_client.models.generate_content_stream(
                        model=model_name,
                        contents=prompt_content,
                        config=types.GenerateContentConfig(
                            system_instruction=QUERY_SYSTEM_PROMPT,
                            temperature=0.3,
                        ),
                    )

                try:
                    fb_stream = _get_fb_stream(secondary_model)
                    for chunk in fb_stream:
                        if getattr(chunk, "text", None):
                            yield chunk.text
                    return
                except Exception as fb_err:
                    logger.warning(f"Query fallback failed on key {fb_idx+1}/{len(keys)}: {format_concise_error(fb_err)}")
                    if fb_idx + 1 < len(keys):
                        continue
                    yield f"\nError generating explanation: {format_concise_error(fb_err)}"
                    return


class RefactorAgent:
    """
    Targeted Refactoring and Codebase Inspection Agent.
    Provides selective surgical refactoring of existing codebases,
    byte-identical invariance merging, and read-only technical Q&A streaming.
    """
    def __init__(self, mode: Optional[str] = None):
        self.mode = mode

    def refactor_codebase(
        self,
        prompt: str,
        codebase: GeneratedCodeBase,
        blueprint: Optional[SystemDesignBlueprint] = None,
        mode: Optional[str] = None,
    ) -> RefactorOutput:
        return refactor_codebase(
            prompt=prompt,
            codebase=codebase,
            blueprint=blueprint,
            mode=mode or self.mode,
        )

    def merge_refactored_codebase(
        self,
        codebase: GeneratedCodeBase,
        refactor_output: RefactorOutput,
    ) -> Tuple[GeneratedCodeBase, List[str]]:
        return merge_refactored_codebase(codebase, refactor_output)

    def stream_codebase_query(
        self,
        prompt: str,
        codebase: GeneratedCodeBase,
        blueprint: Optional[SystemDesignBlueprint] = None,
        mode: Optional[str] = None,
    ) -> Generator[str, None, None]:
        return stream_codebase_query(
            prompt=prompt,
            codebase=codebase,
            blueprint=blueprint,
            mode=mode or self.mode,
        )

    # Shorthand alias methods
    refactor = refactor_codebase
    merge = merge_refactored_codebase
    query = stream_codebase_query
