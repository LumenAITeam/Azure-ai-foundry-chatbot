"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export function useThread() {
  const [threadId, setThreadId] = useState<string | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Create new thread on mount
  useEffect(() => {
    const initThread = async () => {
      try {
        const response = await fetch("/api/threads", { method: "POST" })
        const data = await response.json()
        if (data.success) {
          setThreadId(data.threadId)
          lastActivityRef.current = Date.now()
        }
      } catch (err) {
        // Silent fail - user will see "Initializing chat..." message
      }
    }

    initThread()
  }, [])

  // Setup idle timeout
  useEffect(() => {
    if (!threadId) return

    const checkIdle = () => {
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed > IDLE_TIMEOUT) {
        deleteCurrentThread()
      }
    }

    idleTimerRef.current = setInterval(checkIdle, 30000) // Check every 30 seconds

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    }
  }, [threadId])

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  const deleteCurrentThread = useCallback(async () => {
    if (!threadId) return
    try {
      await fetch("/api/chats", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      })
    } catch (err) {
      // Silent fail
    }
    setThreadId(null)
  }, [threadId])

  const createNewThread = useCallback(async () => {
    // Delete old thread if exists
    if (threadId) {
      await deleteCurrentThread()
    }

    try {
      const response = await fetch("/api/threads", { method: "POST" })
      const data = await response.json()
      if (data.success) {
        setThreadId(data.threadId)
        lastActivityRef.current = Date.now()
      }
    } catch (err) {
      // Silent fail
    }
  }, [threadId, deleteCurrentThread])

  return {
    threadId,
    updateActivity,
    createNewThread,
    deleteCurrentThread,
  }
}
