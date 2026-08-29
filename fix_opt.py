import sys
with open("backend/orchestrator.py", "r") as f:
    c = f.read()
c = c.replace("master_decomposition: ComponentDecomposition\n", "master_decomposition: Optional[ComponentDecomposition]\n")
with open("backend/orchestrator.py", "w") as f:
    f.write(c)
