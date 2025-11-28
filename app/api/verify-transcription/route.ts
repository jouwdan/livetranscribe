import type { NextRequest } from "next/server"
import OpenAI from "openai"

// Use OpenAI directly (not Vercel AI Gateway) as requested
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { text, eventContext, sessionContext, recentTranscriptions, sequence } = await request.json()

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return Response.json({ verified: true, correctedText: text, hadErrors: false })
    }

    // Build context for GPT-5-mini
    const contextPrompt = `You are a transcription quality verification assistant for live event captions.

Your task is to review a transcription segment and correct any obvious errors while preserving the exact spoken words and speaker intent.

**Event Context:**
- Event Name: ${eventContext.name || "Unknown Event"}
${eventContext.description ? `- Event Description: ${eventContext.description}` : ""}

**Session Context:**
${sessionContext.name ? `- Session Name: ${sessionContext.name}` : ""}
${sessionContext.description ? `- Session Description: ${sessionContext.description}` : ""}

**Recent Transcription History (last ~60 seconds):**
${recentTranscriptions && recentTranscriptions.length > 0 ? recentTranscriptions.map((t: any) => `"${t.text}"`).join("\n") : "No recent history available"}

**Current Transcription to Verify:**
"${text}"

**Instructions:**
1. Check for common transcription errors:
   - Misheard words that don't fit context
   - Incorrect homophones (their/there/they're, your/you're, etc.)
   - Missing or incorrect punctuation that changes meaning
   - Obvious word substitutions that don't make sense
   - Names or technical terms that should match the event/session context

2. DO NOT:
   - Add words that weren't spoken
   - Remove words that were spoken
   - Paraphrase or rewrite for style
   - Change the speaker's natural speech patterns
   - Make corrections if you're uncertain

3. Only make corrections if you're highly confident there's an error based on:
   - Context from event/session information
   - Recent transcription history
   - Basic grammar and common sense

4. Respond with JSON in this exact format:
{
  "correctedText": "the corrected transcription or original if no changes",
  "hadErrors": true/false,
  "corrections": ["description of any changes made"],
  "confidence": "high/medium/low"
}

If the transcription is accurate, return it unchanged with hadErrors: false.`

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: contextPrompt,
        },
        {
          role: "user",
          content: `Please verify this transcription: "${text}"`,
        },
      ],
      temperature: 0.1, // Low temperature for consistency
      response_format: { type: "json_object" },
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      console.warn("[v0] GPT-5-mini returned empty response, using original text")
      return Response.json({
        verified: true,
        correctedText: text,
        hadErrors: false,
        fallback: true,
      })
    }

    const result = JSON.parse(responseText)

    console.log(`[v0] Verification result (seq: ${sequence}):`, {
      hadErrors: result.hadErrors,
      corrections: result.corrections,
      confidence: result.confidence,
    })

    return Response.json({
      verified: true,
      correctedText: result.correctedText || text,
      hadErrors: result.hadErrors || false,
      corrections: result.corrections || [],
      confidence: result.confidence || "unknown",
    })
  } catch (error) {
    console.error("[v0] Verification error:", error)
    // Fallback to original text if verification fails
    const { text } = await request.json()
    return Response.json({
      verified: false,
      correctedText: text,
      hadErrors: false,
      error: error instanceof Error ? error.message : "Verification failed",
    })
  }
}
