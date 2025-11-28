import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EditEventForm } from "@/components/edit-event-form"

export default async function EditEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .single()

  if (error || !event) {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Event</h1>
        <EditEventForm event={event} />
      </div>
    </div>
  )
}
