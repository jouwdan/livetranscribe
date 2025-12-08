"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface WelcomeDialogProps {
  eventId: string
  eventSlug: string
}

export function WelcomeDialog({ eventId, eventSlug }: WelcomeDialogProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Check if user has seen this dialog before
    const hasSeenWelcome = localStorage.getItem(`welcome-dialog-seen-${eventSlug}`)
    if (!hasSeenWelcome) {
      setOpen(true)
    }
  }, [eventSlug])

  const handleClose = () => {
    // Mark dialog as seen
    localStorage.setItem(`welcome-dialog-seen-${eventSlug}`, "true")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to LiveTranscribe</DialogTitle>
          <DialogDescription>
            You're viewing live transcriptions for this event. The text will update in real-time as the speaker talks.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
