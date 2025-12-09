import { SttProvider, TranscriptCallback } from "./SttProvider";

const SAMPLE_RATE = 16000;

export type AudioLevelCallback = (level: number) => void;
export type MicDeviceCallback = (device: string) => void;
export type LatencyCallback = (latencyMs: number) => void;

export class AssemblyAIProvider implements SttProvider {
  status: "idle" | "connecting" | "connected" | "error" = "idle";
  private ws?: WebSocket;
  private transcriptCallback?: TranscriptCallback;
  private audioLevelCallback?: AudioLevelCallback;
  private micDeviceCallback?: MicDeviceCallback;
  private latencyCallback?: LatencyCallback;
  private audioSendTimes: number[] = []; // Track recent audio send times for latency calculation
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private audioWorkletNode?: AudioWorkletNode;
  private processor?: ScriptProcessorNode;
  private source?: MediaStreamAudioSourceNode;
  private audioBufferQueue: Int16Array = new Int16Array(0);
  private pendingTurns: Map<number, string> = new Map();
  private nextTurnToDeliver = 0;
  private transcriptSoFar = "";
  private isMonitoringOnly: boolean = false; // True when just monitoring, not sending to AssemblyAI
  private minLevel: number = Infinity; // For dynamic normalization
  private maxLevel: number = 0; // For dynamic normalization
  private levelHistory: number[] = []; // Keep recent levels for normalization
  private smoothedLevel: number = 0; // Exponential moving average for smooth display

  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  onAudioLevel(callback: AudioLevelCallback): void {
    this.audioLevelCallback = callback;
  }

  onMicDevice(callback: MicDeviceCallback): void {
    this.micDeviceCallback = callback;
  }

  onLatency(callback: LatencyCallback): void {
    this.latencyCallback = callback;
  }

  isReady(): boolean {
    return this.status === "connected" && this.ws !== undefined && this.ws.readyState === WebSocket.OPEN;
  }

  // Normalize audio level dynamically based on recent history
  private normalizeLevel(rawLevel: number): number {
    // Add to history (keep last 100 samples)
    this.levelHistory.push(rawLevel);
    if (this.levelHistory.length > 100) {
      this.levelHistory.shift();
    }

    // Update min/max from history
    if (this.levelHistory.length > 10) {
      // Only normalize after we have some data
      const sorted = [...this.levelHistory].sort((a, b) => a - b);
      // Use 10th percentile as min, 90th percentile as max (more robust than absolute min/max)
      const minIdx = Math.floor(sorted.length * 0.1);
      const maxIdx = Math.floor(sorted.length * 0.9);
      this.minLevel = sorted[minIdx] || 0;
      this.maxLevel = sorted[maxIdx] || 0.1; // Default to 0.1 if no max
    } else {
      // Initial values
      this.minLevel = Math.min(this.minLevel, rawLevel);
      this.maxLevel = Math.max(this.maxLevel, rawLevel || 0.1);
    }

    // Normalize to 0-1 range
    const range = this.maxLevel - this.minLevel;
    if (range < 0.001) {
      // Very small range, just return scaled value
      return Math.min(1, rawLevel * 10);
    }

    const normalized = (rawLevel - this.minLevel) / range;
    // Clamp and apply some amplification for visibility
    const clamped = Math.min(1, Math.max(0, normalized * 1.2));
    
    // Apply exponential moving average for smoothing (alpha = 0.15 for slow, smooth changes)
    const alpha = 0.15;
    this.smoothedLevel = alpha * clamped + (1 - alpha) * this.smoothedLevel;
    
    return this.smoothedLevel;
  }

  async connect(apiKey: string): Promise<void> {
    // If already connected, return early
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.status === "connected") {
      return;
    }

    // Clean up any existing connection
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.status = "connecting";

