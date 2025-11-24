"use server"

import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function login(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  console.log("[v0] Login attempt for email:", email)

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  try {
    console.log("[v0] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log("[v0] Has Supabase Key:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    const supabase = await createServerClient()

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.log("[v0] Login error details:", {
        message: error.message,
        status: error.status,
        name: error.name,
      })
      return { error: error.message }
    }

    console.log("[v0] Login successful for user:", data?.user?.id)

    const cookieStore = await cookies()
    cookieStore.getAll() // Force cookie refresh

    return { success: true }
  } catch (err) {
    console.error("[v0] Login exception:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      fullError: err,
    })
    return { error: "An unexpected error occurred. Please try again." }
  }
}
