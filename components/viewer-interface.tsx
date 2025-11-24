"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, Volume2, VolumeX, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LiveTranscriptionDisplay } from "@/components/live-transcription-display"

interface Transcription {
  text: string
  isFinal: boolean
  sequenceNumber: number
  timestamp: string
}

interface ViewerInterfaceProps {
  slug: string
  eventName: string
}

export function ViewerInterface({ slug, eventName }: ViewerInterfaceProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const transcriptionEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string>()

  useEffect(() => {
    console.log("[v0] Setting up Supabase real-time subscription for slug:", slug)

    const setupRealtimeSubscription = async () => {
      const supabase = createClient()

      console.log("[v0] Querying for event with slug:", slug)
      const { data: event, error: eventError } = await supabase.from("events").select("id").eq("slug", slug).single()

      if (eventError) {
        console.error("[v0] Error fetching event:", eventError)
        setIsConnected(false)
        return
      }

      if (!event) {
        console.error("[v0] Event not found for slug:", slug)
        setIsConnected(false)
        return
      }

      console.log("[v0] Found event:", event)

      console.log("[v0] Fetching initial transcriptions for event_id:", event.id)
      const { data: initialTranscriptions, error: transcriptionsError } = await supabase
        .from("transcriptions")
        .select("*")
        .eq("event_id", event.id)
        .order("sequence_number", { ascending: true })

      if (transcriptionsError) {
        console.error("[v0] Error fetching transcriptions:", transcriptionsError)
      }

      console.log("[v0] Initial transcriptions count:", initialTranscriptions?.length || 0)

      if (initialTranscriptions) {
        setTranscriptions(
          initialTranscriptions
            .filter((t) => t.text && t.text.trim() !== "")
            .map((t) => ({
              text: t.text,
              isFinal: t.is_final,
              sequenceNumber: t.sequence_number,
              timestamp: t.created_at,
            })),
        )
      }

      const channelName = `transcriptions-${slug}-${Date.now()}`
      console.log("[v0] Creating channel:", channelName)

      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
            presence: { key: "" },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transcriptions",
            filter: `event_id=eq.${event.id}`,
          },
          (payload) => {
            console.log("[v0] Real-time transcription INSERT received:", payload)
            const newTranscription = payload.new as any

            if (!newTranscription.text || newTranscription.text.trim() === "") {
              console.log("[v0] Skipping empty transcription")
              return
            }

            setTranscriptions((prev) => {
              // Avoid duplicates
              if (prev.some((t) => t.sequenceNumber === newTranscription.sequence_number)) {
                console.log("[v0] Duplicate transcription detected, skipping")
                return prev
              }

              console.log("[v0] Adding new transcription to state:", newTranscription.text)
              return [
                ...prev,
                {
                  text: newTranscription.text,
                  isFinal: newTranscription.is_final,
                  sequenceNumber: newTranscription.sequence_number,
                  timestamp: newTranscription.created_at,
                },
              ].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
            })

            setIsConnected(true)
          },
        )
        .subscribe((status, err) => {
          console.log("[v0] Supabase subscription status:", status)
          if (err) {
            console.error("[v0] Supabase subscription error:", err)
          }
          setIsConnected(status === "SUBSCRIBED")
        })

      return () => {
        console.log("[v0] Cleaning up Supabase subscription")
        supabase.removeChannel(channel)
      }
    }

    const cleanup = setupRealtimeSubscription()

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.())
    }
  }, [slug])

  useEffect(() => {
    sessionIdRef.current = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const supabase = createClient()
    let pingInterval: NodeJS.Timeout

    const setupViewerTracking = async () => {
      console.log("[v0] Setting up viewer tracking for session:", sessionIdRef.current)

      const { data: event } = await supabase.from("events").select("id").eq("slug", slug).single()

      if (!event) return

      // Register viewer session
      await supabase.from("viewer_sessions").insert({
        event_id: event.id,
        session_id: sessionIdRef.current,
        joined_at: new Date().toISOString(),
        last_ping: new Date().toISOString(),
      })

      // Send ping every 15 seconds to show we're still active
      pingInterval = setInterval(async () => {
        await supabase
          .from("viewer_sessions")
          .update({ last_ping: new Date().toISOString() })
          .eq("event_id", event.id)
          .eq("session_id", sessionIdRef.current)
      }, 15000)
    }

    setupViewerTracking()

    return () => {
      clearInterval(pingInterval)
      // Mark session as left
      const cleanup = async () => {
        const { data: event } = await supabase.from("events").select("id").eq("slug", slug).single()
        if (event) {
          await supabase
            .from("viewer_sessions")
            .update({ left_at: new Date().toISOString() })
            .eq("event_id", event.id)
            .eq("session_id", sessionIdRef.current)
        }
      }
      cleanup()
    }
  }, [slug])

  useEffect(() => {
    if (autoScroll && transcriptionEndRef.current) {
      transcriptionEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [transcriptions, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    setAutoScroll(isAtBottom)
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
    a.download = `${slug}-transcript.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const displayTranscriptions = transcriptions.filter((t) => t.text.trim() !== "" && t.isFinal)
  const latestInterim = transcriptions.find((t) => !t.isFinal && t.text.trim() !== "")

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-black border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{eventName}</h1>
              <p className="text-sm text-foreground/60">Live Transcription</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={downloadTranscript}
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent border-border hover:bg-foreground/5"
                disabled={transcriptions.length === 0}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Badge variant={isConnected ? "default" : "secondary"} className="px-3 py-1">
                {isConnected ? (
                  <>
                    <Radio className="h-3 w-3 mr-2 animate-pulse" />
                    Live
                  </>
                ) : (
                  "Offline"
                )}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Transcription Display */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-black border-border">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Live Transcript</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="gap-2 hover:bg-foreground/5"
                >
                  {autoScroll ? (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Auto-scroll on
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4" />
                      Auto-scroll off
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={containerRef} onScroll={handleScroll} className="h-[70vh] overflow-y-auto p-6">
                <LiveTranscriptionDisplay transcriptions={displayTranscriptions} interimText={latestInterim?.text} />
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            <Card className="bg-black border-border">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">
                    {displayTranscriptions.reduce(
                      (count, t) => count + t.text.split(" ").filter((w) => w.length > 0).length,
                      0,
                    )}
                  </p>
                  <p className="text-sm text-foreground/60 mt-1">Words</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
