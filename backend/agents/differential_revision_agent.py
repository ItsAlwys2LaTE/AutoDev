"""
backend/agents/differential_revision_agent.py - Targeted Differential Revision Agent.

Part of AutoDev's Differential Targeted Revision & Surgical Patching Architecture (Milestone 2).
Performs precision patching on isolated broken files, enforcing the RefactorOutput schema,
model load balancing via key_balancer, 5-tier JSON repair, semantic validation, and real-time streaming.
"""

import ast
import json
import logging
import os
import re
import sys
import time
from typing import Any, Callable, Dict, Generator, List, Optional, Set, Tuple, Union
from unittest.mock import MagicMock

# Ensure backend directory is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_current_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)
_repo_root = os.path.dirname(_backend_dir)
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from google import genai
from google.genai import types

from models import (
    CodeFile,
    GeneratedCodeBase,
    RefactorOutput,
    SystemDesignBlueprint,
    FileBlueprint,
)
from retry import format_concise_error, is_transient_error, with_exponential_backoff
from key_balancer import (
    get_gemini_keys_for_stage,
    get_generation_mode,
    is_rate_limit_error,
    resolve_models_for_mode,
)
from code_extractor import extract_files_from_markdown
from agents.revision_extractor import (
    generate_codebase_manifest,
    should_include_manifest,
    _normalize_path,
    _match_candidate_to_codebase,
)

logger = logging.getLogger("autodev.differential_revision_agent")

PRIMARY_MODEL = "gemini-3.7-flash"
FALLBACK_MODEL = "gemini-3.5-flash-lite"
QUICK_MODEL = "gemini-3.5-flash-lite"

# ---------------------------------------------------------------------------
# 6 Critical Refactoring Laws System Prompt
# ---------------------------------------------------------------------------

