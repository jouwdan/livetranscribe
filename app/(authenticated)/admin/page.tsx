import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboard } from "@/components/admin-dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Calendar, Key, UserCog } from "lucide-react"

export default async function AdminPage() {
  const isAdmin = await checkIsAdmin()

  if (!isAdmin) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, is_admin, created_at")
    .order("created_at", { ascending: false })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-slate-400">Manage users, events, and beta access</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 hover:border-blue-500/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <UserCog className="h-5 w-5 text-blue-400" />
              Users
            </CardTitle>
            <CardDescription className="text-sm">Manage accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/users">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Manage Users</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <Calendar className="h-5 w-5 text-green-400" />
              Event Credits
            </CardTitle>
            <CardDescription className="text-sm">Allocate credits to events</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/events">
              <Button className="w-full bg-green-600 hover:bg-green-700">Manage Credits</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20 hover:border-orange-500/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <Key className="h-5 w-5 text-orange-400" />
              Beta Keys
            </CardTitle>
            <CardDescription className="text-sm">Create access keys</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/beta-keys">
              <Button className="w-full bg-orange-600 hover:bg-orange-700">Manage Keys</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Event Credit Management</h2>
        <p className="text-slate-400 text-sm">Allocate and manage event credits for users to create broadcasts</p>
      </div>

      <AdminDashboard users={users || []} />
    </div>
  )
}
