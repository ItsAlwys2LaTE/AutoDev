import re

with open(r'Project Documentation\build_master_report.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace any backslash escapes that produce control chars:
# \f (form feed 0x0c) -> \\forall
# \v (vertical tab 0x0b)
# Better yet, let's convert LaTeX strings in the Chapter 4 block to clean Unicode math notation:
replacements = [
    (r'\\forall v \\text\{ such that \}', 'for each vertex v such that'),
    (r'\forall v \text{ such that }', 'for each vertex v such that'),
    (r'\\deg\^-\(v\)', 'deg⁻(v)'),
    (r'\deg^-(v)', 'deg⁻(v)'),
    (r'\\leftarrow', '←'),
    (r'\leftarrow', '←'),
    (r'\\in', '∈'),
    (r'\in', '∈'),
    (r'\\mathcal\{O\}', 'O'),
    (r'\mathcal{O}', 'O'),
    (r'\\mathcal\{U\}', 'U'),
    (r'\mathcal{U}', 'U'),
    (r'\\mathcal\{L\}_\{req\}', 'L_req'),
    (r'\mathcal{L}_{req}', 'L_req'),
    (r'\\mathbb\{N\}', 'N'),
    (r'\mathbb{N}', 'N'),
    (r'\\tau_\{epoch\}', 'τ_epoch'),
    (r'\tau_{epoch}', 'τ_epoch'),
    (r'\\tau_\{agent\}', 'τ_agent'),
    (r'\tau_{agent}', 'τ_agent'),
    (r'\\tau_\{current\}', 'τ_current'),
    (r'\tau_{current}', 'τ_current'),
    (r'\\tau', 'τ'),
    (r'\tau', 'τ'),
    (r'\\chi\^2_\{crit\}', 'χ²_crit'),
    (r'\chi^2_{crit}', 'χ²_crit'),
    (r'\\chi\^2', 'χ²'),
    (r'\chi^2', 'χ²'),
    (r'\\lambda', 'λ'),
    (r'\lambda', 'λ'),
    (r'\\prod_\{i=1\}\^4', '∏(i=1 to 4)'),
    (r'\prod_{i=1}^4', '∏(i=1 to 4)'),
    (r'\\sum_\{i=1\}\^k', '∑(i=1 to k)'),
    (r'\sum_{i=1}^k', '∑(i=1 to k)'),
    (r'\\le', '≤'),
    (r'\le', '≤'),
    (r'\\ge', '≥'),
    (r'\ge', '≥'),
    (r'\\to', '→'),
    (r'\to', '→'),
    (r'\\vec\{Q\}', 'Q_vec'),
    (r'\vec{Q}', 'Q_vec'),
    (r'\\langle', '⟨'),
    (r'\langle', '⟨'),
    (r'\\rangle', '⟩'),
    (r'\rangle', '⟩'),
    (r'\\\\text', 'text'),
    (r'\\text', 'text'),
]

for old, new in replacements:
    code = code.replace(old, new)

# Also check for any remaining \f or \v in string literals
code = code.replace('\x0c', 'f').replace('\x0b', 'v')

with open(r'Project Documentation\build_master_report.py', 'w', encoding='utf-8') as f:
    f.write(code)

print('Cleaned math strings in build_master_report.py successfully!')
