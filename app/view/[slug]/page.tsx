import { ViewerInterface } from "@/components/viewer-interface"
import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

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
    .select("name, description, logo_url")
    .eq("slug", slug)
    .maybeSingle()

  if (!event || error) {
    redirect(`/view-error?slug=${slug}`)
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
        slug,
        name: event.name,
        description: event.description || "",
        logo_url: event.logo_url || null,
      }}
      initialViewMode={initialViewMode as "laptop" | "mobile" | "stage"}
    />
  )
}
