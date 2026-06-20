import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, CompletionContext, CompletionResult, acceptCompletion, completionStatus } from "@codemirror/autocomplete";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";

// Python keywords and builtins for autocomplete
const PYTHON_KEYWORDS = [
  "False", "None", "True", "and", "as", "assert", "async", "await",
  "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield"
];

const PYTHON_BUILTINS = [
  "abs", "all", "any", "ascii", "bin", "bool", "breakpoint", "bytearray",
  "bytes", "callable", "chr", "classmethod", "compile", "complex",
  "delattr", "dict", "dir", "divmod", "enumerate", "eval", "exec",
  "filter", "float", "format", "frozenset", "getattr", "globals",
  "hasattr", "hash", "help", "hex", "id", "input", "int", "isinstance",
  "issubclass", "iter", "len", "list", "locals", "map", "max",
  "memoryview", "min", "next", "object", "oct", "open", "ord", "pow",
  "print", "property", "range", "repr", "reversed", "round", "set",
  "setattr", "slice", "sorted", "staticmethod", "str", "sum", "super",
  "tuple", "type", "vars", "zip"
];

const PYTHON_MODULES = [
  "os", "sys", "math", "random", "datetime", "json", "re", "collections",
  "itertools", "functools", "typing", "pathlib", "io", "string",
  "time", "copy", "operator", "decimal", "fractions", "statistics",
  "array", "heapq", "bisect", "queue", "threading", "subprocess",
  "hashlib", "base64", "urllib", "http", "socket", "email",
  "csv", "sqlite3", "pickle", "shelve", "dataclasses", "abc",
  "contextlib", "traceback", "logging", "unittest", "pdb"
];

const PYTHON_SNIPPETS = [
  { label: "def", detail: "function definition", apply: "def function_name():\n    pass" },
  { label: "class", detail: "class definition", apply: "class ClassName:\n    def __init__(self):\n        pass" },
  { label: "if __name__", detail: "main guard", apply: 'if __name__ == "__main__":\n    ' },
  { label: "for", detail: "for loop", apply: "for i in range():\n    " },
  { label: "while", detail: "while loop", apply: "while True:\n    break" },
  { label: "try", detail: "try/except block", apply: "try:\n    pass\nexcept Exception as e:\n    print(e)" },
  { label: "with", detail: "context manager", apply: 'with open("file.txt", "r") as f:\n    ' },
  { label: "lambda", detail: "lambda function", apply: "lambda x: x" },
  { label: "list_comp", detail: "list comprehension", apply: "[x for x in range(10)]" },
  { label: "dict_comp", detail: "dict comprehension", apply: "{k: v for k, v in items}" },
  { label: "print", detail: "print statement", apply: 'print("")' },
  { label: "import", detail: "import module", apply: "import " },
  { label: "from", detail: "from import", apply: "from  import " },
];

function pythonCompletion(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const options = [
    ...PYTHON_KEYWORDS.map(kw => ({ label: kw, type: "keyword" as const })),
    ...PYTHON_BUILTINS.map(b => ({ label: b, type: "function" as const, detail: "builtin" })),
    ...PYTHON_MODULES.map(m => ({ label: m, type: "namespace" as const, detail: "module" })),
    ...PYTHON_SNIPPETS.map(s => ({ label: s.label, type: "text" as const, detail: s.detail, apply: s.apply })),
  ];

  return {
    from: word.from,
    options,
    validFor: /^\w*$/,
  };
}

// Custom dark theme to match Terminal Noir
const terminalNoirTheme = EditorView.theme({
  "&": {
    backgroundColor: "oklch(0.14 0.01 250)",
    color: "oklch(0.88 0.005 250)",
  },
  ".cm-content": {
    caretColor: "oklch(0.82 0.18 160)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "oklch(0.82 0.18 160)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "oklch(0.82 0.18 160 / 0.15)",
  },
  ".cm-gutters": {
    backgroundColor: "oklch(0.13 0.01 250)",
    color: "oklch(0.45 0.01 250)",
    border: "none",
    borderRight: "1px solid oklch(0.22 0.01 250)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "oklch(0.17 0.012 250)",
    color: "oklch(0.82 0.18 160)",
  },
  ".cm-activeLine": {
    backgroundColor: "oklch(0.16 0.01 250 / 0.6)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "oklch(0.2 0.012 250)",
    border: "none",
    color: "oklch(0.6 0.01 250)",
  },
}, { dark: true });

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
}

export default function CodeEditor({ value, onChange, onRun }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const handleRun = useCallback(() => {
    if (onRun) onRun();
  }, [onRun]);

  useEffect(() => {
    if (!editorRef.current) return;

    const runKeymap = keymap.of([{
      key: "Ctrl-Enter",
      mac: "Cmd-Enter",
      run: () => {
        handleRun();
        return true;
      },
    }]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        closeBrackets(),
        python(),
        terminalNoirTheme,
        oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        autocompletion({
          override: [pythonCompletion],
          activateOnTyping: true,
          maxRenderedOptions: 20,
        }),
        keymap.of([
          // Tab: accept completion if active, otherwise indent
          {
            key: "Tab",
            run: (view) => {
              if (completionStatus(view.state) === "active") {
                return acceptCompletion(view);
              }
              return indentWithTab.run!(view);
            },
          },
          indentWithTab,
          ...defaultKeymap,
        ]),
        runKeymap,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
        EditorState.tabSize.of(4),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update editor content when value changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-hidden rounded-lg border border-border"
    />
  );
}
