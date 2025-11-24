import { BroadcastInterface } from "@/components/broadcast-interface"
import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

interface BroadcastPageProps {
  params: Promise<{ slug: string }>
}

export default async function BroadcastPage({ params }: BroadcastPageProps) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { slug } = await params

  const { data: event } = await supabase.from("events").select("*").eq("slug", slug).eq("user_id", user.id).single()

  if (!event) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <BroadcastInterface slug={slug} eventName={event.name} eventId={event.id} />
    </div>
  )
}
