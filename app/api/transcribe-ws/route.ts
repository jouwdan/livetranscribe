import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { slug, eventName } = await request.json()

    let { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!event) {
      const { data: newEvent, error: createError } = await supabase
        .from("events")
        .insert({
          slug,
          name: eventName,
          user_id: user.id,
          organizer_key: Math.random().toString(36).substring(7),
          is_active: true,
          session_active: true,
        })
        .select()
        .single()

      if (createError) throw createError
      event = newEvent

      await supabase.from("usage_logs").insert({
        user_id: user.id,
        event_id: event.id,
        session_start: new Date().toISOString(),
      })
    } else {
      await supabase.from("events").update({ session_active: true }).eq("id", event.id)
    }

    return Response.json({
      success: true,
      eventId: event.id,
      apiKey: process.env.OPENAI_API_KEY,
    })
  } catch (error) {
    console.error("[v0] Error starting transcription session:", error)
    return Response.json({ error: "Failed to start session" }, { status: 500 })
  }
}
