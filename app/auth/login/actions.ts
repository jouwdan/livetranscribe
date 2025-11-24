"use server"

import { createServerClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  try {
    const supabase = await createServerClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.log("[v0] Login error:", error.message)
      return { error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error("[v0] Login exception:", err)
    return { error: "An unexpected error occurred. Please try again." }
  }
}
