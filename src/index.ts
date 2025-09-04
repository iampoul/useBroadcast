"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { BroadcastChannel, createLeaderElection, LeaderElector } from "broadcast-channel"

export interface TabInfo {
  id: string
  isLeader: boolean
  lastSeen: number
}

export interface BroadcastOptions {
  channelName: string
  heartbeatInterval?: number
  staleThreshold?: number
}

export interface BroadcastHook {
  tabId: string
  isLeader: boolean
  connectedTabs: TabInfo[]
  serverConnected: boolean
  setServerConnected: (isConnected: boolean) => void
  broadcast: (type: string, payload?: any) => void
  sendToLeader: (type: string, payload: any) => void
  registerMessageHandler: (type: string, handler: (payload: any) => void) => () => void
}

export function useBroadcast(options: BroadcastOptions): BroadcastHook {
  const { channelName, heartbeatInterval = 1000, staleThreshold = 3000 } = options

  const [tabId] = useState(() => Math.random().toString(36).substr(2, 9))
  const [isLeader, setIsLeader] = useState(false)
  const [connectedTabs, setConnectedTabs] = useState<TabInfo[]>([])
  const [serverConnected, setServerConnected] = useState(false)

  const channelRef = useRef<BroadcastChannel | null>(null)
  const electorRef = useRef<LeaderElector | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messageHandlersRef = useRef<Map<string, (payload: any) => void>>(new Map())

  const broadcast = useCallback(
    (type: string, payload?: any) => {
      channelRef.current?.postMessage({
        type,
        senderId: tabId,
        ts: Date.now(),
        payload,
      })
    },
    [tabId],
  )

  const sendToLeader = useCallback(
    (type: string, payload: any) => {
      broadcast("message_to_leader", { messageType: type, payload })
    },
    [broadcast],
  )

  const registerMessageHandler = useCallback((type: string, handler: (payload: any) => void) => {
    messageHandlersRef.current.set(type, handler)
    return () => messageHandlersRef.current.delete(type)
  }, [])

  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel(channelName)
      electorRef.current = createLeaderElection(channelRef.current)
    } catch (e) {
      console.error("BroadcastChannel is not supported in this environment.")
      // Provide a fallback to localStorage
      // This is a simplified implementation and doesn't support all features
      const listeners = new Map<string, (event: StorageEvent) => void>()
      channelRef.current = {
        postMessage: (data: any) => {
          localStorage.setItem(channelName, JSON.stringify(data))
        },
        addEventListener: (type: string, listener: any) => {
          const storageListener = (event: StorageEvent) => {
            if (event.key === channelName && event.newValue) {
              listener({ data: JSON.parse(event.newValue) })
            }
          }
          window.addEventListener("storage", storageListener)
          listeners.set(type, storageListener)
        },
        removeEventListener: (type: string) => {
          const storageListener = listeners.get(type)
          if (storageListener) {
            window.removeEventListener("storage", storageListener)
          }
        },
        close: () => {
          listeners.forEach((listener) => {
            window.removeEventListener("storage", listener)
          })
        },
      } as any
    }

    setConnectedTabs([{ id: tabId, isLeader: false, lastSeen: Date.now() }])

    const handleMessage = (event: MessageEvent) => {
      const { type, senderId, ts, payload } = event.data

      if (senderId === tabId) return // Ignore messages from self

      // Update last seen time for the sender
      setConnectedTabs(prev => {
        const now = Date.now()
        const cleanedTabs = prev.filter(t => now - t.lastSeen < staleThreshold)
        const existing = cleanedTabs.find(t => t.id === senderId)
        if (existing) {
          return cleanedTabs.map(t => t.id === senderId ? { ...t, lastSeen: ts } : t)
        } else {
          return [...cleanedTabs, { id: senderId, isLeader: false, lastSeen: ts }]
        }
      })

      switch (type) {
        case "leader_elected":
          setIsLeader(false) // Another tab became leader
          setConnectedTabs(prev => prev.map(t => ({ ...t, isLeader: t.id === payload.leaderId })))
          break

        case "message_to_leader":
          if (isLeader) {
            const handler = messageHandlersRef.current.get(payload.messageType)
            if (handler) {
              handler(payload.payload)
            }
          }
          break

        case "heartbeat":
          // Already handled above
          break

        case "tab_left":
          setConnectedTabs(prev => prev.filter(t => t.id !== senderId))
          break

        default:
          const handler = messageHandlersRef.current.get(type)
          if (handler) {
            handler(payload)
          }
          break
      }
    }

    channelRef.current?.addEventListener("message", handleMessage)

    const elector = electorRef.current
    if (elector) {
      elector.awaitLeadership().then(() => {
        setIsLeader(true)
        broadcast("leader_elected", { leaderId: tabId })
        setConnectedTabs(prev => prev.map(t => ({ ...t, isLeader: t.id === tabId })))
      })
    }

    const handleBeforeUnload = () => {
      broadcast("tab_left")
      elector?.die()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    // Set up heartbeat
    heartbeatRef.current = setInterval(() => {
      broadcast("heartbeat")
    }, heartbeatInterval)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (channelRef.current) {
        channelRef.current.removeEventListener("message", handleMessage)
        channelRef.current.close()
      }
      elector?.die()
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [channelName, tabId, heartbeatInterval, staleThreshold, broadcast, isLeader])

  return {
    tabId,
    isLeader,
    connectedTabs,
    serverConnected,
    setServerConnected,
    broadcast,
    sendToLeader,
    registerMessageHandler,
  }
}
