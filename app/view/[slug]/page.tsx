import { ViewerInterface } from "@/components/viewer-interface"
import { createServerClient } from "@/lib/supabase/server"

interface ViewerPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ view?: string }>
}

export default async function ViewerPage({ params, searchParams }: ViewerPageProps) {
  const { slug } = await params
  const { view } = await searchParams

  const supabase = await createServerClient()
  const { data: event } = await supabase.from("events").select("name, description").eq("slug", slug).single()

  const eventName = event?.name || "Live Event"
  const eventDescription = event?.description || ""

  const initialViewMode =
    view === "mobile" || view === "stage" || view === "tv"
      ? view === "tv"
        ? "stage"
        : view // map "tv" to "stage"
      : "laptop"

  return (
    <ViewerInterface
      slug={slug}
      eventName={eventName}
      eventDescription={eventDescription}
      initialViewMode={initialViewMode as "laptop" | "mobile" | "stage"}
    />
  )
}
