import { getAccessToken } from "./azure-auth"

export interface CreateThreadResponse {
  id: string
  created_at: string
  [key: string]: any
}

export interface AddMessageResponse {
  id: string
  thread_id: string
  role: string
  content: string
  created_at: string
}

export interface CreateRunResponse {
  id: string
  thread_id: string
  agent_id: string
  status: string
  created_at: string
}

export interface RunStatusResponse {
  id: string
  thread_id: string
  status: "in_progress" | "completed" | "failed" | "expired"
  [key: string]: any
}

export interface Message {
  id: string
  thread_id: string
  role: "user" | "assistant"
  content: Array<{
    type: "text"
    text?: {
      value: string
    }
  }>
  created_at: string
}

export interface MessagesResponse {
  data: Message[]
}

const PROJECT_ENDPOINT = process.env.AZURE_PROJECT_ENDPOINT || ""
const API_VERSION = process.env.AZURE_API_VERSION || "2025-05-01"
const AGENT_ID = process.env.AZURE_AGENT_ID
const PROJECT_NAME = "IPCenter-Ticket-Bot"

if (!PROJECT_ENDPOINT || !AGENT_ID) {
  throw new Error("AZURE_PROJECT_ENDPOINT and AZURE_AGENT_ID required in environment variables")
}

async function callAzureAPI(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: object,
  queryParams?: Record<string, string>,
): Promise<any> {
  const token = await getAccessToken()

  const baseUrl = PROJECT_ENDPOINT.split("/api/")[0]

  // Build the full path with project name
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

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error("AI Foundry API error (" + response.status + "): " + errorText)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function createThread(): Promise<string> {
  const response = (await callAzureAPI("POST", "/threads", {})) as CreateThreadResponse
  return response.id
}

export async function addMessage(threadId: string, content: string): Promise<string> {
  const response = (await callAzureAPI("POST", `/threads/${threadId}/messages`, {
    role: "user",
    content: content,
  })) as AddMessageResponse
  return response.id
}

export async function createRun(threadId: string): Promise<string> {
  const response = (await callAzureAPI("POST", `/threads/${threadId}/runs`, {
    assistant_id: AGENT_ID,
  })) as CreateRunResponse
  return response.id
}

export async function getRunStatus(threadId: string, runId: string): Promise<RunStatusResponse> {
  const response = (await callAzureAPI("GET", `/threads/${threadId}/runs/${runId}`)) as RunStatusResponse
  return response
}

export async function getMessages(threadId: string): Promise<Message[]> {
  const response = (await callAzureAPI("GET", `/threads/${threadId}/messages`)) as MessagesResponse
  return response.data || []
}

export async function deleteThread(threadId: string): Promise<void> {
  await callAzureAPI("DELETE", `/threads/${threadId}`)
}

export async function pollRunCompletion(
  threadId: string,
  runId: string,
  maxAttempts = 50,
  delayMs = 1000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getRunStatus(threadId, runId)

    if (status.status === "completed" || status.status === "failed" || status.status === "expired") {
      if (status.status !== "completed") {
        throw new Error("Run " + status.status + ": " + runId)
      }
      return
    }

    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new Error("Run polling timeout after " + maxAttempts + " attempts (" + (maxAttempts * delayMs) / 1000 + "s)")
}

export function extractAssistantMessage(messages: Message[]): string {
  const assistantMessages = messages.filter((m) => m.role === "assistant")

  if (assistantMessages.length === 0) {
    return "No response from agent"
  }

  const latestMessage = assistantMessages[0]
  const textContent = latestMessage.content.find((c) => c.type === "text")
  const responseText = textContent?.text?.value || "No text content in response"

  return responseText
}

export const aiFoundryClient = {
  createThread,
  addMessage,
  createRun,
  getRunStatus,
  getMessages,
  deleteThread,
  pollRunCompletion,
  extractAssistantMessage,
}
