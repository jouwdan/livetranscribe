"use client"

import { useRef, useEffect } from "react"

interface LiveTranscriptionDisplayProps {
  finalText: string
  interimText?: string
  className?: string
}

export function LiveTranscriptionDisplay({ finalText, interimText, className = "" }: LiveTranscriptionDisplayProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [finalText, interimText])

  return (
    <div className={className}>
      {!finalText && !interimText ? (
        <div className="flex items-center justify-center h-full text-slate-400">
          <p>Waiting for transcription to start...</p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-lg leading-relaxed text-slate-800">
            {finalText}
            {interimText && <span className="text-slate-400 italic animate-pulse"> {interimText}</span>}
          </p>
          <div ref={endRef} />
        </div>
      )}
    </div>
  )
}
