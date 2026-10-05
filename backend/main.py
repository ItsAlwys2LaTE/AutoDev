from pathlib import Path
from typing import Optional, List, Any, Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import time
import traceback
import asyncio
import anyio
from starlette.types import ASGIApp, Scope, Receive, Send
import sys

# Ensure singleton module registration across both 'main' and 'backend.main'
if __name__ in ("main", "backend.main") and __name__ in sys.modules:
    sys.modules.setdefault("main", sys.modules[__name__])
    sys.modules.setdefault("backend.main", sys.modules[__name__])

try:
    from uvicorn.protocols.utils import ClientDisconnected
except ImportError:
    class ClientDisconnected(Exception):
        pass

from executor import execute_code
from models import (
    RequirementsDocument,
    SystemDesignBlueprint,
    GeneratedCodeBase,
    ExecutionResult,
    ComponentSpec,
    ComponentDecomposition,
    ComponentResult,
    validate_decomposition,
    PostCompletionModifyRequest,
    PostCompletionQueryRequest,
    RefactorOutput,
    PostCompletionModifyResponse,
    CriticFeedback,
    AdjudicatorDecision,
)
from agents.refactor_agent import (
    RefactorAgent,
    refactor_codebase,
    merge_refactored_codebase,
    stream_codebase_query,
)
from orchestrator import arbitration_engine

# Load environment variables
load_dotenv()

def is_client_disconnect_exception(exc: BaseException) -> bool:
    """Recursively inspects whether an exception (or ExceptionGroup) was caused by a client disconnect."""
    if isinstance(exc, (ClientDisconnected, anyio.BrokenResourceError, asyncio.CancelledError)):
        return True
    if hasattr(exc, "exceptions"):
        return all(is_client_disconnect_exception(sub) for sub in exc.exceptions)
    return False

class ClientDisconnectMiddleware:
    """ASGI middleware that intercepts client disconnections during streaming responses,
    preventing unhandled ExceptionGroup / ClientDisconnected errors when clients abort or disconnect."""
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def safe_send(message):
            try:
                await send(message)
            except (ClientDisconnected, anyio.BrokenResourceError):
                pass

        try:
            await self.app(scope, receive, safe_send)
        except BaseException as exc:
            if is_client_disconnect_exception(exc):
                return
            raise

app = FastAPI(title="Auto-SDLC Pipeline")

# Enable CORS for Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ClientDisconnectMiddleware)

# Deterministic base paths for frontend distribution and legacy fallback
BACKEND_DIR = Path(__file__).resolve().parent
DIST_DIR = BACKEND_DIR / "dist"
DIST_ASSETS_DIR = DIST_DIR / "assets"
DIST_INDEX_HTML = DIST_DIR / "index.html"
BACKEND_INDEX_HTML = BACKEND_DIR / "index.html"

def resolve_index_html() -> Optional[Path]:
    """Resolves index.html with priority:
    1. backend/dist/index.html (production React Vite build)
    2. backend/index.html (legacy fallback)
    3. index.html in current working directory
    """
    if DIST_INDEX_HTML.is_file():
        return DIST_INDEX_HTML
    if BACKEND_INDEX_HTML.is_file():
        return BACKEND_INDEX_HTML
    cwd_index = Path("index.html")
    if cwd_index.is_file():
        return cwd_index
    return None

# Safely mount /assets to backend/dist/assets only if directory exists
# (Guards against Starlette RuntimeError on startup prior to build)
if DIST_ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(DIST_ASSETS_DIR)), name="assets")

from log_stream import router as log_router
app.include_router(log_router)

from pipeline_api import router as pipeline_router
app.include_router(pipeline_router)

@app.on_event("startup")
def on_startup():
    print("Welcome user")

print("Welcome user")

from typing import Optional, List, Any, Union
import key_balancer
from key_balancer import format_phase_transition, get_key_display_for_stage
from retry import format_concise_error

CURRENT_GENERATION_MODE: str = "QUICK"

def set_current_generation_mode(mode: Optional[str]) -> str:
    global CURRENT_GENERATION_MODE
    CURRENT_GENERATION_MODE = "QUICK"
    if hasattr(key_balancer, "set_generation_mode"):
        try:
            key_balancer.set_generation_mode("QUICK")
        except Exception:
            pass
    return "QUICK"

def get_current_generation_mode() -> str:
    return "QUICK"

def resolve_model_for_mode(mode: Optional[str] = None) -> str:
    return "gemini-3.5-flash-lite"


class FeatureRequestInput(BaseModel):
    feature_request: str
    mode: Optional[str] = "QUICK"
    generation_mode: Optional[str] = None

class TextUpdateInput(BaseModel):
    text: str
    mode: Optional[str] = "QUICK"
    generation_mode: Optional[str] = None

class CodeGenInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    previous_codebase: Optional[GeneratedCodeBase] = None
    revision_plan: Optional[str] = None
    revision_count: Optional[int] = 0
    component_name: Optional[str] = None
    mode: Optional[str] = "QUICK"
    generation_mode: Optional[str] = None

class DocumentationInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: Optional[SystemDesignBlueprint] = None
    codebase: GeneratedCodeBase
    mode: Optional[str] = None
    generation_mode: Optional[str] = None

class ExecuteInput(BaseModel):
    codebase: GeneratedCodeBase
    blueprint: SystemDesignBlueprint
    mode: Optional[str] = "QUICK"
    generation_mode: Optional[str] = None
    component: Optional[Union[ComponentSpec, dict]] = None
    decomposition: Optional[Union[ComponentDecomposition, dict]] = None
    docker_image: Optional[str] = None
    tech_stack: Optional[List[str]] = None

class ArbitrationInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    codebase: GeneratedCodeBase
    execution_result: ExecutionResult
    master_decomposition: Optional[ComponentDecomposition] = None
    component_name: Optional[str] = None
    component_id: Optional[str] = None
    revision_count: Optional[int] = 0
    mode: Optional[str] = None
    generation_mode: Optional[str] = None
    previous_composite: Optional[float] = None
    phase: Optional[str] = None
    stage: Optional[str] = None

class IntegrationInput(BaseModel):
    requirements: RequirementsDocument
    decomposition: ComponentDecomposition
    component_results: list  # List of ComponentResult dicts
    previous_codebase: Optional[GeneratedCodeBase] = None
    revision_plan: Optional[str] = None
    revision_count: Optional[int] = 0
    mode: Optional[str] = None
    generation_mode: Optional[str] = None

@app.get("/")
def serve_frontend():
    target_index = resolve_index_html()
    if target_index is not None and target_index.is_file():
        return FileResponse(str(target_index))
    return {"error": "index.html not found."}

@app.get("/assets/{file_path:path}", include_in_schema=False)
def serve_assets_fallback(file_path: str):
    """Safely serves static assets if dist/assets was compiled while server is running."""
    if DIST_ASSETS_DIR.is_dir():
        candidate = (DIST_ASSETS_DIR / file_path).resolve()
        try:
            candidate.relative_to(DIST_ASSETS_DIR.resolve())
            if candidate.is_file():
                return FileResponse(str(candidate))
        except (ValueError, Exception):
            pass
    raise HTTPException(status_code=404, detail="Asset not found")

from fastapi.responses import StreamingResponse
from prompt_guard import validate_prompt, PromptGuardError
from key_balancer import resilient_llm_stream
from agents.requirements_agent import generate_requirements_stream
from agents.intent_classifier import classify_intent
from models import IntentClassification, ClassifyIntentInput

@app.post("/api/classify-intent", response_model=IntentClassification)
def api_classify_intent(user_input: ClassifyIntentInput):
    target_prompt = user_input.prompt or user_input.feature_request or ""
    try:
        # Layer 1: Deterministic validation (raises PromptGuardError / NonSoftwarePromptError -> HTTP 400)
        validate_prompt(target_prompt)
    except PromptGuardError as pe:
        raise HTTPException(status_code=400, detail=str(pe))

    mode = user_input.mode or getattr(user_input, "generation_mode", None) or "QUICK"
    try:
        # Layer 2: LLM Intent Classification
        result = classify_intent(prompt=target_prompt, mode=mode, context=user_input.context)
        return result
    except Exception as e:
        print(f"Intent classification unexpected failure: {format_concise_error(e)}")
        return IntentClassification(
            intent="software_request",
            confidence=0.5,
            reasoning=f"Graceful fallback: classifier encountered error ({format_concise_error(e)})",
            follow_up_questions=None,
            direct_answer=None
        )

