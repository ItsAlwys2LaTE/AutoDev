from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import traceback

from agents.requirements_agent import generate_requirements
from agents.design_agent import generate_design
from agents.codegen_agent import generate_code
from executor import execute_code
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult
from orchestrator import arbitration_engine

# Load environment variables
load_dotenv()

app = FastAPI(title="Auto-SDLC Pipeline")

class FeatureRequestInput(BaseModel):
    feature_request: str

class CodeGenInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint

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

@app.post("/api/generate-requirements")
def api_generate_requirements(user_input: FeatureRequestInput):
    try:
        return generate_requirements(user_input.feature_request)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-design")
def api_generate_design(requirements: RequirementsDocument):
    try:
        return generate_design(requirements)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-code")
def api_generate_code(payload: CodeGenInput):
    try:
        return generate_code(payload.requirements, payload.blueprint)
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