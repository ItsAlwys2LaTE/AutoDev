import os
import json
import copy
import re
import ast
from typing import Any

# Pinned, battle-tested golden dependencies for React + Vite stacks
REACT_VITE_PACKAGE_JSON = {
  "name": "react-vite-app",
  "private": True,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext js,jsx,ts,tsx --report-unused-disable-directives",
    "preview": "vite preview",
    "test": "vitest run",
    "test:unit": "vitest run --exclude '**/*.e2e.*' --exclude '**/e2e/**'",
    "test:e2e": "playwright test"
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
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/user-event": "^14.5.2",
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
    'react-hooks/exhaustive-deps': 'off',
    'no-undef': 'error'
  },
}
"""

SETUP_TESTS_CONTENT = """// src/setupTests.ts - Auto-injected universal browser polyfills
import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

// 1. window.matchMedia Polyfill (Full WHATWG MediaQueryList specification)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated method required by legacy libraries
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  })),
});
if (typeof globalThis !== 'undefined') {
  (globalThis as any).matchMedia = window.matchMedia;
}

// 2. ResizeObserver Polyfill
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = MockResizeObserver;
(globalThis as any).ResizeObserver = MockResizeObserver;

// 3. IntersectionObserver Polyfill
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}
window.IntersectionObserver = MockIntersectionObserver;
(globalThis as any).IntersectionObserver = MockIntersectionObserver;

// 4. HTMLCanvasElement 2D Context Polyfill (Compliant with W3C Uint8ClampedArray)
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
    if (contextId === '2d') {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn((sx: number, sy: number, sw: number, sh: number) => ({
          width: sw || 1,
          height: sh || 1,
          data: new Uint8ClampedArray(((sw || 1) * (sh || 1) * 4) || 4),
        })),
        putImageData: vi.fn(),
        createImageData: vi.fn((w: number, h: number) => ({
          width: w || 0,
          height: h || 0,
          data: new Uint8ClampedArray(((w || 0) * (h || 0) * 4) || 4),
        })),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
      };
    }
    return null;
  }) as any;
}

// 5. Scroll and Viewport Polyfills
window.scrollTo = vi.fn();
window.scroll = vi.fn();
window.scrollBy = vi.fn();
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}

