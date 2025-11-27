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

  constructor(
    private apiKey: string,
    private eventId: string,
    private eventName: string,
    private eventDescription: string | null,
    private sessionName: string | null,
    private sessionDescription: string | null,
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

      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1) // Smaller buffer for lower latency
      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws) return
        const audioData = e.inputBuffer.getChannelData(0)

        const int16Data = this.float32ToInt16(audioData)
        const base64Audio = this.arrayBufferToBase64(int16Data.buffer)

        this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }))
      }

      source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      console.log("[v0] Continuous audio streaming started")
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

        let contextInfo = `Event: ${this.eventName}`
        if (this.eventDescription) {
          contextInfo += `\nEvent Description: ${this.eventDescription}`
        }
        if (this.sessionName) {
          contextInfo += `\nSession: ${this.sessionName}`
        }
        if (this.sessionDescription) {
          contextInfo += `\nSession Description: ${this.sessionDescription}`
        }

        this.ws!.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions: `
You are an AI transcription agent providing live English subtitles for events.
Your purpose is to support deaf, hard of hearing, and neurodiverse audiences who
rely on precise and reliable captions.

**CRITICAL: You MUST transcribe ONLY English speech. Do NOT output any non-English words.**

Context for this transcription:
${contextInfo}

Use this context ONLY to:
- correctly spell names, topics, event titles, products, or specialized terms
- improve recognition of domain-specific vocabulary

Do NOT use contextInfo to:
- guess or invent lines of dialogue
- add words the speaker did not say
- infer meaning or expand on speech

Transcription Rules (STRICT):
1. **ENGLISH ONLY** — Output only English words that are clearly spoken in English..
2. Transcribe **verbatim** — exactly what is spoken in English.
3. If audio is unintelligible, use:
      [inaudible] — cannot be heard
      [unclear] — heard but not confidently understood
   Never guess or substitute.
4. **No hallucinations**, no invented fillers, no paraphrasing, no interpretation.
5. Preserve natural sentence boundaries with accurate punctuation and capitalization.
6. Do not include timestamps, speaker labels, emojis, or symbols unless spoken.
7. Only transcribe speech — ignore background noise, non-speech sounds, or music.
8. If you are unsure whether a word was spoken, mark it as [unclear] instead of inventing.

Your output must be clean, literal, strictly English, and faithful to the spoken audio.
          `,
              modalities: ["text"],
              input_audio_format: "pcm16",
              input_audio_transcription: {
                model: "gpt-4o-mini-transcribe",
                language: "en",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.3, // Slightly less sensitive to reduce false positives
                prefix_padding_ms: 100, // Capture a bit more of the start
                silence_duration_ms: 200, // Wait 200ms of silence before committing
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

          this.onTranscription(message.transcript, true, this.sequenceNumber++)
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
