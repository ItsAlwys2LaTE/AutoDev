import sys

with open('backend/pipeline_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """        records.append(ComponentStateRecord(
            component_id=c["component_id"],
            dependencies=c.get("dependencies", [])
        ))"""

new_code = """        records.append(ComponentStateRecord(
            component_id=c.get("component_id", ""),
            name=c.get("component_name", c.get("component_id", "Unnamed")),
            dependencies=c.get("dependencies", []),
            priority_order=c.get("priority_order", 0)
        ))"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('backend/pipeline_api.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Old code not found")
