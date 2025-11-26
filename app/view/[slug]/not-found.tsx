import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-7xl font-bold text-foreground">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">Event Not Found</h2>
        </div>
        <p className="max-w-md text-muted-foreground">
          The live transcription event you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </div>
  )
}
