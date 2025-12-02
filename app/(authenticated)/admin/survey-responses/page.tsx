import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function SurveyResponsesPage() {
  const supabase = await createServerClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

  if (!userData?.is_admin) {
    redirect("/dashboard")
  }

  // Fetch all survey responses with event details
  const { data: responses, error } = await supabase
    .from("survey_responses")
    .select(`
      id,
      email,
      created_at,
      event:events (
        name,
        slug
      )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching survey responses:", error)
  }

  const totalResponses = responses?.length || 0
  const uniqueEvents = new Set(responses?.map((r: any) => r.event?.slug)).size

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Survey Responses</h1>
          <p className="text-muted-foreground mt-2">
            Email addresses collected from viewers interested in post-event surveys
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalResponses}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Unique Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueEvents}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Responses</CardTitle>
            <CardDescription>Survey responses from viewer welcome dialogs</CardDescription>
          </CardHeader>
          <CardContent>
            {!responses || responses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No survey responses yet</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((response: any) => (
                      <TableRow key={response.id}>
                        <TableCell className="font-mono text-sm">{response.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{response.event?.name || "Unknown Event"}</span>
                            <span className="text-xs text-muted-foreground">{response.event?.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(response.created_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
