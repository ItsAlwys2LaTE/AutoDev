import os
import sys
import logging
from typing import Any, Callable, Iterator, List, Optional, TypeVar
from google import genai
import google.api_core.exceptions as g_exc

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from retry import with_exponential_backoff, is_transient_error

logger = logging.getLogger("autodev.key_balancer")

T = TypeVar("T")

STAGE_KEY_MAP = {
    "REQUIREMENTS": "GEMINI_API_KEY_REQUIREMENTS",
    "DECOMPOSITION": "GEMINI_API_KEY_ADJUDICATOR",
    "MASTER_ARCHITECT": "GEMINI_API_KEY_ADJUDICATOR",
    "DESIGN": "GEMINI_API_KEY_DESIGN",
    "CODEGEN": "GEMINI_API_KEY_CODEGEN",
    "CRITICS": "GEMINI_API_KEY_CRITICS",
    "CRITIC_CORRECTNESS": "GEMINI_API_KEY_CRITICS",
    "CRITIC_ARCHITECTURE": "GEMINI_API_KEY_ADJUDICATOR",
    "CRITIC_COMPLETENESS": "GEMINI_API_KEY_CRITICS",
    "ADJUDICATOR": "GEMINI_API_KEY_ADJUDICATOR",
    "INTEGRATION": "GEMINI_API_KEY_INTEGRATION",
    "DOCUMENTATION": "GEMINI_API_KEY_REQUIREMENTS",
    "PARSE_REQUIREMENTS": "GEMINI_API_KEY_REQUIREMENTS",
    "PARSE_BLUEPRINT": "GEMINI_API_KEY_DESIGN",
}

RATE_LIMIT_KEYWORDS = (
    "429",
    "resource exhausted",
    "resource_exhausted",
    "rate limit",
    "rate_limit",
    "quota",
    "too many requests",
    "too_many_requests",
)


def is_rate_limit_error(exc: Exception) -> bool:
    """Check whether an exception represents a rate limit / 429 / quota error."""
    if isinstance(exc, (g_exc.ResourceExhausted, g_exc.TooManyRequests)):
        return True

    # Check status codes
    for attr in ("code", "status_code", "http_status", "status"):
        code_val = getattr(exc, attr, None)
        if code_val is not None:
            try:
                if int(code_val) == 429:
                    return True
            except (ValueError, TypeError):
                pass

    resp = getattr(exc, "response", None)
    if resp is not None:
        for attr in ("status_code", "status", "code"):
            code_val = getattr(resp, attr, None)
            if code_val is not None:
                try:
                    if int(code_val) == 429:
                        return True
                except (ValueError, TypeError):
                    pass

    err_msg = str(exc).lower()
    return any(keyword in err_msg for keyword in RATE_LIMIT_KEYWORDS)


def discover_gemini_keys() -> List[str]:
    """
    Discovers all configured Gemini API keys from environment variables using:
    1. Comma-separated GEMINI_API_KEYS
    2. Numbered keys: GEMINI_API_KEY_1 .. GEMINI_API_KEY_10
    3. Stage-specific keys: GEMINI_API_KEY_REQUIREMENTS, GEMINI_API_KEY_DESIGN, etc.
    4. Generic fallback: GEMINI_API_KEY
    """
    keys: List[str] = []
    seen = set()

    def _add_key(k: Optional[str]):
        if k:
            k_clean = k.strip()
            if k_clean and k_clean not in seen and not k_clean.startswith("dummy_"):
                seen.add(k_clean)
                keys.append(k_clean)

    # 1. Comma-separated list
    csv_keys = os.environ.get("GEMINI_API_KEYS")
    if csv_keys:
        for part in csv_keys.replace(";", ",").split(","):
            _add_key(part)

    # 2. Numbered variables
    for i in range(1, 11):
        _add_key(os.environ.get(f"GEMINI_API_KEY_{i}"))

    # 3. Stage variables
    for var_name in STAGE_KEY_MAP.values():
        _add_key(os.environ.get(var_name))

    # 4. Generic fallback
    _add_key(os.environ.get("GEMINI_API_KEY"))

    return keys

