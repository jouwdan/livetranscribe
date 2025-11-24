"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createSession(eventId: string, name: string, description: string) {
  const supabase = await createServerClient()

  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("session_number")
    .eq("event_id", eventId)
    .order("session_number", { ascending: false })
    .limit(1)

  const nextNumber = (sessions?.[0]?.session_number || 0) + 1

  const { error } = await supabase.from("event_sessions").insert({
    event_id: eventId,
    name,
    description: description || null,
    session_number: nextNumber,
  })

  if (error) {
    console.error("Failed to create session:", error)
    throw new Error("Failed to create session")
  }

  revalidatePath("/sessions/[slug]", "page")
}

export async function updateSession(sessionId: string, name: string, description: string) {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("event_sessions")
    .update({
      name,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)

  if (error) {
    console.error("Failed to update session:", error)
    throw new Error("Failed to update session")
  }

  revalidatePath("/sessions/[slug]", "page")
}

export async function deleteSession(sessionId: string) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("event_sessions").delete().eq("id", sessionId)

  if (error) {
    console.error("Failed to delete session:", error)
    throw new Error("Failed to delete session")
  }

  revalidatePath("/sessions/[slug]", "page")
}
