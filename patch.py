import sys

with open('backend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix width
content = content.replace('<div class="max-w-4xl mx-auto space-y-8 pb-20">', '<div class="w-full px-8 mx-auto space-y-8 pb-20">')
content = content.replace('<div class="relative max-w-3xl mx-auto mb-12">', '<div class="relative max-w-5xl mx-auto mb-12">')

# Fix CodeFile field
content = content.replace('.code_content', '.source_code')

# Fix Critics fields
content = content.replace('f.pass ?', 'f.severity_score === 0 ?')
content = content.replace('${f.feedback}', '${f.overall_comments}')

# Fix Design Formatting (change div to textarea)
old_div = 'id="design-text-${cId}" contenteditable="true" class="bg-white text-black p-4 rounded h-64 overflow-y-auto whitespace-pre-wrap text-sm mb-4 shadow-inner border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" spellcheck="false"></div>'
new_textarea = 'id="design-text-${cId}" class="w-full bg-[#1e1e1e] text-slate-300 font-mono p-4 rounded h-64 overflow-y-auto text-sm mb-4 shadow-inner border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" spellcheck="false"></textarea>'
content = content.replace(old_div, new_textarea)

content = content.replace('.innerText = JSON.stringify', '.value = JSON.stringify')
content = content.replace('.innerText = "Agent is designing', '.value = "Agent is designing')
content = content.replace('.innerText)', '.value)')

# Fix Pipeline dependencies to force concurrency
old_deps = """const depsPassed = c.dependencies_on.every(depId => 
                        !componentStates[depId] || componentStates[depId].status === 'passed'
                    );"""
new_deps = "const depsPassed = true;"
content = content.replace(old_deps, new_deps)

with open('backend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
