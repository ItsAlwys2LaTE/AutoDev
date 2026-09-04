import sys
import queue
import asyncio
import threading
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

log_listeners = []
_log_lock = threading.RLock()
_is_logging = threading.local()

class LogInterceptor:
    def __init__(self, original_stream):
        self.original_stream = original_stream

    def write(self, message):
        self.original_stream.write(message)
        if getattr(_is_logging, 'active', False):
            return
        _is_logging.active = True
        try:
            msg = message.strip()
            if msg:
                with _log_lock:
                    listeners = list(log_listeners)
                for q in listeners:
                    try:
                        q.put_nowait(msg)
                    except Exception:
                        pass
        finally:
            _is_logging.active = False

    def flush(self):
        self.original_stream.flush()

# Redirect stdout and stderr
sys.stdout = LogInterceptor(sys.stdout)
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
