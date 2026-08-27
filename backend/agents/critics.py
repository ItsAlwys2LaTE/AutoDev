import os
import sys
import json
from google import genai
from google.genai import types
from mistralai.client import Mistral
from groq import Groq
import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult, CriticFeedback

def evaluate_correctness(requirements: RequirementsDocument, execution_result: ExecutionResult) -> CriticFeedback:
    critic_name = "Correctness Critic (Gemini)"
    print(f"Running {critic_name}...")
    
    api_key = os.environ.get("GEMINI_API_KEY_CRITICS")
    if not api_key:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI_API_KEY_CRITICS is not set.")

    prompt = f"""
    Evaluate the CORRECTNESS of the code based on the execution logs.
    Did the tests pass? Do the tests actually cover the Acceptance Criteria?
    
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}
    
    EXECUTION LOGS:
    {execution_result.model_dump_json(indent=2)}
    """
    
    client = genai.Client(api_key=api_key)
    system_instruction = f"You are the {critic_name}. Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

    def _call(model_name: str):
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=CriticFeedback,
            )
        )
        if hasattr(response, 'parsed') and response.parsed is not None:
            feedback = response.parsed
        else:
            feedback = CriticFeedback.model_validate_json(response.text)
        feedback.critic_name = critic_name
        return feedback

    try:
        return _call("gemini-3.6-flash")
    except Exception as e:
        print(f"Correctness Critic primary model failed: {e}. Falling back to gemini-3.5-flash-lite...")
        try:
            return _call("gemini-3.5-flash-lite")
        except Exception as fallback_e:
            return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {str(fallback_e)}"], overall_comments="Failed to evaluate correctness.")

def evaluate_architecture(blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase) -> CriticFeedback:
    critic_name = "Architecture Critic (Mistral)"
    print(f"Running {critic_name}...")
    
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="MISTRAL_API_KEY is not set.")

    prompt = f"""
    Evaluate the ARCHITECTURE of the codebase against the blueprint.
    Did the generated code follow the exact file structure and structural logic defined in the blueprint?
    CRITICAL INSTRUCTION: Do NOT flag defensive programming, input validation (e.g., max input lengths), boundary limits, robust error state handling, or edge-case handling as unauthorized "deviations." These are POSITIVE robustness features. You should ONLY flag major structural deviations (e.g., using entirely wrong design patterns, missing required files, or completely ignoring the blueprint's data flow).
    
    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}
    
    CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """
    
    client = Mistral(api_key=api_key)
    
    try:
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[
                {"role": "system", "content": f"You are the {critic_name}. You MUST output ONLY valid JSON matching this exact structure: {{\"severity_score\": int, \"issues_list\": [\"issue1\"], \"overall_comments\": \"string\"}}"},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        content = json.loads(response.choices[0].message.content)
        
        # Guard: API sometimes wraps the response in a list
        if isinstance(content, list):
            content = content[0] if len(content) > 0 else {}
        
        return CriticFeedback(
            critic_name=critic_name,
            severity_score=content.get("severity_score", 5),
            issues_list=content.get("issues_list", []),
            overall_comments=content.get("overall_comments", "No comments provided.")
        )
    except Exception as e:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Mistral API Error: {str(e)}"], overall_comments="Failed to evaluate architecture.")

# ---------------------------------------------------------
# 3. COMPLETENESS CRITIC (Groq - Llama 3.3 70B)
# ---------------------------------------------------------
def evaluate_completeness(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase) -> CriticFeedback:
    print("Running Completeness Critic (Groq GPT-OSS 120B)...")
    critic_name = "Completeness Critic (Groq GPT-OSS)"
    api_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GROQ_API_KEY is not set.")
    
    prompt = f"""
    Evaluate the COMPLETENESS of the codebase against the blueprint and requirements.
    Are there any missing edge cases (e.g., division by zero), unhandled exceptions, or logical bugs that break the intended system?
    
    CRITICAL INSTRUCTION: You MUST ONLY suggest fixes for edge cases or bugs that fit WITHIN the provided BLUEPRINT constraints. DO NOT suggest adding new features, scientific notation, new variables (like MAX_LENGTH), or extending the scope beyond what the blueprint defines. Point out crash-bugs and logical gaps only.
    
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}

    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}
    
    CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """
    
    client = Groq(api_key=api_key)
    
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": f"You are the {critic_name}. You MUST output ONLY a valid JSON object. Ensure it exactly matches this JSON schema structure: {{\"severity_score\": 5, \"issues_list\": [\"issue1\", \"issue2\"], \"overall_comments\": \"Your comment here\"}}"},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        content = json.loads(response.choices[0].message.content)
        
        # Guard: Groq sometimes wraps the response in a list
        if isinstance(content, list):
            content = content[0] if len(content) > 0 else {}
        
        return CriticFeedback(
            critic_name=critic_name,
            severity_score=content.get("severity_score", 5),
            issues_list=content.get("issues_list", []),
            overall_comments=content.get("overall_comments", "No comments provided.")
        )
    except Exception as e:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Groq API Error: {str(e)}"], overall_comments="Failed to evaluate completeness.")
