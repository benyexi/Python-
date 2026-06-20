import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { History, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

export interface HistoryEntry {
  id: string;
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: number;
}

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export default function HistoryPanel({ entries, onSelect, onClear }: HistoryPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center">
        <History className="w-6 h-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground/50 font-mono">No history yet</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          History ({entries.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="w-full text-left p-2 rounded-md bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all duration-150 group"
            >
              <div className="flex items-center gap-1.5 mb-1">
                {entry.exitCode === 0 ? (
                  <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                )}
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <pre className="text-[11px] text-foreground/80 font-mono truncate leading-tight">
                {entry.code.split("\n")[0]?.slice(0, 40) || "..."}
              </pre>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
