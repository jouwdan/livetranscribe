"use server"
import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function signUp(formData: FormData) {
  try {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
      return { error: "Email and password are required" }
    }

    if (password.length < 6) {
      return { error: "Password must be at least 6 characters" }
    }

    const supabase = await createServerClient()

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      console.error("[v0] Sign up error:", error)
      return { error: error.message || "Sign up failed" }
    }

    if (!data.user) {
      return { error: "Sign up failed - no user data returned" }
    }

    const cookieStore = await cookies()
    cookieStore.getAll() // Force cookie refresh

    return { success: true }
  } catch (err: any) {
    console.error("[v0] Sign up exception:", err)
    return {
      error: err?.message || "An unexpected error occurred. Please try again.",
    }
  }
}
