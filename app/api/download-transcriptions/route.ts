import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { formatAsText, formatAsJSON } from "@/lib/format-transcriptions"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const eventId = searchParams.get("eventId")
  const sessionId = searchParams.get("sessionId")
  const format = searchParams.get("format") || "txt"

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Verify event ownership
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).eq("user_id", user.id).single()

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // Build query
  let query = supabase
    .from("transcriptions")
    .select("id, text, created_at, sequence_number, session_id, is_final")
    .eq("event_id", eventId)
    .eq("is_final", true)
    .order("sequence_number", { ascending: true })

  if (sessionId) {
    query = query.eq("session_id", sessionId)
  }

  const { data: transcriptions, error } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to fetch transcriptions" }, { status: 500 })
  }

  if (!transcriptions || transcriptions.length === 0) {
    return NextResponse.json({ error: "No transcriptions found" }, { status: 404 })
  }

  // Fetch sessions if needed
  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("id, name, session_number")
    .eq("event_id", eventId)
    .order("session_number", { ascending: true })

  // Format based on requested format
  let content: string
  let contentType: string
  let filename: string

  const baseFilename = sessionId ? `${event.slug}-session-${sessionId}` : `${event.slug}-all-transcriptions`

  switch (format) {
    case "json":
      content = formatAsJSON(transcriptions, sessions || [])
      contentType = "application/json"
      filename = `${baseFilename}.json`
      break
    default:
      content = formatAsText(transcriptions, sessions || [])
      contentType = "text/plain"
      filename = `${baseFilename}.txt`
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
