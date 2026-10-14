import os
import sys
import json
import logging
from typing import Optional, Any, List

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import ProductEnquiryResult
from key_balancer import execute_with_key_fallback, resolve_models_for_mode
from retry import format_concise_error
from google.genai import types

logger = logging.getLogger(__name__)

PRODUCT_ENQUIRY_SYSTEM_PROMPT = """
You are the Product Enquiry Agent for AutoDev, an automated software engineering platform.
You are the second phase of the software engineering pipeline, evaluating the user's initial product request.

Your core objectives:
1. UNDERSTANDING SUMMARY:
   Provide a concise, easy-to-understand explanation of what you understand the user wants to build. Use clear, accessible language without unnecessary technical jargon.

2. IMPLEMENTATION STRATEGY:
   Provide a plain-English, high-level summary of how AutoDev plans to architect, decompose, and implement the requested product (planned tech stack, key components, data flow, API structure).

3. DEFENSE-IN-DEPTH / INVALID REQUEST DETECTION:
   Determine whether the request is an actionable software engineering or application development request.
   - If the request is a factual question, general knowledge query, scientific trivia, math calculation, greeting, or conversational query (NOT software development):
     Set is_valid_software = false, intent = "not_software", provide a comprehensive and helpful direct_answer to their query, and leave follow_up_questions as an empty list [].
   - If the request is a software request:
     Set is_valid_software = true.

4. PROACTIVE & TARGETED FOLLOW-UP QUESTIONS:
   Your primary mission is to minimize the amount of assumptions the LLM and engineering pipeline have to make.
   - If the user's software request has ANY ambiguity, confusion, or unspecified preferences regarding core architecture, storage, authentication, or functional workflow:
     YOU MUST ASK 1 TO 3 TARGETED FOLLOW-UP QUESTIONS.
   - Common critical areas that require clarifying questions when unspecified:
     a) Data Persistence & Storage: In-memory mock storage vs SQLite/relational database vs file-based storage.
     b) User Authentication & Access: Anonymous/open access vs user login / JWT auth vs role-based permissions.
     c) Core Business Workflows & APIs: Key features, external APIs (real vs mocked), real-time updates (WebSockets) vs REST, or export formats.
     d) Scope Constraints: Single-tenant vs multi-tenant, standalone local app vs full-stack client-server.
   - STRICT PROHIBITIONS:
     * NEVER ask trivial cosmetic, styling, or aesthetic questions (e.g. NO questions about button colors, font styling, animations, or dark/light themes). AutoDev's UI design system already handles clean styling automatically.
     * ONLY ask necessary questions about core functionality, architecture, data persistence, integrations, or scope constraints that the system needs clarified.
   - Do NOT ask more than 3 questions (clamp strictly between 1 and 3 questions if there is any ambiguity).
   - ONLY leave follow_up_questions as empty [] if the user prompt is already 100% comprehensive and explicitly details its database, auth, data model, APIs, and workflows without any ambiguity. If any detail is missing, ASK.
   - If you ask any follow-up questions, set intent = "ambiguous". If the prompt is 100% complete and self-contained with no questions needed, set intent = "software_request".

5. ASSUMPTIONS:
   List 1 to 4 sensible default technical and functional assumptions AutoDev will make if the user chooses not to answer the clarifying questions.

CRITICAL INSTRUCTIONS:
- Strictly ZERO emojis in any part of the output.
- Output MUST be valid RAW JSON conforming strictly to the schema of ProductEnquiryResult.
"""


def _extract_product_enquiry_result(response: Any) -> ProductEnquiryResult:
    """Extracts and validates ProductEnquiryResult from Gemini response."""
    if hasattr(response, "parsed") and response.parsed is not None:
        if isinstance(response.parsed, ProductEnquiryResult):
            return response.parsed
        if isinstance(response.parsed, dict):
            return ProductEnquiryResult.model_validate(response.parsed)
    raw_text = getattr(response, "text", "") or ""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("\n", 1)[0]
    cleaned = cleaned.strip()
    try:
        return ProductEnquiryResult.model_validate_json(cleaned)
    except Exception:
        import re
        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            return ProductEnquiryResult.model_validate_json(match.group(1))
        raise


