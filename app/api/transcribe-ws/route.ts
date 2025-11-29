import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createServerClient()

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error("OPENAI_API_KEY is not configured")
    return Response.json({ error: "Server misconfiguration" }, { status: 500 })
  }

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
    } else {
      await supabase.from("events").update({ session_active: true }).eq("id", event.id)
    }

    const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify({
        model: "gpt-realtime-mini",
      }),
    })

    if (!realtimeResponse.ok) {
      const detail = await realtimeResponse.text()
      console.error("Failed to create OpenAI realtime session", detail)
      return Response.json({ error: "Failed to start realtime session" }, { status: 500 })
    }

    const sessionPayload = await realtimeResponse.json()
    const clientSecret = sessionPayload?.client_secret?.value

    if (!clientSecret) {
      console.error("OpenAI realtime session response missing client_secret", sessionPayload)
      return Response.json({ error: "Invalid realtime session response" }, { status: 500 })
    }

    return Response.json({
      success: true,
      eventId: event.id,
      clientSecret,
    })
  } catch (error) {
    console.error("Error starting transcription session:", error)
    return Response.json({ error: "Failed to start session" }, { status: 500 })
  }
}
