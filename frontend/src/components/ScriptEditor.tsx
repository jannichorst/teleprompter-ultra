import { Textarea } from "./ui/textarea";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ScriptEditor({ value, onChange }: ScriptEditorProps) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 shadow-inner">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Script</h2>
          <p className="text-xs text-slate-400">Paste your talking points or script.</p>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[300px] flex-1 resize-none bg-slate-900"
        placeholder="Type your script here..."
      />
    </div>
  );
}
