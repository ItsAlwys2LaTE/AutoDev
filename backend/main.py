from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os

from agents.requirements_agent import generate_requirements

# Load environment variables (API Key)
load_dotenv()

app = FastAPI(title="Auto-SDLC Phase 1 Demo")

# Define a Pydantic model for the incoming web request
class FeatureRequestInput(BaseModel):
    feature_request: str

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
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set in the environment.")
        
    try:
        # Call the exact same function we used in demo_phase1.py
        structured_output = generate_requirements(user_input.feature_request)
        # FastAPI will automatically convert the Pydantic object to JSON for the web response
        return structured_output
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))