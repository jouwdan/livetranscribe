"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

export function UserMenu() {
  const router = useRouter()
  const [userInitials, setUserInitials] = useState("")
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    const getUserInfo = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setUserEmail(user.email || "")

      // Get user profile to check for full name
      const { data: profile } = await supabase.from("user_profiles").select("full_name").eq("id", user.id).maybeSingle()

      // Generate initials from full name or email
      if (profile?.full_name) {
        const names = profile.full_name.trim().split(" ")
        if (names.length >= 2) {
          setUserInitials(`${names[0][0]}${names[names.length - 1][0]}`.toUpperCase())
        } else {
          setUserInitials(names[0][0].toUpperCase())
        }
      } else if (user.email) {
        setUserInitials(user.email[0].toUpperCase())
      }
    }

    getUserInfo()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-purple-600 text-white text-sm font-semibold">
              {userInitials || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-black/95 border-white/10 backdrop-blur-sm">
        <DropdownMenuLabel className="text-white">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">My Account</p>
            <p className="text-xs text-slate-400 truncate">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="text-slate-300 focus:text-white focus:bg-white/10 cursor-pointer">
          <Link href="/account" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Account Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
