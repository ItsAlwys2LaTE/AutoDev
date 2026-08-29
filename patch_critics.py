import sys

# 1. Patch main.py
filepath = 'backend/main.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'class ArbitrationInput(BaseModel):\n    requirements: RequirementsDocument\n    blueprint: SystemDesignBlueprint\n    codebase: GeneratedCodeBase\n    execution_result: ExecutionResult',
    'class ArbitrationInput(BaseModel):\n    requirements: RequirementsDocument\n    blueprint: SystemDesignBlueprint\n    codebase: GeneratedCodeBase\n    execution_result: ExecutionResult\n    master_decomposition: Optional[ComponentDecomposition] = None'
)

content = content.replace(
    '        initial_state = {\n            "requirements": payload.requirements,\n            "blueprint": payload.blueprint,\n            "codebase": payload.codebase,\n            "execution_result": payload.execution_result,\n            "feedbacks": [],\n            "revision_count": 0\n        }',
    '        initial_state = {\n            "requirements": payload.requirements,\n            "blueprint": payload.blueprint,\n            "codebase": payload.codebase,\n            "execution_result": payload.execution_result,\n            "feedbacks": [],\n            "revision_count": 0,\n            "master_decomposition": payload.master_decomposition\n        }'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Patch orchestrator.py
filepath = 'backend/orchestrator.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

if "from models import" not in content and "ComponentDecomposition" not in content:
    content = content.replace("from models import ", "from models import ComponentDecomposition, ")
elif "ComponentDecomposition" not in content:
    content = content.replace("RequirementsDocument,", "ComponentDecomposition, RequirementsDocument,")

content = content.replace(
    '    execution_result: ExecutionResult\n    # operator.add',
    '    execution_result: ExecutionResult\n    master_decomposition: ComponentDecomposition\n    # operator.add'
)

content = content.replace(
    'feedback = evaluate_architecture(state["blueprint"], state["codebase"])',
    'feedback = evaluate_architecture(state["blueprint"], state["codebase"], state.get("master_decomposition"))'
)

content = content.replace(
    'feedback = evaluate_completeness(state["requirements"], state["blueprint"], state["codebase"])',
    'feedback = evaluate_completeness(state["requirements"], state["blueprint"], state["codebase"], state.get("master_decomposition"))'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# 3. Patch agents/critics.py
filepath = 'backend/agents/critics.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()
    
if "ComponentDecomposition" not in content:
    content = content.replace("RequirementsDocument, SystemDesignBlueprint", "ComponentDecomposition, RequirementsDocument, SystemDesignBlueprint")

# Architecture Critic
old_arch = 'def evaluate_architecture(blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase) -> CriticFeedback:'
new_arch = 'def evaluate_architecture(blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, master_decomposition: ComponentDecomposition = None) -> CriticFeedback:'
content = content.replace(old_arch, new_arch)

arch_prompt = 'BLUEPRINT:\n    {blueprint.model_dump_json(indent=2)}\n'
new_arch_prompt = 'BLUEPRINT:\n    {blueprint.model_dump_json(indent=2)}\n\n    ' + """MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing files or missing endpoints if they belong to a different component described in the master plan!
    """
content = content.replace(arch_prompt, new_arch_prompt)

# Completeness Critic
old_comp = 'def evaluate_completeness(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase) -> CriticFeedback:'
new_comp = 'def evaluate_completeness(requirements: RequirementsDocument, blueprint: SystemDesignBlueprint, codebase: GeneratedCodeBase, master_decomposition: ComponentDecomposition = None) -> CriticFeedback:'
content = content.replace(old_comp, new_comp)

comp_prompt = 'BLUEPRINT:\n    {blueprint.model_dump_json(indent=2)}\n'
new_comp_prompt = 'BLUEPRINT:\n    {blueprint.model_dump_json(indent=2)}\n\n    ' + """MASTER ARCHITECTURE PLAN:
    {master_decomposition.model_dump_json(indent=2) if master_decomposition else 'None'}
    
    NOTE: The current codebase is only a single component of this master plan. DO NOT flag missing functionality if it logically belongs to a different component described in the master plan!
    """
content = content.replace(comp_prompt, new_comp_prompt)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# 4. Patch index.html
filepath = 'backend/index.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'execution_result: state.executionResult',
    'execution_result: state.executionResult,\n                        master_decomposition: currentDecomposition'
)
# There are two run-critics fetch calls in index.html (one for initial run, one for Retry button)
content = content.replace(
    'execution_result: currentExecutionResult',
    'execution_result: currentExecutionResult,\n                        master_decomposition: currentDecomposition'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patching complete!")
