import asyncio
import collections.abc
import functools
import inspect
import logging
import os
import random
import ssl
import sys
import time
import urllib.error
from typing import Any, Callable, Optional, Tuple, Type, Union

logger = logging.getLogger("autodev.retry")

# Collect Google API Core exceptions if available
TRANSIENT_EXCEPTIONS: list = []

try:
    import google.api_core.exceptions as g_exc
    TRANSIENT_EXCEPTIONS.extend([
        g_exc.ServiceUnavailable,       # 503
        g_exc.ResourceExhausted,        # 429
        g_exc.TooManyRequests,          # 429
        g_exc.InternalServerError,      # 500
        g_exc.DeadlineExceeded,         # 504
        g_exc.BadGateway,               # 502
        g_exc.GatewayTimeout,           # 504
        g_exc.Aborted,                  # 409
    ])
except ImportError:
    pass

try:
    from google.genai import errors as genai_errors
    TRANSIENT_EXCEPTIONS.append(genai_errors.ServerError)
except ImportError:
    genai_errors = None

try:
    import httpx
    TRANSIENT_EXCEPTIONS.extend([
        httpx.TimeoutException,
        httpx.NetworkError,
        httpx.ConnectError,
        httpx.ReadTimeout,
        httpx.WriteTimeout,
        httpx.PoolTimeout,
        httpx.RemoteProtocolError,
    ])
except ImportError:
    pass

try:
    import requests.exceptions as req_exc
    TRANSIENT_EXCEPTIONS.extend([
        req_exc.Timeout,
        req_exc.ConnectionError,
        req_exc.ChunkedEncodingError,
    ])
except ImportError:
    pass

# Standard networking transient exceptions
import http.client
import socket

TRANSIENT_EXCEPTIONS.extend([
    ConnectionError,
    ConnectionResetError,
    ConnectionRefusedError,
    ConnectionAbortedError,
    BrokenPipeError,
    TimeoutError,
    socket.timeout,
    socket.gaierror,
    ssl.SSLError,
    urllib.error.URLError,
    http.client.RemoteDisconnected,
    http.client.IncompleteRead,
    http.client.ResponseNotReady,
    http.client.HTTPException,
])

DEFAULT_RETRYABLE_EXCEPTIONS: Tuple[Type[Exception], ...] = tuple(TRANSIENT_EXCEPTIONS)

PERMANENT_ERROR_KEYWORDS = (
    "invalid_api_key",
    "invalid api key",
    "unauthorized",
    "api_key_invalid",
    "permission_denied",
    "permission denied",
    "not_found",
    "invalid_argument",
    "invalid argument",
    "schema_violation",
    "context_length_exceeded",
    "authentication_error",
    "bad request",
    "bad_request",
    "400 bad request",
    "401 unauthorized",
    "403 forbidden",
    "404 not found",
    "422 unprocessable",
)

TRANSIENT_ERROR_KEYWORDS = (
    "503",
    "429",
    "500",
    "502",
    "504",
    "service unavailable",
    "service_unavailable",
    "resource exhausted",
    "resource_exhausted",
    "rate limit",
    "rate_limit",
    "quota",
    "overloaded",
    "deadline exceeded",
    "deadline_exceeded",
    "timed out",
    "timeout",
    "temporarily unavailable",
    "try again",
    "connection reset",
    "connection refused",
    "remote disconnected",
    "server error",
    "internal error",
    "server is temporarily unavailable",
)


def is_transient_error(
    exc: Exception,
    retryable_exceptions: Optional[Tuple[Type[Exception], ...]] = None,
) -> bool:
    """
    Determines whether an exception is a transient API/network error suitable for retry.
    """
    if retryable_exceptions and isinstance(exc, retryable_exceptions):
        return True

    if isinstance(exc, DEFAULT_RETRYABLE_EXCEPTIONS):
        return True

    # Check google.genai ServerError / APIError with transient status codes
    if genai_errors:
        if isinstance(exc, genai_errors.ServerError):
            return True
        if isinstance(exc, genai_errors.APIError):
            code = getattr(exc, "code", None)
            if code in (429, 500, 502, 503, 504):
                return True
            if code in (400, 401, 403, 404, 422):
                return False

    # Check status code attributes if present on the exception or response object
    status_codes = []
    for attr in ("code", "status_code", "http_status", "status"):
        code_val = getattr(exc, attr, None)
        if code_val is not None:
            status_codes.append(code_val)

    resp = getattr(exc, "response", None)
    if resp is not None:
        for attr in ("status_code", "status", "code"):
            code_val = getattr(resp, attr, None)
            if code_val is not None:
                status_codes.append(code_val)

    for code_val in status_codes:
        try:
            code_int = int(code_val)
            if code_int in (429, 500, 502, 503, 504):
                return True
            if code_int in (400, 401, 403, 404, 422):
                return False
        except (ValueError, TypeError):
            pass

    err_msg = str(exc).lower()

    # Check for explicit permanent errors first
    if any(keyword in err_msg for keyword in PERMANENT_ERROR_KEYWORDS):
        return False

    # Check for transient error keywords in message
    if any(keyword in err_msg for keyword in TRANSIENT_ERROR_KEYWORDS):
        return True

    return False


