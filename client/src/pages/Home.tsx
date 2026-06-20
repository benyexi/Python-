import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, RotateCcw, Code2, Zap, History, PanelRightClose, PanelRightOpen } from "lucide-react";
import CodeEditor from "@/components/CodeEditor";
import OutputPanel from "@/components/OutputPanel";
import HistoryPanel, { HistoryEntry } from "@/components/HistoryPanel";

declare global {
  interface Window {
    loadPyodide?: (options?: { indexURL?: string }) => Promise<PyodideRuntime>;
  }
}

type PyodideRuntime = {
  globals: {
    set: (name: string, value: unknown) => void;
    get: (name: string) => unknown;
    delete: (name: string) => void;
  };
  runPythonAsync: (code: string) => Promise<unknown>;
};

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

function loadPyodideScript() {
  if (window.loadPyodide) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-pyodide]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Pyodide")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `${PYODIDE_CDN}pyodide.js`;
    script.async = true;
    script.dataset.pyodide = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide"));
    document.head.appendChild(script);
  });
}

const CODE_EXAMPLES: Record<string, { label: string; code: string }> = {
  hello: {
    label: "Hello World",
    code: 'print("Hello, World!")\nprint("Welcome to PyExec!")',
  },
  fibonacci: {
    label: "Fibonacci",
    code: `def fibonacci(n):
    """Generate first n Fibonacci numbers"""
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib[:n]

result = fibonacci(15)
print("Fibonacci sequence:")
print(result)`,
  },
  sorting: {
    label: "Sorting",
    code: `import random

# Generate random list
numbers = [random.randint(1, 100) for _ in range(10)]
print(f"Original: {numbers}")

# Bubble sort implementation
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

sorted_nums = bubble_sort(numbers.copy())
print(f"Sorted:   {sorted_nums}")
print(f"Built-in: {sorted(numbers)}")`,
  },
  classes: {
    label: "Classes",
    code: `class Animal:
    def __init__(self, name, sound):
        self.name = name
        self.sound = sound
    
    def speak(self):
        return f"{self.name} says {self.sound}!"

class Dog(Animal):
    def __init__(self, name):
        super().__init__(name, "Woof")
    
    def fetch(self, item):
        return f"{self.name} fetches the {item}!"

class Cat(Animal):
    def __init__(self, name):
        super().__init__(name, "Meow")

# Create instances
dog = Dog("Rex")
cat = Cat("Whiskers")

print(dog.speak())
print(cat.speak())
print(dog.fetch("ball"))`,
  },
  listcomp: {
    label: "Comprehensions",
    code: `# List comprehension
squares = [x**2 for x in range(10)]
print(f"Squares: {squares}")

# Dict comprehension
word = "hello world"
char_count = {c: word.count(c) for c in set(word) if c != ' '}
print(f"Char count: {char_count}")

# Generator expression
total = sum(x**2 for x in range(100))
print(f"Sum of squares 0-99: {total}")

# Nested comprehension
matrix = [[i*3+j+1 for j in range(3)] for i in range(3)]
print(f"Matrix: {matrix}")
flat = [x for row in matrix for x in row]
print(f"Flattened: {flat}")`,
  },
  decorators: {
    label: "Decorators",
    code: `import time
from functools import wraps

def timer(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end-start:.4f}s")
        return result
    return wrapper

def retry(max_attempts=3):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    print(f"Attempt {attempt+1} failed: {e}")
            raise Exception(f"Failed after {max_attempts} attempts")
        return wrapper
    return decorator

@timer
def slow_function():
    total = sum(i**2 for i in range(100000))
    return total

@retry(max_attempts=3)
def risky_function():
    import random
    if random.random() < 0.7:
        raise ValueError("Random failure!")
    return "Success!"

result = slow_function()
print(f"Result: {result}")

try:
    print(risky_function())
except Exception as e:
    print(f"Final error: {e}")`,
  },
};

const DEFAULT_CODE = `# Welcome to PyExec! \u{1F40D}
# Write your Python code here and press Ctrl+Enter to run
# Try typing keywords for Tab autocomplete suggestions

print("Hello, World!")

# Try some Python features:
numbers = [1, 2, 3, 4, 5]
squared = [n**2 for n in numbers]
print(f"Numbers: {numbers}")
print(f"Squared: {squared}")
`;

