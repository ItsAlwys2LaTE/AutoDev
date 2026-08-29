import sys

with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace startComponentPipeline
old_start = """        async function startComponentPipeline() {
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
                    activeFileIndex: 0,
                    revisionHistory: [],
                    activeRevisionIndex: -1
                };
            });
            
            renderPipelineTracks();
            processPipeline();
        }"""

new_start = """        let pipelineInterval = null;
        async function startComponentPipeline() {
            pipelineActive = true;
            setVisible('decomposeActions', false);
            setVisible('pipelineDashboard', true);
            updateStepper(2, 'active'); 
            
            pipelineQueue = [...currentDecomposition.components].sort((a, b) => a.priority_order - b.priority_order);
            
            try {
                await fetch('/api/pipeline/init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ components: pipelineQueue })
                });
            } catch(e) { console.error("Init Error", e); }
            
            pipelineQueue.forEach(c => {
                componentStates[c.component_id] = { 
                    status: 'queued', 
                    revisionCount: 0,
                    component: c,
                    activeFileIndex: 0,
                    revisionHistory: [],
                    activeRevisionIndex: -1
                };
            });
            
            renderPipelineTracks();
            pipelineInterval = setInterval(processPipeline, 2000);
            processPipeline();
        }"""
content = content.replace(old_start, new_start)

# 2. Replace processPipeline
old_process = """        async function processPipeline() {
            if (!pipelineActive) return;
            
            if (!pipelineLocks.design) {
                const c = pipelineQueue.find(c => componentStates[c.component_id].status === 'queued');
                if (c) {
                    const depsPassed = true;
                    if (depsPassed) {
                        pipelineLocks.design = true;
                        startComponentDesign(c);
                    }
                }
            }
            
            if (!pipelineLocks.code) {
                const c = pipelineQueue.find(c => componentStates[c.component_id].status === 'coding_queued');
                if (c) {
                    pipelineLocks.code = true;
                    startComponentCode(c);
                }
            }
            
            if (!pipelineLocks.critic) {
                const c = pipelineQueue.find(c => componentStates[c.component_id].status === 'critic_queued');
                if (c) {
                    pipelineLocks.critic = true;
                    startComponentExecutionAndCritics(c);
                }
            }
        }"""

new_process = """        async function processPipeline() {
            if (!pipelineActive) {
                if (pipelineInterval) clearInterval(pipelineInterval);
                return;
            }
            try {
                const res = await fetch('/api/pipeline/tick');
                const data = await res.json();
                if (data.assignments) {
                    data.assignments.forEach(assign => {
                        const state = componentStates[assign.component_id];
                        if (!state) return;
                        
                        if (assign.stage === 'DESIGN' && state.status === 'queued') {
                            startComponentDesign(state.component);
                        } else if (assign.stage === 'CODEGEN' && state.status === 'coding_queued') {
                            startComponentCode(state.component);
                        } else if (assign.stage === 'CRITICS' && state.status === 'critic_queued') {
                            startComponentExecutionAndCritics(state.component);
                        }
                    });
                }
            } catch(e) { console.error("Tick error", e); }
        }"""
content = content.replace(old_process, new_process)

# 3. Replace lock clearing in design (so it doesn't crash)
content = content.replace("pipelineLocks.design = false;", "// pipelineLocks.design = false;")
content = content.replace("pipelineLocks.code = false;", "// pipelineLocks.code = false;")
content = content.replace("pipelineLocks.critic = false;", "// pipelineLocks.critic = false;")

# 4. Inject completion calls
content = content.replace(
    "btn.innerText = \"Approved ?\";\n            state.status = 'coding_queued';",
    "btn.innerText = \"Approved ?\";\n            state.status = 'coding_queued';\n            fetch('/api/pipeline/complete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ component_id: cId, stage: 'DESIGN', verdict: 'pass' }) });"
)

content = content.replace(
    "switchComponentFile(cId, 0, state.revisionHistory.length - 1);\n                \n                state.status = 'critic_queued';",
    "switchComponentFile(cId, 0, state.revisionHistory.length - 1);\n                \n                state.status = 'critic_queued';\n                fetch('/api/pipeline/complete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ component_id: cId, stage: 'CODEGEN', verdict: 'pass' }) });"
)

content = content.replace(
    "state.status = 'passed';\n            \n            const btn = document.getElementById(`approve-component-${cId}`);",
    "state.status = 'passed';\n            fetch('/api/pipeline/complete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ component_id: cId, stage: 'CRITICS', verdict: 'pass' }) });\n            const btn = document.getElementById(`approve-component-${cId}`);"
)

content = content.replace(
    "state.status = 'coding_queued';\n                        // pipelineLocks.critic = false;",
    "state.status = 'coding_queued';\n                        fetch('/api/pipeline/complete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ component_id: cId, stage: 'CRITICS', verdict: 'revise' }) });"
)


with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("index.html patched.")
