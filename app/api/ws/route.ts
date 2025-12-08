export const dynamic = "force-dynamic"

const clients = new Map<string, Set<any>>()

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get("slug")
  const role = url.searchParams.get("role") // 'broadcaster' or 'viewer'

  if (!slug) {
    return new Response("Missing slug", { status: 400 })
  }

  console.log(`[WS] ${role} connecting to ${slug}`)

  const stream = new ReadableStream({
    start(controller: any) {
      // Add viewer to clients
      if (role === "viewer") {
        if (!clients.has(slug)) {
          clients.set(slug, new Set())
        }
        clients.get(slug)!.add(controller)
        console.log(`[WS] Viewer added. Total viewers for ${slug}: ${clients.get(slug)!.size}`)

        // Send initial connection message
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`))
      }
    },
    cancel(controller: any) {
      if (role === "viewer" && clients.has(slug)) {
        clients.get(slug)!.delete(controller)
        console.log(`[WS] Viewer disconnected. Remaining viewers for ${slug}: ${clients.get(slug)!.size}`)
        if (clients.get(slug)!.size === 0) {
          clients.delete(slug)
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { slug, text, isFinal, sequenceNumber } = data

    console.log(`[WS] Broadcasting to ${slug}:`, { text, isFinal, sequenceNumber })

    const viewerControllers = clients.get(slug)
    if (!viewerControllers || viewerControllers.size === 0) {
      console.log(`[WS] No viewers connected for ${slug}`)
      return Response.json({ success: false, viewerCount: 0 })
    }

    const encoder = new TextEncoder()
    const message = `data: ${JSON.stringify({ text, isFinal, sequenceNumber, timestamp: new Date().toISOString() })}\n\n`
    const encoded = encoder.encode(message)

    let successCount = 0
    for (const controller of viewerControllers) {
      try {
        controller.enqueue(encoded)
        successCount++
      } catch (error) {
        console.error("[WS] Failed to send to viewer:", error)
        viewerControllers.delete(controller)
      }
    }

    console.log(`[WS] Sent to ${successCount}/${viewerControllers.size} viewers`)

    return Response.json({ success: true, viewerCount: successCount })
  } catch (error) {
    console.error("[WS] Broadcast error:", error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
