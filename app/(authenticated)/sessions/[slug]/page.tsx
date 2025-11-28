import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SessionManager } from "@/components/session-manager"

export default async function SessionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: event } = await supabase.from("events").select("*").eq("slug", slug).eq("user_id", user.id).single()

  if (!event) {
    redirect("/dashboard")
  }

  const { data: sessions } = await supabase
    .from("event_sessions")
    .select(`
      *,
      transcriptions:transcriptions(count)
    `)
    .eq("event_id", event.id)
    .order("session_number", { ascending: true })

  // Calculate real stats from transcriptions for each session
  const sessionsWithStats = await Promise.all(
    (sessions || []).map(async (session) => {
      const { data: transcriptions } = await supabase
        .from("transcriptions")
        .select("text")
        .eq("session_id", session.id)
        .eq("is_final", true)

      const totalTranscriptions = transcriptions?.length || 0
      const totalWords = transcriptions?.reduce((sum, t) => sum + (t.text?.split(/\s+/).length || 0), 0) || 0

      // Update the session record with real stats
      await supabase
        .from("event_sessions")
        .update({
          total_transcriptions: totalTranscriptions,
          total_words: totalWords,
        })
        .eq("id", session.id)

      return {
        ...session,
        total_transcriptions: totalTranscriptions,
        total_words: totalWords,
      }
    }),
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <SessionManager eventId={event.id} eventSlug={slug} eventName={event.name} sessions={sessionsWithStats} />
    </div>
  )
}
