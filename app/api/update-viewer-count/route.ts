import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return Response.json({ error: "Event ID required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Count active viewers (pinged in the last 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()

    const { count: activeViewers } = await supabase
      .from("viewer_sessions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .gt("last_ping", thirtySecondsAgo)
      .is("left_at", null)

    // Get current event data
    const { data: event } = await supabase.from("events").select("peak_viewers").eq("id", eventId).single()

    // Update peak viewers if current count is higher
    const currentPeak = event?.peak_viewers || 0
    const newPeak = Math.max(currentPeak, activeViewers || 0)

    await supabase
      .from("events")
      .update({
        peak_viewers: newPeak,
      })
      .eq("id", eventId)

    return Response.json({
      success: true,
      activeViewers: activeViewers || 0,
      peakViewers: newPeak,
    })
  } catch (error) {
    console.error("[v0] Error updating viewer count:", error)
    return Response.json({ error: "Failed to update viewer count" }, { status: 500 })
  }
}
