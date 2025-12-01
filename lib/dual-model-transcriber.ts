"use client"

type AnyEvent = { type: string; [k: string]: any }

interface TranscriptionResult {
  text: string
  model: "gpt-4o-mini-transcribe" | "gpt-4o-transcribe"
  confidence?: number
}

export class DualModelTranscriber {
  // WebSocket connections for both models
  private wsMini: WebSocket | null = null
  private wsStandard: WebSocket | null = null

  // Audio processing
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null

  // Connection state
  private isConnectedMini = false
  private isConnectedStandard = false

  // Transcription tracking
  private sequenceNumber = 0
  private currentItemIdMini: string | null = null
  private currentItemIdStandard: string | null = null
  private accumulatedTextMini = ""
  private accumulatedTextStandard = ""

  // Pending finals for cross-validation
  private pendingFinalMini: string | null = null
  private pendingFinalStandard: string | null = null
  private currentSequenceForValidation: number | null = null

  constructor(
    private clientSecret: string,
    private eventId: string,
    private eventName: string,
    private eventDescription: string | null,
    private sessionName: string | null,
    private sessionDescription: string | null,
    private onInterimTranscription: (text: string, sequence: number) => void,
    private onFinalTranscription: (text: string, sequence: number) => void,
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

      await Promise.all([this.connectWebSocket("mini"), this.connectWebSocket("standard")])

      await this.initializeAudioProcessing(source)
      console.log("Dual-model transcription started")
    } catch (error) {
      console.error("Failed to start dual transcription:", error)
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
        console.warn("AudioWorklet failed, falling back to ScriptProcessor", error)
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
    const int16Data = this.float32ToInt16(audioData)
    const base64Audio = this.arrayBufferToBase64(int16Data.buffer)
    const audioMessage = JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio })

    if (this.isConnectedMini && this.wsMini) {
      this.wsMini.send(audioMessage)
    }

    if (this.isConnectedStandard && this.wsStandard) {
      this.wsStandard.send(audioMessage)
    }
  }

  private async connectWebSocket(model: "mini" | "standard"): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const modelName = model === "mini" ? "gpt-realtime-mini" : "gpt-4o-realtime-preview"
      const url = `wss://api.openai.com/v1/realtime?model=${modelName}`

      const ws = new WebSocket(url, [
        "realtime",
        `openai-insecure-api-key.${this.clientSecret}`,
        "openai-beta.realtime-v1",
      ])

      ws.onopen = () => {
        console.log(`WebSocket connected for ${model}`)

        if (model === "mini") {
          this.isConnectedMini = true
        } else {
          this.isConnectedStandard = true
        }

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

        ws.send(
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
                model: model === "mini" ? "gpt-4o-mini-transcribe" : "gpt-4o-transcribe",
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

      ws.onerror = (event) => {
        console.error(`WebSocket error for ${model}:`, event)
        if (model === "mini") {
          this.isConnectedMini = false
        } else {
          this.isConnectedStandard = false
        }
        reject(event)
      }

      ws.onmessage = (event) => {
        try {
          const message: AnyEvent = JSON.parse(event.data)
          this.handleServerMessage(message, model)
        } catch (error) {
          console.error(`Failed to parse message from ${model}:`, error)
        }
      }

      ws.onclose = () => {
        console.log(`WebSocket closed for ${model}`)
        if (model === "mini") {
          this.isConnectedMini = false
        } else {
          this.isConnectedStandard = false
        }
      }

      if (model === "mini") {
        this.wsMini = ws
      } else {
        this.wsStandard = ws
      }
    })
  }

  private handleServerMessage(message: AnyEvent, model: "mini" | "standard") {
    switch (message.type) {
      case "conversation.item.input_audio_transcription.delta": {
        if (typeof message.delta === "string" && message.item_id) {
          if (model === "mini") {
            if (this.currentItemIdMini !== message.item_id) {
              this.currentItemIdMini = message.item_id
              this.accumulatedTextMini = ""
            }
            this.accumulatedTextMini += message.delta

            // Send interim to broadcast immediately
            this.onInterimTranscription(this.accumulatedTextMini, this.sequenceNumber)
          } else {
            if (this.currentItemIdStandard !== message.item_id) {
              this.currentItemIdStandard = message.item_id
              this.accumulatedTextStandard = ""
            }
            this.accumulatedTextStandard += message.delta
          }
        }
        break
      }

      case "conversation.item.input_audio_transcription.completed": {
        if (typeof message.transcript === "string") {
          console.log(`Final transcription from ${model}:`, message.transcript.substring(0, 50) + "...")

          if (model === "mini") {
            this.pendingFinalMini = message.transcript
            this.accumulatedTextMini = ""
            this.currentItemIdMini = null
          } else {
            this.pendingFinalStandard = message.transcript
            this.accumulatedTextStandard = ""
            this.currentItemIdStandard = null
          }

          if (this.pendingFinalMini && this.pendingFinalStandard) {
            const seq = this.sequenceNumber++
            this.currentSequenceForValidation = seq

            this.validateTranscriptions(this.pendingFinalMini, this.pendingFinalStandard, seq)

            this.pendingFinalMini = null
            this.pendingFinalStandard = null
          }
        }
        break
      }

      case "error": {
        console.error(`OpenAI error from ${model}:`, message.error)
        this.onError(message?.error?.message || `OpenAI error from ${model}`)
        break
      }

      default:
        break
    }
  }

  private async validateTranscriptions(miniResult: string, standardResult: string, sequence: number) {
    try {
      console.log(`Validating transcriptions for sequence ${sequence}`)

      const response = await fetch("/api/validate-transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miniTranscription: miniResult,
          standardTranscription: standardResult,
          eventId: this.eventId,
          eventName: this.eventName,
          eventDescription: this.eventDescription,
          sessionName: this.sessionName,
          sessionDescription: this.sessionDescription,
          sequence,
        }),
      })

      if (!response.ok) {
        throw new Error(`Validation API returned ${response.status}`)
      }

      const result = await response.json()
      console.log(`Validation result for sequence ${sequence}:`, result.validatedText.substring(0, 50) + "...")

      // Send the validated transcription as final
      this.onFinalTranscription(result.validatedText, sequence)
    } catch (error) {
      console.error("Validation failed, using standard model result:", error)
      // Fallback to standard model if validation fails
      this.onFinalTranscription(standardResult, sequence)
    }
  }

  stop() {
    console.log("Stopping dual-model transcription")
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
      if (this.wsMini) {
        this.wsMini.close()
        this.wsMini = null
      }
      if (this.wsStandard) {
        this.wsStandard.close()
        this.wsStandard = null
      }
    } finally {
      this.isConnectedMini = false
      this.isConnectedStandard = false
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
