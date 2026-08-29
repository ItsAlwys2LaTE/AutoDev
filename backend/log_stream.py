import sys
import queue
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

log_listeners = []

class LogInterceptor:
    def __init__(self, original_stream):
        self.original_stream = original_stream

    def write(self, message):
        self.original_stream.write(message)
        msg = message.strip()
        if msg:
            for q in list(log_listeners):
                try:
                    q.put_nowait(msg)
                except Exception:
                    pass

    def flush(self):
        self.original_stream.flush()

# Redirect stdout and stderr
sys.stdout = LogInterceptor(sys.stdout)
sys.stderr = LogInterceptor(sys.stderr)

@router.get("/api/logs/stream")
async def stream_logs():
    q = queue.Queue(maxsize=1000)
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
            if q in log_listeners:
                log_listeners.remove(q)
            
    return StreamingResponse(log_generator(), media_type="text/event-stream")
