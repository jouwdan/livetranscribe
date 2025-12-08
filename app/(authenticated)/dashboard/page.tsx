import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { PlusCircle, Archive, List } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArchiveEventButton, UnarchiveEventButton } from "@/components/archive-event-buttons"
import { DeleteEventDialog } from "@/components/delete-event-dialog"
import { DownloadTranscriptionsButton } from "@/components/download-transcriptions-button"

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

  const [activeEventsResponse, archivedEventsResponse] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", true)
      .order("created_at", { ascending: false }),
  ])

  const activeEvents = activeEventsResponse.data ?? []
  const archivedEvents = archivedEventsResponse.data ?? []

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Your Events</h2>
          <Link href="/create">
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

        <div className="grid gap-4">
          {activeEvents && activeEvents.length > 0 ? (
            activeEvents.map((event) => (
              <Card key={event.id} className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">{event.name}</CardTitle>
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
  )
}
