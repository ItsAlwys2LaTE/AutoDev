import os
import sys
import re
import json
import logging
from typing import Optional, List, Any

# Ensure singleton module resolution
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import IntentClassification
from key_balancer import execute_with_key_fallback, resolve_models_for_mode
from retry import format_concise_error
from google.genai import types

logger = logging.getLogger(__name__)

INTENT_CLASSIFIER_SYSTEM_PROMPT = """
You are an expert AI Intent Classifier and Query Triage Specialist for AutoDev, an automated software engineering platform.
Your job is to analyze user prompts and determine whether the user intends to build/develop software, if the request is an ambiguous software idea that needs clarification, or if it is a non-software question/statement.

You must categorize the user request into exactly ONE of the following three intents:

1. "software_request":
   - The user is asking to build, create, code, develop, design, implement, or modify a software system, application, tool, API, website, game, dashboard, script, or component.
   - The request contains sufficient technical detail, functional requirements, or clear scope for a technical requirements document to be drafted.
   - Examples: "Build a distance calculator web app using React and Tailwind", "Create a REST API for book management with FastAPI and SQLite", "A pomodoro timer with audio alerts and local storage".
   - Required fields:
     - "intent": "software_request"
     - "confidence": Float between 0.8 and 1.0
     - "reasoning": Concise explanation of why this is an actionable software request
     - "follow_up_questions": null
     - "direct_answer": null

2. "ambiguous":
   - The user mentions a software tool, widget, or feature, but the request is terse (e.g. 2-3 words), underspecified, or lacks key technical details (such as platform, key features, inputs, or desired tech stack).
   - Examples: "distance calculator", "todo app", "weather widget", "auth system", "url shortener".
   - Note: If previous clarification context is provided and adequately resolves the ambiguity, classify as "software_request" instead.
   - If ambiguous, you MUST provide 2 to 3 concise, highly relevant follow-up questions to help specify the product requirements.
   - Required fields:
     - "intent": "ambiguous"
     - "confidence": Float between 0.6 and 0.95
     - "reasoning": Concise explanation of what details are missing
     - "follow_up_questions": A list of exactly 2 or 3 clear questions (e.g. ["What platform or framework would you prefer (e.g., React web app or Python CLI)?", "What specific calculation formula or inputs should be supported?", "Are there any specific UI or styling preferences?"])
     - "direct_answer": null

3. "not_software":
   - The user prompt is a factual question, general knowledge query, mathematical calculation, unit conversion, conversational greeting, creative writing, or opinion request that is NOT an instruction to build software.
   - Examples: "What's the distance between land and ocean?", "Calculate 2+2", "What is the capital of France?", "Who wrote Hamlet?", "Tell me a joke about computers".
   - You MUST provide a concise, accurate, direct answer to the question in the "direct_answer" field.
   - Required fields:
     - "intent": "not_software"
     - "confidence": Float between 0.85 and 1.0
     - "reasoning": Concise explanation of why this is a factual, math, or conversational query rather than a software build request
     - "follow_up_questions": null
     - "direct_answer": A helpful, direct answer answering the user's query

CRITICAL RULES:
- Output MUST be valid RAW JSON conforming strictly to the schema of IntentClassification.
- If the user provided Clarification Context from previous rounds, take that context into account! If the user answered the follow-up questions, upgrade the classification to "software_request".
"""


def _extract_intent_classification(response: Any) -> IntentClassification:
    """Extracts and validates IntentClassification from Gemini response object."""
    if hasattr(response, "parsed") and response.parsed is not None:
        if isinstance(response.parsed, IntentClassification):
            return response.parsed
        if isinstance(response.parsed, dict):
            return IntentClassification.model_validate(response.parsed)
    raw_text = getattr(response, "text", "") or ""
    # Strip markdown backticks
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        return IntentClassification.model_validate_json(cleaned)
    except Exception:
        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            return IntentClassification.model_validate_json(match.group(1))
        raise


def classify_intent(
    prompt: str,
    mode: str = "QUICK",
    context: Optional[str] = None
) -> IntentClassification:
    """
    Classifies the user's intent into software_request, ambiguous, or not_software.
    Uses execute_with_key_fallback on stage 'REQUIREMENTS' with primary gemini-3.5-flash-lite
    and secondary gemini-3.1-flash-lite.
    Gracefully degrades to (intent: 'software_request', confidence: 0.5) if LLM call fails.
    """
    prompt_clean = (prompt or "").strip()
    if not prompt_clean:
        return IntentClassification(
            intent="software_request",
            confidence=0.5,
            reasoning="Default fallback: empty prompt supplied.",
            follow_up_questions=None,
            direct_answer=None
        )

    user_content = f"User Prompt:\n{prompt_clean}"
    if context and context.strip():
        user_content += f"\n\nClarification Context from Previous Rounds:\n{context.strip()}"

    def _call(client: Any, model: str) -> IntentClassification:
        response = client.models.generate_content(
            model=model,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=INTENT_CLASSIFIER_SYSTEM_PROMPT,
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=IntentClassification,
            )
        )
        return _extract_intent_classification(response)

    try:
        primary_model, secondary_model = resolve_models_for_mode(
            mode, primary_model="gemini-3.5-flash-lite", secondary_model="gemini-3.1-flash-lite"
        )
        result = execute_with_key_fallback(
            stage="REQUIREMENTS",
            call_fn=_call,
            primary_model=primary_model,
            secondary_model=secondary_model,
            mode=mode,
        )
        if isinstance(result, IntentClassification):
            return result
        elif isinstance(result, dict):
            return IntentClassification.model_validate(result)
        elif isinstance(result, str):
            return IntentClassification.model_validate_json(result)
        else:
            return IntentClassification(
                intent="software_request",
                confidence=0.5,
                reasoning="Classifier returned unexpected type; defaulting to software_request.",
                follow_up_questions=None,
                direct_answer=None
            )
    except Exception as e:
        logger.warning(f"Intent classification call failed ({format_concise_error(e)}). Falling back gracefully.")
        return IntentClassification(
            intent="software_request",
            confidence=0.5,
            reasoning=f"Graceful fallback: classifier unavailable or failed ({format_concise_error(e)})",
            follow_up_questions=None,
            direct_answer=None
        )
