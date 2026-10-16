with open(r'Project Documentation\build_master_report.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any \frac or other LaTeX artifacts:
text = text.replace(r'\frac{(O_i - E_i)^2}{E_i}', '[(O_i - E_i)² / E_i]')
text = text.replace(r'\frac', '')
text = text.replace(r'\times', '×')
text = text.replace(r'\Delta', 'Δ')
text = text.replace(r'\_', '_')
text = text.replace(r'\text{s}', 's')
text = text.replace(r'\text{s}^{-1}', 's⁻¹')
text = text.replace(r'\text', '')
text = text.replace(r'\le', '≤')
text = text.replace(r'\ge', '≥')

# Let's verify by compiling the python file
with open(r'Project Documentation\build_master_report.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Replaced LaTeX escape sequences successfully!')
