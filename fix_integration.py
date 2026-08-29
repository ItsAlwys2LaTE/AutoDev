import sys

with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """                setVisible('pipelineDashboard', false);
                setVisible('monacoSection', true);
                buildFileExplorer();
                if (currentCodebase.files.length > 0) initMonaco(0);
                
                const execRes = await fetch('/api/execute-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codebase: currentCodebase, blueprint: currentBlueprint })
                });
                currentExecutionResult = await execRes.json();
                
                document.getElementById('execLogs').innerText = currentExecutionResult.logs;
                const statusBadge = document.getElementById('execStatus');
                if (currentExecutionResult.success) {
                    statusBadge.innerText = "Passed";
                    statusBadge.className = "px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm rounded-full font-medium border border-emerald-500/20";
                } else {
                    statusBadge.innerText = "Failed";
                    statusBadge.className = "px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded-full font-medium border border-red-500/20";
                }
                setVisible('executionOutputSection', true);"""

new_code = """                setVisible('pipelineDashboard', false);
                setVisible('codeOutputSection', true);
                document.getElementById('codeOutputTitle').innerText = 'Unified Integrated Codebase';
                document.getElementById('codeFilesContainer').classList.add('hidden');
                document.getElementById('ideContainer').classList.remove('hidden');
                
                buildFileExplorer();
                if (currentCodebase.files.length > 0) initMonaco(0);
                
                const execRes = await fetch('/api/execute-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codebase: currentCodebase, blueprint: currentBlueprint })
                });
                currentExecutionResult = await execRes.json();
                
                document.getElementById('execLogs').innerText = currentExecutionResult.logs;
                const statusBadge = document.getElementById('execStatus');
                if (currentExecutionResult.success) {
                    statusBadge.innerText = "Passed";
                    statusBadge.className = "px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm rounded-full font-medium border border-emerald-500/20";
                } else {
                    statusBadge.innerText = "Failed";
                    statusBadge.className = "px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded-full font-medium border border-red-500/20";
                }
                setVisible('execOutputSection', true);"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully.")
else:
    print("Old code block not found.")
