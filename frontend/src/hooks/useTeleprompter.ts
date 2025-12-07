import { useEffect, useMemo, useState } from "react";
import { AssemblyAIProvider } from "../stt/AssemblyAIProvider";
import { SttProvider } from "../stt/SttProvider";

type TeleprompterState = {
  script: string;
  transcript: string;
  fontSize: number;
  connected: boolean;
  listening: boolean;
  status: "idle" | "connecting" | "connected" | "error";
};

type TeleprompterControls = {
  updateScript: (value: string) => void;
  increaseFont: () => void;
  decreaseFont: () => void;
  setFontSize: (value: number) => void;
  connect: (apiKey: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startMic: () => Promise<void>;
  stopMic: () => Promise<void>;
};

export function useTeleprompter() {
  const [script, setScript] = useState("Paste or type your script here...");
  const [transcript, setTranscript] = useState("");
  const [fontSize, setFontSize] = useState(32);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<SttProvider["status"]>("idle");

  const provider: SttProvider = useMemo(() => new AssemblyAIProvider(), []);

  useEffect(() => {
    provider.onTranscript((text) => setTranscript(text));
  }, [provider]);

  const increaseFont = () => setFontSize((size) => Math.min(size + 4, 72));
  const decreaseFont = () => setFontSize((size) => Math.max(size - 4, 16));
  const setFontSizeValue = (value: number) => setFontSize(() => Math.min(Math.max(value, 16), 72));

  const connect = async (apiKey: string) => {
    setStatus("connecting");
    await provider.connect(apiKey);
    setStatus(provider.status);
  };

  const disconnect = async () => {
    await provider.disconnect();
    setStatus(provider.status);
    setListening(false);
  };

  const startMic = async () => {
    await provider.startMic();
    setListening(true);
  };

  const stopMic = async () => {
    await provider.stopMic();
    setListening(false);
  };

  const state: TeleprompterState = {
    script,
    transcript,
    fontSize,
    connected: status === "connected",
    listening,
    status,
  };

  const controls: TeleprompterControls = {
    updateScript: setScript,
    increaseFont,
    decreaseFont,
    setFontSize: setFontSizeValue,
    connect,
    disconnect,
    startMic,
    stopMic,
  };

  return [state, controls] as const;
}
