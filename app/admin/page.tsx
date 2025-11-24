import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { AppNav } from "@/components/app-nav"
import { AdminDashboard } from "@/components/admin-dashboard"

export default async function AdminPage() {
  const isAdmin = await checkIsAdmin()

  if (!isAdmin) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  // Fetch all user profiles
  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, email, credits_minutes, max_attendees, is_admin, created_at, credits_last_updated")
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-black">
      <AppNav />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Manage user credits and account settings</p>
        </div>
        <AdminDashboard users={users || []} />
      </div>
    </div>
  )
}
