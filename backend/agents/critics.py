import os
import sys
import json
from google import genai
from google.genai import types
from mistralai.client import Mistral
from groq import Groq

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import ComponentDecomposition, RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult, CriticFeedback
from retry import with_exponential_backoff
from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error, resolve_models_for_mode, get_generation_mode

def evaluate_correctness(requirements: RequirementsDocument, execution_result: ExecutionResult, mode: str = None) -> CriticFeedback:
    critic_name = "Correctness Critic (Gemini)"
    primary_model, secondary_model = resolve_models_for_mode(mode)
    print(f"Running {critic_name} (Model: {primary_model})...")
    
    primary_key = os.environ.get("GEMINI_API_KEY_CRITICS")
    keys = get_gemini_keys_for_stage("CRITIC_CORRECTNESS", mode=mode)
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    
    if not keys:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI API keys are not set.")

    prompt = f"""
    Evaluate the CORRECTNESS of the code based on the execution logs.
    Did the tests pass? Do the tests actually cover the Acceptance Criteria?
    
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}
    
    EXECUTION LOGS:
    {execution_result.model_dump_json(indent=2)}
    """
    
    system_instruction = f"You are the {critic_name}. Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

    # Try all primary keys with resolved primary model
    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _call_primary():
            response = client.models.generate_content(
                model=primary_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=CriticFeedback,
                )
            )
            if hasattr(response, 'parsed') and response.parsed is not None:
                fb = response.parsed
            else:
                fb = CriticFeedback.model_validate_json(response.text)
            fb.critic_name = critic_name
            return fb

        try:
            return _call_primary()
        except Exception as e:
            print(f"Correctness Critic failed on key {idx+1}/{len(keys)} (Model: {primary_model}): {e}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _call_fallback():
                        response = fb_client.models.generate_content(
                            model=secondary_model,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=0.1,
                                response_mime_type="application/json",
                                response_schema=CriticFeedback,
                            )
                        )
                        if hasattr(response, 'parsed') and response.parsed is not None:
                            fb = response.parsed
                        else:
                            fb = CriticFeedback.model_validate_json(response.text)
                        fb.critic_name = critic_name
                        return fb

                    try:
                        return _call_fallback()
                    except Exception as fallback_e:
                        print(f"Correctness Critic fallback on key {fb_idx+1} failed (Model: {secondary_model}): {fallback_e}")
                        if fb_idx + 1 < len(keys):
                            continue
                        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {str(fallback_e)}"], overall_comments="Failed to evaluate correctness.")



