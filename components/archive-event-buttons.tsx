"use client"

import { Button } from "@/components/ui/button"
import { Archive, ArchiveRestore } from "lucide-react"
import { toast } from "sonner"
import { archiveEvent, unarchiveEvent } from "@/app/(authenticated)/dashboard/actions"

export function ArchiveEventButton({ eventId }: { eventId: string }) {
  const handleArchive = async () => {
    toast.promise(
      (async () => {
        const formData = new FormData()
        formData.append("eventId", eventId)
        const result = await archiveEvent(formData)

        if (result.error) {
          throw new Error(result.error)
        }

        return result
      })(),
      {
        loading: "Archiving event...",
        success: "Event archived successfully!",
        error: (err) => err.message || "Failed to archive event",
      },
    )
  }

  return (
    <Button variant="ghost" size="sm" className="gap-2" onClick={handleArchive}>
      <Archive className="h-4 w-4" />
      Archive
    </Button>
  )
}

export function UnarchiveEventButton({ eventId }: { eventId: string }) {
  const handleUnarchive = async () => {
    toast.promise(
      (async () => {
        const formData = new FormData()
        formData.append("eventId", eventId)
        const result = await unarchiveEvent(formData)

        if (result.error) {
          throw new Error(result.error)
        }

        return result
      })(),
      {
        loading: "Unarchiving event...",
        success: "Event restored successfully!",
        error: (err) => err.message || "Failed to unarchive event",
      },
    )
  }

  return (
    <Button variant="ghost" size="sm" className="gap-2" onClick={handleUnarchive}>
      <ArchiveRestore className="h-4 w-4" />
      Unarchive
    </Button>
  )
}
