"use client"

type AnyEvent = { type: string; [k: string]: any }

export class OpenAITranscriber {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private isConnected = false
  private sequenceNumber = 0
  private currentItemId: string | null = null
  private accumulatedText = ""
  private lastTranscriptionTime: number = Date.now()
  private lastAudioActivityTime: number = Date.now()
  private lastDeltaTime: number = Date.now()
  private sessionStartTime = 0
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(
    private clientSecret: string,
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
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      } as AudioContextOptions)

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.sourceNode = source

      this.sessionStartTime = Date.now()

      await this.connectWebSocket()

      await this.initializeAudioProcessing(source)
      this.scheduleReconnect()
      console.log("Continuous audio streaming started")
    } catch (error) {
      console.error("Failed to start transcription:", error)
      this.onError(error instanceof Error ? error.message : "Failed to start")
      throw error
    }
  }

  private async initializeAudioProcessing(source: MediaStreamAudioSourceNode) {
    if (!this.audioContext) return

    if (this.audioContext.audioWorklet) {
      try {
        await this.initializeAudioWorklet(source)
        return
      } catch (error) {
        console.warn("AudioWorklet initialization failed, falling back to ScriptProcessor", error)
      }
    }

    this.initializeLegacyProcessor(source)
  }

  private async initializeAudioWorklet(source: MediaStreamAudioSourceNode) {
    if (!this.audioContext) return

    const workletCode = `class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channelData = inputs?.[0]?.[0]
    if (channelData) {
      this.port.postMessage(channelData)
    }
    return true
  }
}
registerProcessor("pcm-processor", PCMProcessor)
`

    const blob = new Blob([workletCode], { type: "application/javascript" })
    const url = URL.createObjectURL(blob)

    try {
      await this.audioContext.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    const workletNode = new AudioWorkletNode(this.audioContext, "pcm-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
    })

    workletNode.port.onmessage = (event) => {
      const audioData = event.data as Float32Array
      this.handleAudioChunk(audioData)
    }

    source.connect(workletNode)
    this.processor = workletNode
  }

  private initializeLegacyProcessor(source: MediaStreamAudioSourceNode) {
    if (!this.audioContext) return

    const processor = this.audioContext.createScriptProcessor(2048, 1, 1)
    processor.addEventListener("audioprocess", (e) => {
      const audioData = e.inputBuffer.getChannelData(0)
      this.handleAudioChunk(audioData)
    })

    source.connect(processor)
    this.processor = processor
  }

  private handleAudioChunk(audioData: Float32Array) {
    if (!this.isConnected || !this.ws) return

    const int16Data = this.float32ToInt16(audioData)
    const base64Audio = this.arrayBufferToBase64(int16Data.buffer)

    this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }))
  }

  private async connectWebSocket() {
    return new Promise<void>((resolve, reject) => {
      const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini"

      this.ws = new WebSocket(url, [
        "realtime",
        `openai-insecure-api-key.${this.clientSecret}`,
        "openai-beta.realtime-v1",
      ])

      this.ws.onopen = () => {
        console.log("WebSocket connected")
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

Context for this transcription:
${contextInfo}

Use this context to:
- correctly spell names, topics, event titles, products, or specialized terms
- improve recognition of domain-specific vocabulary

Transcription Rules:
1. Transcribe **verbatim** — exactly what is spoken.
2. Preserve natural sentence boundaries with accurate punctuation and capitalization.
3. If audio is clearly unintelligible, use [inaudible].
4. For unclear pronunciations, provide your best English transcription rather than marking as [unclear].
5. Do not hallucinate or add words the speaker did not say.
6. Do not include timestamps, speaker labels, or symbols unless spoken.
7. Only transcribe speech — ignore background noise or music.

Your output must be clean, literal, and faithful to the spoken audio.
          `,
              modalities: ["text"],
              input_audio_format: "pcm16",
              input_audio_transcription: {
                model: "gpt-4o-mini-transcribe-2025-12-15",
                language: "en",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.3,
                prefix_padding_ms: 250,
                silence_duration_ms: 250,
                create_response: false,
              },
            },
          }),
        )

        resolve()
      }

      this.ws.onerror = (event) => {
        console.error("WebSocket error:", event)
        this.isConnected = false
        this.onError("WebSocket error")
        reject(event)
      }

      this.ws.onmessage = (event) => {
        try {
          const message: AnyEvent = JSON.parse(event.data)
          this.handleServerMessage(message)
        } catch (error) {
          console.error("Failed to parse message:", error)
        }
      }

      this.ws.onclose = () => {
        console.log("WebSocket closed")
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
        console.error("OpenAI error:", message.error)
        this.onError(message?.error?.message || "OpenAI error")
        break
      }

      default:
        break
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const RECONNECT_TIME = 58 * 60 * 1000

    this.reconnectTimer = setTimeout(async () => {
      console.log("Approaching 60-minute session limit, reconnecting WebSocket...")
      try {
        await this.reconnectWebSocket()
        console.log("WebSocket reconnected successfully")
      } catch (error) {
        console.error("Failed to reconnect WebSocket:", error)
        this.onError("Failed to reconnect after 60-minute limit")
      }
    }, RECONNECT_TIME)
  }

  private async reconnectWebSocket() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }

    await this.connectWebSocket()

    this.sessionStartTime = Date.now()

    this.scheduleReconnect()
  }

  stop() {
    console.log("Stopping transcription")

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    try {
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect()
        } catch (error) {
          console.warn("Failed to disconnect source node", error)
        }
        this.sourceNode = null
      }
      if (this.processor) {
        try {
          this.processor.disconnect()
        } catch (error) {
          console.warn("Failed to disconnect processor", error)
        }
        if (this.processor instanceof AudioWorkletNode) {
          this.processor.port.onmessage = null
        }
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

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = ""
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}
