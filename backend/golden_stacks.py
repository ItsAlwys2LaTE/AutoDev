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

CONFTEST_MOTOR_INTERCEPTOR_BLOCK = """
# ---------------------------------------------------------------------------
# AutoDev Universal Motor & PyMongo In-Memory Interceptor:
# Intercepts motor.motor_asyncio.AsyncIOMotorClient and pymongo.MongoClient
# so that test suites run against an in-memory document store without requiring
# a real MongoDB instance running on localhost:27017, preventing
# pymongo.errors.ServerSelectionTimeoutError: Connection refused.
# ---------------------------------------------------------------------------
class _AutoDevHybridResult:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        if 'acknowledged' not in kwargs:
            self.acknowledged = True
    def __await__(self):
        async def _r():
            return self
        return _r().__await__()

class _AutoDevHybridDict(dict):
    def __await__(self):
        async def _r():
            return self
        return _r().__await__()

class _AutoDevHybridNone:
    def __bool__(self):
        return False
    def __eq__(self, other):
        return other is None or isinstance(other, _AutoDevHybridNone)
    def __await__(self):
        async def _r():
            return None
        return _r().__await__()

class _AutoDevHybridCursor:
    def __init__(self, docs):
        self._docs = list(docs)
    def __iter__(self):
        return iter(self._docs)
    def __aiter__(self):
        self._aiter = iter(self._docs)
        return self
    async def __anext__(self):
        try:
            return next(self._aiter)
        except StopIteration:
            raise StopAsyncIteration
    def to_list(self, length=None):
        docs = list(self._docs) if length is None else list(self._docs[:length])
        class _List(list):
            def __await__(self):
                async def _r():
                    return self
                return _r().__await__()
        return _List(docs)
    def sort(self, *args, **kwargs):
        return self
    def limit(self, n):
        self._docs = self._docs[:n]
        return self
    def skip(self, n):
        self._docs = self._docs[n:]
        return self
    def __await__(self):
        async def _r():
            return list(self._docs)
        return _r().__await__()

class _AutoDevHybridCollection:
    def __init__(self, name='collection'):
        self.name = name
        self._docs = []

    def _matches(self, doc, f):
        if not f:
            return True
        for k, v in f.items():
            if k.startswith('$'):
                continue
            doc_val = doc.get(k)
            if isinstance(v, dict):
                for op, op_val in v.items():
                    if op == '$eq' and doc_val != op_val:
                        return False
                    elif op == '$ne' and doc_val == op_val:
                        return False
                    elif op == '$in' and doc_val not in op_val:
                        return False
                    elif op == '$nin' and doc_val in op_val:
                        return False
            elif doc_val != v:
                return False
        return True

    def delete_many(self, filter=None, *args, **kwargs):
        f = filter or {}
        before = len(self._docs)
        self._docs = [d for d in self._docs if not self._matches(d, f)]
        deleted = before - len(self._docs)
        return _AutoDevHybridResult(deleted_count=deleted)

    def delete_one(self, filter=None, *args, **kwargs):
        f = filter or {}
        for i, d in enumerate(self._docs):
            if self._matches(d, f):
                self._docs.pop(i)
                return _AutoDevHybridResult(deleted_count=1)
        return _AutoDevHybridResult(deleted_count=0)

    def insert_one(self, document, *args, **kwargs):
        d = dict(document)
        if '_id' not in d:
            d['_id'] = f'mock_{len(self._docs)+1}'
        self._docs.append(d)
        return _AutoDevHybridResult(inserted_id=d['_id'])

    def insert_many(self, documents, *args, **kwargs):
        ids = []
        for doc in documents:
            d = dict(doc)
            if '_id' not in d:
                d['_id'] = f'mock_{len(self._docs)+1}'
            self._docs.append(d)
            ids.append(d['_id'])
        return _AutoDevHybridResult(inserted_ids=ids)

    def find_one(self, filter=None, *args, **kwargs):
        f = filter or {}
        for d in self._docs:
            if self._matches(d, f):
                return _AutoDevHybridDict(dict(d))
        return _AutoDevHybridNone()

    def find(self, filter=None, *args, **kwargs):
        f = filter or {}
        matched = [dict(d) for d in self._docs if self._matches(d, f)]
        return _AutoDevHybridCursor(matched)

    def update_one(self, filter, update, upsert=False, *args, **kwargs):
        f = filter or {}
        for d in self._docs:
            if self._matches(d, f):
                if '$set' in update:
                    d.update(update['$set'])
                if '$unset' in update:
                    for k in update['$unset']:
                        d.pop(k, None)
                if '$inc' in update:
                    for k, inc_val in update['$inc'].items():
                        d[k] = d.get(k, 0) + inc_val
                return _AutoDevHybridResult(matched_count=1, modified_count=1, upserted_id=None)
        if upsert:
            new_doc = dict(f)
            if '$set' in update:
                new_doc.update(update['$set'])
            if '_id' not in new_doc:
                new_doc['_id'] = f'mock_{len(self._docs)+1}'
            self._docs.append(new_doc)
            return _AutoDevHybridResult(matched_count=0, modified_count=0, upserted_id=new_doc['_id'])
        return _AutoDevHybridResult(matched_count=0, modified_count=0, upserted_id=None)

    def update_many(self, filter, update, upsert=False, *args, **kwargs):
        f = filter or {}
        matched = 0
        for d in self._docs:
            if self._matches(d, f):
                matched += 1
                if '$set' in update:
                    d.update(update['$set'])
                if '$unset' in update:
                    for k in update['$unset']:
                        d.pop(k, None)
                if '$inc' in update:
                    for k, inc_val in update['$inc'].items():
                        d[k] = d.get(k, 0) + inc_val
        return _AutoDevHybridResult(matched_count=matched, modified_count=matched, upserted_id=None)

    def count_documents(self, filter=None, *args, **kwargs):
        f = filter or {}
        count = sum(1 for d in self._docs if self._matches(d, f))
        class _Int(int):
            def __await__(self):
                async def _r():
                    return self
                return _r().__await__()
        return _Int(count)

    def replace_one(self, filter, replacement, upsert=False, *args, **kwargs):
        f = filter or {}
        for i, d in enumerate(self._docs):
            if self._matches(d, f):
                rep = dict(replacement)
                if '_id' not in rep and '_id' in d:
                    rep['_id'] = d['_id']
                self._docs[i] = rep
                return _AutoDevHybridResult(matched_count=1, modified_count=1, upserted_id=None)
        if upsert:
            rep = dict(replacement)
            if '_id' not in rep:
                rep['_id'] = f'mock_{len(self._docs)+1}'
            self._docs.append(rep)
            return _AutoDevHybridResult(matched_count=0, modified_count=0, upserted_id=rep['_id'])
        return _AutoDevHybridResult(matched_count=0, modified_count=0, upserted_id=None)

    def create_index(self, keys, *args, **kwargs):
        class _Str(str):
            def __await__(self):
                async def _r():
                    return self
                return _r().__await__()
        return _Str('mock_idx')

    def drop(self, *args, **kwargs):
        self._docs.clear()
        return _AutoDevHybridResult()

    def aggregate(self, pipeline, *args, **kwargs):
        return _AutoDevHybridCursor(self._docs)

    def distinct(self, key, filter=None, *args, **kwargs):
        f = filter or {}
        vals = list(set(d[key] for d in self._docs if key in d and self._matches(d, f)))
        class _List(list):
            def __await__(self):
                async def _r():
                    return self
                return _r().__await__()
        return _List(vals)

class _AutoDevHybridDatabase:
    def __init__(self, name='test_db', client=None):
        self.name = name
        self.client = client
        self._collections = {}

    def __getitem__(self, name):
        if name not in self._collections:
            self._collections[name] = _AutoDevHybridCollection(name)
        return self._collections[name]

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return self[name]

    def get_collection(self, name):
        return self[name]

    def list_collection_names(self, *args, **kwargs):
        class _List(list):
            def __await__(self):
                async def _r():
                    return self
                return _r().__await__()
        return _List(list(self._collections.keys()))

    def command(self, cmd, *args, **kwargs):
        class _Dict(dict):
            def __await__(self):
                async def _r():
                    return self
                return _r().__await__()
        return _Dict({'ok': 1.0})

    def drop_collection(self, name):
        if name in self._collections:
            self._collections[name].drop()
        return _AutoDevHybridResult()

    def __await__(self):
        async def _r():
            return self
        return _r().__await__()

class _AutoDevHybridClient:
    def __init__(self, *args, **kwargs):
        self._databases = {}

    def __getitem__(self, name):
        if name not in self._databases:
            self._databases[name] = _AutoDevHybridDatabase(name, self)
        return self._databases[name]

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return self[name]

    def get_database(self, name='test_db'):
        return self[name]

    def close(self):
        pass

    def server_info(self, *args, **kwargs):
        class _Dict(dict):
            def __await__(self):
                async def _r():
                    return self
                return _r().__await__()
        return _Dict({'version': '7.0.0', 'ok': 1.0})

    def __await__(self):
        async def _r():
            return self
        return _r().__await__()

_autodev_shared_hybrid_client = _AutoDevHybridClient()

try:
    import motor.motor_asyncio
    motor.motor_asyncio.AsyncIOMotorClient = _AutoDevHybridClient
except Exception:
    pass

try:
    import motor
    if hasattr(motor, 'AsyncIOMotorClient'):
        motor.AsyncIOMotorClient = _AutoDevHybridClient
except Exception:
    pass

try:
    import pymongo
    pymongo.MongoClient = _AutoDevHybridClient
except Exception:
    pass
"""

