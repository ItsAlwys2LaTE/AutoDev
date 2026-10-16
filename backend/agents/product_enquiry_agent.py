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
1. PRODUCT TITLE:
   Infer a clean, concise, and professional product title (3 to 6 words maximum) for the software product (e.g., "AI Markdown Notebook", "Enterprise Task Tracker", "Decentralized Chat Platform"). Do NOT include conversational prefixes, quotes, or trailing punctuation.

2. UNDERSTANDING SUMMARY:
   Provide a concise, easy-to-understand explanation of what you understand the user wants to build. Use clear, accessible language without unnecessary technical jargon.

3. IMPLEMENTATION STRATEGY:
   Provide a plain-English, high-level summary of how AutoDev plans to architect, decompose, and implement the requested product (planned tech stack, key components, data flow, API structure).

4. DEFENSE-IN-DEPTH / INVALID REQUEST DETECTION:
   Determine whether the request is an actionable software engineering or application development request.
   - If the request is a factual question, general knowledge query, scientific trivia, math calculation, greeting, or conversational query (NOT software development):
     Set is_valid_software = false, intent = "not_software", provide a comprehensive and helpful direct_answer to their query, and leave follow_up_questions as an empty list [].
   - If the request is a software request:
     Set is_valid_software = true.

5. MANDATORY CLARIFYING QUESTIONS (AT LEAST 3 QUESTIONS):
   Your primary mission is to minimize the amount of assumptions the LLM and engineering pipeline have to make.
   - For EVERY software request, YOU MUST ASK AT LEAST 3 TARGETED FOLLOW-UP QUESTIONS (between 3 and 5 questions) before development begins.
   - Crucial dimensions that MUST be clarified across every software product:
     a) Data Persistence & Storage Model: In-memory mock storage vs embedded SQLite vs relational database (PostgreSQL) vs local filesystem files.
     b) User Authentication, Roles & Permissions: Anonymous/public guest access vs JWT/token-based user accounts vs multi-tenant role-based permissions (RBAC).
     c) Core Functional Workflows & External Integrations: Real-time (WebSockets) vs REST APIs, 3rd-party services / mocks, export formats (JSON, CSV, PDF), or critical workflow constraints.
   - STRICT PROHIBITIONS:
     * NEVER ask trivial cosmetic, styling, or aesthetic questions (e.g. NO questions about button colors, font styling, animations, or dark/light themes). AutoDev's UI design system already handles clean styling automatically.
     * ONLY ask necessary questions about core functionality, architecture, data persistence, integrations, or scope constraints that the system needs clarified.
   - Always formulate between 3 and 5 high-impact questions when is_valid_software = true.
   - Set intent = "ambiguous" whenever follow_up_questions are asked.

6. ASSUMPTIONS:
   List 1 to 4 sensible default technical and functional assumptions AutoDev will make if the user chooses not to answer the clarifying questions.

