"use client"

import { useRef, useEffect, useMemo } from "react"

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

export function LiveTranscriptionDisplay({
  transcriptions,
  interimText,
  className = "",
}: LiveTranscriptionDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll within the container only, not affecting page scroll
    if (containerRef.current && endRef.current) {
      const container = containerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [transcriptions, interimText])

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

          if (timeDiff > 10) {
            // More than 10 seconds gap, start new group with timestamp
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

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
    <div ref={containerRef} className={`overflow-y-auto ${className}`}>
      <div className="space-y-6">
        {groupedTranscriptions.map((group, index) => (
          <div key={index} className="space-y-2">
            <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
              {formatTimestamp(group.timestamp)}
            </div>
            <p className="text-lg leading-relaxed text-white">{group.texts.join(" ")}</p>
          </div>
        ))}
        {interimText && (
          <p className="text-lg leading-relaxed text-foreground/50 italic animate-pulse">{interimText}</p>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