CONFTEST_FASTAPI_SERVICE_SYNC_BLOCK = CONFTEST_MOTOR_INTERCEPTOR_BLOCK + """
# ---------------------------------------------------------------------------
# AutoDev FastAPI & Service Mock Bridge:
# 1. Dynamically maps FastAPI Depends(get_db/...) to in-memory store or mocks
# 2. Synchronizes patched external services across modules (e.g. send_brevo_email)
# 3. Intercepts TestClient / httpx requests to output diagnostic traces on >=500
# ---------------------------------------------------------------------------
def _autodev_sync_fastapi_and_mocks():
    import sys
    import unittest.mock as mock

    apps = []
    SKIP_MODS = ('pytest', '_pytest', 'unittest', 'typing', 'starlette', 'pydantic', 'anyio', 'asyncio', 'websockets', 'cryptography', 'urllib', 'http', 'email', 'encodings', 'importlib')
    try:
        for mod in list(sys.modules.values()):
            if not mod or not hasattr(mod, '__name__') or mod.__name__.startswith(SKIP_MODS):
                continue
            try:
                for attr_name in dir(mod):
                    try:
                        candidate = getattr(mod, attr_name, None)
                        if hasattr(candidate, 'dependency_overrides') and hasattr(candidate, 'routes') and isinstance(getattr(candidate, 'routes', None), (list, tuple)):
                            if candidate not in apps:
                                apps.append(candidate)
                    except Exception:
                        pass
            except Exception:
                pass
    except Exception:
        pass

    try:
        for app in apps:
            routes = getattr(app, 'routes', [])
            if not isinstance(routes, (list, tuple)):
                continue
            for route in routes:
                dependant = getattr(route, 'dependant', None)
                if not dependant:
                    continue
                raw_deps = getattr(dependant, 'dependencies', [])
                if not isinstance(raw_deps, (list, tuple)):
                    continue
                deps_to_visit = list(raw_deps)
                visited = set()
                while deps_to_visit:
                    curr_dep = deps_to_visit.pop(0)
                    if curr_dep in visited:
                        continue
                    visited.add(curr_dep)
                    sub_deps = getattr(curr_dep, 'dependencies', [])
                    if isinstance(sub_deps, (list, tuple)):
                        deps_to_visit.extend(sub_deps)

                    call = getattr(curr_dep, 'call', None)
                    if callable(call):
                        cname = getattr(call, '__name__', '')
                        if cname in ('get_db', 'get_database', 'get_db_session', 'db_dependency', 'get_db_conn', 'db') or 'db' in cname.lower() or 'database' in cname.lower():
                            active_mock = None
                            for mod_name in ['main', 'app', 'database', 'db', 'app.main', 'app.database']:
                                m = sys.modules.get(mod_name)
                                if m and hasattr(m, cname):
                                    attr = getattr(m, cname)
                                    if isinstance(attr, (mock.Mock, mock.MagicMock)):
                                        active_mock = attr
                                        break
                            if not active_mock and isinstance(call, (mock.Mock, mock.MagicMock)):
                                active_mock = call

                            if active_mock is not None:
                                def make_resolver(target_mock):
                                    def _dynamic_resolver():
                                        if hasattr(target_mock, 'return_value') and not isinstance(target_mock.return_value, mock.MagicMock):
                                            return target_mock.return_value
                                        return target_mock()
                                    return _dynamic_resolver

                                app.dependency_overrides[call] = make_resolver(active_mock)
    except Exception:
        pass

    try:
        if '_autodev_shared_hybrid_client' in globals():
            shared_db = _autodev_shared_hybrid_client.get_database("test_db")
            for mod_name in list(sys.modules.keys()):
                if not mod_name or mod_name.startswith(('pytest', '_pytest', 'unittest', 'typing', 'starlette', 'pydantic')):
                    continue
                m = sys.modules.get(mod_name)
                if not m:
                    continue
                for attr in ('db', 'database', 'client', 'mongo_client', 'mongodb'):
                    if hasattr(m, attr):
                        try:
                            val = getattr(m, attr, None)
                            val_type = type(val).__name__
                            val_mod = getattr(type(val), '__module__', '')
                            if 'mongo' in val_type.lower() or 'motor' in val_type.lower() or 'mongo' in val_mod.lower() or 'motor' in val_mod.lower():
                                if 'client' in attr.lower():
                                    setattr(m, attr, _autodev_shared_hybrid_client)
                                else:
                                    setattr(m, attr, shared_db)
                        except Exception:
                            pass
    except Exception:
        pass

    try:
        for svc_name in ['services', 'service', 'app.services', 'app.service']:
            svc_mod = sys.modules.get(svc_name)
            if not svc_mod:
                continue
            for main_name in ['main', 'app', 'app.main']:
                m_mod = sys.modules.get(main_name)
                if not m_mod:
                    continue
                for attr in dir(svc_mod):
                    if attr.startswith('_'):
                        continue
                    try:
                        svc_val = getattr(svc_mod, attr, None)
                        main_val = getattr(m_mod, attr, None)
                        if isinstance(svc_val, (mock.Mock, mock.MagicMock)) and not isinstance(main_val, (mock.Mock, mock.MagicMock)):
                            setattr(m_mod, attr, svc_val)
                        elif isinstance(main_val, (mock.Mock, mock.MagicMock)) and not isinstance(svc_val, (mock.Mock, mock.MagicMock)):
                            setattr(svc_mod, attr, main_val)
                        elif callable(svc_val) and not isinstance(svc_val, (mock.Mock, mock.MagicMock)):
                            if any(kw in attr.lower() for kw in ('brevo', 'sendgrid', 'mailgun', 'send_email', 'send_otp', 'send_sms', 'ses')):
                                safe_mock = mock.MagicMock(return_value={"status": "sent", "messageId": "<mock@autodev>"})
                                setattr(svc_mod, attr, safe_mock)
                                setattr(m_mod, attr, safe_mock)
                    except Exception:
                        pass
    except Exception:
        pass

# Intercept Starlette/FastAPI TestClient.request
try:
    from starlette.testclient import TestClient
    if not getattr(TestClient.request, '_autodev_wrapped', False):
        _orig_tc_request = TestClient.request
        def _wrapped_tc_request(self, method, url, *args, **kwargs):
            _autodev_sync_fastapi_and_mocks()
            resp = _orig_tc_request(self, method, url, *args, **kwargs)
            if getattr(resp, 'status_code', 0) >= 500:
                import sys
                sys.stderr.write(f"\\n[AutoDev Test Diagnostic] HTTP {resp.status_code} on {method} {url}:\\n{getattr(resp, 'text', '')}\\n")
            return resp
        _wrapped_tc_request._autodev_wrapped = True
        TestClient.request = _wrapped_tc_request
except Exception:
    pass

# Intercept httpx.Client and AsyncClient
try:
    import httpx
    if not getattr(httpx.Client.request, '_autodev_wrapped', False):
        _orig_httpx_sync_request = httpx.Client.request
        def _wrapped_httpx_sync_request(self, method, url, *args, **kwargs):
            _autodev_sync_fastapi_and_mocks()
            resp = _orig_httpx_sync_request(self, method, url, *args, **kwargs)
            if getattr(resp, 'status_code', 0) >= 500:
                import sys
                sys.stderr.write(f"\\n[AutoDev Test Diagnostic] HTTP {resp.status_code} on {method} {url}:\\n{getattr(resp, 'text', '')}\\n")
            return resp
        _wrapped_httpx_sync_request._autodev_wrapped = True
        httpx.Client.request = _wrapped_httpx_sync_request

    if not getattr(httpx.AsyncClient.request, '_autodev_wrapped', False):
        _orig_httpx_async_request = httpx.AsyncClient.request
        async def _wrapped_httpx_async_request(self, method, url, *args, **kwargs):
            _autodev_sync_fastapi_and_mocks()
            resp = await _orig_httpx_async_request(self, method, url, *args, **kwargs)
            if getattr(resp, 'status_code', 0) >= 500:
                import sys
                sys.stderr.write(f"\\n[AutoDev Test Diagnostic] HTTP {resp.status_code} on {method} {url}:\\n{getattr(resp, 'text', '')}\\n")
            return resp
        _wrapped_httpx_async_request._autodev_wrapped = True
        httpx.AsyncClient.request = _wrapped_httpx_async_request
except Exception:
    pass

@pytest.fixture(autouse=True)
def _autodev_fastapi_and_service_sync():
    _autodev_sync_fastapi_and_mocks()
    yield
    _autodev_sync_fastapi_and_mocks()
"""

