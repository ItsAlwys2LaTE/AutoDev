from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import traceback

from executor import execute_code
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult, ComponentDecomposition, ComponentResult
from orchestrator import arbitration_engine

# Load environment variables
load_dotenv()

app = FastAPI(title="Auto-SDLC Pipeline")

from pipeline_api import router as pipeline_router
app.include_router(pipeline_router)

from log_stream import router as log_router
app.include_router(log_router)

from typing import Optional

class FeatureRequestInput(BaseModel):
    feature_request: str

class TextUpdateInput(BaseModel):
    text: str

class CodeGenInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    previous_codebase: Optional[GeneratedCodeBase] = None
    revision_plan: Optional[str] = None

class DocumentationInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    codebase: GeneratedCodeBase

class ExecuteInput(BaseModel):
    codebase: GeneratedCodeBase
    blueprint: SystemDesignBlueprint

class ArbitrationInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    codebase: GeneratedCodeBase
    execution_result: ExecutionResult
    master_decomposition: Optional[ComponentDecomposition] = None

class IntegrationInput(BaseModel):
    requirements: RequirementsDocument
    decomposition: ComponentDecomposition
    component_results: list  # List of ComponentResult dicts

@app.get("/")
def serve_frontend():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "index.html not found."}

from fastapi.responses import StreamingResponse
from prompt_guard import validate_prompt, PromptGuardError
from agents.requirements_agent import generate_requirements_stream

@app.post("/api/generate-requirements")
def api_generate_requirements(user_input: FeatureRequestInput):
    try:
        validate_prompt(user_input.feature_request)
        return StreamingResponse(
            generate_requirements_stream(user_input.feature_request),
            media_type="text/plain"
        )
    except PromptGuardError as pe:
        raise HTTPException(status_code=400, detail=str(pe))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from agents.master_architect import decompose_requirements_stream

@app.post("/api/decompose")
def api_decompose(requirements: RequirementsDocument):
    try:
        return StreamingResponse(
            decompose_requirements_stream(requirements),
            media_type="text/plain"
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from agents.integrator_agent import generate_integration_stream

@app.post("/api/integrate")
def api_integrate(payload: IntegrationInput):
    try:
        return StreamingResponse(
            generate_integration_stream(
                payload.requirements,
                payload.decomposition,
                payload.component_results
            ),
            media_type="text/plain"
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from agents.design_agent import generate_design_stream

class DesignInput(BaseModel):
    requirements: RequirementsDocument
    component_context: Optional[str] = None

@app.post("/api/generate-design")
def api_generate_design(payload: DesignInput):
    try:
        return StreamingResponse(
            generate_design_stream(payload.requirements, payload.component_context),
            media_type="text/plain"
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from agents.codegen_agent import generate_code_stream

@app.post("/api/generate-code")
def api_generate_code(payload: CodeGenInput):
    try:
        return StreamingResponse(
            generate_code_stream(
                payload.requirements, 
                payload.blueprint,
                payload.previous_codebase,
                payload.revision_plan
            ),
            media_type="text/plain"
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from google import genai
from google.genai import types
from retry import with_exponential_backoff

@app.post("/api/parse-requirements")
def api_parse_requirements(payload: TextUpdateInput):
    try:
        api_key = os.environ.get("GEMINI_API_KEY_REQUIREMENTS") or os.environ.get("GEMINI_API_KEY_CODEGEN")
        client = genai.Client(api_key=api_key)

        @with_exponential_backoff
        def _parse(model_name: str):
            response = client.models.generate_content(
                model=model_name,
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
            return _parse("gemini-3.6-flash")
        except Exception as e:
            print(f"3.6-flash failed in parse_requirements: {e}. Falling back to gemini-3.5-flash-lite...")
            return _parse("gemini-3.5-flash-lite")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/parse-blueprint")
def api_parse_blueprint(payload: TextUpdateInput):
    try:
        api_key = os.environ.get("GEMINI_API_KEY_DESIGN") or os.environ.get("GEMINI_API_KEY_CODEGEN")
        client = genai.Client(api_key=api_key)

        @with_exponential_backoff
        def _parse(model_name: str):
            response = client.models.generate_content(
                model=model_name,
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
            return _parse("gemini-3.6-flash")
        except Exception as e:
            print(f"3.6-flash failed in parse_blueprint: {e}. Falling back to gemini-3.5-flash-lite...")
            return _parse("gemini-3.5-flash-lite")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute-code")
def api_execute_code(payload: ExecuteInput):
    try:
        return execute_code(payload.codebase, payload.blueprint)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/run-critics")
def api_run_critics(payload: ArbitrationInput):
    try:
        initial_state = {
            "requirements": payload.requirements,
            "blueprint": payload.blueprint,
            "codebase": payload.codebase,
            "execution_result": payload.execution_result,
            "feedbacks": [],
            "revision_count": 0,
            "master_decomposition": payload.master_decomposition
        }
        
        final_state = arbitration_engine.invoke(initial_state)
        return {
            "feedbacks": final_state.get("feedbacks", []),
            "decision": final_state.get("decision")
        }
    except Exception as e:
        print("\n=== PHASE 3 CRASH TRACEBACK ===")
        traceback.print_exc()
        print("===============================\n")
        raise HTTPException(status_code=500, detail=f"Server Error during evaluation: {str(e)}")

from agents.documentation_agent import generate_documentation_stream

@app.post("/api/generate-documentation")
def api_generate_documentation(payload: DocumentationInput):
    try:
        return StreamingResponse(
            generate_documentation_stream(payload.requirements, payload.blueprint, payload.codebase),
            media_type="text/plain"
        )
    except Exception as e:
        print("\n=== DOCS CRASH TRACEBACK ===")
        traceback.print_exc()
        print("===============================\n")
        raise HTTPException(status_code=500, detail=f"Server Error during doc generation: {str(e)}")


import uuid
from fastapi.responses import Response

import socket
import docker
from executor import create_tar_from_codebase

preview_container_id = None

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

    image = payload.blueprint.docker_image
    cmd = payload.blueprint.dev_server_command
    internal_port = payload.blueprint.dev_server_port

    if cmd == "NONE" or internal_port == 0:
        cmd = "python -m http.server 8080 --bind 0.0.0.0"
        internal_port = 8080
        if "node" in image.lower():
            # If it's a node container, use python? No, node doesn't have python by default.
            # We can use npx serve instead
            cmd = "npx serve -p 8080 -H 0.0.0.0"

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
        if has_requirements and "pip install" not in cmd and "python " in cmd:
            cmd = f"pip install -r requirements.txt && {cmd}"

        # Create container mapping internal port to the dynamically found host port
        container = client.containers.create(
            image=image,
            command=["sh", "-c", cmd],
            working_dir="/workspace",
            ports={f"{internal_port}/tcp": host_port}
        )
        
        # Inject the source code before starting
        tar_data = create_tar_from_codebase(payload.codebase)
        container.put_archive("/workspace", tar_data)
        
        container.start()
        preview_container_id = container.id
        
        return {"url": f"http://localhost:{host_port}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

