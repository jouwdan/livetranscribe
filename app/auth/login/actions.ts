"use server"
import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function login(formData: FormData) {
  try {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
      return { error: "Email and password are required" }
    }

    const supabase = await createServerClient()

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("[v0] Login error:", error)
      return { error: error.message || "Login failed" }
    }

    if (!data.user) {
      return { error: "Login failed - no user data returned" }
    }

    const cookieStore = await cookies()
    cookieStore.getAll() // Force cookie refresh

    return { success: true }
  } catch (err: any) {
    console.error("[v0] Login exception:", err)
    return {
      error: err?.message || "An unexpected error occurred. Please try again.",
    }
  }
}
