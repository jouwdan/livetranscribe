"use client"

import type React from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface WelcomeDialogProps {
  eventId: string
  eventSlug: string
}

export function WelcomeDialog({ eventId, eventSlug }: WelcomeDialogProps) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

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

  const handleNoThanks = () => {
    handleClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !email.trim()) {
      setError("Please enter your email address")
      return
    }

    setIsSubmitting(true)

    console.log("Submitting survey response:", { email, eventId })

    try {
      const response = await fetch("/api/survey-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          eventId,
        }),
      })

      const data = await response.json()

      console.log("API response:", { status: response.status, data })

      if (!response.ok) {
        setError(data.error || "Failed to submit. Please try again.")
        setIsSubmitting(false)
        return
      }

      // Success - close dialog
      handleClose()
    } catch (err) {
      setError("Something went wrong. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to the LiveTranscribe Beta</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your feedback after the event. Enter your email to receive a post-event survey
            (optional).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleNoThanks}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              No thanks
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
