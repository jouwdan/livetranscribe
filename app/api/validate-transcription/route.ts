import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import OpenAI from "openai"

export async function POST(request: NextRequest) {
  try {
    const {
      miniTranscription,
      standardTranscription,
      eventId,
      eventName,
      eventDescription,
      sessionName,
      sessionDescription,
      sequence,
    } = await request.json()

    console.log(`Validating transcription for sequence ${sequence}`)

    const supabase = await createServerClient()
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()

    const { data: recentTranscriptions } = await supabase
      .from("transcriptions")
      .select("text, created_at")
      .eq("event_id", eventId)
      .gte("created_at", oneMinuteAgo)
      .order("created_at", { ascending: true })
      .limit(50)

    const recentContext =
      recentTranscriptions
        ?.map((t) => t.text)
        .join(" ")
        .substring(0, 2000) || ""

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    let contextInfo = `Event: ${eventName}`
    if (eventDescription) {
      contextInfo += `\nEvent Description: ${eventDescription}`
    }
    if (sessionName) {
      contextInfo += `\nSession: ${sessionName}`
    }
    if (sessionDescription) {
      contextInfo += `\nSession Description: ${sessionDescription}`
    }

    const prompt = `You are a transcription quality assurance AI. Your task is to cross-check two transcriptions of the same audio and determine which is more accurate, or combine them if needed.

Context:
${contextInfo}

Recent transcript (last 1 minute):
${recentContext}

Two AI models transcribed the same audio:

Model A (gpt-4o-mini-transcribe):
"${miniTranscription}"

Model B (gpt-4o-transcribe):
"${standardTranscription}"

Your task:
1. Compare both transcriptions considering:
   - Spelling accuracy (especially for names, technical terms from context)
   - Grammar and punctuation
   - Natural sentence flow
   - Consistency with recent transcript context
   - Overall coherence

2. Return the BEST transcription. You may:
   - Choose Model A if it's clearly better
   - Choose Model B if it's clearly better
   - Combine elements from both if one has better parts
   - Make minor corrections for spelling/punctuation if needed

Return ONLY the final, corrected transcription text with no explanation or preamble.`

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You are a transcription quality assurance expert. Return only the corrected transcription text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const validatedText = completion.choices[0]?.message?.content?.trim() || standardTranscription

    console.log(`Validation complete for sequence ${sequence}`)

    return NextResponse.json({
      validatedText,
      miniTranscription,
      standardTranscription,
      usedModel:
        validatedText === miniTranscription
          ? "mini"
          : validatedText === standardTranscription
            ? "standard"
            : "combined",
    })
  } catch (error) {
    console.error("Validation error:", error)
    return NextResponse.json({ error: "Validation failed", validatedText: null }, { status: 500 })
  }
}