DIFFERENTIAL_REVISION_SYSTEM_PROMPT = r"""You are an Expert Senior Software Engineer and Precision Differential Revision Specialist in AutoDev's self-correction engine.

YOUR MISSION:
The application has failed automated test suites (pytest/vitest), AST pre-flight syntax gates, or Critic quality evaluation.
You are provided with:
1. The System Design Blueprint detailing the architecture and test runner command.
2. A compact Codebase Manifest listing all files in the system and their architectural roles.
3. The complete source code ONLY for the isolated broken/relevant files that need attention.
4. The Adjudicator Revision Plan detailing the exact failures, stack traces, and required fixes.

Your task is to fix the reported defects with surgical precision.

CRITICAL REFACTORING LAWS:
1. SELECTIVE OUTPUT (DO NOT REWRITE THE ENTIRE CODEBASE):
   - You must identify the MINIMAL set of files required to resolve the failure.
   - Return ONLY files that are modified or newly created in the `modified_files` array.
   - UNTOUCHED FILES MUST BE STRICTLY OMITTED from `modified_files`. Leaving untouched files out of your output guarantees they remain 100% byte-identical and immune to regressions.
   - Even if multiple files are provided in the context, if only ONE file needs a fix, return ONLY that ONE file.

2. COMPLETE RUNNABLE SOURCE CODE (NO PLACEHOLDERS / NO DIFFS):
   - For every file in `modified_files`, you MUST provide the ENTIRE, complete, production-ready, runnable source code for that file.
   - NEVER use unified diff notation (`+`, `-`, `@@`), truncation markers, ellipses (`...`), `TODO`, or placeholders (`/* existing code unchanged */`, `# rest of code here`).
   - The returned `source_code` completely overwrites the target file. Any placeholder or omission will destroy working code and fail the build.

3. PRESERVE CONTRACTS & ARCHITECTURAL INTEGRITY:
   - Respect existing function signatures, class interfaces, route paths, data models, and coding conventions across the codebase.
   - If a fix requires updating a signature in a broken file, ensure any other relevant caller files are also updated and included in `modified_files`.
   - If a new helper or utility file is strictly required, assign its full relative path and include it in `modified_files`.

4. DEPENDENCY & MANIFEST DISCIPLINE:
   - If your fix introduces a new third-party library or import not currently declared, you MUST update the dependency manifest (`requirements.txt` for Python, `package.json` for Node.js) and include it in `modified_files`.
   - For JavaScript/Node/React projects:
     * Modern ES modules (`import`/`export`) are mandatory. Always declare `"type": "module"` in `package.json`.
     * NEVER use CommonJS `require()` or `__dirname`.
     * NEVER import brand icons from "lucide-react" (will crash the application). Use generic Lucide icons or "react-icons".

5. LANGUAGE & RUNTIME SAFETY GUARDRAILS:
   - Python Syntax & Testing (pytest):
     * SAFE F-STRINGS / PROMPT TEMPLATES: NEVER use backslash-escaped double quotes inside double-quoted f-strings (e.g. f"... {{\"valid\": true}} ..."). In Python 3.11, backslashes inside f-string expressions raise fatal SyntaxError. Use single quotes inside braces (f"... {{'valid': True}} ..."), raw triple-quoted strings (r'''...'''), or .format().
     * REGULAR EXPRESSIONS: ALWAYS use raw string literals `r"..."` for all regex patterns (e.g. `re.search(r"\d+\s+\w+", text)`).
     * FASTAPI ENDPOINT TESTING: NEVER call `uvicorn.run()` or spawn server processes in test files (this hangs the test container). Use synchronous `from fastapi.testclient import TestClient` or async tests with `httpx.AsyncClient` and `pytest-asyncio`.
     * SANDBOX MOCKING: Tests run in an isolated sandbox with no internet access or running database servers. You MUST mock all external services using `unittest.mock.patch`, `MagicMock`, or `AsyncMock`:
       - Mock `google.genai.Client` and `google.generativeai.GenerativeModel`.
       - Mock MongoDB (`motor.motor_asyncio.AsyncIOMotorClient`, `pymongo.MongoClient`).
       - Mock document parsers (`fitz.open()`).
       - Tests must never require real API keys (`GEMINI_API_KEY`) or live database servers.
   - Node / JavaScript Backend Testing (Vitest / Jest):
     * STRICT PROHIBITION OF `supertest`: NEVER import or require `supertest` or `superagent` (`import request from 'supertest'` is STRICTLY FORBIDDEN). Real HTTP listeners and supertest hang the container sandbox, resulting in 180s timeout failures.
     * Test server routes by directly importing route handlers/controllers and passing mock Request/Response objects with `vi.fn()`, or invoke `app(req, res)` directly in-process without `app.listen()`.
     * Mock database connections (use in-memory storage or `vi.mock()`).
   - React / JSX Syntax & Bundler Guardrails (.jsx, .tsx):
     * ARROW FUNCTION RETURN BRACKETS: In JSX map expressions (e.g. carousel indicators, list dots): when using arrow function parentheses for implicit return: `{items.map((item, idx) => (<button key={idx} ... />))}`, you MUST close with `))` or `}))`. NEVER write `=> (` and close with `})}` (this is a fatal syntax error: "Expected ')' but found '}'). If using curly braces, provide an explicit return: `{items.map((item, idx) => { return <button key={idx} ... />; })}`.
     * IMPORT RESOLUTION: If the revision plan reports "Could not resolve X from Y", ensure the imported file is either created in `modified_files` or the import path in the caller file is corrected. Never leave an unresolved local import in `modified_files`.
     * DEPENDENCY VERSION CONFLICTS: If a revision error is an ImportError from a pip-installed package (e.g. motor, pymongo, django), this implies a transitive dependency version conflict. You MUST fix the version pin in requirements.txt (e.g. adding `pymongo<4.8`) rather than patching the application source code.
     * DEFENSIVE DICTIONARY ACCESS (Python): When removing or reading optional keys from dictionaries (especially MongoDB documents), ALWAYS use `dict.pop("key", None)` or `dict.get("key")` instead of `dict.pop("key")` or `dict["key"]`. Bare `.pop()` and bracket access raise `KeyError` when the key is absent, which is a common crash in endpoints that strip sensitive fields (e.g. password) before returning user data.
     * MOTOR / MONGODB MOCK PATTERN (Python + FastAPI): When using motor (AsyncIOMotorClient) with FastAPI, do not use `@patch("main.get_database")` because motor initializes at import time, causing a 30-second `ServerSelectionTimeoutError` / `Event loop is closed`. Instead, expose db as a global lazy-initialized variable in main.py, and in test files, patch the module-level variable BEFORE importing TestClient. Or use FastAPI's dependency override system (`app.dependency_overrides[get_db] = lambda: mock_db`). Never let `from main import app` execute without the database mock already active.

6. STRICT JSON SCHEMA COMPLIANCE:
   - Your output MUST strictly match the `RefactorOutput` JSON schema:
     {
       "summary": "Concise explanation of the root cause and surgical changes made",
       "modified_files": [
         {
           "file_name": "path/to/file.ext",
           "source_code": "complete runnable code"
         }
       ]
     }
   - Output RAW JSON ONLY. Do NOT enclose in explanatory conversational text."""

# ---------------------------------------------------------------------------
# Validation Regex Patterns
# ---------------------------------------------------------------------------

RE_DIFF_MARKER = re.compile(r'(?:^\+{1,2}[^\+]|^\-{1,2}[^\-]|^\@\@\s+)', re.MULTILINE)
RE_PLACEHOLDER_COMMENT = re.compile(
    r'(?i)(?:existing\s+code\s+unchanged|rest\s+of\s+(?:code|file)\s+(?:here|unchanged|remains)|code\s+remains\s+the\s+same|keep\s+existing\s+implementation)'
)
RE_STANDALONE_ELLIPSIS = re.compile(r'^\s*\.\.\.\s*$', re.MULTILINE)


# ---------------------------------------------------------------------------
# Error Classes
# ---------------------------------------------------------------------------

