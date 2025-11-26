import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { AppNav } from "@/components/app-nav"
import { AdminDashboard } from "@/components/admin-dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Calendar, Users, Key } from "lucide-react"

export default async function AdminPage() {
  const isAdmin = await checkIsAdmin()

  if (!isAdmin) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  // Fetch all user profiles
  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, credits_minutes, max_attendees, is_admin, created_at, credits_last_updated")
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-black">
      <AppNav />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Manage user credits and account settings</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-purple-400" />
                User Event Credits
              </CardTitle>
              <CardDescription>Allocate event credits to user accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Manage unallocated event credits available to each user.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Calendar className="h-5 w-5 text-green-400" />
                Event-Allocated Credits
              </CardTitle>
              <CardDescription>View and manage credits allocated to specific events</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                See which event credits have been used to create events and manage allocations.
              </p>
              <Link href="/admin/events">
                <Button className="w-full bg-green-600 hover:bg-green-700">Manage Event Credits</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Key className="h-5 w-5 text-orange-400" />
                Beta Access Keys
              </CardTitle>
              <CardDescription>Create and manage beta access keys</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate access keys for new users during the beta period.
              </p>
              <Link href="/admin/beta-keys">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">Manage Beta Keys</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-2">Manage User Event Credits</h2>
          <p className="text-slate-400 text-sm">
            Allocate event credits to users. Users can then use these credits to create and broadcast events.
          </p>
        </div>

        <AdminDashboard users={users || []} />
      </div>
    </div>
  )
}
