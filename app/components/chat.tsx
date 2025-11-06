"use client"

import type React from "react"
import { useState, useRef, useEffect, memo } from "react"
import ReactMarkdown from "react-markdown"
import { useChat } from "@/hooks/use-chat"
import { useThread } from "@/hooks/use-thread"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"

const QUICK_PROMPTS = [
  { label: "FAQ", text: "What common ticket issues can you help with?" },
  { label: "View Status", text: "What is the current status of my tickets?" },
  { label: "Get Help", text: "How do I submit a new ticket?" },
]

// Memoized message component for better performance
const MessageBubble = memo(({ message }: { message: any }) => {
  const isUser = message.role === "user"
  
  return (
    <div className={`message-group ${isUser ? "user" : ""}`}>
      <div className={`bubble ${message.role}`}>
        <div className="bubble-content">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p>{children}</p>,
              ul: ({ children }) => <ul>{children}</ul>,
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => <strong>{children}</strong>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
})

MessageBubble.displayName = "MessageBubble"

export default function Chat() {
  const { threadId, updateActivity, createNewThread } = useThread()
  const { messages, isLoading, error, sendMessage, clearError, clearMessages } = useChat()
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [inputValue])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !threadId || isLoading) return

    clearError()
    updateActivity()
    await sendMessage(inputValue.trim(), threadId)
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

  const handleQuickPrompt = (text: string) => {
    setInputValue(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="chat-container">
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            <Image
              src="https://ironshieldnetworks.com/wp-content/uploads/2021/12/white-Lumen-logo.png"
              alt="Lumen Technologies"
              width={100}
              height={28}
              priority
              style={{ objectFit: "contain" }}
            />
            <div className="header-subtitle">TAIM Ticket Assistant</div>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            <button
              onClick={handleNewChat}
              disabled={isLoading}
              className="btn secondary"
              aria-label="Start a new chat conversation"
            >
              New Chat
            </button>
          </div>
        </div>
      </header>

      <main className="transcript">
        {!threadId ? (
          <div className="empty-state">
            <p className="empty-state-text">Initializing chat...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="welcome-state">
            <p className="welcome-title">How can we help?</p>
            <p className="welcome-subtitle">Ask about your tickets or technical issues</p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {isLoading && messages.length > 0 && (
          <div className="message-group">
            <div className="bubble assistant">
              <div className="loading-indicator">
                <span>Thinking</span>
                <span className="loading-dots">...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <div className="composer">
        {error && (
          <div className="error-banner">
            <p className="error-text">{error}</p>
          </div>
        )}

        <div className="composer-inner">
          {threadId && messages.length > 0 && !isLoading && (
            <div className="chips">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => handleQuickPrompt(prompt.text)}
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
              ref={textareaRef}
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

          <p className="disclaimer">
            AI Generated. Please be cautious, sometimes may be incorrect. Contact Cloud Team for further assistance.
          </p>
        </div>
      </div>
    </div>
  )
}
