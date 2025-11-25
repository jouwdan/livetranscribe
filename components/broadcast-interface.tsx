"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Copy, Check, Radio, AlertCircle, Download, QrCode, List } from "lucide-react"
import { OpenAITranscriber } from "@/lib/openai-transcriber"
import { LiveTranscriptionDisplay } from "@/components/live-transcription-display"
import { createClient } from "@/lib/supabase/client"
import QRCode from "qrcode"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

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
  const [sessions, setSessions] = useState<Array<{ id: string; name: string; session_number: number }>>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [lastSequenceNumber, setLastSequenceNumber] = useState(0)

  const transcriberRef = useRef<OpenAITranscriber | null>(null)
  const viewerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/view/${slug}`

  useEffect(() => {
    if (!isStreaming || !sessionStartTime) return

    const interval = setInterval(() => {
      const duration = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
      setSessionDuration(duration)
    }, 1000)

    return () => clearInterval(interval)
  }, [isStreaming, sessionStartTime])

  useEffect(() => {
    const supabase = createClient()

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
    const fetchCredits = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("events").select("credits_minutes").eq("id", eventId).single()

      if (data) {
        setCreditsRemaining(data.credits_minutes)
      }
    }

    fetchCredits()
  }, [eventId])

  useEffect(() => {
    const fetchSessions = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("event_sessions")
        .select("id, name, session_number")
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
    const fetchLastSequence = async () => {
      if (!currentSessionId) return

      const supabase = createClient()
      const { data } = await supabase
        .from("transcriptions")
        .select("sequence_number")
        .eq("session_id", currentSessionId)
        .order("sequence_number", { ascending: false })
        .limit(1)
        .single()

      const lastSeq = data?.sequence_number || 0
      setLastSequenceNumber(lastSeq)
      console.log("[v0] Last sequence number for session:", lastSeq)
    }

    fetchLastSequence()
  }, [currentSessionId])

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
      console.error("[v0] Failed to generate QR code:", error)
      setError("Failed to generate QR code. Please try again.")
    }
  }

  const handleTranscription = async (text: string, isFinal: boolean, sequence: number) => {
    const adjustedSequence = lastSequenceNumber + sequence

    console.log("[v0] Broadcasting transcription:", {
      text: text.substring(0, 50),
      isFinal,
      sequence: adjustedSequence,
      sessionId: currentSessionId,
    })

    if (isFinal) {
      setTranscriptions((prev) => [...prev, { text, isFinal, sequence: adjustedSequence, timestamp: new Date() }])
      setCurrentInterim("")
    } else {
      setCurrentInterim(text)
    }

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
        console.error("[v0] Failed to broadcast transcription:", response.status)
        const errorText = await response.text()
        console.error("[v0] Error response:", errorText)
      } else {
        const result = await response.json()
        if (isFinal && !result.skipped) {
          setTranscriptionCount((prev) => prev + 1)
          setLastSequenceNumber(adjustedSequence)
        }
      }
    } catch (error) {
      console.error("[v0] Error broadcasting transcription:", error)
    }
  }

  const handleStartStreaming = async () => {
    try {
      setError(null)

      if (!currentSessionId) {
        setError("Please select a session before starting the broadcast.")
        return
      }

      const supabase = createClient()
      const { data: event } = await supabase.from("events").select("credits_minutes").eq("id", eventId).single()

      if (!event || event.credits_minutes <= 0) {
        setError(
          "This event has insufficient credits. Please purchase more time for this event to continue broadcasting.",
        )
        return
      }

      const startTime = new Date()
      setSessionStartTime(startTime)

      const { data: existingSession } = await supabase
        .from("event_sessions")
        .select("started_at")
        .eq("id", currentSessionId)
        .single()

      if (!existingSession?.started_at) {
        await supabase.from("event_sessions").update({ started_at: startTime.toISOString() }).eq("id", currentSessionId)
      }

      const channel = supabase.channel(`event-${slug}`)
      await channel.send({
        type: "broadcast",
        event: "streaming_status",
        payload: {
          status: "started",
          sessionId: currentSessionId,
          timestamp: startTime.toISOString(),
        },
      })

      const response = await fetch("/api/transcribe-ws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, eventName, sessionId: currentSessionId }),
      })

      if (!response.ok) {
        throw new Error("Failed to initialize transcription session")
      }

      const { apiKey } = await response.json()

      const transcriber = new OpenAITranscriber(apiKey, eventId, handleTranscription, (error) => {
        setError(error)
        setIsStreaming(false)
      })

      await transcriber.start()
      transcriberRef.current = transcriber
      setIsStreaming(true)
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

    if (sessionStartTime && currentSessionId) {
      const endTime = new Date()
      const durationMinutes = Math.ceil((endTime.getTime() - sessionStartTime.getTime()) / 60000)

      const supabase = createClient()

      const channel = supabase.channel(`event-${slug}`)
      await channel.send({
        type: "broadcast",
        event: "streaming_status",
        payload: {
          status: "stopped",
          sessionId: currentSessionId,
          timestamp: endTime.toISOString(),
        },
      })

      await supabase
        .from("event_sessions")
        .update({
          ended_at: endTime.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq("id", currentSessionId)

      const { error: deductError } = await supabase.rpc("deduct_event_credits", {
        p_event_id: eventId,
        p_duration_minutes: durationMinutes,
      })

      if (deductError) {
        console.error("[v0] Failed to deduct credits:", deductError)
      } else {
        const { data: event } = await supabase.from("events").select("credits_minutes").eq("id", eventId).single()

        if (event) {
          setCreditsRemaining(event.credits_minutes)
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
                {creditsRemaining} min remaining
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
