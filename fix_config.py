import sys

filepath = r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\autodev_pipeline\models.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'lease_duration_sec: float = 30.0',
    'lease_duration_sec: float = 3600.0'
)
content = content.replace(
    'stage_timeout_sec: float = 120.0',
    'stage_timeout_sec: float = 3600.0'
)
content = content.replace(
    'docker_timeout_sec: float = 45.0',
    'docker_timeout_sec: float = 300.0'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Config patched!")
