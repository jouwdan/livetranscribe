"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function CreateEventForm() {
  const [eventName, setEventName] = useState("")
  const [customSlug, setCustomSlug] = useState("")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCredits, setHasCredits] = useState<boolean>(true)
  const router = useRouter()

  useEffect(() => {
    const checkCredits = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("credits_minutes")
        .eq("id", user.id)
        .single()

      setHasCredits(profile ? profile.credits_minutes > 0 : false)
    }

    checkCredits()
  }, [])

  useEffect(() => {
    if (!customSlug) {
      setSlugAvailable(null)
      return
    }

    const checkSlug = async () => {
      setCheckingSlug(true)
      console.log("[v0] Checking slug availability for:", customSlug)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("events").select("slug").eq("slug", customSlug).maybeSingle()

        console.log("[v0] Slug check result:", { data, error, isAvailable: !data })

        if (error && error.code !== "PGRST116") {
          throw error
        }

        setSlugAvailable(data === null)
      } catch (err) {
        console.error("[v0] Error checking slug:", err)
        setSlugAvailable(null)
      } finally {
        setCheckingSlug(false)
      }
    }

    const debounce = setTimeout(checkSlug, 500)
    return () => clearTimeout(debounce)
  }, [customSlug])

  const generateSlug = (name: string) => {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 7)
    )
  }

  const sanitizeSlug = (slug: string) => {
    return slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("credits_minutes")
        .eq("id", user.id)
        .single()

      if (!profile || profile.credits_minutes <= 0) {
        setError("Insufficient credits. Please add more minutes to your account before creating an event.")
        setIsLoading(false)
        return
      }

      const slug = customSlug && slugAvailable ? sanitizeSlug(customSlug) : generateSlug(eventName)

      if (customSlug && slugAvailable) {
        const { data: existingEvent } = await supabase.from("events").select("slug").eq("slug", slug).maybeSingle()

        if (existingEvent) {
          setError("This slug was just taken. Please try another.")
          setSlugAvailable(false)
          setIsLoading(false)
          return
        }
      }

      const { data: event, error: createError } = await supabase
        .from("events")
        .insert({
          slug,
          name: eventName,
          user_id: user.id,
          organizer_key: Math.random().toString(36).substring(7),
          is_active: true,
        })
        .select()
        .single()

      if (createError) throw createError

      router.push(`/broadcast/${slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!hasCredits && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-semibold">Insufficient Credits</p>
            <p className="text-sm text-red-300 mt-1">
              You don't have enough credits to create an event. Please contact us to add more minutes to your account.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="eventName">Event Name</Label>
        <Input
          id="eventName"
          type="text"
          placeholder="My Conference 2024"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          required
          disabled={isLoading}
        />
        <p className="text-sm text-muted-foreground">This will be visible to attendees</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customSlug">Custom URL Slug (Optional)</Label>
        <div className="relative">
          <Input
            id="customSlug"
            type="text"
            placeholder="my-event"
            value={customSlug}
            onChange={(e) => setCustomSlug(sanitizeSlug(e.target.value))}
            disabled={isLoading}
            className="pr-10"
          />
          {customSlug && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkingSlug ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : slugAvailable === true ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : slugAvailable === false ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : null}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {customSlug
            ? slugAvailable === true
              ? `LiveTranscribe.net/view/${customSlug} is available!`
              : slugAvailable === false
                ? "This slug is already taken"
                : "Checking availability..."
            : "Leave blank to auto-generate from event name"}
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        type="submit"
        disabled={isLoading || !eventName || (customSlug !== "" && slugAvailable !== true) || !hasCredits}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Event...
          </>
        ) : (
          "Create Event"
        )}
      </Button>
    </form>
  )
}
