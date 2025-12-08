"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Radio, Settings, Download, Moon, Sun, Home, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { createBrowserClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useTheme } from "next-themes"

interface Transcription {
  id: string
  text: string
  created_at: string
  is_final: boolean
  sequence_number: number
  speaker_id: string | null
  session_id: string
}

interface InterimTranscription {
  text: string
  timestamp: string
}

interface StreamingStatus {
  status: "started" | "stopped"
  sessionId: string
  timestamp: string
}

interface ViewerInterfaceProps {
  eventSlug: string
  eventName: string
  eventDescription?: string
  logoUrl?: string
}

export function ViewerInterface({ eventSlug, eventName, eventDescription, logoUrl }: ViewerInterfaceProps) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [interimTranscription, setInterimTranscription] = useState<InterimTranscription | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [fontSize, setFontSize] = useState("text-lg")
  const [fontFamily, setFontFamily] = useState("font-sans")
  const [autoScroll, setAutoScroll] = useState(true)
  const [widthMode, setWidthMode] = useState<"normal" | "wide">("normal")
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    let mounted = true
    const supabase = createBrowserClient()

    const initializeViewer = async () => {
      console.log("[v0] Initializing viewer for event:", eventSlug)

      const { data: eventData } = await supabase
        .from("events")
        .select("id, session_active")
        .eq("slug", eventSlug)
        .single()

      if (!eventData || !mounted) return

      console.log("[v0] Event data:", eventData)

      setIsLive(eventData.session_active || false)

      const { data: transcriptData } = await supabase
        .from("transcriptions")
        .select("*")
        .eq("event_id", eventData.id)
        .order("sequence_number", { ascending: true })

      console.log("[v0] Loaded transcriptions:", transcriptData?.length)

      if (transcriptData && mounted) {
        setTranscriptions(transcriptData)
      }

      const sseUrl = `/api/stream/${eventSlug}`
      console.log("[v0] Connecting to SSE:", sseUrl)
      const eventSource = new EventSource(sseUrl)

      eventSource.addEventListener("interim", (e) => {
        if (!mounted) return
        try {
          const data = JSON.parse(e.data)
          console.log("[v0] Received interim transcription:", data.text.substring(0, 50))
          setInterimTranscription({
            text: data.text,
            timestamp: new Date().toISOString(),
          })
        } catch (err) {
          console.error("[v0] Error parsing interim transcription:", err)
        }
      })

      eventSource.addEventListener("transcription", (e) => {
        if (!mounted) return
        try {
          const data = JSON.parse(e.data)
          console.log("[v0] Received final transcription via SSE:", data.text.substring(0, 50))
          setInterimTranscription(null)
        } catch (err) {
          console.error("[v0] Error parsing transcription:", err)
        }
      })

      eventSource.onerror = (error) => {
        console.error("[v0] SSE connection error:", error)
        eventSource.close()
      }

      const channel = supabase
        .channel(`transcriptions-${eventSlug}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transcriptions",
            filter: `event_id=eq.${eventData.id}`,
          },
          (payload) => {
            if (!mounted) return
            console.log("[v0] New transcription from Realtime:", payload)
            const newTranscription = payload.new as Transcription
            setTranscriptions((prev) => {
              const exists = prev.some((t) => t.id === newTranscription.id)
              if (exists) return prev
              return [...prev, newTranscription].sort((a, b) => a.sequence_number - b.sequence_number)
            })
            setInterimTranscription(null)
          },
        )
        .on("broadcast", { event: "streaming_status" }, (payload) => {
          if (!mounted) return
          console.log("[v0] Streaming status update:", payload)
          const status = payload.payload as StreamingStatus
          if (status.status === "started") {
            setIsLive(true)
          } else if (status.status === "stopped") {
            setIsLive(false)
            setInterimTranscription(null)
          }
        })
        .subscribe()

      channelRef.current = channel

      return () => {
        console.log("[v0] Cleaning up viewer")
        mounted = false
        eventSource.close()
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
        }
      }
    }

    initializeViewer()

    return () => {
      mounted = false
      if (channelRef.current) {
        const supabase = createBrowserClient()
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [eventSlug])

  useEffect(() => {
    if (autoScroll && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [transcriptions, interimTranscription, autoScroll])

  const handleDownloadTranscript = () => {
    const content = transcriptions.map((t) => `[${new Date(t.created_at).toLocaleString()}] ${t.text}`).join("\n\n")

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${eventSlug}-transcript-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className={`mx-auto px-4 py-4 ${widthMode === "wide" ? "max-w-7xl" : "max-w-4xl"}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {logoUrl && (
                <img
                  src={logoUrl || "/placeholder.svg"}
                  alt={`${eventName} logo`}
                  className="h-10 w-10 object-contain flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{eventName}</h1>
                {eventDescription && <p className="text-sm text-muted-foreground line-clamp-1">{eventDescription}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={isLive ? "default" : "secondary"} className="gap-1.5">
                {isLive && <Radio className="h-3 w-3 animate-pulse" />}
                {isLive ? "LIVE" : "OFFLINE"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWidthMode(widthMode === "normal" ? "wide" : "normal")}
              >
                {widthMode === "normal" ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3">Display Settings</h3>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Font Size</Label>
                          <Select value={fontSize} onValueChange={setFontSize}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text-sm">Small</SelectItem>
                              <SelectItem value="text-base">Medium</SelectItem>
                              <SelectItem value="text-lg">Large</SelectItem>
                              <SelectItem value="text-xl">Extra Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Font Family</Label>
                          <Select value={fontFamily} onValueChange={setFontFamily}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="font-sans">Sans Serif</SelectItem>
                              <SelectItem value="font-serif">Serif</SelectItem>
                              <SelectItem value="font-mono">Monospace</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <Label htmlFor="auto-scroll">Auto-scroll</Label>
                          <Switch id="auto-scroll" checked={autoScroll} onCheckedChange={setAutoScroll} />
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                onClick={handleDownloadTranscript}
                disabled={transcriptions.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Link href="/">
                <Button variant="outline" size="icon">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className={`mx-auto px-4 py-8 ${widthMode === "wide" ? "max-w-7xl" : "max-w-4xl"}`}>
        <Card className="p-6 min-h-[600px]">
          <div ref={transcriptContainerRef} className="space-y-4">
            {transcriptions.length === 0 && !interimTranscription ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {isLive
                    ? "Waiting for transcriptions..."
                    : "No transcriptions yet. Start broadcasting to see live text."}
                </p>
              </div>
            ) : (
              <>
                {transcriptions.map((transcription, index) => (
                  <div key={transcription.id} className="group">
                    <div className="flex gap-3 items-start">
                      <span className="text-xs text-muted-foreground mt-1 flex-shrink-0 font-mono">
                        {formatDistanceToNow(new Date(transcription.created_at), { addSuffix: true })}
                      </span>
                      <p className={`${fontSize} ${fontFamily} text-foreground flex-1 leading-relaxed`}>
                        {transcription.text}
                      </p>
                    </div>
                    {index < transcriptions.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
                {interimTranscription && (
                  <>
                    {transcriptions.length > 0 && <Separator className="my-4" />}
                    <div className="group">
                      <div className="flex gap-3 items-start">
                        <span className="text-xs text-muted-foreground mt-1 flex-shrink-0 font-mono">
                          {formatDistanceToNow(new Date(interimTranscription.timestamp), { addSuffix: true })}
                        </span>
                        <p
                          className={`${fontSize} ${fontFamily} text-muted-foreground/70 italic flex-1 leading-relaxed`}
                        >
                          {interimTranscription.text}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </Card>
      </div>
    </div>
  )
}
