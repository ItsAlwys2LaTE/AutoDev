import sys

with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# We will just find state.status = 'coding_queued'; inside approveDesign
# and insert the fetch below it.

old = "state.status = 'coding_queued';\n            renderPipelineTracks();\n            processPipeline();"
new = "state.status = 'coding_queued';\n            fetch('/api/pipeline/complete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ component_id: cId, stage: 'DESIGN', verdict: 'pass' }) });\n            renderPipelineTracks();\n            processPipeline();"

if old in content:
    content = content.replace(old, new)
    with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched DESIGN complete.")
else:
    print("Old string not found.")
