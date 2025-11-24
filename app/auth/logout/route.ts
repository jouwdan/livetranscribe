import { logoutBypass } from "@/lib/auth/bypass"
import { redirect } from "next/navigation"

export async function POST() {
  await logoutBypass()
  redirect("/")
}
