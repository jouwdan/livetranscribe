import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AccountForm } from "@/components/account-form"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("user_profiles").select("full_name, email").eq("id", user.id).single()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Account Settings</h1>
        <AccountForm user={user} profile={profile} />
      </div>
    </div>
  )
}
