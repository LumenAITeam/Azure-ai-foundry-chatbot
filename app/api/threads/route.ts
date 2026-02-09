/* istanbul ignore file */
import { NextResponse } from "next/server"
import { createThread, deleteThread } from "@/lib/ai-foundry-client"

const requestCounts = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0] || "unknown"
}

function checkRateLimit(key: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const current = requestCounts.get(key)

  if (!current || now > current.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= limit) return false
  current.count++
  return true
}

export async function POST(request: Request) {
  const key = getRateLimitKey(request)
  const startTime = Date.now()

  if (!checkRateLimit(key, 10, 60000)) {
    console.warn(`[Threads API] Rate limit exceeded from ${key}`)
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Max 10 threads per minute." },
      { status: 429 }
    )
  }

  try {
    console.log(`[Threads API] Creating new thread from ${key}`)
    
    const threadId = await createThread()

    if (!threadId) {
      throw new Error("No threadId returned from createThread")
    }

    const duration = Date.now() - startTime
    console.log(
      `[Threads API] ✅ Thread created: ${threadId} (${duration}ms)`
    )

    return NextResponse.json(
      { success: true, threadId },
      { status: 201 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    const msg = error instanceof Error ? error.message : "Unknown error"
    
    console.error(
      `[Threads API] ❌ Creation error (${duration}ms): ${msg}`
    )

    // Check for specific error types
    if (msg.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to connect to Azure AI Foundry. Check credentials and network.",
        },
        { status: 503 }
      )
    }

    if (msg.includes("Token")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed. Check Azure credentials.",
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { threadId } = body

    if (!threadId?.trim()) {
      console.warn("[Threads API] Missing threadId in DELETE request")
      return NextResponse.json(
        { success: false, error: "Missing threadId" },
        { status: 400 }
      )
    }

    const sanitizedThreadId = threadId.trim()
    console.log(`[Threads API] Deleting thread: ${sanitizedThreadId}`)

    await deleteThread(sanitizedThreadId)

    const duration = Date.now() - startTime
    console.log(
      `[Threads API] ✅ Thread deleted: ${sanitizedThreadId} (${duration}ms)`
    )

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    const duration = Date.now() - startTime
    const msg = error instanceof Error ? error.message : "Unknown error"
    
    console.error(
      `[Threads API] ❌ Deletion error (${duration}ms): ${msg}`
    )

    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