export default function Home() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState("Python in browser");
  const pyodideRef = useRef<Promise<PyodideRuntime> | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem("pyexec-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);

  const getPyodide = useCallback(() => {
    if (!pyodideRef.current) {
      pyodideRef.current = (async () => {
        setRuntimeStatus("Loading Python runtime...");
        await loadPyodideScript();
        if (!window.loadPyodide) {
          throw new Error("Pyodide loader is unavailable");
        }
        const runtime = await window.loadPyodide({ indexURL: PYODIDE_CDN });
        setRuntimeStatus("Python ready");
        return runtime;
      })();
    }
    return pyodideRef.current;
  }, []);

  const saveHistoryEntry = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 50);
      try {
        localStorage.setItem("pyexec-history", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleRun = useCallback(async () => {
    if (!code.trim() || isRunning) return;

    setIsRunning(true);
    setStdout("");
    setStderr("");
    setExitCode(null);
    setHasRun(true);

    try {
      const pyodide = await getPyodide();
      pyodide.globals.set("USER_CODE", code);
      await pyodide.runPythonAsync(`
import contextlib
import io
import traceback

_stdout = io.StringIO()
_stderr = io.StringIO()
_exit_code = 0

try:
    with contextlib.redirect_stdout(_stdout), contextlib.redirect_stderr(_stderr):
        exec(USER_CODE, {})
except SystemExit as exc:
    _exit_code = exc.code if isinstance(exc.code, int) else 0
except Exception:
    _exit_code = 1
    traceback.print_exc(file=_stderr)

STDOUT = _stdout.getvalue()
STDERR = _stderr.getvalue()
EXIT_CODE = _exit_code
`);

      const result = {
        stdout: String(pyodide.globals.get("STDOUT") ?? ""),
        stderr: String(pyodide.globals.get("STDERR") ?? ""),
        exitCode: Number(pyodide.globals.get("EXIT_CODE") ?? 0),
        executionId: crypto.randomUUID(),
      };

      pyodide.globals.delete("USER_CODE");
      pyodide.globals.delete("STDOUT");
      pyodide.globals.delete("STDERR");
      pyodide.globals.delete("EXIT_CODE");

      setStdout(result.stdout);
      setStderr(result.stderr);
      setExitCode(result.exitCode);
      saveHistoryEntry({
        id: result.executionId,
        code,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStdout("");
      setStderr(message);
      setExitCode(1);
    } finally {
      setIsRunning(false);
    }
  }, [code, getPyodide, isRunning, saveHistoryEntry]);

  const handleClear = useCallback(() => {
    setCode("");
    setStdout("");
    setStderr("");
    setExitCode(null);
    setHasRun(false);
  }, []);

  const handleExampleSelect = useCallback((key: string) => {
    const example = CODE_EXAMPLES[key];
    if (example) {
      setCode(example.code);
      setStdout("");
      setStderr("");
      setExitCode(null);
      setHasRun(false);
    }
  }, []);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setCode(entry.code);
    setStdout(entry.stdout);
    setStderr(entry.stderr);
    setExitCode(entry.exitCode);
    setHasRun(true);
  }, []);

  const handleHistoryClear = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem("pyexec-history");
    } catch {}
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none scanlines opacity-30 z-50" />

      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-[oklch(0.14_0.01_250)] relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401618844/RrskRDxtp6dGqh9n9Sa3qc/logo-b4QBFERx4XMvDae7LNBh7n.webp"
              alt="PyExec Logo"
              className="w-7 h-7"
            />
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-primary glow-green-text">Py</span>
              <span className="text-foreground">Exec</span>
            </h1>
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded">
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Example selector */}
          <Select onValueChange={handleExampleSelect}>
            <SelectTrigger className="w-[140px] sm:w-[160px] h-8 text-xs bg-secondary border-border">
              <Code2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Examples" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CODE_EXAMPLES).map(([key, { label }]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* History toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className={`h-8 px-3 text-xs border-border hover:bg-secondary ${showHistory ? "bg-secondary text-primary" : ""}`}
          >
            {showHistory ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <History className="w-3.5 h-3.5" />
            )}
          </Button>

          {/* Clear button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="h-8 px-3 text-xs border-border hover:bg-secondary"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Clear</span>
          </Button>

          {/* Run button */}
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            className={`h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-160 active:scale-[0.97] ${
              !isRunning && code.trim() ? "animate-pulse-glow" : ""
            }`}
          >
            {isRunning ? (
              <>
                <Zap className="w-3.5 h-3.5 mr-1 animate-pulse" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1" />
                Run
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Editor + Output area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Editor panel */}
          <div className="flex-1 flex flex-col min-h-0 lg:min-w-0">
            <div className="flex items-center px-4 py-1.5 border-b border-border bg-[oklch(0.13_0.01_250)]">
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/60" />
                main.py
              </span>
              <span className="ml-auto text-xs text-muted-foreground/50 font-mono hidden sm:inline">
                Tab for autocomplete | Ctrl+Enter to run
              </span>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <CodeEditor value={code} onChange={setCode} onRun={handleRun} />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px lg:h-auto lg:w-px bg-border" />

          {/* Output panel */}
          <div className="h-[35%] lg:h-auto lg:w-[40%] min-h-[200px] lg:min-h-0 p-2">
            <OutputPanel
              stdout={stdout}
              stderr={stderr}
              isRunning={isRunning}
              exitCode={exitCode}
              hasRun={hasRun}
            />
          </div>
        </div>

        {/* History sidebar */}
        {showHistory && (
          <div className="w-[220px] border-l border-border bg-[oklch(0.13_0.01_250)] flex-shrink-0">
            <HistoryPanel
              entries={history}
              onSelect={handleHistorySelect}
              onClear={handleHistoryClear}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 sm:px-6 py-1.5 border-t border-border bg-[oklch(0.12_0.01_250)] relative z-10">
        <span className="text-[11px] text-muted-foreground/50 font-mono">
          {runtimeStatus} | Runs locally in your browser
        </span>
        <span className="text-[11px] text-muted-foreground/50 font-mono hidden sm:inline">
          Powered by PyExec
        </span>
      </footer>
    </div>
  );
}
