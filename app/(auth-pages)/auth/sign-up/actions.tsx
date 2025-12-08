"use server"

import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("full-name") as string

  console.log("[sign-up] start", { email })

  const supabase = await createServerClient()

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

  console.log("[sign-up] success", { email, userId })
  redirect("/dashboard")
}
