"use server"

import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const accessKey = formData.get("access-key") as string
  const fullName = formData.get("full-name") as string

  console.log("[sign-up] start", { email, accessKey })

  const supabase = await createServerClient()

  // Check if the access key exists and is valid
  const { data: keyData, error: keyError } = await supabase
    .from("beta_access_keys")
    .select("*")
    .eq("access_key", accessKey)
    .single()

  if (keyError || !keyData) {
    console.error("[sign-up] invalid key", keyError)
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
    console.error("[sign-up] auth signup failed", error)
    return { error: error.message }
  }

  const { data: userData, error: userFetchError } = await supabase.auth.getUser()
  if (userFetchError) {
    console.error("[sign-up] failed to fetch user", userFetchError)
    return { error: "Failed to fetch user after signup" }
  }
  const userId = userData?.user?.id

  if (userId) {
    const { error: profileError } = await supabase
      .from("user_profiles")
      .update({ full_name: fullName })
      .eq("id", userId)
    if (profileError) {
      console.error("[sign-up] failed to update profile", profileError)
      return { error: "Failed to update user profile" }
    }
  }

  const { error: keyUpdateError } = await supabase
    .from("beta_access_keys")
    .update({
      current_uses: keyData.current_uses + 1,
      used_by_email: email,
      used_at: new Date().toISOString(),
      is_used: keyData.current_uses + 1 >= keyData.max_uses,
    })
    .eq("id", keyData.id)
  if (keyUpdateError) {
    console.error("[sign-up] failed to update beta key", keyUpdateError)
    return { error: "Failed to update beta key usage" }
  }

  if (userId) {
    const { error: usageError } = await supabase.from("beta_key_usage").insert({
      beta_key_id: keyData.id,
      user_id: userId,
      email: email,
    })
    if (usageError) {
      console.error("[sign-up] failed to insert key usage", usageError)
      return { error: "Failed to record beta key usage" }
    }
  }

  console.log("[sign-up] success", { email, userId })
  redirect("/dashboard")
}
