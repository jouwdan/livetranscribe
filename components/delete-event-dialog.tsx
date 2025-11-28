"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { deleteEvent } from "@/app/dashboard/actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface DeleteEventDialogProps {
  eventId: string
  eventSlug: string
  eventName: string
}

export function DeleteEventDialog({ eventId, eventSlug, eventName }: DeleteEventDialogProps) {
  const [open, setOpen] = useState(false)
  const [confirmSlug, setConfirmSlug] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (confirmSlug !== eventSlug) {
      return
    }

    setIsDeleting(true)

    toast.promise(
      (async () => {
        const result = await deleteEvent(eventId)

        if (result.error) {
          throw new Error(result.error)
        }

        setOpen(false)
        setConfirmSlug("")
        router.push("/dashboard")
        router.refresh()

        return { eventName }
      })(),
      {
        loading: "Deleting event...",
        success: ({ eventName }) => `Event "${eventName}" deleted successfully!`,
        error: (err) => err.message || "An unexpected error occurred",
        finally: () => {
          setIsDeleting(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete Event</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete <strong>{eventName}</strong> and all its
            transcriptions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-slug" className="text-foreground">
              Type <span className="font-mono font-bold">{eventSlug}</span> to confirm deletion
            </Label>
            <Input
              id="confirm-slug"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={eventSlug}
              className="bg-background border-border text-foreground"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmSlug !== eventSlug || isDeleting}
            className="bg-red-500 hover:bg-red-600"
          >
            {isDeleting ? "Deleting..." : "Delete Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
