"use client"

type AnyEvent = { type: string; [k: string]: any }

export class OpenAITranscriber {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private isConnected = false
  private sequenceNumber = 0
  private currentItemId: string | null = null
  private accumulatedText = ""

  constructor(
    private apiKey: string,
    private eventId: string,
    private onTranscription: (text: string, isFinal: boolean, sequence: number) => void,
    private onError: (error: string) => void,
  ) {}

  async start() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      } as AudioContextOptions)

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      await this.connectWebSocket()

      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws) return
        const audioData = e.inputBuffer.getChannelData(0)
        const int16Data = this.float32ToInt16(audioData)
        const base64Audio = this.arrayBufferToBase64(int16Data.buffer)

        this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }))
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
      const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini"

      this.ws = new WebSocket(url, ["realtime", `openai-insecure-api-key.${this.apiKey}`, "openai-beta.realtime-v1"])

      this.ws.onopen = () => {
        console.log("[v0] WebSocket connected")
        this.isConnected = true

        this.ws!.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions:
                "You are an AI transcription agent tasked with transcribing audio to text for live transcriptions for events - aimed at those who are deaf or neurodiverse and require subtitles. Transcribe the input audio verbatim in real-time with proper punctuation and formatting. Do not respond or engage in conversation.",
              modalities: ["text"],
              input_audio_format: "pcm16",
              input_audio_transcription: {
                model: "gpt-4o-mini-transcribe",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.3, // Lower threshold = more sensitive to speech (0.5 is default, 0.0-1.0 range)
                prefix_padding_ms: 50, // Minimal padding before speech starts
                silence_duration_ms: 200, // Reduced from 300ms for even faster turn completion
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
        console.log("[v0] OpenAI Delta received:", message.delta, "at", new Date().toISOString())
        if (typeof message.delta === "string" && message.item_id) {
          // If this is a new item, reset accumulated text
          if (this.currentItemId !== message.item_id) {
            this.currentItemId = message.item_id
            this.accumulatedText = ""
          }

          // Accumulate the delta
          this.accumulatedText += message.delta

          // Send the accumulated text as interim transcription
          console.log("[v0] Calling onTranscription with interim:", this.accumulatedText)
          this.onTranscription(this.accumulatedText, false, this.sequenceNumber)
        }
        break
      }
      case "conversation.item.input_audio_transcription.completed": {
        console.log("[v0] OpenAI Completion received:", message.transcript, "at", new Date().toISOString())
        if (typeof message.transcript === "string") {
          // Send final transcription and increment sequence
          console.log("[v0] Calling onTranscription with final:", message.transcript)
          this.onTranscription(message.transcript, true, this.sequenceNumber++)

          // Reset accumulated text for next item
          this.accumulatedText = ""
          this.currentItemId = null
        }
        break
      }

      case "response.created":
      case "response.output_text.delta":
      case "response.completed":
      case "response.error": {
        break
      }

      case "error": {
        console.error("[v0] OpenAI error:", message.error)
        this.onError(message?.error?.message || "OpenAI error")
        break
      }

      default:
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