CRITICAL INSTRUCTIONS:
- Strictly ZERO emojis in any part of the output.
- Output MUST be valid RAW JSON conforming strictly to the schema of ProductEnquiryResult.
"""

DEFAULT_CLARIFYING_QUESTIONS: List[str] = [
    "What data storage or persistence mechanism do you prefer (e.g. SQLite, PostgreSQL, local JSON/files, or mock in-memory storage)?",
    "Do you require user authentication and account management (e.g. JWT login, role-based access, or open guest access)?",
    "Are there any external third-party APIs, real-time protocols (such as WebSockets), or specific data export formats required?",
]


def derive_product_title(prompt: str) -> str:
    """Derives a concise, professional product title from raw prompt text."""
    if not prompt or not prompt.strip():
        return "Software Product"
    clean = prompt.strip()
    import re
    cleaned = re.sub(
        r"^(please\s+)?(i\s+want\s+(to\s+)?(build|make|create|develop)?\s+(a|an|the)?|can\s+you\s+(build|make|create|develop)\s+(a|an|the)?|(build|create|develop|make)\s+(a|an|the)?)\s+",
        "",
        clean,
        flags=re.IGNORECASE,
    ).strip()
    if not cleaned:
        cleaned = clean
    parts = re.split(r"[\.\n\r;]|(?:\s+(?:with|that|where|which|featuring|for)\s+)", cleaned, flags=re.IGNORECASE)
    first_clause = parts[0].strip() if parts else cleaned
    words = first_clause.split()
    if len(words) > 6:
        first_clause = " ".join(words[:6])
    if len(first_clause) > 40:
        first_clause = first_clause[:37].rsplit(" ", 1)[0]
    first_clause = first_clause.strip(" -:;,.")
    if not first_clause:
        return "Software Product"
    def _cap_word(word: str) -> str:
        return "-".join(part if part.isupper() and len(part) <= 5 else part[:1].upper() + part[1:] for part in word.split("-"))
    return " ".join(_cap_word(w) for w in first_clause.split())


def _ensure_min_clarifying_questions(result: ProductEnquiryResult, prompt: str = "") -> ProductEnquiryResult:
    """Ensures at least 3 clarifying questions exist for any valid software request and product_title is set."""
    if not result.product_title or not result.product_title.strip():
        result.product_title = derive_product_title(prompt) if result.is_valid_software else "Non-Software Query"
    if not result.is_valid_software:
        return result
    existing = list(result.follow_up_questions or [])
    if len(existing) < 3:
        for fallback_q in DEFAULT_CLARIFYING_QUESTIONS:
            is_dup = any(
                ("storage" in q.lower() or "database" in q.lower() or "sqlite" in q.lower() or "persist" in q.lower())
                if ("storage" in fallback_q.lower() or "sqlite" in fallback_q.lower())
                else ("auth" in q.lower() or "login" in q.lower() or "account" in q.lower() or "permission" in q.lower())
                if ("auth" in fallback_q.lower() or "login" in fallback_q.lower())
                else ("api" in q.lower() or "websocket" in q.lower() or "export" in q.lower() or "third-party" in q.lower())
                for q in existing
            )
            if not is_dup:
                existing.append(fallback_q)
            if len(existing) >= 3:
                break
        while len(existing) < 3:
            for fallback_q in DEFAULT_CLARIFYING_QUESTIONS:
                if fallback_q not in existing:
                    existing.append(fallback_q)
                if len(existing) >= 3:
                    break
        result.follow_up_questions = existing[:5]
        result.intent = "ambiguous"
    return result


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
            product_title="Software Product",
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
            return _ensure_min_clarifying_questions(result, clean_prompt)
        elif isinstance(result, dict):
            return _ensure_min_clarifying_questions(ProductEnquiryResult.model_validate(result), clean_prompt)
        elif isinstance(result, str):
            return _ensure_min_clarifying_questions(ProductEnquiryResult.model_validate_json(result), clean_prompt)
        else:
            from prompt_guard import get_non_software_reason
            non_sw_reason = get_non_software_reason(clean_prompt)
            if non_sw_reason:
                return ProductEnquiryResult(
                    product_title="Non-Software Query",
                    understanding_summary=f"Non-software query detected: {clean_prompt}",
                    implementation_strategy="AutoDev is an automated software engineering platform and cannot develop non-software queries.",
                    is_valid_software=False,
                    intent="not_software",
                    follow_up_questions=[],
                    assumptions=[],
                    direct_answer=non_sw_reason,
                )
            return _ensure_min_clarifying_questions(
                ProductEnquiryResult(
                    product_title=derive_product_title(clean_prompt),
                    understanding_summary=f"Automated software development for: {clean_prompt}",
                    implementation_strategy="AutoDev will analyze requirements, decompose system architecture, generate modular code, and verify in a sandbox.",
                    is_valid_software=True,
                    intent="ambiguous",
                    follow_up_questions=list(DEFAULT_CLARIFYING_QUESTIONS),
                    assumptions=["Standard modern application architecture with modular components will be utilized."],
                    direct_answer=None,
                ),
                clean_prompt,
            )
    except Exception as e:
        logger.warning(f"Product enquiry call failed ({format_concise_error(e)}). Generating resilient fallback.")
        from prompt_guard import get_non_software_reason
        non_sw_reason = get_non_software_reason(clean_prompt)
        if non_sw_reason:
            return ProductEnquiryResult(
                product_title="Non-Software Query",
                understanding_summary=f"Non-software query detected: {clean_prompt}",
                implementation_strategy="AutoDev is an automated software engineering platform and cannot develop non-software queries.",
                is_valid_software=False,
                intent="not_software",
                follow_up_questions=[],
                assumptions=[],
                direct_answer=non_sw_reason,
            )
        return _ensure_min_clarifying_questions(
            ProductEnquiryResult(
                product_title=derive_product_title(clean_prompt),
                understanding_summary=f"Automated software development for: {clean_prompt}",
                implementation_strategy="AutoDev will analyze requirements, decompose system architecture, generate modular code, and verify in a sandbox environment.",
                is_valid_software=True,
                intent="ambiguous",
                follow_up_questions=list(DEFAULT_CLARIFYING_QUESTIONS),
                assumptions=["Standard modern application architecture will be utilized."],
                direct_answer=None,
            ),
            clean_prompt,
        )
