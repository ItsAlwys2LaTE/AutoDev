import re
from typing import Optional

class PromptGuardError(ValueError):
    """Base exception for all prompt guard validation errors."""
    pass


class NonSoftwarePromptError(PromptGuardError):
    """Raised when a prompt is deterministically identified as a non-software request."""
    pass


SOFTWARE_KEYWORDS_PATTERN = re.compile(
    r"\b("
    r"build|develop|implement|code|program|software|app|apps|application|applications|"
    r"calculator|calculators|tool|tools|system|systems|api|apis|web|website|websites|webpage|"
    r"ui|ux|gui|frontend|backend|fullstack|service|services|server|servers|database|databases|db|"
    r"component|components|widget|widgets|dashboard|dashboards|cli|script|scripts|module|modules|"
    r"library|libraries|framework|frameworks|tracker|trackers|generator|generators|manager|managers|"
    r"editor|editors|viewer|viewers|player|players|converter|converters|crawler|crawlers|"
    r"scraper|scrapers|bot|bots|game|games|plugin|plugins|extension|extensions|platform|platforms|"
    r"portal|portals|interface|interfaces|endpoint|endpoints|pipeline|pipelines|microservice|microservices|"
    r"docker|react|vue|angular|node|python|fastapi|flask|django|html|css|javascript|typescript|"
    r"sql|sqlite|postgres|mongodb|redis|rest|graphql|crud|auth|authentication|login|signup"
    r")\b",
    re.IGNORECASE
)


def has_software_keyword(prompt: str) -> bool:
    """Checks whether the prompt contains any recognized software engineering keywords."""
    return bool(SOFTWARE_KEYWORDS_PATTERN.search(prompt))


def is_gibberish(prompt: str) -> bool:
    """Detects random non-software gibberish strings."""
    clean = re.sub(r"[^a-zA-Z]", "", prompt)
    if not clean:
        return False
    # Check repeated characters like "aaaaaa"
    if re.search(r"(.)\1{4,}", clean.lower()):
        return True
    # If 6+ chars and no vowels at all
    if len(clean) >= 6 and not re.search(r"[aeiouy]", clean.lower()):
        return True
    # Check high consonant to vowel ratio for long strings
    vowels = len(re.findall(r"[aeiouy]", clean.lower()))
    consonants = len(clean) - vowels
    if len(clean) >= 10 and vowels > 0 and (consonants / vowels) > 6.0:
        return True
    return False


NON_SOFTWARE_PATTERNS = [
    # Greetings / casual conversational
    (
        re.compile(r"^(hello|hi|hey|greetings|howdy|good\s+(morning|afternoon|evening|day)|sup|what\'?s\s+up)\b", re.IGNORECASE),
        "Greeting detected. AutoDev is designed to build software applications. Please describe a software project or feature you want to create."
    ),
    # Factual Q&A / general knowledge / trivia
    (
        re.compile(r"^(what|who|where|when|why|how)\s+(is|was|are|were|do|does|did|can|could|would|should|to|much|many)\b", re.IGNORECASE),
        "General knowledge or factual question detected. AutoDev builds software applications. Please specify a software feature or tool you would like developed."
    ),
    (
        re.compile(r"^(what\'?s|who\'?s|where\'?s|when\'?s)\b", re.IGNORECASE),
        "General knowledge question detected. AutoDev is an automated software engineering platform. Please describe a software application or feature to build."
    ),
    (
        re.compile(r"^(tell\s+me\s+about|explain|describe)\b", re.IGNORECASE),
        "Informational query detected. AutoDev generates software codebases rather than informational articles. Please describe a software tool or application to build."
    ),
    # Pure math / calculation / unit conversion
    (
        re.compile(r"^(calculate|compute|evaluate)\b", re.IGNORECASE),
        "Calculation query detected. AutoDev builds software systems rather than computing one-off mathematical calculations. If you want a calculator application, specify 'build a calculator'."
    ),
    (
        re.compile(r"^convert\s+[\d\.]+\s*[a-zA-Z]+\s+to\s+[a-zA-Z]+", re.IGNORECASE),
        "Unit conversion query detected. AutoDev builds software tools. To build a conversion application, specify 'build a unit converter app'."
    ),
    (
        re.compile(r"^[\d\+\-\*\/\^\(\)\.\s\=\%]+$"),
        "Mathematical expression detected. AutoDev creates software applications. Please describe the software feature you want to develop."
    ),
    # Creative writing / non-software content generation
    (
        re.compile(r"^(write|compose|draft)\s+(a\s+|an\s+)?(poem|story|essay|song|joke|haiku|speech|article|letter|email|rhyme|novel)\b", re.IGNORECASE),
        "Creative writing request detected. AutoDev builds software applications and technical projects. Please describe a software tool or system to develop."
    ),
    (
        re.compile(r"^(tell\s+me\s+a\s+(joke|story|riddle))\b", re.IGNORECASE),
        "Conversational query detected. AutoDev is an engineering platform. Please provide a software feature request."
    ),
    # Opinions / personal chat
    (
        re.compile(r"^(what\s+do\s+you\s+think\s+of|do\s+you\s+like|do\s+you\s+believe|what\s+is\s+your\s+opinion)\b", re.IGNORECASE),
        "Opinion query detected. AutoDev is focused on software design, code generation, and verification. Please submit a software feature specification."
    ),
    (
        re.compile(r"^(how\s+are\s+you|how\s+is\s+it\s+going|are\s+you\s+an\s+ai|who\s+are\s+you)\b", re.IGNORECASE),
        "Conversational query detected. AutoDev builds software applications. Please describe a software project you want to create."
    ),
]


