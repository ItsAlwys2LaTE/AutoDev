/**
 * AutoDev Monaco Runtime Guard and Patcher
 *
 * Prevents uncaught TypeError: Cannot read properties of null (reading 'getFullModelRange')
 * inside @monaco-editor/react.
 *
 * Mechanics:
 * In @monaco-editor/react's internal value synchronization effect:
 *   editor.getOption(EditorOption.readOnly)
 *     ? editor.setValue(value)
 *     : value !== editor.getValue() && (
 *         editor.executeEdits("", [{ range: editor.getModel().getFullModelRange(), text: value }])
 *       )
 *
 * If the editor model is transitioning, detached, or null, editor.getModel() returns null,
 * causing null.getFullModelRange() to throw an uncaught exception.
 *
 * This patcher guards:
 * 1. editor.getModel: returns a safe fallback dummy model if the underlying model is null.
 * 2. editor.executeEdits: safely skips execution if no real model is attached.
 * 3. monaco.editor.create and monaco.editor.createDiffEditor: wraps instances at creation time.
 */

import { loader } from '@monaco-editor/react';

export function createSafeDummyModel() {
  return {
    getFullModelRange: () => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    }),
    getValue: () => '',
    setValue: () => {},
    getLineCount: () => 1,
    getLineMaxColumn: () => 1,
    uri: { toString: () => '' },
    dispose: () => {},
  };
}

export function patchEditorInstance(editor: any): any {
  if (!editor || typeof editor !== 'object' || editor.__autoDevGuarded) {
    return editor;
  }
  editor.__autoDevGuarded = true;

  const originalGetModel = editor.getModel ? editor.getModel.bind(editor) : null;
  if (originalGetModel) {
    editor.getModel = () => {
      const model = originalGetModel();
      if (!model) {
        return createSafeDummyModel();
      }
      return model;
    };
  }

  const originalExecuteEdits = editor.executeEdits ? editor.executeEdits.bind(editor) : null;
  if (originalExecuteEdits) {
    editor.executeEdits = (source: string, edits: any[], endCursorState?: any) => {
      const model = originalGetModel ? originalGetModel() : null;
      if (!model) {
        return false;
      }
      return originalExecuteEdits(source, edits, endCursorState);
    };
  }

  return editor;
}

export function patchMonaco(monaco: any): void {
  if (!monaco || !monaco.editor || (monaco.editor as any).__autoDevPatched) {
    return;
  }
  (monaco.editor as any).__autoDevPatched = true;

  const originalCreate = monaco.editor.create.bind(monaco.editor);
  monaco.editor.create = (domElement: HTMLElement, options?: any, override?: any) => {
    const editor = originalCreate(domElement, options, override);
    patchEditorInstance(editor);
    return editor;
  };

  const originalCreateDiff = monaco.editor.createDiffEditor?.bind(monaco.editor);
  if (originalCreateDiff) {
    monaco.editor.createDiffEditor = (domElement: HTMLElement, options?: any, override?: any) => {
      const diffEditor = originalCreateDiff(domElement, options, override);
      try {
        if (diffEditor.getOriginalEditor) {
          patchEditorInstance(diffEditor.getOriginalEditor());
        }
        if (diffEditor.getModifiedEditor) {
          patchEditorInstance(diffEditor.getModifiedEditor());
        }
      } catch {
        // Suppress any retrieval errors
      }
      return diffEditor;
    };
  }
}

export const handleBeforeMount = (monaco: any): void => {
  patchMonaco(monaco);
};

// Eager initialization on window load
if (typeof window !== 'undefined') {
  try {
    loader.init().then((monaco) => {
      if (monaco) {
        patchMonaco(monaco);
      }
    }).catch(() => {
      // Background initialization failure handled gracefully
    });
  } catch {
    // Suppress environments where loader is not ready
  }
}
