import { ViewerInterface } from "@/components/viewer-interface"
import { createServerClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

interface ViewerPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ view?: string }>
}

export default async function ViewerPage({ params, searchParams }: ViewerPageProps) {
  const { slug } = await params
  const { view } = await searchParams

  const supabase = await createServerClient()
  const { data: event, error } = await supabase
    .from("events")
    .select("id, name, description, logo_url")
    .eq("slug", slug)
    .maybeSingle()

  if (!event || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="flex max-w-md flex-col items-center space-y-6 text-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Event Not Found</h1>
            <p className="text-muted-foreground">
              The event "{slug}" doesn&apos;t exist, has been removed, or isn&apos;t accessible anymore.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const initialViewMode =
    view === "mobile" || view === "stage" || view === "tv"
      ? view === "tv"
        ? "stage"
        : view // map "tv" to "stage"
      : "laptop"

  return (
    <ViewerInterface
      event={{
        id: event.id,
        slug,
        name: event.name,
        description: event.description || "",
        logo_url: event.logo_url || null,
      }}
      initialViewMode={initialViewMode as "laptop" | "mobile" | "stage"}
    />
  )
}
