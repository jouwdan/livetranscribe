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
import { Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

interface EditEventFormProps {
  event: {
    id: string
    name: string
    slug: string
    is_active: boolean
    description?: string
    logo_url?: string
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
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(event.logo_url || null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const checkSlugAvailability = async (newSlug: string) => {
    if (newSlug === event.slug) {
      setSlugAvailable(true)
      return
    }

    setCheckingSlug(true)
    console.log("Checking slug availability:", newSlug)

    const { data, error } = await supabase.from("events").select("id").eq("slug", newSlug).maybeSingle()

    console.log("Slug check result:", { data, error, available: !data })

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
      setError("")
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setRemovingLogo(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const updatePromise = (async () => {
      try {
        let logoUrl: string | null | undefined = event.logo_url
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
        } else if (removingLogo) {
          logoUrl = null
        }

        const { error: updateError } = await supabase
          .from("events")
          .update({
            name,
            description,
            slug,
            is_active: isActive,
            logo_url: logoUrl,
          })
          .eq("id", event.id)

        if (updateError) throw updateError

        console.log("Event updated successfully, redirecting to dashboard")
        router.push("/dashboard")
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update event")
        throw err
      } finally {
        setLoading(false)
        setUploadingLogo(false)
      }
    })()

    toast.promise(updatePromise, {
      loading: uploadingLogo ? "Uploading logo..." : "Updating event...",
      success: "Event updated successfully!",
      error: (err) => err.message || "Failed to update event",
    })
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
            <Label htmlFor="description">Event Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your event, topics, speakers, or specialized terms that will be discussed..."
              rows={5}
              maxLength={2000}
              className="resize-none"
            />
            <p className="text-xs text-foreground/60">
              {description.length}/2000 characters.{" "}
              <strong>This description is provided to the AI transcription system</strong> to help it better understand
              specialized terminology, proper nouns, speaker names, and topics being discussed, resulting in more
              accurate transcriptions.
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
                  disabled={loading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("logoUpload")?.click()}
                  disabled={loading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Logo
                </Button>
              </div>
            )}
            <p className="text-xs text-foreground/60">
              This logo will appear on the viewer page. Maximum 5MB, recommended square format.
            </p>
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
            <Button
              type="submit"
              disabled={loading || uploadingLogo || (slug !== event.slug && slugAvailable !== true)}
            >
              {loading || uploadingLogo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingLogo ? "Uploading..." : "Updating..."}
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
