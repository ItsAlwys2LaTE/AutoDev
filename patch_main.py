import sys

with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\main.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'app = FastAPI(title="Auto-SDLC Pipeline")',
    'app = FastAPI(title="Auto-SDLC Pipeline")\n\nfrom pipeline_api import router as pipeline_router\napp.include_router(pipeline_router)'
)

with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\main.py', 'w', encoding='utf-8') as f:
    f.write(content)
