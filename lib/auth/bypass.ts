"use server"

import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { compare, hash } from "bcryptjs"

export async function signUpBypass(email: string, password: string) {
  try {
    const supabase = await createServerClient()

    // Hash password
    const passwordHash = await hash(password, 10)

    // Insert user
    const { data, error } = await supabase
      .from("users")
      .insert({ email, password_hash: passwordHash })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return { error: "Email already exists" }
      }
      return { error: error.message }
    }

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set("user_id", data.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return { success: true, userId: data.id }
  } catch (error) {
    console.error("[v0] Signup bypass error:", error)
    return { error: "Failed to create account" }
  }
}

export async function loginBypass(email: string, password: string) {
  try {
    const supabase = await createServerClient()

    // Find user
    const { data: user, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle()

    if (error || !user) {
      return { error: "Invalid email or password" }
    }

    // Verify password
    const isValid = await compare(password, user.password_hash)
    if (!isValid) {
      return { error: "Invalid email or password" }
    }

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return { success: true, userId: user.id }
  } catch (error) {
    console.error("[v0] Login bypass error:", error)
    return { error: "Failed to log in" }
  }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("user_id")?.value

    if (!userId) {
      return null
    }

    const supabase = await createServerClient()
    const { data: user } = await supabase.from("users").select("id, email, created_at").eq("id", userId).maybeSingle()

    return user
  } catch (error) {
    console.error("[v0] Get current user error:", error)
    return null
  }
}

export async function logoutBypass() {
  const cookieStore = await cookies()
  cookieStore.delete("user_id")
  return { success: true }
}
