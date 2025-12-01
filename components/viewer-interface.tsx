"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowDownToLine, ArrowUpFromLine, Radio, Sun, Moon, Minus, Plus, Settings } from "lucide-react"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { EventSession } from "@/types/event-session"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ViewerMetricsTracker } from "@/lib/metrics"

interface Transcription {
  id: string
  text: string
  isFinal: boolean
  sequenceNumber: number
  timestamp: Date
  sessionId?: string
  sessionInfo?: any
}

interface TranscriptionGroup {
  timestamp: Date
  texts: string[]
  sessionId?: string
  sessionInfo?: any
  isSessionStart?: boolean
}

interface ViewerInterfaceProps {
  event: {
    slug: string
    name: string
    description: string
    logo_url: string | null
  }
  initialViewMode: "laptop" | "mobile" | "stage"
}

type FontSize = "xs" | "small" | "medium" | "large" | "xl" | "xxl"
type Theme = "dark" | "light"
type FontFamily = "sans" | "serif" | "mono"

const StreamingText = ({
  text,
}: {
  text: string
}) => {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    console.log("StreamingText starting animation for text:", text.substring(0, 20) + "...")
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
        console.log("StreamingText animation complete")
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

export function ViewerInterface({ event, initialViewMode }: ViewerInterfaceProps) {
  const eventSlug = event.slug
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [isLive, setIsLive] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [currentSession, setCurrentSession] = useState<EventSession | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [newestTranscriptionId, setNewestTranscriptionId] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<FontSize>("medium")
  const [theme, setTheme] = useState<Theme>("dark")
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans")
  const [currentInterim, setCurrentInterim] = useState<{ text: string; sequence: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [widthMode, setWidthMode] = useState<"constrained" | "full">("constrained")
  const metricsTrackerRef = useRef<ViewerMetricsTracker | null>(null)

  useEffect(() => {
    const savedTheme = localStorage.getItem("viewer-theme") as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
    const savedFont = localStorage.getItem("viewer-font") as FontFamily | null
    if (savedFont) {
      setFontFamily(savedFont)
    }
    const savedWidth = localStorage.getItem("viewerWidthMode")
    if (savedWidth === "full" || savedWidth === "constrained") {
      setWidthMode(savedWidth)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("viewer-theme", theme)
    localStorage.setItem("viewer-font", fontFamily)
    localStorage.setItem("viewerWidthMode", widthMode)
  }, [theme, fontFamily, widthMode])

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }

  const changeFontFamily = (font: FontFamily) => {
    setFontFamily(font)
  }

  const increaseFontSize = () => {
    if (fontSize === "xs") setFontSize("small")
    else if (fontSize === "small") setFontSize("medium")
    else if (fontSize === "medium") setFontSize("large")
    else if (fontSize === "large") setFontSize("xl")
    else if (fontSize === "xl") setFontSize("xxl")
    if (autoScroll) {
      setTimeout(scrollToBottom, 200)
    }
  }

  const decreaseFontSize = () => {
    if (fontSize === "xxl") setFontSize("xl")
    else if (fontSize === "xl") setFontSize("large")
    else if (fontSize === "large") setFontSize("medium")
    else if (fontSize === "medium") setFontSize("small")
    else if (fontSize === "small") setFontSize("xs")
    if (autoScroll) {
      setTimeout(scrollToBottom, 200)
    }
  }

  const toggleWidthMode = () => {
    setWidthMode(widthMode === "constrained" ? "full" : "constrained")
  }

  useEffect(() => {
    let isSubscribed = true
    let channel: RealtimeChannel | null = null

    const initializeViewer = async () => {
      try {
        console.log("Initializing viewer for event:", eventSlug)

        const response = await fetch(`/api/stream/${eventSlug}`)
        const result = await response.json()

        console.log("Initial fetch result:", {
          hasError: !!result.error,
          transcriptionCount: result.transcriptions?.length || 0,
          eventId: result.eventId,
        })

        if (result.error) {
          console.error("Error initializing viewer:", result.error)
          return
        }

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
        }

        const channelName = `transcriptions-${eventSlug}`
        console.log("Setting up Supabase channel:", channelName, "for eventId:", result.eventId)

        channel = createBrowserClient()
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
              console.log("✅ Realtime INSERT received:", {
                payload: payload.new,
                isSubscribed,
                text: (payload.new as any).text,
                is_final: (payload.new as any).is_final,
                sequence_number: (payload.new as any).sequence_number,
              })

              if (!isSubscribed) {
                console.log("Ignoring transcription - component not subscribed")
                return
              }

              const newTranscription = payload.new as any

              if (!newTranscription.text) {
                console.log("Rejected: No text")
                return
              }
              if (newTranscription.text.trim() === "") {
                console.log("Rejected: Empty text")
                return
              }
              if (!newTranscription.is_final) {
                console.log("Rejected: Not final (is_final =", newTranscription.is_final, ")")
                return
              }

              console.log("Transcription passed filters, adding to state")

              setCurrentInterim(null)

              let sessionInfo = null
              if (newTranscription.session_id) {
                const { data: sessionData } = await createBrowserClient()
                  .from("event_sessions")
                  .select("name, session_number")
                  .eq("id", newTranscription.session_id)
                  .single()
                sessionInfo = sessionData
              }

              setTranscriptions((prev) => {
                if (prev.some((t) => t.id === newTranscription.id)) {
                  console.log("Duplicate transcription detected, skipping:", newTranscription.id)
                  return prev
                }

                const newItem = {
                  id: newTranscription.id,
                  text: newTranscription.text,
                  isFinal: newTranscription.is_final,
                  sequenceNumber: newTranscription.sequence_number,
                  timestamp: new Date(newTranscription.created_at),
                  sessionId: newTranscription.session_id,
                  sessionInfo,
                }

                console.log("Adding transcription to state:", newItem)

                if (prev.length > 0) {
                  setNewestTranscriptionId(newTranscription.id)
                  setTimeout(() => {
                    setNewestTranscriptionId(null)
                  }, 2000)
                }

                return [...prev, newItem].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
              })

              setIsLive(true)
            },
          )
          .on("broadcast", { event: "interim_transcription" }, (payload: any) => {
            console.log("Broadcast interim received:", payload.payload?.text?.substring(0, 50))
            if (!isSubscribed) return
            const { text, sequence, sessionId } = payload.payload

            // Only show interim if it's from the current session (or any session if not tracking)
            setCurrentInterim({ text, sequence })
            setIsLive(true)
          })
          .on("broadcast", { event: "streaming_status" }, (payload: any) => {
            console.log("Broadcast status received:", payload.payload?.status)
            const { status, sessionId, timestamp } = payload.payload

            if (status === "started") {
              setIsLive(true)
            } else if (status === "stopped") {
              setIsLive(false)
              setCurrentInterim(null)
            }
          })
          .subscribe((status, err) => {
            console.log("Subscription status:", status, err ? "Error:" + err : "")
            if (err) {
              console.error("Supabase subscription error:", err)
            }
          })
      } catch (err) {
        console.error("Failed to initialize viewer:", err)
      } finally {
        setIsLoading(false)
      }
    }

    initializeViewer()

    return () => {
      isSubscribed = false
      if (channel) {
        createBrowserClient().removeChannel(channel)
      }
    }
  }, [eventSlug])

  useEffect(() => {
    const setupViewerTracking = async () => {
      const { data: eventData } = await createBrowserClient().from("events").select("id").eq("slug", eventSlug).single()

      if (!eventData) return

      const tracker = new ViewerMetricsTracker(eventData.id)
      await tracker.initialize()
      metricsTrackerRef.current = tracker
    }

    setupViewerTracking()

    return () => {
      if (metricsTrackerRef.current) {
        metricsTrackerRef.current.cleanup()
      }
    }
  }, [eventSlug])

  useEffect(() => {
    if (transcriptions.length > 0 && metricsTrackerRef.current) {
      metricsTrackerRef.current.incrementTranscriptionsViewed()
    }
  }, [transcriptions.length])

  useEffect(() => {
    if (!autoScroll || !scrollAreaRef.current) return

    requestAnimationFrame(() => {
      const scrollContainer = scrollAreaRef.current
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    })
  }, [transcriptions, autoScroll, newestTranscriptionId, isLive, fontSize, fontFamily, currentInterim, widthMode])

  useEffect(() => {
    if (isLive) {
      toast.success("Stream is now live", {
        description: "The broadcaster has started streaming",
        duration: 3000,
      })
    } else {
      // Only show offline toast if we were previously live (not on initial load)
      const hasBeenLive = transcriptions.length > 0 || currentInterim !== null
      if (hasBeenLive) {
        toast.info("Stream went offline", {
          description: "The broadcaster has stopped streaming",
          duration: 3000,
        })
      }
    }
  }, [isLive])

  const displayTranscriptions = useMemo(() => {
    return transcriptions
  }, [transcriptions])

  const groupTranscriptionsBySessionAndTime = (transcriptions: Transcription[]) => {
    const sorted = [...transcriptions].sort((a, b) => {
      return a.timestamp.getTime() - b.timestamp.getTime()
    })

    const groups: TranscriptionGroup[] = []
    let currentGroup: TranscriptionGroup | null = null

    let lastSessionId: string | undefined = undefined

    sorted.forEach((curr, index) => {
      const isNewSession = curr.sessionId && curr.sessionId !== lastSessionId

      if (index === 0 || isNewSession) {
        currentGroup = {
          timestamp: curr.timestamp,
          texts: [curr.text],
          sessionId: curr.sessionId,
          sessionInfo: curr.sessionInfo,
          isSessionStart: isNewSession && index > 0,
        }
        groups.push(currentGroup)
        lastSessionId = curr.sessionId
      } else {
        const prevTimestamp = sorted[index - 1].timestamp.getTime()
        const currTimestamp = curr.timestamp.getTime()
        const timeDiff = (currTimestamp - prevTimestamp) / 1000

        if (timeDiff > 8) {
          currentGroup = {
            timestamp: curr.timestamp,
            texts: [curr.text],
            sessionId: curr.sessionId,
            sessionInfo: curr.sessionInfo,
            isSessionStart: false,
          }
          groups.push(currentGroup)
        } else {
          if (currentGroup) {
            currentGroup.texts.push(curr.text)
          }
        }
      }
    })

    return groups
  }

  const groupedTranscriptions = useMemo(() => {
    return groupTranscriptionsBySessionAndTime(displayTranscriptions)
  }, [displayTranscriptions])

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }

  const fontFamilyLabels = {
    sans: "System Sans",
    serif: "System Serif",
    mono: "Monospace",
  }

  const fontSizeClasses = {
    xs: "text-sm leading-relaxed",
    small: "text-base leading-relaxed",
    medium: "text-xl leading-relaxed",
    large: "text-3xl md:text-4xl leading-tight",
    xl: "text-4xl md:text-5xl leading-tight",
    xxl: "text-5xl md:text-6xl lg:text-7xl leading-tight",
  }

  const fontFamilyClasses = {
    sans: "font-sans",
    serif: "font-serif",
    mono: "font-mono",
  }

  const bgColorClass = theme === "dark" ? "bg-black" : "bg-white"
  const textColorClass = theme === "dark" ? "text-white" : "text-gray-900"
  const mutedTextClass = theme === "dark" ? "text-muted-foreground" : "text-gray-500"
  const borderClass = theme === "dark" ? "border-border" : "border-gray-200"
  const timestampColorClass = theme === "dark" ? "text-gray-400" : "text-gray-600"

  return (
    <div className={cn("flex flex-col h-screen", bgColorClass)}>
      {/* Header */}
      <div className={`${bgColorClass} border-b ${borderClass} flex-shrink-0`}>
        <div className="px-6 sm:px-8 lg:px-12 py-4 mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Placeholder for event logo */}
              <img
                src={event.logo_url || "/placeholder.svg"}
                alt="Event logo"
                className="h-12 w-12 rounded-lg object-contain"
              />
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold ${textColorClass}`}>Live Transcription</h1>
                {/* Placeholder for event name */}
                <p className={`text-sm ${mutedTextClass} mt-0.5`}>{event.name}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 items-center flex-shrink-0">
              <Badge
                variant={isLive ? "default" : "secondary"}
                className={`px-3 py-1 ${isLive ? "bg-green-600 hover:bg-green-700" : "bg-muted"}`}
              >
                {isLive ? "Live" : "Offline"}
              </Badge>

              {/* Auto-scroll toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`h-8 px-3 gap-1.5 text-xs ${
                  theme === "dark"
                    ? "text-white hover:bg-white/10"
                    : "text-gray-900 hover:bg-gray-200 hover:text-gray-900"
                }`}
              >
                {autoScroll ? (
                  <>
                    <ArrowDownToLine className="h-3 w-3" />
                    Auto-scroll
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="h-3 w-3" />
                    Paused
                  </>
                )}
              </Button>

              {/* Settings dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 ${
                      theme === "dark"
                        ? "text-white hover:bg-white/10"
                        : "text-gray-900 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                    title="Display settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={`w-56 ${
                    theme === "dark" ? "bg-black border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                  }`}
                >
                  <DropdownMenuLabel className={theme === "dark" ? "text-white" : "text-gray-900"}>
                    Display Settings
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className={theme === "dark" ? "bg-gray-800" : "bg-gray-200"} />

                  {/* Theme Toggle */}
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className={`cursor-pointer ${
                      theme === "dark"
                        ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                        : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                    }`}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTheme()
                      }}
                      className="flex items-center w-full"
                    >
                      {theme === "dark" ? (
                        <>
                          <Sun className="mr-2 h-4 w-4" />
                          <span>Switch to Light Mode</span>
                        </>
                      ) : (
                        <>
                          <Moon className="mr-2 h-4 w-4" />
                          <span>Switch to Dark Mode</span>
                        </>
                      )}
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className={theme === "dark" ? "bg-gray-800" : "bg-gray-200"} />

                  {/* Font Size Controls */}
                  <DropdownMenuLabel
                    className={`text-xs font-normal ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Text Size
                  </DropdownMenuLabel>
                  <div className="flex items-center justify-between px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        decreaseFontSize()
                      }}
                      disabled={fontSize === "xs"}
                      className={`h-8 w-8 p-0 disabled:opacity-30 ${
                        theme === "dark"
                          ? "hover:bg-white/10 text-white hover:text-white"
                          : "hover:bg-gray-100 text-gray-900 hover:text-gray-900"
                      }`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                      {fontSize === "xs" && "XS"}
                      {fontSize === "small" && "Small"}
                      {fontSize === "medium" && "Medium"}
                      {fontSize === "large" && "Large"}
                      {fontSize === "xl" && "XL"}
                      {fontSize === "xxl" && "XXL"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        increaseFontSize()
                      }}
                      disabled={fontSize === "xxl"}
                      className={`h-8 w-8 p-0 disabled:opacity-30 ${
                        theme === "dark"
                          ? "hover:bg-white/10 text-white hover:text-white"
                          : "hover:bg-gray-100 text-gray-900 hover:text-gray-900"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <DropdownMenuSeparator className={theme === "dark" ? "bg-gray-800" : "bg-gray-200"} />

                  {/* Font Family Picker */}
                  <DropdownMenuLabel
                    className={`text-xs font-normal ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Font Family
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={fontFamily}
                    onValueChange={(value) => changeFontFamily(value as FontFamily)}
                  >
                    <DropdownMenuRadioItem
                      value="sans"
                      className={`cursor-pointer ${
                        theme === "dark"
                          ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                          : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                      onSelect={(e) => e.preventDefault()}
                    >
                      System Sans
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="serif"
                      className={`cursor-pointer ${
                        theme === "dark"
                          ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                          : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                      onSelect={(e) => e.preventDefault()}
                    >
                      System Serif
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="mono"
                      className={`cursor-pointer ${
                        theme === "dark"
                          ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                          : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Monospace
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator className={theme === "dark" ? "bg-gray-800" : "bg-gray-200"} />

                  {/* Width Mode Toggle */}
                  <DropdownMenuLabel className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                    Width
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className={cn(
                      "cursor-pointer",
                      theme === "dark"
                        ? "hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                        : "hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:text-gray-900",
                    )}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <div
                      className="flex items-center justify-between w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleWidthMode()
                      }}
                    >
                      <span>{widthMode === "constrained" ? "Constrained" : "Full Width"}</span>
                      <button
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          widthMode === "full"
                            ? theme === "dark"
                              ? "bg-white"
                              : "bg-gray-900"
                            : theme === "dark"
                              ? "bg-gray-700"
                              : "bg-gray-300",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full transition-transform",
                            widthMode === "full"
                              ? theme === "dark"
                                ? "translate-x-5 bg-black"
                                : "translate-x-5 bg-white"
                              : theme === "dark"
                                ? "translate-x-0.5 bg-white"
                                : "translate-x-0.5 bg-gray-600",
                          )}
                        />
                      </button>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className={theme === "dark" ? "bg-gray-800" : "bg-gray-200"} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Current Session Badge */}
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

      {/* Transcription Content */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500 ${
          theme === "dark" ? "bg-black" : "bg-white"
        }`}
        ref={scrollAreaRef}
      >
        <div className={cn("p-6", bgColorClass)}>
          <div
            className={cn(
              "space-y-6 mx-auto",
              widthMode === "constrained" ? "max-w-4xl" : "w-full px-4",
              fontFamilyClasses[fontFamily],
            )}
          >
            {transcriptions.length === 0 && !currentInterim && (
              <div className="text-center py-20 opacity-50">
                {isLoading
                  ? "Loading Transcript..."
                  : isLive
                    ? "Waiting for transcription..."
                    : "No transcriptions yet. Waiting for broadcast to start."}
              </div>
            )}

            {groupedTranscriptions.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`} className="mb-6 last:mb-0">
                {/* Timestamp for the group */}
                <div className={cn("text-xs mb-2 opacity-60", timestampColorClass)}>
                  {group.timestamp.toLocaleTimeString()}
                </div>

                {/* All transcripts in this group */}
                <div
                  className={cn(
                    "leading-relaxed transition-all duration-300",
                    fontSizeClasses[fontSize],
                    fontFamilyClasses[fontFamily],
                    textColorClass,
                  )}
                >
                  {group.texts.map((text, textIndex) => {
                    const transcriptionIndex = displayTranscriptions.findIndex((t) => t.text === text)
                    const transcription =
                      transcriptionIndex >= 0 ? displayTranscriptions[transcriptionIndex] : undefined
                    const isLastInGroup = textIndex === group.texts.length - 1
                    const isLastGroup = groupIndex === groupedTranscriptions.length - 1
                    const shouldAnimate = isLastInGroup && isLastGroup && transcription?.id === newestTranscriptionId

                    return (
                      <span key={`${groupIndex}-${textIndex}`} className={cn(shouldAnimate && "animate-fade-in")}>
                        {text}
                        {textIndex < group.texts.length - 1 && " "}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}

            {currentInterim && (
              <div className="mb-6">
                <div className={cn("text-xs mb-2 opacity-60", timestampColorClass)}>
                  {new Date().toLocaleTimeString()}
                </div>
                <div
                  className={cn(
                    "italic",
                    fontSizeClasses[fontSize],
                    fontFamilyClasses[fontFamily],
                    theme === "dark" ? "text-gray-400" : "text-gray-500",
                  )}
                >
                  {currentInterim.text}
                  <span className="inline-block w-2 h-5 ml-1 bg-current animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`${bgColorClass} border-t ${borderClass} flex-shrink-0`}>
        <div className="px-6 sm:px-8 lg:px-12 py-3 mx-auto w-full">
          <p className={`text-xs ${mutedTextClass} text-center`}>
            AI Powered by{" "}
            <a
              href="https://livetranscribe.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-500 hover:text-purple-700 transition-colors"
            >
              LiveTranscribe.net
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
