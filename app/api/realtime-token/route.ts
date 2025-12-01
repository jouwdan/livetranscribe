import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 })
    }

    // Verify user owns this event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, user_id")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (event.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Generate ephemeral token from OpenAI
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("OPENAI_API_KEY not configured")
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "verse",
      }),
    })

    if (!response.ok) {
      console.error("Failed to create ephemeral token:", response.status)
      return NextResponse.json({ error: "Failed to create session token" }, { status: 500 })
    }

    const data = await response.json()

    return NextResponse.json({
      clientSecret: data.client_secret.value,
      expiresAt: data.expires_at,
    })
  } catch (error) {
    console.error("Error generating realtime token:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
