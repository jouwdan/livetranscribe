"use server"
import { loginBypass } from "@/lib/auth/bypass"

export async function login(formData: FormData) {
  try {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
      return { error: "Email and password are required" }
    }

    const result = await loginBypass(email, password)
    return result

    // const supabase = await createServerClient()

    // const { error, data } = await supabase.auth.signInWithPassword({
    //   email,
    //   password,
    // })

    // if (error) {
    //   console.error("[v0] Login error:", error)

    //   if (error.status === 556 || error.message.includes("Internal server error")) {
    //     return {
    //       error:
    //         "Authentication is not configured. Please disable email confirmation in Supabase: Dashboard → Authentication → Providers → Email → Toggle OFF 'Confirm email'",
    //     }
    //   }
    //   if (error.message.includes("Email not confirmed")) {
    //     return {
    //       error: "Please confirm your email address before logging in.",
    //     }
    //   }
    //   return { error: error.message || "Login failed" }
    // }

    // if (!data.user) {
    //   return { error: "Login failed - no user data returned" }
    // }

    // const cookieStore = await cookies()
    // cookieStore.getAll() // Force cookie refresh

    // return { success: true }
  } catch (err: any) {
    console.error("[v0] Login exception:", err)
    return {
      error: err?.message || "An unexpected error occurred. Please try again.",
    }
  }
}
