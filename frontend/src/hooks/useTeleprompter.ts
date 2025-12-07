import { useEffect, useMemo, useRef, useState } from "react";
import { AssemblyAIProvider } from "../stt/AssemblyAIProvider";
import { SttProvider } from "../stt/SttProvider";
import { useScriptMatcher } from "./useScriptMatcher";

type TeleprompterState = {
  script: string;
  transcript: string;
  fontSize: number;
  connected: boolean;
  listening: boolean;
  status: "idle" | "connecting" | "connected" | "error";
  micDevice?: string;
  micLevel: number;
  latency: number | null;
  currentWordIndex: number;
  isFollowing: boolean;
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
  const [script, setScript] = useState(`Welcome to this quick teleprompter test. The goal of this script is simple: to help you check timing, readability, and how smoothly your eyes move across the screen. As you read, pay attention to your breathing and rhythm. If anything feels too fast or too slow, adjust the scroll speed until the flow feels natural and effortless.

A good teleprompter setup should almost disappear. You want the words to guide you, not distract you. Notice how your posture changes, how clearly you're articulating each phrase, and whether your gaze stays steady. These small details can make a big difference in how confident and polished your delivery appears on camera.

Finally, try experimenting with emphasis. Highlight a sentence in your mind, slow down for another, and practice adding emotion without losing track of the text. Once you feel comfortable, you can swap this script for your own. Until then, use this short test to find your ideal settings and get fully warmed up.`);
  const [transcript, setTranscript] = useState("");
  const [fontSize, setFontSize] = useState(32);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<SttProvider["status"]>("idle");
  const [micDevice, setMicDevice] = useState<string | undefined>();
  const [micLevel, setMicLevel] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const micLevelRef = useRef(0);
  const updateTimerRef = useRef<number | null>(null);

  const provider: SttProvider = useMemo(() => new AssemblyAIProvider(), []);
  
  // Script matcher for auto-scroll
  const {
    currentWordIndex,
    isActive: isFollowing,
    processTranscript,
    setScript: setMatcherScript,
    reset: resetMatcher,
  } = useScriptMatcher();

  // Request mic permission and start monitoring on mount
  useEffect(() => {
    // Request mic permission and start monitoring immediately
    if ("startMicMonitoring" in provider) {
      (provider as AssemblyAIProvider).startMicMonitoring().catch((error) => {
        console.error("Failed to start mic monitoring:", error);
      });
    }
  }, [provider]);

  // Update matcher when script changes
  useEffect(() => {
    setMatcherScript(script);
  }, [script, setMatcherScript]);

  // Process transcript through matcher
  useEffect(() => {
    if (transcript && listening) {
      processTranscript(transcript);
    }
  }, [transcript, listening, processTranscript]);

  useEffect(() => {
    provider.onTranscript((text) => {
      console.log("Transcript received:", text); // Debug log
      setTranscript(text);
    });
    
    // Set up audio level callback with throttled updates
    if ("onAudioLevel" in provider) {
      (provider as AssemblyAIProvider).onAudioLevel((level) => {
        // Store the latest value
        micLevelRef.current = level;
        
        // Throttle React state updates using requestAnimationFrame for smooth 60fps updates
        if (updateTimerRef.current === null) {
          updateTimerRef.current = window.requestAnimationFrame(() => {
            setMicLevel(micLevelRef.current);
            updateTimerRef.current = null;
          });
        }
      });
    }
    
    // Set up mic device callback
    if ("onMicDevice" in provider) {
      (provider as AssemblyAIProvider).onMicDevice((device) => {
        setMicDevice(device || undefined);
      });
    }
    
    // Set up latency callback
    if ("onLatency" in provider) {
      (provider as AssemblyAIProvider).onLatency((latencyMs) => {
        setLatency(latencyMs);
      });
    }
    
    // Periodically sync status to catch any changes (e.g., WebSocket closing)
    const statusSyncInterval = setInterval(() => {
      setStatus((currentStatus) => {
        if (provider.status !== currentStatus) {
          console.log(`Status sync: React state "${currentStatus}" -> Provider state "${provider.status}"`);
          return provider.status;
        }
        return currentStatus;
      });
    }, 500); // Check every 500ms
    
    return () => {
      clearInterval(statusSyncInterval);
      // Cleanup: cancel any pending animation frame
      if (updateTimerRef.current !== null) {
        window.cancelAnimationFrame(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [provider]);

  const increaseFont = () => setFontSize((size) => Math.min(size + 4, 72));
  const decreaseFont = () => setFontSize((size) => Math.max(size - 4, 16));
  const setFontSizeValue = (value: number) => setFontSize(() => Math.min(Math.max(value, 16), 72));

  const connect = async (apiKey: string) => {
    setStatus("connecting");
    try {
      await provider.connect(apiKey);
      // Ensure we get the latest status after connection
      setStatus(provider.status);
      // Double-check the provider is actually ready
      if ("isReady" in provider && !(provider as AssemblyAIProvider).isReady()) {
        console.warn("Connection completed but provider is not ready");
        setStatus("error");
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus(provider.status || "error");
    }
  };

  const disconnect = async () => {
    await provider.disconnect();
    setStatus(provider.status);
    setListening(false);
  };

  const startMic = async () => {
    try {
      // Always check the provider's actual status before attempting to start
      const currentStatus = provider.status;
      if (currentStatus !== "connected") {
        console.warn(`Provider status is "${currentStatus}", not "connected". Syncing state.`);
        setStatus(currentStatus);
        throw new Error(`Cannot start microphone: connection status is "${currentStatus}". Please connect first.`);
      }
      
      // Double-check readiness
      if ("isReady" in provider && !(provider as AssemblyAIProvider).isReady()) {
        const actualStatus = provider.status;
        setStatus(actualStatus);
        throw new Error(`Cannot start microphone: WebSocket is not ready. Status: "${actualStatus}"`);
      }
      
      await provider.startMic();
      setListening(true);
      // Reset the matcher when starting transcription
      resetMatcher();
      // Update status after successful start to ensure sync
      setStatus(provider.status);
    } catch (error) {
      console.error("Failed to start microphone:", error);
      // Sync status from provider
      setStatus(provider.status);
      // Don't set listening to true if mic start failed
    }
  };

  const stopMic = async () => {
    // Stop transcription but keep monitoring
    if ("stopTranscription" in provider) {
      await (provider as AssemblyAIProvider).stopTranscription();
    } else {
      await provider.stopMic();
    }
    setListening(false);
  };

  const state: TeleprompterState = {
    script,
    transcript,
    fontSize,
    connected: status === "connected",
    listening,
    status,
    micDevice,
    micLevel,
    latency,
    currentWordIndex,
    isFollowing: isFollowing && listening,
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
