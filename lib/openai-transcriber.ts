"use client"

type AnyEvent = { type: string; [k: string]: any }

// Audio buffer configuration for optimal streaming
const AUDIO_BUFFER_SIZE = 4096 // Larger buffer for smoother processing
const SAMPLE_RATE = 24000 // OpenAI's expected sample rate
const AUDIO_SEND_INTERVAL_MS = 100 // Send audio every 100ms for better batching

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

  // Audio buffering for optimized streaming
  private audioBuffer: Float32Array[] = []
  private audioSendTimer: NodeJS.Timeout | null = null
  private isProcessingAudio = false

  // Connection health monitoring
  private heartbeatTimer: NodeJS.Timeout | null = null
  private connectionRetryCount = 0
  private maxRetries = 3

  // Audio level monitoring for voice activity detection
  private audioLevelHistory: number[] = []
  private silenceStartTime: number | null = null
  private readonly SILENCE_THRESHOLD = 0.01
  private readonly EXTENDED_SILENCE_MS = 30000 // 30 seconds of silence warning

  constructor(
    private clientSecret: string,
    private eventId: string,
    private eventName: string,
    private eventDescription: string | null,
    private sessionName: string | null,
    private sessionDescription: string | null,
    private onTranscription: (text: string, isFinal: boolean, sequence: number) => void,
    private onError: (error: string) => void,
    private onStatusChange?: (status: 'connecting' | 'connected' | 'reconnecting' | 'error') => void,
    private onAudioLevel?: (level: number) => void,
  ) {}

  async start() {
    try {
      this.onStatusChange?.('connecting')
      this.connectionRetryCount = 0

      // Request audio with optimal settings for speech recognition
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          // Enable noise suppression and echo cancellation for cleaner audio
          echoCancellation: true,
          noiseSuppression: true,
          // Auto gain helps maintain consistent volume levels
          autoGainControl: true,
        },
      })

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
        // Use lower latency for real-time processing
        latencyHint: 'interactive',
      } as AudioContextOptions)

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.sourceNode = source

      this.sessionStartTime = Date.now()

      await this.connectWebSocket()

      await this.initializeAudioProcessing(source)
      this.startAudioSendLoop()
      this.startHeartbeat()
      this.scheduleReconnect()
      
      this.onStatusChange?.('connected')
      console.log("Continuous audio streaming started with optimized settings")
    } catch (error) {
      console.error("Failed to start transcription:", error)
      this.onStatusChange?.('error')
      this.onError(error instanceof Error ? error.message : "Failed to start")
      throw error
    }
  }

  private startAudioSendLoop() {
    // Batch audio data and send at regular intervals for more efficient streaming
    this.audioSendTimer = setInterval(() => {
      this.flushAudioBuffer()
    }, AUDIO_SEND_INTERVAL_MS)
  }

  private flushAudioBuffer() {
    if (!this.isConnected || !this.ws || this.audioBuffer.length === 0 || this.isProcessingAudio) return

    this.isProcessingAudio = true

    try {
      // Combine all buffered audio chunks
      const totalLength = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
      const combinedAudio = new Float32Array(totalLength)
      let offset = 0
      
      for (const chunk of this.audioBuffer) {
        combinedAudio.set(chunk, offset)
        offset += chunk.length
      }
      
      this.audioBuffer = []

      // Calculate audio level for monitoring
      const audioLevel = this.calculateAudioLevel(combinedAudio)
      this.onAudioLevel?.(audioLevel)
      this.monitorSilence(audioLevel)

      // Convert and send
      const int16Data = this.float32ToInt16(combinedAudio)
      const base64Audio = this.arrayBufferToBase64(int16Data.buffer)

      this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }))
      this.lastAudioActivityTime = Date.now()
    } finally {
      this.isProcessingAudio = false
    }
  }

  private calculateAudioLevel(audioData: Float32Array): number {
    let sum = 0
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i]
    }
    return Math.sqrt(sum / audioData.length)
  }

  private monitorSilence(audioLevel: number) {
    this.audioLevelHistory.push(audioLevel)
    if (this.audioLevelHistory.length > 100) {
      this.audioLevelHistory.shift()
    }

    const avgLevel = this.audioLevelHistory.reduce((a, b) => a + b, 0) / this.audioLevelHistory.length

    if (avgLevel < this.SILENCE_THRESHOLD) {
      if (!this.silenceStartTime) {
        this.silenceStartTime = Date.now()
      } else if (Date.now() - this.silenceStartTime > this.EXTENDED_SILENCE_MS) {
        console.warn("Extended silence detected - microphone may be muted or not capturing audio")
        // Reset to avoid repeated warnings
        this.silenceStartTime = Date.now()
      }
    } else {
      this.silenceStartTime = null
    }
  }

  private startHeartbeat() {
    // Monitor connection health
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      
      // Check if we've received any data recently
      if (now - this.lastDeltaTime > 60000 && now - this.lastAudioActivityTime < 5000) {
        // We're sending audio but not getting transcriptions - potential issue
        console.warn("Sending audio but no transcription deltas received in 60s")
      }
    }, 10000)
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

    // Enhanced worklet with larger buffer and gain normalization
    const workletCode = `class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = []
    this.bufferSize = ${AUDIO_BUFFER_SIZE}
  }

  process(inputs) {
    const channelData = inputs?.[0]?.[0]
    if (channelData && channelData.length > 0) {
      // Copy the data to avoid issues with detached buffers
      const copy = new Float32Array(channelData.length)
      copy.set(channelData)
      
      // Accumulate in buffer for smoother processing
      this.buffer.push(...copy)
      
      // Send when we have enough data
      if (this.buffer.length >= this.bufferSize) {
        const toSend = new Float32Array(this.buffer.splice(0, this.bufferSize))
        this.port.postMessage(toSend)
      }
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
      processorOptions: {
        bufferSize: AUDIO_BUFFER_SIZE,
      },
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

    // Use larger buffer size for legacy processor for smoother audio
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    processor.addEventListener("audioprocess", (e) => {
      // Copy the audio data to avoid issues with buffer reuse
      const audioData = new Float32Array(e.inputBuffer.getChannelData(0))
      this.handleAudioChunk(audioData)
    })

    source.connect(processor)
    // Connect to destination to ensure audio processing continues (required for some browsers)
    processor.connect(this.audioContext.destination)
    this.processor = processor
  }

  private handleAudioChunk(audioData: Float32Array) {
    if (!this.isConnected || !this.ws) return

    // Buffer audio for batch sending instead of immediate transmission
    // This reduces network overhead and provides smoother streaming
    this.audioBuffer.push(new Float32Array(audioData))
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
                // Lower threshold for better sensitivity to speech
                threshold: 0.25,
                // More prefix padding captures the start of speech better
                prefix_padding_ms: 400,
                // Shorter silence duration for faster turn completion
                // but not too short to avoid cutting off natural pauses
                silence_duration_ms: 400,
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
      case "session.created":
      case "session.updated": {
        console.log(`Session ${message.type}:`, message.session?.id)
        break
      }

      case "input_audio_buffer.speech_started": {
        // Voice activity detected - user started speaking
        console.log("Speech started detected by server VAD")
        this.silenceStartTime = null
        break
      }

      case "input_audio_buffer.speech_stopped": {
        // Voice activity ended - user stopped speaking
        console.log("Speech stopped detected by server VAD")
        break
      }

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
          const transcript = message.transcript.trim()
          
          // Skip empty transcriptions
          if (!transcript) {
            console.log("Skipping empty completed transcription")
            this.accumulatedText = ""
            this.currentItemId = null
            break
          }

          // Skip very short transcriptions that are likely noise
          if (transcript.length < 2) {
            console.log("Skipping very short transcription:", transcript)
            this.accumulatedText = ""
            this.currentItemId = null
            break
          }
          
          this.lastTranscriptionTime = Date.now()
          this.lastDeltaTime = Date.now()

          const seq = this.sequenceNumber++
          console.log(`Final transcription (seq: ${seq}): "${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}"`)
          
          this.onTranscription(transcript, true, seq)
          this.accumulatedText = ""
          this.currentItemId = null
        }
        break
      }

      case "input_audio_buffer.committed": {
        // Audio buffer was committed for processing
        break
      }

      case "conversation.item.created": {
        // New conversation item created
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
        const errorMessage = message?.error?.message || "OpenAI error"
        
        // Check for recoverable errors
        if (message?.error?.code === 'rate_limit_exceeded') {
          console.warn("Rate limit hit, will continue with buffered audio")
          return
        }
        
        this.onError(errorMessage)
        break
      }

      default:
        // Log unknown message types for debugging
        if (message.type && !message.type.startsWith('response.')) {
          console.log("Unhandled message type:", message.type)
        }
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
    this.onStatusChange?.('reconnecting')
    
    // Flush any remaining audio before reconnecting
    this.flushAudioBuffer()
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }

    // Exponential backoff for reconnection attempts
    const backoffMs = Math.min(1000 * Math.pow(2, this.connectionRetryCount), 10000)
    
    if (this.connectionRetryCount > 0) {
      console.log(`Waiting ${backoffMs}ms before reconnection attempt ${this.connectionRetryCount + 1}`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }

    try {
      await this.connectWebSocket()
      this.sessionStartTime = Date.now()
      this.connectionRetryCount = 0
      this.onStatusChange?.('connected')
      this.scheduleReconnect()
    } catch (error) {
      this.connectionRetryCount++
      
      if (this.connectionRetryCount <= this.maxRetries) {
        console.log(`Reconnection failed, retrying... (${this.connectionRetryCount}/${this.maxRetries})`)
        await this.reconnectWebSocket()
      } else {
        console.error("Max reconnection attempts reached")
        this.onStatusChange?.('error')
        this.onError("Connection lost. Please refresh the page to reconnect.")
      }
    }
  }

  stop() {
    console.log("Stopping transcription - cleaning up resources")

    // Clear all timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.audioSendTimer) {
      clearInterval(this.audioSendTimer)
      this.audioSendTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Flush any remaining audio before stopping
    this.flushAudioBuffer()

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
      this.audioBuffer = []
      this.audioLevelHistory = []
    }
  }

  // Public method to get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      sequenceNumber: this.sequenceNumber,
      sessionDuration: Date.now() - this.sessionStartTime,
      lastTranscriptionTime: this.lastTranscriptionTime,
      connectionRetryCount: this.connectionRetryCount,
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
    const len = bytes.byteLength
    const chunkSize = 0x8000 // 32768
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunkSize) as unknown as number[],
      )
    }
    return btoa(binary)
  }
}
