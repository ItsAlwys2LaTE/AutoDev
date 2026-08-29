import sys

with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """                document.getElementById('execLogs').innerText = currentExecutionResult.logs;
                const statusBadge = document.getElementById('execStatus');"""

new_code = """                document.getElementById('execLogsOutput').innerText = currentExecutionResult.logs;
                const statusBadge = document.getElementById('execStatusBadge');"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully.")
else:
    print("Old code block not found.")
