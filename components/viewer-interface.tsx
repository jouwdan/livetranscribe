"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, ArrowDownToLine, Pause, Monitor, Smartphone, Tv } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { setEventName } from "@/utils/set-event-name" // Assuming setEventName is declared in this file or imported from another file

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
  slug: string
  eventName: string
  eventDescription?: string
}

type DisplayMode = "laptop" | "mobile" | "stage"

const StreamingText = ({ text, isInterim, itemId }: { text: string; isInterim?: boolean; itemId?: string }) => {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const [currentItemId, setCurrentItemId] = useState<string | undefined>(itemId)

  useEffect(() => {
    if (!isInterim) {
      setDisplayedText(text)
      setIsComplete(true)
      return
    }

    if (itemId !== currentItemId) {
      setCurrentItemId(itemId)
      setDisplayedText("")
      setIsComplete(false)
    }

    // For interim text, animate it streaming in
    if (text.length === 0) {
      setDisplayedText("")
      setIsComplete(false)
      return
    }

    if (
      text.length < displayedText.length &&
      !text.startsWith(displayedText.slice(0, Math.min(10, displayedText.length)))
    ) {
      setDisplayedText("")
      setIsComplete(false)
    }

    // If already complete and text hasn't changed, don't re-animate
    if (isComplete && text === displayedText) return

    setIsComplete(false)
    let currentIndex = displayedText.length

    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1))
        currentIndex++
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, 20) // Faster animation at 20ms per character

    return () => clearInterval(interval)
  }, [text, isInterim, itemId, currentItemId])

  return (
    <span className={isInterim && !isComplete ? "opacity-70" : ""}>
      {displayedText}
      {isInterim && !isComplete && <span className="animate-pulse ml-1">▊</span>}
    </span>
  )
}

export function ViewerInterface({ slug, eventName, eventDescription }: ViewerInterfaceProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [currentInterim, setCurrentInterim] = useState<Transcription | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingStatusMessage, setStreamingStatusMessage] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState<"laptop" | "mobile" | "stage">("laptop")
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastTranscriptionRef = useRef<HTMLDivElement>(null) // Added ref for the last transcription element to scroll to
  const transcriptionsViewedRef = useRef(0)
  const lastTranscriptionTimeRef = useRef(Date.now())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestSequenceRef = useRef(0)
  const userHasScrolledRef = useRef(false)
  const [currentSession, setCurrentSession] = useState<any | null>(null)
  const [description, setDescription] = useState<string | null>(eventDescription)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let isSubscribed = true
    let channel: any

    const initializeViewer = async () => {
      const response = await fetch(`/api/stream/${slug}`)
      const result = await response.json()

      if (result.error) {
        setError(result.error)
        return
      }

      setEventName(result.metadata?.name || "Live Event")

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
      }

      const channelName = `transcriptions-${slug}`

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

            if (!newTranscription.text || newTranscription.text.trim() === "") {
              return
            }

            if (!newTranscription.is_final) {
              return
            }

            setCurrentInterim(null)

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
        .on("broadcast", { event: "interim_transcription" }, (payload: any) => {
          const { text, sequence, sessionId } = payload.payload

          if (text && text.trim() !== "") {
            setCurrentInterim({
              id: `interim-${sequence}`,
              text,
              isFinal: false,
              sequenceNumber: sequence,
              timestamp: new Date(),
              sessionId,
            })
            lastTranscriptionTimeRef.current = Date.now()
          }
        })
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
  }, [slug])

  useEffect(() => {
    const sessionId = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`
    let pingInterval: NodeJS.Timeout | null = null

    const setupViewerTracking = async () => {
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
    if (!autoScroll || !scrollAreaRef.current) return

    const scrollContainer = scrollAreaRef.current
    scrollContainer.scrollTop = scrollContainer.scrollHeight
  }, [transcriptions.length, currentInterim?.text, autoScroll])

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
  const allDisplayItems = currentInterim ? [...displayTranscriptions, currentInterim] : displayTranscriptions

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

  if (displayMode === "stage") {
    return (
      <div className="flex flex-col h-screen bg-black overflow-hidden">
        <div className="bg-black border-b border-purple-500/30 flex-shrink-0">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge
                  variant={isStreaming ? "default" : "secondary"}
                  className={`px-3 py-1.5 text-base ${isStreaming ? "bg-red-600 animate-pulse" : ""}`}
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
          <div ref={scrollAreaRef} className="h-full overflow-y-auto">
            {currentInterim && (
              <div className="mb-12 p-8 bg-purple-500/10 border-l-4 border-purple-500 rounded-lg">
                <p className="text-5xl md:text-6xl lg:text-7xl font-medium text-white leading-tight tracking-wide">
                  {currentInterim.text}
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
                      {group.texts.map((text, textIndex) => (
                        <span key={textIndex}>
                          <StreamingText
                            text={text}
                            isInterim={
                              group === groupedTranscriptions[groupedTranscriptions.length - 1] &&
                              currentInterim !== null
                            }
                            itemId={group.sessionId}
                          />
                          {textIndex < group.texts.length - 1 && " "}
                        </span>
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
            <div ref={scrollAreaRef} className="space-y-4">
              {currentInterim && (
                <div className="p-4 bg-purple-500/20 border-l-2 border-purple-500 rounded">
                  <p className="text-lg font-medium text-white leading-relaxed">{currentInterim.text}</p>
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
                      {group.texts.map((text, textIndex) => (
                        <span key={textIndex}>
                          <StreamingText
                            text={text}
                            isInterim={
                              group === groupedTranscriptions[groupedTranscriptions.length - 1] &&
                              currentInterim !== null
                            }
                            itemId={group.sessionId}
                          />
                          {textIndex < group.texts.length - 1 && " "}
                        </span>
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
              <div ref={scrollAreaRef} className="h-full overflow-y-auto">
                {allDisplayItems.map((t, idx) => {
                  const isLastInterim = currentInterim && t.id === currentInterim.id
                  return (
                    <div key={t.id || idx} className="mb-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground shrink-0 mt-1">
                          {formatTimestamp(new Date(t.timestamp))}
                        </span>
                        <div className="flex-1 text-base leading-relaxed">
                          <StreamingText text={t.text} isInterim={isLastInterim} itemId={t.id} />
                        </div>
                      </div>
                    </div>
                  )
                })}
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
