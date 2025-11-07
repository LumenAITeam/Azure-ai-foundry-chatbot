import type { NextRequest } from "next/server"
import { addMessage, createRun, pollRunCompletion, getMessages, extractAssistantMessage } from "@/lib/ai-foundry-client"

export const maxDuration = 60

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random()}`
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { threadId, content } = body

    // Strict validation
    if (!threadId?.trim() || !content?.trim()) {
      console.warn(`[${requestId}] Validation failed: threadId=${!!threadId}, content=${!!content}`)
      return new Response(
        JSON.stringify({ error: "Missing or invalid threadId or content" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Sanitize inputs
    const sanitizedThreadId = threadId.trim()
    const sanitizedContent = content.trim().substring(0, 4000)

    console.log(`[${requestId}] Starting stream for thread: ${sanitizedThreadId}`)

    // Step 1: Add message with exponential backoff retry
    let messageId: string | null = null
    let attempts = 0
    const maxRetries = 3

    while (attempts < maxRetries && !messageId) {
      try {
        messageId = await addMessage(sanitizedThreadId, sanitizedContent)
        console.log(`[${requestId}] Message added: ${messageId}`)
        break
      } catch (err) {
        attempts++
        const error = err instanceof Error ? err.message : String(err)

        if (attempts < maxRetries) {
          console.warn(`[${requestId}] Retry ${attempts}/${maxRetries}: ${error}`)
          await sleep(1000 * attempts) // Exponential backoff: 1s, 2s, 3s
        } else {
          throw new Error(`Failed to add message after ${maxRetries} attempts: ${error}`)
        }
      }
    }

    // Step 2: Create run
    let runId: string
    try {
      runId = await createRun(sanitizedThreadId)
      if (!runId) {
        throw new Error("No runId returned from createRun")
      }
      console.log(`[${requestId}] Run created: ${runId}`)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to create run: ${error}`)
    }

    // Step 3: Poll with timeout
    try {
      await pollRunCompletion(sanitizedThreadId, runId)
      console.log(`[${requestId}] Run completed after ${Date.now() - startTime}ms`)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`[${requestId}] Poll error: ${error}`)
      throw new Error(`Polling timeout: ${error}`)
    }

    // Step 4: Get messages
    let messages: any[]
    try {
      messages = await getMessages(sanitizedThreadId)
      if (!Array.isArray(messages)) {
        throw new Error("Invalid messages format")
      }
      console.log(`[${requestId}] Retrieved ${messages.length} messages`)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to get messages: ${error}`)
    }

    // Step 5: Extract response
    let agentResponse: string
    try {
      agentResponse = extractAssistantMessage(messages)
      if (!agentResponse?.trim()) {
        agentResponse = "I encountered an issue processing your request. Please try again."
      }
    } catch (err) {
      agentResponse = "I encountered an issue processing your request. Please try again."
    }

    // Step 6: Stream response with word-level granularity
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const words = agentResponse.split(' ')

          for (let i = 0; i < words.length; i++) {
            const word = i < words.length - 1 ? words[i] + ' ' : words[i]
            const data = `data: ${JSON.stringify({ token: word })}\n\n`

            try {
              controller.enqueue(encoder.encode(data))
            } catch (e) {
              console.error(`[${requestId}] Stream enqueue error at word ${i}:`, e)
              break
            }

            await sleep(12) // 12ms delay per word for natural feel
          }

          // Completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          console.log(`[${requestId}] Stream completed in ${Date.now() - startTime}ms`)
          controller.close()
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error"
          console.error(`[${requestId}] Stream error: ${msg}`)
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
          } catch (e) {
            console.error(`[${requestId}] Failed to send error to stream`)
          }
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Request-ID": requestId,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown server error"
    console.error(`[Stream API Error] ${errorMessage}`)

    return new Response(
      `data: ${JSON.stringify({ error: errorMessage })}\n\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    )
  }
}
