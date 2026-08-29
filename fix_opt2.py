import sys
with open("backend/orchestrator.py", "r") as f:
    c = f.read()
c = c.replace("from typing import TypedDict, Annotated, List", "from typing import TypedDict, Annotated, List, Optional")
with open("backend/orchestrator.py", "w") as f:
    f.write(c)
