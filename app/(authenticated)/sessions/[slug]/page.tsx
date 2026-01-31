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
  const sessionIds = (sessions || []).map((s) => s.id)
  const { data: allTranscriptions } = await supabase
    .from("transcriptions")
    .select("session_id, text")
    .in("session_id", sessionIds)
    .eq("is_final", true)

  const transcriptionsBySession = (allTranscriptions || []).reduce(
    (acc, t) => {
      if (t.session_id) {
        if (!acc[t.session_id]) {
          acc[t.session_id] = []
        }
        acc[t.session_id].push(t)
      }
      return acc
    },
    {} as Record<string, NonNullable<typeof allTranscriptions>>,
  )

  const sessionsWithStats = await Promise.all(
    (sessions || []).map(async (session) => {
      const sessionTranscriptions = transcriptionsBySession[session.id] || []

      const totalTranscriptions = sessionTranscriptions.length
      const totalWords = sessionTranscriptions.reduce((sum, t) => sum + (t.text?.split(/\s+/).length || 0), 0)

      // Update the session record with real stats only if changed
      if (session.total_transcriptions !== totalTranscriptions || session.total_words !== totalWords) {
        await supabase
          .from("event_sessions")
          .update({
            total_transcriptions: totalTranscriptions,
            total_words: totalWords,
          })
          .eq("id", session.id)
      }

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
