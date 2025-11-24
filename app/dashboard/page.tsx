import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { PlusCircle, LogOut } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
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
    .limit(10)

  const totalMinutes = usage?.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) || 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-slate-600">{user.email}</p>
          </div>
          <form action="/auth/logout" method="post">
            <Button variant="outline" className="gap-2 bg-transparent">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usage Summary</CardTitle>
            <CardDescription>Your transcription usage this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalMinutes} minutes</div>
            <p className="text-sm text-slate-600 mt-1">Total transcription time</p>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Your Events</h2>
          <Link href="/create">
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

        <div className="grid gap-4">
          {events && events.length > 0 ? (
            events.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{event.name}</CardTitle>
                    <div className="flex gap-2">
                      {event.session_active && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>
                      )}
                      {event.is_active && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Live</span>
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
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-slate-600">No events yet. Create your first event to get started!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
