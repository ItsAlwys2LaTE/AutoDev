import sys
import os
import re
import queue
import asyncio
import threading
import contextvars
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

log_listeners = []
_log_lock = threading.RLock()
_is_logging = threading.local()
_thread_buffers = threading.local()  # Deprecated legacy symbol retained for backward compatibility

# Persistent Rotating File Logger (Non-propagating to prevent circular recursion)
LOG_FILE_PATH = os.environ.get("AUTODEV_LOG_PATH", "autodev.log")
_file_logger = logging.getLogger("autodev.persistent")
_file_logger.propagate = False
_file_logger.setLevel(logging.INFO)

if not _file_logger.handlers:
    _file_handler = RotatingFileHandler(
        filename=LOG_FILE_PATH,
        maxBytes=5 * 1024 * 1024,  # 5 MB per file
        backupCount=5,
        encoding="utf-8"
    )
    _file_handler.setFormatter(logging.Formatter("%(message)s"))
    _file_logger.addHandler(_file_handler)

TIMESTAMP_REGEX = re.compile(r"^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]")

class LogInterceptor:
    _is_log_interceptor = True

    def __init__(self, original_stream):
        if getattr(original_stream, "_is_log_interceptor", False):
            self.original_stream = original_stream.original_stream
        else:
            self.original_stream = original_stream
        self._buffer_var = contextvars.ContextVar(f"log_buffer_{id(self)}", default="")

    def _format_and_route(self, line: str):
        content = line.rstrip("\r\n")
        if not content.strip():
            try:
                self.original_stream.write("\n")
                self.original_stream.flush()
            except Exception:
                pass
            return

        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        formatted = content if TIMESTAMP_REGEX.match(content) else f"[{ts}] {content}"

        # 1. Console Terminal
        try:
            self.original_stream.write(formatted + "\n")
            self.original_stream.flush()
        except UnicodeEncodeError:
            try:
                enc = getattr(self.original_stream, 'encoding', 'utf-8') or 'utf-8'
                self.original_stream.write(formatted.encode(enc, errors='replace').decode(enc) + "\n")
                self.original_stream.flush()
            except Exception:
                pass
        except Exception:
            pass

        # 2. Persistent autodev.log
        try:
            _file_logger.info(formatted)
            for h in _file_logger.handlers:
                try:
                    h.flush()
                except Exception:
                    pass
        except Exception:
            pass

        # 3. Active SSE Queues
        with _log_lock:
            listeners = list(log_listeners)
        for q in listeners:
            try:
                q.put_nowait(formatted)
            except Exception:
                pass

    def write(self, message: str):
        if not message:
            return
        if getattr(_is_logging, 'active', False):
            self.original_stream.write(message)
            return
        _is_logging.active = True
        try:
            buf = self._buffer_var.get() + message
            while '\n' in buf:
                line, buf = buf.split('\n', 1)
                self._format_and_route(line)
            self._buffer_var.set(buf)
        finally:
            _is_logging.active = False

    def flush(self):
        if getattr(_is_logging, 'active', False):
            self.original_stream.flush()
            return
        _is_logging.active = True
        try:
            buf = self._buffer_var.get()
            if buf:
                self._buffer_var.set('')
                self._format_and_route(buf)
            self.original_stream.flush()
        finally:
            _is_logging.active = False

    def isatty(self):
        return getattr(self.original_stream, 'isatty', lambda: False)()

    def __getattr__(self, name):
        return getattr(self.original_stream, name)

# Redirect stdout and stderr safely without recursive wrapping
if not getattr(sys.stdout, "_is_log_interceptor", False) and not isinstance(sys.stdout, LogInterceptor):
    sys.stdout = LogInterceptor(sys.stdout)
if not getattr(sys.stderr, "_is_log_interceptor", False) and not isinstance(sys.stderr, LogInterceptor):
    sys.stderr = LogInterceptor(sys.stderr)

@router.get("/api/logs/stream")
async def stream_logs():
    q = queue.Queue(maxsize=1000)
    with _log_lock:
        log_listeners.append(q)
    
    async def log_generator():
        try:
            while True:
                has_messages = False
                while not q.empty():
                    msg = q.get_nowait()
                    # Escape newlines for SSE
                    msg = msg.replace('\n', '\\n')
                    yield f"data: {msg}\n\n"
                    has_messages = True
                
                # Keepalive comment to prevent connection drop if quiet
                if not has_messages:
                    yield ": keepalive\n\n"
                    
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            pass
        finally:
            with _log_lock:
                if q in log_listeners:
                    log_listeners.remove(q)
            
    return StreamingResponse(log_generator(), media_type="text/event-stream")
