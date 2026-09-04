import os
import sys
import time
import logging
import threading
import inspect
import contextvars
from enum import Enum
from contextlib import contextmanager
from typing import Any, Callable, Dict, Iterator, List, Optional, Set, Tuple, TypeVar, Union
from dotenv import load_dotenv
from google import genai
import google.api_core.exceptions as g_exc

# Thread-safe and async-safe context variable tracking active generation mode ('QUICK' or 'COMPLEX')
# Defaults to None internally, but get_generation_mode() defaults to "QUICK"
_CURRENT_MODE: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("autodev_generation_mode", default=None)


def set_generation_mode(mode: str) -> None:
    """Sets the active generation mode: 'QUICK' or 'COMPLEX'."""
    if not mode or mode.upper() != "COMPLEX":
        _CURRENT_MODE.set("QUICK")
    else:
        _CURRENT_MODE.set("COMPLEX")


def get_generation_mode() -> str:
    """Gets the active generation mode: 'QUICK' or 'COMPLEX' (defaults to 'QUICK')."""
    val = _CURRENT_MODE.get()
    return val if val is not None else "QUICK"


def reset_generation_mode() -> None:
    """Resets the active generation mode to default (None)."""
    _CURRENT_MODE.set(None)


def resolve_models_for_mode(
    mode: Optional[str] = None,
    primary_model: str = "gemini-3.6-flash",
    secondary_model: str = "gemini-3.5-flash-lite",
) -> Tuple[str, str]:
    """
    Returns (effective_primary, effective_secondary) based on generation mode:
    - QUICK: ('gemini-3.5-flash-lite', 'gemini-3.5-flash-lite') -> strictly ONLY flash-lite
    - COMPLEX: ('gemini-3.6-flash', 'gemini-3.5-flash-lite') -> Standard 3.6 prioritized with fallback
    - Invalid or unrecognized mode strings default to QUICK.
    """
    active_mode = (mode or get_generation_mode()).upper()
    if active_mode == "COMPLEX":
        return (primary_model, secondary_model)
    return ("gemini-3.5-flash-lite", "gemini-3.5-flash-lite")



# Automatically load environment variables from backend/.env or root .env
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_env = os.path.join(_current_dir, ".env")
_root_env = os.path.join(os.path.dirname(_current_dir), ".env")
if os.path.exists(_backend_env):
    load_dotenv(dotenv_path=_backend_env, override=False)
elif os.path.exists(_root_env):
    load_dotenv(dotenv_path=_root_env, override=False)
else:
    load_dotenv(override=False)

sys.path.append(_current_dir)
try:
    from retry import with_exponential_backoff, is_transient_error
except ImportError:
    from backend.retry import with_exponential_backoff, is_transient_error

logger = logging.getLogger("autodev.key_balancer")

T = TypeVar("T")

# Stage to Environment Variable Mappings across 7 SDLC stages
STAGE_KEY_MAP: Dict[str, str] = {
    "REQUIREMENTS": "GEMINI_API_KEY_REQUIREMENTS",
    "PARSE_REQUIREMENTS": "GEMINI_API_KEY_REQUIREMENTS",
    "MASTER_ARCHITECT": "GEMINI_API_KEY_MASTER_ARCHITECT",
    "DECOMPOSITION": "GEMINI_API_KEY_MASTER_ARCHITECT",
    "DESIGN": "GEMINI_API_KEY_DESIGN",
    "PARSE_BLUEPRINT": "GEMINI_API_KEY_DESIGN",
    "CODEGEN": "GEMINI_API_KEY_CODEGEN",
    "CRITICS": "GEMINI_API_KEY_CRITICS",
    "CRITIC_CORRECTNESS": "GEMINI_API_KEY_CRITICS",
    "CRITIC_COMPLETENESS": "GEMINI_API_KEY_CRITICS",
    "CRITIC_ARCHITECTURE": "GEMINI_API_KEY_ADJUDICATOR",
    "ADJUDICATOR": "GEMINI_API_KEY_ADJUDICATOR",
    "INTEGRATION": "GEMINI_API_KEY_INTEGRATION",
    "DOCUMENTATION": "GEMINI_API_KEY_DOCUMENTATION",
}