@app.post("/api/generate-requirements")
def api_generate_requirements(user_input: FeatureRequestInput):
    try:
        mode = user_input.mode or getattr(user_input, "generation_mode", None) or "QUICK"
        set_current_generation_mode(mode)
        validate_prompt(user_input.feature_request)
        active_model = resolve_model_for_mode(mode)
        print(format_phase_transition("System", "INIT", "REQUIREMENTS", active_model, "REQUIREMENTS", mode=mode))
        resilient_stream = resilient_llm_stream(
            stage="REQUIREMENTS",
            stream_factory=lambda model: generate_requirements_stream(user_input.feature_request, mode=mode, primary_model=model),
            primary_model=active_model,
            mode=mode,
        )
        return StreamingResponse(resilient_stream, media_type="text/plain")
    except PromptGuardError as pe:
        raise HTTPException(status_code=400, detail=str(pe))
    except Exception as e:
        print(f"Generate requirements failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from agents.master_architect import decompose_requirements_stream

@app.post("/api/decompose")
def api_decompose(requirements: RequirementsDocument):
    try:
        active_mode = get_current_generation_mode()
        active_model = resolve_model_for_mode(active_mode)
        print(format_phase_transition("System", "REQUIREMENTS", "MASTER_ARCHITECT", active_model, "MASTER_ARCHITECT", mode=active_mode))
        resilient_stream = resilient_llm_stream(
            stage="DECOMPOSITION",
            stream_factory=lambda model: decompose_requirements_stream(requirements, mode=active_mode, primary_model=model),
            primary_model=active_model,
            mode=active_mode,
        )
        return StreamingResponse(resilient_stream, media_type="text/plain")
    except Exception as e:
        print(f"Decompose failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from agents.integrator_agent import generate_integration_stream

@app.post("/api/integrate")
def api_integrate(payload: IntegrationInput):
    try:
        active_mode = payload.generation_mode or payload.mode or get_current_generation_mode()
        active_model = resolve_model_for_mode(active_mode)
        from_phase = "CRITICS" if (payload.revision_count and payload.revision_count > 0) else "ALL_COMPONENTS_COMPLETED"
        extra = f"Revision {payload.revision_count}" if (payload.revision_count and payload.revision_count > 0) else None
        print(format_phase_transition("System", from_phase, "INTEGRATION", active_model, "INTEGRATION", mode=active_mode, extra=extra))
        resilient_stream = resilient_llm_stream(
            stage="INTEGRATION",
            stream_factory=lambda model: generate_integration_stream(
                payload.requirements,
                payload.decomposition,
                payload.component_results,
                payload.previous_codebase,
                payload.revision_plan,
                mode=active_mode,
                primary_model=model,
            ),
            primary_model=active_model,
            mode=active_mode,
        )
        return StreamingResponse(resilient_stream, media_type="text/plain")
    except Exception as e:
        print(f"Integration failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from agents.design_agent import generate_design_stream

class DesignInput(BaseModel):
    requirements: RequirementsDocument
    component_context: Optional[str] = None
    component_name: Optional[str] = None
    component_id: Optional[str] = None
    revision_count: Optional[int] = 0
    mode: Optional[str] = "QUICK"
    generation_mode: Optional[str] = None
    component: Optional[Union[ComponentSpec, dict]] = None
    decomposition: Optional[Union[ComponentDecomposition, dict]] = None
    docker_image: Optional[str] = None
    tech_stack: Optional[List[str]] = None

@app.post("/api/generate-design")
def api_generate_design(payload: DesignInput):
    comp_name = payload.component_name or "Global"
    eff_comp_id = payload.component_id or payload.component_name or comp_name
    mode = payload.mode or getattr(payload, "generation_mode", None) or get_current_generation_mode()
    active_model = resolve_model_for_mode(mode)
    print(format_phase_transition(comp_name, "CREATED", "DESIGN", active_model, "DESIGN", mode=mode, component_id=eff_comp_id))
    comp = payload.component
    if comp is None and (payload.docker_image or payload.tech_stack):
        comp = {"docker_image": payload.docker_image, "tech_stack": payload.tech_stack}

    try:
        resilient_stream = resilient_llm_stream(
            stage="DESIGN",
            stream_factory=lambda model: generate_design_stream(
                payload.requirements,
                payload.component_context,
                mode=mode,
                component=comp,
                decomposition=payload.decomposition,
                primary_model=model,
                component_id=eff_comp_id,
            ),
            primary_model=active_model,
            mode=mode,
            component_id=eff_comp_id,
        )
        return StreamingResponse(resilient_stream, media_type="text/plain")
    except Exception as e:
        print(f"Design failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from agents.codegen_agent import generate_code_stream

class CodeGenInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    previous_codebase: Optional[GeneratedCodeBase] = None
    revision_plan: Optional[str] = None
    revision_count: Optional[int] = 0
    component_name: Optional[str] = None
    component_id: Optional[str] = None
    mode: Optional[str] = None
    generation_mode: Optional[str] = None

@app.post("/api/generate-code")
def api_generate_code(payload: CodeGenInput):
    comp_name = payload.component_name or "Global"
    eff_comp_id = payload.component_id or payload.component_name or comp_name
    mode = payload.generation_mode or payload.mode or get_current_generation_mode()
    active_model = resolve_model_for_mode(mode)
    from_phase = "CRITICS" if (payload.revision_count and payload.revision_count > 0) else "DESIGN"
    extra = f"Revision {payload.revision_count}" if (payload.revision_count and payload.revision_count > 0) else None
    print(format_phase_transition(comp_name, from_phase, "CODEGEN", active_model, "CODEGEN", mode=mode, extra=extra, component_id=eff_comp_id))
    try:
        resilient_stream = resilient_llm_stream(
            stage="CODEGEN",
            stream_factory=lambda model: generate_code_stream(
                payload.requirements, 
                payload.blueprint,
                payload.previous_codebase,
                payload.revision_plan,
                mode=mode,
                primary_model=model,
                component_id=eff_comp_id,
            ),
            primary_model=active_model,
            mode=mode,
            component_id=eff_comp_id,
        )
        return StreamingResponse(resilient_stream, media_type="text/plain")
    except Exception as e:
        print(f"CodeGen failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from google import genai
from google.genai import types
from retry import with_exponential_backoff
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error

@app.post("/api/parse-requirements")
def api_parse_requirements(payload: TextUpdateInput):
    try:
        primary_key = os.environ.get("GEMINI_API_KEY_REQUIREMENTS") or os.environ.get("GEMINI_API_KEY_CODEGEN")
        keys = get_gemini_keys_for_stage("PARSE_REQUIREMENTS")
        if primary_key and primary_key.strip() and primary_key.strip() not in keys:
            keys = [primary_key.strip()] + keys

        for idx, key in enumerate(keys):
            client = genai.Client(api_key=key)

            @with_exponential_backoff
            def _parse_primary():
                response = client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=f"Extract the requirements from this document into the strict JSON schema. Ensure no details are lost:\n\n{payload.text}",
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=RequirementsDocument,
                        temperature=0.1
                    )
                )
                if hasattr(response, 'parsed') and response.parsed is not None:
                    return response.parsed
                else:
                    return RequirementsDocument.model_validate_json(response.text)

            try:
                return _parse_primary()
            except Exception as e:
                print(f"3.5-flash-lite failed on key {idx+1} in parse_requirements: {format_concise_error(e)}")
                if is_rate_limit_error(e) and idx + 1 < len(keys):
                    continue
                else:
                    print("Falling back to gemini-3.1-flash-lite...")
                    for fb_idx, fb_key in enumerate(keys):
                        fb_client = genai.Client(api_key=fb_key)

                        @with_exponential_backoff
                        def _parse_fallback():
                            response = fb_client.models.generate_content(
                                model="gemini-3.1-flash-lite",
                                contents=f"Extract the requirements from this document into the strict JSON schema. Ensure no details are lost:\n\n{payload.text}",
                                config=types.GenerateContentConfig(
                                    response_mime_type="application/json",
                                    response_schema=RequirementsDocument,
                                    temperature=0.1
                                )
                            )
                            if hasattr(response, 'parsed') and response.parsed is not None:
                                return response.parsed
                            else:
                                return RequirementsDocument.model_validate_json(response.text)

                        try:
                            return _parse_fallback()
                        except Exception as fb_err:
                            if fb_idx + 1 < len(keys):
                                continue
                            raise fb_err
    except Exception as e:
        print(f"Parse requirements failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/parse-blueprint")
def api_parse_blueprint(payload: TextUpdateInput):
    # Fast path: check if text is already valid JSON matching SystemDesignBlueprint
    stripped = payload.text.strip()
    if (stripped.startswith("{") and stripped.endswith("}")) or (stripped.startswith("```json") and "{" in stripped):
        clean_text = stripped
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        elif clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
        try:
            validated = SystemDesignBlueprint.model_validate_json(clean_text)
            return validated
        except Exception:
            pass

    try:
        primary_key = os.environ.get("GEMINI_API_KEY_DESIGN") or os.environ.get("GEMINI_API_KEY_CODEGEN")
        keys = get_gemini_keys_for_stage("PARSE_BLUEPRINT")
        if primary_key and primary_key.strip() and primary_key.strip() not in keys:
            keys = [primary_key.strip()] + keys

        for idx, key in enumerate(keys):
            client = genai.Client(api_key=key)

            @with_exponential_backoff
            def _parse_primary():
                response = client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=f"Extract the system design blueprint from this document into the strict JSON schema. Ensure no details are lost:\n\n{payload.text}",
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=SystemDesignBlueprint,
                        temperature=0.1
                    )
                )
                if hasattr(response, 'parsed') and response.parsed is not None:
                    return response.parsed
                else:
                    return SystemDesignBlueprint.model_validate_json(response.text)

            try:
                return _parse_primary()
            except Exception as e:
                print(f"3.5-flash-lite failed on key {idx+1} in parse_blueprint: {format_concise_error(e)}")
                if is_rate_limit_error(e) and idx + 1 < len(keys):
                    continue
                else:
                    print("Falling back to gemini-3.1-flash-lite...")
                    for fb_idx, fb_key in enumerate(keys):
                        fb_client = genai.Client(api_key=fb_key)

                        @with_exponential_backoff
                        def _parse_fallback():
                            response = fb_client.models.generate_content(
                                model="gemini-3.1-flash-lite",
                                contents=f"Extract the system design blueprint from this document into the strict JSON schema. Ensure no details are lost:\n\n{payload.text}",
                                config=types.GenerateContentConfig(
                                    response_mime_type="application/json",
                                    response_schema=SystemDesignBlueprint,
                                    temperature=0.1
                                )
                            )
                            if hasattr(response, 'parsed') and response.parsed is not None:
                                return response.parsed
                            else:
                                return SystemDesignBlueprint.model_validate_json(response.text)

                        try:
                            return _parse_fallback()
                        except Exception as fb_err:
                            if fb_idx + 1 < len(keys):
                                continue
                            raise fb_err
    except Exception as e:
        print(f"Parse blueprint failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute-code")
def api_execute_code(payload: ExecuteInput):
    comp = payload.component
    if comp is None and (payload.docker_image or payload.tech_stack):
        comp = {"docker_image": payload.docker_image, "tech_stack": payload.tech_stack}

    try:
        return execute_code(
            payload.codebase,
            payload.blueprint,
            component=comp,
            decomposition=payload.decomposition,
        )
    except Exception as e:
        print(f"Execute code failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/run-critics")
def api_run_critics(payload: ArbitrationInput):
    try:
        rev_count = payload.revision_count if hasattr(payload, 'revision_count') and payload.revision_count is not None else 0
        gen_mode = payload.generation_mode or payload.mode or get_current_generation_mode()
        comp_name = payload.component_name or "Global"
        eff_comp_id = payload.component_id or payload.component_name or comp_name
        active_model = resolve_model_for_mode(gen_mode)
        print(format_phase_transition(comp_name, "CODEGEN", "CRITICS", active_model, "CRITICS", mode=gen_mode, component_id=eff_comp_id))
        initial_state = {
            "requirements": payload.requirements,
            "blueprint": payload.blueprint,
            "codebase": payload.codebase,
            "execution_result": payload.execution_result,
            "feedbacks": [],
            "revision_count": rev_count,
            "master_decomposition": payload.master_decomposition,
            "component_name": comp_name,
            "component_id": eff_comp_id,
            "generation_mode": gen_mode,
            "mode": gen_mode,
            "previous_composite": payload.previous_composite,
            "phase": payload.phase or ("integration" if (comp_name or "").lower() == "integration" or (eff_comp_id or "").lower() == "integration" else "component"),
            "stage": payload.stage or ("INTEGRATION" if (comp_name or "").lower() == "integration" or (eff_comp_id or "").lower() == "integration" else "CRITICS"),
        }
        
        final_state = arbitration_engine.invoke(initial_state)
        return {
            "feedbacks": final_state.get("feedbacks", []),
            "decision": final_state.get("decision"),
            "revision_count": final_state.get("revision_count", rev_count),
        }
    except Exception as e:
        print(f"Critics evaluation failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=f"Server Error during evaluation: {str(e)}")

from agents.documentation_agent import generate_documentation_stream

@app.post("/api/generate-documentation")
def api_generate_documentation(payload: DocumentationInput):
    try:
        active_mode = payload.generation_mode or payload.mode or get_current_generation_mode()
        active_model = resolve_model_for_mode(active_mode)
        print(format_phase_transition("System", "INTEGRATION", "DOCUMENTATION", active_model, "DOCUMENTATION", mode=active_mode))

        if payload.blueprint is None:
            payload.blueprint = SystemDesignBlueprint(
                architecture_overview=payload.requirements.overview if payload.requirements else "System Architecture",
                tech_stack=["Fullstack"],
                docker_image="python:3.11-slim",
                dev_server_command="NONE",
                dev_server_port=0,
                run_tests_command="NONE",
                files=[]
            )

        def docs_stream():
            for chunk in generate_documentation_stream(payload.requirements, payload.blueprint, payload.codebase, mode=active_mode):
                yield chunk
            print("development completed")

        return StreamingResponse(
            docs_stream(),
            media_type="text/plain"
        )
    except Exception as e:
        print(f"Documentation generation failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=f"Server Error during doc generation: {str(e)}")


# --- PHASE 4 ROUTES (Post-Completion Final Request Phase) ---

@app.post("/api/post-completion/modify", response_model=PostCompletionModifyResponse)
def api_post_completion_modify(payload: PostCompletionModifyRequest):
    """
    Selectively refactors an existing completed codebase based on user prompt.
    Merges updated files into the codebase, optionally runs execute_code() sandbox
    verification, and returns the updated codebase and execution logs.
    """
    try:
        active_mode = payload.generation_mode or payload.mode or get_current_generation_mode()
        active_model = resolve_model_for_mode(active_mode)

        print(format_phase_transition(
            "System", "COMPLETED", "POST_COMPLETION_MODIFY",
            active_model, "CODEGEN", mode=active_mode,
            extra=f"Prompt: {payload.prompt[:50]}..."
        ))

        # 1. Execute surgical refactor via RefactorAgent
        refactor_result = refactor_codebase(
            prompt=payload.prompt,
            codebase=payload.codebase,
            blueprint=payload.blueprint,
            mode=active_mode,
        )

        # 2. Merge modified/new files into codebase while keeping untouched files byte-identical
        updated_codebase, modified_file_names = merge_refactored_codebase(
            original_codebase=payload.codebase,
            refactor_output=refactor_result,
        )

        # 3. Optional sandbox verification
        exec_result: Optional[ExecutionResult] = None
        if payload.run_verification and payload.blueprint is not None:
            print(f"Running sandbox verification for {len(modified_file_names)} modified files...")
            try:
                exec_result = execute_code(updated_codebase, payload.blueprint)
            except Exception as ex_err:
                exec_result = ExecutionResult(
                    success=False,
                    logs=f"Sandbox verification error: {format_concise_error(ex_err)}"
                )

        # 4. Arbitration & Critics Phase
        critic_feedbacks: List[CriticFeedback] = []
        adjudicator_decision: Optional[AdjudicatorDecision] = None
        if payload.run_verification and payload.blueprint is not None:
            print(format_phase_transition(
                "System", "POST_COMPLETION_MODIFY", "POST_COMPLETION_CRITICS",
                active_model, "CRITICS", mode=active_mode,
                extra=f"Arbitrating {len(modified_file_names)} modified files"
            ))
            try:
                req_doc = payload.requirements
                if req_doc is None:
                    req_doc = RequirementsDocument(
                        project_title="Post-Completion Modification",
                        overview=payload.prompt,
                        user_stories=[],
                    )

                initial_state = {
                    "requirements": req_doc,
                    "blueprint": payload.blueprint,
                    "codebase": updated_codebase,
                    "execution_result": exec_result or ExecutionResult(success=True, logs="No test suite executed."),
                    "feedbacks": [],
                    "revision_count": 0,
                    "master_decomposition": None,
                    "component_name": "Post-Completion Feature/Fix",
                    "generation_mode": active_mode,
                    "mode": active_mode,
                    "previous_composite": None,
                }
                final_state = arbitration_engine.invoke(initial_state)
                critic_feedbacks = final_state.get("feedbacks", [])
                adjudicator_decision = final_state.get("decision")
            except Exception as arb_err:
                print(f"Arbitration evaluation failed during post-completion modify: {format_concise_error(arb_err)}")

        return PostCompletionModifyResponse(
            success=True,
            summary=refactor_result.summary,
            modified_files=modified_file_names,
            codebase=updated_codebase,
            execution_result=exec_result,
            critic_feedbacks=critic_feedbacks,
            decision=adjudicator_decision,
        )
    except Exception as e:
        print(f"Post-completion modify failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/post-completion/query")
def api_post_completion_query(payload: PostCompletionQueryRequest):
    """
    Streams a conversational technical explanation answering queries about the codebase.
    Never mutates codebase files.
    """
    try:
        active_mode = payload.generation_mode or payload.mode or get_current_generation_mode()
        active_model = resolve_model_for_mode(active_mode)
        query_text = payload.prompt or payload.query or ""

        print(format_phase_transition(
            "System", "COMPLETED", "POST_COMPLETION_QUERY",
            active_model, "DOCUMENTATION", mode=active_mode,
            extra=f"Query: {query_text[:50]}..."
        ))

        return StreamingResponse(
            stream_codebase_query(
                prompt=query_text,
                codebase=payload.codebase,
                blueprint=payload.blueprint,
                mode=active_mode,
            ),
            media_type="text/plain",
        )
    except Exception as e:
        print(f"Post-completion query failed: {format_concise_error(e)}")
        raise HTTPException(status_code=500, detail=str(e))



import uuid
from fastapi.responses import Response

import socket
import docker
from executor import create_tar_from_codebase

preview_container_id = None


def is_python_docker_image(image: Optional[str]) -> bool:
    """
    Checks if image is not empty and 'python' in image.lower().
    Any image that does not contain 'python' (including Playwright
    mcr.microsoft.com/playwright:*, Node, Bun, Deno) returns False.
    """
    if not image or not isinstance(image, str):
        return False
    return "python" in image.lower()


def infer_dev_server_from_codebase(
    codebase: Optional[GeneratedCodeBase],
    image: Optional[str]
) -> tuple[str, int]:
    """
    Inspects codebase.files:
    * If package.json exists and contains 'vite' (case-insensitive in file content):
      returns ('npm run dev -- --host 0.0.0.0', 5173).
    * Else if package.json exists:
      returns ('npx --yes serve -p 3000 -H 0.0.0.0', 3000).
    * Else if index.html exists:
      - If is_python_docker_image(image) is True:
        returns ('python3 -m http.server 8080 --bind 0.0.0.0', 8080).
      - Else:
        returns ('npx --yes serve -p 8080 -H 0.0.0.0', 8080).
    * Default (e.g. Python project):
      returns ('python3 -m http.server 8080 --bind 0.0.0.0', 8080).
    """
    files = codebase.files if (codebase and hasattr(codebase, "files") and codebase.files) else []
    pkg_file = None
    has_index_html = False

    for f in files:
        if isinstance(f, dict):
            fname = (f.get("file_name", "") or "").replace("\\", "/").strip().lstrip("./")
        else:
            fname = (getattr(f, "file_name", "") or "").replace("\\", "/").strip().lstrip("./")
        base_name = fname.lower().split("/")[-1]
        if base_name == "package.json":
            pkg_file = f
        elif base_name == "index.html":
            has_index_html = True

    if pkg_file is not None:
        if isinstance(pkg_file, dict):
            content = pkg_file.get("source_code", "") or ""
        else:
            content = getattr(pkg_file, "source_code", "") or ""
        if "vite" in content.lower():
            return ("npm run dev -- --host 0.0.0.0", 5173)
        return ("npx --yes serve -p 3000 -H 0.0.0.0", 3000)
    elif has_index_html:
        if is_python_docker_image(image):
            return ("python3 -m http.server 8080 --bind 0.0.0.0", 8080)
        else:
            return ("npx --yes serve -p 8080 -H 0.0.0.0", 8080)
    else:
        return ("python3 -m http.server 8080 --bind 0.0.0.0", 8080)


def normalize_preview_command(
    cmd: Optional[str],
    internal_port: Optional[int],
    image: Optional[str],
    codebase: Optional[GeneratedCodeBase] = None
) -> tuple[str, int]:
    """
    Normalizes preview command and internal port:
    * If not cmd or cmd.strip() == '' or cmd.strip().upper() == 'NONE' or not internal_port or internal_port == 0:
      calls infer_dev_server_from_codebase(codebase, image) to set cmd and internal_port.
    * If not is_python_docker_image(image) and ('python -m http.server' in cmd or 'python3 -m http.server' in cmd):
      - replaces 'python3 -m http.server' and 'python -m http.server' with 'npx --yes serve -p'.
      - replaces '--bind 0.0.0.0' with '-H 0.0.0.0'.
      - if '-H 0.0.0.0' is not in cmd, appends ' -H 0.0.0.0'.
    * Returns (cmd, internal_port).
    """
    if not cmd or cmd.strip() == "" or cmd.strip().upper() == "NONE" or not internal_port or internal_port == 0:
        cmd, internal_port = infer_dev_server_from_codebase(codebase, image)

    if cmd and not is_python_docker_image(image) and ("python -m http.server" in cmd or "python3 -m http.server" in cmd):
        cmd = cmd.replace("python3 -m http.server", "npx --yes serve -p")
        cmd = cmd.replace("python -m http.server", "npx --yes serve -p")
        cmd = cmd.replace("--bind 0.0.0.0", "-H 0.0.0.0")
        if "-H 0.0.0.0" not in cmd:
            cmd = f"{cmd} -H 0.0.0.0"

    return cmd, internal_port


def get_free_port():
    s = socket.socket()
    s.bind(('', 0))
    port = s.getsockname()[1]
    s.close()
    return port

@app.post("/api/preview/start")
def start_preview(payload: ExecuteInput):
    global preview_container_id
    try:
        client = docker.from_env()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot connect to Docker Daemon. Error: {e}")
        
    # Kill existing preview container if any
    if preview_container_id:
        try:
            old_c = client.containers.get(preview_container_id)
            old_c.stop(timeout=1)
            old_c.remove(force=True)
        except Exception:
            pass
        preview_container_id = None

    if payload.blueprint is None:
        payload.blueprint = SystemDesignBlueprint(
            architecture_overview="Live Preview Container",
            tech_stack=["Fullstack"],
            docker_image="python:3.11-slim",
            dev_server_command="NONE",
            dev_server_port=0,
            run_tests_command="NONE",
            files=[]
        )

    image = payload.blueprint.docker_image
    if image and "alpine" in image.lower():
        has_node = False
        if payload.codebase and hasattr(payload.codebase, 'files'):
            has_node = any(
                (f.get('file_name', '') if isinstance(f, dict) else getattr(f, 'file_name', '')).lower() in ['package.json'] or
                (f.get('file_name', '') if isinstance(f, dict) else getattr(f, 'file_name', '')).lower().endswith(('.js', '.jsx', '.ts', '.tsx'))
                for f in payload.codebase.files
            )
        if has_node or "node" in image.lower():
            image = "mcr.microsoft.com/playwright:v1.48.0-jammy"
            payload.blueprint.docker_image = image

    cmd = payload.blueprint.dev_server_command
    internal_port = payload.blueprint.dev_server_port

    cmd, internal_port = normalize_preview_command(cmd, internal_port, image, payload.codebase)

    host_port = get_free_port()

    try:
        try:
            client.images.get(image)
        except docker.errors.ImageNotFound:
            client.images.pull(image)
            
        # Inject auto-install if package.json exists and it's a node/npm command
        has_package = any(f.file_name.lower() == 'package.json' for f in payload.codebase.files)
        if has_package and "npm install" not in cmd and "npm " in cmd:
            cmd = f"npm install --no-audit --no-fund && {cmd}"
            
        has_requirements = any(f.file_name.lower() == 'requirements.txt' for f in payload.codebase.files)
        if has_requirements and "pip install" not in cmd and is_python_docker_image(image) and ("python " in cmd or "python3 " in cmd):
            pip_cmd = (
                "(pip install --break-system-packages -r requirements.txt 2>/dev/null || "
                "pip install -r requirements.txt 2>/dev/null || "
                "python3 -m pip install --break-system-packages -r requirements.txt 2>/dev/null || "
                "python3 -m pip install -r requirements.txt 2>/dev/null || "
                "python -m pip install -r requirements.txt)"
            )
            cmd = f"{pip_cmd} && {cmd}"

        # Create container mapping internal port to the dynamically found host port
        container = client.containers.create(
            image=image,
            command=["sh", "-c", cmd],
            working_dir="/workspace",
            ports={f"{internal_port}/tcp": host_port},
            environment={
                "HOST": "0.0.0.0", 
                "VITE_HOST": "0.0.0.0", 
                "HOSTNAME": "0.0.0.0", 
                "PORT": str(internal_port)
            }
        )
        
        # Inject the source code before starting
        tar_data = create_tar_from_codebase(payload.codebase)
        container.put_archive("/workspace", tar_data)
        
        container.start()
        preview_container_id = container.id
        
        # Wait a moment to see if it crashes immediately (e.g. syntax error or missing module)
        time.sleep(2.5)
        container.reload()
        if container.status == "exited":
            logs = container.logs().decode('utf-8', errors='replace')
            raise Exception(f"Container exited prematurely.\nLogs:\n{logs}")
            
        return {"url": f"http://localhost:{host_port}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.api_route("/api/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"], include_in_schema=False)
def api_catchall_404(full_path: str):
    """Guarantees strict 404 JSON for any unmatched /api/* endpoint across all HTTP methods."""
    raise HTTPException(status_code=404, detail="Not Found")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """
    SPA Fallback Route (Requirement R4):
    Serves backend/dist/index.html for any unmatched client-side route,
    enabling deep-linking and browser refreshes in the React SPA.
    Guarantees strict 404 JSON for missing /api/* endpoints and 404 for missing /assets/*.
    """
    # 1. Strict API route isolation: missing API routes MUST return 404 JSON
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    # 2. Strict static asset isolation: missing assets MUST return 404
    if full_path == "assets" or full_path.startswith("assets/"):
        raise HTTPException(status_code=404, detail="Asset not found")

    # 3. Reject dotfiles and server source/config file extensions
    if (
        full_path.startswith(".")
        or "/." in full_path
        or full_path.endswith((".py", ".env", ".json", ".ini", ".conf", ".log", ".yml", ".yaml"))
    ):
        raise HTTPException(status_code=404, detail="Not Found")

    # 4. Direct static file in dist root (e.g. favicon.ico, vite.svg)
    if DIST_DIR.is_dir():
        candidate = (DIST_DIR / full_path).resolve()
        try:
            candidate.relative_to(DIST_DIR.resolve())
            if candidate.is_file():
                return FileResponse(str(candidate))
        except (ValueError, Exception):
            pass

    # 5. Fallback to index.html (SPA shell)
    target_index = resolve_index_html()
    if target_index is not None and target_index.is_file():
        return FileResponse(str(target_index))

    raise HTTPException(status_code=404, detail="index.html not found.")