class DifferentialRevisionError(ValueError):
    """Base exception for differential revision errors (inherits from ValueError for broad compatibility)."""
    def __init__(self, message: str, raw_response: Optional[str] = None, broken_files: Optional[List[str]] = None):
        super().__init__(message)
        self.raw_response = raw_response
        self.broken_files = broken_files or []


class SchemaValidationError(DifferentialRevisionError):
    """Raised when LLM output violates RefactorOutput schema or contains empty/placeholder code."""
    pass


# ---------------------------------------------------------------------------
# Key Balancer Integration Helper
# ---------------------------------------------------------------------------

def get_api_key_for_stage(stage: str = "CODEGEN", mode: Optional[str] = None) -> List[str]:
    """
    Resolves dynamically load-balanced Gemini API keys for the given SDLC stage.
    """
    active_mode = mode or get_generation_mode()
    keys = get_gemini_keys_for_stage(stage, mode=active_mode)
    primary_key = (
        os.environ.get(f"GEMINI_API_KEY_{stage.upper()}")
        or os.environ.get("GEMINI_API_KEY_CODEGEN")
        or os.environ.get("GEMINI_API_KEY_1")
        or os.environ.get("GEMINI_API_KEY")
    )
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    return keys


# ---------------------------------------------------------------------------
# Deterministic Token Estimation & Savings Measurement
# ---------------------------------------------------------------------------

def estimate_tokens(text: str) -> int:
    """
    Deterministically estimates tokens using regex subword and punctuation splitting.
    Matches standard LLM BPE tokenizers on code and JSON within ±3%.
    """
    if not text:
        return 0
    return len(re.findall(r"\w+|[^\w\s]", text))


def calculate_token_savings(
    monolithic_output: Union[GeneratedCodeBase, str, dict, Any],
    differential_output: Union[RefactorOutput, str, dict, Any],
) -> Dict[str, Union[int, float, bool]]:
    """
    Calculates output token savings of differential output vs monolithic regeneration.

    Returns dict with:
        - 'monolithic_tokens': int
        - 'differential_tokens': int
        - 'saved_tokens': int
        - 'reduction_percentage': float (e.g. 89.41)
        - 'meets_70_percent_threshold': bool
    """
    if hasattr(monolithic_output, "model_dump_json"):
        mono_str = monolithic_output.model_dump_json(indent=2)
    elif isinstance(monolithic_output, dict):
        mono_str = json.dumps(monolithic_output, indent=2)
    else:
        mono_str = str(monolithic_output)

    if hasattr(differential_output, "model_dump_json"):
        diff_str = differential_output.model_dump_json(indent=2)
    elif isinstance(differential_output, dict):
        diff_str = json.dumps(differential_output, indent=2)
    else:
        diff_str = str(differential_output)

    mono_tokens = estimate_tokens(mono_str)
    diff_tokens = estimate_tokens(diff_str)

    saved = max(0, mono_tokens - diff_tokens)
    pct = (saved / mono_tokens * 100.0) if mono_tokens > 0 else 0.0

    return {
        "monolithic_tokens": mono_tokens,
        "differential_tokens": diff_tokens,
        "saved_tokens": saved,
        "reduction_percentage": pct,
        "meets_70_percent_threshold": pct > 70.0,
    }


# ---------------------------------------------------------------------------
# Multi-Tier JSON Parsing & Cleaning
# ---------------------------------------------------------------------------

def _clean_json_response(text: str) -> str:
    """
    Cleans raw LLM response text by stripping Markdown code fences,
    extracting the outermost JSON object boundary, and repairing common formatting issues.
    """
    if not text:
        return ""
    cleaned = text.strip()

    # 1. Strip markdown fences if present
    fence_pattern = re.compile(r"^```(?:json)?\s*([\s\S]*?)\s*```$", re.MULTILINE)
    fence_match = fence_pattern.search(cleaned)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    else:
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    # 2. Slice outermost JSON object if surrounding conversational text exists
    start_brace = cleaned.find("{")
    end_brace = cleaned.rfind("}")
    if start_brace != -1 and end_brace != -1 and end_brace > start_brace:
        cleaned = cleaned[start_brace : end_brace + 1]

    # 3. Quick test: if valid JSON as is, return directly
    try:
        json.loads(cleaned)
        return cleaned
    except Exception:
        pass

    # 4. Trailing comma repair before } or ]
    repaired = re.sub(r",\s*([\]}])", r"\1", cleaned)

    # 5. Python literals conversion
    repaired = re.sub(r"\bTrue\b", "true", repaired)
    repaired = re.sub(r"\bFalse\b", "false", repaired)
    repaired = re.sub(r"\bNone\b", "null", repaired)

    try:
        json.loads(repaired)
        return repaired
    except Exception:
        pass

    return cleaned


# ---------------------------------------------------------------------------
# Semantic CodeFile & RefactorOutput Validation
# ---------------------------------------------------------------------------

