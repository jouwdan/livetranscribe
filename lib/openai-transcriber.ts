"use client"

type AnyEvent = { type: string; [k: string]: any }

export class OpenAITranscriber {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private isConnected = false
  private sequenceNumber = 0

  constructor(
    private apiKey: string,
    private onTranscription: (text: string, isFinal: boolean, sequence: number) => void,
    private onError: (error: string) => void,
  ) {}

  async start() {
    try {
      // Mic access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // AudioContext (browser may clamp to 48k; fine)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      } as AudioContextOptions)

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Connect to OpenAI Realtime (conversation mode requires model in URL)
      await this.connectWebSocket()

      // Stream audio frames
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws) return
        const audioData = e.inputBuffer.getChannelData(0)
        const int16Data = this.float32ToInt16(audioData)
        const base64Audio = this.arrayBufferToBase64(int16Data.buffer)

        this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }))
        // With server VAD enabled, commits (and therefore transcription) are automatic.
      }

      source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      console.log("[v0] Audio streaming started")
    } catch (error) {
      console.error("[v0] Failed to start transcription:", error)
      this.onError(error instanceof Error ? error.message : "Failed to start")
      throw error
    }
  }

  private async connectWebSocket() {
    return new Promise<void>((resolve, reject) => {
      // Conversation session URL: include model
      const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17"

      this.ws = new WebSocket(url, [
        "realtime",
        `openai-insecure-api-key.${this.apiKey}`, // use ephemeral server-issued tokens in prod
        "openai-beta.realtime-v1",
      ])

      this.ws.onopen = () => {
        console.log("[v0] WebSocket connected")
        this.isConnected = true

        this.ws!.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions:
                "Transcribe the input audio verbatim in real-time with proper punctuation and formatting. Do not respond or engage in conversation.",
              modalities: ["text"],

              input_audio_format: "pcm16",

              input_audio_transcription: {
                model: "whisper-1",
              },

              // More aggressive VAD settings for faster real-time updates
              turn_detection: {
                type: "server_vad",
                threshold: 0.3, // Lower threshold = more sensitive, catches speech sooner
                prefix_padding_ms: 100, // Reduced padding for faster start
                silence_duration_ms: 200, // Shorter silence = faster updates
                create_response: false,
              },
            },
          }),
        )

        resolve()
      }

      this.ws.onerror = (event) => {
        console.error("[v0] WebSocket error:", event)
        this.isConnected = false
        this.onError("WebSocket error")
        reject(event)
      }

      this.ws.onmessage = (event) => {
        try {
          const message: AnyEvent = JSON.parse(event.data)
          this.handleServerMessage(message)
        } catch (error) {
          console.error("[v0] Failed to parse message:", error)
        }
      }

      this.ws.onclose = () => {
        console.log("[v0] WebSocket closed")
        this.isConnected = false
      }
    })
  }

  private handleServerMessage(message: AnyEvent) {
    switch (message.type) {
      case "conversation.item.input_audio_transcription.delta": {
        if (typeof message.delta === "string") {
          console.log("[v0] Delta transcription:", message.delta)
          this.onTranscription(message.delta, false, this.sequenceNumber)
        }
        break
      }
      case "conversation.item.input_audio_transcription.completed": {
        if (typeof message.transcript === "string") {
          console.log("[v0] Final transcription:", message.transcript)
          this.onTranscription(message.transcript, true, this.sequenceNumber++)
        }
        break
      }

      // If the server still tries to create responses for any reason, just ignore them.
      case "response.created":
      case "response.output_text.delta":
      case "response.completed":
      case "response.error": {
        // No-op (we told it create_response:false)
        break
      }

      case "error": {
        console.error("[v0] OpenAI error:", message.error)
        this.onError(message?.error?.message || "OpenAI error")
        break
      }

      default:
        // ignore other events
        break
    }
  }

  stop() {
    console.log("[v0] Stopping transcription")
    try {
      if (this.processor) {
        this.processor.disconnect()
        this.processor = null
      }
      if (this.audioContext) {
        this.audioContext.close()
        this.audioContext = null
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop())
        this.mediaStream = null
      }
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    } finally {
      this.isConnected = false
    }
  }

  private float32ToInt16(buffer: Float32Array): Int16Array {
    const int16 = new Int16Array(buffer.length)
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ""
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}