get_all_gemini_keys = discover_gemini_keys


def get_gemini_keys_for_stage(stage: Optional[str] = None) -> List[str]:
    """
    Returns an ordered list of available Gemini API keys for a specific pipeline stage.
    The primary/stage-specific key is positioned first, followed by all other
    available primary keys.
    """
    all_keys = discover_gemini_keys()
    if not all_keys:
        # Check if any individual key is set even if dummy
        if stage and stage.upper() in STAGE_KEY_MAP:
            direct_val = os.environ.get(STAGE_KEY_MAP[stage.upper()])
            if direct_val:
                return [direct_val]
        gen_val = os.environ.get("GEMINI_API_KEY")
        if gen_val:
            return [gen_val]
        return []

    if not stage:
        return all_keys

    stage_upper = stage.upper()
    stage_var = STAGE_KEY_MAP.get(stage_upper)
    stage_key = os.environ.get(stage_var) if stage_var else None

    if not stage_key or stage_key.strip() not in all_keys:
        return all_keys

    stage_key_clean = stage_key.strip()
    ordered = [stage_key_clean] + [k for k in all_keys if k != stage_key_clean]
    return ordered


def execute_with_key_fallback(
    stage: str,
    call_fn: Callable[[genai.Client, str], T],
    primary_model: str = "gemini-3.6-flash",
    secondary_model: str = "gemini-3.5-flash-lite",
    custom_keys: Optional[List[str]] = None,
    client_factory: Optional[Callable[[str], Any]] = None,
) -> T:
    """
    Executes an LLM API call with multi-key backoff and hierarchical fallback:
    1. Attempts `primary_model` on the primary key for the stage with exponential backoff (3 retries).
    2. If a rate limit (429) or transient error exhausts retries on that key, rotates to *other available primary keys*
       using `primary_model` (gemini-3.6-flash).
    3. Only after ALL available primary keys have exhausted retries for `primary_model`, degrades to `secondary_model`
       (gemini-3.5-flash-lite).
    """
    keys = custom_keys if custom_keys is not None else get_gemini_keys_for_stage(stage)
    if not keys:
        raise ValueError(f"No Gemini API keys configured for stage '{stage}'.")

    make_client = client_factory if client_factory is not None else (lambda k: genai.Client(api_key=k))

    last_error: Optional[Exception] = None

    # --- Phase 1: Try all available primary keys with primary model (gemini-3.6-flash) ---
    for idx, key in enumerate(keys):
        print(f"[Key Balancer] [{stage}] Trying primary key {idx + 1}/{len(keys)} with model '{primary_model}'...")
        client = make_client(key)

        @with_exponential_backoff(max_retries=3)
        def _attempt_primary():
            return call_fn(client, primary_model)

        try:
            return _attempt_primary()
        except Exception as e:
            last_error = e
            print(f"[Key Balancer] [{stage}] Key {idx + 1}/{len(keys)} failed on '{primary_model}' after backoff: {e}")
            if idx + 1 < len(keys):
                print(f"[Key Balancer] [{stage}] Rotating to next primary key ({idx + 2}/{len(keys)}) on '{primary_model}' before model degradation...")
            else:
                print(f"[Key Balancer] [{stage}] All {len(keys)} primary keys exhausted for model '{primary_model}'.")

    # --- Phase 2: Degrade to secondary model (gemini-3.5-flash-lite) ---
    print(f"[Key Balancer] [{stage}] Falling back / degrading to secondary model '{secondary_model}' across available keys...")
    for idx, key in enumerate(keys):
        client = make_client(key)

        @with_exponential_backoff(max_retries=3)
        def _attempt_secondary():
            return call_fn(client, secondary_model)

        try:
            return _attempt_secondary()
        except Exception as fallback_e:
            last_error = fallback_e
            print(f"[Key Balancer] [{stage}] Key {idx + 1}/{len(keys)} failed on secondary model '{secondary_model}': {fallback_e}")

    if last_error:
        raise last_error
    raise RuntimeError(f"All keys and models failed for stage '{stage}'.")


