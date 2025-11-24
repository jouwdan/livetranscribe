import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppNav } from "@/components/app-nav"
import { SessionManager } from "@/components/session-manager"

export default async function SessionsPage({ params }: { params: { slug: string } }) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", params.slug)
    .eq("user_id", user.id)
    .single()

  if (!event) {
    redirect("/dashboard")
  }

  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("*")
    .eq("event_id", event.id)
    .order("session_number", { ascending: true })

  return (
    <div className="min-h-screen bg-black">
      <AppNav />
      <div className="container mx-auto px-4 py-8">
        <SessionManager eventId={event.id} eventSlug={params.slug} eventName={event.name} sessions={sessions || []} />
      </div>
    </div>
  )
}
