import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { UserManager } from "@/components/user-manager"
import { AppNav } from "@/components/app-nav"

export default async function UsersPage() {
  const isAdmin = await checkIsAdmin()

  if (!isAdmin) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  // Fetch all users with their statistics
  const { data: users } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false })

  // Fetch event counts per user
  const { data: eventCounts } = await supabase.from("events").select("user_id")

  // Calculate event counts
  const eventCountMap = new Map<string, number>()
  eventCounts?.forEach((event) => {
    const count = eventCountMap.get(event.user_id) || 0
    eventCountMap.set(event.user_id, count + 1)
  })

  // Fetch usage logs per user
  const { data: usageLogs } = await supabase.from("usage_logs").select("user_id, duration_minutes")

  // Calculate total usage per user
  const usageMap = new Map<string, number>()
  usageLogs?.forEach((log) => {
    const total = usageMap.get(log.user_id) || 0
    usageMap.set(log.user_id, total + (log.duration_minutes || 0))
  })

  // Combine data
  const usersWithStats = users?.map((user) => ({
    ...user,
    total_events: eventCountMap.get(user.id) || 0,
    total_usage_minutes: usageMap.get(user.id) || 0,
  }))

  return (
    <div className="min-h-screen bg-black">
      <AppNav />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-slate-400">View and manage user accounts and permissions</p>
        </div>
        <UserManager users={usersWithStats || []} />
      </div>
    </div>
  )
}
