import { createBrowserClient } from "@/lib/supabase/client"

export interface ViewerSessionMetrics {
  eventId: string
  sessionId: string
  scrollEvents: number
  visibilityChanges: number
  totalActiveTimeSeconds: number
  transcriptionsViewed: number
  lastActivityAt: Date
}

export class ViewerMetricsTracker {
  private sessionId: string
  private eventId: string
  private scrollEvents = 0
  private visibilityChanges = 0
  private totalActiveTimeSeconds = 0
  private transcriptionsViewed = 0
  private lastActivityAt: Date = new Date()
  private isVisible = true
  private activeTimeInterval: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null

  constructor(eventId: string) {
    this.eventId = eventId
    this.sessionId = `viewer-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  async initialize() {
    const supabase = createBrowserClient()

    // Create initial viewer session record
    const { error } = await supabase.from("viewer_sessions").insert({
      event_id: this.eventId,
      session_id: this.sessionId,
      joined_at: new Date().toISOString(),
      last_ping: new Date().toISOString(),
      scroll_events: 0,
      visibility_changes: 0,
      total_active_time_seconds: 0,
      transcriptions_viewed: 0,
    })

    if (error) {
      console.error("Failed to initialize viewer session:", error)
      return
    }

    // Track active time every second when visible
    this.activeTimeInterval = setInterval(() => {
      if (this.isVisible) {
        this.totalActiveTimeSeconds++
      }
    }, 1000)

    // Ping server every 15 seconds with updated metrics
    this.pingInterval = setInterval(() => {
      this.updateMetrics()
    }, 15000)

    // Track scroll events
    window.addEventListener("scroll", this.handleScroll)

    // Track visibility changes
    document.addEventListener("visibilitychange", this.handleVisibilityChange)
  }

  private handleScroll = () => {
    this.scrollEvents++
    this.lastActivityAt = new Date()
  }

  private handleVisibilityChange = () => {
    const wasVisible = this.isVisible
    this.isVisible = !document.hidden

    if (wasVisible !== this.isVisible) {
      this.visibilityChanges++
      this.lastActivityAt = new Date()
    }
  }

  incrementTranscriptionsViewed() {
    this.transcriptionsViewed++
    this.lastActivityAt = new Date()
  }

  private async updateMetrics() {
    const supabase = createBrowserClient()

    await supabase
      .from("viewer_sessions")
      .update({
        last_ping: new Date().toISOString(),
        last_activity_at: this.lastActivityAt.toISOString(),
        scroll_events: this.scrollEvents,
        visibility_changes: this.visibilityChanges,
        total_active_time_seconds: this.totalActiveTimeSeconds,
        transcriptions_viewed: this.transcriptionsViewed,
      })
      .eq("event_id", this.eventId)
      .eq("session_id", this.sessionId)
  }

  async cleanup() {
    // Final metrics update and mark session as ended
    const supabase = createBrowserClient()

    await supabase
      .from("viewer_sessions")
      .update({
        left_at: new Date().toISOString(),
        last_activity_at: this.lastActivityAt.toISOString(),
        scroll_events: this.scrollEvents,
        visibility_changes: this.visibilityChanges,
        total_active_time_seconds: this.totalActiveTimeSeconds,
        transcriptions_viewed: this.transcriptionsViewed,
      })
      .eq("event_id", this.eventId)
      .eq("session_id", this.sessionId)

    // Clean up event listeners and intervals
    if (this.activeTimeInterval) {
      clearInterval(this.activeTimeInterval)
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    window.removeEventListener("scroll", this.handleScroll)
    document.removeEventListener("visibilitychange", this.handleVisibilityChange)
  }
}

export interface BroadcastSessionMetrics {
  eventId: string
  sessionId: string
  startTime: Date
  totalTranscriptions: number
  totalWords: number
}

export class BroadcastMetricsTracker {
  private eventId: string
  private sessionId: string
  private startTime: Date
  private totalTranscriptions = 0
  private totalWords = 0

  constructor(eventId: string, sessionId: string) {
    this.eventId = eventId
    this.sessionId = sessionId
    this.startTime = new Date()
  }

  async markSessionStart() {
    const supabase = createBrowserClient()

    await supabase
      .from("event_sessions")
      .update({
        started_at: this.startTime.toISOString(),
      })
      .eq("id", this.sessionId)
  }

  addTranscription(text: string) {
    this.totalTranscriptions++
    this.totalWords += text.split(" ").length
  }

  async endSession() {
    const supabase = createBrowserClient()
    const endTime = new Date()
    const durationMinutes = Math.max(1, Math.ceil((endTime.getTime() - this.startTime.getTime()) / 60000))

    await supabase
      .from("event_sessions")
      .update({
        ended_at: endTime.toISOString(),
        duration_minutes: durationMinutes,
        total_transcriptions: this.totalTranscriptions,
        total_words: this.totalWords,
      })
      .eq("id", this.sessionId)

    return durationMinutes
  }
}
