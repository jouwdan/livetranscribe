import type { NextRequest } from "next/server"

const global = globalThis as typeof globalThis & {
  streamControllers?: Map<string, Set<ReadableStreamDefaultController>>
  eventMetadata?: Map<string, { name: string; createdAt: string }>
}

if (!global.streamControllers) {
  global.streamControllers = new Map()
}
if (!global.eventMetadata) {
  global.eventMetadata = new Map()
}

const activeStreams = global.streamControllers
const eventMetadata = global.eventMetadata

export const runtime = "edge"

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  console.log("[v0] New viewer connecting to stream:", slug)

  let streamController: ReadableStreamDefaultController | null = null

  const stream = new ReadableStream({
    start(controller: ReadableStreamDefaultController) {
      console.log("[v0] Viewer stream started for:", slug)

      streamController = controller

      if (!activeStreams.has(slug)) {
        activeStreams.set(slug, new Set())
      }
      activeStreams.get(slug)!.add(controller)
      console.log("[v0] Total viewers for", slug, ":", activeStreams.get(slug)!.size)

      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", slug })}\n\n`))

      const metadata = eventMetadata.get(slug)
      if (metadata) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "metadata", ...metadata })}\n\n`))
      }

      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`))
        } catch (error) {
          clearInterval(keepAliveInterval)
        }
      }, 15000)

      // Store interval for cleanup
      ;(controller as any).keepAliveInterval = keepAliveInterval
    },
    cancel() {
      console.log("[v0] Viewer disconnecting from:", slug)

      if (streamController && (streamController as any).keepAliveInterval) {
        clearInterval((streamController as any).keepAliveInterval)
      }

      const viewers = activeStreams.get(slug)
      if (viewers && streamController) {
        viewers.delete(streamController)
        console.log("[v0] Remaining viewers for", slug, ":", viewers.size)
        if (viewers.size === 0) {
          activeStreams.delete(slug)
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  console.log("[v0] Received broadcast request for:", slug)

  try {
    const data = await request.json()
    const { text, isFinal, sequenceNumber, eventName } = data

    console.log("[v0] Broadcasting transcription:", { text, isFinal, sequenceNumber, slug })

    if (eventName && !eventMetadata.has(slug)) {
      eventMetadata.set(slug, {
        name: eventName,
        createdAt: new Date().toISOString(),
      })
      console.log("[v0] Stored event metadata for:", slug)
    }

    const viewers = activeStreams.get(slug)
    console.log("[v0] Current viewers for", slug, ":", viewers?.size || 0)
    console.log("[v0] All active streams:", Array.from(activeStreams.keys()))

    if (viewers && viewers.size > 0) {
      const encoder = new TextEncoder()
      const message = JSON.stringify({
        type: "transcription",
        text,
        isFinal,
        sequenceNumber,
        timestamp: new Date().toISOString(),
      })

      console.log("[v0] Sending message to", viewers.size, "viewers:", message)

      let successCount = 0
      const failedControllers: ReadableStreamDefaultController[] = []

      viewers.forEach((viewerController) => {
        try {
          viewerController.enqueue(encoder.encode(`data: ${message}\n\n`))
          successCount++
          console.log("[v0] Successfully sent to viewer")
        } catch (error) {
          console.error("[v0] Failed to send to viewer:", error)
          failedControllers.push(viewerController)
        }
      })

      // Clean up failed controllers
      failedControllers.forEach((controller) => viewers.delete(controller))

      console.log("[v0] Broadcast complete:", successCount, "successful,", failedControllers.length, "failed")

      return Response.json({ success: true, viewerCount: successCount })
    } else {
      console.log("[v0] No viewers connected to receive broadcast")
    }

    return Response.json({ success: true, viewerCount: 0 })
  } catch (error) {
    console.error("[v0] Stream broadcast error:", error)
    return Response.json({ error: "Failed to broadcast", details: String(error) }, { status: 500 })
  }
}
