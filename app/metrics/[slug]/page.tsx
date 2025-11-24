import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AppNav } from "@/components/app-nav"
import { Button } from "@/components/ui/button"
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
  const { data: usageLogs } = await supabase
    .from("usage_logs")
    .select("*")
    .eq("event_id", event.id)
    .order("session_start", { ascending: false })

  const totalBroadcastMinutes = usageLogs?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0
  const broadcastSessions = usageLogs?.length || 0

  // Calculate engagement rate (unique viewers / total sessions)
  const engagementRate = totalSessions > 0 ? Math.round((uniqueViewers / totalSessions) * 100) : 0

  // Calculate transcription rate (transcriptions per minute)
  const transcriptionRate =
    totalBroadcastMinutes > 0 ? (totalTranscriptions / totalBroadcastMinutes).toFixed(2) : "0.00"

  // Event timeline
  const firstTranscription = transcriptions?.[0]?.created_at
  const lastTranscription = transcriptions?.[transcriptions.length - 1]?.created_at

  return (
    <div className="min-h-screen bg-black">
      <AppNav />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
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
              <p className="text-slate-400">Event Analytics & Metrics</p>
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

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  Unique Viewers
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
                  Broadcast Time
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

          {/* Viewer Engagement Metrics */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-cyan-400" />
                Viewer Engagement Analytics
              </CardTitle>
              <CardDescription>Detailed viewer interaction patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MousePointer className="h-4 w-4 text-cyan-400" />
                    <span>Average Scroll Activity</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{averageScrollEvents}</div>
                  <p className="text-xs text-muted-foreground">scroll events per viewer</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span>Active View Time</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{averageActiveTimeMinutes} min</div>
                  <p className="text-xs text-muted-foreground">{viewerRetentionRate}% attention rate</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span>Content Consumed</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{averageTranscriptionsViewed}</div>
                  <p className="text-xs text-muted-foreground">transcriptions per viewer</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Viewer Statistics */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-400" />
                  Viewer Statistics
                </CardTitle>
                <CardDescription>Audience engagement metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Unique Viewers</span>
                  <span className="text-lg font-semibold text-foreground">{uniqueViewers}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Sessions</span>
                  <span className="text-lg font-semibold text-foreground">{totalSessions}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Avg. Session Duration</span>
                  <span className="text-lg font-semibold text-foreground">{averageViewerDuration} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Engagement Rate</span>
                  <span className="text-lg font-semibold text-foreground">{engagementRate}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Content Statistics */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-400" />
                  Content Statistics
                </CardTitle>
                <CardDescription>Transcription and content metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Transcriptions</span>
                  <span className="text-lg font-semibold text-foreground">{totalTranscriptions}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Words</span>
                  <span className="text-lg font-semibold text-foreground">{totalWords.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Avg. Words/Transcription</span>
                  <span className="text-lg font-semibold text-foreground">{averageWordsPerTranscription}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Transcriptions/Minute</span>
                  <span className="text-lg font-semibold text-foreground">{transcriptionRate}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Broadcast Sessions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-400" />
                Broadcast Sessions
              </CardTitle>
              <CardDescription>History of your streaming sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {usageLogs && usageLogs.length > 0 ? (
                <div className="space-y-3">
                  {usageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 bg-background border border-border rounded-md"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">
                          {new Date(log.session_start).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.session_start).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {log.session_end &&
                            ` - ${new Date(log.session_end).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-foreground">{log.duration_minutes || 0} min</div>
                        <div className="text-xs text-muted-foreground">
                          {log.session_end ? "Completed" : "In Progress"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No broadcast sessions yet</p>
              )}
            </CardContent>
          </Card>

          {/* Event Timeline */}
          {firstTranscription && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>Key event milestones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-background border border-border rounded-md">
                  <span className="text-sm text-muted-foreground">Event Created</span>
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
                  <span className="text-sm text-muted-foreground">First Transcription</span>
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
                    <span className="text-sm text-muted-foreground">Latest Transcription</span>
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
    </div>
  )
}
