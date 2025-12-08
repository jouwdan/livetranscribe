"use client"

import { Button } from "@/components/ui/button"
import { Mic, Users, Globe, Ear, Brain, Heart, AudioLines } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-32 md:py-48 max-w-5xl">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-sm">
            <AudioLines className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Open Source • Self-Hostable • Free Forever</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-balance">Make every event accessible</h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto text-balance leading-relaxed">
            Real-time AI transcription for in-person events. Deploy on Vercel in minutes. No limits, no subscriptions.
          </p>

          <div className="flex gap-4 justify-center items-center pt-4">
            <Link href="/auth/login">
              <Button size="lg" className="h-12 px-8 text-base">
                View Live Events
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-transparent">
                Start Broadcasting
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Accessibility First Section */}
      <section className="container mx-auto px-4 py-24 max-w-6xl">
        <div className="rounded-3xl border bg-card p-8 md:p-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

          <div className="relative space-y-12">
            {/* Header */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
                <Heart className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Accessibility First</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-balance">Designed for everyone</h2>
              <p className="text-lg text-muted-foreground text-pretty leading-relaxed">
                LiveTranscribe ensures your events are accessible to deaf and hearing impaired attendees, plus supports
                neurodiverse audiences who benefit from reading along with speakers.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid md:grid-cols-3 gap-8 pt-8">
              <div className="space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Ear className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Deaf & Hearing Impaired</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Provide real-time captions so every attendee can follow along, regardless of hearing ability. No one
                  should miss out.
                </p>
              </div>

              <div className="space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Brain className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Neurodiverse Support</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Help attendees with ADHD, autism, or auditory processing differences by providing text they can read
                  at their own pace.
                </p>
              </div>

              <div className="space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Globe className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Language Support</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Non-native speakers can follow along more easily, improving comprehension and making events truly
                  inclusive.
                </p>
              </div>
            </div>

            {/* Quote */}
            <div className="text-center pt-8 border-t">
              <p className="text-muted-foreground italic text-lg">
                "Accessibility isn't a feature—it's a foundation. Every event deserves to be inclusive."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-24 max-w-6xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-balance">Powerful, simple, yours</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Self-host on your infrastructure. Zero vendor lock-in. Deploy to Vercel in one click.
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
              icon: AudioLines,
              title: "Real-Time AI Transcription",
              description: "Advanced AI models transcribe speech in real-time with high accuracy for live events.",
            },
            {
              icon: Users,
              title: "Easy Viewer Access",
              description: "Share a simple URL with attendees. No app downloads, no complicated setup.",
            },
            {
              icon: Globe,
              title: "Custom Event URLs",
              description: "Create memorable, branded URLs for your events. Perfect for recurring conferences.",
            },
            {
              icon: Heart,
              title: "Open Source",
              description: "Fully open-source. Deploy to Vercel, customize to your needs, and own your data.",
            },
            {
              icon: Brain,
              title: "Multiple Sessions",
              description: "Support multiple concurrent sessions per event for multi-track conferences.",
            },
          ].map((feature) => (
            <div key={feature.title} className="rounded-2xl border bg-card p-6 hover:border-primary/50 transition-all">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24 max-w-4xl">
        <div className="rounded-3xl border bg-card p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          <div className="relative space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-balance">Ready to make your events accessible?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Sign in to start broadcasting or view live events happening right now.
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Link href="/auth/login">
                <Button size="lg" className="h-12 px-8 text-base">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-transparent">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
