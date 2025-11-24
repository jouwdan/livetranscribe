"use server"

import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  try {
    const supabase = await createServerClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      console.error("[v0] Sign up error:", error.message)
      return { error: error.message }
    }

    const cookieStore = await cookies()
    cookieStore.getAll() // Force cookie refresh

    return { success: true }
  } catch (err) {
    console.error("[v0] Sign up exception:", err)
    return { error: "An unexpected error occurred. Please try again." }
  }
}