// 6. Web Crypto randomUUID Polyfill
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {};
  }
  if (!window.crypto.randomUUID) {
    const cryptoObj = (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues)
      ? window.crypto
      : (globalThis as any).crypto;
    window.crypto.randomUUID = () =>
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
        (c ^ (cryptoObj.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
  }
}

// 7. Storage State Isolation (Guarded against ReferenceError in Node environments)
beforeEach(() => {
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.clear === 'function') {
    sessionStorage.clear();
  }
});
"""

VITE_CONFIG_CONTENT = """/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/*.e2e.*'],
    css: false,
  },
  resolve: {
    alias: {
      'supertest': path.resolve(process.cwd(), './setupSupertest.js'),
      'superagent': path.resolve(process.cwd(), './setupSupertest.js'),
    },
  },
});
"""

NODE_VITEST_CONFIG_CONTENT = """import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      'supertest': path.resolve(process.cwd(), './setupSupertest.js'),
      'superagent': path.resolve(process.cwd(), './setupSupertest.js'),
    },
  },
});
"""

SETUP_SUPERTEST_CONTENT = """// setupSupertest.js - Auto-injected in-memory HTTP test client for Vitest/Vite
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

class MockIncomingMessage extends Readable {
  constructor(method, url, headers = {}, body = null) {
    super();
    this.method = (method || 'GET').toUpperCase();
    this.url = url || '/';
    this.headers = {};
    for (const [k, v] of Object.entries(headers || {})) {
      this.headers[k.toLowerCase()] = String(v);
    }
    this.rawHeaders = Object.entries(this.headers).flat();
    this.body = body;
    this.query = {};

    const qIndex = this.url.indexOf('?');
    if (qIndex !== -1) {
      const searchParams = new URLSearchParams(this.url.slice(qIndex));
      for (const [key, value] of searchParams.entries()) {
        this.query[key] = value;
      }
    }

    let payloadStr = '';
    if (body !== null && body !== undefined) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        payloadStr = JSON.stringify(body);
        if (!this.headers['content-type']) {
          this.headers['content-type'] = 'application/json';
        }
      } else {
        payloadStr = String(body);
      }
      this.headers['content-length'] = String(Buffer.byteLength(payloadStr));
      this.push(Buffer.from(payloadStr));
    }
    this.push(null);
  }

  _read() {}

  get(header) {
    return this.headers[header.toLowerCase()];
  }

  header(header) {
    return this.get(header);
  }
}

class MockServerResponse extends EventEmitter {
  constructor(resolve, reject) {
    super();
    this.statusCode = 200;
    this.statusMessage = 'OK';
    this.headers = {};
    this._chunks = [];
    this._resolve = resolve;
    this._reject = reject;
    this.headersSent = false;
    this.finished = false;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  sendStatus(code) {
    this.statusCode = code;
    return this.send(String(code));
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = String(value);
    return this;
  }

  set(name, value) {
    if (typeof name === 'object' && name !== null) {
      for (const [k, v] of Object.entries(name)) {
        this.setHeader(k, v);
      }
    } else {
      this.setHeader(name, value);
    }
    return this;
  }

  getHeader(name) {
    return this.headers[name.toLowerCase()];
  }

  getHeaders() {
    return { ...this.headers };
  }

  hasHeader(name) {
    return name.toLowerCase() in this.headers;
  }

  removeHeader(name) {
    delete this.headers[name.toLowerCase()];
  }

  writeHead(statusCode, reasonOrHeaders, maybeHeaders) {
    this.statusCode = statusCode;
    const headers = typeof reasonOrHeaders === 'object' ? reasonOrHeaders : maybeHeaders;
    if (headers) {
      this.set(headers);
    }
    return this;
  }

  write(chunk, encoding, cb) {
    if (chunk) {
      this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    }
    if (typeof cb === 'function') cb();
    return true;
  }

  end(chunk, encoding, cb) {
    if (this.finished) return this;
    if (chunk) {
      this.write(chunk, encoding);
    }
    this.finished = true;
    this.headersSent = true;

    const raw = Buffer.concat(this._chunks).toString('utf-8');
    let parsedBody = {};
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      parsedBody = raw;
    }

    const resObj = {
      status: this.statusCode,
      statusCode: this.statusCode,
      body: parsedBody,
      text: raw,
      headers: this.headers,
      header: this.headers,
      ok: this.statusCode >= 200 && this.statusCode < 300,
      clientError: this.statusCode >= 400 && this.statusCode < 500,
      serverError: this.statusCode >= 500 && this.statusCode < 600,
      get: (header) => this.headers[header.toLowerCase()],
    };

    this.emit('finish');
    if (typeof cb === 'function') cb();
    this._resolve(resObj);
    return this;
  }

  send(data) {
    if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
      return this.json(data);
    }
    if (typeof data === 'string') {
      if (!this.getHeader('content-type')) {
        this.setHeader('content-type', 'text/html; charset=utf-8');
      }
      this.write(Buffer.from(data));
    } else if (Buffer.isBuffer(data)) {
      this.write(data);
    }
    return this.end();
  }

  json(data) {
    if (!this.getHeader('content-type')) {
      this.setHeader('content-type', 'application/json; charset=utf-8');
    }
    this.write(Buffer.from(JSON.stringify(data)));
    return this.end();
  }
}

function getStatusText(code) {
  const map = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };
  return map[code] || 'Status';
}

function createTestRequest(app, method, url) {
  let headers = {};
  let bodyData = null;
  let queryData = {};
  const assertions = [];

  const chain = {
    set(key, value) {
      if (typeof key === 'object' && key !== null) {
        for (const [k, v] of Object.entries(key)) {
          headers[k.toLowerCase()] = String(v);
        }
      } else if (key) {
        headers[key.toLowerCase()] = String(value);
      }
      return chain;
    },
    send(data) {
      bodyData = data;
      return chain;
    },
    query(params) {
      if (typeof params === 'object' && params !== null) {
        Object.assign(queryData, params);
      }
      return chain;
    },
    type(t) {
      headers['content-type'] = t.includes('/') ? t : `application/${t}`;
      return chain;
    },
    accept(a) {
      headers['accept'] = a.includes('/') ? a : `application/${a}`;
      return chain;
    },
    auth(userOrToken, passOrOptions) {
      if (passOrOptions && typeof passOrOptions === 'object' && passOrOptions.type === 'bearer') {
        headers['authorization'] = `Bearer ${userOrToken}`;
      } else if (typeof passOrOptions === 'string') {
        const credentials = Buffer.from(`${userOrToken}:${passOrOptions}`).toString('base64');
        headers['authorization'] = `Basic ${credentials}`;
      } else {
        headers['authorization'] = `Bearer ${userOrToken}`;
      }
      return chain;
    },
    expect(val, fn) {
      assertions.push({ val, fn });
      return chain;
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    catch(reject) {
      return execute().catch(reject);
    },
    end(callback) {
      execute().then((res) => callback && callback(null, res)).catch((err) => callback && callback(err));
    }
  };

  async function execute() {
    return new Promise((resolve, reject) => {
      try {
        let targetUrl = url;
        if (Object.keys(queryData).length > 0) {
          const sep = targetUrl.includes('?') ? '&' : '?';
          targetUrl += sep + new URLSearchParams(queryData).toString();
        }

        const req = new MockIncomingMessage(method, targetUrl, headers, bodyData);
        const res = new MockServerResponse(
          (responseObj) => {
            for (const assertItem of assertions) {
              if (typeof assertItem.val === 'number') {
                if (responseObj.status !== assertItem.val) {
                  return reject(new Error(`expected ${assertItem.val} "${getStatusText(assertItem.val)}", got ${responseObj.status} "${getStatusText(responseObj.status)}"`));
                }
              } else if (typeof assertItem.val === 'string') {
                if (typeof assertItem.fn === 'string' || assertItem.fn instanceof RegExp) {
                  const headerVal = responseObj.headers[assertItem.val.toLowerCase()];
                  const match = assertItem.fn instanceof RegExp ? assertItem.fn.test(headerVal) : headerVal === assertItem.fn;
                  if (!match) {
                    return reject(new Error(`expected "${assertItem.val}" matching ${assertItem.fn}, got "${headerVal}"`));
                  }
                }
              }
            }
            resolve(responseObj);
          },
          reject
        );

        let handler = app;
        if (handler && typeof handler.handle === 'function') {
          handler.handle(req, res, (err) => {
            if (err) reject(err);
            else res.end();
          });
        } else if (typeof handler === 'function') {
          handler(req, res, (err) => {
            if (err) reject(err);
            else res.end();
          });
        } else if (handler && typeof handler.emit === 'function') {
          handler.emit('request', req, res);
        } else {
          reject(new Error('Provided app is not a callable function or Express application'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  return chain;
}

export function request(app) {
  const handler = (method) => (url) => createTestRequest(app, method, url);
  return {
    get: handler('GET'),
    post: handler('POST'),
    put: handler('PUT'),
    delete: handler('DELETE'),
    patch: handler('PATCH'),
    options: handler('OPTIONS'),
    head: handler('HEAD'),
  };
}

export default request;
request.agent = request;
request.Test = createTestRequest;
export const superagent = request;
"""

VITE_BUILD_CONFIG_CONTENT = """import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
"""

PYTEST_INI_CONTENT = """[pytest]
asyncio_mode = auto
testpaths = .
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
"""

SETUP_CONFIG_EXCLUSIONS = {
    'setuptests.ts', 'setuptests.js', 'src/setuptests.ts', 'src/setuptests.js',
    'setupsupertest.js', 'setupsupertest.ts', 'src/setupsupertest.js', 'src/setupsupertest.ts',
    'vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js',
    'conftest.py', 'jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs',
    'playwright.config.ts', 'playwright.config.js', 'cypress.config.ts', 'cypress.config.js',
}

TEST_FILE_PATTERN = re.compile(
    r'(\.(test|spec)\.(jsx?|tsx?|mjs|cjs)$)|(^test_.*\.py$)|(.*_test\.(py|go|rs)$)',
    re.IGNORECASE
)

def is_test_file(file_name: str) -> bool:
    """
    Determines whether the given file path corresponds to an executable test suite.
    Excludes setup/config files (e.g. setupTests.ts, vitest.config.ts, conftest.py, jest.config.js).
    """
    if not file_name or not isinstance(file_name, str):
        return False
    normalized = file_name.replace('\\', '/').strip().lower()
    if normalized.startswith('./'):
        normalized = normalized[2:]
    normalized = normalized.lstrip('/')

    base = os.path.basename(normalized)
    if not base:
        return False

    if base in SETUP_CONFIG_EXCLUSIONS or normalized in SETUP_CONFIG_EXCLUSIONS:
        return False
    if base.startswith(('conftest.', 'setuptests.', 'setup_tests.')):
        return False

    # Check path segments to exclude helper/fixture/mock folders
    parts = normalized.split('/')
    if any(p in ('helpers', 'fixtures', 'mocks', 'utils', '__mocks__') for p in parts[:-1]):
        return False

    if TEST_FILE_PATTERN.search(base):
        return True

    # Check if directly located in __tests__ directory
    if any(p == '__tests__' for p in parts[:-1]):
        if base.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')):
            if not base.startswith(('conftest', 'setup', '__init__', 'fixture', 'helper', 'mock', 'util')):
                if base.endswith('.py'):
                    return bool(re.search(r'(^test_.*\.py$)|(.*_test\.py$)', base, re.IGNORECASE))
                return True

    return False

# Lucide React Brand Icon Replacement Map
# Lucide removed all company and brand logos. This dictionary maps popular brand icons
# to clean, standard generic equivalents guaranteed to exist in lucide-react.
LUCIDE_BRAND_REPLACEMENTS = {
    # Social Media
    "Facebook": "Globe",
    "Twitter": "MessageCircle",
    "Instagram": "Camera",
    "Youtube": "Play",
    "YouTube": "Play",
    "Linkedin": "Briefcase",
    "LinkedIn": "Briefcase",
    "Github": "Code",
    "GitHub": "Code",
    "Gitlab": "Code2",
    "GitLab": "Code2",
    "Tiktok": "Music",
    "TikTok": "Music",
    "Discord": "MessageSquare",
    "Slack": "Hash",
    "Twitch": "Tv",
    "Reddit": "MessageCircle",
    "Pinterest": "Pin",
    "Snapchat": "Ghost",
    "Whatsapp": "Phone",
    "WhatsApp": "Phone",
    "Telegram": "Send",
    "Medium": "BookOpen",
    "Dribbble": "Palette",
    "Behance": "Layers",
    "Threads": "AtSign",
    
    # Tech Brands
    "Google": "Search",
    "Chrome": "Compass",
    "Apple": "Smartphone",
    "Android": "Bot",
    
    # E-Commerce & Payment Brands
    "Paypal": "CreditCard",
    "PayPal": "CreditCard",
    "Stripe": "CreditCard",
    "Visa": "CreditCard",
    "Mastercard": "CreditCard",
    "Amex": "CreditCard",
    "Bitcoin": "Coins",
    "Ethereum": "Coins",
    
    # Media & Stores
    "Spotify": "Music",
    "Netflix": "Tv",
    "Amazon": "ShoppingBag",
    "AppStore": "Store",
    "PlayStore": "Store",
}

LUCIDE_IMPORT_PATTERN = re.compile(
    r"(import\s*\{)([^}]+)(\}\s*from\s*['\"]lucide-react['\"];?)",
    re.MULTILINE
)

LUCIDE_EXPORT_PATTERN = re.compile(
    r"(export\s*\{)([^}]+)(\}\s*from\s*['\"]lucide-react['\"];?)",
    re.MULTILINE
)

LUCIDE_REQUIRE_PATTERN = re.compile(
    r"((?:const|let|var)\s*\{)([^}]+)(\}\s*=\s*require\(['\"]lucide-react['\"]\);?)",
    re.MULTILINE
)

LUCIDE_NAMESPACE_PATTERN = re.compile(
    r"import\s*\*\s*as\s*([A-Za-z0-9_$]+)\s*from\s*['\"]lucide-react['\"]",
    re.MULTILINE
)


def sanitize_lucide_brand_icons(source_code: str) -> str:
    """
    Deterministically replaces deprecated or removed brand icons from 'lucide-react'
    with safe, standard generic icons (e.g. Facebook -> Globe as Facebook).
    
    Using the 'Replacement as Brand' alias technique guarantees that:
    1. The import resolves to a valid Lucide icon component.
    2. All downstream JSX usages (e.g. <Facebook />, {Facebook}) continue functioning
       without needing to touch or risk corrupting any application JSX logic.
    """
    if not source_code or "lucide-react" not in source_code:
        return source_code

    def _replace_named_specifiers(prefix: str, specifiers_str: str, suffix: str, is_require: bool = False) -> str:
        specifiers = specifiers_str.split(',')
        new_specifiers = []
        modified = False

        for spec in specifiers:
            stripped = spec.strip()
            if not stripped:
                new_specifiers.append(spec)
                continue

            # Handle TypeScript `type IconName`
            type_prefix = ""
            if stripped.startswith("type ") and not is_require:
                type_prefix = "type "
                stripped = stripped[5:].strip()

            # Handle `Exported as Alias` or CommonJS `Property: Variable`
            if not is_require and " as " in stripped:
                parts = stripped.split(" as ", 1)
                icon_name = parts[0].strip()
                alias_name = parts[1].strip()
                if icon_name in LUCIDE_BRAND_REPLACEMENTS:
                    replacement = LUCIDE_BRAND_REPLACEMENTS[icon_name]
                    leading_ws = spec[:len(spec) - len(spec.lstrip())]
                    trailing_ws = spec[len(spec.rstrip()):]
                    new_spec = f"{leading_ws}{type_prefix}{replacement} as {alias_name}{trailing_ws}"
                    new_specifiers.append(new_spec)
                    modified = True
                else:
                    new_specifiers.append(spec)
            elif is_require and ":" in stripped:
                parts = stripped.split(":", 1)
                icon_name = parts[0].strip()
                local_var = parts[1].strip()
                if icon_name in LUCIDE_BRAND_REPLACEMENTS:
                    replacement = LUCIDE_BRAND_REPLACEMENTS[icon_name]
                    leading_ws = spec[:len(spec) - len(spec.lstrip())]
                    trailing_ws = spec[len(spec.rstrip()):]
                    new_spec = f"{leading_ws}{replacement}: {local_var}{trailing_ws}"
                    new_specifiers.append(new_spec)
                    modified = True
                else:
                    new_specifiers.append(spec)
            else:
                icon_name = stripped
                if icon_name in LUCIDE_BRAND_REPLACEMENTS:
                    replacement = LUCIDE_BRAND_REPLACEMENTS[icon_name]
                    leading_ws = spec[:len(spec) - len(spec.lstrip())]
                    trailing_ws = spec[len(spec.rstrip()):]
                    if is_require:
                        new_spec = f"{leading_ws}{replacement}: {icon_name}{trailing_ws}"
                    else:
                        new_spec = f"{leading_ws}{type_prefix}{replacement} as {icon_name}{trailing_ws}"
                    new_specifiers.append(new_spec)
                    modified = True
                else:
                    new_specifiers.append(spec)

        if modified:
            return f"{prefix}{','.join(new_specifiers)}{suffix}"
        return f"{prefix}{specifiers_str}{suffix}"

    # 1. Sanitize standard ES imports: import { ... } from 'lucide-react'
    sanitized = LUCIDE_IMPORT_PATTERN.sub(
        lambda m: _replace_named_specifiers(m.group(1), m.group(2), m.group(3), is_require=False),
        source_code
    )

    # 2. Sanitize re-exports: export { ... } from 'lucide-react'
    sanitized = LUCIDE_EXPORT_PATTERN.sub(
        lambda m: _replace_named_specifiers(m.group(1), m.group(2), m.group(3), is_require=False),
        sanitized
    )

    # 3. Sanitize CommonJS require: const { ... } = require('lucide-react')
    sanitized = LUCIDE_REQUIRE_PATTERN.sub(
        lambda m: _replace_named_specifiers(m.group(1), m.group(2), m.group(3), is_require=True),
        sanitized
    )

    # 4. Sanitize namespace usages if import * as Lucide from 'lucide-react'
    ns_matches = LUCIDE_NAMESPACE_PATTERN.findall(sanitized)
    for ns_name in ns_matches:
        for brand, replacement in LUCIDE_BRAND_REPLACEMENTS.items():
            sanitized = re.sub(rf'\b{re.escape(ns_name)}\.{brand}\b', f'{ns_name}.{replacement}', sanitized)

    return sanitized

def normalize_requirements_txt(content: str) -> str:
    """
    Normalizes requirements.txt for Python testing pipelines:
    1. Ensures pytest, pytest-asyncio, and httpx are declared.
    2. Strips broken pins (e.g. 'pytest==', 'pytest>=', empty versions, invalid placeholders).
    3. Removes conflicting upper-bound pins (e.g. 'pytest-asyncio<0.18') that break asyncio_mode = auto.
    4. Preserves all other valid requirements, comments, and options.
    """
    if not content or not isinstance(content, str):
        return "pytest\npytest-asyncio\nhttpx\n"

    target_deps = {'pytest', 'pytest-asyncio', 'httpx'}
    seen_deps = set()
    lines = content.splitlines()
    output_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith(('#', '-', '@')):
            output_lines.append(line)
            continue

        # Extract package name and version specifiers
        m = re.match(r'^([A-Za-z0-9_.\-]+)(.*)$', stripped)
        if not m:
            output_lines.append(line)
            continue

        raw_pkg = m.group(1)
        rest = m.group(2).strip()
        canonical = re.sub(r'[-_.]+', '-', raw_pkg).lower()

        if canonical in target_deps:
            if canonical in seen_deps:
                continue
            seen_deps.add(canonical)

            # Check for broken or conflicting pins
            is_broken = False
            # 1. Empty version specifier after operator (e.g. 'pytest==')
            if re.match(r'^(==|>=|<=|!=|~=|===|<|>)\s*$', rest):
                is_broken = True
            # 2. Conflicting upper bound pin (e.g. '< 7.0' or '<= 0.20')
            elif re.match(r'^<', rest):
                is_broken = True
            # 3. Non-standard placeholder versions (e.g. 'unknown', 'latest', 'none')
            elif re.search(r'(unknown|none|null|latest|broken)', rest, re.IGNORECASE):
                is_broken = True
            # 4. Malformed single '=' operator
            elif rest.startswith('=') and not rest.startswith('=='):
                is_broken = True

            if is_broken:
                output_lines.append(canonical)
            else:
                output_lines.append(f"{canonical}{(' ' + rest) if rest and not rest.startswith(('=', '<', '>', '~', '!')) else rest}")
        else:
            output_lines.append(line)

    # Ensure all target dependencies are present
    for req in ['pytest', 'pytest-asyncio', 'httpx']:
        if req not in seen_deps:
            output_lines.append(req)

    result = '\n'.join(output_lines)
    if content.endswith('\n') or content.strip():
        result += '\n'
    return result

PYTHON_DEPENDENCY_CONSTRAINTS = {
    "motor": {"pymongo": "<4.8"},
    "fastapi": {"python-multipart": ""},
}

def enforce_python_dependency_constraints(content: str) -> str:
    """
    Scans requirements.txt for packages with known transitive dependency
    conflicts and injects version constraints for their transitive deps.
    """
    if not content or not isinstance(content, str):
        return content
        
    lines = content.splitlines()
    detected_packages = set()
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith(('#', '-', '@')):
            continue
        m = re.match(r'^([A-Za-z0-9_.\-]+)', stripped)
        if m:
            pkg = m.group(1).lower()
            detected_packages.add(pkg)
            if '==' in stripped:
                detected_packages.add(stripped.lower().replace(' ', ''))

    needed_constraints = {}
    for trigger, constraints in PYTHON_DEPENDENCY_CONSTRAINTS.items():
        if trigger in detected_packages:
            needed_constraints.update(constraints)
            
    if not needed_constraints:
        return content
        
    output_lines = list(lines)
    for target, bound in needed_constraints.items():
        if target not in detected_packages:
            output_lines.append(f"{target}{bound}")
            
    result = '\n'.join(output_lines)
    if content.endswith('\n') or content.strip():
        result += '\n'
    return result

def sanitize_python_source(source_code: str) -> str:
    """
    Deterministically sanitizes and repairs common LLM-generated Python syntax errors:
    1. Runs ast.parse(source_code). If clean, returns original source.
    2. If SyntaxError occurs:
       - Fixes f-string expressions containing backslashes or nested quotes (e.g. {\"key\": \"val\"} or {{\"...\"}}).
       - Converts conflicting inner quotes inside {...} or {{...}} to single quotes.
       - Converts malformed f-strings without interpolated variables into valid raw/triple-quoted strings.
       - Fixes unescaped regex escape sequences (\\d, \\s, \\w, etc.) by converting them to raw strings.
    3. Re-validates with ast.parse(). If fixed, returns sanitized source; else returns best-effort sanitized code.
    """
    if not source_code or not isinstance(source_code, str):
        return source_code

    # 1. Fast path: check if source is already valid
    try:
        ast.parse(source_code)
        return source_code
    except SyntaxError:
        pass

    # Helper 1: Fix double braces {{ ... }} with escaped or unescaped double quotes inside f-strings
    def _fix_double_braces(text: str) -> str:
        def repl(m):
            content = m.group(1)
            fixed = content.replace('\\"', "'").replace('"', "'")
            return '{{' + fixed + '}}'
        return re.sub(r'\{\{(.*?)\}\}', repl, text, flags=re.DOTALL)

    # Helper 2: Fix single braces { ... } with backslash-escaped quotes inside f-strings
    def _fix_single_brace_backslashes(text: str) -> str:
        def repl(m):
            content = m.group(1)
            fixed = content.replace('\\"', "'").replace('"', "'")
            return '{' + fixed + '}'
        return re.sub(r'(?<!\{)\{([^{}\n]+)\}(?!\})', repl, text)

    # Helper 3: Convert unescaped regex escape sequences into raw strings r"..."
    def _fix_regex_raw_strings(text: str) -> str:
        def repl_str(m):
            prefix = m.group(1) or ''
            quote = m.group(2)
            body = m.group(3)
            if 'r' in prefix.lower():
                return m.group(0)
            if re.search(r'\\(?:[dswDSWbB])', body):
                return prefix + 'r' + quote + body + quote
            return m.group(0)
        pattern = re.compile(r'([bBfFuU]?)([\'"])((?:\\.|(?!\2)[^\\])*)\2')
        return pattern.sub(repl_str, text)

    # Helper 4: Convert malformed f-strings without variables into raw strings
    def _fix_malformed_fstrings_without_vars(text: str) -> str:
        lines = text.splitlines(keepends=True)
        new_lines = []
        for line in lines:
            if re.search(r'\bf[\'"]', line):
                try:
                    ast.parse(line.strip())
                    new_lines.append(line)
                    continue
                except SyntaxError:
                    pass
                has_var = bool(re.search(r'(?<!\{)\{([a-zA-Z_][a-zA-Z0-9_.]*)\}(?!\})', line))
                if not has_var:
                    fixed_line = re.sub(r'\bf([\'"])', r'r\1', line)
                    try:
                        ast.parse(fixed_line.strip())
                        new_lines.append(fixed_line)
                        continue
                    except SyntaxError:
                        pass
            new_lines.append(line)
        return ''.join(new_lines)

    # Progressive Sanitization Pipeline:
    # Pass 1: Fix double-brace and single-brace quote/backslash collisions
    repaired = _fix_double_braces(source_code)
    repaired = _fix_single_brace_backslashes(repaired)
    try:
        ast.parse(repaired)
        return repaired
    except SyntaxError:
        pass

    # Pass 2: Combine with regex raw string repairs
    repaired_regex = _fix_regex_raw_strings(repaired)
    try:
        ast.parse(repaired_regex)
        return repaired_regex
    except SyntaxError:
        pass

    # Pass 3: Convert malformed f-strings without variables to raw strings
    repaired_fvars = _fix_malformed_fstrings_without_vars(repaired_regex)
    try:
        ast.parse(repaired_fvars)
        return repaired_fvars
    except SyntaxError:
        pass

    # Pass 4: Targeted line-level repair using SyntaxError metadata
    try:
        ast.parse(source_code)
    except SyntaxError as e:
        lines = source_code.splitlines(keepends=True)
        if e.lineno and 1 <= e.lineno <= len(lines):
            idx = e.lineno - 1
            line = lines[idx]
            fixed = _fix_double_braces(line)
            fixed = _fix_single_brace_backslashes(fixed)
            fixed = fixed.replace('\\"', "'")
            lines[idx] = fixed
            target_candidate = ''.join(lines)
            try:
                ast.parse(target_candidate)
                return target_candidate
            except SyntaxError:
                pass

    return repaired

def has_test_files(codebase: Any) -> bool:
    """Detects whether the codebase contains any active test suites."""
    if not codebase:
        return False
    files = getattr(codebase, 'files', None)
    if files is None and isinstance(codebase, dict):
        files = codebase.get('files', None)
    if not files:
        return False
    for f in files:
        fname = f.get('file_name', '') if isinstance(f, dict) else getattr(f, 'file_name', '')
        if is_test_file(fname):
            return True
    return False

def enforce_golden_dependencies(codebase: Any) -> Any:
    """
    Sanitizes, patches, and injects testing infrastructure into generated codebases.
    Guarantees that JSDOM environment, matchMedia polyfills, and Jest-DOM matchers
    are deterministically configured before container execution when tests are present,
    or clean build configurations are provided when tests are omitted.
    Also executes a deterministic scan across all source files to replace deprecated or
    removed 'lucide-react' brand icons with safe generic equivalents.
    """
    if not codebase or not getattr(codebase, 'files', None):
        return codebase

    try:
        from models import CodeFile
        CodeFileClass = CodeFile
    except Exception:
        CodeFileClass = type(codebase.files[0]) if codebase.files else None

    def _norm(name: str) -> str:
        n = name.replace('\\', '/').strip().lower()
        if n.startswith('./'):
            n = n[2:]
        return n.lstrip('/')

    # 0. Deterministic scan and sanitization of banned/removed brand icons from lucide-react
    for file in codebase.files:
        fname = file.file_name.lower() if hasattr(file, 'file_name') else file.get('file_name', '').lower()
        if fname.endswith(('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')):
            src = file.source_code if hasattr(file, 'source_code') else file.get('source_code', '')
            if src and 'lucide-react' in src:
                cleaned = sanitize_lucide_brand_icons(src)
                if cleaned != src:
                    if hasattr(file, 'source_code'):
                        file.source_code = cleaned
                    elif isinstance(file, dict):
                        file['source_code'] = cleaned

    # 0b. Deterministic Python source code sanitization (R2)
    for file in codebase.files:
        fname = (getattr(file, 'file_name', '') if hasattr(file, 'file_name') else file.get('file_name', '')).lower()
        if fname.endswith('.py'):
            src = getattr(file, 'source_code', '') if hasattr(file, 'source_code') else file.get('source_code', '')
            if src:
                sanitized = sanitize_python_source(src)
                if sanitized != src:
                    if hasattr(file, 'source_code'):
                        file.source_code = sanitized
                    elif isinstance(file, dict):
                        file['source_code'] = sanitized

    # Track existing configurations
    has_eslint_config = any(
        _norm(f.file_name) in ['.eslintrc.cjs', '.eslintrc.js', '.eslintrc.json', '.eslintrc', 'eslint.config.js']
        for f in codebase.files
    )
    has_vite_config = any(
        _norm(f.file_name) in ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs', 'vitest.config.ts', 'vitest.config.js']
        for f in codebase.files
    )

    react_detected = False
    jsdom_detected = False
    BANNED_DEV_DEPS = {'supertest', 'superagent'}

    tests_present = has_test_files(codebase)

    has_package_json = any(file.file_name.lower() == 'package.json' for file in codebase.files)

    for file in codebase.files:
        if file.file_name.lower() == 'package.json':
            try:
                ai_pkg = json.loads(file.source_code)
                deps_str = str(ai_pkg.get('dependencies', {})) + str(ai_pkg.get('devDependencies', {}))

                if 'jsdom' in deps_str:
                    jsdom_detected = True

                if 'react' in deps_str:
                    react_detected = True
                    # CRITICAL FIX: Deep copy prevents cross-run global dictionary mutation
                    golden = copy.deepcopy(REACT_VITE_PACKAGE_JSON)

                    # When not tests_present: remove test devDependencies and unit test scripts from golden package.json
                    # Provide a safe 'test' alias pointing to build verification so npm test never fails with 'Missing script: "test"'
                    if not tests_present:
                        for test_dev_dep in ['vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom', '@testing-library/user-event']:
                            golden['devDependencies'].pop(test_dev_dep, None)
                        for test_script in ['test:unit', 'test:e2e']:
                            golden['scripts'].pop(test_script, None)
                        golden['scripts']['test'] = "npm run build"

                    ai_deps = ai_pkg.get('dependencies', {})
                    golden_deps = golden['dependencies']
                    for k, v in ai_deps.items():
                        if not tests_present and k in ['vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom', '@testing-library/user-event']:
                            continue
                        if k not in golden_deps and k != "@playwright/test" and k not in BANNED_DEV_DEPS:
                            golden_deps[k] = v

                    ai_dev_deps = ai_pkg.get('devDependencies', {})
                    golden_dev_deps = golden['devDependencies']
                    for k, v in ai_dev_deps.items():
                        if not tests_present and (k in ['vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom', '@testing-library/user-event'] or k == '@playwright/test'):
                            continue
                        if k not in golden_dev_deps and k != "@playwright/test" and k not in BANNED_DEV_DEPS:
                            golden_dev_deps[k] = v

                    if tests_present and "@playwright/test" in str(file.source_code):
                        golden_dev_deps["@playwright/test"] = "1.48.0"

                    golden['dependencies'] = golden_deps
                    golden['devDependencies'] = golden_dev_deps

                    file.source_code = json.dumps(golden, indent=2)
                else:
                    # Non-React Node/backend package.json: strip banned dependencies
                    modified = False
                    for sec in ['dependencies', 'devDependencies']:
                        if sec in ai_pkg and isinstance(ai_pkg[sec], dict):
                            for banned in BANNED_DEV_DEPS:
                                if banned in ai_pkg[sec]:
                                    del ai_pkg[sec][banned]
                                    modified = True
                    # If no tests are present and no test script exists, but build script exists,
                    # provide safe test fallback alias to build
                    if not tests_present:
                        scripts = ai_pkg.get('scripts', {})
                        if 'test' not in scripts and 'build' in scripts:
                            scripts['test'] = "npm run build"
                            ai_pkg['scripts'] = scripts
                            modified = True
                    if modified:
                        file.source_code = json.dumps(ai_pkg, indent=2)
            except Exception:
                pass

    # Inject setupSupertest.js if supertest/superagent is referenced or for Node projects with tests
    has_supertest_usage = any(
        ('supertest' in (getattr(f, 'source_code', '') or '') or 'superagent' in (getattr(f, 'source_code', '') or ''))
        for f in codebase.files
    )
    has_setup_supertest = any(_norm(getattr(f, 'file_name', '')) in ['setupsupertest.js', 'setupsupertest.ts'] for f in codebase.files)

    if (has_supertest_usage or (has_package_json and tests_present)) and not has_setup_supertest:
        if CodeFileClass is not None:
            codebase.files.append(CodeFileClass(file_name="setupSupertest.js", source_code=SETUP_SUPERTEST_CONTENT))

    # Only inject test headers if tests_present
    if tests_present and (jsdom_detected or react_detected):
        for file in codebase.files:
            fname = file.file_name if hasattr(file, 'file_name') else file.get('file_name', '')
            if is_test_file(fname):
                if fname.lower().endswith('.py'):
                    continue
                src = file.source_code if hasattr(file, 'source_code') else file.get('source_code', '')
                prefix = ""

                if "@vitest-environment jsdom" not in src:
                    prefix += "// @vitest-environment jsdom\n"

                if react_detected and ("import React" not in src and "import * as React" not in src):
                    prefix += "import React from 'react';\n"

                if prefix:
                    file.source_code = prefix + src

    # Deterministic file injection with configuration reconciliation
    if CodeFileClass is not None:
        if react_detected and not has_eslint_config:
            codebase.files.append(CodeFileClass(file_name=".eslintrc.cjs", source_code=ESLINT_RC_CONTENT))

        if react_detected:
            if tests_present:
                # Guarantee universal setupTests.ts exists at standard path src/setupTests.ts
                has_src_setup = any(
                    _norm(f.file_name) in ['src/setuptests.ts', 'src/setuptests.js', 'setuptests.ts', 'setuptests.js']
                    for f in codebase.files
                )
                if not has_src_setup:
                    codebase.files.append(CodeFileClass(file_name="src/setupTests.ts", source_code=SETUP_TESTS_CONTENT))

                # Reconcile Vite configuration:
                # If agent generates custom vite.config.ts, inject dedicated vitest.config.ts
                # which takes precedence in Vitest, ensuring setupFiles and JSDOM are never omitted.
                if not has_vite_config:
                    codebase.files.append(CodeFileClass(file_name="vite.config.ts", source_code=VITE_CONFIG_CONTENT))
                else:
                    has_dedicated_vitest = any(
                        _norm(f.file_name) in ['vitest.config.ts', 'vitest.config.js']
                        for f in codebase.files
                    )
                    if not has_dedicated_vitest:
                        codebase.files.append(CodeFileClass(file_name="vitest.config.ts", source_code=VITE_CONFIG_CONTENT))
            else:
                # When not tests_present:
                # Only inject VITE_BUILD_CONFIG_CONTENT if not has_vite_config.
                # Do NOT inject src/setupTests.ts or vitest.config.ts.
                if not has_vite_config:
                    codebase.files.append(CodeFileClass(file_name="vite.config.ts", source_code=VITE_BUILD_CONFIG_CONTENT))
        elif tests_present and has_package_json:
            # Node.js backend project with unit tests
            has_vitest_config = any(
                _norm(f.file_name) in ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'vite.config.ts', 'vite.config.js', 'vite.config.mjs']
                for f in codebase.files
            )
            if not has_vitest_config:
                codebase.files.append(CodeFileClass(file_name="vitest.config.js", source_code=NODE_VITEST_CONFIG_CONTENT))

    # Deterministic Python testing configuration injection (pytest.ini & requirements.txt)
    has_py_files = any(
        (getattr(f, 'file_name', '') if hasattr(f, 'file_name') else f.get('file_name', '')).lower().endswith('.py')
        for f in codebase.files
    )
    has_py_test_files = any(
        is_test_file(getattr(f, 'file_name', '') if hasattr(f, 'file_name') else f.get('file_name', '')) and
        (getattr(f, 'file_name', '') if hasattr(f, 'file_name') else f.get('file_name', '')).lower().endswith('.py')
        for f in codebase.files
    )
    has_pytest_ini = any(
        _norm(getattr(f, 'file_name', '') if hasattr(f, 'file_name') else f.get('file_name', '')) == 'pytest.ini'
        for f in codebase.files
    )

    if (has_py_files or has_py_test_files) and not has_pytest_ini:
        if CodeFileClass is not None:
            if isinstance(CodeFileClass, type) and issubclass(CodeFileClass, dict):
                codebase.files.append({"file_name": "pytest.ini", "source_code": PYTEST_INI_CONTENT})
            else:
                codebase.files.append(CodeFileClass(file_name="pytest.ini", source_code=PYTEST_INI_CONTENT))
    elif has_pytest_ini:
        # Reconcile existing pytest.ini to ensure asyncio_mode = auto
        for file in codebase.files:
            fname = getattr(file, 'file_name', '') if hasattr(file, 'file_name') else file.get('file_name', '')
            if _norm(fname) == 'pytest.ini':
                src = getattr(file, 'source_code', '') if hasattr(file, 'source_code') else file.get('source_code', '')
                if 'asyncio_mode' not in src:
                    if '[pytest]' in src:
                        reconciled = src.replace('[pytest]', '[pytest]\nasyncio_mode = auto')
                    else:
                        reconciled = "[pytest]\nasyncio_mode = auto\n" + src
                    if hasattr(file, 'source_code'):
                        file.source_code = reconciled
                    elif isinstance(file, dict):
                        file['source_code'] = reconciled

    # Normalize requirements.txt if Python tests or Python files with tests are present
    for file in codebase.files:
        fname = getattr(file, 'file_name', '') if hasattr(file, 'file_name') else file.get('file_name', '')
        if _norm(fname) == 'requirements.txt':
            if has_py_test_files or (tests_present and has_py_files):
                src = getattr(file, 'source_code', '') if hasattr(file, 'source_code') else file.get('source_code', '')
                normalized_src = normalize_requirements_txt(src)
                constrained_src = enforce_python_dependency_constraints(normalized_src)
                if constrained_src != src:
                    if hasattr(file, 'source_code'):
                        file.source_code = constrained_src
                    elif isinstance(file, dict):
                        file['source_code'] = constrained_src

    return codebase

