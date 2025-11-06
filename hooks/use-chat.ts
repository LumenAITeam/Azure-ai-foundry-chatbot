"use client"

import { useState, useCallback, useRef } from "react"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export interface UseChatReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string, threadId: string) => Promise<void>
  clearError: () => void
  clearMessages: () => void
}

let messageCounter = 0

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const clearMessages = useCallback(() => {
    setMessages([])
    messageCounter = 0
  }, [])

  const sendMessage = useCallback(
    async (content: string, threadId: string) => {
      if (!content.trim() || !threadId || isLoading) return

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      try {
        clearError()
        setIsLoading(true)

        // Add user message immediately
        const userMessage: Message = {
          id: `msg-${messageCounter++}-${Date.now()}`,
          role: "user",
          content: content.trim(),
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, userMessage])

        // Create assistant message placeholder
        const assistantMessage: Message = {
          id: `msg-${messageCounter++}-${Date.now()}`,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Stream response
        const response = await fetch("/api/runs/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, content: content.trim() }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          let errorData
          try {
            errorData = await response.json()
          } catch {
            errorData = { error: `Server error: ${response.status} ${response.statusText}` }
          }
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.token) {
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    const lastIndex = newMessages.length - 1
                    if (lastIndex >= 0 && newMessages[lastIndex].role === "assistant") {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        content: newMessages[lastIndex].content + data.token,
                      }
                    }
                    return newMessages
                  })
                } else if (data.error) {
                  throw new Error(data.error)
                } else if (data.done) {
                  // Stream completed
                  break
                }
              } catch (e) {
                if (e instanceof SyntaxError) {
                  // Skip malformed JSON silently
                  continue
                }
                if (e instanceof Error) {
                  throw e
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return // Request was cancelled
        }
        const message = err instanceof Error ? err.message : "Failed to send message"
        console.error("Chat error:", message)
        setError(message)
        // Remove assistant placeholder if error
        setMessages((prev) => prev.filter((msg) => msg.content !== "" || msg.role !== "assistant"))
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [isLoading, clearError]
  )

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
    clearMessages,
  }
}
