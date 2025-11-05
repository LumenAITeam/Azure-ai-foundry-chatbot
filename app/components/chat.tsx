"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useChat } from "@/hooks/use-chat"
import { useThread } from "@/hooks/use-thread"
import { ThemeToggle } from "@/components/theme-toggle"

const QUICK_PROMPTS = [
  { label: "FAQ", text: "What common ticket issues can you help with?" },
  { label: "View Status", text: "What is the current status of my tickets?" },
  { label: "Get Help", text: "How do I submit a new ticket?" },
]

export default function Chat() {
  const { threadId, updateActivity, createNewThread } = useThread()
  const { messages, isLoading, error, sendMessage, clearError, clearMessages } = useChat()
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !threadId) return

    clearError()
    updateActivity()
    await sendMessage(inputValue, threadId)
    setInputValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e as unknown as React.FormEvent)
    }
  }

  const handleNewChat = async () => {
    clearError()
    clearMessages()
    await createNewThread()
  }

  return (
    <div className="chat-container">
      <header className="header">
        <div
          style={{
            maxWidth: "880px",
            margin: "0 auto",
            padding: "clamp(12px, 1.5vw, 16px) clamp(16px, 2vw, 24px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "clamp(18px, 1.5vw, 24px)", fontWeight: 600, color: "#ffffff", margin: 0 }}>
              Lumen Technologies
            </h1>
            <p style={{ fontSize: "12px", color: "#ffffff", margin: "4px 0 0 0" }}>TAIM Ticket Assistant</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handleNewChat}
              disabled={isLoading}
              className="btn secondary"
              aria-label="Start a new chat conversation"
              style={{
                backgroundColor: "#0f7570",
                color: "#ffffff",
                border: "2px solid #ffffff",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: isLoading ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              New Chat
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="transcript">
        {!threadId ? (
          <div style={{ textAlign: "center", padding: "clamp(16px, 5vw, 32px)", color: "var(--color-text-muted)" }}>
            <p style={{ fontSize: "14px" }}>Initializing chat...</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "clamp(16px, 5vw, 32px)" }}>
            <p
              style={{
                fontSize: "clamp(16px, 1.2vw, 18px)",
                fontWeight: 500,
                color: "var(--color-text)",
                margin: "0 0 8px 0",
              }}
            >
              How can we help?
            </p>
            <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
              Ask about your tickets or technical issues
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message-group ${message.role === "user" ? "user" : ""}`}>
              <div className={`bubble ${message.role}`}>
                <p style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: '"Arial", sans-serif' }}>
                  {message.content}
                </p>
              </div>
            </div>
          ))
        )}

        {isLoading && messages.length > 0 && (
          <div className="message-group">
            <div className="bubble assistant">
              <div className="loading-indicator">
                <span>Thinking</span>
                <span style={{ animation: "fadeInOut 1.5s ease-in-out infinite" }}>...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <div className="composer">
        {error && (
          <div
            style={{
              maxWidth: "880px",
              margin: "0 auto 12px",
              width: "100%",
              padding: "12px 14px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text)",
            }}
          >
            <p style={{ fontSize: "13px", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ maxWidth: "880px", margin: "0 auto", width: "100%" }}>
          {threadId && messages.length > 0 && !isLoading && (
            <div className="chips">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => setInputValue(prompt.text)}
                  className="chip"
                  aria-label={`Suggestion: ${prompt.label}`}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="composer-form">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask any questions about ticket IP RADAR TICKET NUMBER..."
              disabled={isLoading || !threadId}
              rows={1}
              className="composer-textarea"
              aria-label="Message input"
            />
            <button
              type="submit"
              disabled={isLoading || !threadId || !inputValue.trim()}
              className="btn primary"
              aria-label="Send message"
            >
              Send
            </button>
          </form>

          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "8px 0 0 0", textAlign: "center" }}>
            AI Generated. Please be cautious, sometimes may be incorrect. Contact Cloud Team for further assistance.
          </p>
        </div>
      </div>
    </div>
  )
}
