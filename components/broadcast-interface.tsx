"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Radio, Mic, MicOff } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { OpenAITranscriber } from "@/lib/openai-transcriber"

interface BroadcastInterfaceProps {
  eventId: string
  eventSlug: string
  eventName: string
  eventDescription: string | null
  organizerKey: string
}

export function BroadcastInterface({ eventId, eventSlug, eventName, organizerKey }: BroadcastInterfaceProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentViewerCount, setCurrentViewerCount] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null)
  const transcriberRef = useRef<OpenAITranscriber | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const eventDescriptionRef = useRef<string | null>(null)

  useEffect(() => {
    const initBroadcastChannel = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const channelName = `transcriptions-${eventSlug}`

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
  }, [eventSlug])

  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      const now = Date.now()
      if (sessionStartTime) {
        const duration = Math.floor((now - sessionStartTime.getTime()) / 1000)
        setElapsedTime(duration)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isStreaming, sessionStartTime])

  const handleStartStreaming = async () => {
    try {
      setError(null)

      if (!currentSessionId) {
        setError("Please select a session before starting the broadcast")
        return
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const { data: event } = await supabase.from("events").select("description").eq("id", eventId).single()

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
        broadcastChannelRef.current.send({
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
        body: JSON.stringify({ slug: eventSlug, eventName, sessionId: currentSessionId }),
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
        () => {}, // Placeholder for handleTranscription
        (error) => {
          setError(error)
          setIsStreaming(false)
        },
      )

      await transcriber.start()
      transcriberRef.current = transcriber
      setIsStreaming(true)
      eventDescriptionRef.current = event.description || null
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

    if (currentSessionId) {
      if (sessionStartTime) {
        const durationMinutes = Math.max(1, Math.ceil((endTime.getTime() - sessionStartTime.getTime()) / 60000))
        await supabase
          .from("event_sessions")
          .update({
            ended_at: endTime.toISOString(),
            duration_minutes: durationMinutes,
          })
          .eq("id", currentSessionId)
      } else {
        await supabase.from("event_sessions").update({ ended_at: endTime.toISOString() }).eq("id", currentSessionId)
      }
    }

    setIsStreaming(false)
    setSessionStartTime(null)
    setElapsedTime(0)
  }

  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stop()
      }
    }
  }, [])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-white">{eventName}</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isStreaming ? "default" : "secondary"} className="text-lg px-4 py-2">
              {isStreaming ? (
                <>
                  <Radio className="h-4 w-4 mr-2 animate-pulse" />
                  LIVE
                </>
              ) : (
                "OFFLINE"
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
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
                  <div className="text-2xl font-bold text-foreground">{currentViewerCount}</div>
                </div>
              </div>
              <div className="p-4 bg-background border border-border rounded-md">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-foreground/60">Session Time:</span>
                  <span className="font-semibold text-foreground font-mono">{formatDuration(elapsedTime)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
