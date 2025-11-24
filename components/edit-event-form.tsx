"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

interface EditEventFormProps {
  event: {
    id: string
    name: string
    slug: string
    is_active: boolean
    description?: string
  }
}

export function EditEventForm({ event }: EditEventFormProps) {
  const [name, setName] = useState(event.name)
  const [description, setDescription] = useState(event.description || "")
  const [slug, setSlug] = useState(event.slug)
  const [isActive, setIsActive] = useState(event.is_active)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const checkSlugAvailability = async (newSlug: string) => {
    if (newSlug === event.slug) {
      setSlugAvailable(true)
      return
    }

    setCheckingSlug(true)
    console.log("[v0] Checking slug availability:", newSlug)

    const { data, error } = await supabase.from("events").select("id").eq("slug", newSlug).maybeSingle()

    console.log("[v0] Slug check result:", { data, error, available: !data })

    const available = !data
    setSlugAvailable(available)
    setCheckingSlug(false)
  }

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setSlug(sanitized)

    if (sanitized.length >= 3) {
      const timeoutId = setTimeout(() => checkSlugAvailability(sanitized), 500)
      return () => clearTimeout(timeoutId)
    } else {
      setSlugAvailable(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const { error: updateError } = await supabase
        .from("events")
        .update({
          name,
          description,
          slug,
          is_active: isActive,
        })
        .eq("id", event.id)

      if (updateError) throw updateError

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
        <CardDescription>Update your event information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Event Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Live Event"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Short Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your event (optional)"
              rows={3}
              maxLength={200}
              className="resize-none"
            />
            <p className="text-xs text-foreground/60">{description.length}/200 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Custom URL Slug</Label>
            <div className="relative">
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-event"
                required
                className={
                  slug.length >= 3
                    ? slugAvailable === true
                      ? "border-green-500"
                      : slugAvailable === false
                        ? "border-red-500"
                        : ""
                    : ""
                }
              />
              {checkingSlug && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>
            {slug.length >= 3 && slugAvailable === false && (
              <p className="text-sm text-red-600">This slug is already taken</p>
            )}
            {slug.length >= 3 && slugAvailable === true && slug !== event.slug && (
              <p className="text-sm text-green-600">This slug is available</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isActive">Event is active</Label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || (slug !== event.slug && slugAvailable !== true)}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Event"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
