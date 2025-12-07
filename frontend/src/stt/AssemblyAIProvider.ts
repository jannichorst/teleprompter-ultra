import { SttProvider, TranscriptCallback } from "./SttProvider";

const SAMPLE_RATE = 16000;

export class AssemblyAIProvider implements SttProvider {
  status: "idle" | "connecting" | "connected" | "error" = "idle";
  private ws?: WebSocket;
  private transcriptCallback?: TranscriptCallback;
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private processor?: ScriptProcessorNode;
  private source?: MediaStreamAudioSourceNode;

  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  async connect(apiKey: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.status = "connecting";
    return new Promise((resolve, reject) => {
      const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${SAMPLE_RATE}&token=${encodeURIComponent(apiKey)}`;
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.status = "connected";
        socket.send(
          JSON.stringify({
            message_type: "start",
            sample_rate: SAMPLE_RATE,
            format: "pcm16",
          }),
        );
        resolve();
      };

      socket.onerror = (event) => {
        console.error("AssemblyAI socket error", event);
        this.status = "error";
        reject(event);
      };

      socket.onclose = () => {
        this.status = "idle";
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.message_type === "partial_transcript" || data.message_type === "final_transcript") {
            const text = data.text ?? data.transcript ?? "";
            if (text && this.transcriptCallback) {
              this.transcriptCallback(text);
            }
          }
        } catch (error) {
          console.error("Failed to parse transcript", error);
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.stopMic();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ terminate_session: true }));
      this.ws.close();
    }
    this.ws = undefined;
    this.status = "idle";
  }

  async startMic(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Connect to AssemblyAI before starting the microphone");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcmBuffer = new ArrayBuffer(inputData.length * 2);
      const pcmView = new DataView(pcmBuffer);
      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i];
        sample = Math.max(-1, Math.min(1, sample));
        pcmView.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(pcmBuffer);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  async stopMic(): Promise<void> {
    this.processor?.disconnect();
    this.source?.disconnect();
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }
    this.processor = undefined;
    this.source = undefined;
    this.audioContext = undefined;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
    }
  }
}
