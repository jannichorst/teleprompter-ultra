import { FormEvent, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { clearApiKey, loadApiKey, saveApiKey } from "../lib/crypto";
import { Dialog } from "./ui/dialog";

interface ApiKeyManagerProps {
  onSubmit: (apiKey: string) => void;
}

export function ApiKeyManager({ onSubmit }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [loadingStoredKey, setLoadingStoredKey] = useState(true);

  useEffect(() => {
    loadApiKey()
      .then((key) => {
        if (key) {
          setApiKey(key);
          setRemember(true);
        }
      })
      .finally(() => setLoadingStoredKey(false));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!apiKey) return;

    if (remember) {
      await saveApiKey(apiKey);
    } else {
      clearApiKey();
    }
    onSubmit(apiKey);
  };

  if (loadingStoredKey) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-300">Loading secure storage...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl space-y-6 rounded-lg border border-slate-800 bg-slate-950 p-6 shadow-lg">
        <div>
          <h1 className="text-2xl font-semibold">Enter your AssemblyAI API key</h1>
          <p className="text-sm text-slate-400">
            Your key never leaves the browser. You can optionally encrypt it in localStorage for convenience.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <Input
              required
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="assemblyai-api-key"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Encrypt in this browser</p>
              <p className="text-xs text-slate-400">Stored locally using Web Crypto. Toggle off to keep in memory only.</p>
            </div>
            <Switch checked={remember} onCheckedChange={setRemember} />
          </div>
          <Button type="submit" className="w-full text-slate-950">
            Continue
          </Button>
        </form>
        <button
          type="button"
          className="text-xs text-slate-400 underline"
          onClick={() => setShowInfo(true)}
        >
          Why do I need to bring my own key?
        </button>
      </div>
      <Dialog
        open={showInfo}
        onOpenChange={setShowInfo}
        title="Bring your own API key"
        description="To keep your credentials safe, the app never proxies or stores your AssemblyAI key on a server."
      >
        <p className="text-sm text-slate-200">
          Your API key is used directly from your browser to connect to AssemblyAI's realtime WebSocket API. You can store it
          temporarily in encrypted localStorage for convenience, but every session runs fully client-side.
        </p>
      </Dialog>
    </div>
  );
}
