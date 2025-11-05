"use client"

import { useState, useCallback } from "react"

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

  const clearError = useCallback(() => setError(null), [])

  const clearMessages = useCallback(() => {
    setMessages([])
    messageCounter = 0
  }, [])

  const sendMessage = useCallback(
    async (content: string, threadId: string) => {
      if (!content.trim() || !threadId) return

      try {
        clearError()
        setIsLoading(true)

        // Add user message immediately
        const userMessage: Message = {
          id: `msg-${messageCounter++}`,
          role: "user",
          content: content.trim(),
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, userMessage])

        // Create assistant message placeholder
        const assistantMessage: Message = {
          id: `msg-${messageCounter++}`,
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
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to get response")
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.token) {
                  setMessages((prev) =>
                    prev.map((msg, index) => {
                      if (index === prev.length - 1 && msg.role === "assistant") {
                        return { ...msg, content: msg.content + data.token }
                      }
                      return msg
                    }),
                  )
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send message"
        setError(message)
        // Remove assistant placeholder if error
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setIsLoading(false)
      }
    },
    [clearError],
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
