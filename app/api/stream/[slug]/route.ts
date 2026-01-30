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
    console.error("Error fetching transcriptions:", error)
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

    console.log(`[API] POST /api/stream/${slug} - seq: ${sequenceNumber}, isFinal: ${isFinal}, sessionId: ${sessionId}`)

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.warn("[API] Skipping empty transcription")
      return Response.json({ success: true, skipped: true, reason: "empty_text" })
    }

    if (!isFinal) {
      console.log("[API] Skipping interim transcription save (not final)")
      return Response.json({ success: true, skipped: true, reason: "interim" })
    }

    if (!sessionId) {
      console.warn(
        "[API] Warning: Transcription saved without session_id. This may make it harder to organize and export transcriptions by session.",
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

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
        console.error("Error creating event:", createError)
        return Response.json({ error: "Failed to create event", details: createError.message }, { status: 500 })
      }

      event = newEvent
    }

    const duplicateQuery = supabase
      .from("transcriptions")
      .select("id")
      .eq("event_id", event.id)
      .eq("sequence_number", sequenceNumber)

    // If there's a session ID, check within that session
    if (sessionId) {
      duplicateQuery.eq("session_id", sessionId)
    }

    const { data: existingTranscription } = await duplicateQuery.maybeSingle()

    if (existingTranscription) {
      console.log(`[API] Transcription with sequence ${sequenceNumber} already exists in session ${sessionId}, skipping`)
      return Response.json({ success: true, skipped: true, reason: "duplicate_sequence" })
    }
    
    console.log("[API] Inserting transcription:", {
      eventId: event.id,
      sessionId,
      sequenceNumber,
      textLength: text.trim().length,
    })

    const { error: insertError, data: insertedTranscription } = await supabase
      .from("transcriptions")
      .insert({
        event_id: event.id,
        text: text.trim(),
        is_final: isFinal,
        sequence_number: sequenceNumber,
        session_id: sessionId || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error inserting transcription:", insertError)
      return Response.json({ error: "Failed to save transcription", details: insertError.message }, { status: 500 })
    }

    const wordCount = text.trim().split(/\s+/).length

    const incrementResult1 = await supabase.rpc("increment", {
      row_id: event.id,
      table_name: "events",
      column_name: "total_words",
      increment_by: wordCount,
    })

    if (incrementResult1.error) {
      console.error("Failed to increment event word count:", incrementResult1.error)
    }

    const incrementResult2 = await supabase.rpc("increment", {
      row_id: event.id,
      table_name: "events",
      column_name: "total_transcriptions",
      increment_by: 1,
    })

    if (incrementResult2.error) {
      console.error("Failed to increment event transcription count:", incrementResult2.error)
    }

    // Update session metrics if session_id is provided
    if (sessionId) {
      const incrementResult3 = await supabase.rpc("increment", {
        row_id: sessionId,
        table_name: "event_sessions",
        column_name: "total_words",
        increment_by: wordCount,
      })

      if (incrementResult3.error) {
        console.error("Failed to increment session word count:", incrementResult3.error)
      }

      const incrementResult4 = await supabase.rpc("increment", {
        row_id: sessionId,
        table_name: "event_sessions",
        column_name: "total_transcriptions",
        increment_by: 1,
      })

      if (incrementResult4.error) {
        console.error("Failed to increment session transcription count:", incrementResult4.error)
      }
    }

    console.log("[API] Final transcription saved successfully:", {
      id: insertedTranscription.id,
      slug,
      sequenceNumber,
      sessionId,
      wordCount,
    })

    return Response.json({
      success: true,
      id: insertedTranscription.id,
      transcriptionId: insertedTranscription.id,
      sequenceNumber,
      wordCount,
    })
  } catch (error) {
    console.error("Stream broadcast error:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return Response.json(
      {
        error: "Failed to broadcast",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
