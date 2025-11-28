import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { AppNav } from "@/components/app-nav"

export const dynamic = "force-dynamic"

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <AppNav />
      <div className="flex-1 w-full">{children}</div>
    </div>
  )
}