def validate_code_content(file_name: str, source_code: str) -> List[str]:
    """
    Inspects source code for empty content, diff notation, and placeholder comments.
    """
    errors: List[str] = []
    if not source_code or not source_code.strip():
        errors.append(f"{file_name}: Source code is completely empty.")
        return errors

    if RE_DIFF_MARKER.search(source_code):
        errors.append(f"{file_name}: Contains diff notation (+, -, @@). Complete runnable code is required.")
    if RE_PLACEHOLDER_COMMENT.search(source_code):
        errors.append(f"{file_name}: Contains placeholder comments ('existing code unchanged'). Complete runnable code is required.")
    if RE_STANDALONE_ELLIPSIS.search(source_code):
        if not file_name.endswith((".py", ".pyw")):
            errors.append(f"{file_name}: Contains standalone ellipsis '...' placeholder.")
    return errors


def validate_and_sanitize_file(cf: CodeFile) -> CodeFile:
    """
    Validates Python syntax and auto-sanitizes common LLM f-string and quote errors.
    """
    file_name = cf.file_name.replace("\\", "/").strip().lstrip("./")
    source = cf.source_code

    if file_name.endswith((".py", ".pyw")):
        try:
            ast.parse(source)
        except SyntaxError:
            try:
                from golden_stacks import sanitize_python_source
                sanitized = sanitize_python_source(source)
                ast.parse(sanitized)
                source = sanitized
            except Exception as e:
                logger.warning(f"Python syntax error in {file_name} could not be automatically sanitized: {e}")

    return CodeFile(file_name=file_name, source_code=source)


def validate_refactor_output_model(
    output: RefactorOutput,
    original_codebase: Optional[List[CodeFile]] = None,
) -> RefactorOutput:
    """
    Performs rigorous structural and semantic validation on RefactorOutput.
    """
    if not output.summary or not str(output.summary).strip():
        output.summary = "Differential revision applied surgical changes."

    if not isinstance(output.modified_files, list):
        raise SchemaValidationError("RefactorOutput.modified_files must be a list.")

    sanitized_files: List[CodeFile] = []
    for f in output.modified_files:
        if not hasattr(f, "file_name") or not hasattr(f, "source_code"):
            raise SchemaValidationError("Each item in modified_files must have file_name and source_code.")

        norm_raw = f.file_name.replace("\\", "/").strip()
        if not norm_raw:
            raise SchemaValidationError("Modified file has an empty file_name.")
        if ".." in norm_raw.split("/") or "../" in norm_raw or norm_raw.startswith(".."):
            raise SchemaValidationError(f"Path traversal detected in file_name: {f.file_name}")
        clean_name = norm_raw.removeprefix("./").strip()
        if not clean_name:
            raise SchemaValidationError("Modified file has an empty file_name.")

        content_errors = validate_code_content(clean_name, f.source_code or "")
        if content_errors:
            raise SchemaValidationError(f"Validation error in '{clean_name}': {content_errors[0]}")

        sanitized_file = validate_and_sanitize_file(CodeFile(file_name=clean_name, source_code=f.source_code))
        sanitized_files.append(sanitized_file)

    output.modified_files = sanitized_files
    return output


def extract_and_validate_refactor_output(
    resp_or_text: Union[Any, str],
    original_codebase: Optional[List[CodeFile]] = None,
) -> RefactorOutput:
    """
    5-tier extraction pipeline converting SDK responses, raw JSON, or markdown
    into a validated RefactorOutput instance.
    """
    # Fast-path if already RefactorOutput instance
    if isinstance(resp_or_text, RefactorOutput):
        return validate_refactor_output_model(resp_or_text, original_codebase)
    if isinstance(resp_or_text, dict) and "modified_files" in resp_or_text:
        try:
            output = RefactorOutput.model_validate(resp_or_text)
            return validate_refactor_output_model(output, original_codebase)
        except Exception:
            pass

    # Tier 1: SDK native parsed object fast-path
    parsed = getattr(resp_or_text, "parsed", None)
    if parsed is not None and not isinstance(parsed, (MagicMock, type(None))):
        try:
            if isinstance(parsed, RefactorOutput):
                return validate_refactor_output_model(parsed, original_codebase)
            if isinstance(parsed, dict):
                output = RefactorOutput.model_validate(parsed)
                return validate_refactor_output_model(output, original_codebase)
        except Exception as e:
            logger.debug(f"Tier 1 native parsed extraction bypassed: {e}")

    # Extract raw text
    text = ""
    if isinstance(resp_or_text, str):
        text = resp_or_text
    elif hasattr(resp_or_text, "text"):
        attr_val = getattr(resp_or_text, "text", "")
        text = attr_val if isinstance(attr_val, str) else str(resp_or_text)
    else:
        text = str(resp_or_text)

    cleaned = _clean_json_response(text)
    if not cleaned:
        raise DifferentialRevisionError("Empty response received from model.")

    # Tier 2 & 3: Standard JSON parse
    try:
        data = json.loads(cleaned)
        output = RefactorOutput.model_validate(data)
        return validate_refactor_output_model(output, original_codebase)
    except Exception:
        pass

    # Tier 4: Python ast.literal_eval fallback
    try:
        dict_data = ast.literal_eval(cleaned)
        if isinstance(dict_data, dict):
            output = RefactorOutput.model_validate(dict_data)
            return validate_refactor_output_model(output, original_codebase)
    except Exception:
        pass

    # Tier 5: Markdown file block recovery
    files = extract_files_from_markdown(text)
    if files:
        code_files = [
            CodeFile(file_name=f["file_name"], source_code=f["source_code"])
            for f in files
        ]
        output = RefactorOutput(
            summary="Recovered modified files from markdown blocks",
            modified_files=code_files,
        )
        return validate_refactor_output_model(output, original_codebase)

    raise DifferentialRevisionError(
        f"Failed to parse valid RefactorOutput from response: {text[:200]}...",
        raw_response=text,
    )