def evaluate_architecture(blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, master_decomposition: ComponentDecomposition = None, mode: str = None) -> CriticFeedback:
    critic_name = "Architecture Critic (Mistral)"
    primary_model, secondary_model = resolve_models_for_mode(mode)
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

    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing functionality if it logically belongs to a different component described in the master plan!
    
    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing files or missing endpoints if they belong to a different component described in the master plan!
        
    CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """
    
    client = Mistral(api_key=api_key)
    
    @with_exponential_backoff
    def _call_mistral():
        return client.chat.complete(
            model="mistral-small-latest",
            messages=[
                {"role": "system", "content": f"You are the {critic_name}. You MUST output ONLY valid JSON matching this exact structure: {{\"severity_score\": int, \"issues_list\": [\"issue1\"], \"overall_comments\": \"string\"}}"},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )

    try:
        response = _call_mistral()
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
            print(f"Architecture Critic (Mistral) hit rate limit or missing key: {e}. Falling back to Gemini (Model: {primary_model})...")
            gemini_keys = get_gemini_keys_for_stage("CRITIC_ARCHITECTURE", mode=mode)
            adjudicator_key = os.environ.get("GEMINI_API_KEY_ADJUDICATOR")
            if adjudicator_key and adjudicator_key.strip() and adjudicator_key.strip() not in gemini_keys:
                gemini_keys = [adjudicator_key.strip()] + gemini_keys
            if not gemini_keys:
                return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Mistral API Error: {str(e)}", "No fallback Gemini keys available."], overall_comments="Failed to evaluate architecture.")
                
            system_instruction = f"You are the {critic_name} (Fallback Mode). Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

            # Try primary model across available keys
            for g_idx, g_key in enumerate(gemini_keys):
                gemini_client = genai.Client(api_key=g_key)

                @with_exponential_backoff
                def _call_gemini_primary():
                    res = gemini_client.models.generate_content(
                        model=primary_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.1,
                            response_mime_type="application/json",
                            response_schema=CriticFeedback,
                        )
                    )
                    if hasattr(res, 'parsed') and res.parsed is not None:
                        fb = res.parsed
                    else:
                        fb = CriticFeedback.model_validate_json(res.text)
                    fb.critic_name = critic_name
                    return fb

                try:
                    return _call_gemini_primary()
                except Exception as g_err:
                    print(f"Gemini fallback ({primary_model}) on key {g_idx+1} failed: {g_err}")
                    if is_rate_limit_error(g_err) and g_idx + 1 < len(gemini_keys):
                        continue

            # If all primary keys fail, try secondary model
            print(f"Falling back to {secondary_model} (Model: {secondary_model}) for Architecture Critic...")
            for g_idx, g_key in enumerate(gemini_keys):
                gemini_client = genai.Client(api_key=g_key)

                @with_exponential_backoff
                def _call_gemini_fallback():
                    res = gemini_client.models.generate_content(
                        model=secondary_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.1,
                            response_mime_type="application/json",
                            response_schema=CriticFeedback,
                        )
                    )
                    if hasattr(res, 'parsed') and res.parsed is not None:
                        fb = res.parsed
                    else:
                        fb = CriticFeedback.model_validate_json(res.text)
                    fb.critic_name = critic_name
                    return fb

                try:
                    return _call_gemini_fallback()
                except Exception as fallback_e:
                    print(f"Gemini fallback ({secondary_model}) on key {g_idx+1} failed: {fallback_e}")
                    if g_idx + 1 < len(gemini_keys):
                        continue
                    return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Mistral Error: {str(e)}", f"Gemini Fallback Error: {str(fallback_e)}"], overall_comments="Failed to evaluate architecture.")
        else:
            return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Mistral API Error (Non-Rate Limit): {str(e)}"], overall_comments="Failed to evaluate architecture.")


def evaluate_completeness(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, master_decomposition: ComponentDecomposition = None, mode: str = None) -> CriticFeedback:
    primary_model, secondary_model = resolve_models_for_mode(mode)
    print(f"Running Completeness Critic (Gemini) (Model: {primary_model})...")
    critic_name = "Completeness Critic (Gemini)"
    
    primary_key = os.environ.get("GEMINI_API_KEY_CRITICS")
    keys = get_gemini_keys_for_stage("CRITIC_COMPLETENESS", mode=mode)
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    
    if not keys:
        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=["API Key Missing"], overall_comments="GEMINI API keys are not set.")
    
    prompt = f"""
    Evaluate the COMPLETENESS of the codebase against the blueprint and requirements.
    Are there any missing edge cases (e.g., division by zero), unhandled exceptions, or logical bugs that break the intended system?
    
    CRITICAL INSTRUCTION: You MUST ONLY suggest fixes for edge cases or bugs that fit WITHIN the provided BLUEPRINT constraints. DO NOT suggest adding new features, scientific notation, new variables (like MAX_LENGTH), or extending the scope beyond what the blueprint defines. Point out crash-bugs and logical gaps only.
    
    REQUIREMENTS:
    {requirements.model_dump_json(indent=2)}

    BLUEPRINT:
    {blueprint.model_dump_json(indent=2)}

    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing functionality if it logically belongs to a different component described in the master plan!
    
    MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing files or missing endpoints if they belong to a different component described in the master plan!
        
    CODEBASE:
    {codebase.model_dump_json(indent=2)}
    """
    
    system_instruction = f"You are the {critic_name}. Evaluate the provided inputs strictly. Output a severity_score (0-10) and a list of specific issues."

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _call_primary():
            response = client.models.generate_content(
                model=primary_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=CriticFeedback,
                )
            )
            if hasattr(response, 'parsed') and response.parsed is not None:
                fb = response.parsed
            else:
                fb = CriticFeedback.model_validate_json(response.text)
            fb.critic_name = critic_name
            return fb

        try:
            return _call_primary()
        except Exception as e:
            print(f"Completeness Critic failed on key {idx+1}/{len(keys)} (Model: {primary_model}): {e}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on {primary_model}...")
                continue
            else:
                print(f"Falling back to {secondary_model} (Model: {secondary_model})...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _call_fallback():
                        response = fb_client.models.generate_content(
                            model=secondary_model,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=0.1,
                                response_mime_type="application/json",
                                response_schema=CriticFeedback,
                            )
                        )
                        if hasattr(response, 'parsed') and response.parsed is not None:
                            fb = response.parsed
                        else:
                            fb = CriticFeedback.model_validate_json(response.text)
                        fb.critic_name = critic_name
                        return fb

                    try:
                        return _call_fallback()
                    except Exception as fallback_e:
                        print(f"Completeness Critic fallback on key {fb_idx+1} failed (Model: {secondary_model}): {fallback_e}")
                        if fb_idx + 1 < len(keys):
                            continue
                        return CriticFeedback(critic_name=critic_name, severity_score=10, issues_list=[f"Gemini API Error: {str(fallback_e)}"], overall_comments="Failed to evaluate completeness.")


