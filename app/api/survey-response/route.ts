import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, eventId } = body

    console.log("[v0] API received:", { email, eventId, fullBody: body })

    if (!email || !eventId) {
      console.log("[v0] Validation failed - missing fields:", { hasEmail: !!email, hasEventId: !!eventId })
      return NextResponse.json({ error: "Email and eventId are required" }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify the event exists
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Insert the survey response
    const { data, error } = await supabase
      .from("survey_responses")
      .insert({
        event_id: eventId,
        email: email.toLowerCase().trim(),
      })
      .select()
      .single()

    if (error) {
      console.error("Error inserting survey response:", error)
      return NextResponse.json({ error: "Failed to save survey response" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Survey response error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
