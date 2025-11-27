"use server"

import { generateText } from "ai"

interface ValidationContext {
  currentTranscript: string
  recentTranscripts: { text: string; timestamp: Date }[]
  eventName: string
  eventDescription?: string | null
  sessionName?: string | null
  sessionDescription?: string | null
}

export async function validateTranscription(context: ValidationContext): Promise<string> {
  const { currentTranscript, recentTranscripts, eventName, eventDescription, sessionName, sessionDescription } = context

  // Build context from recent transcripts (past minute)
  const recentContext = recentTranscripts.map((t) => t.text).join(" ")

  let eventContext = `Event: ${eventName}`
  if (eventDescription) eventContext += `\nEvent Description: ${eventDescription}`
  if (sessionName) eventContext += `\nSession: ${sessionName}`
  if (sessionDescription) eventContext += `\nSession Description: ${sessionDescription}`

  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      prompt: `You are a transcription validation agent. Your job is to verify and correct live English transcriptions.

Context:
${eventContext}

Recent transcript context (past minute):
${recentContext || "[No recent transcripts]"}

Current transcript to validate:
"${currentTranscript}"

Rules:
1. Check if the transcript is in English - if not, return "[non-English speech]"
2. Fix obvious transcription errors (misheard words, incorrect punctuation)
3. Use the event context and recent transcript context to correct domain-specific terms, names, or technical vocabulary
4. Preserve the original meaning and speaker's intent
5. Do NOT add words that weren't said
6. Do NOT remove words unless they are clear hallucinations
7. Keep the same casual/formal tone as the original
8. Return ONLY the corrected transcript text, no explanations

Output the corrected transcript:`,
      temperature: 0.3, // Lower temperature for more consistent corrections
      maxTokens: 400,
    })

    return text.trim()
  } catch (error) {
    console.error("[v0] Transcription validation error:", error)
    // If validation fails, return original transcript
    return currentTranscript
  }
}
