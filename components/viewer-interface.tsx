"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, Volume2, VolumeX, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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
  const [latestSequence, setLatestSequence] = useState(0)
  const transcriptionEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    console.log("[v0] Setting up Supabase real-time subscription for slug:", slug)

    const setupRealtimeSubscription = async () => {
      const supabase = createClient()

      console.log("[v0] Querying for event with slug:", slug)
      const { data: event, error: eventError } = await supabase.from("events").select("id").eq("slug", slug).single()

      if (eventError) {
        console.error("[v0] Error fetching event:", eventError)
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
          initialTranscriptions.map((t) => ({
            text: t.text,
            isFinal: t.is_final,
            sequenceNumber: t.sequence_number,
            timestamp: t.created_at,
          })),
        )
        const maxSeq = Math.max(...initialTranscriptions.map((t) => t.sequence_number), 0)
        setLatestSequence(maxSeq)
      }

      const channel = supabase
        .channel(`transcriptions:${event.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transcriptions",
            filter: `event_id=eq.${event.id}`,
          },
          (payload) => {
            console.log("[v0] Real-time transcription INSERT received:", payload.new)
            const newTranscription = payload.new as any

            setTranscriptions((prev) => {
              // Avoid duplicates
              if (prev.some((t) => t.sequenceNumber === newTranscription.sequence_number)) {
                return prev
              }

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

            setLatestSequence(newTranscription.sequence_number)
            setIsConnected(true)
          },
        )
        .subscribe((status) => {
          console.log("[v0] Supabase subscription status:", status)
          setIsConnected(status === "SUBSCRIBED")
        })

      return () => {
        console.log("[v0] Cleaning up Supabase subscription")
        supabase.removeChannel(channel)
      }
    }

    setupRealtimeSubscription()
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
      .filter((t) => t.isFinal)
      .map((t) => {
        const time = new Date(t.timestamp).toLocaleTimeString()
        return `[${time}] ${t.text}`
      })
      .join("\n\n")

    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${slug}-transcript.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const finalTranscriptions = transcriptions.filter((t) => t.isFinal)
  const latestTranscription = transcriptions[transcriptions.length - 1]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{eventName}</h1>
              <p className="text-sm text-slate-600">Live Transcription</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={downloadTranscript}
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent"
                disabled={finalTranscriptions.length === 0}
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
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Live Transcript</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setAutoScroll(!autoScroll)} className="gap-2">
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
              <div ref={containerRef} onScroll={handleScroll} className="h-[70vh] overflow-y-auto p-6 space-y-4">
                {transcriptions.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <p>Waiting for transcription to start...</p>
                  </div>
                ) : (
                  <>
                    {finalTranscriptions.map((transcription) => (
                      <div
                        key={transcription.sequenceNumber}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 text-xs text-slate-500 pt-1 w-16">
                            {new Date(transcription.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <p className="flex-1 text-slate-800 leading-relaxed">{transcription.text}</p>
                        </div>
                      </div>
                    ))}

                    {/* Show interim transcription */}
                    {latestTranscription && !latestTranscription.isFinal && (
                      <div className="animate-pulse">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 text-xs text-slate-500 pt-1 w-16">
                            {new Date(latestTranscription.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <p className="flex-1 text-slate-400 leading-relaxed italic">{latestTranscription.text}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={transcriptionEndRef} />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-900">{finalTranscriptions.length}</p>
                  <p className="text-sm text-slate-600 mt-1">Transcriptions</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-900">
                    {finalTranscriptions.reduce((acc, t) => acc + t.text.split(" ").length, 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Words</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
