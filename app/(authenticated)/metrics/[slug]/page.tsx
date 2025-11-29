import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  ArrowLeft,
  Users,
  Clock,
  MessageSquare,
  FileText,
  Activity,
  TrendingUp,
  Eye,
  MousePointer,
  Zap,
} from "lucide-react"

export const dynamic = "force-dynamic"

interface MetricsPageProps {
  params: Promise<{ slug: string }>
}

type TrendType = "spike" | "drop"

type TrendInsight = {
  type: TrendType
  changePercent: number
  latest: number
  baseline: number
}

type EventSessionRecord = {
  id: string | null
  name: string | null
  duration_minutes: number | null
  started_at: string | null
  ended_at: string | null
  total_transcriptions: number | null
  total_words: number | null
  session_number: number | null
}

type ViewerSessionRecord = {
  session_id: string | null
  joined_at: string
  left_at: string | null
  last_ping: string | null
  scroll_events: number | null
  visibility_changes: number | null
  total_active_time_seconds: number | null
  transcriptions_viewed: number | null
}

type SessionAnnotation = {
  label: string
  tone: "warning" | "info" | "success"
}

const SPIKE_THRESHOLD = 1.35
const DROP_THRESHOLD = 0.65

const anomalyBadgeVariants: Record<"Spike" | "Drop" | "Stable", string> = {
  Spike: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Drop: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Stable: "bg-slate-500/15 text-slate-200 border-slate-500/30",
}

const annotationToneClasses: Record<SessionAnnotation["tone"], string> = {
  warning: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  info: "bg-blue-500/20 text-blue-200 border-blue-500/40",
  success: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
}

const detectTrend = (series: number[]): TrendInsight | null => {
  if (!series || series.length < 3) return null
  const latest = series[series.length - 1]
  const baselineSeries = series.slice(0, -1)
  const baselineAvg = baselineSeries.reduce((sum, value) => sum + value, 0) / baselineSeries.length || 0
  if (baselineAvg === 0) return null

  const ratio = latest / baselineAvg
  if (ratio >= SPIKE_THRESHOLD) {
    return {
      type: "spike",
      changePercent: Math.round((ratio - 1) * 100),
      latest,
      baseline: baselineAvg,
    }
  }

  if (ratio <= DROP_THRESHOLD) {
    return {
      type: "drop",
      changePercent: Math.round((1 - ratio) * 100),
      latest,
      baseline: baselineAvg,
    }
  }

  return null
}

const median = (values: number[]): number | null => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const minutesBetween = (later: string | null, earlier: string | null): number | null => {
  if (!later || !earlier) return null
  const laterMs = new Date(later).getTime()
  const earlierMs = new Date(earlier).getTime()
  if (Number.isNaN(laterMs) || Number.isNaN(earlierMs)) return null
  return Math.max(0, Math.round((laterMs - earlierMs) / 60000))
}

const toWordsCount = (text?: string | null) => {
  if (!text) return 0
  const cleaned = text.trim()
  if (!cleaned) return 0
  return cleaned.split(/\s+/).length
}

const toMinutes = (seconds?: number | null) => Math.round(((seconds ?? 0) / 60) * 10) / 10

const buildSessionAnnotations = (
  session: EventSessionRecord,
  context: { medianDuration: number | null; gapAfterMinutes?: number | null },
): SessionAnnotation[] => {
  const annotations: SessionAnnotation[] = []
  const duration = session.duration_minutes || 0

  if (!session.ended_at) {
    annotations.push({ label: "Live now", tone: "info" })
  } else if (context.medianDuration && duration > 0 && duration <= Math.max(5, context.medianDuration * 0.6)) {
    annotations.push({ label: "Credits paused here", tone: "warning" })
  }

  if (context.medianDuration && duration >= context.medianDuration * 1.4) {
    annotations.push({ label: "Extended broadcast", tone: "success" })
  }

  if (context.gapAfterMinutes && context.gapAfterMinutes >= 90) {
    annotations.push({ label: "Long break after", tone: "info" })
  }

  return annotations
}

