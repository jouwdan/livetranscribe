"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, Mail, Heart } from "lucide-react"
import Link from "next/link"

export default function PricingClientPage() {
  // const pricingTiers = [
  //   {
  //     size: "Small",
  //     attendees: "≤100 attendees",
  //     plans: [
  //       {
  //         duration: "Up to 3 hours",
  //         price: 90,
  //         notes: "Great for workshops, podcasts, or small panels.",
  //       },
  //       {
  //         duration: "Half-day (≤5 hours)",
  //         price: 140,
  //         notes: "Includes full-day captioning + transcript storage.",
  //       },
  //       {
  //         duration: "Full-day (≤10 hours)",
  //         price: 220,
  //         notes: "Extended event support; 30-day transcript retention.",
  //       },
  //     ],
  //   },
  //   {
  //     size: "Medium",
  //     attendees: "101–250 attendees",
  //     plans: [
  //       {
  //         duration: "Up to 3 hours",
  //         price: 160,
  //         notes: "Supports larger online or hybrid meetups.",
  //       },
  //       {
  //         duration: "Half-day (≤5 hours)",
  //         price: 250,
  //         notes: "Live captioning + transcript export.",
  //       },
  //       {
  //         duration: "Full-day (≤10 hours)",
  //         price: 350,
  //         notes: "Ideal for conferences or full workshops.",
  //       },
  //     ],
  //   },
  //   {
  //     size: "Large",
  //     attendees: "251–500 attendees",
  //     plans: [
  //       {
  //         duration: "Up to 3 hours",
  //         price: 250,
  //         notes: "Handles larger audience throughput; realtime streaming optimized.",
  //       },
  //       {
  //         duration: "Half-day (≤5 hours)",
  //         price: 350,
  //         notes: "Mid-size hybrid events.",
  //       },
  //       {
  //         duration: "Full-day (≤10 hours)",
  //         price: 500,
  //         notes: "Day-long community summits or multi-panel events.",
  //       },
  //     ],
  //   },
  // ]

  return (
    <main className="container mx-auto px-4 py-16 max-w-7xl space-y-16">
      {/* Hero Section */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm mb-6">
          <Heart className="h-4 w-4 text-purple-400" />
          <span className="text-sm text-purple-300">Beta Access</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
          Making events accessible
          <br />
          for everyone
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          LiveTranscribe is currently in beta and we're offering limited access to community groups, non-profits,
          educational institutions, and organizations committed to accessibility.
        </p>
      </div>

      {/* Beta pitch */}
      <div className="glass-card p-12 md:p-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm mb-6">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-sm text-green-300">Limited Beta Access</span>
          </div>
          <h2 className="text-4xl font-bold mb-6">Join our beta program</h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            We're working with select community groups to refine LiveTranscribe and ensure it meets the needs of
            organizations making events more accessible. Our beta program provides early access with special pricing for
            qualifying organizations.
          </p>

          <div className="grid md:grid-cols-2 gap-6 text-left mb-10">
            <div className="p-6 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-3">Who we're looking for</h3>
              <ul className="space-y-2 text-muted-foreground">
                {["Community groups & non-profits", "Educational institutions", "Open-source events & conferences", "Organizations focused on accessibility"].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="p-6 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm">
              <h3 className="text-xl font-semibold mb-3">What you'll get</h3>
              <ul className="space-y-2 text-muted-foreground">
                {["Real-time AI transcription", "Special beta pricing & discounts", "Direct support from our team", "Input on feature development"].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="mailto:hello@livetranscribe.net?subject=Beta%20Access%20Request">
              <Button size="lg" className="gap-2 bg-white text-black hover:bg-white/90">
                <Mail className="h-5 w-5" />
                Request Beta Access
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="border-white/20 hover:bg-white/5 bg-transparent">
                View Dashboard
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            Questions? Email us at{" "}
            <a href="mailto:hello@livetranscribe.net" className="text-purple-400 hover:underline">
              hello@livetranscribe.net
            </a>
          </p>
        </div>
      </div>

      {/* Pricing cards placeholder kept for future use */}
      {/*
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {pricingTiers.map((tier) => (
          <div key={tier.size} className="glass-card p-8 hover:bg-white/10 transition-all">
            ... existing pricing cards ...
          </div>
        ))}
      </div>
      */}

      {/* Features Included */}
      <div className="glass-card p-8 md:p-12">
        <h2 className="text-3xl font-bold text-center mb-8">Features included in beta access</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            "Real-time AI transcription",
            "Custom event URLs",
            "Multi-session support",
            "QR code generation",
            "Timestamped transcripts",
            "Transcript downloads",
            "Multiple display modes",
            "Mobile & TV optimized",
            "Usage analytics",
            "Viewer engagement metrics",
            "Direct email support",
            "Feature request input",
          ].map((feature) => (
            <div key={feature} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="glass-card p-8 md:p-12">
        <h2 className="text-3xl font-bold text-center mb-8">Frequently asked questions</h2>
        <div className="space-y-6 max-w-3xl mx-auto">
          {["Who can apply for beta access?", "What does beta access include?", "How do I apply?", "Is there a cost for beta access?", "When will LiveTranscribe be generally available?"].map(
            (question, index) => {
              const answers = [
                "We're currently accepting applications from community groups, non-profits, educational institutions, open-source events, and organizations committed to making their events more accessible.",
                "Beta participants get full access to all LiveTranscribe features with special pricing, direct support from our team, and the opportunity to provide feedback that shapes the product.",
                "Email us at hello@livetranscribe.net with information about your organization and events. We'll review your application and get back to you within 48 hours.",
                "Beta participants receive special discounted pricing based on their organization type and event needs. We work with each group individually to ensure accessibility is affordable.",
                "We're focused on working closely with beta participants to refine the platform. General availability timing will depend on feedback and feature development during the beta period.",
              ]

              return (
                <div key={question}>
                  <h3 className="text-lg font-semibold mb-2">{question}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{answers[index]}</p>
                </div>
              )
            },
          )}
        </div>
      </div>

      {/* CTA Section */}
      <div className="glass-card p-12 md:p-16 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to make your events accessible?</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join our beta program and help shape the future of live transcription.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="mailto:hello@livetranscribe.net?subject=Beta%20Access%20Request">
            <Button size="lg" className="gap-2 bg-white text-black hover:bg-white/90">
              Request Beta Access
              <Mail className="h-5 w-5" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-6">
          Questions? Email us at{" "}
          <a href="mailto:hello@livetranscribe.net" className="text-purple-400 hover:underline">
            hello@livetranscribe.net
          </a>
        </p>
      </div>
    </main>
  )
}
