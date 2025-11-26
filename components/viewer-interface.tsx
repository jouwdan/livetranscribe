"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowDownToLine, ArrowUpFromLine, Radio, Sun, Moon, Minus, Plus, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { EventSession } from "@/types/event-session"
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
    description?: string | null
    logo_url?: string | null
    event_name?: string
    speaker?: string
  }
  slug: string
}

type FontSize = "xs" | "small" | "medium" | "large" | "xl" | "xxl"
type Theme = "dark" | "light"
type FontFamily = "sans" | "serif" | "mono" | "inter" | "roboto" | "merriweather" | "playfair"

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

export function ViewerInterface({ event, slug }: ViewerInterfaceProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [isLive, setIsLive] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [currentSession, setCurrentSession] = useState<EventSession | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [newestTranscriptionId, setNewestTranscriptionId] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<FontSize>("medium")
  const [theme, setTheme] = useState<Theme>("dark")
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans")

  useEffect(() => {
    const savedTheme = localStorage.getItem("viewer-theme") as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
    const savedFont = localStorage.getItem("viewer-font") as FontFamily | null
    if (savedFont) {
      setFontFamily(savedFont)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    localStorage.setItem("viewer-theme", newTheme)
  }

  const changeFontFamily = (font: FontFamily) => {
    setFontFamily(font)
    localStorage.setItem("viewer-font", font)
  }

  useEffect(() => {
    let isSubscribed = true
    let channel: RealtimeChannel | null = null

    const initializeViewer = async () => {
      const response = await fetch(`/api/stream/${event.slug}`)
      const result = await response.json()

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

      const channelName = `transcriptions-${event.slug}`

      channel = createClient()
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

            if (!newTranscription.text || newTranscription.text.trim() === "" || !newTranscription.is_final) {
              return
            }

            let sessionInfo = null
            if (newTranscription.session_id) {
              const { data: sessionData } = await createClient()
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

              const newItem = {
                id: newTranscription.id,
                text: newTranscription.text,
                isFinal: newTranscription.is_final,
                sequenceNumber: newTranscription.sequence_number,
                timestamp: new Date(newTranscription.created_at),
                sessionId: newTranscription.session_id,
                sessionInfo,
              }

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
        .on("broadcast", { event: "streaming_status" }, (payload: any) => {
          const { status, sessionId, timestamp } = payload.payload

          if (status === "started") {
            setIsLive(true)
          } else if (status === "stopped") {
            setIsLive(false)
          }
        })
        .subscribe((status, err) => {
          if (err) {
            console.error("Supabase subscription error:", err)
          }
        })

      return () => {
        isSubscribed = false
        if (channel) {
          createClient().removeChannel(channel)
        }
      }
    }

    initializeViewer()
  }, [event.slug])

  useEffect(() => {
    const sessionId = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`
    let pingInterval: NodeJS.Timeout | null = null

    const setupViewerTracking = async () => {
      const { data: eventData } = await createClient().from("events").select("id").eq("slug", event.slug).single()

      if (!eventData) return

      await createClient().from("viewer_sessions").insert({
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
        await createClient()
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
        const { data: eventData } = await createClient().from("events").select("id").eq("slug", event.slug).single()
        if (eventData) {
          await createClient()
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
  }, [transcriptions, autoScroll, newestTranscriptionId, isLive])

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

        if (timeDiff > 10) {
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

  const allDisplayItems = useMemo(() => {
    return groupedTranscriptions.flatMap((group, index) =>
      group.texts.map((text, textIndex) => {
        const transcriptionIndex = displayTranscriptions.findIndex((t) => t.text === text)
        const transcription = transcriptionIndex >= 0 ? displayTranscriptions[transcriptionIndex] : undefined
        const isLastInGroup = textIndex === group.texts.length - 1
        const isLastGroup = index === groupedTranscriptions.length - 1
        const shouldAnimate = isLastInGroup && isLastGroup && transcription?.id === newestTranscriptionId

        return (
          <span key={`${index}-${textIndex}`}>
            <TranscriptionText text={text} shouldAnimate={shouldAnimate} />
            {textIndex < group.texts.length - 1 && " "}
          </span>
        )
      }),
    )
  }, [groupedTranscriptions, displayTranscriptions])

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }

  const TranscriptionContent = ({ fontSize }: { fontSize: FontSize }) => {
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
      inter: "font-sans",
      roboto: "font-sans",
      merriweather: "font-serif",
      playfair: "font-serif",
    }

    const textClass = fontSizeClasses[fontSize]
    const fontClass = fontFamilyClasses[fontFamily]

    const bgClass = theme === "dark" ? "bg-black" : "bg-white"
    const textColorClass = theme === "dark" ? "text-white" : "text-gray-900"
    const mutedTextClass = theme === "dark" ? "text-muted-foreground" : "text-gray-500"
    const borderClass = theme === "dark" ? "border-border" : "border-gray-200"
    const timestampClass = theme === "dark" ? "text-foreground/40" : "text-gray-400"

    const increaseFontSize = () => {
      if (fontSize === "xs") setFontSize("small")
      else if (fontSize === "small") setFontSize("medium")
      else if (fontSize === "medium") setFontSize("large")
      else if (fontSize === "large") setFontSize("xl")
      else if (fontSize === "xl") setFontSize("xxl")
      setTimeout(scrollToBottom, 100)
    }

    const decreaseFontSize = () => {
      if (fontSize === "xxl") setFontSize("xl")
      else if (fontSize === "xl") setFontSize("large")
      else if (fontSize === "large") setFontSize("medium")
      else if (fontSize === "medium") setFontSize("small")
      else if (fontSize === "small") setFontSize("xs")
      setTimeout(scrollToBottom, 100)
    }

    const fontFamilyLabels = {
      sans: "System Sans",
      serif: "System Serif",
      mono: "Monospace",
      inter: "Inter",
      roboto: "Roboto",
      merriweather: "Merriweather",
      playfair: "Playfair Display",
    }

    return (
      <div className={`flex flex-col h-screen ${bgClass} overflow-hidden`} key={fontSize}>
        {/* Header */}
        <div className={`${bgClass} border-b ${borderClass} flex-shrink-0`}>
          <div className="px-6 sm:px-8 lg:px-12 py-4 mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {event?.logo_url && (
                  <img
                    src={event.logo_url || "/placeholder.svg"}
                    alt="Event logo"
                    className="h-12 w-12 rounded-lg object-contain"
                  />
                )}
                <div>
                  <h1 className={`text-xl sm:text-2xl font-bold ${textColorClass}`}>Live Transcription</h1>
                  {event?.name && <p className={`text-sm ${mutedTextClass} mt-0.5`}>{event.name}</p>}
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
                      theme === "dark"
                        ? "bg-black border-gray-800 text-white"
                        : "bg-white border-gray-200 text-gray-900"
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
                      >
                        Monospace
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="inter"
                        className={`cursor-pointer ${
                          theme === "dark"
                            ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                            : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Inter
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="roboto"
                        className={`cursor-pointer ${
                          theme === "dark"
                            ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                            : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Roboto
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="merriweather"
                        className={`cursor-pointer ${
                          theme === "dark"
                            ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                            : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Merriweather
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="playfair"
                        className={`cursor-pointer ${
                          theme === "dark"
                            ? "hover:bg-white/10 focus:bg-white/10 text-white hover:text-white focus:text-white"
                            : "hover:bg-gray-100 focus:bg-gray-100 text-gray-900 hover:text-gray-900 focus:text-gray-900"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Playfair Display
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
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
        <div className="flex-1 overflow-hidden px-6 sm:px-8 lg:px-12 py-6 mx-auto w-full">
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
                  <div className="space-y-1">
                    <div className={`text-xs ${timestampClass} uppercase tracking-wide`}>
                      {group.timestamp.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                    <div className={`${textClass} ${textColorClass} font-bold ${fontClass}`}>
                      {group.texts.map((text, textIndex) => {
                        const transcriptionIndex = displayTranscriptions.findIndex((t) => t.text === text)
                        const transcription =
                          transcriptionIndex >= 0 ? displayTranscriptions[transcriptionIndex] : undefined
                        const isLastInGroup = textIndex === group.texts.length - 1
                        const isLastGroup = index === groupedTranscriptions.length - 1
                        const shouldAnimate =
                          isLastInGroup && isLastGroup && transcription?.id === newestTranscriptionId

                        return (
                          <span key={`${index}-${textIndex}`}>
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

        {/* Footer */}
        <div className={`${bgClass} border-t ${borderClass} flex-shrink-0`}>
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

  return <TranscriptionContent fontSize={fontSize} />
}