export default async function MetricsPage({ params }: MetricsPageProps) {
  const { slug } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch event details
  const { data: event } = await supabase.from("events").select("*").eq("slug", slug).eq("user_id", user.id).single()

  if (!event) {
    redirect("/dashboard")
  }

  // Fetch transcription metrics
  const { data: transcriptions } = await supabase
    .from("transcriptions")
    .select("text, created_at, is_final")
    .eq("event_id", event.id)
    .eq("is_final", true)
    .order("created_at", { ascending: true })

  const totalTranscriptions = transcriptions?.length || 0
  const totalWords = transcriptions?.reduce((sum, t) => sum + (t.text?.split(" ").length || 0), 0) || 0
  const averageWordsPerTranscription = totalTranscriptions > 0 ? Math.round(totalWords / totalTranscriptions) : 0

  // Fetch viewer metrics with engagement data
  const { data: viewerSessions } = await supabase
    .from("viewer_sessions")
    .select(
      "session_id, joined_at, left_at, last_ping, scroll_events, visibility_changes, total_active_time_seconds, transcriptions_viewed",
    )
    .eq("event_id", event.id)

  const uniqueViewers = new Set(viewerSessions?.map((s) => s.session_id) || []).size
  const totalSessions = viewerSessions?.length || 0

  // Calculate average session duration for viewers
  const viewerDurations =
    viewerSessions
      ?.filter((s) => s.left_at)
      .map((s) => {
        const joined = new Date(s.joined_at).getTime()
        const left = new Date(s.left_at!).getTime()
        return (left - joined) / 60000 // minutes
      }) || []

  const averageViewerDuration =
    viewerDurations.length > 0 ? Math.round(viewerDurations.reduce((a, b) => a + b, 0) / viewerDurations.length) : 0

  const totalScrollEvents = viewerSessions?.reduce((sum, s) => sum + (s.scroll_events || 0), 0) || 0
  const averageScrollEvents = totalSessions > 0 ? Math.round(totalScrollEvents / totalSessions) : 0

  const totalActiveTime = viewerSessions?.reduce((sum, s) => sum + (s.total_active_time_seconds || 0), 0) || 0
  const averageActiveTimeMinutes = totalSessions > 0 ? Math.round(totalActiveTime / totalSessions / 60) : 0

  const totalTranscriptionsViewed = viewerSessions?.reduce((sum, s) => sum + (s.transcriptions_viewed || 0), 0) || 0
  const averageTranscriptionsViewed = totalSessions > 0 ? Math.round(totalTranscriptionsViewed / totalSessions) : 0

  const viewerRetentionRate =
    averageViewerDuration > 0 && averageActiveTimeMinutes > 0
      ? Math.round((averageActiveTimeMinutes / averageViewerDuration) * 100)
      : 0

  // Fetch usage logs (broadcaster sessions)
  const { data: eventSessions } = await supabase
    .from("event_sessions")
    .select("id, name, duration_minutes, started_at, ended_at, total_transcriptions, total_words, session_number")
    .eq("event_id", event.id)
    .order("started_at", { ascending: false })

  const totalBroadcastMinutes = eventSessions?.reduce((sum, session) => sum + (session.duration_minutes || 0), 0) || 0
  const broadcastSessions = eventSessions?.length || 0

  // Calculate engagement rate (unique viewers / total sessions)
  const engagementRate = totalSessions > 0 ? Math.round((uniqueViewers / totalSessions) * 100) : 0

  // Calculate transcription rate (transcriptions per minute)
  const transcriptionRate =
    totalBroadcastMinutes > 0 ? (totalTranscriptions / totalBroadcastMinutes).toFixed(2) : "0.00"

  // Event timeline
  const firstTranscription = transcriptions?.[0]?.created_at
  const lastTranscription = transcriptions?.[transcriptions.length - 1]?.created_at

  const viewerSessionsOrdered = (viewerSessions || []).sort(
    (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
  ) as ViewerSessionRecord[]

  const viewerAttentionSeries = viewerSessionsOrdered.map((session) => toMinutes(session.total_active_time_seconds))
  const scrollSeries = viewerSessionsOrdered.map((session) => session.scroll_events || 0)
  const wordsSeries = (transcriptions || []).map((t) => toWordsCount(t.text))
  const sessionDurationSeries = (eventSessions || []).map((s) => s.duration_minutes || 0).filter((value) => value > 0)
  const medianSessionDuration = median(sessionDurationSeries)

  const viewerTrend = detectTrend(viewerAttentionSeries)
  const scrollTrend = detectTrend(scrollSeries)
  const sessionTrend = detectTrend(sessionDurationSeries)
  const wordsTrend = detectTrend(wordsSeries)

  const anomalyCards = [
    viewerTrend && {
      id: "viewer-attention",
      title: viewerTrend.type === "spike" ? "Viewer attention spike" : "Viewer attention drop",
      mode: viewerTrend.type === "spike" ? "Spike" : "Drop",
      value: `${viewerTrend.type === "spike" ? "+" : "-"}${viewerTrend.changePercent}%`,
      description:
        viewerTrend.type === "spike"
          ? "Latest viewers stayed longer than your historical average."
          : "Viewers churned faster than normal. Share the replay while it's top-of-mind.",
      icon: Eye,
    },
    scrollTrend && {
      id: "scroll-activity",
      title: scrollTrend.type === "spike" ? "Interaction spike" : "Interaction drop",
      mode: scrollTrend.type === "spike" ? "Spike" : "Drop",
      value: `${scrollTrend.type === "spike" ? "+" : "-"}${scrollTrend.changePercent}%`,
      description:
        scrollTrend.type === "spike"
          ? "Viewers are exploring transcripts aggressively — highlight key chapters."
          : "Scrolling slowed down, so consider nudging attendees to re-engage.",
      icon: MousePointer,
    },
    (sessionTrend || wordsTrend) && {
      id: "session-pace",
      title:
        sessionTrend?.type === "drop"
          ? "Broadcasts ending early"
          : sessionTrend?.type === "spike"
            ? "Long-form sessions"
            : wordsTrend?.type === "spike"
              ? "Transcript density spike"
              : "Transcript density drop",
      mode:
        sessionTrend?.type === "drop"
          ? "Drop"
          : sessionTrend?.type === "spike"
            ? "Spike"
            : wordsTrend?.type === "spike"
              ? "Spike"
              : wordsTrend?.type === "drop"
                ? "Drop"
                : "Stable",
      value:
        sessionTrend
          ? `${sessionTrend.type === "spike" ? "+" : "-"}${sessionTrend.changePercent}%`
          : wordsTrend
            ? `${wordsTrend.type === "spike" ? "+" : "-"}${wordsTrend.changePercent}%`
            : "OK",
      description:
        sessionTrend?.type === "drop"
          ? "Sessions are shutting down earlier — double-check credit balances."
          : sessionTrend?.type === "spike"
            ? "Broadcasts are running longer — ensure presenters have breaks."
            : wordsTrend?.type === "spike"
              ? "Speech tempo jumped, so remind moderators to summarize key points."
              : wordsTrend?.type === "drop"
                ? "Speakers slowed down — lean into Q&A."
                : "Pacing is steady across sessions.",
      icon: Activity,
    },
  ].filter(Boolean) as Array<{
    id: string
    title: string
    mode: "Spike" | "Drop" | "Stable"
    value: string
    description: string
    icon: typeof Eye
  }>

  if (!anomalyCards.length) {
    anomalyCards.push({
      id: "steady",
      title: "No anomalies detected",
      mode: "Stable",
      value: "OK",
      description: "All monitored metrics match their trailing averages.",
      icon: TrendingUp,
    })
  }

  const chronologicalSessions = [...(eventSessions || [])]
    .filter((session) => session.started_at)
    .sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime()) as EventSessionRecord[]

  const sessionGapAfter: Record<string, number> = {}
  chronologicalSessions.forEach((session, index) => {
    const nextSession = chronologicalSessions[index + 1]
    if (!nextSession) return
    if (!session.ended_at || !nextSession.started_at) return
    const gapMinutes = minutesBetween(nextSession.started_at, session.ended_at)
    if (gapMinutes) {
      sessionGapAfter[session.id || `session-${index}`] = gapMinutes
    }
  })

  const sessionsWithAnnotations = (eventSessions || []).map((session) => ({
    session,
    annotations: buildSessionAnnotations(session, {
      medianDuration: medianSessionDuration,
      gapAfterMinutes: sessionGapAfter[session.id || ""] ?? null,
    }),
  }))

  const viewerStatCards = [
    {
      label: "Unique viewers",
      value: uniqueViewers,
      helper: `${totalSessions} sessions tracked`,
      icon: Users,
    },
    {
      label: "Avg. stay",
      value: `${averageViewerDuration} min`,
      helper: `${viewerRetentionRate}% attention rate`,
      icon: Clock,
    },
    {
      label: "Engagement",
      value: `${engagementRate}%`,
      helper: `${averageActiveTimeMinutes} active min`,
      icon: Eye,
    },
    {
      label: "Interactions",
      value: averageScrollEvents,
      helper: "scrolls per viewer",
      icon: MousePointer,
    },
  ]

  const contentStatCards = [
    {
      label: "Transcriptions",
      value: totalTranscriptions,
      helper: `${totalWords.toLocaleString()} words`,
      icon: MessageSquare,
    },
    {
      label: "Words per block",
      value: averageWordsPerTranscription,
      helper: "avg words each",
      icon: FileText,
    },
    {
      label: "Transcripts/min",
      value: transcriptionRate,
      helper: `${totalBroadcastMinutes} broadcast min`,
      icon: Activity,
    },
    {
      label: "View depth",
      value: averageTranscriptionsViewed,
      helper: "per viewer",
      icon: Zap,
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </Link>
              <h1 className="text-3xl font-bold text-white">{event.name}</h1>
            </div>
            <p className="text-slate-400">Event analytics & anomaly watch</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/broadcast/${slug}`}>
              <Button variant="outline">Broadcast</Button>
            </Link>
            <Link href={`/view/${slug}`}>
              <Button variant="outline">View</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {anomalyCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.id} className="bg-card/60 border-border/70">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-300" />
                      {card.title}
                    </CardTitle>
                    <Badge className={`${anomalyBadgeVariants[card.mode]} border`}>{card.mode}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-3xl font-bold text-white">{card.value}</div>
                  <p className="text-sm text-slate-400 leading-relaxed">{card.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Unique viewers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{uniqueViewers}</div>
              <p className="text-xs text-slate-400 mt-1">{totalSessions} total sessions</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-400" />
                Transcriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{totalTranscriptions}</div>
              <p className="text-xs text-slate-400 mt-1">{totalWords.toLocaleString()} total words</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                Broadcast time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{totalBroadcastMinutes}</div>
              <p className="text-xs text-slate-400 mt-1">minutes across {broadcastSessions} sessions</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{engagementRate}%</div>
              <p className="text-xs text-slate-400 mt-1">viewer retention rate</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-cyan-400" />
              Viewer engagement analytics
            </CardTitle>
            <CardDescription>Detailed interaction patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MousePointer className="h-4 w-4 text-cyan-400" />
                  <span>Average scroll activity</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{averageScrollEvents}</div>
                <p className="text-xs text-muted-foreground">scroll events per viewer</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span>Active view time</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{averageActiveTimeMinutes} min</div>
                <p className="text-xs text-muted-foreground">{viewerRetentionRate}% attention rate</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span>Content consumed</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{averageTranscriptionsViewed}</div>
                <p className="text-xs text-muted-foreground">transcriptions per viewer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                Audience snapshot
              </CardTitle>
              <CardDescription>Health of viewer cohorts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {viewerStatCards.map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div key={stat.label} className="p-4 rounded-xl border border-border/60 bg-black/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{stat.label}</span>
                        <Icon className="h-4 w-4 text-slate-400" />
                      </div>
                      <p className="text-2xl font-semibold text-white">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.helper}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-400" />
                Content snapshot
              </CardTitle>
              <CardDescription>Production velocity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contentStatCards.map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div key={stat.label} className="p-4 rounded-xl border border-border/60 bg-black/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{stat.label}</span>
                        <Icon className="h-4 w-4 text-slate-400" />
                      </div>
                      <p className="text-2xl font-semibold text-white">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.helper}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Broadcast sessions
            </CardTitle>
            <CardDescription>Annotated timeline of every run</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsWithAnnotations.filter(({ session }) => session.started_at).length > 0 ? (
              <div className="space-y-3">
                {sessionsWithAnnotations
                  .filter(({ session }) => session.started_at)
                  .map(({ session, annotations }, index) => (
                    <div
                      key={session.id || `session-${index}`}
                      className="p-4 bg-background border border-border rounded-lg space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {session.name || `Session ${session.session_number || index + 1}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.started_at!).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {" · "}
                            {new Date(session.started_at!).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {session.ended_at &&
                              ` → ${new Date(session.ended_at).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-white">{session.duration_minutes || 0} min</p>
                          <p className="text-xs text-muted-foreground">
                            {session.ended_at ? "Completed" : "In progress"}
                          </p>
                        </div>
                      </div>

                      {(session.total_transcriptions || session.total_words) && (
                        <p className="text-xs text-muted-foreground">
                          {session.total_transcriptions || 0} blocks · {session.total_words || 0} words
                        </p>
                      )}

                      {annotations.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {annotations.map((annotation) => (
                            <span
                              key={annotation.label}
                              className={`px-2 py-1 text-xs rounded-full border ${annotationToneClasses[annotation.tone]}`}
                            >
                              {annotation.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No broadcast sessions yet</p>
            )}
          </CardContent>
        </Card>

        {firstTranscription && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Event timeline</CardTitle>
              <CardDescription>Key milestones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-background border border-border rounded-md">
                <span className="text-sm text-muted-foreground">Event created</span>
                <span className="text-sm font-medium text-foreground">
                  {new Date(event.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background border border-border rounded-md">
                <span className="text-sm text-muted-foreground">First transcription</span>
                <span className="text-sm font-medium text-foreground">
                  {new Date(firstTranscription).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {lastTranscription && lastTranscription !== firstTranscription && (
                <div className="flex items-center justify-between p-3 bg-background border border-border rounded-md">
                  <span className="text-sm text-muted-foreground">Latest transcription</span>
                  <span className="text-sm font-medium text-foreground">
                    {new Date(lastTranscription).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
