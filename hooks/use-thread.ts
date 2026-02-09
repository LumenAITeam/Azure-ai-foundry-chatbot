/* istanbul ignore file */
"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const IDLE_TIMEOUT = 45 * 60 * 1000 // 45 minutes

export function useThread() {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const lastActivityRef = useRef<number>(Date.now())
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initInProgressRef = useRef(false)

  // Create thread on mount
  useEffect(() => {
    const initThread = async () => {
      if (initInProgressRef.current || threadId) return

      initInProgressRef.current = true
      setIsInitializing(true)

      try {
        const response = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) throw new Error("Failed to create thread")

        const data = await response.json()
        if (data.success && data.threadId) {
          setThreadId(data.threadId)
          lastActivityRef.current = Date.now()
          console.log(`[Thread] Initialized: ${data.threadId}`)
        } else {
          throw new Error(data.error || "No threadId in response")
        }
      } catch (err) {
        console.error("[Thread] Initialization error:", err)
      } finally {
        setIsInitializing(false)
        initInProgressRef.current = false
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
        console.log(`[Thread] Idle timeout for ${threadId}`)
        deleteCurrentThread()
      }
    }

    idleTimerRef.current = setInterval(checkIdle, 60000)

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
      console.log(`[Thread] Deleting: ${threadId}`)
      const response = await fetch("/api/threads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      })

      if (!response.ok) {
        console.warn(`[Thread] Delete failed: ${response.status}`)
      }
    } catch (err) {
      console.error("[Thread] Deletion error:", err)
    }

    setThreadId(null)
  }, [threadId])

  const createNewThread = useCallback(async () => {
    if (threadId) {
      await deleteCurrentThread()
    }

    setIsInitializing(true)
    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to create thread")

      const data = await response.json()
      if (data.success && data.threadId) {
        setThreadId(data.threadId)
        lastActivityRef.current = Date.now()
        console.log(`[Thread] New thread created: ${data.threadId}`)
      } else {
        throw new Error(data.error || "No threadId returned")
      }
    } catch (err) {
      console.error("[Thread] New thread creation error:", err)
    } finally {
      setIsInitializing(false)
    }
  }, [threadId, deleteCurrentThread])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current)
      }
    }
  }, [])

  return {
    threadId,
    updateActivity,
    createNewThread,
    deleteCurrentThread,
    isInitializing,
  }
}
