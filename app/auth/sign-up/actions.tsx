"use server"

import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const accessKey = formData.get("access-key") as string
  const fullName = formData.get("full-name") as string

  const supabase = await createServerClient()

  // Check if the access key exists and is valid
  const { data: keyData, error: keyError } = await supabase
    .from("beta_access_keys")
    .select("*")
    .eq("access_key", accessKey)
    .single()

  if (keyError || !keyData) {
    return { error: "Invalid beta access key. Please request access from the beta page." }
  }

  // Check if key is expired
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return { error: "This beta access key has expired." }
  }

  // Check if key has reached max uses
  if (keyData.current_uses >= keyData.max_uses) {
    return { error: "This beta access key has reached its maximum number of uses." }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id

  if (userId) {
    await supabase
      .from("user_profiles")
      .update({ full_name: fullName })
      .eq("id", userId)
  }

  await supabase
    .from("beta_access_keys")
    .update({
      current_uses: keyData.current_uses + 1,
      used_by_email: email,
      used_at: new Date().toISOString(),
      is_used: keyData.current_uses + 1 >= keyData.max_uses,
    })
    .eq("id", keyData.id)

  if (userId) {
    await supabase.from("beta_key_usage").insert({
      beta_key_id: keyData.id,
      user_id: userId,
      email: email,
    })
  }

  redirect("/dashboard")
}
