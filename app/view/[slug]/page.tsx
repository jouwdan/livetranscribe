import { ViewerInterface } from "@/components/viewer-interface"

interface ViewerPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ name?: string }>
}

export default async function ViewerPage({ params, searchParams }: ViewerPageProps) {
  const { slug } = await params
  const { name } = await searchParams

  const eventName = name || "Live Event"

  return <ViewerInterface slug={slug} eventName={eventName} />
}