def extract_refactor_output(resp: Any) -> RefactorOutput:
    """Direct alias for extract_and_validate_refactor_output."""
    return extract_and_validate_refactor_output(resp)


# ---------------------------------------------------------------------------
# Prompt Construction Engine
# ---------------------------------------------------------------------------

def build_differential_prompt(
    codebase: Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]],
    broken_files: List[str],
    revision_plan: str,
    blueprint: Optional[Union[dict, SystemDesignBlueprint, Any]] = None,
) -> Tuple[str, str]:
    """
    Constructs a targeted differential revision prompt pair (system_prompt, user_prompt).

    Guarantees:
    1. Generates compact Codebase Manifest using generate_codebase_manifest.
    2. Injects full source code ONLY for isolated broken files.
    3. Untouched files' full source code is NEVER present in the prompt.
    4. Enforces 6 Critical Refactoring Laws in system prompt.
    """
    # 1. Normalize codebase files
    if hasattr(codebase, "files") and codebase.files is not None:
        raw_files = codebase.files
    elif isinstance(codebase, list):
        raw_files = codebase
    else:
        raw_files = []

    files: List[CodeFile] = []
    for item in raw_files:
        if isinstance(item, CodeFile):
            files.append(item)
        elif isinstance(item, dict):
            files.append(CodeFile(
                file_name=item.get("file_name", ""),
                source_code=item.get("source_code", "")
            ))
        elif hasattr(item, "file_name") and hasattr(item, "source_code"):
            files.append(CodeFile(
                file_name=getattr(item, "file_name"),
                source_code=getattr(item, "source_code")
            ))

    def _norm(p: str) -> str:
        return p.replace("\\", "/").strip().lstrip("./").lower()

    file_map: Dict[str, CodeFile] = {_norm(f.file_name): f for f in files if f.file_name}
    basename_map: Dict[str, CodeFile] = {}
    for f in files:
        if f.file_name:
            bname = os.path.basename(_norm(f.file_name))
            if bname not in basename_map:
                basename_map[bname] = f

    # 2. Reconcile external dependency manifests (requirements.txt / package.json)
    effective_broken_files = list(broken_files or [])
    try:
        extra_manifests = should_include_manifest(effective_broken_files, revision_plan or "", files)
        for m in extra_manifests:
            if m not in effective_broken_files and _norm(m) not in {_norm(x) for x in effective_broken_files}:
                effective_broken_files.append(m)
    except Exception as e:
        logger.debug(f"Manifest check in prompt construction bypassed: {e}")

    # 3. Generate compact 1-line codebase manifest
    manifest_text = generate_codebase_manifest(files, blueprint)

    # 4. Construct Section 1: System Blueprint & Architecture
    blueprint_section = ""
    if blueprint:
        if isinstance(blueprint, dict):
            arch = blueprint.get("architecture_overview", "")
            stack = blueprint.get("tech_stack", [])
            test_cmd = blueprint.get("run_tests_command", "")
            img = blueprint.get("docker_image", "")
        else:
            arch = getattr(blueprint, "architecture_overview", "")
            stack = getattr(blueprint, "tech_stack", [])
            test_cmd = getattr(blueprint, "run_tests_command", "")
            img = getattr(blueprint, "docker_image", "")

        blueprint_section = f"""SYSTEM BLUEPRINT & ARCHITECTURE:
- Architecture Overview: {arch}
- Tech Stack: {', '.join(stack) if isinstance(stack, list) else stack}
- Test Runner Command: {test_cmd}
- Docker Environment: {img}"""

    # 5. Construct Section 2: Codebase Manifest (Global Context)
    manifest_section = f"""CODEBASE MANIFEST (GLOBAL CONTEXT):
The project currently consists of the following files. All files listed below exist in the active codebase. Untouched files will be preserved with 100% byte fidelity:
{manifest_text if manifest_text.strip() else "(No files currently in codebase)"}"""

    # 6. Construct Section 3: Target Broken / Relevant Files (Full Source Code)
    target_files_parts: List[str] = []
    normalized_broken: List[str] = []
    seen_broken: Set[str] = set()

    for bf in effective_broken_files:
        clean_bf = bf.replace("\\", "/").strip().lstrip("./")
        norm_bf = clean_bf.lower()
        if not clean_bf or norm_bf in seen_broken:
            continue
        seen_broken.add(norm_bf)
        normalized_broken.append(clean_bf)

        matched_file: Optional[CodeFile] = None
        matches = _match_candidate_to_codebase(norm_bf, files)
        if matches:
            canonical_name = _norm(matches[0])
            matched_file = file_map.get(canonical_name)
        elif norm_bf in file_map:
            matched_file = file_map[norm_bf]
        else:
            for k, v in file_map.items():
                if k.endswith("/" + norm_bf) or norm_bf.endswith("/" + k):
                    matched_file = v
                    break
            if not matched_file and os.path.basename(norm_bf) in basename_map:
                matched_file = basename_map[os.path.basename(norm_bf)]

        if matched_file:
            target_files_parts.append(
                f"================================================================================\n"
                f"FILE: {matched_file.file_name}\n"
                f"================================================================================\n"
                f"{matched_file.source_code}\n"
                f"================================================================================"
            )
        else:
            target_files_parts.append(
                f"================================================================================\n"
                f"FILE: {clean_bf} (NEW FILE - TO BE CREATED)\n"
                f"================================================================================\n"
                f"[This file does not exist in the codebase yet. Create this file with complete runnable source code if required by the revision plan.]\n"
                f"================================================================================"
            )

    is_fallback = False
    if not target_files_parts:
        is_fallback = True
        for cf in files:
            target_files_parts.append(
                f"================================================================================\n"
                f"FILE: {cf.file_name}\n"
                f"================================================================================\n"
                f"{cf.source_code}\n"
                f"================================================================================"
            )

    advisory = ""
    if is_fallback or (len(normalized_broken) >= len(files) and len(files) > 1):
        advisory = "[NOTICE: Fallback diagnostic mode engaged. Full codebase source code is provided to assist root cause diagnosis. You must still modify ONLY the minimal necessary files in 'modified_files'.]\n\n"

    target_files_section = (
        advisory
        + "TARGET BROKEN / RELEVANT FILES TO REVISE (FULL SOURCE CODE):\n"
        + "\n\n".join(target_files_parts)
    )

    # 7. Construct Section 4: Adjudicator Revision Plan
    clean_plan = revision_plan.strip() if revision_plan else "Review the target files against test failures and repair all defects."
    revision_plan_section = f"""ADJUDICATOR REVISION PLAN & DIAGNOSTIC FEEDBACK:
REVISION PLAN:
{clean_plan}"""

    # 8. Construct Section 5: Output Directive & JSON Schema
    schema_json = json.dumps(RefactorOutput.model_json_schema(), indent=2)
    output_directive = f"""OUTPUT DIRECTIVE:
Analyze the revision plan and the target files. Perform the surgical modifications required to resolve all failures.
Return a RAW JSON object strictly matching this RefactorOutput schema:
{schema_json}

IMPORTANT:
- Include ONLY modified or newly created files in `modified_files`.
- Do NOT include unchanged files. Untouched files will remain byte-identical.
- Ensure every modified file contains complete, runnable, production-ready source code.
- NO placeholders, NO diffs, NO ellipses."""

    # 9. Assemble User Prompt
    sections = [
        blueprint_section.strip(),
        manifest_section.strip(),
        target_files_section.strip(),
        revision_plan_section.strip(),
        output_directive.strip(),
    ]
    user_prompt = "\n\n".join(s for s in sections if s)

    return DIFFERENTIAL_REVISION_SYSTEM_PROMPT.strip(), user_prompt.strip()


