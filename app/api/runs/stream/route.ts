import type { NextRequest } from "next/server"
import { addMessage, createRun, pollRunCompletion, getMessages, extractAssistantMessage } from "@/lib/ai-foundry-client"

export const maxDuration = 60

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { threadId, content } = body

    if (!threadId || !content?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing threadId or content" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Step 1: Add message (WITHOUT system prompt - it's set in Azure AI Foundry)
    try {
      await addMessage(threadId, content.trim())
    } catch (err) {
      console.error("Error adding message:", err)
      throw new Error(`Failed to add message: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Step 2: Create run
    let runId: string
    try {
      runId = await createRun(threadId)
      if (!runId) {
        throw new Error("No runId returned from createRun")
      }
    } catch (err) {
      console.error("Error creating run:", err)
      throw new Error(`Failed to create run: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Step 3: Poll for completion with timeout
    const startTime = Date.now()
    const maxWaitTime = 45000 // 45 seconds
    let attempts = 0

    while (Date.now() - startTime < maxWaitTime) {
      try {
        attempts++
        await pollRunCompletion(threadId, runId)
        break
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        
        if (errorMsg.includes("running") || errorMsg.includes("pending") || errorMsg.includes("queued")) {
          await sleep(500)
          continue
        }
        
        if (attempts % 10 === 0) {
          console.log(`Poll attempt ${attempts}, will retry...`)
        }
        
        await sleep(500)
      }
    }

    console.log(`Polling completed after ${attempts} attempts`)

    // Step 4: Get messages
    let messages: any[]
    try {
      messages = await getMessages(threadId)
      if (!messages || !Array.isArray(messages)) {
        throw new Error("Invalid messages format")
      }
    } catch (err) {
      console.error("Error getting messages:", err)
      throw new Error(`Failed to get messages: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Step 5: Extract response
    let agentResponse: string
    try {
      agentResponse = extractAssistantMessage(messages)
      if (!agentResponse || typeof agentResponse !== "string") {
        agentResponse = "I encountered an issue processing your request. Please try again."
      }
    } catch (err) {
      console.error("Error extracting message:", err)
      agentResponse = "I encountered an issue processing your request. Please try again."
    }

    // Step 6: Stream response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Split by words for natural streaming
          const words = agentResponse.split(' ')
          
          for (let i = 0; i < words.length; i++) {
            const word = i < words.length - 1 ? words[i] + ' ' : words[i]
            const data = `data: ${JSON.stringify({ token: word })}\n\n`
            
            try {
              controller.enqueue(encoder.encode(data))
            } catch (e) {
              console.error("Stream enqueue error:", e)
              break
            }

            // Streaming delay
            await sleep(12)
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          controller.close()
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown streaming error"
          console.error("Stream error:", errorMsg)
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`))
          } catch (e) {
            console.error("Failed to send error to stream")
          }
          controller.close()
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
    const errorMessage = error instanceof Error ? error.message : "Unknown server error"
    console.error("[Stream API Error]", errorMessage)

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
