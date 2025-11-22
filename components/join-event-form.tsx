"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function JoinEventForm() {
  const [eventCode, setEventCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Extract slug from URL or use code directly
    let slug = eventCode
    if (eventCode.includes("/view/")) {
      slug = eventCode.split("/view/")[1].split("?")[0]
    }

    router.push(`/view/${slug}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="eventCode">Event Code or URL</Label>
        <Input
          id="eventCode"
          type="text"
          placeholder="my-event-2024 or full URL"
          value={eventCode}
          onChange={(e) => setEventCode(e.target.value)}
          required
          disabled={isLoading}
        />
        <p className="text-sm text-slate-500">Enter the event slug or paste the full viewer URL</p>
      </div>

      <Button type="submit" disabled={isLoading || !eventCode} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Joining...
          </>
        ) : (
          "Join Event"
        )}
      </Button>
    </form>
  )
}
