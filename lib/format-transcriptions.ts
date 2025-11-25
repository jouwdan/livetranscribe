export interface Transcription {
  id: string
  text: string
  created_at: string
  sequence_number: number
  session_id?: string
}

export interface Session {
  id: string
  name: string
  session_number: number
}

export function formatAsText(transcriptions: Transcription[], sessions?: Session[]): string {
  let output = ""
  let currentSessionId: string | null = null

  transcriptions.forEach((t) => {
    if (sessions && t.session_id !== currentSessionId) {
      const session = sessions.find((s) => s.id === t.session_id)
      if (session) {
        output += `\n[Session ${session.session_number}: ${session.name}]\n\n`
      }
      currentSessionId = t.session_id || null
    }
    output += `${t.text}\n`
  })

  return output
}

export function formatAsJSON(transcriptions: Transcription[], sessions?: Session[]): string {
  return JSON.stringify(
    {
      transcriptions: transcriptions.map((t) => ({
        id: t.id,
        text: t.text,
        timestamp: t.created_at,
        sequence: t.sequence_number,
        session_id: t.session_id,
      })),
      sessions: sessions || [],
      exported_at: new Date().toISOString(),
    },
    null,
    2,
  )
}
