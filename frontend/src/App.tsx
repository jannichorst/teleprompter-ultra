import { useState } from "react";
import { LayoutShell } from "./components/LayoutShell";
import { ScriptEditor } from "./components/ScriptEditor";
import { TeleprompterView } from "./components/TeleprompterView";
import { ControlsBar } from "./components/ControlsBar";
import { ApiKeyManager } from "./components/ApiKeyManager";
import { useTeleprompter } from "./hooks/useTeleprompter";

function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [state, controls] = useTeleprompter();

  if (!apiKey) {
    return <ApiKeyManager onSubmit={setApiKey} />;
  }

  const handleConnect = async () => {
    if (!apiKey) return;
    await controls.connect(apiKey);
  };

  return (
    <LayoutShell>
      <div className="flex w-full flex-col gap-4 md:w-1/3">
        <ScriptEditor value={state.script} onChange={controls.updateScript} />
        <ControlsBar
          fontSize={state.fontSize}
          onIncrease={controls.increaseFont}
          onDecrease={controls.decreaseFont}
          onFontChange={controls.setFontSize}
          onConnect={handleConnect}
          onDisconnect={controls.disconnect}
          onStartMic={controls.startMic}
          onStopMic={controls.stopMic}
          connected={state.connected}
          listening={state.listening}
          status={state.status}
        />
      </div>
      <div className="md:flex-1">
        <TeleprompterView script={state.script} transcript={state.transcript} fontSize={state.fontSize} />
      </div>
    </LayoutShell>
  );
}

export default App;
