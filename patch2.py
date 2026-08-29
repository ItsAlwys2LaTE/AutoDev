import sys

with open('backend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Automate Code Generation -> Execution
old_code_wait = """                state.status = 'waiting_code';
                document.getElementById(`approve-code-${cId}`).disabled = false;
                document.getElementById(`approve-code-${cId}`).innerText = "Execute Code & Run Critics";
                document.getElementById(`approve-code-${cId}`).className = "w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm";
                renderPipelineTracks();"""

new_code_auto = """                // AUTO-PROCEED TO EXECUTION
                document.getElementById(`approve-code-${cId}`).classList.add('hidden');
                startComponentExecutionAndCritics(component);"""

content = content.replace(old_code_wait, new_code_auto)

# 2. Automate Revision Loop
old_revise_wait = """                    if (state.revisionCount < 3) {
                        state.revisionCount++;
                        aBtn.innerText = "Revise & Regenerate Code (Attempt " + state.revisionCount + "/3)";
                        aBtn.className = "w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center shadow-sm";
                        aBtn.onclick = () => { aBtn.classList.add('hidden'); startComponentCode(component); };
                    } else {
                        aBtn.innerText = "Max Revisions Reached - Fail";
                        aBtn.className = "w-full bg-red-600 text-white font-bold py-3 rounded-lg";
                        aBtn.onclick = () => { state.status = 'failed'; activeComponentCount--; renderPipelineTracks(); processPipeline(); };
                    }"""

new_revise_auto = """                    if (state.revisionCount < 3) {
                        state.revisionCount++;
                        aBtn.innerText = "Auto-Revising (Attempt " + state.revisionCount + "/3)...";
                        aBtn.className = "w-full bg-orange-600/50 text-white font-bold py-3 rounded-lg cursor-not-allowed transition-colors flex items-center justify-center shadow-sm";
                        aBtn.onclick = null;
                        
                        // AUTO-PROCEED TO REVISION
                        setTimeout(() => {
                            aBtn.classList.add('hidden');
                            startComponentCode(component);
                        }, 1000);
                        
                    } else {
                        aBtn.innerText = "Max Revisions Reached - Inspect & Force Approve";
                        aBtn.className = "w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors";
                        aBtn.onclick = () => approveComponent(cId);
                    }"""

content = content.replace(old_revise_wait, new_revise_auto)

with open('backend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
