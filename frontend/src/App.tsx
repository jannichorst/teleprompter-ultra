import { useEffect, useState } from "react";
import { LayoutShell } from "./components/LayoutShell";
import { ScriptEditor } from "./components/ScriptEditor";
import { TeleprompterView } from "./components/TeleprompterView";
import { ControlsBar } from "./components/ControlsBar";
import { ApiKeyManager } from "./components/ApiKeyManager";
import { useTeleprompter } from "./hooks/useTeleprompter";

function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [state, controls] = useTeleprompter();

  // Auto-connect when API key is available
  useEffect(() => {
    if (apiKey && !state.connected && state.status === "idle") {
      controls.connect(apiKey).catch((error) => {
        console.error("Auto-connect failed:", error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  if (!apiKey) {
    return <ApiKeyManager onSubmit={setApiKey} />;
  }

  return (
    <LayoutShell>
      <div className="flex w-full flex-col gap-4 md:w-1/3 min-h-0">
        <ScriptEditor value={state.script} onChange={controls.updateScript} />
        <ControlsBar
          fontSize={state.fontSize}
          onIncrease={controls.increaseFont}
          onDecrease={controls.decreaseFont}
          onFontChange={controls.setFontSize}
          onStartMic={controls.startMic}
          onStopMic={controls.stopMic}
          connected={state.connected}
          listening={state.listening}
          status={state.status}
          micDevice={state.micDevice}
          micLevel={state.micLevel}
          latency={state.latency}
        />
      </div>
      <div className="flex flex-col gap-4 md:flex-1 min-h-0">
        <TeleprompterView 
          script={state.script} 
          transcript={state.transcript} 
          fontSize={state.fontSize}
          currentWordIndex={state.currentWordIndex}
          isFollowing={state.isFollowing}
        />
      </div>
    </LayoutShell>
  );
}

export default App;
