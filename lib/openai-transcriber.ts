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
  private lastTranscriptionTime: number = Date.now()
  private lastAudioActivityTime: number = Date.now()
  private lastDeltaTime: number = Date.now()
  private hasAudioInBuffer = false // Added flag to track if buffer has audio
  private maxAudioDurationMs = 8000 // Force transcription after 8 seconds
  private naturalPauseThresholdMs = 200 // Consider it a natural pause after 200ms of low activity
  private durationCheckInterval: NodeJS.Timeout | null = null

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

      this.startDurationCheck()

      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws) return
        const audioData = e.inputBuffer.getChannelData(0)

        const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length)
        if (rms > 0.01) {
          // Threshold for detecting speech activity
          this.lastAudioActivityTime = Date.now()
        }

        const int16Data = this.float32ToInt16(audioData)
        const base64Audio = this.arrayBufferToBase64(int16Data.buffer)

        this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }))
        this.hasAudioInBuffer = true
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

  private startDurationCheck() {
    this.lastTranscriptionTime = Date.now()

    this.durationCheckInterval = setInterval(() => {
      const timeSinceLastTranscription = Date.now() - this.lastTranscriptionTime
      const timeSinceLastActivity = Date.now() - this.lastAudioActivityTime
      const timeSinceLastDelta = Date.now() - this.lastDeltaTime

      const inNaturalPause =
        timeSinceLastActivity > this.naturalPauseThresholdMs || timeSinceLastDelta > this.naturalPauseThresholdMs

      if (
        timeSinceLastTranscription > this.maxAudioDurationMs &&
        inNaturalPause &&
        this.hasAudioInBuffer &&
        this.ws &&
        this.isConnected
      ) {
        try {
          this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }))
          this.lastTranscriptionTime = Date.now()
          this.hasAudioInBuffer = false
        } catch (error) {
          // Silently ignore commit errors - buffer may have been auto-committed by VAD
          console.log("[v0] Buffer commit skipped (likely already committed)")
          this.hasAudioInBuffer = false
        }
      }
    }, 200)
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
              instructions: `
          You are an AI transcription agent providing live English subtitles for events.
          Your transcriptions support deaf, hard of hearing, and neurodiverse audiences who rely on clear, well-timed captions.

          Instructions:
          - Transcribe verbatim with accurate punctuation and capitalization.
          - Output short, readable caption chunks (1–2 sentences or ~8–15 words).
          - Do not paraphrase, interpret, or respond — output only the transcription.
          - For unclear audio, output [inaudible] or [unclear].
          - Avoid timestamps, speaker labels, or symbols unless explicitly spoken.
          - Prioritize clarity, rhythm, and readability suitable for live display.
          `,
              modalities: ["text"],
              input_audio_format: "pcm16",
              input_audio_transcription: {
                model: "gpt-4o-transcribe",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.3,
                prefix_padding_ms: 75,
                silence_duration_ms: 150,
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
        if (typeof message.delta === "string" && message.item_id) {
          this.lastDeltaTime = Date.now()

          if (this.currentItemId !== message.item_id) {
            this.currentItemId = message.item_id
            this.accumulatedText = ""
          }

          this.accumulatedText += message.delta
          this.onTranscription(this.accumulatedText, false, this.sequenceNumber)
        }
        break
      }
      case "conversation.item.input_audio_transcription.completed": {
        if (typeof message.transcript === "string") {
          this.lastTranscriptionTime = Date.now()
          this.lastDeltaTime = Date.now()
          this.hasAudioInBuffer = false

          this.onTranscription(message.transcript, true, this.sequenceNumber++)
          this.accumulatedText = ""
          this.currentItemId = null
        }
        break
      }

      case "input_audio_buffer.committed": {
        // OpenAI's VAD committed the buffer, so reset our flag
        this.hasAudioInBuffer = false
        this.lastTranscriptionTime = Date.now()
        break
      }

      case "response.created":
      case "response.output_text.delta":
      case "response.completed":
      case "response.error": {
        break
      }

      case "error": {
        if (message.error?.code === "input_audio_buffer_commit_empty") {
          console.log("[v0] Buffer commit ignored - buffer was empty")
          this.hasAudioInBuffer = false
        } else {
          console.error("[v0] OpenAI error:", message.error)
          this.onError(message?.error?.message || "OpenAI error")
        }
        break
      }

      default:
        break
    }
  }

  stop() {
    console.log("[v0] Stopping transcription")
    try {
      this.hasAudioInBuffer = false

      if (this.durationCheckInterval) {
        clearInterval(this.durationCheckInterval)
        this.durationCheckInterval = null
      }

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
