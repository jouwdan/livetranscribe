"use client"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, ArrowDownToLine, Pause, Monitor, Smartphone, Tv } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface Transcription {
  id: string
  text: string
  isFinal: boolean
  sequenceNumber: number
  timestamp: Date
  sessionId?: string
  sessionInfo?: any
}

interface ViewerInterfaceProps {
  event: {
    slug: string
    name: string
    description?: string
    logo_url?: string
  }
  initialViewMode?: "laptop" | "mobile" | "stage"
}

type DisplayMode = "laptop" | "mobile" | "stage"

const StreamingText = ({
  text,
}: {
  text: string
}) => {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    console.log("[v0] StreamingText starting animation for text:", text.substring(0, 20) + "...")
    setDisplayedText("")
    setIsComplete(false)

    if (text.length === 0) {
      return
    }

    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1))
        currentIndex++
      } else {
        console.log("[v0] StreamingText animation complete")
        setIsComplete(true)
        clearInterval(interval)
      }
    }, 30) // 30ms per character

    return () => {
      clearInterval(interval)
    }
  }, [text])

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  )
}

const TranscriptionText = ({
  text,
  shouldAnimate,
}: {
  text: string
  shouldAnimate?: boolean
}) => {
  if (shouldAnimate) {
    return <StreamingText text={text} />
  }

  return <span>{text}</span>
}

