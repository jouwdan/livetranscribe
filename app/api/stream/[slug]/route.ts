import type { NextRequest } from "next/server"
import type { ReadableStreamDefaultController } from "stream/web"

// In-memory store for active streams
const activeStreams = new Map<string, Set<ReadableStreamDefaultController>>()
const eventMetadata = new Map<string, { name: string; createdAt: string }>()

export const runtime = "edge"

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params

  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller: ReadableStreamDefaultController) {
      // Add this controller to the set of viewers for this event
      if (!activeStreams.has(slug)) {
        activeStreams.set(slug, new Set())
      }
      activeStreams.get(slug)!.add(controller)

      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", slug })}\n\n`))

      // Send event metadata if available
      const metadata = eventMetadata.get(slug)
      if (metadata) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "metadata", ...metadata })}\n\n`))
      }
    },
    cancel(controller: ReadableStreamDefaultController) {
      // Remove this controller when the connection closes
      const viewers = activeStreams.get(slug)
      if (viewers) {
        viewers.delete(controller)
        if (viewers.size === 0) {
          activeStreams.delete(slug)
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params

  try {
    const data = await request.json()
    const { text, isFinal, sequenceNumber, eventName } = data

    // Store event metadata
    if (eventName && !eventMetadata.has(slug)) {
      eventMetadata.set(slug, {
        name: eventName,
        createdAt: new Date().toISOString(),
      })
    }

    // Broadcast to all connected viewers
    const viewers = activeStreams.get(slug)
    if (viewers && viewers.size > 0) {
      const encoder = new TextEncoder()
      const message = JSON.stringify({
        type: "transcription",
        text,
        isFinal,
        sequenceNumber,
        timestamp: new Date().toISOString(),
      })

      viewers.forEach((controller) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch (error) {
          // Remove failed controllers
          viewers.delete(controller)
        }
      })
    }

    return Response.json({ success: true, viewerCount: viewers?.size || 0 })
  } catch (error) {
    console.error("[v0] Stream broadcast error:", error)
    return Response.json({ error: "Failed to broadcast" }, { status: 500 })
  }
}
