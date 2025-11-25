import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const since = Number.parseInt(url.searchParams.get("since") || "0")

  const supabase = await createClient()

  // Get event details
  const { data: event } = await supabase.from("events").select("*").eq("slug", slug).single()

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 })
  }

  // Get new transcriptions since the last sequence number
  const { data: transcriptions, error } = await supabase
    .from("transcriptions")
    .select("*")
    .eq("event_id", event.id)
    .gt("sequence_number", since)
    .order("sequence_number", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching transcriptions:", error)
    return Response.json({ error: "Failed to fetch transcriptions" }, { status: 500 })
  }

  // Get latest sequence number
  const { data: latest } = await supabase
    .from("transcriptions")
    .select("sequence_number")
    .eq("event_id", event.id)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .single()

  return Response.json({
    transcriptions: transcriptions.map((t) => ({
      text: t.text,
      isFinal: t.is_final,
      sequenceNumber: t.sequence_number,
      timestamp: t.created_at,
      id: t.id,
      sessionId: t.session_id,
    })),
    metadata: {
      name: event.name,
      createdAt: event.created_at,
    },
    latestSequence: latest?.sequence_number || 0,
    eventId: event.id,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const data = await request.json()
    const { text, isFinal, sequenceNumber, sessionId } = data

    if (!isFinal) {
      return Response.json({ success: true, skipped: true })
    }

    const supabase = await createClient()

    const { data: events } = await supabase.from("events").select("*").eq("slug", slug)

    let event = events?.[0]

    if (!event) {
      const { data: newEvent, error: createError } = await supabase
        .from("events")
        .insert({
          slug,
          name: data.eventName || "Live Event",
          organizer_key: `auto-${slug}`,
          is_active: true,
        })
        .select()
        .single()

      if (createError) {
        console.error("[v0] Error creating event:", createError)
        return Response.json({ error: "Failed to create event" }, { status: 500 })
      }

      event = newEvent
    }

    const { error: insertError } = await supabase.from("transcriptions").insert({
      event_id: event.id,
      text,
      is_final: isFinal,
      sequence_number: sequenceNumber,
      session_id: sessionId || null,
    })

    if (insertError) {
      console.error("[v0] Error inserting transcription:", insertError)
      return Response.json({ error: "Failed to save transcription" }, { status: 500 })
    }

    const wordCount = text ? text.split(/\s+/).filter((w: string) => w.length > 0).length : 0

    await supabase
      .from("events")
      .update({
        total_words: (event.total_words || 0) + wordCount,
        total_transcriptions: (event.total_transcriptions || 0) + 1,
      })
      .eq("id", event.id)

    if (sessionId) {
      const { data: session } = await supabase
        .from("event_sessions")
        .select("total_words, total_transcriptions")
        .eq("id", sessionId)
        .single()

      if (session) {
        await supabase
          .from("event_sessions")
          .update({
            total_words: (session.total_words || 0) + wordCount,
            total_transcriptions: (session.total_transcriptions || 0) + 1,
          })
          .eq("id", sessionId)
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("[v0] Stream broadcast error:", error)
    return Response.json({ error: "Failed to broadcast" }, { status: 500 })
  }
}
