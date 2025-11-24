import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { PlusCircle, Clock } from "lucide-react"
import { AppNav } from "@/components/app-nav"

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("credits_minutes, max_attendees")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    await supabase.from("user_profiles").insert({
      id: user.id,
      email: user.email,
      credits_minutes: 15,
      max_attendees: 25,
    })
  }

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: usage } = await supabase
    .from("usage_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const totalMinutes = usage?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0
  const totalSessions = usage?.length || 0
  const creditsMinutes = profile?.credits_minutes || 15
  const maxAttendees = profile?.max_attendees || 25

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

          <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-400" />
                Available Credits
              </CardTitle>
              <CardDescription>Your remaining transcription time and capacity</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-purple-400">{creditsMinutes} min</div>
                <p className="text-sm text-muted-foreground mt-1">Minutes remaining</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-400">{maxAttendees}</div>
                <p className="text-sm text-muted-foreground mt-1">Max attendees</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Usage Summary</CardTitle>
              <CardDescription>Your transcription usage statistics</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-foreground">{totalMinutes}</div>
                <p className="text-sm text-muted-foreground mt-1">Total minutes used</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">{totalSessions}</div>
                <p className="text-sm text-muted-foreground mt-1">Sessions</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Your Events</h2>
            <Link href="/create">
              <Button className="gap-2" disabled={creditsMinutes <= 0}>
                <PlusCircle className="h-4 w-4" />
                Create Event
              </Button>
            </Link>
          </div>

          {creditsMinutes <= 0 && (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="pt-6">
                <p className="text-red-400 text-sm">
                  You've used all your available credits. Contact us to add more minutes to your account.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {events && events.length > 0 ? (
              events.map((event) => (
                <Card key={event.id} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground">{event.name}</CardTitle>
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
                    <div className="flex gap-2">
                      <Link href={`/broadcast/${event.slug}`}>
                        <Button variant="outline">Broadcast</Button>
                      </Link>
                      <Link href={`/view/${event.slug}`}>
                        <Button variant="outline">View</Button>
                      </Link>
                      <Link href={`/edit/${event.slug}`}>
                        <Button variant="outline">Edit</Button>
                      </Link>
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
        </div>
      </div>
    </div>
  )
}
