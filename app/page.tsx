import { Button } from "@/components/ui/button"
import { ArrowRight, Mic, Users, Zap, Code, Clock, Globe } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Updated branding from livetranscribe.net to LiveTranscribe */}
          <Link href="/" className="text-xl font-semibold">
            LiveTranscribe
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button size="sm">Sign Up</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-24 max-w-5xl">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">Live transcription for your events.</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Real-time AI-powered transcription that makes every event accessible. Simple for organizers, seamless for
              attendees.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/auth/sign-up">
                <Button size="lg" className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-24">
            <div className="border border-border/80 rounded-lg p-8 bg-card hover:border-foreground/30 transition-all">
              <Mic className="h-10 w-10 mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-2">Live Audio Capture</h3>
              <p className="text-muted-foreground">
                Capture event audio directly from your microphone with browser-native WebRTC technology.
              </p>
            </div>

            <div className="border border-border/80 rounded-lg p-8 bg-card hover:border-foreground/30 transition-all">
              <Zap className="h-10 w-10 mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-2">Real-Time AI Transcription</h3>
              <p className="text-muted-foreground">
                Powered by OpenAI Realtime API for word-by-word transcription with minimal latency.
              </p>
            </div>

            <div className="border border-border/80 rounded-lg p-8 bg-card hover:border-foreground/30 transition-all">
              <Users className="h-10 w-10 mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-2">Live Subtitles for Attendees</h3>
              <p className="text-muted-foreground">
                Share a URL with attendees to view live transcriptions as continuous, real-time subtitles.
              </p>
            </div>

            <div className="border border-border/80 rounded-lg p-8 bg-card hover:border-foreground/30 transition-all">
              <Code className="h-10 w-10 mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-2">Web Dashboard Management</h3>
              <p className="text-muted-foreground">
                Create and manage events with custom slugs, edit details, and track viewer analytics through an
                intuitive web interface.
              </p>
            </div>

            <div className="border border-border/80 rounded-lg p-8 bg-card hover:border-foreground/30 transition-all">
              <Clock className="h-10 w-10 mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-2">Usage-Based Pricing</h3>
              <p className="text-muted-foreground">
                Pay only for what you use with transparent per-hour pricing. No hidden fees or surprises.
              </p>
            </div>

            <div className="border border-border/80 rounded-lg p-8 bg-card hover:border-foreground/30 transition-all">
              <Globe className="h-10 w-10 mb-4 text-foreground" />
              <h3 className="text-xl font-semibold mb-2">Accessible Events</h3>
              <p className="text-muted-foreground">
                Make your events accessible to everyone with live captions and transcriptions.
              </p>
            </div>
          </div>

          <div className="text-center border border-border/80 rounded-lg p-12 bg-card">
            <h2 className="text-3xl font-bold mb-4">Make every word count.</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Professional live transcription for conferences, webinars, and events. Start broadcasting accessible
              content to your attendees in minutes.
            </p>
            <Link href="/auth/sign-up">
              <Button size="lg">Get Started Today</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 mt-24">
        <div className="container mx-auto px-4 py-8">
          {/* Updated branding from livetranscribe.net to LiveTranscribe */}
          <p className="text-center text-sm text-muted-foreground">
            © 2025 LiveTranscribe. Built with OpenAI Realtime API.
          </p>
        </div>
      </footer>
    </div>
  )
}
