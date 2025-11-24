"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Copy, Check, Radio, AlertCircle, Download } from "lucide-react"
import { OpenAITranscriber } from "@/lib/openai-transcriber"
import { LiveTranscriptionDisplay } from "@/components/live-transcription-display"
import { createClient } from "@/lib/supabase/client" // Fixed import path for Supabase client

interface BroadcastInterfaceProps {
  slug: string
  eventName: string
  eventId: string
}

interface Transcription {
  text: string
  isFinal: boolean
  sequence: number
  timestamp: Date
}

export function BroadcastInterface({ slug, eventName, eventId }: BroadcastInterfaceProps) {
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

  const transcriberRef = useRef<OpenAITranscriber | null>(null)
  const transcriptionsEndRef = useRef<HTMLDivElement>(null)

  const viewerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/view/${slug}`

  useEffect(() => {
    transcriptionsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcriptions, currentInterim])

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
      // Get live viewers (active in last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
      const { data: liveSessions } = await supabase
        .from("viewer_sessions")
        .select("id")
        .eq("event_id", eventId)
        .is("left_at", null)
        .gte("last_ping", thirtySecondsAgo)

      setLiveViewers(liveSessions?.length || 0)

      // Get total unique viewers
      const { data: allSessions } = await supabase.from("viewer_sessions").select("session_id").eq("event_id", eventId)

      const uniqueViewers = new Set(allSessions?.map((s) => s.session_id) || [])
      setTotalViewers(uniqueViewers.size)
    }

    fetchViewerStats()
    const interval = setInterval(fetchViewerStats, 5000)

    return () => clearInterval(interval)
  }, [eventId])

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(viewerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTranscript = () => {
    const text = transcriptions
      .filter((t) => t.isFinal && t.text.trim() !== "")
      .map((t) => t.text)
      .join(" ")

    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${slug}-transcript-${new Date().toISOString()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleTranscription = async (text: string, isFinal: boolean, sequence: number) => {
    console.log("[v0] Transcription received:", { text, isFinal, sequence })

    if (isFinal) {
      setTranscriptions((prev) => [...prev, { text, isFinal, sequence, timestamp: new Date() }])
      setCurrentInterim("")
    } else {
      setCurrentInterim(text)
    }

    if (!isFinal) {
      console.log("[v0] Skipping interim transcription broadcast")
      return
    }

    try {
      console.log("[v0] Sending transcription to API:", { text, isFinal, sequence, slug })

      const response = await fetch(`/api/stream/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          isFinal,
          sequenceNumber: sequence,
          eventName,
        }),
      })

      if (!response.ok) {
        console.error("[v0] Failed to broadcast transcription:", response.status)
        const errorText = await response.text()
        console.error("[v0] Error response:", errorText)
      } else {
        const data = await response.json()
        console.log("[v0] Broadcasted successfully. Server response:", data)
        setTranscriptionCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error("[v0] Error broadcasting transcription:", error)
    }
  }

  const handleStartStreaming = async () => {
    try {
      setError(null)
      setSessionStartTime(new Date())

      const response = await fetch("/api/transcribe-ws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, eventName }),
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

  const handleStopStreaming = () => {
    if (transcriberRef.current) {
      transcriberRef.current.stop()
      transcriberRef.current = null
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

        {/* Viewer URL Card */}
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
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
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

        {/* Streaming Controls */}
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

        {/* Info Card */}
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
