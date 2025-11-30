"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Copy, Check, Radio, AlertCircle, Download, QrCode, List } from "lucide-react"
import { OpenAITranscriber } from "@/lib/openai-transcriber"
import { LiveTranscriptionDisplay } from "@/components/live-transcription-display"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import QRCode from "qrcode"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { BroadcastMetricsTracker } from "@/lib/metrics"
import { formatMinutesToHoursAndMinutes } from "@/lib/format-time"

interface BroadcastInterfaceProps {
  slug: string
  eventName: string
  eventId: string
  userId: string
}

interface Transcription {
  text: string
  isFinal: boolean
  sequence: number
  timestamp: Date
}

export function BroadcastInterface({ slug, eventName, eventId, userId }: BroadcastInterfaceProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [transcriptionCount, setTranscriptionCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [currentInterim, setCurrentInterim] = useState<string>("")
  const [liveViewers, setLiveViewers] = useState(0)
  const [totalViewers, setTotalViewers] = useState(0)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; name: string; session_number: number; description?: string | null }>>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [lastSequenceNumber, setLastSequenceNumber] = useState(0)
  const transcriberRef = useRef<OpenAITranscriber | null>(null)
  const viewerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/view/${slug}`
  const broadcastChannelRef = useRef<any>(null)
  const lastInterimBroadcastRef = useRef<number>(0)
  const pendingInterimRef = useRef<{ text: string; sequence: number } | null>(null)
  const eventDescriptionRef = useRef<string | null>(null)
  const broadcastMetricsRef = useRef<BroadcastMetricsTracker | null>(null)
  const transcriptionsRef = useRef<Transcription[]>([])
  
  // Keep ref in sync with state
  useEffect(() => {
    transcriptionsRef.current = transcriptions
  }, [transcriptions])

  useEffect(() => {
    if (!isStreaming || !sessionStartTime) return

    const interval = setInterval(() => {
      const duration = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
      setSessionDuration(duration)
    }, 1000)

    return () => clearInterval(interval)
  }, [isStreaming, sessionStartTime])

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const fetchViewerStats = async () => {
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
      const { data: liveSessions } = await supabase
        .from("viewer_sessions")
        .select("id")
        .eq("event_id", eventId)
        .is("left_at", null)
        .gte("last_ping", thirtySecondsAgo)

      setLiveViewers(liveSessions?.length || 0)

      const { data: allSessions } = await supabase.from("viewer_sessions").select("session_id").eq("event_id", eventId)

      const uniqueViewers = new Set(allSessions?.map((s) => s.session_id) || [])
      setTotalViewers(uniqueViewers.size)
    }

    fetchViewerStats()
    const interval = setInterval(fetchViewerStats, 5000)

    return () => clearInterval(interval)
  }, [eventId])

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const fetchCredits = async () => {
      const { data } = await supabase.from("events").select("credits_minutes").eq("id", eventId).single()

      if (data) {
        setCreditsRemaining(data.credits_minutes)
      }
    }

    fetchCredits()
  }, [eventId])

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const fetchSessions = async () => {
      const { data } = await supabase
        .from("event_sessions")
        .select("id, name, session_number, description")
        .eq("event_id", eventId)
        .order("session_number", { ascending: true })

      if (data) {
        setSessions(data)
        // Auto-select first session if available
        if (data.length > 0 && !currentSessionId) {
          setCurrentSessionId(data[0].id)
        }
      }
    }

    fetchSessions()
  }, [eventId, currentSessionId])

  useEffect(() => {
    async function fetchLastSequence() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const { data } = await supabase
        .from("transcriptions")
        .select("sequence_number")
        .eq("session_id", currentSessionId)
        .order("sequence_number", { ascending: false })
        .limit(1)
        .single()

      const lastSeq = data?.sequence_number || 0
      setLastSequenceNumber(lastSeq)
    }

    fetchLastSequence()
  }, [currentSessionId])

  useEffect(() => {
    const initBroadcastChannel = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const channelName = `transcriptions-${slug}`

      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })

      await channel.subscribe()

      broadcastChannelRef.current = channel
    }

    initBroadcastChannel()

    return () => {
      if (broadcastChannelRef.current) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        supabase.removeChannel(broadcastChannelRef.current)
        broadcastChannelRef.current = null
      }
    }
  }, [slug])

  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      if (pendingInterimRef.current && broadcastChannelRef.current) {
        const { text, sequence } = pendingInterimRef.current

        broadcastChannelRef.current.send({
          type: "broadcast",
          event: "interim_transcription",
          payload: {
            text,
            sequence,
            sessionId: currentSessionId,
            timestamp: new Date().toISOString(),
          },
        })

        lastInterimBroadcastRef.current = Date.now()
        pendingInterimRef.current = null
      }
    }, 50) // Reduced throttle from 150ms to 50ms for more responsive interim updates

    return () => clearInterval(interval)
  }, [isStreaming, currentSessionId])

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(viewerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTranscript = () => {
    const sessionName = sessions.find((s) => s.id === currentSessionId)?.name || "transcript"
    const text = transcriptions
      .filter((t) => t.isFinal && t.text.trim() !== "")
      .map((t) => t.text)
      .join(" ")

    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${slug}-${sessionName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const generateQRCode = async () => {
    try {
      const canvas = document.createElement("canvas")
      await QRCode.toCanvas(canvas, viewerUrl, {
        width: 512,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `${slug}-qr-code.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      })
    } catch (error) {
      console.error("Failed to generate QR code:", error)
      setError("Failed to generate QR code. Please try again.")
    }
  }

  const handleTranscription = useCallback(
    async (text: string, isFinal: boolean, sequence: number) => {
      const adjustedSequence = lastSequenceNumber + sequence

      if (isFinal) {
        setTranscriptions((prev) => [
          ...prev,
          { text, isFinal, sequence: adjustedSequence, timestamp: new Date() },
        ])
        setCurrentInterim("")

        pendingInterimRef.current = null
      } else {
        setCurrentInterim(text)

        pendingInterimRef.current = { text, sequence: adjustedSequence }

        const now = Date.now()
        if (now - lastInterimBroadcastRef.current < 50) {
          return
        }
        lastInterimBroadcastRef.current = now
      }

      try {
        if (!isFinal && broadcastChannelRef.current) {
          await broadcastChannelRef.current.send({
            type: "broadcast",
            event: "interim_transcription",
            payload: {
              text,
              sequence: adjustedSequence,
              sessionId: currentSessionId,
              timestamp: new Date().toISOString(),
            },
          })
        }

        if (isFinal) {
          let retries = 3
          let saved = false

          while (retries > 0 && !saved) {
            try {
              const response = await fetch(`/api/stream/${slug}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text,
                  isFinal,
                  sequenceNumber: adjustedSequence,
                  eventName,
                  sessionId: currentSessionId,
                }),
              })

              if (!response.ok) {
                throw new Error(`API returned ${response.status}`)
              }

              const result = await response.json()

              if (result.success && !result.skipped) {
                setTranscriptionCount((prev) => prev + 1)
                setLastSequenceNumber(adjustedSequence)
                console.log(`Final transcription saved successfully (seq: ${adjustedSequence})`)
                saved = true
              } else if (result.skipped) {
                console.warn(`Transcription skipped by API (seq: ${adjustedSequence})`)
                saved = true
              }
            } catch (error) {
              retries--
              console.error(`Failed to save transcription (retries left: ${retries}):`, error)

              if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)))
              } else {
                setError(`Failed to save transcription: "${text.substring(0, 50)}..."`)
              }
            }
          }
        }
      } catch (error) {
        console.error("Error broadcasting transcription:", error)
        if (isFinal) {
          setError(`Failed to save final transcription`)
        }
      }

      if (isFinal && text.trim()) {
        if (broadcastMetricsRef.current) {
          broadcastMetricsRef.current.addTranscription(text)
        }
      }
    },
    [eventId, currentSessionId, lastSequenceNumber, eventName, sessions],
  )

  const handleStartStreaming = async () => {
    try {
      setError(null)

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      // Check if we need to create a default session
      if (sessions.length === 0) {
        const { data: newSession, error: sessionError } = await supabase
          .from("event_sessions")
          .insert({
            event_id: eventId,
            name: "Session 1",
            description: "Auto-created session",
            session_number: 1,
          })
          .select("id, name, session_number")
          .single()

        if (sessionError || !newSession) {
          setError("Failed to create session. Please try creating one manually from the Sessions tab.")
          return
        }

        setSessions([newSession])
        setCurrentSessionId(newSession.id)

        // Give UI time to update before proceeding
        await new Promise((resolve) => setTimeout(resolve, 100))
      } else if (!currentSessionId) {
        setError("Please select a session before starting the broadcast")
        return
      }

      const { data: event } = await supabase
        .from("events")
        .select("credits_minutes, description")
        .eq("id", eventId)
        .single()

      if (!event || event.credits_minutes <= 0) {
        setError(
          "This event has insufficient credits. Please purchase more time for this event to continue broadcasting.",
        )
        return
      }

      const { data: session } = await supabase
        .from("event_sessions")
        .select("name, description, started_at")
        .eq("id", currentSessionId)
        .single()

      const startTime = new Date()
      setSessionStartTime(startTime)

      if (!session?.started_at) {
        await supabase.from("event_sessions").update({ started_at: startTime.toISOString() }).eq("id", currentSessionId)
      }

      if (broadcastChannelRef.current) {
        await broadcastChannelRef.current.send({
          type: "broadcast",
          event: "streaming_status",
          payload: {
            status: "started",
            sessionId: currentSessionId,
            timestamp: startTime.toISOString(),
          },
        })
      }

      const response = await fetch("/api/transcribe-ws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, eventName, sessionId: currentSessionId }),
      })

      if (!response.ok) {
        throw new Error("Failed to initialize transcription session")
      }

      const { clientSecret } = await response.json()

      if (!clientSecret) {
        throw new Error("Failed to obtain OpenAI client secret")
      }

      const transcriber = new OpenAITranscriber(
        clientSecret,
        eventId,
        eventName,
        event.description || null,
        session?.name || null,
        session?.description || null,
        handleTranscription,
        (error) => {
          setError(error)
          setIsStreaming(false)
        },
      )

      await transcriber.start()
      transcriberRef.current = transcriber
      setIsStreaming(true)
      eventDescriptionRef.current = event.description || null

      broadcastMetricsRef.current = new BroadcastMetricsTracker(eventId, currentSessionId)
      await broadcastMetricsRef.current.markSessionStart()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to start streaming")
      setIsStreaming(false)
      setSessionStartTime(null)
    }
  }

  const handleStopStreaming = async () => {
    if (transcriberRef.current) {
      transcriberRef.current.stop()
      transcriberRef.current = null
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const endTime = new Date()

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: "broadcast",
        event: "streaming_status",
        payload: {
          status: "stopped",
          sessionId: currentSessionId,
          timestamp: endTime.toISOString(),
        },
      })
    }

    let durationMinutes = 0

    if (currentSessionId) {
      if (broadcastMetricsRef.current) {
        try {
          durationMinutes = await broadcastMetricsRef.current.endSession()
        } catch (err) {
          console.error("Failed to finalize broadcast metrics:", err)
        } finally {
          broadcastMetricsRef.current = null
        }
      } else if (sessionStartTime) {
        durationMinutes = Math.max(1, Math.ceil((endTime.getTime() - sessionStartTime.getTime()) / 60000))
        await supabase
          .from("event_sessions")
          .update({
            ended_at: endTime.toISOString(),
            duration_minutes: durationMinutes,
          })
          .eq("id", currentSessionId)
      } else {
        await supabase
          .from("event_sessions")
          .update({ ended_at: endTime.toISOString() })
          .eq("id", currentSessionId)
      }

      if (durationMinutes > 0) {
        const { error: deductError } = await supabase.rpc("deduct_event_credits", {
          p_event_id: eventId,
          p_duration_minutes: durationMinutes,
        })

        if (deductError) {
          console.error("Failed to deduct credits:", deductError)
        } else {
          const { data: event } = await supabase.from("events").select("credits_minutes").eq("id", eventId).single()

          if (event) {
            setCreditsRemaining(event.credits_minutes)
          }
        }
      }
    }

    setIsStreaming(false)
    setSessionStartTime(null)
    setSessionDuration(0)
  }

  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stop()
      }
    }
  }, [])

  const displayTranscriptions = transcriptions
    .filter((t) => t.text.trim() !== "" && t.isFinal)
    .map((t) => ({
      text: t.text,
      timestamp: t.timestamp.toISOString(),
      isFinal: t.isFinal,
    }))
  const interimText = currentInterim.trim() !== "" ? currentInterim : undefined

  const advancedAudioFeatures = [
    {
      label: "Noise suppression",
      value: "Auto-enabled",
      description: "Browser capture enforces acoustic echo cancellation and noise filtering.",
    },
    {
      label: "Gain control",
      value: "Stabilized",
      description: "Automatic gain keeps speech between -18 dBFS and -6 dBFS so quiet speakers stay audible.",
    },
    {
      label: "Silence gating",
      value: "Adaptive",
      description: "Low-RMS frames are dropped so the model only receives voiced segments.",
    },
  ]

  const advancedAudioTips = [
    "Place the microphone within 30 cm of the active speaker to reduce room noise.",
    "Use cardioid or headset mics in noisy rooms; avoid laptop mics sitting next to fans.",
    "Keep your OS input level so the loudest peaks sit below the red clip indicator.",
    "Mute unused conferencing apps so they do not compete for the microphone.",
    "Monitor the live captions; if you see repeated [unclear], pause and adjust mic placement.",
  ]

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{eventName}</h1>
            <p className="text-slate-400">Organizer Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            {creditsRemaining !== null && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                {formatMinutesToHoursAndMinutes(creditsRemaining)} remaining
              </Badge>
            )}
            <Badge variant={isStreaming ? "default" : "secondary"} className="text-lg px-4 py-2">
              {isStreaming ? (
                <>
                  <Radio className="h-4 w-4 mr-2 animate-pulse" />
                  Live
                </>
              ) : (
                "Offline"
              )}
            </Badge>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Viewer URL</CardTitle>
            <CardDescription>Share this URL with attendees so they can view the live transcription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                value={viewerUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
              />
              <Button onClick={copyToClipboard} variant="outline">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button onClick={generateQRCode} variant="outline" className="gap-2 bg-transparent">
                <QrCode className="h-4 w-4" />
                QR Code
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Session Selection</CardTitle>
                <CardDescription>Choose which session to broadcast</CardDescription>
              </div>
              <Link href={`/sessions/${slug}`}>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <List className="h-4 w-4" />
                  Manage Sessions
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <Select value={currentSessionId || undefined} onValueChange={setCurrentSessionId} disabled={isStreaming}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    Session {session.session_number}: {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No sessions found. Create a session first.</p>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Audio Stream</CardTitle>
            <CardDescription>Control your live audio broadcast and transcription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              {!isStreaming ? (
                <Button onClick={handleStartStreaming} size="lg" className="flex-1 gap-2">
                  <Mic className="h-5 w-5" />
                  Start Streaming
                </Button>
              ) : (
                <Button onClick={handleStopStreaming} size="lg" variant="destructive" className="flex-1 gap-2">
                  <MicOff className="h-5 w-5" />
                  Stop Streaming
                </Button>
              )}
            </div>

            {isStreaming && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-background border border-border rounded-md">
                    <div className="text-sm text-foreground/60 mb-1">Live Viewers</div>
                    <div className="text-2xl font-bold text-foreground">{liveViewers}</div>
                  </div>
                  <div className="p-4 bg-background border border-border rounded-md">
                    <div className="text-sm text-foreground/60 mb-1">Total Viewers</div>
                    <div className="text-2xl font-bold text-foreground">{totalViewers}</div>
                  </div>
                </div>
                <div className="p-4 bg-background border border-border rounded-md">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-foreground/60">Session Time:</span>
                    <span className="font-semibold text-foreground font-mono">{formatDuration(sessionDuration)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground/60">Transcriptions sent:</span>
                    <span className="font-semibold text-foreground">{transcriptionCount}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Advanced Audio Guidance</CardTitle>
            <CardDescription>Built-in safeguards plus best practices to maximize transcription accuracy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {advancedAudioFeatures.map((feature) => (
                <div key={feature.label} className="p-4 bg-background border border-border rounded-md h-full">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-foreground text-sm">{feature.label}</p>
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      {feature.value}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground/70 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Room & device checklist</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
                {advancedAudioTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {transcriptions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transcription History</CardTitle>
                  <CardDescription>Live transcription of your audio stream</CardDescription>
                </div>
                <Button onClick={downloadTranscript} variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[60vh] overflow-y-auto p-6 bg-background rounded-md border border-border">
                <LiveTranscriptionDisplay transcriptions={displayTranscriptions} interimText={interimText} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Event Slug:</span>
              <span className="font-mono">{slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Status:</span>
              <span>{isStreaming ? "Streaming" : "Offline"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Transcriptions:</span>
              <span>{transcriptions.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
