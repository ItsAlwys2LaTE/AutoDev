import re
from typing import List, Dict

# Regex matching Markdown file delimiters:
# ### FILE: src/App.tsx
# ```typescript
# ...code...
# ```
FILE_DELIMITER_REGEX = re.compile(
    r"(?:^|\n)###\s+FILE:\s*([^\r\n]+)\r?\n```[a-zA-Z0-9_\-\.]*\r?\n(.*?)\r?\n```(?=\s*(?:###\s+FILE:|$))",
    re.DOTALL
)

def safe_re_sub(pattern: str, replacement: str, string: str, flags: int = 0) -> str:
    """
    Replaces pattern occurrences with replacement in string safely.
    Passing a lambda guarantees that backslashes in replacement (e.g., \\d, \\w, \\g<1>,
    or Windows file paths C:\\users\\) are treated strictly as literals, completely
    preventing 're.error: bad escape' crashes.
    """
    return re.sub(pattern, lambda _: replacement, string, flags=flags)

def extract_files_from_markdown(markdown_text: str) -> List[Dict[str, str]]:
    """
    Extracts source code files from markdown delimiter blocks.
    Completely eliminates JSON double-escaping overhead and avoids syntax crashes.
    """
    files = []
    for match in FILE_DELIMITER_REGEX.finditer(markdown_text):
        file_name = match.group(1).strip()
        code = match.group(2)
        files.append({"file_name": file_name, "source_code": code})
    return files
