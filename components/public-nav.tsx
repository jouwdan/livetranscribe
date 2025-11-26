"use client"

import { Button } from "@/components/ui/button"
import { AudioLines, Menu, X, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { usePathname } from "next/navigation"
import Link from "next/link"

export function PublicNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()

    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const isActive = (path: string) => pathname === path

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between md:grid md:grid-cols-3">
          <Link href="/" className="text-xl font-semibold flex items-center gap-2 hover:opacity-80 transition-opacity">
            <AudioLines className="h-5 w-5 text-purple-400" />
            LiveTranscribe
          </Link>

          <nav className="hidden md:flex items-center justify-center gap-6">
            <Link
              href="/"
              className={`text-sm transition-colors ${
                isActive("/") ? "text-purple-400 font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className={`text-sm transition-colors ${
                isActive("/pricing") ? "text-purple-400 font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pricing
            </Link>
          </nav>

          <nav className="hidden md:flex items-center justify-end gap-4">
            {isLoggedIn ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 transition-all">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm" className="transition-all">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 transition-all">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </nav>

          <button
            className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 mt-4 pt-4">
            <nav className="flex flex-col gap-3">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm transition-colors py-2 text-left ${
                  isActive("/") ? "text-purple-400 font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Home
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm transition-colors py-2 text-left ${
                  isActive("/pricing") ? "text-purple-400 font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pricing
              </Link>
              {isLoggedIn ? (
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 transition-all">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start transition-all">
                      Login
                    </Button>
                  </Link>
                  <Link href="/auth/sign-up" onClick={() => setMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full bg-primary hover:bg-primary/90 transition-all">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
