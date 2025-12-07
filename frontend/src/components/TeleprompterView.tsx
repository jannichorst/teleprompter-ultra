import { useRef, useState } from "react";
import { cn } from "../lib/utils";
import { enterFullscreen, exitFullscreen, isFullscreenElement } from "../lib/fullscreen";
import { Button } from "./ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

interface TeleprompterViewProps {
  script: string;
  transcript: string;
  fontSize: number;
}

export function TeleprompterView({ script, transcript, fontSize }: TeleprompterViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = () => {
    const node = containerRef.current;
    if (!node) return;

    if (isFullscreenElement(node)) {
      exitFullscreen();
      setFullscreen(false);
    } else {
      enterFullscreen(node);
      setFullscreen(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-lg"
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/20" />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Teleprompter</p>
          <p className="text-sm text-slate-400">Live transcript shows below as you speak.</p>
        </div>
        <Button variant="ghost" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
      <div className="relative mt-6 flex h-[70vh] flex-col items-center justify-center text-center">
        <div className="space-y-6">
          <p
            className={cn(
              "font-semibold leading-relaxed text-slate-100",
              fullscreen ? "md:max-w-5xl" : "md:max-w-3xl",
            )}
            style={{ fontSize }}
          >
            {script || "Waiting for your script..."}
          </p>
          <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-left text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Live transcript</p>
            <p className="mt-1 leading-relaxed text-slate-50">{transcript || "Say something to see it here."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
