import { NextResponse } from "next/server"
import { createThread } from "@/lib/ai-foundry-client"

export async function POST() {
  try {
    const threadId = await createThread()
    return NextResponse.json({ success: true, threadId: threadId }, { status: 201 })
  } catch (error) {
    console.error("[API] Thread creation error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create thread",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { threadId } = await request.json()
    if (!threadId) {
      return NextResponse.json({ success: false, error: "Missing threadId" }, { status: 400 })
    }

    const { deleteThread } = await import("@/lib/ai-foundry-client")
    await deleteThread(threadId)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[API] Thread delete error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete thread" },
      { status: 500 },
    )
  }
}
