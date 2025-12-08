import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EventCreditManager } from "@/components/event-credit-manager"
import { checkIsAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"

export default async function AdminEventsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const isAdmin = await checkIsAdmin(user.id)

  if (!isAdmin) {
    redirect("/dashboard")
  }

  const { data: events } = await supabase.from("events").select("*").order("created_at", { ascending: false })

  const { data: userProfiles } = await supabase.from("user_profiles").select("id, email, full_name")

  // Match user profiles to events
  const eventsWithUsers = events?.map((event) => {
    const userProfile = userProfiles?.find((profile) => profile.id === event.user_id)
    return {
      ...event,
      user_profiles: userProfile
        ? {
            email: userProfile.email,
            full_name: userProfile.full_name,
          }
        : null,
    }
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Event Credit Management</h1>
          <p className="text-slate-400">Allocate credits and manage attendee limits for events</p>
        </div>

        <EventCreditManager events={eventsWithUsers || []} />
      </div>
    </div>
  )
}
