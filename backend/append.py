
with open('backend/index.html', 'a', encoding='utf-8') as f:
    f.write(r'''        // --- PIPELINE ORCHESTRATOR ---
        let pipelineQueue = [];
        let activeComponentCount = 0;
        const MAX_CONCURRENT = 2;
        
        async function startComponentPipeline() {
            pipelineActive = true;
            setVisible('decomposeActions', false);
            setVisible('pipelineDashboard', true);
            updateStepper(2, 'active'); 
            
            pipelineQueue = [...currentDecomposition.components].sort((a, b) => a.priority_order - b.priority_order);
            
            pipelineQueue.forEach(c => {
                componentStates[c.component_id] = { 
                    status: 'queued', 
                    revisionCount: 0,
                    component: c,
                    activeFileIndex: 0
                };
            });
            
            renderPipelineTracks();
            processPipeline();
        }
        
        function renderPipelineTracks() {
            const container = document.getElementById('pipelineTracks');
            
            pipelineQueue.forEach(c => {
                const cId = c.component_id;
                const state = componentStates[cId];
                
                let workspace = document.getElementById(\workspace-\\);
                if (!workspace) {
                    workspace = document.createElement('div');
                    workspace.id = \workspace-\\;
                    workspace.className = "bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mb-4 shadow-sm";
                    workspace.innerHTML = \
                        <!-- Header -->
                        <div class="bg-slate-700/50 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-700 transition-colors" onclick="document.getElementById('body-\').classList.toggle('hidden')">
                            <div class="flex items-center gap-3">
                                <span class="bg-slate-900 text-slate-300 px-2 py-1 rounded text-xs font-mono border border-slate-600">ID: \</span>
                                <h3 class="font-bold text-cyan-400 text-lg">\</h3>
                            </div>
                            <span id="status-\" class="text-xs font-mono px-3 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-700">Queued</span>
                        </div>
                        
                        <!-- Body -->
                        <div id="body-\" class="hidden p-5 space-y-6 bg-[#0f172a]/50">
                            
                            <!-- Design -->
                            <div id="design-section-\" class="hidden border border-slate-700 rounded-lg p-5 bg-slate-900 shadow-inner">
                                <h4 class="text-indigo-400 font-bold mb-3 flex items-center gap-2">
                                    <span class="bg-indigo-500 text-white w-6 h-6 rounded-full flex justify-center items-center text-xs shadow">1</span>
                                    Design Blueprint
                                </h4>
                                <div id="design-text-\" contenteditable="true" class="bg-white text-black p-4 rounded h-64 overflow-y-auto whitespace-pre-wrap text-sm mb-4 shadow-inner border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" spellcheck="false"></div>
                                <button id="approve-design-\" onclick="approveDesign('\')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                                    Approve Design & Generate Code
                                </button>
                            </div>
                            
                            <!-- Code & Exec -->
                            <div id="code-section-\" class="hidden border border-slate-700 rounded-lg p-5 bg-slate-900 shadow-inner">
                                <h4 class="text-purple-400 font-bold mb-3 flex items-center gap-2">
                                    <span class="bg-purple-500 text-white w-6 h-6 rounded-full flex justify-center items-center text-xs shadow">2</span>
                                    Generated Codebase
                                </h4>
                                <div class="flex h-80 border border-slate-700 rounded overflow-hidden mb-4 shadow-inner">
                                    <div class="w-1/3 bg-slate-950 border-r border-slate-700 p-2 overflow-y-auto" id="file-list-\"></div>
                                    <textarea id="code-text-\" class="w-2/3 bg-[#1e1e1e] text-slate-300 p-4 font-mono text-sm resize-none focus:outline-none" spellcheck="false" oninput="if(componentStates['\'].codebase) { componentStates['\'].codebase.files[componentStates['\'].activeFileIndex].code_content = this.value; }"></textarea>
                                </div>
                                <button id="approve-code-\" onclick="approveCode('\')" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                                    Execute Code & Run Critics
                                </button>
                            </div>
                            
                            <!-- Critics -->
                            <div id="critic-section-\" class="hidden border border-slate-700 rounded-lg p-5 bg-slate-900 shadow-inner">
                                <h4 class="text-rose-400 font-bold mb-3 flex items-center gap-2">
                                    <span class="bg-rose-500 text-white w-6 h-6 rounded-full flex justify-center items-center text-xs shadow">3</span>
                                    Arbitration Feedback
                                </h4>
                                <div class="bg-black/50 border border-slate-700 p-3 rounded mb-4 max-h-32 overflow-y-auto shadow-inner">
                                    <pre id="exec-logs-\" class="text-xs font-mono text-slate-400 whitespace-pre-wrap"></pre>
                                </div>
                                <div id="critic-cards-\" class="space-y-2 mb-4 max-h-48 overflow-y-auto"></div>
                                <div id="verdict-box-\" class="p-4 bg-slate-800 rounded border border-slate-600 mb-4 hidden shadow flex justify-between items-center">
                                    <span class="text-sm uppercase font-bold text-slate-400 tracking-wider">Verdict:</span> 
                                    <span id="verdict-text-\" class="font-black text-lg"></span>
                                </div>
                                <button id="approve-component-\" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors hidden flex items-center justify-center gap-2 shadow-sm"></button>
                            </div>
                        </div>
                    \;
                    container.appendChild(workspace);
                }
                
                const statusBadge = document.getElementById(\status-\\);
                if (state.status === 'designing') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'; statusBadge.innerText = 'Designing...'; }
                if (state.status === 'waiting_design') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'; statusBadge.innerText = 'Action Required'; }
                if (state.status === 'coding') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30'; statusBadge.innerText = 'Coding...'; }
                if (state.status === 'waiting_code') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'; statusBadge.innerText = 'Action Required'; }
                if (state.status === 'executing' || state.status === 'critiquing') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30'; statusBadge.innerText = 'Evaluating...'; }
                if (state.status === 'waiting_critic') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'; statusBadge.innerText = 'Action Required'; }
                if (state.status === 'passed') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'; statusBadge.innerText = 'Passed ?'; }
                if (state.status === 'failed') { statusBadge.className = 'text-xs font-mono px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30'; statusBadge.innerText = 'Failed ?'; }
            });
            
            const passedCount = pipelineQueue.filter(c => componentStates[c.component_id].status === 'passed').length;
            document.getElementById('pipelineProgress').innerText = passedCount + ' / ' + pipelineQueue.length + ' components complete';
            
            if (passedCount === pipelineQueue.length && pipelineQueue.length > 0) {
                setVisible('integrationSection', true);
                updateStepper(3, 'active');
            }
        }
        
        async function processPipeline() {
            if (!pipelineActive) return;
            
            for (const c of pipelineQueue) {
                if (activeComponentCount >= MAX_CONCURRENT) break;
                
                if (componentStates[c.component_id].status === 'queued') {
                    const depsPassed = c.dependencies_on.every(depId => 
                        !componentStates[depId] || componentStates[depId].status === 'passed'
                    );
                    
                    if (depsPassed) {
                        activeComponentCount++;
                        startComponentDesign(c);
                    }
                }
            }
        }

        async function startComponentDesign(component) {
            const cId = component.component_id;
            const state = componentStates[cId];
            
            try {
                state.status = 'designing';
                document.getElementById(\ody-\\).classList.remove('hidden');
                document.getElementById(\design-section-\\).classList.remove('hidden');
                document.getElementById(\design-text-\\).innerText = "Agent is designing blueprint...";
                renderPipelineTracks();
                
                const contextStr = "Tech Stack: " + currentDecomposition.shared_tech_stack.join(', ') + "\nDocker Image: " + currentDecomposition.shared_docker_image + "\nScoped Requirements:\n" + component.scoped_requirements;
                
                const designRes = await fetch('/api/generate-design', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requirements: currentRequirements, component_context: contextStr })
                });
                
                const blueprint = await readJsonStream(designRes);
                state.blueprint = blueprint;
                
                document.getElementById(\design-text-\\).innerText = JSON.stringify(blueprint, null, 2);
                state.status = 'waiting_design';
                renderPipelineTracks();
            } catch(e) {
                alert("Design Error (" + cId + "): " + e.message);
                state.status = 'failed';
                activeComponentCount--;
                renderPipelineTracks();
                processPipeline();
            }
        }

        function approveDesign(cId) {
            const state = componentStates[cId];
            try {
                const edited = JSON.parse(document.getElementById(\design-text-\\).innerText);
                state.blueprint = edited;
            } catch(e) {
                alert("Invalid JSON in Design format.");
                return;
            }
            
            document.getElementById(\pprove-design-\\).disabled = true;
            document.getElementById(\pprove-design-\\).innerText = "Approved ?";
            document.getElementById(\pprove-design-\\).className = "w-full bg-slate-700 text-slate-400 font-bold py-3 rounded-lg";
            
            startComponentCode(state.component);
        }

        async function startComponentCode(component) {
            const cId = component.component_id;
            const state = componentStates[cId];
            
            try {
                state.status = 'coding';
                document.getElementById(\code-section-\\).classList.remove('hidden');
                document.getElementById(\code-text-\\).value = "Agent is writing code...";
                renderPipelineTracks();
                
                const codeRes = await fetch('/api/generate-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requirements: currentRequirements,
                        blueprint: state.blueprint,
                        previous_codebase: state.codebase,
                        revision_plan: state.revisionPlan
                    })
                });
                
                const codebase = await readJsonStream(codeRes);
                state.codebase = codebase;
                state.activeFileIndex = 0;
                
                const listDiv = document.getElementById(\ile-list-\\);
                listDiv.innerHTML = codebase.files.map((f, i) => \
                    <div class="text-sm font-mono text-slate-400 py-1.5 px-2 hover:bg-slate-800 hover:text-white cursor-pointer rounded transition-colors" onclick="componentStates['\'].activeFileIndex = \; document.getElementById('code-text-\').value = componentStates['\'].codebase.files[\].code_content;">\</div>
                \).join('');
                
                if (codebase.files.length > 0) {
                    document.getElementById(\code-text-\\).value = codebase.files[0].code_content;
                }
                
                state.status = 'waiting_code';
                document.getElementById(\pprove-code-\\).disabled = false;
                document.getElementById(\pprove-code-\\).innerText = "Execute Code & Run Critics";
                document.getElementById(\pprove-code-\\).className = "w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm";
                renderPipelineTracks();
            } catch(e) {
                alert("Code Error (" + cId + "): " + e.message);
                state.status = 'failed';
                activeComponentCount--;
                renderPipelineTracks();
                processPipeline();
            }
        }

        function approveCode(cId) {
            const state = componentStates[cId];
            document.getElementById(\pprove-code-\\).disabled = true;
            document.getElementById(\pprove-code-\\).innerText = "Executed ?";
            document.getElementById(\pprove-code-\\).className = "w-full bg-slate-700 text-slate-400 font-bold py-3 rounded-lg";
            
            startComponentExecutionAndCritics(state.component);
        }

        async function startComponentExecutionAndCritics(component) {
            const cId = component.component_id;
            const state = componentStates[cId];
            
            try {
                state.status = 'executing';
                document.getElementById(\critic-section-\\).classList.remove('hidden');
                document.getElementById(\critic-cards-\\).innerHTML = '';
                document.getElementById(\exec-logs-\\).innerText = "Spinning up secure Docker sandbox for tests...";
                document.getElementById(\erdict-box-\\).classList.add('hidden');
                document.getElementById(\pprove-component-\\).classList.add('hidden');
                renderPipelineTracks();
                
                const execRes = await fetch('/api/execute-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codebase: state.codebase, blueprint: state.blueprint })
                });
                
                const exec = await execRes.json();
                state.executionResult = exec;
                document.getElementById(\exec-logs-\\).innerText = exec.logs;
                
                state.status = 'critiquing';
                document.getElementById(\critic-cards-\\).innerHTML = '<div class="text-sm text-slate-400 font-mono">Arbitration Engine analyzing execution results...</div>';
                renderPipelineTracks();
                
                const criticRes = await fetch('/api/run-critics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requirements: currentRequirements,
                        blueprint: state.blueprint,
                        codebase: state.codebase,
                        execution_result: state.executionResult
                    })
                });
                
                const arbitration = await criticRes.json();
                
                const cCards = document.getElementById(\critic-cards-\\);
                cCards.innerHTML = arbitration.feedbacks.map(f => \
                    <div class="bg-slate-950 p-3 rounded border border-slate-700 text-sm shadow-sm">
                        <span class="font-bold uppercase tracking-wider text-xs \">\:</span> <span class="text-slate-300">\</span>
                    </div>
                \).join('');
                
                const vBox = document.getElementById(\erdict-box-\\);
                const vText = document.getElementById(\erdict-text-\\);
                const aBtn = document.getElementById(\pprove-component-\\);
                vBox.classList.remove('hidden');
                aBtn.classList.remove('hidden');
                
                if (arbitration.decision.verdict === 'pass') {
                    vText.innerText = 'PASS';
                    vText.className = 'font-black text-xl text-emerald-400';
                    aBtn.innerText = "Approve Final Component ?";
                    aBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center shadow-sm";
                    aBtn.onclick = () => approveComponent(cId);
                } else {
                    vText.innerText = 'REVISE';
                    vText.className = 'font-black text-xl text-orange-400';
                    state.revisionPlan = arbitration.decision.revision_plan;
                    
                    if (state.revisionCount < 3) {
                        state.revisionCount++;
                        aBtn.innerText = "Revise & Regenerate Code (Attempt " + state.revisionCount + "/3)";
                        aBtn.className = "w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center shadow-sm";
                        aBtn.onclick = () => { aBtn.classList.add('hidden'); startComponentCode(component); };
                    } else {
                        aBtn.innerText = "Max Revisions Reached - Fail";
                        aBtn.className = "w-full bg-red-600 text-white font-bold py-3 rounded-lg";
                        aBtn.onclick = () => { state.status = 'failed'; activeComponentCount--; renderPipelineTracks(); processPipeline(); };
                    }
                }
                
                state.status = 'waiting_critic';
                renderPipelineTracks();
            } catch(e) {
                alert("Critics Error (" + cId + "): " + e.message);
                state.status = 'failed';
                activeComponentCount--;
                renderPipelineTracks();
                processPipeline();
            }
        }

        function approveComponent(cId) {
            const state = componentStates[cId];
            state.status = 'passed';
            
            const btn = document.getElementById(\pprove-component-\\);
            btn.disabled = true;
            btn.innerText = "Completed ?";
            btn.className = "w-full bg-slate-700 text-slate-400 font-bold py-3 rounded-lg";
            
            document.getElementById(\ody-\\).classList.add('hidden');
            
            componentResults.push({
                component_id: cId,
                component_name: state.component.component_name,
                blueprint: state.blueprint,
                codebase: state.codebase,
                execution_result: state.executionResult
            });
            
            activeComponentCount--;
            renderPipelineTracks();
            processPipeline();
        }

        // Helper for reading JSON streams
        async function readJsonStream(response) {
            if (!response.ok) throw new Error(await response.text());
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullJsonStr = "";
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const textChunk = decoder.decode(value, { stream: true });
                const parts = textChunk.split("__USAGE__");
                fullJsonStr += parts[0];
                if (parts.length > 1) {
                    const usageStr = parts[1].trim();
                    if (usageStr) {
                        const [p, c] = usageStr.split(',');
                        updateCost(p, c);
                    }
                }
            }
            
            const data = JSON.parse(fullJsonStr);
            if (data.error) throw new Error(data.error);
            return data;
        }

        // --- INTEGRATION PHASE ---
        async function runIntegration() {
            setButtonLoading('integrateBtn', 'integrateSpinner', true);
            
            try {
                const res = await fetch('/api/integrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requirements: currentRequirements,
                        decomposition: currentDecomposition,
                        component_results: componentResults
                    })
                });
                
                const finalCodebase = await readJsonStream(res);
                currentCodebase = finalCodebase;
                
                currentBlueprint = {
                    architecture_overview: "Unified Integrated Architecture",
                    tech_stack: currentDecomposition.shared_tech_stack,
                    docker_image: currentDecomposition.shared_docker_image,
                    dev_server_command: "NONE", 
                    dev_server_port: 0,
                    run_tests_command: "pytest", 
                    files: currentCodebase.files.map(f => ({ file_name: f.file_name, purpose: "Integrated file", dependencies: [], pseudocode: "" }))
                };
                
                setVisible('pipelineDashboard', false);
                setVisible('monacoSection', true);
                buildFileExplorer();
                if (currentCodebase.files.length > 0) initMonaco(0);
                
                // Final Integration Test Pass
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
                setVisible('executionOutputSection', true);
                
                setVisible('docGenerationSection', true);
                updateStepper(4, 'active');
                
            } catch (err) {
                showError("Integration Error: " + err.message);
            } finally {
                setButtonLoading('integrateBtn', 'integrateSpinner', false);
            }
        }
    </script>
</body>
</html>
'''
)