CONFTEST_SQLITE_CONTENT = """# conftest.py - Auto-injected universal database & test fixture initialization
import os
import sys
import pytest

# Ensure workspace root and common directories are always on sys.path
for _path in [os.getcwd(), '.', 'src', 'app']:
    if os.path.exists(_path) and _path not in sys.path:
        sys.path.insert(0, _path)

# ---------------------------------------------------------------------------
# AutoDev Universal SQLite Engine Interceptor:
# Automatically enforces check_same_thread=False and StaticPool for in-memory
# SQLite engines so that FastAPI TestClient worker threads share tables/state!
# ---------------------------------------------------------------------------
try:
    import sqlalchemy
    from sqlalchemy.pool import StaticPool

    if hasattr(sqlalchemy, 'create_engine') and not getattr(sqlalchemy.create_engine, '_autodev_patched', False):
        _orig_create_engine = sqlalchemy.create_engine
        def _autodev_create_engine(*args, **kwargs):
            url_str = str(args[0]) if args else str(kwargs.get('url', ''))
            if 'sqlite' in url_str.lower():
                cargs = kwargs.get('connect_args')
                if not isinstance(cargs, dict):
                    cargs = {}
                cargs['check_same_thread'] = False
                kwargs['connect_args'] = cargs
                if ':memory:' in url_str.lower() or url_str.strip() in ('sqlite://', 'sqlite:///', 'sqlite:///:memory:'):
                    kwargs['poolclass'] = StaticPool
            return _orig_create_engine(*args, **kwargs)
        _autodev_create_engine._autodev_patched = True
        sqlalchemy.create_engine = _autodev_create_engine
except Exception:
    pass

def _autodev_init_all_tables():
    \"\"\"
    Discovers all SQLAlchemy models and engines across candidate modules and sys.modules,
    guaranteeing that all database tables are created before pytest execution.
    \"\"\"
    try:
        import os, sys, importlib

        # Pre-import common module names to register ORM models and engines
        for candidate in ['models', 'database', 'main', 'app', 'db', 'schemas', 'app.models', 'app.database', 'app.main']:
            try:
                importlib.import_module(candidate)
            except Exception:
                pass

        # Also import any root or package .py files that might declare models or database connections
        try:
            for root, dirs, files in os.walk('.'):
                dirs[:] = [d for d in dirs if not d.startswith(('.', '__')) and d not in ('node_modules', 'venv', '.venv', 'dist', 'build')]
                for f in files:
                    if f.endswith('.py') and not f.startswith(('test_', 'conftest')):
                        rel = os.path.relpath(root, '.')
                        mod_name = f[:-3] if rel == '.' else os.path.join(rel, f[:-3]).replace(os.sep, '.')
                        try:
                            importlib.import_module(mod_name)
                        except Exception:
                            pass
        except Exception:
            pass

        engines = []
        metadatas = []

        SKIP_PREFIXES = ('pytest', '_pytest', 'unittest', 'cryptography', 'websockets', 'starlette', 'fastapi', 'pydantic', 'anyio', 'asyncio', 'http', 'urllib', 'email', 'encodings', 'importlib')
        for mod in list(sys.modules.values()):
            if not mod or not hasattr(mod, '__name__') or mod.__name__.startswith(SKIP_PREFIXES):
                continue
            for attr_name in dir(mod):
                try:
                    val = getattr(mod, attr_name)
                    # Check for SQLAlchemy Engine
                    if hasattr(val, 'connect') and hasattr(val, 'dispose') and hasattr(val, 'dialect'):
                        if val not in engines:
                            engines.append(val)
                    # Check for DeclarativeBase / Base / MetaData / SQLModel
                    if hasattr(val, 'metadata') and hasattr(val.metadata, 'create_all') and hasattr(val.metadata, 'tables'):
                        if val.metadata not in metadatas:
                            metadatas.append(val.metadata)
                    elif hasattr(val, 'create_all') and hasattr(val, 'tables'):
                        if val not in metadatas:
                            metadatas.append(val)
                except Exception:
                    pass

        # If metadatas exist but no engine was found, fallback to creating a default engine
        if metadatas and not engines:
            try:
                import sqlalchemy
                fallback_eng = sqlalchemy.create_engine('sqlite:///./app.db', connect_args={'check_same_thread': False})
                engines.append(fallback_eng)
            except Exception:
                pass

        for meta in metadatas:
            for eng in engines:
                try:
                    meta.create_all(bind=eng)
                except Exception:
                    pass
    except Exception:
        pass

# Initialize schema immediately at conftest load time
_autodev_init_all_tables()

@pytest.fixture(autouse=True, scope="session")
def _autodev_db_init_session():
    _autodev_init_all_tables()
    yield

@pytest.fixture(autouse=True, scope="function")
def _autodev_db_init_function():
    _autodev_init_all_tables()
    yield
""" + CONFTEST_FASTAPI_SERVICE_SYNC_BLOCK

