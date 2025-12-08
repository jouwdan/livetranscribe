import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { BetaKeysManager } from "@/components/beta-keys-manager"

export const metadata = {
  title: "Beta Keys - Admin",
  description: "Manage beta access keys for LiveTranscribe",
}

export default async function BetaKeysPage() {
  const isAdmin = await checkIsAdmin()

  if (!isAdmin) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  // Fetch all beta access keys
  const { data: betaKeys } = await supabase
    .from("beta_access_keys")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Beta Access Keys</h1>
        <p className="text-slate-400">Create and manage beta access keys for new users</p>
      </div>

      <BetaKeysManager betaKeys={betaKeys || []} />
    </div>
  )
}
