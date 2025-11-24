import { createClient } from "@/lib/supabase/server"

export async function checkIsAdmin(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).maybeSingle()

  return profile?.is_admin || false
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id || null
}
