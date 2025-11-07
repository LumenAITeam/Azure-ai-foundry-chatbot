import { getAccessToken } from "./azure-auth"

const PROJECT_ENDPOINT = process.env.AZURE_PROJECT_ENDPOINT || ""
const API_VERSION = process.env.AZURE_API_VERSION || "2025-05-01"
const AGENT_ID = process.env.AZURE_AGENT_ID
const PROJECT_NAME = "IPCenter-Ticket-Bot"

if (!PROJECT_ENDPOINT || !AGENT_ID) {
  throw new Error("AZURE_PROJECT_ENDPOINT and AZURE_AGENT_ID required")
}

// ✅ FIX 1: Add retry logic for network failures
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Fetch] Attempt ${attempt + 1}/${maxRetries}: ${url}`)
      const response = await fetch(url, options)
      return response
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`[Fetch] Attempt ${attempt + 1} failed: ${msg}`)

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000
        console.log(`[Fetch] Retrying in ${delayMs}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      } else {
        throw error
      }
    }
  }
  throw new Error("All retry attempts exhausted")
}

async function callAzureAPI(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: object,
  queryParams?: Record<string, string>,
): Promise<any> {
  try {
    const token = await getAccessToken()
    const baseUrl = PROJECT_ENDPOINT.split("/api/")[0]
    const fullPath = `/api/projects/${PROJECT_NAME}${path}`

    let url = `${baseUrl}${fullPath}`
    const params = new URLSearchParams()

    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params.append(key, value)
      })
    }
    params.append("api-version", API_VERSION)
    url += `?${params.toString()}`

    console.log(`[API Client] ${method} ${url}`)

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    // ✅ FIX 2: Use retry logic
    const response = await fetchWithRetry(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      const errorMsg = errorText.substring(0, 500)
      throw new Error(
        `Azure API error (${response.status}): ${errorMsg}`
      )
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Network error"
    console.error(`[API Client] ${method} ${path}: ${msg}`)
    throw new Error(`Failed to call Azure API: ${msg}`)
  }
}

export async function createThread(): Promise<string> {
  try {
    const response = (await callAzureAPI("POST", "/threads", {})) as {
      id: string
    }
    return response.id
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create thread"
    console.error("[Thread Creation] Error:", msg)
    throw error
  }
}

export async function addMessage(
  threadId: string,
  content: string
): Promise<string> {
  try {
    const response = (await callAzureAPI(
      "POST",
      `/threads/${threadId}/messages`,
      {
        role: "user",
        content: content,
      }
    )) as { id: string }
    return response.id
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to add message"
    console.error("[Add Message] Error:", msg)
    throw error
  }
}

export async function createRun(threadId: string): Promise<string> {
  try {
    const response = (await callAzureAPI(
      "POST",
      `/threads/${threadId}/runs`,
      {
        assistant_id: AGENT_ID,
      }
    )) as { id: string }
    return response.id
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create run"
    console.error("[Create Run] Error:", msg)
    throw error
  }
}

export async function getRunStatus(
  threadId: string,
  runId: string
): Promise<{ status: string }> {
  try {
    const response = (await callAzureAPI(
      "GET",
      `/threads/${threadId}/runs/${runId}`
    )) as { status: string }
    return response
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to get run status"
    console.error("[Get Run Status] Error:", msg)
    throw error
  }
}

export async function getMessages(threadId: string): Promise<any[]> {
  try {
    const response = (await callAzureAPI(
      "GET",
      `/threads/${threadId}/messages`
    )) as { data: any[] }
    return response.data || []
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to get messages"
    console.error("[Get Messages] Error:", msg)
    throw error
  }
}

export async function deleteThread(threadId: string): Promise<void> {
  try {
    await callAzureAPI("DELETE", `/threads/${threadId}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete thread"
    console.error("[Delete Thread] Error:", msg)
    throw error
  }
}

export async function pollRunCompletion(
  threadId: string,
  runId: string,
  maxAttempts: number = 90,
  delayMs: number = 500
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await getRunStatus(threadId, runId)

      if (status.status === "completed") {
        console.log(`[Poll] Run completed at attempt ${i + 1}`)
        return
      }

      if (status.status === "failed" || status.status === "expired") {
        throw new Error(`Run ${status.status}: ${runId}`)
      }

      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw error
      }
    }
  }

  throw new Error(
    `Run polling timeout after ${(maxAttempts * delayMs) / 1000}s`
  )
}

export function extractAssistantMessage(messages: any[]): string {
  const assistantMessages = messages.filter((m) => m.role === "assistant")

  if (assistantMessages.length === 0) {
    return "No response from agent"
  }

  const latestMessage = assistantMessages[assistantMessages.length - 1]
  const textContent = latestMessage.content.find((c: any) => c.type === "text")
  return textContent?.text?.value || "No text content in response"
}
