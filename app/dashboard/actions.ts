"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function archiveEvent(formData: FormData) {
  const eventId = formData.get("eventId") as string

  if (!eventId) {
    return { error: "Event ID is required" }
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // Update the event to archived
  const { error } = await supabase.from("events").update({ archived: true }).eq("id", eventId).eq("user_id", user.id)

  if (error) {
    console.error("[v0] Error archiving event:", error)
    return { error: "Failed to archive event" }
  }

  revalidatePath("/dashboard")
  return { success: true }
}

export async function unarchiveEvent(formData: FormData) {
  const eventId = formData.get("eventId") as string

  if (!eventId) {
    return { error: "Event ID is required" }
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // Update the event to unarchived
  const { error } = await supabase.from("events").update({ archived: false }).eq("id", eventId).eq("user_id", user.id)

  if (error) {
    console.error("[v0] Error unarchiving event:", error)
    return { error: "Failed to unarchive event" }
  }

  revalidatePath("/dashboard")
  return { success: true }
}

export async function deleteEvent(eventId: string) {
  if (!eventId) {
    return { error: "Event ID is required" }
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  // Verify the event is archived and belongs to the user
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("archived")
    .eq("id", eventId)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !event) {
    return { error: "Event not found" }
  }

  if (!event.archived) {
    return { error: "Only archived events can be deleted" }
  }

  // Delete transcriptions first (due to foreign key constraints)
  const { error: transcriptionsError } = await supabase.from("transcriptions").delete().eq("event_id", eventId)

  if (transcriptionsError) {
    console.error("[v0] Error deleting transcriptions:", transcriptionsError)
    return { error: "Failed to delete event transcriptions" }
  }

  // Delete viewer sessions
  const { error: viewersError } = await supabase.from("viewer_sessions").delete().eq("event_id", eventId)

  if (viewersError) {
    console.error("[v0] Error deleting viewer sessions:", viewersError)
    return { error: "Failed to delete viewer sessions" }
  }

  // Delete the event
  const { error: deleteError } = await supabase.from("events").delete().eq("id", eventId).eq("user_id", user.id)

  if (deleteError) {
    console.error("[v0] Error deleting event:", deleteError)
    return { error: "Failed to delete event" }
  }

  revalidatePath("/dashboard")
  return { success: true }
}