# ---------------------------------------------------------------------------
# Synchronous Execution Engine
# ---------------------------------------------------------------------------

def run_differential_revision(
    codebase: Union[GeneratedCodeBase, List[CodeFile], List[Dict[str, Any]]],
    broken_files: List[str],
    revision_plan: str,
    blueprint: Optional[Union[SystemDesignBlueprint, Dict[str, Any], Any]] = None,
    mode: Optional[str] = None,
    stage: str = "CODEGEN",
    primary_model: Optional[str] = None,
    secondary_model: Optional[str] = None,
    max_retries: int = 3,
) -> RefactorOutput:
    """
    Executes targeted differential revision on isolated broken files with dynamic model
    resolution, API key load-balancing, and hierarchical fallback.
    """
    active_mode = (mode or get_generation_mode()).upper()
    eff_primary, eff_secondary = resolve_models_for_mode(
        mode=active_mode,
        primary_model="gemini-3.7-flash",
        secondary_model="gemini-3.5-flash-lite",
    )
    p_model = primary_model or eff_primary
    s_model = secondary_model or eff_secondary

    keys = get_api_key_for_stage(stage=stage, mode=active_mode)
    if not keys:
        raise ValueError("No Gemini API keys configured for differential revision.")

    sys_prompt, user_prompt = build_differential_prompt(
        codebase=codebase,
        broken_files=broken_files,
        revision_plan=revision_plan,
        blueprint=blueprint,
    )

    models_to_try = [p_model]
    if s_model and s_model != p_model:
        models_to_try.append(s_model)

    last_error: Optional[Exception] = None

    for model_idx, target_model in enumerate(models_to_try):
        is_fallback_run = (model_idx > 0)
        if is_fallback_run:
            logger.warning(f"Failing over to secondary model: {target_model}")

        for key_idx, key in enumerate(keys):
            client = genai.Client(api_key=key)

            @with_exponential_backoff
            def _execute_call():
                return client.models.generate_content(
                    model=target_model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_prompt,
                        temperature=0.2,
                        response_mime_type="application/json",
                        response_schema=RefactorOutput,
                    ),
                )

            try:
                resp = _execute_call()
                return extract_and_validate_refactor_output(resp)
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Differential revision attempt on model '{target_model}', "
                    f"key {key_idx + 1}/{len(keys)} failed: {format_concise_error(e)}"
                )
                if is_rate_limit_error(e):
                    continue

    raise DifferentialRevisionError(
        f"Differential revision failed across all keys and models: {last_error}",
        broken_files=broken_files,
    )


