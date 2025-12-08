"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, XCircle, CreditCard, Clock, Users, Upload, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { formatMinutesToHoursAndMinutes } from "@/lib/format-time"
import { toast } from "sonner"

interface EventCredit {
  id: string
  credits_minutes: number
  max_attendees: number
  notes: string | null
  created_at: string
}

export function CreateEventForm() {
  const [eventName, setEventName] = useState("")
  const [eventDescription, setEventDescription] = useState("")
  const [customSlug, setCustomSlug] = useState("")
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [availableCredits, setAvailableCredits] = useState<EventCredit[]>([])
  const [selectedCreditId, setSelectedCreditId] = useState<string>("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [creditsLoading, setCreditsLoading] = useState(true)

  useEffect(() => {
    const fetchCredits = async () => {
      setCreditsLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setCreditsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("event_credits")
        .select("*")
        .eq("user_id", user.id)
        .is("allocated_to_event_id", null)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching credits:", error)
        setCreditsLoading(false)
        return
      }

      setAvailableCredits(data || [])
      if (data && data.length > 0) {
        setSelectedCreditId(data[0].id)
      }
      setCreditsLoading(false)
    }

    fetchCredits()
  }, [])

  useEffect(() => {
    if (!customSlug) {
      setSlugAvailable(null)
      return
    }

    const checkSlug = async () => {
      setCheckingSlug(true)
      console.log("Checking slug availability for:", customSlug)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("events").select("slug").eq("slug", customSlug).maybeSingle()

        console.log("Slug check result:", { data, error, isAvailable: !data })

        if (error && error.code !== "PGRST116") {
          throw error
        }

        setSlugAvailable(data === null)
      } catch (err) {
        console.error("Error checking slug:", err)
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo must be less than 5MB")
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    toast.promise(
      (async () => {
        const supabase = createClient()

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push("/auth/login")
          throw new Error("Not authenticated")
        }

        if (!selectedCreditId) {
          throw new Error("Please select an event credit to use")
        }

        const selectedCredit = availableCredits.find((c) => c.id === selectedCreditId)
        if (!selectedCredit) {
          throw new Error("Invalid credit selection")
        }

        const slug = customSlug && slugAvailable ? sanitizeSlug(customSlug) : generateSlug(eventName)

        if (customSlug && slugAvailable) {
          const { data: existingEvent } = await supabase.from("events").select("slug").eq("slug", slug).maybeSingle()

          if (existingEvent) {
            setSlugAvailable(false)
            throw new Error("This slug was just taken. Please try another.")
          }
        }

        let logoUrl: string | null = null
        if (logoFile) {
          setUploadingLogo(true)
          const formData = new FormData()
          formData.append("file", logoFile)

          const uploadResponse = await fetch("/api/upload-logo", {
            method: "POST",
            body: formData,
          })

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload logo")
          }

          const uploadData = await uploadResponse.json()
          logoUrl = uploadData.url
          setUploadingLogo(false)
        }

        const { data: event, error: createError } = await supabase
          .from("events")
          .insert({
            slug,
            name: eventName,
            description: eventDescription || null,
            user_id: user.id,
            organizer_key: Math.random().toString(36).substring(7),
            is_active: true,
            credits_minutes: selectedCredit.credits_minutes,
            max_attendees: selectedCredit.max_attendees,
            logo_url: logoUrl,
          })
          .select()
          .single()

        if (createError) throw createError

        const { error: updateError } = await supabase
          .from("event_credits")
          .update({
            allocated_to_event_id: event.id,
            allocated_at: new Date().toISOString(),
          })
          .eq("id", selectedCreditId)

        if (updateError) throw updateError

        router.push(`/broadcast/${slug}`)
        return event
      })(),
      {
        loading: "Creating event...",
        success: (event) => `Event "${event.name}" created successfully!`,
        error: (err) => {
          setError(err.message)
          return err.message || "Failed to create event"
        },
        finally: () => {
          setIsLoading(false)
          setUploadingLogo(false)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {creditsLoading ? (
        <Card className="bg-card/50 backdrop-blur-sm border-border/80 animate-pulse">
          <CardHeader>
            <div className="h-6 w-48 bg-white/10 rounded" />
            <div className="h-4 w-64 bg-white/5 rounded" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="h-12 bg-white/5 rounded" />
              <div className="h-12 bg-white/5 rounded" />
              <div className="h-12 bg-white/5 rounded" />
            </div>
          </CardContent>
        </Card>
      ) : availableCredits.length > 0 ? (
        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Select Event Credit
            </CardTitle>
            <CardDescription>Choose which credit to use for this event</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={selectedCreditId} onValueChange={setSelectedCreditId} className="space-y-3">
              {availableCredits.map((credit) => (
                <div key={credit.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={credit.id} id={credit.id} />
                  <Label
                    htmlFor={credit.id}
                    className="flex-1 cursor-pointer p-3 rounded-lg border border-border/50 bg-black/30 hover:bg-black/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        {credit.notes && <div className="font-medium text-white">{credit.notes}</div>}
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatMinutesToHoursAndMinutes(credit.credits_minutes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {credit.max_attendees} attendees
                          </span>
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/50 backdrop-blur-sm border-border/80 border-red-500/50">
          <CardHeader>
            <CardTitle className="text-white">No Event Credits Available</CardTitle>
            <CardDescription className="text-red-400">
              You need to purchase event credits before you can create an event.
            </CardDescription>
          </CardHeader>
        </Card>
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
          disabled={isLoading || availableCredits.length === 0}
        />
        <p className="text-sm text-muted-foreground">This will be visible to attendees</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventDescription">Event Description (Optional)</Label>
        <Textarea
          id="eventDescription"
          placeholder="Describe what this event is about, key topics, speakers, or any context that will help improve transcription accuracy..."
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
          disabled={isLoading || availableCredits.length === 0}
          className="min-h-[120px] resize-y"
          maxLength={2000}
        />
        <p className="text-sm text-muted-foreground">
          <strong>This description is provided to the AI transcription system</strong> to help it understand specialized
          terms, proper nouns, and topics. Better context leads to more accurate transcriptions. (
          {eventDescription.length}/2000)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="logoUpload">Event Logo (Optional)</Label>
        {logoPreview ? (
          <div className="relative inline-block">
            <img
              src={logoPreview || "/placeholder.svg"}
              alt="Logo preview"
              className="h-24 w-24 object-contain rounded-lg border border-border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={removeLogo}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id="logoUpload"
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              disabled={isLoading || availableCredits.length === 0}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("logoUpload")?.click()}
              disabled={isLoading || availableCredits.length === 0}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload Logo
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          This logo will appear on the viewer page. Maximum 5MB, recommended square format.
        </p>
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
            disabled={isLoading || availableCredits.length === 0}
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
        disabled={
          isLoading ||
          uploadingLogo ||
          !eventName ||
          (customSlug !== "" && slugAvailable !== true) ||
          availableCredits.length === 0
        }
        className="w-full"
      >
        {isLoading || uploadingLogo ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {uploadingLogo ? "Uploading Logo..." : "Creating Event..."}
          </>
        ) : (
          "Create Event"
        )}
      </Button>
    </form>
  )
}
