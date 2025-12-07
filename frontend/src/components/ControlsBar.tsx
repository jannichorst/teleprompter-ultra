import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Mic, MicOff, PlugZap, PlugZapOff, Plus, Minus } from "lucide-react";

interface ControlsBarProps {
  fontSize: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onFontChange: (value: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartMic: () => void;
  onStopMic: () => void;
  connected: boolean;
  listening: boolean;
  status: string;
}

export function ControlsBar({
  fontSize,
  onIncrease,
  onDecrease,
  onFontChange,
  onConnect,
  onDisconnect,
  onStartMic,
  onStopMic,
  connected,
  listening,
  status,
}: ControlsBarProps) {
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
        {connected ? (
          <Button onClick={onDisconnect} variant="outline">
            <PlugZapOff className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        ) : (
          <Button onClick={onConnect} variant="outline">
            <PlugZap className="mr-2 h-4 w-4" /> Connect
          </Button>
        )}
        {listening ? (
          <Button onClick={onStopMic}>
            <MicOff className="mr-2 h-4 w-4" /> Stop mic
          </Button>
        ) : (
          <Button onClick={onStartMic}>
            <Mic className="mr-2 h-4 w-4" /> Start mic
          </Button>
        )}
      </div>
      <p className="ml-auto text-xs text-slate-400">Status: {status}</p>
    </div>
  );
}
