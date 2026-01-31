"use client"

import { useRef, useEffect, useMemo, useCallback, memo } from "react"

interface Transcription {
  text: string
  timestamp: string
  isFinal: boolean
}

interface LiveTranscriptionDisplayProps {
  transcriptions: Transcription[]
  interimText?: string
  className?: string
}

// Memoized transcription group component for better performance
const TranscriptionGroup = memo(function TranscriptionGroup({
  timestamp,
  texts,
}: {
  timestamp: string
  texts: string[]
}) {
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts)
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
        {formatTimestamp(timestamp)}
      </div>
      <p className="text-lg leading-relaxed text-white">{texts.join(" ")}</p>
    </div>
  )
})

// Memoized interim text component with smooth animation
const InterimText = memo(function InterimText({ text }: { text: string }) {
  return (
    <p className="text-lg leading-relaxed text-foreground/60 italic">
      {text}
      <span className="inline-block w-0.5 h-5 ml-1 bg-foreground/60 animate-pulse" />
    </p>
  )
})

export function LiveTranscriptionDisplay({
  transcriptions,
  interimText,
  className = "",
}: LiveTranscriptionDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  // Smooth scroll function using requestAnimationFrame
  const smoothScrollToBottom = useCallback(() => {
    if (!containerRef.current || isScrollingRef.current) return

    const container = containerRef.current
    const targetScrollTop = container.scrollHeight - container.clientHeight

    // Check if already at bottom
    if (Math.abs(container.scrollTop - targetScrollTop) < 5) return

    isScrollingRef.current = true
    const startScrollTop = container.scrollTop
    const distance = targetScrollTop - startScrollTop
    const duration = 200 // ms
    let startTime: number | null = null

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3)

      container.scrollTop = startScrollTop + distance * easeOut

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        isScrollingRef.current = false
      }
    }

    requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    // Use requestAnimationFrame for smoother scroll timing
    const frameId = requestAnimationFrame(() => {
      smoothScrollToBottom()
    })
    return () => cancelAnimationFrame(frameId)
  }, [transcriptions, interimText, smoothScrollToBottom])

  const groupedTranscriptions = useMemo(() => {
    const sortedTranscriptions = [...transcriptions].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    })

    return sortedTranscriptions.reduce(
      (acc, curr, index) => {
        if (index === 0) {
          acc.push({
            timestamp: curr.timestamp,
            texts: [curr.text],
          })
        } else {
          const prevTimestamp = new Date(sortedTranscriptions[index - 1].timestamp).getTime()
          const currTimestamp = new Date(curr.timestamp).getTime()
          const timeDiff = (currTimestamp - prevTimestamp) / 1000 // in seconds

          if (timeDiff > 8) {
            // Reduced from 10s to 8s for better grouping
            acc.push({
              timestamp: curr.timestamp,
              texts: [curr.text],
            })
          } else {
            // Continue in current group
            acc[acc.length - 1].texts.push(curr.text)
          }
        }
        return acc
      },
      [] as Array<{ timestamp: string; texts: string[] }>,
    )
  }, [transcriptions])

  if (transcriptions.length === 0 && !interimText) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full text-foreground/40">
          <p>Waiting for transcription to start...</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`overflow-y-auto scroll-smooth ${className}`}>
      <div className="space-y-6">
        {groupedTranscriptions.map((group, index) => (
          <TranscriptionGroup
            key={`${group.timestamp}-${index}`}
            timestamp={group.timestamp}
            texts={group.texts}
          />
        ))}
        {interimText && <InterimText text={interimText} />}
        <div ref={endRef} />
      </div>
    </div>
  )
}
