"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download } from "lucide-react"
import { useState } from "react"

interface DownloadTranscriptionsButtonProps {
  eventId: string
  sessionId?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
}

export function DownloadTranscriptionsButton({
  eventId,
  sessionId,
  variant = "outline",
  size = "default",
}: DownloadTranscriptionsButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async (format: string) => {
    setIsDownloading(true)
    try {
      const params = new URLSearchParams({ eventId, format })
      if (sessionId) params.append("sessionId", sessionId)

      const response = await fetch(`/api/download-transcriptions?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Download failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      const disposition = response.headers.get("content-disposition") || ""
      const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const rawFilename = filenameMatch?.[1]?.replace(/^["']|["']$/g, "")
      const safeFilename = rawFilename?.replace(/[^a-zA-Z0-9._-]/g, "_") || "transcriptions.txt"

      const a = document.createElement("a")
      a.href = url
      a.download = safeFilename
      a.rel = "noopener"
      a.target = "_blank"
      a.click()

      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Download error:", error)
      alert("Failed to download transcriptions")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-2" disabled={isDownloading}>
          <Download className="h-4 w-4" />
          {isDownloading ? "Downloading..." : "Download"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleDownload("txt")}>Text File (.txt)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload("json")}>JSON (.json)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