CONFTEST_SQLITE_APPEND_BLOCK = """
# --- AutoDev Universal Database Fixture Injected ---
try:
    import os, sys
    for _path in [os.getcwd(), '.', 'src', 'app']:
        if os.path.exists(_path) and _path not in sys.path:
            sys.path.insert(0, _path)

    import sqlalchemy
    from sqlalchemy.pool import StaticPool

    if hasattr(sqlalchemy, 'create_engine') and not getattr(sqlalchemy.create_engine, '_autodev_patched', False):
        _orig_create_engine = sqlalchemy.create_engine
        def _autodev_create_engine(*args, **kwargs):
            url_str = str(args[0]) if args else str(kwargs.get('url', ''))
            if 'sqlite' in url_str.lower():
                cargs = kwargs.get('connect_args')
                if not isinstance(cargs, dict):
                    cargs = {}
                cargs['check_same_thread'] = False
                kwargs['connect_args'] = cargs
                if ':memory:' in url_str.lower() or url_str.strip() in ('sqlite://', 'sqlite:///', 'sqlite:///:memory:'):
                    kwargs['poolclass'] = StaticPool
            return _orig_create_engine(*args, **kwargs)
        _autodev_create_engine._autodev_patched = True
        sqlalchemy.create_engine = _autodev_create_engine
except Exception:
    pass

def _autodev_init_all_tables():
    try:
        import os, sys, importlib
        for candidate in ['models', 'database', 'main', 'app', 'db', 'schemas', 'app.models', 'app.database', 'app.main']:
            try:
                importlib.import_module(candidate)
            except Exception:
                pass
        try:
            for root, dirs, files in os.walk('.'):
                dirs[:] = [d for d in dirs if not d.startswith(('.', '__')) and d not in ('node_modules', 'venv', '.venv', 'dist', 'build')]
                for f in files:
                    if f.endswith('.py') and not f.startswith(('test_', 'conftest')):
                        rel = os.path.relpath(root, '.')
                        mod_name = f[:-3] if rel == '.' else os.path.join(rel, f[:-3]).replace(os.sep, '.')
                        try:
                            importlib.import_module(mod_name)
                        except Exception:
                            pass
        except Exception:
            pass

        engines, metadatas = [], []
        SKIP_PREFIXES = ('pytest', '_pytest', 'unittest', 'cryptography', 'websockets', 'starlette', 'fastapi', 'pydantic', 'anyio', 'asyncio', 'http', 'urllib', 'email', 'encodings', 'importlib')
        for mod in list(sys.modules.values()):
            if not mod or not hasattr(mod, '__name__') or mod.__name__.startswith(SKIP_PREFIXES):
                continue
            for attr_name in dir(mod):
                try:
                    val = getattr(mod, attr_name)
                    if hasattr(val, 'connect') and hasattr(val, 'dispose') and hasattr(val, 'dialect'):
                        if val not in engines:
                            engines.append(val)
                    if hasattr(val, 'metadata') and hasattr(val.metadata, 'create_all') and hasattr(val.metadata, 'tables'):
                        if val.metadata not in metadatas:
                            metadatas.append(val.metadata)
                    elif hasattr(val, 'create_all') and hasattr(val, 'tables'):
                        if val not in metadatas:
                            metadatas.append(val)
                except Exception:
                    pass

        if metadatas and not engines:
            try:
                import sqlalchemy
                fallback_eng = sqlalchemy.create_engine('sqlite:///./app.db', connect_args={'check_same_thread': False})
                engines.append(fallback_eng)
            except Exception:
                pass

        for meta in metadatas:
            for eng in engines:
                try:
                    meta.create_all(bind=eng)
                except Exception:
                    pass
    except Exception:
        pass

# Initialize schema immediately
_autodev_init_all_tables()

@pytest.fixture(autouse=True, scope="session")
def _autodev_db_init_session():
    _autodev_init_all_tables()
    yield

@pytest.fixture(autouse=True, scope="function")
def _autodev_db_init_function():
    _autodev_init_all_tables()
    yield
""" + CONFTEST_FASTAPI_SERVICE_SYNC_BLOCK