    return new Promise(async (resolve, reject) => {
      try {
        // Try to get a token - first try using API key directly as token (may work for some setups)
        let token = apiKey;

        // Use v3 endpoint with token parameter (matching the example)
        const endpoint = `wss://streaming.assemblyai.com/v3/ws?sample_rate=${SAMPLE_RATE}&token=${encodeURIComponent(token)}`;
        const socket = new WebSocket(endpoint);
        socket.binaryType = "arraybuffer";
        this.ws = socket;

        let resolved = false;
        let connectionTimeout: number | undefined;

        socket.onopen = () => {
          if (!resolved) {
            resolved = true;
            if (connectionTimeout) clearTimeout(connectionTimeout);
            this.status = "connected";
            resolve();
          }
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === "Turn") {
              const { turn_order, transcript } = msg;
              if (typeof turn_order === "number" && transcript) {
                if (this.nextTurnToDeliver === 0) {
                  this.nextTurnToDeliver = turn_order;
                }

                this.pendingTurns.set(turn_order, transcript);
                this.flushTurns();
              } else if (transcript) {
                this.transcriptSoFar = transcript;
                this.reportLatency();
                this.transcriptCallback?.(transcript);
              }
            } else if (msg.type === "Begin") {
            } else if (msg.type === "Error") {
              const errorMsg = msg.error || "Unknown error";
              console.error("AssemblyAI error:", errorMsg, msg);
              this.status = "error";
              if (!resolved) {
                resolved = true;
                if (connectionTimeout) clearTimeout(connectionTimeout);
                reject(new Error(`AssemblyAI error: ${errorMsg}`));
              }
            }
          } catch (error) {
            console.error("❌ Error parsing message:", error, "Raw data:", event.data);
          }
        };

        socket.onerror = (err) => {
          console.error("WebSocket error:", err);
          if (connectionTimeout) clearTimeout(connectionTimeout);
          this.status = "error";
          if (!resolved) {
            resolved = true;
            reject(new Error("WebSocket connection error"));
          }
        };

        socket.onclose = (event) => {
          if (connectionTimeout) clearTimeout(connectionTimeout);
          console.log(`WebSocket closed: Code=${event.code}, Reason=${event.reason}`);
          
          if (event.code === 4001 || event.reason?.toLowerCase().includes("not authorized") || event.reason?.toLowerCase().includes("unauthorized")) {
            this.status = "error";
            if (!resolved) {
              resolved = true;
              reject(new Error("Authentication failed. Please verify your AssemblyAI API key is correct. Note: You may need a backend endpoint to generate temporary tokens for browser use."));
            }
            return;
          }

          if (this.status === "connected") {
            this.status = "error";
          } else if (this.status === "connecting" && !resolved) {
            this.status = "error";
            resolved = true;
            reject(new Error(`Connection failed: ${event.reason || `code ${event.code}`}`));
          } else if (this.status !== "connecting") {
            this.status = "idle";
          }
        };

        connectionTimeout = window.setTimeout(() => {
          if (!resolved && this.status === "connecting") {
            resolved = true;
            reject(new Error("Connection timeout"));
          }
        }, 10000);
      } catch (error: any) {
        this.status = "error";
        reject(new Error(`Connection failed: ${error?.message || "Unknown error"}`));
      }
    });
  }

  async disconnect(): Promise<void> {
    this.stopTranscription();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "Terminate" }));
      } catch (error) {
        // Ignore errors
      }
      this.ws.close();
    }
    this.ws = undefined;
    this.pendingTurns.clear();
    this.nextTurnToDeliver = 0;
    this.transcriptSoFar = "";
    this.status = "idle";
  }

  // Start monitoring mic (for level indicator, not sending to AssemblyAI)
  async startMicMonitoring(): Promise<void> {
    if (this.stream) {
      return; // Already monitoring
    }

    // Get microphone stream
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Get microphone device label
    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      const deviceLabel = track.label || "Default Microphone";
      if (this.micDeviceCallback) {
        this.micDeviceCallback(deviceLabel);
      }
    }
    
    this.audioContext = new AudioContext({
      sampleRate: SAMPLE_RATE,
      latencyHint: "interactive",
    });
    await this.audioContext.resume();

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.isMonitoringOnly = true;
    
    // Setup audio processing for monitoring
    await this.setupAudioProcessing();
  }

  async startMic(): Promise<void> {
    if (!this.isReady()) {
      const statusMsg = this.status !== "connected" 
        ? `Connection status is "${this.status}"` 
        : "WebSocket is not open";
      throw new Error(`Cannot start transcription: ${statusMsg}. Please connect first.`);
    }

    // If not already monitoring, start monitoring first
    if (!this.stream) {
      await this.startMicMonitoring();
    }
    
    // Now enable sending to AssemblyAI
    this.isMonitoringOnly = false;
  }

  // Stop transcription but keep monitoring
  async stopTranscription(): Promise<void> {
    this.isMonitoringOnly = true;
    // Don't stop the stream, just stop sending to AssemblyAI
  }

  async stopMic(): Promise<void> {
    // Stop everything including monitoring
    this.audioWorkletNode?.disconnect();
    this.processor?.disconnect();
    this.source?.disconnect();
    
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }
    
    this.audioWorkletNode = undefined;
    this.processor = undefined;
    this.source = undefined;
    this.audioContext = undefined;
    this.audioBufferQueue = new Int16Array(0);
    this.isMonitoringOnly = false;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
    }
    
    // Clear mic device info
    if (this.micDeviceCallback) {
      this.micDeviceCallback("");
    }
    
    // Clear audio level
    if (this.audioLevelCallback) {
      this.audioLevelCallback(0);
    }
    
    // Reset normalization and smoothing
    this.minLevel = Infinity;
    this.maxLevel = 0;
    this.levelHistory = [];
    this.smoothedLevel = 0;
  }

  private async setupAudioProcessing(): Promise<void> {
    // Use AudioWorklet if available (more modern), fallback to ScriptProcessorNode
    try {
      const processorCode = `
        const MAX_16BIT_INT = 32767;
        class AudioProcessor extends AudioWorkletProcessor {
          process(inputs) {
            try {
              const input = inputs[0];
              if (!input) return true;
              const channelData = input[0];
              if (!channelData) return true;
              const float32Array = Float32Array.from(channelData);
              const int16Array = Int16Array.from(
                float32Array.map((n) => n * MAX_16BIT_INT)
              );
              this.port.postMessage({ audio_data: int16Array.buffer });
              return true;
            } catch (error) {
              console.error(error);
              return false;
            }
          }
        }
        registerProcessor('audio-processor', AudioProcessor);
      `;

      const blob = new Blob([processorCode], { type: 'application/javascript' });
      const processorUrl = URL.createObjectURL(blob);
      
      await this.audioContext!.audioWorklet.addModule(processorUrl);
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext!, 'audio-processor');
      this.source!.connect(this.audioWorkletNode);
      this.audioWorkletNode.connect(this.audioContext!.destination);

      this.audioWorkletNode.port.onmessage = (event) => {
        this.processAudioData(event.data.audio_data);
      };

      URL.revokeObjectURL(processorUrl);
    } catch (error) {
      console.warn("AudioWorklet not available, falling back to ScriptProcessorNode", error);
      // Fallback to ScriptProcessorNode
      this.processor = this.audioContext!.createScriptProcessor(1024, 1, 1);
      
      this.processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate audio level (RMS)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const rawLevel = Math.min(1, rms * 2);
        
        // Normalize dynamically
        const normalizedLevel = this.normalizeLevel(rawLevel);
        
        if (this.audioLevelCallback) {
          this.audioLevelCallback(normalizedLevel);
        }
        
        // Convert to Int16 PCM
        const pcmBuffer = new ArrayBuffer(inputData.length * 2);
        const pcmView = new DataView(pcmBuffer);
        for (let i = 0; i < inputData.length; i++) {
          let sample = inputData[i];
          sample = Math.max(-1, Math.min(1, sample));
          pcmView.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        }
        
        // Send to AssemblyAI only if not monitoring only
        if (!this.isMonitoringOnly && this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            // Track when we send audio for latency calculation
            const sendTime = Date.now();
            this.audioSendTimes.push(sendTime);
            // Keep only last 10 send times
            if (this.audioSendTimes.length > 10) {
              this.audioSendTimes.shift();
            }
            this.ws.send(pcmBuffer);
          } catch (error) {
            console.error("Error sending audio:", error);
          }
        }
      };

      this.source!.connect(this.processor);
      this.processor.connect(this.audioContext!.destination);
    }
  }

  private processAudioData(audioData: ArrayBuffer): void {
    const currentBuffer = new Int16Array(audioData);
    this.audioBufferQueue = this.mergeBuffers(this.audioBufferQueue, currentBuffer);

    const bufferDuration = (this.audioBufferQueue.length / this.audioContext!.sampleRate) * 1000;

    if (bufferDuration >= 50) {
      const targetDurationSeconds = 0.05;
      const totalSamples = Math.floor(this.audioContext!.sampleRate * targetDurationSeconds);
      const finalBuffer = new Uint8Array(this.audioBufferQueue.subarray(0, totalSamples).buffer);
      this.audioBufferQueue = this.audioBufferQueue.subarray(totalSamples);

      // Calculate audio level from the buffer
      let sum = 0;
      const samples = new Int16Array(finalBuffer.buffer, finalBuffer.byteOffset, finalBuffer.length / 2);
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i] / 32767;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / samples.length);
      const rawLevel = Math.min(1, rms * 2);
      
      // Normalize dynamically
      const normalizedLevel = this.normalizeLevel(rawLevel);
      
      if (this.audioLevelCallback) {
        this.audioLevelCallback(normalizedLevel);
      }

      // Send audio to WebSocket only if not monitoring only
      if (!this.isMonitoringOnly && this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          // Track when we send audio for latency calculation
          const sendTime = Date.now();
          this.audioSendTimes.push(sendTime);
          // Keep only last 10 send times
          if (this.audioSendTimes.length > 10) {
            this.audioSendTimes.shift();
          }
          this.ws.send(finalBuffer);
        } catch (error) {
          console.error("Error sending audio:", error);
        }
      }
    }
  }

  private mergeBuffers(lhs: Int16Array, rhs: Int16Array): Int16Array {
    const merged = new Int16Array(lhs.length + rhs.length);
    merged.set(lhs, 0);
    merged.set(rhs, lhs.length);
    return merged;
  }

  private reportLatency(): void {
    if (this.audioSendTimes.length > 0 && this.latencyCallback) {
      const sendTime = this.audioSendTimes.shift();
      if (sendTime !== undefined) {
        const latency = Date.now() - sendTime;
        this.latencyCallback(latency);
      }
    }
  }

  private flushTurns(): void {
    if (this.nextTurnToDeliver === 0) {
      return;
    }

    let updated = false;

    while (this.pendingTurns.has(this.nextTurnToDeliver)) {
      const text = this.pendingTurns.get(this.nextTurnToDeliver);
      if (text) {
        this.transcriptSoFar = this.transcriptSoFar
          ? `${this.transcriptSoFar} ${text}`
          : text;
        this.pendingTurns.delete(this.nextTurnToDeliver);
        this.nextTurnToDeliver += 1;
        updated = true;
      } else {
        break;
      }
    }

    if (updated && this.transcriptCallback) {
      this.reportLatency();
      this.transcriptCallback(this.transcriptSoFar);
    }
  }
}
