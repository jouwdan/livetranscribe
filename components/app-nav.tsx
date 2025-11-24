"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Radio, LogOut, Sparkles, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function AppNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setIsLoggedIn(true)

      const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).maybeSingle()

      setIsAdmin(profile?.is_admin || false)
    }

    checkAdmin()
  }, [])

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
              href={isLoggedIn ? "/dashboard" : "/"}
              className="text-xl font-bold text-white flex items-center gap-2"
            >
              <Sparkles className="h-5 w-5 text-purple-400" />
              LiveTranscribe
            </Link>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 text-slate-400 hover:text-white hover:bg-white/5",
                    isActive("/dashboard") && "text-white bg-white/10",
                  )}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/admin">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 text-slate-400 hover:text-white hover:bg-white/5",
                      isActive("/admin") && "text-white bg-white/10",
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              {pathname.startsWith("/broadcast/") && (
                <Link href={pathname}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 text-slate-400 hover:text-white hover:bg-white/5",
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
          <form action="/auth/logout" method="post">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-white hover:bg-white/5">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>
      </div>
    </nav>
  )
}
