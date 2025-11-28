import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { PlusCircle, Clock, Archive, BarChart3, List, Users } from "lucide-react"
import { AppNav } from "@/components/app-nav"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArchiveEventButton, UnarchiveEventButton } from "@/components/archive-event-buttons"
import { DeleteEventDialog } from "@/components/delete-event-dialog"
import { DownloadTranscriptionsButton } from "@/components/download-transcriptions-button"
import { formatMinutesToHoursAndMinutes } from "@/lib/format-time"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: eventCredits } = await supabase
    .from("event_credits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const availableCredits = eventCredits?.filter((c) => !c.allocated_to_event_id) || []
  const allocatedCredits = eventCredits?.filter((c) => c.allocated_to_event_id) || []
  const canCreateEvent = availableCredits.length > 0

  const groupedCredits = availableCredits.reduce(
    (acc, credit) => {
      const key = `${credit.credits_minutes}-${credit.max_attendees}`
      if (!acc[key]) {
        acc[key] = {
          credits_minutes: credit.credits_minutes,
          max_attendees: credit.max_attendees,
          count: 0,
          notes: credit.notes,
        }
      }
      acc[key].count++
      return acc
    },
    {} as Record<string, { credits_minutes: number; max_attendees: number; count: number; notes: string | null }>,
  )

  const creditGroups = Object.values(groupedCredits)

  const { data: activeEvents } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })

  const { data: archivedEvents } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", true)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-black">
      <AppNav />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {creditGroups.length > 0 ? (
              creditGroups.map((group, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-full"
                >
                  <div className="h-6 w-6 rounded-full bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-purple-300">{group.count}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatMinutesToHoursAndMinutes(group.credits_minutes)}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {group.max_attendees}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-center text-red-400 text-sm">
                  No event credits available. Contact support to purchase credits.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Your Events</h2>
            {canCreateEvent ? (
              <Link href="/create">
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Create Event
                </Button>
              </Link>
            ) : (
              <Button className="gap-2" disabled title="You need event credits to create events">
                <PlusCircle className="h-4 w-4" />
                Create Event
              </Button>
            )}
          </div>

          {!canCreateEvent && (
            <Card className="bg-card/50 backdrop-blur-sm border-red-500/50">
              <CardContent className="pt-6">
                <p className="text-center text-red-400">
                  You need event credits to create events. Contact support to purchase credits.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {activeEvents && activeEvents.length > 0 ? (
              activeEvents.map((event) => (
                <Card key={event.id} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-foreground">{event.name}</CardTitle>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm text-muted-foreground">
                            Credits:{" "}
                            <span className="text-purple-400 font-semibold">
                              {formatMinutesToHoursAndMinutes(event.credits_minutes || 0)}
                            </span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Max attendees:{" "}
                            <span className="text-blue-400 font-semibold">{event.max_attendees || 0}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {event.session_active && (
                          <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">
                            Active
                          </span>
                        )}
                        {event.is_active && (
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20">
                            Live
                          </span>
                        )}
                      </div>
                    </div>
                    <CardDescription>{event.slug}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      <Link href={`/sessions/${event.slug}`}>
                        <Button variant="outline" className="gap-2 bg-transparent">
                          <List className="h-4 w-4" />
                          Sessions
                        </Button>
                      </Link>
                      <Link href={`/broadcast/${event.slug}`}>
                        <Button variant="outline">Broadcast</Button>
                      </Link>
                      <Link href={`/view/${event.slug}`}>
                        <Button variant="outline">View</Button>
                      </Link>
                      <Link href={`/metrics/${event.slug}`}>
                        <Button variant="outline" className="gap-2 bg-transparent">
                          <BarChart3 className="h-4 w-4" />
                          Metrics
                        </Button>
                      </Link>
                      <DownloadTranscriptionsButton eventId={event.id} variant="outline" />
                      <Link href={`/edit/${event.slug}`}>
                        <Button variant="outline">Edit</Button>
                      </Link>
                      <ArchiveEventButton eventId={event.id} />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No events yet. Create your first event to get started!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {archivedEvents && archivedEvents.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="archived" className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Archived Events ({archivedEvents.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 pt-4">
                    {archivedEvents.map((event) => (
                      <Card key={event.id} className="bg-card/50 border-border/50">
                        <CardHeader>
                          <CardTitle className="text-foreground text-base">{event.name}</CardTitle>
                          <CardDescription className="text-sm">{event.slug}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Link href={`/view/${event.slug}`}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            <UnarchiveEventButton eventId={event.id} />
                            <DeleteEventDialog eventId={event.id} eventSlug={event.slug} eventName={event.name} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </div>
    </div>
  )
}
