from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import traceback

from executor import execute_code
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult
from orchestrator import arbitration_engine

# Load environment variables
load_dotenv()

app = FastAPI(title="Auto-SDLC Pipeline")

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

class ArbitrationInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    codebase: GeneratedCodeBase
    execution_result: ExecutionResult

@app.get("/")
def serve_frontend():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "index.html not found."}

from fastapi.responses import StreamingResponse
from agents.requirements_agent import generate_requirements_stream

@app.post("/api/generate-requirements")
def api_generate_requirements(user_input: FeatureRequestInput):
    try:
        return StreamingResponse(
            generate_requirements_stream(user_input.feature_request),
            media_type="text/plain"
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from agents.design_agent import generate_design_stream

@app.post("/api/generate-design")
def api_generate_design(requirements: RequirementsDocument):
    try:
        return StreamingResponse(
            generate_design_stream(requirements),
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

@app.post("/api/parse-requirements")
def api_parse_requirements(payload: TextUpdateInput):
    try:
        api_key = os.environ.get("GEMINI_API_KEY_REQUIREMENTS") or os.environ.get("GEMINI_API_KEY_CODEGEN")
        client = genai.Client(api_key=api_key)
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
def api_execute_code(codebase: GeneratedCodeBase):
    try:
        return execute_code(codebase)
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
            "revision_count": 0
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
