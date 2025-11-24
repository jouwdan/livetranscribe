import { Button } from "@/components/ui/button"
import { ArrowRight, Mic, Users, Zap, Clock, Globe, CheckCircle2, Sparkles, BarChart3 } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float-1" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-float-2" />

      <div className="relative z-10">
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
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
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  Sign Up
                </Button>
              </Link>
            </nav>
          </div>
        </header>

        <main>
          <section className="container mx-auto px-4 py-24 md:py-32 max-w-6xl">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm mb-6">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-purple-300">AI-Powered Live Transcription</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
                Make every event
                <br />
                accessible to everyone
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Real-time AI transcription for conferences, webinars, and live events. Simple setup, instant
                accessibility, pay-per-use pricing.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm mb-6">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-300 font-medium">15-Minute Free Trial on Sign Up</span>
              </div>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href="/auth/sign-up">
                  <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-white">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="lg" variant="outline" className="border-white/20 hover:bg-white/5 bg-transparent">
                    View Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          <section className="container mx-auto px-4 py-16 max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need for accessible events</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Professional-grade live transcription powered by advanced AI models, optimized for real-time event
                streaming.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Mic,
                  title: "Live Audio Capture",
                  description: "Browser-native WebRTC captures audio from any microphone with zero setup required.",
                },
                {
                  icon: Zap,
                  title: "Real-Time AI Processing",
                  description: "Advanced AI models transcribe speech in real-time for live event streaming.",
                },
                {
                  icon: Users,
                  title: "Easy Viewer Access",
                  description:
                    "Share a simple URL with attendees. No app downloads, no complicated setup, just instant access.",
                },
                {
                  icon: Globe,
                  title: "Custom Event URLs",
                  description:
                    "Create memorable, branded URLs for your events. Perfect for recurring conferences and series.",
                },
                {
                  icon: BarChart3,
                  title: "Usage Analytics",
                  description:
                    "Track viewer counts, session duration, and usage metrics in your comprehensive dashboard.",
                },
                {
                  icon: Clock,
                  title: "Timestamped Transcripts",
                  description:
                    "Automatic timestamps keep transcriptions organized and easy to follow during long events.",
                },
              ].map((feature) => (
                <div key={feature.title} className="glass-card p-6 hover:bg-white/10 transition-all group">
                  <feature.icon className="h-10 w-10 mb-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto px-4 py-16 max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for every type of event</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From intimate workshops to large-scale conferences, LiveTranscribe adapts to your needs.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Conferences & Summits",
                  description:
                    "Multi-track conferences with hundreds of attendees. Real-time captions for every session.",
                  highlights: ["Multi-session support", "Custom branding", "Analytics dashboard"],
                },
                {
                  title: "Corporate Webinars",
                  description:
                    "Company-wide meetings and training sessions. Make every word accessible to remote teams.",
                  highlights: ["Real-time streaming", "Custom event URLs", "Session tracking"],
                },
                {
                  title: "Community Events",
                  description:
                    "Meetups, workshops, and educational sessions. Support attendees who need accessibility.",
                  highlights: ["Simple setup", "Timestamped transcripts", "Easy sharing"],
                },
              ].map((useCase) => (
                <div key={useCase.title} className="glass-card p-8 hover:bg-white/10 transition-all">
                  <h3 className="text-xl font-semibold mb-3">{useCase.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{useCase.description}</p>
                  <ul className="space-y-2">
                    {useCase.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-muted-foreground">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto px-4 py-24 max-w-4xl">
            <div className="glass-card p-16 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20" />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Start making your events accessible today</h2>
                <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Join event organizers providing real-time transcription to their attendees.
                </p>
                <Link href="/auth/sign-up">
                  <Button size="lg" className="gap-2 bg-white text-black hover:bg-white/90">
                    Get Started Free
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <p className="text-sm text-muted-foreground mt-4">No credit card required · Free trial included</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/10 mt-24 backdrop-blur-xl bg-black/50">
          <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span className="font-semibold">LiveTranscribe</span>
              </div>
              <div className="flex gap-8 text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
                <Link href="/auth/login" className="hover:text-foreground transition-colors">
                  Login
                </Link>
                <Link href="/auth/sign-up" className="hover:text-foreground transition-colors">
                  Sign Up
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">© 2025 LiveTranscribe. Powered by AI.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