MAIN_PY_SQLITE_INIT = """
# AutoDev database schema initialization safeguard
try:
    import sys, os, importlib
    for _m in ['models', 'database', 'db', 'schemas', 'app.models', 'app.database']:
        try:
            importlib.import_module(_m)
        except Exception:
            pass
    _engs = []
    _metas = []
    for _mod in list(sys.modules.values()):
        if not _mod or not hasattr(_mod, '__name__') or _mod.__name__.startswith(('pytest', '_pytest', 'unittest')):
            continue
        for _attr in dir(_mod):
            try:
                _v = getattr(_mod, _attr)
                if hasattr(_v, 'connect') and hasattr(_v, 'dispose') and hasattr(_v, 'dialect'):
                    if _v not in _engs:
                        _engs.append(_v)
                if hasattr(_v, 'metadata') and hasattr(_v.metadata, 'create_all') and hasattr(_v.metadata, 'tables'):
                    if _v.metadata not in _metas:
                        _metas.append(_v.metadata)
                elif hasattr(_v, 'create_all') and hasattr(_v, 'tables'):
                    if _v not in _metas:
                        _metas.append(_v)
            except Exception:
                pass
    for _metadata in _metas:
        for _eng in _engs:
            try:
                _metadata.create_all(bind=_eng)
            except Exception:
                pass
except Exception:
    pass
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

def normalize_requirements_txt(content: str, uses_sqlalchemy: bool = False, uses_email_validator: bool = False) -> str:
    """
    Normalizes requirements.txt for Python testing pipelines:
    1. Ensures pytest, pytest-asyncio, and httpx (and sqlalchemy / email-validator if detected) are declared.
    2. Strips broken pins (e.g. 'pytest==', 'pytest>=', empty versions, invalid placeholders).
    3. Removes conflicting upper-bound pins (e.g. 'pytest-asyncio<0.18') that break asyncio_mode = auto.
    4. Preserves all other valid requirements, comments, and options.
    """
    if not content or not isinstance(content, str):
        base = "pytest\npytest-asyncio\nhttpx\n"
        if uses_sqlalchemy:
            base += "sqlalchemy\n"
        if uses_email_validator:
            base += "email-validator>=2.0.0\n"
        return base

    target_deps = {'pytest', 'pytest-asyncio', 'httpx'}
    if uses_sqlalchemy:
        target_deps.add('sqlalchemy')
    if uses_email_validator or 'emailstr' in content.lower() or 'email-validator' in content.lower() or 'pydantic[email]' in content.lower():
        target_deps.add('email-validator')
        uses_email_validator = True
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
    required_pkgs = ['pytest', 'pytest-asyncio', 'httpx']
    if uses_sqlalchemy:
        required_pkgs.append('sqlalchemy')
    if uses_email_validator:
        required_pkgs.append('email-validator>=2.0.0')
    for req in required_pkgs:
        req_canonical = re.sub(r'[-_.]+', '-', req.split('>=')[0].split('==')[0].split('<')[0]).strip().lower()
        if req_canonical not in seen_deps:
            output_lines.append(req)

    result = '\n'.join(output_lines)
    if content.endswith('\n') or content.strip():
        result += '\n'
    return result

PYTHON_DEPENDENCY_CONSTRAINTS = {
    "motor": {"pymongo": "<4.8"},
    "fastapi": {"python-multipart": "", "email-validator": ">=2.0.0"},
    "pydantic": {"email-validator": ">=2.0.0"},
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

    # Detect if SQLAlchemy or relational SQLite is used in the codebase
    uses_sqlalchemy = False
    for f in codebase.files:
        fn = (getattr(f, 'file_name', '') if hasattr(f, 'file_name') else f.get('file_name', '')).lower()
        fc = getattr(f, 'source_code', '') if hasattr(f, 'source_code') else f.get('source_code', '')
        if _norm(fn) == 'requirements.txt' and ('sqlalchemy' in fc.lower() or 'sqlmodel' in fc.lower()):
            uses_sqlalchemy = True
            break
        if fn.endswith('.py') and (
            'sqlalchemy' in fc or 'declarative_base' in fc or 'Base.metadata' in fc or 'Column(' in fc
            or 'create_engine' in fc or 'SessionLocal' in fc or 'sessionmaker' in fc or 'sqlite3' in fc
            or 'sqlmodel' in fc or 'DeclarativeBase' in fc
        ):
            uses_sqlalchemy = True
            break

    # Sanitize SQLite in-memory connections in source code if StaticPool is missing
    for file in codebase.files:
        fname = getattr(file, 'file_name', '') if hasattr(file, 'file_name') else file.get('file_name', '')
        if fname.lower().endswith('.py'):
            src = getattr(file, 'source_code', '') if hasattr(file, 'source_code') else file.get('source_code', '')
            if 'sqlite:///:memory:' in src and 'StaticPool' not in src:
                # Rewrite volatile sqlite:///:memory: to file-based sqlite:///./app.db to guarantee persistence across threads
                reconciled = src.replace('sqlite:///:memory:', 'sqlite:///./app.db')
                if hasattr(file, 'source_code'):
                    file.source_code = reconciled
                elif isinstance(file, dict):
                    file['source_code'] = reconciled

    # Detect if email validation or Pydantic EmailStr is used in the codebase
    uses_email_validator = False
    for f in codebase.files:
        fn = (getattr(f, 'file_name', '') if hasattr(f, 'file_name') else f.get('file_name', '')).lower()
        fc = getattr(f, 'source_code', '') if hasattr(f, 'source_code') else f.get('source_code', '')
        if _norm(fn) == 'requirements.txt' and ('email-validator' in fc.lower() or 'pydantic[email]' in fc.lower()):
            uses_email_validator = True
            break
        if fn.endswith('.py') and ('EmailStr' in fc or 'email_validator' in fc or 'validate_email' in fc):
            uses_email_validator = True
            break

    # If Python tests or Python files with tests or SQLAlchemy exist, inject or reconcile conftest.py
    if has_py_test_files or (has_py_files and tests_present) or uses_sqlalchemy:
        has_conftest = any(
            _norm(getattr(f, 'file_name', '') if hasattr(f, 'file_name') else f.get('file_name', '')) == 'conftest.py'
            for f in codebase.files
        )
        if not has_conftest:
            if CodeFileClass is not None:
                if isinstance(CodeFileClass, type) and issubclass(CodeFileClass, dict):
                    codebase.files.append({"file_name": "conftest.py", "source_code": CONFTEST_SQLITE_CONTENT})
                else:
                    codebase.files.append(CodeFileClass(file_name="conftest.py", source_code=CONFTEST_SQLITE_CONTENT))
        else:
            # Reconcile existing conftest.py to ensure universal interceptor & auto-init fixture are present
            for file in codebase.files:
                fname = getattr(file, 'file_name', '') if hasattr(file, 'file_name') else file.get('file_name', '')
                if _norm(fname) == 'conftest.py':
                    src = getattr(file, 'source_code', '') if hasattr(file, 'source_code') else file.get('source_code', '')
                    needed_blocks = []
                    if '_autodev_create_engine' not in src:
                        needed_blocks.append(CONFTEST_SQLITE_APPEND_BLOCK)
                    if '_autodev_shared_hybrid_client' not in src:
                        needed_blocks.append(CONFTEST_MOTOR_INTERCEPTOR_BLOCK)
                    if '_autodev_sync_fastapi_and_mocks' not in src:
                        needed_blocks.append(CONFTEST_FASTAPI_SERVICE_SYNC_BLOCK)
                    if needed_blocks:
                        reconciled = src.rstrip() + "\n\n" + "\n\n".join(needed_blocks)
                        if hasattr(file, 'source_code'):
                            file.source_code = reconciled
                        elif isinstance(file, dict):
                            file['source_code'] = reconciled

        # Reconcile main.py / app.py to include safe schema initialization if module-level create_all is omitted
        if uses_sqlalchemy:
            for file in codebase.files:
                fname = getattr(file, 'file_name', '') if hasattr(file, 'file_name') else file.get('file_name', '')
                if _norm(fname) in ['main.py', 'app.py']:
                    src = getattr(file, 'source_code', '') if hasattr(file, 'source_code') else file.get('source_code', '')
                    if 'AutoDev database schema initialization' not in src:
                        has_top_level_create_all = any(
                            not line.startswith((' ', '\t')) and 'create_all' in line
                            for line in src.splitlines()
                        )
                        if not has_top_level_create_all and ('Base' in src or 'engine' in src or 'database' in src or 'models' in src or 'app' in src):
                            reconciled = src.rstrip() + "\n" + MAIN_PY_SQLITE_INIT
                            if hasattr(file, 'source_code'):
                                file.source_code = reconciled
                            elif isinstance(file, dict):
                                file['source_code'] = reconciled

    # Normalize requirements.txt if Python tests or Python files with tests are present
    for file in codebase.files:
        fname = getattr(file, 'file_name', '') if hasattr(file, 'file_name') else file.get('file_name', '')
        if _norm(fname) == 'requirements.txt':
            if has_py_test_files or (tests_present and has_py_files) or uses_sqlalchemy or uses_email_validator:
                src = getattr(file, 'source_code', '') if hasattr(file, 'source_code') else file.get('source_code', '')
                normalized_src = normalize_requirements_txt(src, uses_sqlalchemy=uses_sqlalchemy, uses_email_validator=uses_email_validator)
                constrained_src = enforce_python_dependency_constraints(normalized_src)
                if constrained_src != src:
                    if hasattr(file, 'source_code'):
                        file.source_code = constrained_src
                    elif isinstance(file, dict):
                        file['source_code'] = constrained_src

    return codebase

