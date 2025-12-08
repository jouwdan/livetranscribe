"use client"
import { usePathname } from "next/navigation"
import { Home, Radio, AudioLines, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { UserMenu } from "@/components/user-menu"
import Link from "next/link"

export function AppNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(path)
  }

  return (
    <nav className="border-b border-border bg-black">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-xl font-bold text-white flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <AudioLines className="h-5 w-5 text-purple-400" />
              <span className="hidden sm:inline">LiveTranscribe</span>
            </Link>
            <div className="hidden md:flex gap-2">
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 text-slate-400 hover:text-white hover:bg-white/5 transition-all",
                    isActive("/dashboard") && "text-white bg-white/10",
                  )}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              {pathname.startsWith("/broadcast/") && (
                <Link href={pathname}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 text-slate-400 hover:text-white hover:bg-white/5 transition-all",
                      isActive("/broadcast/") && "text-white bg-white/10",
                    )}
                  >
                    <Radio className="h-4 w-4" />
                    Broadcasting
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <UserMenu />
          </div>
          <div className="flex md:hidden items-center gap-2">
            <UserMenu />
            <button
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border pb-4">
            <div className="flex flex-col gap-2 pt-4">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start gap-2 text-slate-400 hover:text-white hover:bg-white/5 transition-all",
                    isActive("/dashboard") && "text-white bg-white/10",
                  )}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              {pathname.startsWith("/broadcast/") && (
                <Link href={pathname} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-2 text-slate-400 hover:text-white hover:bg-white/5 transition-all",
                      isActive("/broadcast/") && "text-white bg-white/10",
                    )}
                  >
                    <Radio className="h-4 w-4" />
                    Broadcasting
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