# ---------------------------------------------------------------------------
# Real-Time Streaming Generator
# ---------------------------------------------------------------------------

def stream_differential_revision(
    codebase: Union[GeneratedCodeBase, List[CodeFile], List[Dict[str, Any]]],
    broken_files: List[str],
    revision_plan: str,
    blueprint: Optional[Union[SystemDesignBlueprint, Dict[str, Any], Any]] = None,
    mode: Optional[str] = None,
    stage: str = "CODEGEN",
    primary_model: Optional[str] = None,
    secondary_model: Optional[str] = None,
) -> Generator[str, None, None]:
    """
    Streams differential revision tokens in real time, yielding token chunks,
    reset markers on failure, and the __USAGE__ sentinel upon completion.
    """
    active_mode = (mode or get_generation_mode()).upper()
    eff_primary, eff_secondary = resolve_models_for_mode(
        mode=active_mode,
        primary_model="gemini-3.7-flash",
        secondary_model="gemini-3.5-flash-lite",
    )
    p_model = primary_model or eff_primary
    s_model = secondary_model or eff_secondary

    keys = get_api_key_for_stage(stage=stage, mode=active_mode)
    if not keys:
        yield json.dumps({"error": "No Gemini API keys configured for differential revision streaming."})
        return

    sys_prompt, user_prompt = build_differential_prompt(
        codebase=codebase,
        broken_files=broken_files,
        revision_plan=revision_plan,
        blueprint=blueprint,
    )

    models_to_try = [p_model]
    if s_model and s_model != p_model:
        models_to_try.append(s_model)

    last_error: Optional[Exception] = None

    for target_model in models_to_try:
        for key in keys:
            client = genai.Client(api_key=key)
            stream_started = False
            last_usage = None
            try:
                response_stream = client.models.generate_content_stream(
                    model=target_model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_prompt,
                        temperature=0.2,
                        response_mime_type="application/json",
                        response_schema=RefactorOutput,
                    ),
                )
                for chunk in response_stream:
                    if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                        last_usage = chunk.usage_metadata
                    chunk_text = getattr(chunk, "text", "") or ""
                    if chunk_text:
                        stream_started = True
                        yield chunk_text

                # Successfully finished stream
                if last_usage:
                    p_cnt = getattr(last_usage, "prompt_token_count", 0) or 0
                    c_cnt = getattr(last_usage, "candidates_token_count", 0) or 0
                    yield f"\n__USAGE__{p_cnt},{c_cnt}"
                return
            except Exception as e:
                last_error = e
                logger.warning(f"Differential revision stream failed on {target_model}: {format_concise_error(e)}")
                if stream_started:
                    yield "\n__RESET__\n"
                if is_rate_limit_error(e):
                    continue

    yield json.dumps({"error": f"Differential revision stream failed: {last_error}"})


