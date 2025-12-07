import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Mic, MicOff, Plus, Minus } from "lucide-react";

interface ControlsBarProps {
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onFontChange: (value: number) => void;
  onStartMic: () => void;
  onStopMic: () => void;
  connected: boolean;
  listening: boolean;
  status: string;
  micDevice?: string;
  micLevel?: number;
  latency?: number | null;
}

export function ControlsBar({
  fontSize,
  onIncrease,
  onDecrease,
  onFontChange,
  onStartMic,
  onStopMic,
  connected,
  listening,
  status,
  micDevice,
  micLevel = 0,
  latency,
}: ControlsBarProps) {
  // Use normalized level directly (0-1, already normalized)
  const micLevelPercent = Math.min(100, Math.max(0, micLevel * 100));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex items-center gap-2">
        <Button onClick={onDecrease} variant="outline" aria-label="Decrease font size">
          <Minus className="h-4 w-4" />
        </Button>
        <Slider
          value={fontSize}
          min={16}
          max={72}
          step={2}
          onValueChange={onFontChange}
          className="hidden sm:block"
        />
        <Button onClick={onIncrease} variant="outline" aria-label="Increase font size">
          <Plus className="h-4 w-4" />
        </Button>
        <span className="text-sm text-slate-400">{fontSize}px</span>
      </div>
      <div className="flex items-center gap-2">
        {listening ? (
          <Button onClick={onStopMic}>
            <MicOff className="mr-2 h-4 w-4" /> Stop transcription
          </Button>
        ) : (
          <Button onClick={onStartMic} disabled={!connected}>
            <Mic className="mr-2 h-4 w-4" /> Start transcription
          </Button>
        )}
      </div>
      {micDevice && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Mic className="h-3 w-3" />
          <span className="max-w-[200px] truncate" title={micDevice}>
            {micDevice}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="h-2 w-20 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-slate-400 transition-all duration-300 ease-out will-change-[width]"
            style={{ width: `${micLevelPercent}%` }}
          />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {latency !== null && (
          <span className="text-xs text-slate-400">
            Latency: {latency}ms
          </span>
        )}
        <p className="text-xs text-slate-400">Status: {status}</p>
      </div>
    </div>
  );
}
