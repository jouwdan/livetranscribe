import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, Users, Zap } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">livetranscribe.net</h1>
          <p className="text-xl text-slate-600 mb-8">Real-time AI transcription for events, powered by OpenAI</p>
          <div className="flex gap-4 justify-center">
            <Link href="/create">
              <Button size="lg" className="gap-2">
                <Mic className="h-5 w-5" />
                Create Event
              </Button>
            </Link>
            <Link href="/join">
              <Button size="lg" variant="outline" className="gap-2 bg-transparent">
                <Users className="h-5 w-5" />
                Join Event
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <Mic className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Live Audio Capture</CardTitle>
              <CardDescription>Capture live audio directly from your microphone</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Use your browser's microphone to capture event audio for real-time AI transcription.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Real-Time Transcription</CardTitle>
              <CardDescription>Powered by OpenAI Realtime API with instant results</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Get word-by-word transcriptions as you speak with minimal latency using advanced AI.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Live Subtitles</CardTitle>
              <CardDescription>Attendees read live captions in their browser</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Share a URL with attendees to view live transcriptions as continuous subtitles.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
