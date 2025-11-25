"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, ArrowDownToLine, Pause, Monitor, Smartphone, Tv } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Transcription {
  text: string
  isFinal: boolean
  sequenceNumber: number
  timestamp: string
  sessionId?: string
  sessionInfo?: any
}

interface ViewerInterfaceProps {
  slug: string
  eventName: string
  eventDescription?: string
}

type DisplayMode = "laptop" | "mobile" | "stage"

export function ViewerInterface({ slug, eventName, eventDescription }: ViewerInterfaceProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const transcriptionEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string>()

  const scrollEventsRef = useRef(0)
  const visibilityChangesRef = useRef(0)
  const activeTimeRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const transcriptionsViewedRef = useRef(0)
  const activityIntervalRef = useRef<NodeJS.Timeout>()

  const [displayMode, setDisplayMode] = useState<DisplayMode>("laptop")

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
        .select("*, event_sessions(name, session_number)")
        .eq("event_id", event.id)
        .order("sequence_number", { ascending: true })

      if (transcriptionsError) {
        console.error("[v0] Error fetching transcriptions:", transcriptionsError)
      }

      console.log("[v0] Initial transcriptions count:", initialTranscriptions?.length || 0)

      if (initialTranscriptions) {
        const filtered = initialTranscriptions.filter((t) => t.text && t.text.trim() !== "")
        setTranscriptions(
          filtered.map((t) => ({
            text: t.text,
            isFinal: t.is_final,
            sequenceNumber: t.sequence_number,
            timestamp: t.created_at,
            sessionId: t.session_id,
            sessionInfo: t.event_sessions,
          })),
        )
        transcriptionsViewedRef.current = filtered.filter((t) => t.is_final).length
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
          async (payload) => {
            console.log("[v0] Real-time transcription INSERT received:", payload)
            const newTranscription = payload.new as any

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
              if (prev.some((t) => t.sequenceNumber === newTranscription.sequence_number)) {
                console.log("[v0] Duplicate transcription detected, skipping")
                return prev
              }

              console.log("[v0] Adding new transcription to state:", newTranscription.text)

              if (newTranscription.is_final) {
                transcriptionsViewedRef.current += 1
              }

              return [
                ...prev,
                {
                  text: newTranscription.text,
                  isFinal: newTranscription.is_final,
                  sequenceNumber: newTranscription.sequence_number,
                  timestamp: newTranscription.created_at,
                  sessionId: newTranscription.session_id,
                  sessionInfo,
                },
              ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
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
    const handleVisibilityChange = () => {
      visibilityChangesRef.current += 1
      if (!document.hidden) {
        lastActivityRef.current = Date.now()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  useEffect(() => {
    activityIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        activeTimeRef.current += 1
        lastActivityRef.current = Date.now()
      }
    }, 1000)

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    sessionIdRef.current = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const supabase = createClient()
    let pingInterval: NodeJS.Timeout

    const setupViewerTracking = async () => {
      console.log("[v0] Setting up viewer tracking for session:", sessionIdRef.current)

      const { data: event } = await supabase.from("events").select("id").eq("slug", slug).single()

      if (!event) return

      await supabase.from("viewer_sessions").insert({
        event_id: event.id,
        session_id: sessionIdRef.current,
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
            scroll_events: scrollEventsRef.current,
            visibility_changes: visibilityChangesRef.current,
            total_active_time_seconds: activeTimeRef.current,
            transcriptions_viewed: transcriptionsViewedRef.current,
          })
          .eq("event_id", event.id)
          .eq("session_id", sessionIdRef.current)
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
              scroll_events: scrollEventsRef.current,
              visibility_changes: visibilityChangesRef.current,
              total_active_time_seconds: activeTimeRef.current,
              transcriptions_viewed: transcriptionsViewedRef.current,
            })
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

    scrollEventsRef.current += 1
    lastActivityRef.current = Date.now()
  }

  const displayTranscriptions = transcriptions.filter((t) => t.text.trim() !== "" && t.isFinal)
  const latestInterim = transcriptions.find((t) => !t.isFinal && t.text.trim() !== "")

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const groupTranscriptionsBySessionAndTime = (transcriptions: Transcription[]) => {
    const sorted = [...transcriptions].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    })

    const groups: Array<{
      timestamp: string
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
        const prevTimestamp = new Date(sorted[index - 1].timestamp).getTime()
        const currTimestamp = new Date(curr.timestamp).getTime()
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
          <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto">
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
            <div ref={transcriptionEndRef} />
          </div>
        </div>

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
                <h1 className="text-base font-bold text-white truncate">{eventName}</h1>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayMode("laptop")}
                  className="h-8 w-8 p-0 hover:bg-foreground/5"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-purple-500/30 bg-purple-500/10">
                  <Smartphone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayMode("stage")}
                  className="h-8 w-8 p-0 hover:bg-foreground/5"
                >
                  <Tv className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {eventDescription && <p className="text-xs text-foreground/60 truncate mt-2">{eventDescription}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div ref={containerRef} onScroll={handleScroll} className="space-y-4">
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
              <div ref={transcriptionEndRef} />
            </div>
          </div>
        </div>

        <div className="bg-black border-t border-border flex-shrink-0">
          <div className="px-4 py-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className="gap-2 hover:bg-foreground/5"
            >
              {autoScroll ? (
                <>
                  <ArrowDownToLine className="h-4 w-4" />
                  Auto
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Paused
                </>
              )}
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
              {eventDescription && <p className="text-sm text-foreground/60 mt-1">{eventDescription}</p>}
              {!eventDescription && <p className="text-sm text-foreground/60">Live Transcription</p>}
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
              <div className="flex gap-1 border-l border-border pl-3">
                <Button variant="outline" size="sm" className="gap-2 border-purple-500/30 bg-purple-500/10">
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayMode("mobile")}
                  className="gap-2 hover:bg-foreground/5"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayMode("stage")}
                  className="gap-2 hover:bg-foreground/5"
                >
                  <Tv className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto h-full">
          <Card className="bg-black border-border h-full flex flex-col">
            <CardHeader className="border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-white">Live Transcript</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="gap-2 hover:bg-foreground/5 flex-shrink-0"
                >
                  {autoScroll ? (
                    <>
                      <ArrowDownToLine className="h-4 w-4" />
                      <span className="hidden sm:inline">Auto-scroll on</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4" />
                      <span className="hidden sm:inline">Auto-scroll off</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              <div ref={containerRef} onScroll={handleScroll} className="h-full">
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
                <div ref={transcriptionEndRef} />
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
