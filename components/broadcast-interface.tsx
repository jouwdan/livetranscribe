"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mic, MicOff, Copy, Check, Radio, AlertCircle, Download } from "lucide-react"
import { OpenAITranscriber } from "@/lib/openai-transcriber"

interface BroadcastInterfaceProps {
  slug: string
  eventName: string
}

interface Transcription {
  text: string
  isFinal: boolean
  sequence: number
  timestamp: Date
}

export function BroadcastInterface({ slug, eventName }: BroadcastInterfaceProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [transcriptionCount, setTranscriptionCount] = useState(0)
  const [apiKey, setApiKey] = useState("")
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [currentInterim, setCurrentInterim] = useState<string>("")

  const transcriberRef = useRef<OpenAITranscriber | null>(null)
  const transcriptionsEndRef = useRef<HTMLDivElement>(null)

  const viewerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/view/${slug}`

  useEffect(() => {
    transcriptionsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcriptions, currentInterim])

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(viewerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTranscript = () => {
    const text = transcriptions
      .filter((t) => t.isFinal)
      .map((t) => `[${t.timestamp.toLocaleTimeString()}] ${t.text}`)
      .join("\n\n")

    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${slug}-transcript-${new Date().toISOString()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleTranscription = async (text: string, isFinal: boolean, sequence: number) => {
    console.log("[v0] Transcription received:", { text, isFinal, sequence })

    if (isFinal) {
      setTranscriptions((prev) => [...prev, { text, isFinal, sequence, timestamp: new Date() }])
      setCurrentInterim("")
    } else {
      setCurrentInterim(text)
    }

    try {
      const response = await fetch(`/api/stream/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          isFinal,
          sequenceNumber: sequence,
          eventName,
        }),
      })

      if (!response.ok) {
        console.error("[v0] Failed to broadcast transcription")
      } else {
        const data = await response.json()
        console.log("[v0] Broadcasted to", data.viewerCount, "viewers")
        setTranscriptionCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error("[v0] Error broadcasting transcription:", error)
    }
  }

  const handleStartStreaming = async () => {
    if (!apiKey) {
      setShowApiKeyInput(true)
      setError("Please enter your OpenAI API key")
      return
    }

    try {
      setError(null)
      const transcriber = new OpenAITranscriber(apiKey, handleTranscription, (error) => {
        setError(error)
        setIsStreaming(false)
      })

      await transcriber.start()
      transcriberRef.current = transcriber
      setIsStreaming(true)
      setShowApiKeyInput(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to start streaming")
      setIsStreaming(false)
    }
  }

  const handleStopStreaming = () => {
    if (transcriberRef.current) {
      transcriberRef.current.stop()
      transcriberRef.current = null
    }
    setIsStreaming(false)
  }

  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stop()
      }
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{eventName}</h1>
            <p className="text-slate-400">Organizer Dashboard</p>
          </div>
          <Badge variant={isStreaming ? "default" : "secondary"} className="text-lg px-4 py-2">
            {isStreaming ? (
              <>
                <Radio className="h-4 w-4 mr-2 animate-pulse" />
                Live
              </>
            ) : (
              "Offline"
            )}
          </Badge>
        </div>

        {/* Viewer URL Card */}
        <Card>
          <CardHeader>
            <CardTitle>Viewer URL</CardTitle>
            <CardDescription>Share this URL with attendees so they can view the live transcription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                value={viewerUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm"
              />
              <Button onClick={copyToClipboard} variant="outline">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Key Input */}
        {(showApiKeyInput || !isStreaming) && (
          <Card>
            <CardHeader>
              <CardTitle>OpenAI API Configuration</CardTitle>
              <CardDescription>Enter your OpenAI API key to enable live transcription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">OpenAI API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isStreaming}
                />
                <p className="text-xs text-slate-500">Your API key is stored locally and never sent to our servers</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Streaming Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Audio Stream</CardTitle>
            <CardDescription>Control your live audio broadcast and transcription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <div className="p-4 bg-slate-100 rounded-md">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-600">Transcriptions sent:</span>
                    <span className="font-semibold text-slate-900">{transcriptionCount}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {transcriptions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transcription History</CardTitle>
                  <CardDescription>Live transcription of your audio stream</CardDescription>
                </div>
                <Button onClick={downloadTranscript} variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[60vh] overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-md border border-slate-200">
                {transcriptions.map((transcription, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-slate-500 font-mono">
                        {transcription.timestamp.toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        #{transcription.sequence}
                      </Badge>
                    </div>
                    <p className="text-slate-900 leading-relaxed">{transcription.text}</p>
                  </div>
                ))}
                {currentInterim && (
                  <div className="space-y-1 opacity-60 animate-pulse">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-slate-500 font-mono">{new Date().toLocaleTimeString()}</span>
                      <Badge variant="outline" className="text-xs">
                        Interim
                      </Badge>
                    </div>
                    <p className="text-slate-700 leading-relaxed italic">{currentInterim}</p>
                  </div>
                )}
                <div ref={transcriptionsEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Event Slug:</span>
              <span className="font-mono">{slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Status:</span>
              <span>{isStreaming ? "Streaming" : "Offline"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Transcriptions:</span>
              <span>{transcriptions.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
