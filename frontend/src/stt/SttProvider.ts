export type TranscriptCallback = (text: string) => void;

export interface SttProvider {
  status: "idle" | "connecting" | "connected" | "error";
  connect(apiKey: string): Promise<void>;
  disconnect(): Promise<void>;
  startMic(): Promise<void>;
  stopMic(): Promise<void>;
  onTranscript(callback: TranscriptCallback): void;
}
