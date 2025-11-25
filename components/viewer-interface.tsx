"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, ArrowDownToLine, Pause, Monitor, Smartphone, Tv } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Transcription {
  id: string
  text: string
  isFinal: boolean
  sequenceNumber: number
  timestamp: Date
  sessionId?: string
}

interface ViewerInterfaceProps {
  slug: string
  eventName: string
  eventDescription?: string
}

type DisplayMode = "laptop" | "mobile" | "stage"

export function ViewerInterface({ slug, eventName, eventDescription }: ViewerInterfaceProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [currentInterim, setCurrentInterim] = useState<Transcription | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingStatusMessage, setStreamingStatusMessage] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState<"laptop" | "mobile" | "stage">("laptop")
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const transcriptionsViewedRef = useRef(0)
  const lastTranscriptionTimeRef = useRef(Date.now())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestSequenceRef = useRef(0)
  const [currentSession, setCurrentSession] = useState<any | null>(null)
  const [description, setDescription] = useState<string | null>(eventDescription)

  useEffect(() => {
    console.log("[v0] Setting up Supabase real-time subscription for slug:", slug)
    let channel: any = null
    let pollInterval: NodeJS.Timeout | null = null
    let isSubscribed = true

    const setupRealtimeSubscription = async () => {
      const supabase = createClient()

      console.log("[v0] Querying for event with slug:", slug)
      const { data: event, error: eventError } = await supabase.from("events").select("id").eq("slug", slug).single()

      if (eventError || !event) {
        console.error("[v0] Error fetching event:", eventError)
        setIsConnected(false)
        return
      }

      console.log("[v0] Found event:", event)

      console.log("[v0] Fetching initial transcriptions for event_id:", event.id)
      const { data: initialTranscriptions, error: transcriptionsError } = await supabase
        .from("transcriptions")
        .select("*, event_sessions(name, session_number)")
        .eq("event_id", event.id)
        .eq("is_final", true)
        .order("sequence_number", { ascending: true })

      if (transcriptionsError) {
        console.error("[v0] Error fetching transcriptions:", transcriptionsError)
      }

      console.log("[v0] Initial transcriptions count:", initialTranscriptions?.length || 0)

      if (initialTranscriptions && isSubscribed) {
        const filtered = initialTranscriptions.filter((t) => t.text && t.text.trim() !== "")
        setTranscriptions(
          filtered.map((t) => ({
            id: t.id,
            text: t.text,
            isFinal: t.is_final,
            sequenceNumber: t.sequence_number,
            timestamp: new Date(t.created_at),
            sessionId: t.session_id,
          })),
        )
        transcriptionsViewedRef.current = filtered.filter((t) => t.is_final).length
        if (filtered.length > 0) {
          latestSequenceRef.current = Math.max(...filtered.map((t) => t.sequence_number))
        }
      }

      const channelName = `transcriptions-${slug}`
      console.log("[v0] Creating channel:", channelName)

      channel = supabase
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
          async (payload) => {
            if (!isSubscribed) return

            console.log("[v0] Real-time transcription INSERT received:", payload)
            const newTranscription = payload.new as any

            lastTranscriptionTimeRef.current = Date.now()

            if (!newTranscription.text || newTranscription.text.trim() === "") {
              console.log("[v0] Skipping empty transcription")
              return
            }

            let sessionInfo = null
            if (newTranscription.session_id) {
              const { data: sessionData } = await supabase
                .from("event_sessions")
                .select("name, session_number")
                .eq("id", newTranscription.session_id)
                .single()
              sessionInfo = sessionData
            }

            setTranscriptions((prev) => {
              if (
                prev.some((t) => t.sequenceNumber === newTranscription.sequence_number) ||
                newTranscription.sequence_number <= latestSequenceRef.current
              ) {
                console.log("[v0] Duplicate transcription detected, skipping")
                return prev
              }

              console.log("[v0] Adding new transcription to state:", newTranscription.text)

              if (newTranscription.is_final) {
                transcriptionsViewedRef.current += 1
              }

              latestSequenceRef.current = Math.max(latestSequenceRef.current, newTranscription.sequence_number)

              const newItem = {
                id: newTranscription.id,
                text: newTranscription.text,
                isFinal: newTranscription.is_final,
                sequenceNumber: newTranscription.sequence_number,
                timestamp: new Date(newTranscription.created_at),
                sessionId: newTranscription.session_id,
                sessionInfo,
              }

              return [...prev, newItem].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            })

            setIsConnected(true)
          },
        )
        .on("broadcast", { event: "streaming_status" }, (payload: any) => {
          console.log("[v0] Received streaming status:", payload)
          const { status, sessionId, timestamp } = payload.payload

          if (status === "started") {
            setIsStreaming(true)
            setStreamingStatusMessage("Streaming started")
            // Clear message after 5 seconds
            setTimeout(() => setStreamingStatusMessage(null), 5000)
          } else if (status === "stopped") {
            setIsStreaming(false)
            setStreamingStatusMessage("Streaming stopped")
            // Clear message after 5 seconds
            setTimeout(() => setStreamingStatusMessage(null), 5000)
          }
        })
        .subscribe((status, err) => {
          console.log("[v0] Supabase subscription status:", status)
          if (err) {
            console.error("[v0] Supabase subscription error:", err)
          }
          if (isSubscribed) {
            setIsConnected(status === "SUBSCRIBED")
          }
        })

      pollInterval = setInterval(async () => {
        if (!isSubscribed) return

        const timeSinceLastTranscription = Date.now() - lastTranscriptionTimeRef.current

        if (timeSinceLastTranscription > 5000) {
          const lastSequence = latestSequenceRef.current

          const { data: newTranscriptions } = await supabase
            .from("transcriptions")
            .select("*, event_sessions(name, session_number)")
            .eq("event_id", event.id)
            .gt("sequence_number", lastSequence)
            .eq("is_final", true)
            .order("sequence_number", { ascending: true })

          if (newTranscriptions && newTranscriptions.length > 0) {
            console.log("[v0] Polling found missed transcriptions:", newTranscriptions.length)
            setTranscriptions((prev) => {
              const newItems = newTranscriptions
                .filter(
                  (t) =>
                    t.text &&
                    t.text.trim() !== "" &&
                    !prev.some((p) => p.sequenceNumber === t.sequence_number) &&
                    t.sequence_number > latestSequenceRef.current,
                )
                .map((t) => ({
                  id: t.id,
                  text: t.text,
                  isFinal: t.is_final,
                  sequenceNumber: t.sequence_number,
                  timestamp: new Date(t.created_at),
                  sessionId: t.session_id,
                  sessionInfo: t.event_sessions,
                }))

              if (newItems.length > 0) {
                lastTranscriptionTimeRef.current = Date.now()
                transcriptionsViewedRef.current += newItems.filter((t) => t.isFinal).length
                latestSequenceRef.current = Math.max(
                  latestSequenceRef.current,
                  ...newItems.map((t) => t.sequenceNumber),
                )
              }

              return [...prev, ...newItems].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            })
          }
        }
      }, 2000)
    }

    setupRealtimeSubscription()

    return () => {
      console.log("[v0] Cleaning up Supabase subscription")
      isSubscribed = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      if (channel) {
        const supabase = createClient()
        supabase.removeChannel(channel)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [slug])

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Handle visibility change logic here
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  useEffect(() => {
    const activityInterval = setInterval(() => {
      // Handle activity interval logic here
    }, 1000)

    return () => clearInterval(activityInterval)
  }, [])

  useEffect(() => {
    const sessionId = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const supabase = createClient()
    let pingInterval: NodeJS.Timeout | null = null

    const setupViewerTracking = async () => {
      console.log("[v0] Setting up viewer tracking for session:", sessionId)

      const { data: event } = await supabase.from("events").select("id").eq("slug", slug).single()

      if (!event) return

      await supabase.from("viewer_sessions").insert({
        event_id: event.id,
        session_id: sessionId,
        joined_at: new Date().toISOString(),
        last_ping: new Date().toISOString(),
        scroll_events: 0,
        visibility_changes: 0,
        total_active_time_seconds: 0,
        transcriptions_viewed: 0,
      })

      pingInterval = setInterval(async () => {
        await supabase
          .from("viewer_sessions")
          .update({
            last_ping: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
            scroll_events: 0,
            visibility_changes: 0,
            total_active_time_seconds: 0,
            transcriptions_viewed: 0,
          })
          .eq("event_id", event.id)
          .eq("session_id", sessionId)
      }, 15000)
    }

    setupViewerTracking()

    return () => {
      clearInterval(pingInterval)
      const cleanup = async () => {
        const { data: event } = await supabase.from("events").select("id").eq("slug", slug).single()
        if (event) {
          await supabase
            .from("viewer_sessions")
            .update({
              left_at: new Date().toISOString(),
              scroll_events: 0,
              visibility_changes: 0,
              total_active_time_seconds: 0,
              transcriptions_viewed: 0,
            })
            .eq("event_id", event.id)
            .eq("session_id", sessionId)
        }
      }
      cleanup()
    }
  }, [slug])

  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      scrollAreaRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [transcriptions, autoScroll])

  const handleScroll = () => {
    if (!scrollAreaRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    setAutoScroll(isAtBottom)
  }

  const displayTranscriptions = transcriptions.filter((t) => t.text.trim() !== "" && t.isFinal)
  const latestInterim = transcriptions.find((t) => !t.isFinal && t.text.trim() !== "")

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const groupTranscriptionsBySessionAndTime = (transcriptions: Transcription[]) => {
    const sorted = [...transcriptions].sort((a, b) => {
      return a.timestamp.getTime() - b.timestamp.getTime()
    })

    const groups: Array<{
      timestamp: Date
      texts: string[]
      sessionId?: string
      sessionInfo?: any
      isSessionStart?: boolean
    }> = []

    let lastSessionId: string | undefined = undefined

    sorted.forEach((curr, index) => {
      const isNewSession = curr.sessionId && curr.sessionId !== lastSessionId

      if (index === 0 || isNewSession) {
        groups.push({
          timestamp: curr.timestamp,
          texts: [curr.text],
          sessionId: curr.sessionId,
          sessionInfo: curr.sessionInfo,
          isSessionStart: isNewSession && index > 0,
        })
        lastSessionId = curr.sessionId
      } else {
        const prevTimestamp = sorted[index - 1].timestamp.getTime()
        const currTimestamp = curr.timestamp.getTime()
        const timeDiff = (currTimestamp - prevTimestamp) / 1000

        if (timeDiff > 10) {
          groups.push({
            timestamp: curr.timestamp,
            texts: [curr.text],
            sessionId: curr.sessionId,
            sessionInfo: curr.sessionInfo,
            isSessionStart: false,
          })
        } else {
          groups[groups.length - 1].texts.push(curr.text)
        }
      }
    })

    return groups
  }

  const groupedTranscriptions = groupTranscriptionsBySessionAndTime(
    transcriptions.filter((t) => t.isFinal && t.text.trim() !== ""),
  )

  if (displayMode === "stage") {
    return (
      <div className="flex flex-col h-screen bg-black overflow-hidden">
        <div className="bg-black border-b border-purple-500/30 flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={isConnected ? "default" : "secondary"} className="px-3 py-1.5 text-base">
                  {isConnected ? (
                    <>
                      <Radio className="h-4 w-4 mr-2 animate-pulse" />
                      LIVE
                    </>
                  ) : (
                    "OFFLINE"
                  )}
                </Badge>
                {isStreaming && (
                  <Badge variant="default" className="px-3 py-1.5 text-base bg-green-600">
                    Broadcasting
                  </Badge>
                )}
                <h1 className="text-2xl font-bold text-white">{eventName}</h1>
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="h-8 px-3 gap-1.5 hover:bg-foreground/5 text-white text-xs"
                >
                  {autoScroll ? (
                    <>
                      <ArrowDownToLine className="h-3 w-3" />
                      Auto
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3" />
                      Paused
                    </>
                  )}
                </Button>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayMode("laptop")}
                    className="h-8 w-8 p-0 hover:bg-foreground/5 text-white"
                  >
                    <Monitor className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayMode("mobile")}
                    className="h-8 w-8 p-0 hover:bg-foreground/5 text-white"
                  >
                    <Smartphone className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-purple-500/30 bg-purple-500/10 text-white"
                  >
                    <Tv className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-12 py-8">
          <div ref={scrollAreaRef} onScroll={handleScroll} className="h-full overflow-y-auto">
            {latestInterim && (
              <div className="mb-12 p-8 bg-purple-500/10 border-l-4 border-purple-500 rounded-lg">
                <p className="text-5xl md:text-6xl lg:text-7xl font-medium text-white leading-tight tracking-wide">
                  {latestInterim.text}
                </p>
              </div>
            )}

            <div className="space-y-8">
              {groupedTranscriptions.slice(-5).map((group, index) => (
                <div key={index}>
                  {group.isSessionStart && group.sessionInfo && (
                    <div className="mb-6 py-4 px-6 bg-purple-500/30 border-2 border-purple-400/50 rounded-xl">
                      <div className="flex items-center gap-3 text-purple-200 text-2xl font-bold">
                        <Radio className="h-6 w-6" />
                        New Session: {group.sessionInfo.name}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-sm text-purple-400/60 uppercase tracking-wider">
                      {formatTimestamp(group.timestamp)}
                    </div>
                    <div className="text-5xl md:text-6xl lg:text-7xl leading-tight text-white font-bold space-y-4">
                      {group.texts.map((text, i) => (
                        <p key={i}>{text}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {streamingStatusMessage && (
          <div className="mt-4 p-4 rounded-lg bg-purple-500/20 border-2 border-purple-500/50 text-center">
            <p className="text-2xl text-purple-100 font-bold">{streamingStatusMessage}</p>
          </div>
        )}

        {currentSession && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-md">
            <span className="text-lg font-medium text-purple-200">Current Session:</span>
            <span className="text-lg text-purple-100">
              Session {currentSession.session_number}: {currentSession.name}
            </span>
          </div>
        )}

        <div className="bg-black border-t border-purple-500/30 flex-shrink-0">
          <div className="px-8 py-4">
            <p className="text-center text-sm text-foreground/40">
              Powered by <span className="text-purple-400">LiveTranscribe</span> and AI
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (displayMode === "mobile") {
    return (
      <div className="flex flex-col h-screen bg-black overflow-hidden">
        <div className="bg-black border-b border-border flex-shrink-0">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Badge variant={isConnected ? "default" : "secondary"} className="px-2 py-1 text-xs flex-shrink-0">
                  {isConnected ? (
                    <>
                      <Radio className="h-3 w-3 mr-1 animate-pulse" />
                      Live
                    </>
                  ) : (
                    "Offline"
                  )}
                </Badge>
                {isStreaming && (
                  <Badge variant="default" className="px-2 py-1 text-xs flex-shrink-0 bg-green-600">
                    On Air
                  </Badge>
                )}
                <h1 className="text-base font-bold text-white truncate">{eventName}</h1>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="h-8 w-8 hover:bg-foreground/5"
                >
                  {autoScroll ? <ArrowDownToLine className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDisplayMode("laptop")}
                  className="h-8 w-8 hover:bg-foreground/5"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDisplayMode("stage")}
                  className="h-8 w-8 hover:bg-foreground/5"
                >
                  <Tv className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {description && <p className="text-sm text-slate-300 mb-3">{description}</p>}
            {currentSession && (
              <div className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-md">
                <span className="text-xs font-medium text-purple-200">Session:</span>
                <span className="text-xs text-purple-100">
                  {currentSession.session_number}. {currentSession.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {streamingStatusMessage && (
          <div className="mt-3 p-2 rounded-md bg-purple-500/20 border border-purple-500/30 text-center">
            <p className="text-sm text-purple-200 font-medium">{streamingStatusMessage}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div ref={scrollAreaRef} onScroll={handleScroll} className="space-y-4">
              {latestInterim && (
                <div className="p-4 bg-purple-500/20 border-l-2 border-purple-500 rounded">
                  <p className="text-lg font-medium text-white leading-relaxed">{latestInterim.text}</p>
                </div>
              )}

              {groupedTranscriptions.map((group, index) => (
                <div key={index}>
                  {group.isSessionStart && group.sessionInfo && (
                    <div className="mb-3 py-2 px-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                      <div className="flex items-center gap-2 text-purple-300 text-sm font-semibold">
                        <Radio className="h-3 w-3" />
                        New Session: {group.sessionInfo.name}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-xs text-purple-400/60 uppercase tracking-wide">
                      {formatTimestamp(group.timestamp)}
                    </div>
                    <div className="text-base leading-relaxed text-foreground space-y-1">
                      {group.texts.map((text, i) => (
                        <p key={i}>{text}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-black border-t border-border flex-shrink-0">
          <div className="px-4 py-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? <ArrowDownToLine className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <p className="text-xs text-foreground/40">
              <span className="text-purple-400">LiveTranscribe</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      <div className="bg-black border-b border-border flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{eventName}</h1>
              {description && <p className="text-sm text-foreground/60 mt-1">{description}</p>}
              {!description && <p className="text-sm text-foreground/60">Live Transcription</p>}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
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
              {isStreaming && (
                <Badge variant="default" className="px-3 py-1 bg-green-600">
                  Broadcasting
                </Badge>
              )}
              <div className="flex gap-1 border-l border-border pl-3">
                <Button variant="outline" size="sm" className="gap-2 border-purple-500/30 bg-purple-500/10">
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-foreground/5 flex-shrink-0"
                  onClick={() => setDisplayMode("mobile")}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-foreground/5 flex-shrink-0"
                  onClick={() => setDisplayMode("stage")}
                >
                  <Tv className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {streamingStatusMessage && (
        <div className="mt-4 p-4 rounded-lg bg-purple-500/20 border-2 border-purple-500/50 text-center">
          <p className="text-2xl text-purple-100 font-bold">{streamingStatusMessage}</p>
        </div>
      )}

      {currentSession && (
        <div className="mt-3 flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-md">
          <span className="text-lg font-medium text-purple-200">Current Session:</span>
          <span className="text-lg text-purple-100">
            Session {currentSession.session_number}: {currentSession.name}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto h-full">
          <Card className="bg-black border-border h-full flex flex-col">
            <CardHeader className="border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-white">Live Transcript</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover:bg-foreground/5 flex-shrink-0"
                  onClick={() => setAutoScroll(!autoScroll)}
                >
                  {autoScroll ? (
                    <>
                      <ArrowDownToLine className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Auto-scroll on</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Auto-scroll off</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              <div ref={scrollAreaRef} onScroll={handleScroll} className="h-full">
                {groupedTranscriptions.map((group, index) => (
                  <div key={index}>
                    {group.isSessionStart && group.sessionInfo && (
                      <div className="mb-4 py-3 px-4 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-purple-300 font-semibold">
                          <Radio className="h-4 w-4" />
                          New Session Started: {group.sessionInfo.name}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        {formatTimestamp(group.timestamp)}
                      </div>
                      <div className="text-lg leading-relaxed text-foreground space-y-2">
                        {group.texts.map((text, i) => (
                          <p key={i}>{text}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-black border-t border-border flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-3 max-w-7xl mx-auto">
          <p className="text-center text-xs text-foreground/40">
            Powered by{" "}
            <a
              href="https://livetranscribe.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              LiveTranscribe
            </a>{" "}
            and AI
          </p>
        </div>
      </div>
    </div>
  )
}
