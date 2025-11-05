import type { NextRequest } from "next/server"
import { addMessage, createRun, pollRunCompletion, getMessages, extractAssistantMessage } from "@/lib/ai-foundry-client"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { threadId, content } = await request.json()

    if (!threadId || !content?.trim()) {
      return new Response("Invalid request", { status: 400 })
    }

    // Add message and create run
    await addMessage(threadId, content.trim())
    const runId = await createRun(threadId)
    await pollRunCompletion(threadId, runId)

    // Fetch messages
    const messages = await getMessages(threadId)
    const agentResponse = extractAssistantMessage(messages)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream response character by character with 1ms delay for natural feel
          for (let i = 0; i < agentResponse.length; i++) {
            const token = agentResponse[i]
            const data = `data: ${JSON.stringify({ token })}\n\n`
            controller.enqueue(encoder.encode(data))

            // Small delay between characters for streaming effect
            await new Promise((resolve) => setTimeout(resolve, 1))
          }

          controller.close()
        } catch (error) {
          controller.error(error)
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream error"
    return new Response(`data: ${JSON.stringify({ error: message })}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream" },
    })
  }
}
