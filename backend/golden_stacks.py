import json

# The "Golden" React + Vite Stack
REACT_VITE_PACKAGE_JSON = {
  "name": "react-vite-app",
  "private": True,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.3",
    "lucide-react": "^0.359.0",
    "react-icons": "^5.0.1",
    "framer-motion": "^11.0.8",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.57.0",
    "eslint-plugin-react": "^7.34.1",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.6",
    "vite": "^5.2.0",
    "vitest": "^1.4.0",
    "jsdom": "^24.0.0",
    "@testing-library/react": "^14.2.2",
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.35",
    "autoprefixer": "^10.4.18"
  }
}

ESLINT_RC_CONTENT = """module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true, jest: true },
  globals: {
    vitest: 'readonly',
    vi: 'readonly',
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly'
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react/jsx-no-target-blank': 'off',
    'react-refresh/only-export-components': 'off',
    'no-unused-vars': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'no-undef': 'error'
  },
}
"""

def enforce_golden_dependencies(codebase):
    has_eslint_config = any(f.file_name.lower() in ['.eslintrc.cjs', '.eslintrc.js', '.eslintrc.json', '.eslintrc', 'eslint.config.js'] for f in codebase.files)
    react_detected = False
    
    # Banned dependencies that cause Vite resolution failures
    BANNED_DEV_DEPS = {'supertest', 'superagent'}
    
    for file in codebase.files:
        if file.file_name.lower() == 'package.json':
            try:
                ai_pkg = json.loads(file.source_code)
                if 'react' in str(ai_pkg.get('dependencies', {})) or 'react' in str(ai_pkg.get('devDependencies', {})):
                    react_detected = True
                    golden = REACT_VITE_PACKAGE_JSON.copy()
                    
                    ai_deps = ai_pkg.get('dependencies', {})
                    golden_deps = golden['dependencies']
                    for k, v in ai_deps.items():
                        if k not in golden_deps and k != "@playwright/test" and k not in BANNED_DEV_DEPS:
                            golden_deps[k] = v 
                            
                    ai_dev_deps = ai_pkg.get('devDependencies', {})
                    golden_dev_deps = golden['devDependencies']
                    for k, v in ai_dev_deps.items():
                        if k not in golden_dev_deps and k != "@playwright/test" and k not in BANNED_DEV_DEPS:
                            golden_dev_deps[k] = v
                            
                    if "@playwright/test" in str(file.source_code):
                        golden_dev_deps["@playwright/test"] = "1.48.0"

                    golden['dependencies'] = golden_deps
                    golden['devDependencies'] = golden_dev_deps
                    
                    file.source_code = json.dumps(golden, indent=2)
            except Exception:
                pass
    
    # Auto-inject `import React from 'react'` into .jsx/.tsx test files if missing
    if react_detected:
        for file in codebase.files:
            fname = file.file_name.lower()
            if (fname.endswith('.test.jsx') or fname.endswith('.test.tsx') or
                fname.endswith('.spec.jsx') or fname.endswith('.spec.tsx')):
                src = file.source_code
                if "import React" not in src and "import * as React" not in src:
                    file.source_code = "import React from 'react';\n" + src
                
    if react_detected and not has_eslint_config:
        # Get the class of the first file object (CodeFile from models.py)
        if codebase.files:
            CodeFileClass = type(codebase.files[0])
            codebase.files.append(CodeFileClass(file_name=".eslintrc.cjs", source_code=ESLINT_RC_CONTENT))
            
    return codebase