export function ViewerInterface({ event, initialViewMode = "laptop" }: ViewerInterfaceProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [eventName, setEventName] = useState(event?.name || "Live Event")
  const [eventDescription, setEventDescription] = useState(event?.description || "")
  const [logoUrl, setLogoUrl] = useState(event?.logo_url || null)
  const [isConnected, setIsConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [viewMode, setViewMode] = useState<DisplayMode>(initialViewMode)
  const [newestTranscriptionId, setNewestTranscriptionId] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastTranscriptionRef = useRef<HTMLDivElement>(null)
  const transcriptionsViewedRef = useRef(0)
  const lastTranscriptionTimeRef = useRef(Date.now())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestSequenceRef = useRef(0)
  const [currentSession, setCurrentSession] = useState<any | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initialLoadCompleteRef = useRef(false)
  const supabase = createClient()
  const [streamingStatusMessage, setStreamingStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let isSubscribed = true
    let channel: RealtimeChannel | null = null

    const initializeViewer = async () => {
      const response = await fetch(`/api/stream/${event.slug}`)
      const result = await response.json()

      if (result.error) {
        setError(result.error)
        return
      }

      setEventName(result.metadata?.name || eventName)
      setEventDescription(result.metadata?.description || eventDescription)
      setLogoUrl(result.metadata?.logo_url || logoUrl)

      if (result.transcriptions) {
        const filtered = result.transcriptions.filter((t: any) => t.isFinal)
        setTranscriptions(
          filtered.map((t: any) => ({
            id: t.id,
            text: t.text,
            isFinal: t.isFinal,
            sequenceNumber: t.sequenceNumber,
            timestamp: new Date(t.timestamp),
            sessionId: t.sessionId,
          })),
        )
        transcriptionsViewedRef.current = filtered.filter((t: any) => t.isFinal).length
        if (filtered.length > 0) {
          latestSequenceRef.current = Math.max(...filtered.map((t: any) => t.sequenceNumber))
        }
        initialLoadCompleteRef.current = true
      }

      const channelName = `transcriptions-${event.slug}`

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
            filter: `event_id=eq.${result.eventId}`,
          },
          async (payload) => {
            if (!isSubscribed) return

            const newTranscription = payload.new as any

            lastTranscriptionTimeRef.current = Date.now()

            if (!newTranscription.text || newTranscription.text.trim() === "" || !newTranscription.is_final) {
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
              if (prev.some((t) => t.id === newTranscription.id)) {
                return prev
              }

              transcriptionsViewedRef.current += 1
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

              if (initialLoadCompleteRef.current) {
                setNewestTranscriptionId(newTranscription.id)
                setTimeout(() => {
                  setNewestTranscriptionId(null)
                }, 2000)
              }

              return [...prev, newItem].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            })

            setIsConnected(true)
          },
        )
        .on("broadcast", { event: "streaming_status" }, (payload: any) => {
          const { status, sessionId, timestamp } = payload.payload

          if (status === "started") {
            setIsStreaming(true)
            setStreamingStatusMessage("Streaming started")
            setTimeout(() => setStreamingStatusMessage(null), 5000)
          } else if (status === "stopped") {
            setIsStreaming(false)
            setStreamingStatusMessage("Streaming stopped")
            setTimeout(() => setStreamingStatusMessage(null), 5000)
          }
        })
        .subscribe((status, err) => {
          if (err) {
            console.error("Supabase subscription error:", err)
          }
          if (isSubscribed) {
            setIsConnected(status === "SUBSCRIBED")
          }
        })

      return () => {
        isSubscribed = false
        if (channel) {
          supabase.removeChannel(channel)
        }
      }
    }

    initializeViewer()
  }, [event.slug])

  useEffect(() => {
    const sessionId = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`
    let pingInterval: NodeJS.Timeout | null = null

    const setupViewerTracking = async () => {
      const { data: eventData } = await supabase.from("events").select("id").eq("slug", event.slug).single()

      if (!eventData) return

      await supabase.from("viewer_sessions").insert({
        event_id: eventData.id,
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
          .eq("event_id", eventData.id)
          .eq("session_id", sessionId)
      }, 15000)
    }

    setupViewerTracking()

    return () => {
      clearInterval(pingInterval)
      const cleanup = async () => {
        const { data: eventData } = await supabase.from("events").select("id").eq("slug", event.slug).single()
        if (eventData) {
          await supabase
            .from("viewer_sessions")
            .update({
              left_at: new Date().toISOString(),
              scroll_events: 0,
              visibility_changes: 0,
              total_active_time_seconds: 0,
              transcriptions_viewed: 0,
            })
            .eq("event_id", eventData.id)
            .eq("session_id", sessionId)
        }
      }
      cleanup()
    }
  }, [event.slug])

  useEffect(() => {
    if (!autoScroll || !scrollAreaRef.current) return

    const scrollContainer = scrollAreaRef.current
    scrollContainer.scrollTop = scrollContainer.scrollHeight
  }, [transcriptions, autoScroll, newestTranscriptionId])

  useEffect(() => {
    if (scrollAreaRef.current && initialLoadCompleteRef.current) {
      const scrollContainer = scrollAreaRef.current
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    }
  }, [initialLoadCompleteRef.current])

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollAreaRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

      setAutoScroll(isAtBottom)
    }

    const scrollContainer = scrollAreaRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll)
      return () => scrollContainer.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const displayTranscriptions = transcriptions.filter((t) => t.text.trim() !== "" && t.isFinal)
  const allDisplayItems = displayTranscriptions

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

  const groupedTranscriptions = groupTranscriptionsBySessionAndTime(allDisplayItems)

  const updateViewModeInUrl = (mode: DisplayMode) => {
    const url = new URL(window.location.href)
    url.searchParams.set("view", mode)
    window.history.pushState({}, "", url.toString())
  }

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }

  if (viewMode === "stage") {
    return (
      <div className="flex flex-col h-screen bg-black overflow-hidden">
        <div className="bg-gradient-to-b from-slate-950 to-black border-b border-border/50 flex-shrink-0 shadow-2xl">
          <div className="px-6 sm:px-8 lg:px-12 py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 flex items-center gap-4">
                {logoUrl && (
                  <img
                    src={logoUrl || "/placeholder.svg"}
                    alt={`${eventName} logo`}
                    className="h-16 w-16 object-contain rounded-lg flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Badge
                    variant={isStreaming ? "default" : "secondary"}
                    className={`px-3 py-1.5 text-base mb-3 ${isStreaming ? "bg-red-600" : ""}`}
                  >
                    {isStreaming ? (
                      <>
                        <Radio className="h-4 w-4 mr-2" />
                        LIVE
                      </>
                    ) : (
                      "OFFLINE"
                    )}
                  </Badge>
                  <h1 className="text-2xl font-bold text-white">{eventName}</h1>
                </div>
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
                    onClick={() => {
                      setViewMode("laptop")
                      updateViewModeInUrl("laptop")
                      setTimeout(scrollToBottom, 100)
                    }}
                    className="h-8 w-8 p-0 hover:bg-foreground/5 text-white"
                  >
                    <Monitor className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setViewMode("mobile")
                      updateViewModeInUrl("mobile")
                      setTimeout(scrollToBottom, 100)
                    }}
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
          <div ref={scrollAreaRef} className="h-full overflow-y-auto">
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
                      {group.texts.map((text, textIndex) => {
                        const transcriptionIndex = displayTranscriptions.findIndex((t) => t.text === text)
                        const transcription =
                          transcriptionIndex >= 0 ? displayTranscriptions[transcriptionIndex] : undefined
                        const isLastInGroup = textIndex === group.texts.length - 1
                        const isLastGroup = index === groupedTranscriptions.slice(-5).length - 1
                        const shouldAnimate =
                          isLastInGroup && isLastGroup && transcription?.id === newestTranscriptionId

                        return (
                          <span key={textIndex}>
                            <TranscriptionText text={text} shouldAnimate={shouldAnimate} />
                            {textIndex < group.texts.length - 1 && " "}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === "mobile") {
    return (
      <div className="flex flex-col h-screen bg-black overflow-hidden">
        <div className="bg-black border-b border-border flex-shrink-0">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {logoUrl && (
                  <img
                    src={logoUrl || "/placeholder.svg"}
                    alt={`${eventName} logo`}
                    className="h-8 w-8 object-contain rounded flex-shrink-0"
                  />
                )}
                <Badge
                  variant={isStreaming ? "default" : "secondary"}
                  className={`px-2 py-1 text-xs flex-shrink-0 ${isStreaming ? "bg-red-600" : ""}`}
                >
                  {isStreaming ? (
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
              <div className="flex gap-0.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="h-7 w-7 hover:bg-foreground/5"
                >
                  {autoScroll ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setViewMode("laptop")
                    updateViewModeInUrl("laptop")
                    setTimeout(scrollToBottom, 100)
                  }}
                  className="h-7 w-7 hover:bg-foreground/5"
                >
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7 border-purple-500/30 bg-purple-500/10">
                  <Smartphone className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setViewMode("stage")
                    updateViewModeInUrl("stage")
                    setTimeout(scrollToBottom, 100)
                  }}
                  className="h-7 w-7 hover:bg-foreground/5"
                >
                  <Tv className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {eventDescription && <p className="text-sm text-slate-300 mb-3">{eventDescription}</p>}
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

        <div className="flex-1 overflow-hidden px-4 py-4">
          <div ref={scrollAreaRef} className="h-full overflow-y-auto">
            <div className="space-y-4">
              {groupedTranscriptions.map((group, index) => (
                <div key={index}>
                  {group.isSessionStart && group.sessionInfo && (
                    <div className="mb-4 py-2 px-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                      <div className="flex items-center gap-2 text-purple-200 text-xs font-semibold">
                        <Radio className="h-3 w-3" />
                        New Session: {group.sessionInfo.name}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-xs text-foreground/40">{formatTimestamp(group.timestamp)}</div>
                    <div className="text-base leading-relaxed text-white">
                      {group.texts.map((text, textIndex) => {
                        const transcriptionIndex = displayTranscriptions.findIndex((t) => t.text === text)
                        const transcription =
                          transcriptionIndex >= 0 ? displayTranscriptions[transcriptionIndex] : undefined
                        const isLastInGroup = textIndex === group.texts.length - 1
                        const isLastGroup = index === groupedTranscriptions.length - 1
                        const shouldAnimate =
                          isLastInGroup && isLastGroup && transcription?.id === newestTranscriptionId

                        return (
                          <span key={textIndex}>
                            <TranscriptionText text={text} shouldAnimate={shouldAnimate} />
                            {textIndex < group.texts.length - 1 && " "}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="min-w-0 flex-1 flex items-center gap-4">
              {logoUrl && (
                <img
                  src={logoUrl || "/placeholder.svg"}
                  alt={`${eventName} logo`}
                  className="h-12 w-12 object-contain rounded-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{eventName}</h1>
                {eventDescription && <p className="text-sm text-foreground/60 mt-1">{eventDescription}</p>}
                {!eventDescription && <p className="text-sm text-foreground/60">Live Transcription</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Badge
                variant={isStreaming ? "default" : "secondary"}
                className={`px-3 py-1 ${isStreaming ? "bg-red-600" : ""}`}
              >
                {isStreaming ? (
                  <>
                    <Radio className="h-3 w-3 mr-2 animate-pulse" />
                    Live
                  </>
                ) : (
                  "Offline"
                )}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setAutoScroll(!autoScroll)} className="gap-2">
                {autoScroll ? (
                  <>
                    <ArrowDownToLine className="h-4 w-4" />
                    Auto-scroll
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Paused
                  </>
                )}
              </Button>
              <div className="flex gap-1 border-l border-border pl-3">
                <Button variant="outline" size="sm" className="gap-2 border-purple-500/30 bg-purple-500/10">
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-foreground/5 flex-shrink-0"
                  onClick={() => {
                    setViewMode("mobile")
                    updateViewModeInUrl("mobile")
                    setTimeout(scrollToBottom, 100)
                  }}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-foreground/5 flex-shrink-0"
                  onClick={() => {
                    setViewMode("stage")
                    updateViewModeInUrl("stage")
                    setTimeout(scrollToBottom, 100)
                  }}
                >
                  <Tv className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          {currentSession && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <Radio className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-200">Current Session:</span>
              <span className="text-sm text-purple-100">
                {currentSession.session_number}. {currentSession.name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <div ref={scrollAreaRef} className="h-full overflow-y-auto">
          <div className="space-y-6">
            {groupedTranscriptions.map((group, index) => (
              <div key={index}>
                {group.isSessionStart && group.sessionInfo && (
                  <div className="mb-6 py-3 px-4 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-200 text-sm font-semibold">
                      <Radio className="h-4 w-4" />
                      New Session: {group.sessionInfo.name}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="text-xs text-foreground/40 uppercase tracking-wide">
                    {formatTimestamp(group.timestamp)}
                  </div>
                  <div className="text-lg leading-relaxed text-white">
                    {group.texts.map((text, textIndex) => {
                      const transcriptionIndex = displayTranscriptions.findIndex((t) => t.text === text)
                      const transcription =
                        transcriptionIndex >= 0 ? displayTranscriptions[transcriptionIndex] : undefined
                      const isLastInGroup = textIndex === group.texts.length - 1
                      const isLastGroup = index === groupedTranscriptions.length - 1
                      const shouldAnimate = isLastInGroup && isLastGroup && transcription?.id === newestTranscriptionId

                      return (
                        <span key={textIndex}>
                          <TranscriptionText text={text} shouldAnimate={shouldAnimate} />
                          {textIndex < group.texts.length - 1 && " "}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
