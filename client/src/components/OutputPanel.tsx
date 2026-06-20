import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, AlertCircle, CheckCircle2 } from "lucide-react";

interface OutputPanelProps {
  stdout: string;
  stderr: string;
  isRunning: boolean;
  exitCode: number | null;
  hasRun: boolean;
}

export default function OutputPanel({ stdout, stderr, isRunning, exitCode, hasRun }: OutputPanelProps) {
  return (
    <div className="h-full flex flex-col bg-[oklch(0.12_0.01_250)] rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-[oklch(0.14_0.01_250)]">
        <Terminal className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium font-mono text-muted-foreground">Output</span>
        {hasRun && exitCode !== null && (
          <div className="ml-auto flex items-center gap-1.5">
            {exitCode === 0 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-primary font-mono">exit 0</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs text-destructive font-mono">exit {exitCode}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Output content */}
      <ScrollArea className="flex-1 p-4">
        {isRunning ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-mono text-muted-foreground">Running...</span>
          </div>
        ) : !hasRun ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Terminal className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground/60 font-mono">
              Press <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs text-primary">Ctrl+Enter</kbd> to run
            </p>
          </div>
        ) : (
          <div className="space-y-2 font-mono text-sm">
            {stdout && (
              <pre className="whitespace-pre-wrap break-words text-foreground leading-relaxed">
                {stdout}
              </pre>
            )}
            {stderr && (
              <pre className="whitespace-pre-wrap break-words text-destructive leading-relaxed">
                {stderr}
              </pre>
            )}
            {!stdout && !stderr && exitCode === 0 && (
              <span className="text-muted-foreground italic">No output</span>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
