import { ViewerInterface } from "@/components/viewer-interface"
import { createServerClient } from "@/lib/supabase/server"

interface ViewerPageProps {
  params: Promise<{ slug: string }>
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const { slug } = await params

  const supabase = await createServerClient()
  const { data: event } = await supabase.from("events").select("name, description").eq("slug", slug).single()

  const eventName = event?.name || "Live Event"
  const eventDescription = event?.description || ""

  return <ViewerInterface slug={slug} eventName={eventName} eventDescription={eventDescription} />
}
