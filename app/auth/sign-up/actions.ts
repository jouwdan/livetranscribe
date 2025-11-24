"use server"
import { signUpBypass } from "@/lib/auth/bypass"

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

    const result = await signUpBypass(email, password)
    return result

    // const supabase = await createServerClient()

    // const { error, data } = await supabase.auth.signUp({
    //   email,
    //   password,
    // })

    // if (error) {
    //   console.error("[v0] Sign up error:", error)

    //   if (error.status === 556 || error.message.includes("Internal server error")) {
    //     return {
    //       error:
    //         "Authentication is not configured. Please disable email confirmation in Supabase: Dashboard → Authentication → Providers → Email → Toggle OFF 'Confirm email'",
    //     }
    //   }
    //   return { error: error.message || "Sign up failed" }
    // }

    // if (!data.user) {
    //   return { error: "Sign up failed - no user data returned" }
    // }

    // const cookieStore = await cookies()
    // cookieStore.getAll() // Force cookie refresh

    // return { success: true }
  } catch (err: any) {
    console.error("[v0] Sign up exception:", err)
    return {
      error: err?.message || "An unexpected error occurred. Please try again.",
    }
  }
}
