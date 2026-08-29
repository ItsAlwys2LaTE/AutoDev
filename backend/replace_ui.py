import sys

with open('backend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Make the tracks container grid-cols-2
content = content.replace(
    '''<div id="pipelineTracks" class="space-y-6"></div>''',
    '''<div id="pipelineTracks" class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start"></div>'''
)
content = content.replace(
    '''<div id="pipelineTracks" class="space-y-6 max-h-[80vh] overflow-y-auto pr-2"></div>''',
    '''<div id="pipelineTracks" class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-h-[80vh] overflow-y-auto pr-2"></div>'''
)

with open('backend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