def execute_stream_with_key_fallback(
    stage: str,
    stream_fn: Callable[[genai.Client, str], Any],
    primary_model: str = "gemini-3.6-flash",
    secondary_model: str = "gemini-3.5-flash-lite",
    custom_keys: Optional[List[str]] = None,
    client_factory: Optional[Callable[[str], Any]] = None,
) -> Iterator[str]:
    """
    Executes a streaming LLM API call with multi-key rotation and model fallback:
    1. Tries primary keys with `primary_model` with exponential backoff.
    2. If rate limit (429) exhausts retries on a key, rotates to next primary key with `primary_model`.
    3. If all primary keys fail on `primary_model`, degrades to `secondary_model`.
    Yields text chunks and usage metadata string.
    """
    keys = custom_keys if custom_keys is not None else get_gemini_keys_for_stage(stage)
    if not keys:
        yield f'{{"error": "No Gemini API keys configured for stage \'{stage}\'."}}'
        return

    make_client = client_factory if client_factory is not None else (lambda k: genai.Client(api_key=k))
    last_error: Optional[Exception] = None

    # --- Phase 1: Try all available primary keys on primary model (gemini-3.6-flash) ---
    for idx, key in enumerate(keys):
        client = make_client(key)

        @with_exponential_backoff(max_retries=3)
        def _get_stream_call(m_name: str):
            return stream_fn(client, m_name)

        try:
            response = _get_stream_call(primary_model)
            iterator = iter(response)
            first_chunk = next(iterator)
            if getattr(first_chunk, "text", None):
                yield first_chunk.text

            last_usage = getattr(first_chunk, "usage_metadata", None)

            for chunk in iterator:
                if getattr(chunk, "text", None):
                    yield chunk.text
                if getattr(chunk, "usage_metadata", None):
                    last_usage = chunk.usage_metadata

            if last_usage:
                prompt_tokens = getattr(last_usage, "prompt_token_count", 0)
                cand_tokens = getattr(last_usage, "candidates_token_count", 0)
                yield f"\n__USAGE__{prompt_tokens},{cand_tokens}"
            return
        except Exception as e:
            last_error = e
            print(f"[Key Balancer Stream] [{stage}] Key {idx + 1}/{len(keys)} failed on '{primary_model}': {e}")
            if idx + 1 < len(keys):
                print(f"[Key Balancer Stream] [{stage}] Rotating to next primary key ({idx + 2}/{len(keys)}) on '{primary_model}'...")
            else:
                print(f"[Key Balancer Stream] [{stage}] All primary keys exhausted for model '{primary_model}'.")

    # --- Phase 2: Fallback to secondary model (gemini-3.5-flash-lite) ---
    print(f"[Key Balancer Stream] [{stage}] Degrading to secondary model '{secondary_model}'...")
    for idx, key in enumerate(keys):
        client = make_client(key)

        @with_exponential_backoff(max_retries=3)
        def _get_fallback_stream(m_name: str):
            return stream_fn(client, m_name)

        try:
            response = _get_fallback_stream(secondary_model)
            last_usage = None
            for chunk in response:
                if getattr(chunk, "text", None):
                    yield chunk.text
                if getattr(chunk, "usage_metadata", None):
                    last_usage = chunk.usage_metadata
            if last_usage:
                prompt_tokens = getattr(last_usage, "prompt_token_count", 0)
                cand_tokens = getattr(last_usage, "candidates_token_count", 0)
                yield f"\n__USAGE__{prompt_tokens},{cand_tokens}"
            return
        except Exception as fallback_e:
            last_error = fallback_e
            print(f"[Key Balancer Stream] [{stage}] Key {idx + 1}/{len(keys)} failed on '{secondary_model}': {fallback_e}")

    yield f'{{"error": "Both primary and fallback models failed across all available keys for {stage}. Last error: {last_error}"}}'
