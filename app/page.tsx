"use client"

import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Mic,
  Users,
  Zap,
  Clock,
  Globe,
  CheckCircle2,
  AudioLines,
  BarChart3,
  Heart,
  Ear,
  Brain,
} from "lucide-react"
import Link from "next/link"
import { PublicNav } from "@/components/public-nav"

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float-1" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-float-2" />

      <div className="relative z-10">
        <PublicNav />

        <main>
          <section className="container mx-auto px-4 py-24 md:py-32 max-w-6xl">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm mb-6">
                <AudioLines className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-purple-300">AI-Powered Live Transcription</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
                Make every event
                <br />
                accessible to everyone
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Real-time AI transcription for conferences, workshops, and in-person events. Built by event organizers
                who understand accessibility matters.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link href="/beta">
                  <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90 text-white">
                    Get Beta Access
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
            <div className="glass-card p-8 md:p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/2 to-pink-500/2" />
              <div className="relative z-10">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm mb-4">
                    <Heart className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-purple-300">Accessibility First</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">Designed for everyone</h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    LiveTranscribe ensures your events are accessible to deaf and hard-of-hearing attendees, plus
                    supports neurodiverse audiences who benefit from reading along with speakers.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-white/5 transition-all">
                    <Ear className="h-10 w-10 mb-4 text-purple-400" />
                    <h3 className="text-xl font-semibold mb-3">Deaf & Hard of Hearing</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Provide real-time captions so every attendee can follow along, regardless of hearing ability. No
                      one should miss out on important content.
                    </p>
                  </div>

                  <div className="p-6 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-white/5 transition-all">
                    <Brain className="h-10 w-10 mb-4 text-purple-400" />
                    <h3 className="text-xl font-semibold mb-3">Neurodiverse Support</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Help attendees with ADHD, autism, or auditory processing differences by providing text they can
                      read at their own pace while listening.
                    </p>
                  </div>

                  <div className="p-6 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-white/5 transition-all">
                    <Globe className="h-10 w-10 mb-4 text-purple-400" />
                    <h3 className="text-xl font-semibold mb-3">Language Support</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Attendees who are non-native speakers or prefer reading can follow along more easily, improving
                      comprehension and engagement.
                    </p>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <p className="text-sm text-muted-foreground italic">
                    "Accessibility isn't a feature—it's a foundation. Every event deserves to be inclusive."
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="container mx-auto px-4 py-16 max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Built by organizers, for organizers</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                We've been there. Running events and struggling with accessibility. So we built the solution we wished
                existed.
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
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Perfect for live, in-person events</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From small meetups to large conferences, we've designed every feature with real event scenarios in mind.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Conferences & Summits",
                  description:
                    "Multi-track conferences with hundreds of attendees. Real-time captions projected on screens or accessed via phone.",
                  highlights: ["Multi-session support", "Custom branding", "Analytics dashboard"],
                },
                {
                  title: "Workshops & Training",
                  description:
                    "Hands-on workshops and training sessions. Attendees follow along in real-time without missing critical instructions.",
                  highlights: ["Real-time streaming", "Custom event URLs", "Session tracking"],
                },
                {
                  title: "Community Events",
                  description:
                    "Meetups, hackathons, and educational sessions. Make your community events inclusive for everyone.",
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
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Join fellow event organizers making accessibility easy
                </h2>
                <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                  We understand the challenges of running events. That's why we built LiveTranscribe to be effortless.
                </p>
                <Link href="/beta">
                  <Button size="lg" className="gap-2 bg-white text-black hover:bg-white/90">
                    Get Beta Access
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/10 mt-24 backdrop-blur-xl bg-black/50">
          <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <AudioLines className="h-5 w-5 text-purple-400" />
                <span className="font-semibold">LiveTranscribe</span>
              </div>
              <div className="flex gap-8 text-sm text-muted-foreground">
                <Link href="/beta" className="hover:text-foreground transition-colors">
                  Beta Access
                </Link>
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
              <p className="text-sm text-muted-foreground">
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
        </footer>
      </div>
    </div>
  )
}
