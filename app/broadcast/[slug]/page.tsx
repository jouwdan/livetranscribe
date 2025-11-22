import { BroadcastInterface } from "@/components/broadcast-interface"

interface BroadcastPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ name?: string }>
}

export default async function BroadcastPage({ params, searchParams }: BroadcastPageProps) {
  const { slug } = await params
  const { name } = await searchParams

  const eventName = name || "Live Event"

  return (
    <div className="min-h-screen bg-slate-900">
      <BroadcastInterface slug={slug} eventName={eventName} />
    </div>
  )
}