def _is_stream_iterator(val: Any) -> bool:
    if inspect.isgenerator(val):
        return True
    try:
        import unittest.mock as mock
        if isinstance(val, (mock.NonCallableMock, mock.Mock)):
            return False
    except ImportError:
        pass
    return isinstance(val, collections.abc.Iterator)


def _is_async_stream_iterator(val: Any) -> bool:
    if inspect.isasyncgen(val):
        return True
    try:
        import unittest.mock as mock
        if isinstance(val, (mock.NonCallableMock, mock.Mock)):
            return False
    except ImportError:
        pass
    return isinstance(val, collections.abc.AsyncIterator)


def with_exponential_backoff(
    fn: Optional[Callable] = None,
    *,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    jitter: bool = False,
    max_delay: float = 60.0,
    retryable_exceptions: Optional[Tuple[Type[Exception], ...]] = None,
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
) -> Any:
    """
    Reusable Python decorator that catches transient API errors (e.g. 503s, 429s)
    and retries the decorated function up to `max_retries` times with exponentially
    increasing delays (e.g. 1s, 2s, 4s).

    Supports synchronous functions, sync generator functions, stream iterators,
    async coroutines, and async generator streams.
    
    Can be used as:
        @with_exponential_backoff
        def my_call(): ...
        
    or with parameters:
        @with_exponential_backoff(max_retries=3, initial_delay=1.0)
        def my_call(): ...
    """
    def decorator(func: Callable) -> Callable:
        if inspect.isasyncgenfunction(func):
            @functools.wraps(func)
            async def async_gen_wrapper(*args: Any, **kwargs: Any) -> Any:
                attempt = 0
                has_yielded = False
                gen = None
                while True:
                    try:
                        if gen is None:
                            gen = func(*args, **kwargs)
                        async for item in gen:
                            has_yielded = True
                            yield item
                        return
                    except Exception as e:
                        if has_yielded or not is_transient_error(e, retryable_exceptions) or attempt >= max_retries:
                            if attempt >= max_retries and not has_yielded:
                                print(
                                    f"[Backoff Exhausted] {func.__name__} failed after {attempt} retries ({attempt + 1} attempts). Bubbling up error: {e}"
                                )
                            raise

                        delay = initial_delay * (backoff_factor ** attempt)
                        if jitter:
                            delay += random.uniform(0.0, 0.5)
                        delay = min(delay, max_delay)

                        attempt += 1
                        if on_retry:
                            try:
                                on_retry(e, attempt, delay)
                            except Exception:
                                pass

                        print(
                            f"[Retry {attempt}/{max_retries}] Transient error in {func.__name__}: {e}. Retrying in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)
                        gen = None

            return async_gen_wrapper

        if inspect.isgeneratorfunction(func):
            @functools.wraps(func)
            def gen_wrapper(*args: Any, **kwargs: Any) -> Any:
                attempt = 0
                has_yielded = False
                gen = None
                while True:
                    try:
                        if gen is None:
                            gen = func(*args, **kwargs)
                        for item in gen:
                            has_yielded = True
                            yield item
                        return
                    except Exception as e:
                        if has_yielded or not is_transient_error(e, retryable_exceptions) or attempt >= max_retries:
                            if attempt >= max_retries and not has_yielded:
                                print(
                                    f"[Backoff Exhausted] {func.__name__} failed after {attempt} retries ({attempt + 1} attempts). Bubbling up error: {e}"
                                )
                            raise

                        delay = initial_delay * (backoff_factor ** attempt)
                        if jitter:
                            delay += random.uniform(0.0, 0.5)
                        delay = min(delay, max_delay)

                        attempt += 1
                        if on_retry:
                            try:
                                on_retry(e, attempt, delay)
                            except Exception:
                                pass

                        print(
                            f"[Retry {attempt}/{max_retries}] Transient error in {func.__name__}: {e}. Retrying in {delay:.1f}s..."
                        )
                        time.sleep(delay)
                        gen = None

            return gen_wrapper

        def _wrap_async_iterator(args: Any, kwargs: Any, initial_gen: Any, initial_attempt: int) -> Any:
            async def _async_iter_inner():
                gen = initial_gen
                attempt = initial_attempt
                has_yielded = False
                while True:
                    try:
                        if gen is None:
                            gen = await func(*args, **kwargs)
                        async for item in gen:
                            has_yielded = True
                            yield item
                        return
                    except Exception as e:
                        if has_yielded or not is_transient_error(e, retryable_exceptions) or attempt >= max_retries:
                            if attempt >= max_retries and not has_yielded:
                                print(
                                    f"[Backoff Exhausted] {func.__name__} failed after {attempt} retries ({attempt + 1} attempts). Bubbling up error: {e}"
                                )
                            raise

                        delay = initial_delay * (backoff_factor ** attempt)
                        if jitter:
                            delay += random.uniform(0.0, 0.5)
                        delay = min(delay, max_delay)

                        attempt += 1
                        if on_retry:
                            try:
                                on_retry(e, attempt, delay)
                            except Exception:
                                pass

                        print(
                            f"[Retry {attempt}/{max_retries}] Transient error in {func.__name__}: {e}. Retrying in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)
                        gen = None

            return _async_iter_inner()

        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                attempt = 0
                while True:
                    try:
                        result = await func(*args, **kwargs)
                        if _is_async_stream_iterator(result):
                            return _wrap_async_iterator(args, kwargs, result, attempt)
                        return result
                    except Exception as e:
                        if not is_transient_error(e, retryable_exceptions):
                            raise
                        if attempt >= max_retries:
                            print(
                                f"[Backoff Exhausted] {func.__name__} failed after {attempt} retries ({attempt + 1} attempts). Bubbling up error: {e}"
                            )
                            raise

                        delay = initial_delay * (backoff_factor ** attempt)
                        if jitter:
                            delay += random.uniform(0.0, 0.5)
                        delay = min(delay, max_delay)

                        attempt += 1
                        if on_retry:
                            try:
                                on_retry(e, attempt, delay)
                            except Exception:
                                pass

                        print(
                            f"[Retry {attempt}/{max_retries}] Transient error in {func.__name__}: {e}. Retrying in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)

            return async_wrapper

        def _wrap_generator(args: Any, kwargs: Any, initial_gen: Any, initial_attempt: int) -> Any:
            gen = initial_gen
            attempt = initial_attempt
            has_yielded = False
            while True:
                try:
                    if gen is None:
                        gen = func(*args, **kwargs)
                    for item in gen:
                        has_yielded = True
                        yield item
                    return
                except Exception as e:
                    if has_yielded or not is_transient_error(e, retryable_exceptions) or attempt >= max_retries:
                        if attempt >= max_retries and not has_yielded:
                            print(
                                f"[Backoff Exhausted] {func.__name__} failed after {attempt} retries ({attempt + 1} attempts). Bubbling up error: {e}"
                            )
                        raise

                    delay = initial_delay * (backoff_factor ** attempt)
                    if jitter:
                        delay += random.uniform(0.0, 0.5)
                    delay = min(delay, max_delay)

                    attempt += 1
                    if on_retry:
                        try:
                            on_retry(e, attempt, delay)
                        except Exception:
                            pass

                    print(
                        f"[Retry {attempt}/{max_retries}] Transient error in {func.__name__}: {e}. Retrying in {delay:.1f}s..."
                    )
                    time.sleep(delay)
                    gen = None

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            attempt = 0
            while True:
                try:
                    result = func(*args, **kwargs)
                    if _is_stream_iterator(result):
                        return _wrap_generator(args, kwargs, result, attempt)
                    return result
                except Exception as e:
                    if not is_transient_error(e, retryable_exceptions):
                        raise
                    if attempt >= max_retries:
                        print(
                            f"[Backoff Exhausted] {func.__name__} failed after {attempt} retries ({attempt + 1} attempts). Bubbling up error: {e}"
                        )
                        raise

                    delay = initial_delay * (backoff_factor ** attempt)
                    if jitter:
                        delay += random.uniform(0.0, 0.5)
                    delay = min(delay, max_delay)

                    attempt += 1
                    if on_retry:
                        try:
                            on_retry(e, attempt, delay)
                        except Exception:
                            pass

                    print(
                        f"[Retry {attempt}/{max_retries}] Transient error in {func.__name__}: {e}. Retrying in {delay:.1f}s..."
                    )
                    time.sleep(delay)

        return wrapper

    if fn is not None:
        return decorator(fn)
    return decorator