# Numbered stage fallback mappings (1 through 7)
STAGE_NUMBERED_MAP: Dict[str, str] = {
    "REQUIREMENTS": "GEMINI_API_KEY_1",
    "PARSE_REQUIREMENTS": "GEMINI_API_KEY_1",
    "MASTER_ARCHITECT": "GEMINI_API_KEY_2",
    "DECOMPOSITION": "GEMINI_API_KEY_2",
    "DESIGN": "GEMINI_API_KEY_3",
    "PARSE_BLUEPRINT": "GEMINI_API_KEY_3",
    "CODEGEN": "GEMINI_API_KEY_4",
    "CRITICS": "GEMINI_API_KEY_5",
    "CRITIC_CORRECTNESS": "GEMINI_API_KEY_5",
    "CRITIC_COMPLETENESS": "GEMINI_API_KEY_5",
    "CRITIC_ARCHITECTURE": "GEMINI_API_KEY_6",
    "ADJUDICATOR": "GEMINI_API_KEY_6",
    "INTEGRATION": "GEMINI_API_KEY_6",
    "DOCUMENTATION": "GEMINI_API_KEY_7",
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


class KeyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    RATE_LIMITED = "RATE_LIMITED"
    COOLDOWN = "COOLDOWN"
    DISABLED = "DISABLED"


class KeyState:
    """Encapsulates runtime health metrics and cooldown timing for a single API key."""
    def __init__(self, key: str):
        self.key = key
        self.in_flight: int = 0
        self.total_requests: int = 0
        self.total_successes: int = 0
        self.total_failures: int = 0
        self.consecutive_429: int = 0
        self.cooldown_until: float = 0.0
        self.last_used: float = 0.0
        self.last_success: float = 0.0
        self.last_error: Optional[str] = None
        self.disabled: bool = False

    def is_available(self, now: Optional[float] = None) -> bool:
        if self.disabled:
            return False
        t = now if now is not None else time.monotonic()
        return t >= self.cooldown_until

    def get_status(self, now: Optional[float] = None) -> KeyStatus:
        if self.disabled:
            return KeyStatus.DISABLED
        t = now if now is not None else time.monotonic()
        if t < self.cooldown_until:
            return KeyStatus.COOLDOWN
        return KeyStatus.ACTIVE

    def to_dict(self, now: Optional[float] = None) -> Dict[str, Any]:
        t = now if now is not None else time.monotonic()
        masked = self.key[:6] + "..." + self.key[-4:] if len(self.key) > 10 else self.key
        return {
            "key": masked,
            "status": self.get_status(t).value,
            "in_flight": self.in_flight,
            "total_requests": self.total_requests,
            "total_successes": self.total_successes,
            "total_failures": self.total_failures,
            "consecutive_429": self.consecutive_429,
            "cooldown_remaining": max(0.0, self.cooldown_until - t),
            "last_used": self.last_used,
            "last_error": self.last_error,
        }


class KeyHealthTracker:
    """
    Thread-safe tracker for API key health, in-flight leases, and exponential cooldowns.
    Cooldown formula: T_cooldown = min(max_cooldown, base_cooldown * 2^(N-1))
    where N is the number of consecutive 429 errors.
    """
    def __init__(self, base_cooldown: float = 15.0, max_cooldown: float = 300.0):
        self.base_cooldown = base_cooldown
        self.max_cooldown = max_cooldown
        self._lock = threading.RLock()
        self._states: Dict[str, KeyState] = {}
        self._rr_counter: int = 0

    def register_key(self, key: str) -> KeyState:
        with self._lock:
            if key not in self._states:
                self._states[key] = KeyState(key)
            return self._states[key]

    def acquire_lease(self, key: str) -> None:
        with self._lock:
            state = self.register_key(key)
            state.in_flight += 1
            state.total_requests += 1
            state.last_used = time.monotonic()

    def release_lease(self, key: str) -> None:
        with self._lock:
            if key in self._states:
                self._states[key].in_flight = max(0, self._states[key].in_flight - 1)

    def record_success(self, key: str) -> None:
        with self._lock:
            state = self.register_key(key)
            state.in_flight = max(0, state.in_flight - 1)
            state.total_successes += 1
            state.consecutive_429 = 0
            state.cooldown_until = 0.0
            state.last_success = time.monotonic()

    def record_error(self, key: str, exc: Exception) -> None:
        with self._lock:
            state = self.register_key(key)
            state.in_flight = max(0, state.in_flight - 1)
            state.total_failures += 1
            state.last_error = str(exc)
            if is_rate_limit_error(exc):
                state.consecutive_429 += 1
                cooldown_sec = min(
                    self.max_cooldown,
                    self.base_cooldown * (2 ** (state.consecutive_429 - 1))
                )
                state.cooldown_until = time.monotonic() + cooldown_sec
                logger.warning(
                    f"[KeyHealthTracker] Key {key[:6]}... rate limited (429) #{state.consecutive_429}. "
                    f"Cooldown set for {cooldown_sec:.1f}s."
                )

    def is_available(self, key: str, now: Optional[float] = None) -> bool:
        with self._lock:
            if key not in self._states:
                return True
            return self._states[key].is_available(now)

    def get_ordered_keys(
        self,
        candidate_keys: List[str],
        stage_preferred_key: Optional[str] = None,
    ) -> List[str]:
        """
        Sorts candidate keys dynamically:
        1. Available healthy keys first, ordered by Least-Connections / Round-Robin score:
           Score = 1000 * in_flight + total_requests + stage_affinity_bonus
        2. Keys currently cooling down, ordered by cooldown_until (earliest to recover first).
        """
        with self._lock:
            now = time.monotonic()
            for k in candidate_keys:
                self.register_key(k)

            healthy: List[Tuple[float, str]] = []
            cooling_down: List[Tuple[float, str]] = []

            for k in candidate_keys:
                state = self._states[k]
                if state.is_available(now):
                    affinity = -500 if (stage_preferred_key and k == stage_preferred_key) else 0
                    score = (1000 * state.in_flight) + state.total_requests + affinity
                    healthy.append((score, k))
                else:
                    cooling_down.append((state.cooldown_until, k))

            healthy.sort(key=lambda x: x[0])
            cooling_down.sort(key=lambda x: x[0])

            return [k for _, k in healthy] + [k for _, k in cooling_down]

    def get_stats(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            now = time.monotonic()
            return {k: s.to_dict(now) for k, s in self._states.items()}

    def reset(self) -> None:
        with self._lock:
            self._states.clear()
            self._rr_counter = 0
            reset_generation_mode()


# Global singleton instance
_GLOBAL_TRACKER = KeyHealthTracker(base_cooldown=15.0, max_cooldown=300.0)


def get_tracker() -> KeyHealthTracker:
    return _GLOBAL_TRACKER


def set_tracker(tracker: KeyHealthTracker) -> None:
    global _GLOBAL_TRACKER
    _GLOBAL_TRACKER = tracker


@contextmanager
def lease_key(key: str):
    _GLOBAL_TRACKER.acquire_lease(key)
    try:
        yield key
        _GLOBAL_TRACKER.record_success(key)
    except Exception as exc:
        _GLOBAL_TRACKER.record_error(key, exc)
        raise


def discover_gemini_keys() -> List[str]:
    """
    Discovers all configured Gemini API keys from environment variables:
    1. Comma-separated GEMINI_API_KEYS
    2. Numbered keys: GEMINI_API_KEY_1 .. GEMINI_API_KEY_10 (including GEMINI_API_KEY_7)
    3. Stage-specific keys: GEMINI_API_KEY_REQUIREMENTS, GEMINI_API_KEY_MASTER_ARCHITECT,
       GEMINI_API_KEY_DESIGN, GEMINI_API_KEY_CODEGEN, GEMINI_API_KEY_CRITICS,
       GEMINI_API_KEY_ADJUDICATOR, GEMINI_API_KEY_INTEGRATION, GEMINI_API_KEY_DOCUMENTATION, etc.
    4. Generic fallback: GEMINI_API_KEY
    """
    # If no keys in environment yet, attempt to load from .env
    if not any(k.startswith("GEMINI_API_KEY") for k in os.environ) and not os.environ.get("GEMINI_API_KEYS"):
        _env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        if os.path.exists(_env_file):
            load_dotenv(dotenv_path=_env_file, override=False)

    keys: List[str] = []
    seen: Set[str] = set()

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

    # 2. Numbered variables (1..10, including GEMINI_API_KEY_7)
    for i in range(1, 11):
        _add_key(os.environ.get(f"GEMINI_API_KEY_{i}"))

    # 3. Stage variables
    for var_name in list(STAGE_KEY_MAP.values()) + list(STAGE_NUMBERED_MAP.values()):
        _add_key(os.environ.get(var_name))

    # 4. Explicit key 7 variables
    _add_key(os.environ.get("GEMINI_API_KEY_7"))
    _add_key(os.environ.get("GEMINI_API_KEY_DOCUMENTATION"))

    # 5. Generic fallback
    _add_key(os.environ.get("GEMINI_API_KEY"))

    # Register discovered keys in tracker
    for k in keys:
        _GLOBAL_TRACKER.register_key(k)

    return keys


get_all_gemini_keys = discover_gemini_keys


def discover_gemini_lite_keys() -> List[str]:
    """
    Discovers dedicated GEMINI_API_KEY_LITE_* keys from environment variables:
    1. Comma / semicolon separated GEMINI_LITE_API_KEYS
    2. Numbered variables: GEMINI_API_KEY_LITE_1 .. GEMINI_API_KEY_LITE_10
    3. Stage-specific lite variables: GEMINI_API_KEY_LITE_{STAGE}
    4. Generic fallback: GEMINI_API_KEY_LITE
    """
    keys: List[str] = []
    seen: Set[str] = set()

    def _add_key(k: Optional[str]):
        if k:
            k_clean = k.strip()
            if k_clean and k_clean not in seen and not k_clean.startswith("dummy_"):
                seen.add(k_clean)
                keys.append(k_clean)

    # 1. Comma / semicolon separated list
    csv_lite = os.environ.get("GEMINI_LITE_API_KEYS")
    if csv_lite:
        for part in csv_lite.replace(";", ",").split(","):
            _add_key(part)

    # 2. Numbered variables (1..10)
    for i in range(1, 11):
        _add_key(os.environ.get(f"GEMINI_API_KEY_LITE_{i}"))

    # 3. Stage-specific lite variables
    for stage_name in STAGE_KEY_MAP:
        _add_key(os.environ.get(f"GEMINI_API_KEY_LITE_{stage_name}"))

    # 4. Generic fallback
    _add_key(os.environ.get("GEMINI_API_KEY_LITE"))

    for k in keys:
        _GLOBAL_TRACKER.register_key(k)

    return keys


def get_gemini_keys_for_stage(stage: Optional[str] = None, mode: Optional[str] = None) -> List[str]:
    """
    Returns a dynamically load-balanced, health-prioritized list of Gemini API keys for a stage.
    Uses Least-Connections and Round-Robin distribution, with affinity preference given to
    the stage's primary key when available and idle.
    When mode is QUICK, prioritizes dedicated lite keys (GEMINI_API_KEY_LITE_*),
    falling back to all discovered keys if dedicated lite keys are not explicitly set.
    """
    active_mode = mode or _CURRENT_MODE.get()
    if active_mode and active_mode.upper() == "QUICK":
        lite_keys = discover_gemini_lite_keys()
        if lite_keys:
            stage_pref_lite: Optional[str] = None
            if stage:
                stage_upper = stage.upper()
                stage_pref_val = os.environ.get(f"GEMINI_API_KEY_LITE_{stage_upper}")
                if stage_pref_val and stage_pref_val.strip() in lite_keys:
                    stage_pref_lite = stage_pref_val.strip()
            return _GLOBAL_TRACKER.get_ordered_keys(lite_keys, stage_preferred_key=stage_pref_lite)

    all_keys = discover_gemini_keys()
    if not all_keys:
        # Fallback checks if dummy/untracked
        if stage and stage.upper() in STAGE_KEY_MAP:
            direct_val = os.environ.get(STAGE_KEY_MAP[stage.upper()])
            if direct_val:
                return [direct_val]
        if stage and stage.upper() in STAGE_NUMBERED_MAP:
            num_val = os.environ.get(STAGE_NUMBERED_MAP[stage.upper()])
            if num_val:
                return [num_val]
        gen_val = os.environ.get("GEMINI_API_KEY")
        if gen_val:
            return [gen_val]
        return []

    stage_preferred_key: Optional[str] = None
    if stage:
        stage_upper = stage.upper()
        # Check named stage variable first
        stage_var = STAGE_KEY_MAP.get(stage_upper)
        stage_key = os.environ.get(stage_var) if stage_var else None
        if stage_key and stage_key.strip() in all_keys:
            stage_preferred_key = stage_key.strip()
        else:
            # Check numbered stage variable next
            num_var = STAGE_NUMBERED_MAP.get(stage_upper)
            num_key = os.environ.get(num_var) if num_var else None
            if num_key and num_key.strip() in all_keys:
                stage_preferred_key = num_key.strip()

    return _GLOBAL_TRACKER.get_ordered_keys(all_keys, stage_preferred_key=stage_preferred_key)


def get_gemini_keys_for_mode(stage: Optional[str] = None, mode: Optional[str] = None) -> List[str]:
    """Alias/Helper returning dynamically load-balanced keys respecting generation mode."""
    return get_gemini_keys_for_stage(stage=stage, mode=mode)



def _invoke_callable(fn: Callable, client: Any, model: str) -> Any:
    """Safely invokes a callable accepting (client) or (client, model)."""
    accepts_model = True
    sig_inspected = False
    try:
        sig = inspect.signature(fn)
        params = [
            p for p in sig.parameters.values()
            if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
        ]
        if len(params) == 1:
            accepts_model = False
        sig_inspected = True
    except (ValueError, TypeError, Exception):
        pass

    if not sig_inspected:
        try:
            return fn(client, model)
        except TypeError as e:
            if "positional argument" in str(e) or "takes" in str(e):
                return fn(client)
            raise
    elif accepts_model:
        return fn(client, model)
    else:
        return fn(client)


def execute_with_key_fallback(
    stage: Union[str, List[str], None] = None,
    call_fn: Optional[Callable[..., T]] = None,
    primary_model: str = "gemini-3.6-flash",
    secondary_model: str = "gemini-3.5-flash-lite",
    custom_keys: Optional[List[str]] = None,
    client_factory: Optional[Callable[[str], Any]] = None,
    mode: Optional[str] = None,
    **kwargs: Any,
) -> T:
    """
    Executes an LLM API call with multi-key dynamic load balancing and hierarchical fallback:
    1. In QUICK mode: strictly restricts execution to 'gemini-3.5-flash-lite' across all keys.
    2. In COMPLEX mode: attempts 'gemini-3.6-flash' across healthy candidate keys with
       Least-Connections / Round-Robin distribution, falling back to 'gemini-3.5-flash-lite'.
    3. If a key encounters a rate limit (429) or error, updates KeyHealthTracker with exponential cooldown
       and immediately fails over to the next candidate key.
    """
    active_mode = mode or kwargs.get("mode") or _CURRENT_MODE.get()
    if active_mode and active_mode.upper() == "QUICK":
        eff_primary = "gemini-3.5-flash-lite"
        eff_secondary = "gemini-3.5-flash-lite"
    else:
        eff_primary = primary_model
        eff_secondary = secondary_model

    if isinstance(stage, (list, tuple)):
        keys = list(stage)
        stage_name = kwargs.get("stage_name", "CUSTOM")
    else:
        stage_name = str(stage) if stage is not None else "DEFAULT"
        keys = custom_keys if custom_keys is not None else get_gemini_keys_for_stage(stage_name, mode=active_mode)

    fn = call_fn or kwargs.get("func")
    if fn is None:
        raise ValueError("call_fn (or func) must be provided to execute_with_key_fallback.")

    if not keys:
        raise ValueError(f"No Gemini API keys configured for stage '{stage_name}'.")

    def _default_client_factory(k: str) -> Any:
        c = genai.Client(api_key=k)
        try:
            setattr(c, "api_key", k)
        except Exception:
            pass
        return c

    make_client = client_factory if client_factory is not None else _default_client_factory
    last_error: Optional[Exception] = None
    mode_tag = f"[{active_mode.upper()} MODE] " if active_mode else ""

    # --- Phase 1: Try primary model on dynamically balanced keys ---
    for idx, key in enumerate(keys):
        logger.info(f"[Key Balancer] [{stage_name}] {mode_tag}Trying key {idx + 1}/{len(keys)} with model '{eff_primary}' (Model: {eff_primary})...")
        _GLOBAL_TRACKER.acquire_lease(key)
        try:
            client = make_client(key)
            if not hasattr(client, "api_key"):
                try:
                    setattr(client, "api_key", key)
                except Exception:
                    pass

            result = _invoke_callable(fn, client, eff_primary)
            _GLOBAL_TRACKER.record_success(key)
            return result
        except Exception as e:
            _GLOBAL_TRACKER.record_error(key, e)
            last_error = e
            logger.warning(f"[Key Balancer] [{stage_name}] Key {idx + 1}/{len(keys)} failed on '{eff_primary}': {e}")
            if idx + 1 < len(keys):
                logger.info(f"[Key Balancer] [{stage_name}] Rotating to next key ({idx + 2}/{len(keys)}) on '{eff_primary}'...")
            else:
                logger.info(f"[Key Balancer] [{stage_name}] All {len(keys)} keys exhausted for model '{eff_primary}'.")

    # --- Phase 2: Fallback / Degrade to secondary model ---
    logger.info(f"[Key Balancer] [{stage_name}] {mode_tag}Degrading to secondary model '{eff_secondary}' (Model: {eff_secondary}) across keys...")
    fallback_keys = _GLOBAL_TRACKER.get_ordered_keys(keys)
    for idx, key in enumerate(fallback_keys):
        _GLOBAL_TRACKER.acquire_lease(key)
        try:
            client = make_client(key)
            if not hasattr(client, "api_key"):
                try:
                    setattr(client, "api_key", key)
                except Exception:
                    pass

            result = _invoke_callable(fn, client, eff_secondary)
            _GLOBAL_TRACKER.record_success(key)
            return result
        except Exception as fallback_e:
            _GLOBAL_TRACKER.record_error(key, fallback_e)
            last_error = fallback_e
            logger.warning(f"[Key Balancer] [{stage_name}] Key {idx + 1}/{len(fallback_keys)} failed on secondary model '{eff_secondary}': {fallback_e}")

    if last_error:
        raise last_error
    raise RuntimeError(f"All keys and models failed for stage '{stage_name}'.")


def execute_stream_with_key_fallback(
    stage: Union[str, List[str], None] = None,
    stream_fn: Optional[Callable[..., Any]] = None,
    primary_model: str = "gemini-3.6-flash",
    secondary_model: str = "gemini-3.5-flash-lite",
    custom_keys: Optional[List[str]] = None,
    client_factory: Optional[Callable[[str], Any]] = None,
    mode: Optional[str] = None,
    **kwargs: Any,
) -> Iterator[str]:
    """
    Executes a streaming LLM API call with multi-key dynamic rotation and model fallback:
    1. In QUICK mode: strictly restricts execution to 'gemini-3.5-flash-lite' across all keys.
    2. In COMPLEX mode: attempts 'gemini-3.6-flash' across healthy candidate keys with
       Least-Connections / Round-Robin distribution, falling back to 'gemini-3.5-flash-lite'.
    3. If rate limit (429) or connection failure occurs before first chunk, records cooldown and rotates to next key.
    4. If all primary attempts fail, degrades to secondary model.
    Yields text chunks and usage metadata string.
    """
    active_mode = mode or kwargs.get("mode") or _CURRENT_MODE.get()
    if active_mode and active_mode.upper() == "QUICK":
        eff_primary = "gemini-3.5-flash-lite"
        eff_secondary = "gemini-3.5-flash-lite"
    else:
        eff_primary = primary_model
        eff_secondary = secondary_model

    if isinstance(stage, (list, tuple)):
        keys = list(stage)
        stage_name = kwargs.get("stage_name", "CUSTOM")
    else:
        stage_name = str(stage) if stage is not None else "DEFAULT"
        keys = custom_keys if custom_keys is not None else get_gemini_keys_for_stage(stage_name, mode=active_mode)

    fn = stream_fn or kwargs.get("func")
    if fn is None:
        yield '{"error": "stream_fn (or func) must be provided."}'
        return

    if not keys:
        yield f'{{"error": "No Gemini API keys configured for stage \'{stage_name}\'."}}'
        return

    def _default_client_factory(k: str) -> Any:
        c = genai.Client(api_key=k)
        try:
            setattr(c, "api_key", k)
        except Exception:
            pass
        return c

    make_client = client_factory if client_factory is not None else _default_client_factory
    last_error: Optional[Exception] = None
    mode_tag = f"[{active_mode.upper()} MODE] " if active_mode else ""

    # --- Phase 1: Try primary model on dynamically balanced keys ---
    for idx, key in enumerate(keys):
        logger.info(f"[Key Balancer Stream] [{stage_name}] {mode_tag}Trying key {idx + 1}/{len(keys)} with model '{eff_primary}' (Model: {eff_primary})...")
        _GLOBAL_TRACKER.acquire_lease(key)
        stream_started = False
        try:
            client = make_client(key)
            if not hasattr(client, "api_key"):
                try:
                    setattr(client, "api_key", key)
                except Exception:
                    pass

            response = _invoke_callable(fn, client, eff_primary)
            iterator = iter(response)
            try:
                first_chunk = next(iterator)
            except StopIteration:
                _GLOBAL_TRACKER.record_success(key)
                return

            stream_started = True
            _GLOBAL_TRACKER.record_success(key)

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
        except GeneratorExit:
            _GLOBAL_TRACKER.release_lease(key)
            raise
        except Exception as e:
            _GLOBAL_TRACKER.record_error(key, e)
            last_error = e
            if stream_started:
                yield f'{{"error": "Stream interrupted mid-generation on key {key[:6]}...: {e}"}}'
                return
            logger.warning(f"[Key Balancer Stream] [{stage_name}] Key {idx + 1}/{len(keys)} failed on '{eff_primary}': {e}")
            if idx + 1 < len(keys):
                logger.info(f"[Key Balancer Stream] [{stage_name}] Rotating to next key ({idx + 2}/{len(keys)}) on '{eff_primary}'...")
            else:
                logger.info(f"[Key Balancer Stream] [{stage_name}] All primary keys exhausted for model '{eff_primary}'.")

    # --- Phase 2: Fallback / Degrade to secondary model ---
    logger.info(f"[Key Balancer Stream] [{stage_name}] {mode_tag}Degrading to secondary model '{eff_secondary}' (Model: {eff_secondary}) across keys...")
    fallback_keys = _GLOBAL_TRACKER.get_ordered_keys(keys)
    for idx, key in enumerate(fallback_keys):
        _GLOBAL_TRACKER.acquire_lease(key)
        stream_started = False
        try:
            client = make_client(key)
            if not hasattr(client, "api_key"):
                try:
                    setattr(client, "api_key", key)
                except Exception:
                    pass

            response = _invoke_callable(fn, client, eff_secondary)
            iterator = iter(response)
            try:
                first_chunk = next(iterator)
            except StopIteration:
                _GLOBAL_TRACKER.record_success(key)
                return

            stream_started = True
            _GLOBAL_TRACKER.record_success(key)

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
        except GeneratorExit:
            _GLOBAL_TRACKER.release_lease(key)
            raise
        except Exception as fallback_e:
            _GLOBAL_TRACKER.record_error(key, fallback_e)
            last_error = fallback_e
            if stream_started:
                yield f'{{"error": "Stream interrupted mid-generation on secondary model with key {key[:6]}...: {fallback_e}"}}'
                return
            logger.warning(f"[Key Balancer Stream] [{stage_name}] Key {idx + 1}/{len(fallback_keys)} failed on '{eff_secondary}': {fallback_e}")

    yield f'{{"error": "Both primary and fallback models failed across all available keys for {stage_name}. Last error: {last_error}"}}'

