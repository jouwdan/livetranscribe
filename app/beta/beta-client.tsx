"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, AudioLines, Mail, Heart } from "lucide-react"
import Link from "next/link"
import { PublicNav } from "@/components/public-nav"

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
              <Heart className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-purple-300">Beta Access</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
              Making events accessible
              <br />
              for everyone
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              LiveTranscribe is currently in beta and we're offering limited access to community groups, non-profits,
              educational institutions, and organizations committed to accessibility.
            </p>
          </div>

          <div className="glass-card p-12 md:p-16 mb-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
            <div className="relative z-10 text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm mb-6">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-300">Limited Beta Access</span>
              </div>
              <h2 className="text-4xl font-bold mb-6">Join our beta program</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                We're working with select community groups to refine LiveTranscribe and ensure it meets the needs of
                organizations making events more accessible. Our beta program provides early access with special pricing
                for qualifying organizations.
              </p>

              <div className="grid md:grid-cols-2 gap-6 text-left mb-10">
                <div className="p-6 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm">
                  <h3 className="text-xl font-semibold mb-3">Who we're looking for</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Community groups & non-profits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Educational institutions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Open-source events & conferences</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>Organizations focused on accessibility</span>
                    </li>
                  </ul>
                </div>

                <div className="p-6 rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm">
                  <h3 className="text-xl font-semibold mb-3">What you'll get</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <span>Real-time AI transcription for your events</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <span>Special beta pricing & discounts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <span>Direct support from our team</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <span>Input on feature development</span>
                    </li>
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

          {/* Pricing cards section commented out but kept for future use
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {pricingTiers.map((tier) => (
              <div key={tier.size} className="glass-card p-8 hover:bg-white/10 transition-all">
                ... existing pricing cards ...
              </div>
            ))}
          </div>
          */}

          {/* Features Included */}
          <div className="glass-card p-8 md:p-12 mb-16">
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
          <div className="glass-card p-8 md:p-12 mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <h3 className="text-lg font-semibold mb-2">Who can apply for beta access?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We're currently accepting applications from community groups, non-profits, educational institutions,
                  open-source events, and organizations committed to making their events more accessible.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">What does beta access include?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Beta participants get full access to all LiveTranscribe features with special pricing, direct support
                  from our team, and the opportunity to provide feedback that shapes the product.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">How do I apply?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Email us at hello@livetranscribe.net with information about your organization and events. We'll review
                  your application and get back to you within 48 hours.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Is there a cost for beta access?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Beta participants receive special discounted pricing based on their organization type and event needs.
                  We work with each group individually to ensure accessibility is affordable.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">When will LiveTranscribe be generally available?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We're focused on working closely with beta participants to refine the platform. General availability
                  timing will depend on feedback and feature development during the beta period.
                </p>
              </div>
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
