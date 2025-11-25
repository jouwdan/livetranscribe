"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, Users, Clock, AudioLines, Heart } from "lucide-react"
import Link from "next/link"
import { PublicNav } from "@/components/public-nav"

export default function PricingPage() {
  const pricingTiers = [
    {
      size: "Small",
      attendees: "≤100 attendees",
      plans: [
        {
          duration: "Up to 3 hours",
          price: 90,
          notes: "Great for workshops, podcasts, or small panels.",
        },
        {
          duration: "Half-day (≤5 hours)",
          price: 140,
          notes: "Includes full-day captioning + transcript storage.",
        },
        {
          duration: "Full-day (≤10 hours)",
          price: 220,
          notes: "Extended event support; 30-day transcript retention.",
        },
      ],
    },
    {
      size: "Medium",
      attendees: "101–250 attendees",
      plans: [
        {
          duration: "Up to 3 hours",
          price: 160,
          notes: "Supports larger online or hybrid meetups.",
        },
        {
          duration: "Half-day (≤5 hours)",
          price: 250,
          notes: "Live captioning + transcript export.",
        },
        {
          duration: "Full-day (≤10 hours)",
          price: 350,
          notes: "Ideal for conferences or full workshops.",
        },
      ],
    },
    {
      size: "Large",
      attendees: "251–500 attendees",
      plans: [
        {
          duration: "Up to 3 hours",
          price: 250,
          notes: "Handles larger audience throughput; realtime streaming optimized.",
        },
        {
          duration: "Half-day (≤5 hours)",
          price: 350,
          notes: "Mid-size hybrid events.",
        },
        {
          duration: "Full-day (≤10 hours)",
          price: 500,
          notes: "Day-long community summits or multi-panel events.",
        },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float-1" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-float-2" />

      <div className="relative z-10">
        <PublicNav />

        <main className="container mx-auto px-4 py-16 max-w-7xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm mb-6">
              <CheckCircle2 className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-purple-300">Simple, Transparent Pricing</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
              Pricing built for events
              <br />
              of every size
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Flat-rate pricing based on event size and duration. No hidden fees, no per-minute charges, just simple
              pricing that works.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm text-green-300 font-medium">15-Minute Free Trial Included</span>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {pricingTiers.map((tier) => (
              <div key={tier.size} className="glass-card p-8 hover:bg-white/10 transition-all">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-6 w-6 text-purple-400" />
                    <h2 className="text-2xl font-bold">{tier.size}</h2>
                  </div>
                  <p className="text-muted-foreground text-sm">{tier.attendees}</p>
                </div>

                <div className="space-y-4">
                  {tier.plans.map((plan, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-purple-400" />
                          <span className="text-sm font-medium text-foreground">{plan.duration}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-purple-400">€{plan.price}</span>
                          <span className="text-sm text-muted-foreground ml-1">flat</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{plan.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Features Included */}
          <div className="glass-card p-8 md:p-12 mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Everything included in every plan</h2>
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
                "Unlimited viewers per plan tier",
                "Email support",
              ].map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="glass-card p-8 md:p-12 mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <h3 className="text-lg font-semibold mb-2">What counts as an attendee?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  An attendee is the total expected size of your event (all physical or virtual attendees), not just
                  those viewing the transcription. Choose your tier based on your total event capacity.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Can I upgrade during an event?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Yes! If your event grows beyond your current tier, contact us and we'll upgrade you immediately with
                  prorated pricing.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">What happens after the event?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  All transcripts are available for download immediately after your event. Depending on your plan,
                  transcripts are stored for 30-60 days for easy access.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Do you offer volume discounts?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Yes! If you're running multiple events or a recurring event series, contact us for custom pricing and
                  volume discounts.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Is the free trial really free?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Every new account gets 15 minutes of free transcription time to test the service. No credit card
                  required.
                </p>
              </div>
            </div>
          </div>

          {/* Community Discount Section */}
          <div className="glass-card p-8 md:p-12 mb-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5" />
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm mb-4">
                <Heart className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-300">Community Support</span>
              </div>
              <h2 className="text-3xl font-bold mb-4">Supporting community groups</h2>
              <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
                We believe accessibility should be available to everyone. That's why we offer{" "}
                <span className="text-green-400 font-semibold">up to 70% discounts</span> on our rates for community
                groups, non-profits, educational institutions, and open-source events.
              </p>
              <p className="text-muted-foreground mb-8">
                Running a community event, hackathon, or educational workshop?{" "}
                <a
                  href="mailto:hello@livetranscribe.net?subject=Community%20Discount%20Request"
                  className="text-purple-400 hover:underline font-medium"
                >
                  Get in touch
                </a>{" "}
                and we'll work with you to make accessibility affordable.
              </p>
              <Link href="mailto:hello@livetranscribe.net?subject=Community%20Discount%20Request">
                <Button variant="outline" className="border-green-500/30 hover:bg-green-500/10 bg-transparent">
                  Contact Us for Community Pricing
                </Button>
              </Link>
            </div>
          </div>

          {/* CTA Section */}
          <div className="glass-card p-12 md:p-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to make your events accessible?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with a free 15-minute trial. No credit card required.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/auth/sign-up">
                <Button size="lg" className="gap-2 bg-white text-black hover:bg-white/90">
                  Get Started Free
                  <CheckCircle2 className="h-5 w-5" />
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
        </main>

        <footer className="border-t border-white/10 mt-24 backdrop-blur-xl bg-black/50">
          <div className="container mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <AudioLines className="h-5 w-5 text-purple-400" />
                <span className="font-semibold">LiveTranscribe</span>
              </div>
              <div className="flex gap-8 text-sm text-muted-foreground">
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
                <Link href="/auth/login" className="hover:text-foreground transition-colors">
                  Login
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
