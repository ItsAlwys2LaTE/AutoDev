from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os

from agents.requirements_agent import generate_requirements
from agents.design_agent import generate_design
from agents.codegen_agent import generate_code
from executor import execute_code
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase

# Load environment variables (API Key)
load_dotenv()

app = FastAPI(title="Auto-SDLC Phase 1 & 2 Demo")

# Define a Pydantic model for the incoming web request
class FeatureRequestInput(BaseModel):
    feature_request: str

class CodeGenInput(BaseModel):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint

@app.get("/")
async def serve_frontend():
    """Serves the main HTML page."""
    # Checks if index.html exists in the same directory
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"error": "index.html not found. Please ensure it is in the backend folder."}

@app.post("/api/generate-requirements")
async def api_generate_requirements(user_input: FeatureRequestInput):
    """API endpoint that receives text and returns structured requirements."""
    if not os.environ.get("GEMINI_API_KEY_REQUIREMENTS"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY_REQUIREMENTS is not set in the environment.")
        
    try:
        structured_output = generate_requirements(user_input.feature_request)
        return structured_output
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-design")
async def api_generate_design(requirements: RequirementsDocument):
    """API endpoint that receives requirements and returns a design blueprint."""
    if not os.environ.get("GEMINI_API_KEY_DESIGN"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY_DESIGN is not set in the environment.")
        
    try:
        # Call the new Design Agent
        blueprint = generate_design(requirements)
        return blueprint
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-code")
async def api_generate_code(payload: CodeGenInput):
    """API endpoint that receives requirements and blueprint and returns code."""
    if not os.environ.get("GEMINI_API_KEY_CODEGEN"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY_CODEGEN is not set in the environment.")
        
    try:
        codebase = generate_code(payload.requirements, payload.blueprint)
        return codebase
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute-code")
async def api_execute_code(codebase: GeneratedCodeBase):
    """API endpoint that writes code to a sandbox and runs tests."""
    try:
        result = execute_code(codebase)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))