"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { countWords } from "@/lib/utils/word-count"

/**
 * Updates the total_transcriptions and total_words counts for a given session.
 * This should be called whenever transcriptions are added, updated, or deleted
 * to ensure the session statistics remain accurate.
 *
 * Note: This operation can be expensive for sessions with many transcriptions
 * as it fetches all transcription text to calculate word counts.
 */
export async function updateSessionStats(sessionId: string) {
  const supabase = await createServerClient()

  // Verify the user has access to update this session
  // Fetch the session first to check ownership via RLS or logic
  const { data: session, error: sessionError } = await supabase
    .from("event_sessions")
    .select("event_id, events(user_id)")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    throw new Error("Session not found or access denied")
  }

  // Note: RLS policies on 'transcriptions' allow public read, but
  // 'event_sessions' update requires ownership. The query above verifies existence.
  // The update below will fail if RLS is not satisfied, but we do a preliminary check.

  // Fetch all final transcriptions for this session
  const { data: transcriptions, error: fetchError } = await supabase
    .from("transcriptions")
    .select("text")
    .eq("session_id", sessionId)
    .eq("is_final", true)

  if (fetchError) {
    throw new Error(`Failed to fetch transcriptions: ${fetchError.message}`)
  }

  const totalTranscriptions = transcriptions.length
  const totalWords = transcriptions.reduce((sum, t) => {
    return sum + countWords(t.text)
  }, 0)

  // Update the session record
  const { error: updateError } = await supabase
    .from("event_sessions")
    .update({
      total_transcriptions: totalTranscriptions,
      total_words: totalWords,
    })
    .eq("id", sessionId)

  if (updateError) {
    throw new Error(`Failed to update session stats: ${updateError.message}`)
  }

  // Revalidate the session page to show updated stats
  // We need the slug, but we only have ID here.
  // We could fetch the slug, or just rely on the caller to handle revalidation if needed.
  // However, since this is a Server Action likely called from a UI that knows the slug,
  // or a background process, revalidation is tricky without the path.
  // For now, we'll assume the caller handles revalidation or the page is dynamic.

  return {
    success: true,
    totalTranscriptions,
    totalWords
  }
}