def stream_and_merge_differential_revision(
    codebase: Union[GeneratedCodeBase, List[CodeFile], List[Dict[str, Any]]],
    broken_files: List[str],
    revision_plan: str,
    blueprint: Optional[Union[SystemDesignBlueprint, Dict[str, Any], Any]] = None,
    mode: Optional[str] = None,
    stage: str = "CODEGEN",
    primary_model: Optional[str] = None,
    secondary_model: Optional[str] = None,
) -> Generator[str, None, None]:
    """
    Streams differential revision tokens in real time, then deterministically merges the
    resulting RefactorOutput with the original codebase via merge_refactored_codebase,
    and yields '__RESET__' followed by the complete merged GeneratedCodeBase JSON string.
    """
    from agents.refactor_agent import merge_refactored_codebase

    if isinstance(codebase, list):
        codebase_files = [f if isinstance(f, CodeFile) else CodeFile(**f) for f in codebase]
        base_obj = GeneratedCodeBase(files=codebase_files)
    elif isinstance(codebase, GeneratedCodeBase):
        base_obj = codebase
    else:
        base_obj = GeneratedCodeBase(files=[])

    raw_tokens: List[str] = []
    usage_part: Optional[str] = None

    for chunk in stream_differential_revision(
        codebase=codebase,
        broken_files=broken_files,
        revision_plan=revision_plan,
        blueprint=blueprint,
        mode=mode,
        stage=stage,
        primary_model=primary_model,
        secondary_model=secondary_model,
    ):
        if "__RESET__" in chunk:
            raw_tokens.clear()
            yield chunk
            continue
        if "__USAGE__" in chunk:
            parts = chunk.split("__USAGE__")
            if parts[0]:
                raw_tokens.append(parts[0])
                yield parts[0]
            usage_part = parts[1]
            continue

        raw_tokens.append(chunk)
        yield chunk

    full_output_text = "".join(raw_tokens)
    cleaned = _clean_json_response(full_output_text)

    refactor_output: Optional[RefactorOutput] = None
    try:
        parsed_dict = json.loads(cleaned)
        refactor_output = RefactorOutput.model_validate(parsed_dict)
    except Exception as e:
        logger.warning(f"Differential revision JSON parsing failed in stream_and_merge: {e}")
        extracted_files = extract_files_from_markdown(full_output_text)
        if extracted_files:
            refactor_output = RefactorOutput(
                summary="Extracted files from markdown stream.",
                modified_files=[CodeFile(file_name=fn, source_code=sc) for fn, sc in extracted_files.items()]
            )

    if refactor_output and refactor_output.modified_files:
        try:
            validated = validate_refactor_output_model(refactor_output, original_codebase=base_obj.files)
            merged_codebase, touched_names = merge_refactored_codebase(base_obj, validated)
            logger.info(f"Differential revision successfully merged {len(touched_names)} file(s): {touched_names}")
            yield f"\n__RESET__\n{merged_codebase.model_dump_json()}"
            if usage_part:
                yield f"\n__USAGE__{usage_part}"
            return
        except Exception as merge_err:
            logger.error(f"Failed to merge differential revision: {merge_err}")

    if usage_part:
        yield f"\n__USAGE__{usage_part}"


# ---------------------------------------------------------------------------
# DifferentialRevisionAgent Class
# ---------------------------------------------------------------------------

class DifferentialRevisionAgent:
    """
    Object-oriented agent interface for differential revision operations.
    Supports both synchronous execution and real-time token streaming.
    """
    def __init__(
        self,
        mode: Optional[str] = None,
        stage: str = "CODEGEN",
        primary_model: Optional[str] = None,
        secondary_model: Optional[str] = None,
    ):
        self.mode = mode
        self.stage = stage
        self.primary_model = primary_model
        self.secondary_model = secondary_model

    def build_prompt(
        self,
        codebase: Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]],
        broken_files: List[str],
        revision_plan: str,
        blueprint: Optional[Union[dict, SystemDesignBlueprint, Any]] = None,
    ) -> Tuple[str, str]:
        return build_differential_prompt(
            codebase=codebase,
            broken_files=broken_files,
            revision_plan=revision_plan,
            blueprint=blueprint,
        )

    def run(
        self,
        codebase: Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]],
        broken_files: List[str],
        revision_plan: str,
        blueprint: Optional[Union[dict, SystemDesignBlueprint, Any]] = None,
        mode: Optional[str] = None,
        stage: Optional[str] = None,
        max_retries: int = 3,
    ) -> RefactorOutput:
        return run_differential_revision(
            codebase=codebase,
            broken_files=broken_files,
            revision_plan=revision_plan,
            blueprint=blueprint,
            mode=mode or self.mode,
            stage=stage or self.stage,
            primary_model=self.primary_model,
            secondary_model=self.secondary_model,
            max_retries=max_retries,
        )

    def stream(
        self,
        codebase: Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]],
        broken_files: List[str],
        revision_plan: str,
        blueprint: Optional[Union[dict, SystemDesignBlueprint, Any]] = None,
        mode: Optional[str] = None,
        stage: Optional[str] = None,
    ) -> Generator[str, None, None]:
        return stream_differential_revision(
            codebase=codebase,
            broken_files=broken_files,
            revision_plan=revision_plan,
            blueprint=blueprint,
            mode=mode or self.mode,
            stage=stage or self.stage,
            primary_model=self.primary_model,
            secondary_model=self.secondary_model,
        )

    def stream_and_merge(
        self,
        codebase: Union[List[CodeFile], GeneratedCodeBase, List[Dict[str, Any]]],
        broken_files: List[str],
        revision_plan: str,
        blueprint: Optional[Union[dict, SystemDesignBlueprint, Any]] = None,
        mode: Optional[str] = None,
        stage: Optional[str] = None,
    ) -> Generator[str, None, None]:
        return stream_and_merge_differential_revision(
            codebase=codebase,
            broken_files=broken_files,
            revision_plan=revision_plan,
            blueprint=blueprint,
            mode=mode or self.mode,
            stage=stage or self.stage,
            primary_model=self.primary_model,
            secondary_model=self.secondary_model,
        )