def check_non_software_heuristic(prompt: str) -> None:
    """
    Evaluates whether the prompt is a non-software query (factual Q&A, math,
    greetings, creative writing, opinions, or gibberish).
    If software keywords are present, the non-software heuristic is bypassed.
    Otherwise, raises NonSoftwarePromptError.
    """
    clean = prompt.strip()
    if has_software_keyword(clean):
        return

    # Check gibberish
    if is_gibberish(clean):
        raise NonSoftwarePromptError(
            "Unrecognized or gibberish input detected. Please provide a clear description of a software application or feature to build."
        )

    # Check non-software patterns
    for pattern, msg in NON_SOFTWARE_PATTERNS:
        if pattern.search(clean):
            raise NonSoftwarePromptError(msg)


def validate_prompt(prompt: str) -> bool:
    """
    Deterministic Layer 1 prompt pre-filter.
    Validates non-empty input, guards against prompt injections,
    enforces length and word count (allowing 2-word software prompts),
    and rejects deterministic non-software queries.
    """
    if not prompt or not isinstance(prompt, str):
        raise PromptGuardError("Prompt cannot be empty.")
        
    prompt_clean = prompt.strip()
    if not prompt_clean:
        raise PromptGuardError("Prompt cannot be empty.")
        
    # Basic Prompt Injection heuristics (always enforced)
    lower = prompt_clean.lower()
    injection_patterns = [
        "ignore all previous",
        "ignore previous",
        "bypass",
        "you are now a",
        "system prompt",
        "disregard instructions",
        "forget all",
        "developer mode"
    ]
    
    for pattern in injection_patterns:
        if pattern in lower:
            raise PromptGuardError(f"Security Alert: Blocked potential prompt injection attempt (detected '{pattern}').")

    # Layer 1 deterministic non-software heuristic check
    check_non_software_heuristic(prompt_clean)

    # Length check: allow 2-word software prompts down to 8 chars ("todo app", "chat bot")
    min_len = 8 if (has_software_keyword(prompt_clean) and len(prompt_clean.split()) >= 2) else 10
    if len(prompt_clean) < min_len:
        raise PromptGuardError("Prompt is too short. Please provide at least a 10-character description of what you want to build.")
    
    # Word count check:
    # Allow 2-word software prompts ("distance calculator", "todo app") to pass to Layer 2.
    word_count = len(prompt_clean.split())
    if word_count < 2:
        raise PromptGuardError("Prompt is too vague. Please use at least 2 words to describe your feature.")
    elif word_count == 2 and not has_software_keyword(prompt_clean):
        raise PromptGuardError("Prompt is too vague. Please use at least 3 words to describe your feature.")
        
    return True
