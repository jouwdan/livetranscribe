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

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.warn("[v0] Skipping empty transcription")
      return Response.json({ success: true, skipped: true, reason: "empty_text" })
    }

    if (!isFinal) {
      console.log("[v0] Skipping interim transcription save (not final)")
      return Response.json({ success: true, skipped: true, reason: "interim" })
    }

    if (!sessionId) {
      console.warn(
        "[v0] Warning: Transcription saved without session_id. This may make it harder to organize and export transcriptions by session.",
      )
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
        return Response.json({ error: "Failed to create event", details: createError.message }, { status: 500 })
      }

      event = newEvent
    }

    const { data: existingTranscription } = await supabase
      .from("transcriptions")
      .select("id")
      .eq("event_id", event.id)
      .eq("sequence_number", sequenceNumber)
      .maybeSingle()

    if (existingTranscription) {
      console.log(`[v0] Transcription with sequence ${sequenceNumber} already exists, skipping`)
      return Response.json({ success: true, skipped: true, reason: "duplicate_sequence" })
    }

    const { error: insertError, data: insertedTranscription } = await supabase
      .from("transcriptions")
      .insert({
        event_id: event.id,
        text: text.trim(),
        is_final: isFinal,
        sequence_number: sequenceNumber,
        session_id: sessionId || null, // Explicitly set null if no sessionId (instead of undefined)
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Error inserting transcription:", insertError)
      return Response.json({ error: "Failed to save transcription", details: insertError.message }, { status: 500 })
    }

    const wordCount = text.trim().split(/\s+/).length
    await supabase
      .rpc("increment", {
        row_id: event.id,
        table_name: "events",
        column_name: "total_words",
        increment_by: wordCount,
      })
      .catch((err) => console.warn("[v0] Failed to update event word count:", err))

    await supabase
      .rpc("increment", {
        row_id: event.id,
        table_name: "events",
        column_name: "total_transcriptions",
        increment_by: 1,
      })
      .catch((err) => console.warn("[v0] Failed to update event transcription count:", err))

    // Update session metrics if session_id is provided
    if (sessionId) {
      await supabase
        .rpc("increment", {
          row_id: sessionId,
          table_name: "event_sessions",
          column_name: "total_words",
          increment_by: wordCount,
        })
        .catch((err) => console.warn("[v0] Failed to update session word count:", err))

      await supabase
        .rpc("increment", {
          row_id: sessionId,
          table_name: "event_sessions",
          column_name: "total_transcriptions",
          increment_by: 1,
        })
        .catch((err) => console.warn("[v0] Failed to update session transcription count:", err))
    }

    console.log("[v0] Final transcription saved successfully:", {
      id: insertedTranscription.id,
      slug,
      sequenceNumber,
      sessionId,
      wordCount,
    })

    return Response.json({
      success: true,
      transcriptionId: insertedTranscription.id,
      sequenceNumber,
      wordCount,
    })
  } catch (error) {
    console.error("[v0] Stream broadcast error:", error)
    return Response.json(
      {
        error: "Failed to broadcast",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
