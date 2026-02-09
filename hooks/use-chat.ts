/* istanbul ignore file */
"use client"

import { useState, useCallback, useRef, useEffect } from "react"

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

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

        // Add user message
        const userMessage: Message = {
          id: `msg-${messageCounter++}-${Date.now()}`,
          role: "user",
          content: content.trim(),
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, userMessage])

        // Add assistant placeholder
        const assistantMessage: Message = {
          id: `msg-${messageCounter++}-${Date.now()}`,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Set request timeout (90 seconds)
        timeoutRef.current = setTimeout(() => {
          abortControllerRef.current?.abort()
        }, 90000)

        // Stream response
        const response = await fetch("/api/runs/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, content: content.trim() }),
          signal: abortControllerRef.current.signal,
        })

        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        if (!response.ok) {
          let errorData
          try {
            const text = await response.text()
            errorData = JSON.parse(text.replace(/^data: /, ""))
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
                  break
                }
              } catch (e) {
                if (!(e instanceof SyntaxError)) {
                  if (e instanceof Error) throw e
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError("Request timed out. Please try again.")
          return
        }

        const message = err instanceof Error ? err.message : "Failed to send message"
        console.error("Chat error:", message)
        setError(message)

        // Remove empty assistant placeholder on error
        setMessages((prev) =>
          prev.filter((msg) => !(msg.role === "assistant" && !msg.content))
        )
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
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


// just fake commit