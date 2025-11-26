import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function ViewErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex max-w-md flex-col items-center space-y-6 text-center">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Event Not Found</h1>
          <p className="text-muted-foreground">
            The event you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  )
}
