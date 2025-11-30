"use client"

type AnyEvent = { type: string; [k: string]: any }

type TurnDetectionOverrides = {
  threshold?: number
  prefixPaddingMs?: number
  silenceDurationMs?: number
}

type TranscriberOptions = {
  captureSampleRate?: number
  targetSampleRate?: number
  chunkDurationMs?: number
  silenceRmsThreshold?: number
  vad?: TurnDetectionOverrides
  glossaryTerms?: string[]
  reconnectionTimeoutMs?: number
}

type ResolvedTranscriberOptions = Required<Omit<TranscriberOptions, "vad" | "glossaryTerms">> & {
  vad: Required<TurnDetectionOverrides>
  glossaryTerms: string[]
}

export const OPENAI_TRANSCRIBER_DEFAULTS: ResolvedTranscriberOptions = {
  captureSampleRate: 48000,
  targetSampleRate: 24000,
  chunkDurationMs: 120,
  silenceRmsThreshold: 0.003,
  reconnectionTimeoutMs: 15000,
  vad: {
    threshold: 0.3,
    prefixPaddingMs: 120,
    silenceDurationMs: 220,
  },
  glossaryTerms: [],
}

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
  private audioBufferQueue: Int16Array[] = []
  private bufferedSamples = 0
  private chunkSizeSamples: number
  private captureSampleRate: number
  private targetSampleRate: number
  private silenceRmsThreshold: number
  private options: ResolvedTranscriberOptions
  private healthCheckInterval: number | null = null
  private reconnecting = false

  constructor(
    private clientSecret: string,
    private eventId: string,
    private eventName: string,
    private eventDescription: string | null,
    private sessionName: string | null,
    private sessionDescription: string | null,
    private onTranscription: (text: string, isFinal: boolean, sequence: number) => void,
    private onError: (error: string) => void,
    options: TranscriberOptions = {},
  ) {
    const mergedOptions: ResolvedTranscriberOptions = {
      ...OPENAI_TRANSCRIBER_DEFAULTS,
      ...options,
      vad: { ...OPENAI_TRANSCRIBER_DEFAULTS.vad, ...(options.vad ?? {}) },
      glossaryTerms: [...(options.glossaryTerms ?? OPENAI_TRANSCRIBER_DEFAULTS.glossaryTerms)],
    }

    this.options = mergedOptions
    this.captureSampleRate = mergedOptions.captureSampleRate
    this.targetSampleRate = mergedOptions.targetSampleRate
    this.chunkSizeSamples = Math.max(1, Math.floor((mergedOptions.chunkDurationMs / 1000) * this.targetSampleRate))
    this.silenceRmsThreshold = mergedOptions.silenceRmsThreshold
  }

  updateGlossaryTerms(terms: string[]) {
    this.options.glossaryTerms = terms
    if (this.isConnected && this.ws) {
      this.sendSessionUpdate()
    }
  }

  async start() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.captureSampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.captureSampleRate,
      } as AudioContextOptions)
      this.captureSampleRate = this.audioContext.sampleRate

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.sourceNode = source

      await this.connectWebSocket()
      this.startHealthMonitor()

      await this.initializeAudioProcessing(source)
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
    processor.connect(this.audioContext.destination)
    this.processor = processor
  }

  private handleAudioChunk(audioData: Float32Array) {
    if (!this.isConnected || !this.ws) return

    const rms = this.calculateRms(audioData)
    if (rms < this.silenceRmsThreshold) {
      this.tryFlushAudioBuffer(true)
      return
    }

    this.lastAudioActivityTime = Date.now()

    const downsampled = this.downsampleBuffer(audioData, this.captureSampleRate, this.targetSampleRate)
    const int16Data = this.float32ToInt16(downsampled)

    this.audioBufferQueue.push(int16Data)
    this.bufferedSamples += int16Data.length
    this.tryFlushAudioBuffer()
  }

  private tryFlushAudioBuffer(force = false) {
    if (!this.ws) return

    const shouldSend = force ? this.bufferedSamples > 0 : this.bufferedSamples >= this.chunkSizeSamples
    if (!shouldSend) return

    const samplesToSend = force ? this.bufferedSamples : this.chunkSizeSamples
    const chunk = new Int16Array(samplesToSend)
    let offset = 0

    while (offset < samplesToSend && this.audioBufferQueue.length) {
      const current = this.audioBufferQueue[0]
      const remaining = samplesToSend - offset

      if (current.length <= remaining) {
        chunk.set(current, offset)
        offset += current.length
        this.audioBufferQueue.shift()
      } else {
        chunk.set(current.subarray(0, remaining), offset)
        this.audioBufferQueue[0] = current.subarray(remaining)
        offset += remaining
      }
    }

    this.bufferedSamples -= samplesToSend
    const base64Audio = this.arrayBufferToBase64(chunk.buffer)
    this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }))
  }

  private calculateRms(buffer: Float32Array): number {
    if (buffer.length === 0) return 0
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i]
    }
    return Math.sqrt(sum / buffer.length)
  }

  private downsampleBuffer(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (buffer.length === 0 || fromRate <= toRate) {
      return buffer
    }

    const ratio = fromRate / toRate
    const newLength = Math.floor(buffer.length / ratio)
    const result = new Float32Array(newLength)

    for (let i = 0; i < newLength; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.min(buffer.length, Math.floor((i + 1) * ratio))
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += buffer[j]
      }
      result[i] = sum / Math.max(1, end - start)
    }

    return result
  }

  private resetAudioBuffer() {
    this.audioBufferQueue = []
    this.bufferedSamples = 0
  }

  private startHealthMonitor() {
    this.stopHealthMonitor()
    const interval = Math.max(1000, Math.floor(this.options.reconnectionTimeoutMs / 3))
    this.healthCheckInterval = window.setInterval(() => {
      if (!this.isConnected) {
        return
      }
      const now = Date.now()
      const sawRecentAudio = now - this.lastAudioActivityTime < this.options.reconnectionTimeoutMs
      if (sawRecentAudio && now - this.lastDeltaTime > this.options.reconnectionTimeoutMs) {
        this.reconnect("Transcription stream stalled")
      }
    }, interval)
  }

  private stopHealthMonitor() {
    if (this.healthCheckInterval !== null) {
      window.clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  private async reconnect(reason: string) {
    if (this.reconnecting) return
    console.warn("Reconnecting websocket due to:", reason)
    this.reconnecting = true
    try {
      if (this.ws) {
        this.ws.onopen = null
        this.ws.onclose = null
        this.ws.onerror = null
        this.ws.onmessage = null
        try {
          this.ws.close()
        } catch (error) {
          console.warn("Failed closing websocket before reconnect", error)
        }
      }
      this.ws = null
      this.isConnected = false
      this.resetAudioBuffer()
      await this.connectWebSocket()
    } catch (error) {
      console.error("Reconnection failed", error)
      this.onError(error instanceof Error ? error.message : "Failed to reconnect")
    } finally {
      this.reconnecting = false
    }
  }

  private async connectWebSocket() {
    return new Promise<void>((resolve, reject) => {
      const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime-mini"

      this.ws = new WebSocket(url, ["realtime", `openai-ephemeral-token.${this.clientSecret}`, "openai-beta.realtime-v1"])

      this.ws.onopen = () => {
        console.log("WebSocket connected")
        this.isConnected = true
        this.lastDeltaTime = Date.now()

        this.sendSessionUpdate()

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
        this.resetAudioBuffer()
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

  private buildContextInfo(): string {
    const lines = [`Event: ${this.eventName}`]
    if (this.eventDescription) {
      lines.push(`Event Description: ${this.eventDescription}`)
    }
    if (this.sessionName) {
      lines.push(`Session: ${this.sessionName}`)
    }
    if (this.sessionDescription) {
      lines.push(`Session Description: ${this.sessionDescription}`)
    }
    if (this.eventId) {
      lines.push(`Event ID: ${this.eventId}`)
    }
    return lines.join("\n")
  }

  private buildInstructions(contextInfo: string): string {
    const glossarySection = this.options.glossaryTerms.length
      ? `\nAdditional vocabulary (spell exactly as written):\n${this.options.glossaryTerms.map((term) => `- ${term}`).join("\n")}\n`
      : ""

    return `
You are an AI transcription agent providing live English subtitles for events.
Your purpose is to support deaf, hard of hearing, and neurodiverse audiences who
rely on precise and reliable captions.

**CRITICAL: You MUST transcribe ONLY English speech. Do NOT output any non-English words.**

Context for this transcription:
${contextInfo}
${glossarySection}
Use this context ONLY to:
- correctly spell names, topics, event titles, products, or specialized terms
- improve recognition of domain-specific vocabulary

Do NOT use context to:
- guess or invent lines of dialogue
- add words the speaker did not say
- infer meaning or expand on speech

Transcription Rules (STRICT):
1. **ENGLISH ONLY** — Output only English words that are clearly spoken in English.
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
    `
  }

  private sendSessionUpdate() {
    if (!this.ws) return
    const instructions = this.buildInstructions(this.buildContextInfo())
    const vad = this.options.vad

    this.ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions,
          modalities: ["text"],
          input_audio_format: "pcm16",
          input_audio_transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "en",
          },
          turn_detection: {
            type: "server_vad",
            threshold: vad.threshold,
            prefix_padding_ms: vad.prefixPaddingMs,
            silence_duration_ms: vad.silenceDurationMs,
            create_response: false,
          },
        },
      }),
    )
  }

  stop() {
    console.log("Stopping transcription")
    try {
      this.stopHealthMonitor()
      this.resetAudioBuffer()
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
