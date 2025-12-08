import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Database } from "lucide-react"
import { setupDatabase } from "./actions"

export default async function SetupPage() {
  const supabase = await createServerClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if database is already set up
  const { data: tables } = await supabase.from("user_profiles").select("id").limit(1)

  const isSetup = tables !== null

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Database className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl">Database Setup</CardTitle>
          <CardDescription className="text-base">
            {isSetup
              ? "Your database is already configured and ready to use"
              : "Initialize your LiveTranscribe database with one click"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isSetup ? (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <AlertDescription className="text-base ml-2">
                Database tables are already set up! You can start creating events.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium">This setup will create:</p>
                <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                  <li>• User profiles table</li>
                  <li>• Events table with unique URLs</li>
                  <li>• Event sessions for multiple broadcasts</li>
                  <li>• Transcriptions table with real-time support</li>
                  <li>• Row Level Security policies</li>
                  <li>• Required indexes and functions</li>
                </ul>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  This is a one-time setup that initializes your Supabase database. You can safely run this multiple
                  times - existing tables will not be affected.
                </AlertDescription>
              </Alert>

              <form action={setupDatabase} className="space-y-4">
                <Button type="submit" size="lg" className="w-full">
                  <Database className="mr-2 h-5 w-5" />
                  Initialize Database
                </Button>
              </form>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button variant="outline" className="w-full bg-transparent" asChild>
              <a href={isSetup ? "/dashboard" : "/"}>{isSetup ? "Go to Dashboard" : "Return to Home"}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