def run_product_enquiry(
    prompt: str,
    mode: str = "QUICK",
    context: Optional[str] = None,
    user_api_key: Optional[str] = None,
) -> ProductEnquiryResult:
    """
    Executes the Product Enquiry Agent.
    Evaluates the user's prompt, produces a plain-English summary of understanding,
    outlines the planned implementation strategy, identifies sensible default assumptions,
    and asks 0-3 non-trivial functional clarifying questions.
    """
    clean_prompt = (prompt or "").strip()
    if not clean_prompt:
        return ProductEnquiryResult(
            understanding_summary="No product request provided.",
            implementation_strategy="Awaiting product description.",
            is_valid_software=False,
            intent="ambiguous",
            follow_up_questions=["What software application or system would you like AutoDev to build?"],
            assumptions=[],
            direct_answer=None,
        )

    user_content = f"User Product Request:\n{clean_prompt}"
    if context and context.strip():
        user_content += f"\n\nPrevious Clarification & Preference Context:\n{context.strip()}"

    def _call(client: Any, model: str) -> ProductEnquiryResult:
        try:
            response = client.models.generate_content(
                model=model,
                contents=user_content,
                config=types.GenerateContentConfig(
                    system_instruction=PRODUCT_ENQUIRY_SYSTEM_PROMPT,
                    temperature=0.2,
                    response_mime_type="application/json",
                    response_schema=ProductEnquiryResult,
                )
            )
        except Exception as schema_err:
            err_msg = str(schema_err).lower()
            if "schema" in err_msg or "default" in err_msg:
                logger.info(f"Retrying generate_content without response_schema due to: {schema_err}")
                response = client.models.generate_content(
                    model=model,
                    contents=user_content,
                    config=types.GenerateContentConfig(
                        system_instruction=PRODUCT_ENQUIRY_SYSTEM_PROMPT,
                        temperature=0.2,
                        response_mime_type="application/json",
                    )
                )
            else:
                raise schema_err
        return _extract_product_enquiry_result(response)

    try:
        primary_model, secondary_model = resolve_models_for_mode(
            mode, primary_model="gemini-3.5-flash-lite", secondary_model="gemini-3.1-flash-lite"
        )
        if user_api_key:
            from key_balancer import execute_with_user_key
            result = execute_with_user_key(
                user_api_key=user_api_key,
                call_fn=_call,
                primary_model=primary_model,
                secondary_model=secondary_model,
            )
        else:
            result = execute_with_key_fallback(
                stage="PRODUCT_ENQUIRY",
                call_fn=_call,
                primary_model=primary_model,
                secondary_model=secondary_model,
                mode=mode,
            )
        if isinstance(result, ProductEnquiryResult):
            return result
        elif isinstance(result, dict):
            return ProductEnquiryResult.model_validate(result)
        elif isinstance(result, str):
            return ProductEnquiryResult.model_validate_json(result)
        else:
            from prompt_guard import get_non_software_reason
            non_sw_reason = get_non_software_reason(clean_prompt)
            if non_sw_reason:
                return ProductEnquiryResult(
                    understanding_summary=f"Non-software query detected: {clean_prompt}",
                    implementation_strategy="AutoDev is an automated software engineering platform and cannot develop non-software queries.",
                    is_valid_software=False,
                    intent="not_software",
                    follow_up_questions=[],
                    assumptions=[],
                    direct_answer=non_sw_reason,
                )
            return ProductEnquiryResult(
                understanding_summary=f"Automated software development for: {clean_prompt}",
                implementation_strategy="AutoDev will analyze requirements, decompose system architecture, generate modular code, and verify in a sandbox.",
                is_valid_software=True,
                intent="ambiguous",
                follow_up_questions=[
                    "What data storage or persistence mechanism do you prefer (e.g. SQLite, PostgreSQL, or in-memory)?",
                    "Do you require user authentication with individual user accounts, or open single-user access?",
                ],
                assumptions=["Standard modern application architecture with modular components will be utilized."],
                direct_answer=None,
            )
    except Exception as e:
        logger.warning(f"Product enquiry call failed ({format_concise_error(e)}). Generating resilient fallback.")
        from prompt_guard import get_non_software_reason
        non_sw_reason = get_non_software_reason(clean_prompt)
        if non_sw_reason:
            return ProductEnquiryResult(
                understanding_summary=f"Non-software query detected: {clean_prompt}",
                implementation_strategy="AutoDev is an automated software engineering platform and cannot develop non-software queries.",
                is_valid_software=False,
                intent="not_software",
                follow_up_questions=[],
                assumptions=[],
                direct_answer=non_sw_reason,
            )
        return ProductEnquiryResult(
            understanding_summary=f"Automated software development for: {clean_prompt}",
            implementation_strategy="AutoDev will analyze requirements, decompose system architecture, generate modular code, and verify in a sandbox environment.",
            is_valid_software=True,
            intent="ambiguous",
            follow_up_questions=[
                "What database or storage mechanism do you prefer for persisting data (e.g. SQLite database or in-memory)?",
                "Do you require user authentication and account management, or will the application be open for guest access?",
            ],
            assumptions=["Standard modern application architecture will be utilized."],
            direct_answer=None,
        )
