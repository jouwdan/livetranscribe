"use server"

import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function login(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  try {
    const supabase = await createServerClient()

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.status === 556 || error.message.includes("Internal server error")) {
        return {
          error:
            "Authentication service error. Please ensure your domain is configured in Supabase dashboard under Authentication → URL Configuration. Add your domain to both 'Site URL' and 'Redirect URLs'.",
        }
      }
      return { error: error.message }
    }

    const cookieStore = await cookies()
    cookieStore.getAll() // Force cookie refresh

    return { success: true }
  } catch (err) {
    console.error("[v0] Login exception:", err)
    return { error: "An unexpected error occurred. Please try again." }
  }
}
