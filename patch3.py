import sys

with open('backend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace startComponentDesign formatting
old_design_json = "document.getElementById(`design-text-${cId}`).value = JSON.stringify(blueprint, null, 2);"
new_design_text = """
                let bpText = `ARCHITECTURE OVERVIEW:\\n${blueprint.architecture_overview || 'N/A'}\\n\\nTECH STACK: ${(blueprint.tech_stack || []).join(', ')}\\nDOCKER IMAGE: ${blueprint.docker_image}\\nDEV SERVER COMMAND: ${blueprint.dev_server_command}\\nDEV SERVER PORT: ${blueprint.dev_server_port}\\nRUN TESTS COMMAND: ${blueprint.run_tests_command}\\n\\nFILES TO GENERATE:`;
                if (blueprint.files && Array.isArray(blueprint.files)) {
                    blueprint.files.forEach((f, i) => {
                        bpText += `\\n\\n?? ${i + 1}. ${f.file_name}\\n`;
                        bpText += `   Purpose: ${f.purpose}\\n`;
                        bpText += `   Dependencies: ${(f.dependencies || []).join(', ') || 'None'}\\n`;
                        bpText += `   Pseudocode:\\n${(f.pseudocode || '').split('\\n').map(l => '     ' + l).join('\\n')}`;
                    });
                }
                
                document.getElementById(`design-text-${cId}`).value = bpText;
"""
content = content.replace(old_design_json, new_design_text.strip())

# Replace approveDesign
old_approve = """        function approveDesign(cId) {
            const state = componentStates[cId];
            try {
                const edited = JSON.parse(document.getElementById(`design-text-${cId}`).value);
                state.blueprint = edited;
            } catch(e) {
                alert("Invalid JSON in Design format.");
                return;
            }
            
            document.getElementById(`approve-design-${cId}`).disabled = true;
            document.getElementById(`approve-design-${cId}`).innerText = "Approved ?";
            document.getElementById(`approve-design-${cId}`).className = "w-full bg-slate-700 text-slate-400 font-bold py-3 rounded-lg";
            
            state.status = 'coding_queued';
            renderPipelineTracks();
            processPipeline();
        }"""

new_approve = """        async function approveDesign(cId) {
            const state = componentStates[cId];
            
            const btn = document.getElementById(`approve-design-${cId}`);
            btn.disabled = true;
            btn.innerText = "Parsing Design...";
            btn.className = "w-full bg-slate-700 text-slate-400 font-bold py-3 rounded-lg flex items-center justify-center shadow-sm";
            
            try {
                const text = document.getElementById(`design-text-${cId}`).value;
                const parseRes = await fetch('/api/parse-blueprint', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });
                if (!parseRes.ok) throw new Error("Failed to parse blueprint text.");
                state.blueprint = await parseRes.json();
            } catch(e) {
                alert("Error parsing Design: " + e.message);
                btn.disabled = false;
                btn.innerText = "Approve Design & Generate Code";
                btn.className = "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center shadow-sm";
                return;
            }
            
            btn.innerText = "Approved ?";
            state.status = 'coding_queued';
            renderPipelineTracks();
            processPipeline();
        }"""
content = content.replace(old_approve, new_approve)

with open('backend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
