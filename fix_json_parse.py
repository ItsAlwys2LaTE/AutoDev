import sys

with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """            const data = JSON.parse(fullJsonStr);
            if (data.error) throw new Error(data.error);
            return data;"""

new_code = """            let sanitized = "";
            let inString = false;
            let escapeNext = false;
            for (let i = 0; i < fullJsonStr.length; i++) {
                const c = fullJsonStr[i];
                if (!inString) {
                    if (c === '"') inString = true;
                    sanitized += c;
                } else {
                    if (escapeNext) {
                        sanitized += c;
                        escapeNext = false;
                    } else if (c === '\\\\') {
                        sanitized += c;
                        escapeNext = true;
                    } else if (c === '"') {
                        inString = false;
                        sanitized += c;
                    } else if (c === '\\n') {
                        sanitized += '\\\\n';
                    } else if (c === '\\r') {
                        sanitized += '\\\\r';
                    } else if (c === '\\t') {
                        sanitized += '\\\\t';
                    } else if (c.charCodeAt(0) < 32) {
                        sanitized += ""; // strip other unescaped control chars
                    } else {
                        sanitized += c;
                    }
                }
            }
            
            let data;
            try {
                data = JSON.parse(sanitized);
            } catch (e) {
                console.error("JSON Parse Error on sanitized string:", e, "\\nSanitized:", sanitized);
                throw e;
            }
            
            if (data.error) throw new Error(data.error);
            return data;"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(r'c:\Users\Anupam Sharma\Documents\AutoDev\AutoDev-main\backend\index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Old code not found")
