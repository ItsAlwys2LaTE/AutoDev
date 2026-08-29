import requests

try:
    res = requests.post("http://127.0.0.1:8000/api/generate-requirements", json={"prompt": "Build a snake game"})
    print("GEN_REQ:", res.status_code)
except Exception as e:
    print(e)
