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
    
    primary_key = os.environ.get("GEMINI_API_KEY_CRITICS")
    fallback_key = os.environ.get("GEMINI_API_KEY_ADJUDICATOR") or primary_key
    if not primary_key and not fallback_key:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI API keys are not set.")

    prompt = f"""
    Evaluate the CORRECTNESS of the code based on the execution logs.
    If the logs indicate "Static files generated successfully", then automated tests were appropriately bypassed for this stack. In that case, evaluate if the files generated match the requirements.
    Otherwise, did the tests pass? Do the tests actually cover the Acceptance Criteria?
    
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}
    
    EXECUTION LOGS:
    {execution_result.model_dump_json(indent=2)}
    """
    
    system_instruction = f"You are the {critic_name}. Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

    def _call(model_name: str, use_fallback_key: bool = False):
        key = fallback_key if use_fallback_key else primary_key
        client = genai.Client(api_key=key)
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
        error_msg = str(e).lower()
        if "429" in error_msg or "rate limit" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
            print(f"Correctness Critic hit rate limit: {e}. Falling back to Adjudicator key with gemini-3.5-flash-lite...")
            try:
                return _call("gemini-3.5-flash-lite", use_fallback_key=True)
            except Exception as fallback_e:
                return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {str(fallback_e)}"], overall_comments="Failed to evaluate correctness.")
        else:
            print(f"Correctness Critic primary model failed (busy/error): {e}. Downgrading to gemini-3.5-flash-lite on SAME key...")
            try:
                return _call("gemini-3.5-flash-lite", use_fallback_key=False)
            except Exception as fallback_e:
                return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {str(fallback_e)}"], overall_comments="Failed to evaluate correctness.")

def evaluate_architecture(blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase) -> CriticFeedback:
    critic_name = "Architecture Critic (Mistral)"
    print(f"Running {critic_name}...")
    
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        print(f"MISTRAL_API_KEY missing. Forcing fallback...")
        api_key = "dummy_key_to_force_fallback"

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
        error_msg = str(e).lower()
        if "429" in error_msg or "rate limit" in error_msg or "quota" in error_msg or "401" in error_msg or "unauthorized" in error_msg or api_key == "dummy_key_to_force_fallback":
            print(f"Architecture Critic (Mistral) hit rate limit or missing key: {e}. Falling back to Gemini with Adjudicator key...")
            fallback_key = os.environ.get("GEMINI_API_KEY_ADJUDICATOR")
            if not fallback_key:
                return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Mistral API Error: {str(e)}", "No fallback Adjudicator key available."], overall_comments="Failed to evaluate architecture.")
                
            try:
                gemini_client = genai.Client(api_key=fallback_key)
                system_instruction = f"You are the {critic_name} (Fallback Mode). Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."
                gemini_response = gemini_client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.1,
                        response_mime_type="application/json",
                        response_schema=CriticFeedback,
                    )
                )
                if hasattr(gemini_response, 'parsed') and gemini_response.parsed is not None:
                    feedback = gemini_response.parsed
                else:
                    feedback = CriticFeedback.model_validate_json(gemini_response.text)
                feedback.critic_name = critic_name
                return feedback
            except Exception as fallback_e:
                return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Mistral Error: {str(e)}", f"Gemini Fallback Error: {str(fallback_e)}"], overall_comments="Failed to evaluate architecture.")
        else:
            return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Mistral API Error (Non-Rate Limit): {str(e)}"], overall_comments="Failed to evaluate architecture.")

# ---------------------------------------------------------
# 3. COMPLETENESS CRITIC (Gemini)
# ---------------------------------------------------------
def evaluate_completeness(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase) -> CriticFeedback:
    print("Running Completeness Critic (Gemini 3.6-flash)...")
    critic_name = "Completeness Critic (Gemini)"
    primary_key = os.environ.get("GEMINI_API_KEY_CRITICS")
    fallback_key = os.environ.get("GEMINI_API_KEY_ADJUDICATOR") or primary_key
    if not primary_key and not fallback_key:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI API keys are not set.")
    
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
    
    system_instruction = f"You are the {critic_name}. Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

    def _call(model_name: str, use_fallback_key: bool = False):
        key = fallback_key if use_fallback_key else primary_key
        client = genai.Client(api_key=key)
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
            return response.parsed
        else:
            return CriticFeedback.model_validate_json(response.text)

    try:
        feedback = _call("gemini-3.6-flash")
        feedback.critic_name = critic_name
        return feedback
    except Exception as e:
        error_msg = str(e).lower()
        if "429" in error_msg or "rate limit" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
            print(f"Completeness Critic hit rate limit: {e}. Falling back to Adjudicator key with gemini-3.5-flash-lite...")
            try:
                feedback = _call("gemini-3.5-flash-lite", use_fallback_key=True)
                feedback.critic_name = critic_name
                return feedback
            except Exception as fallback_e:
                return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {str(fallback_e)}"], overall_comments="Failed to evaluate completeness.")
        else:
            print(f"Completeness Critic primary model failed (busy/error): {e}. Downgrading to gemini-3.5-flash-lite on SAME key...")
            try:
                feedback = _call("gemini-3.5-flash-lite", use_fallback_key=False)
                feedback.critic_name = critic_name
                return feedback
            except Exception as fallback_e:
                return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {str(fallback_e)}"], overall_comments="Failed to evaluate completeness.")
