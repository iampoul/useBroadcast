"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export interface TabInfo {
  id: string
  isLeader: boolean
  lastSeen: number
}

export interface BroadcastOptions {
  channelName: string
  heartbeatInterval?: number
  leaderCheckInterval?: number
  staleThreshold?: number
}

export interface BroadcastHook {
  tabId: string
  isLeader: boolean
  connectedTabs: TabInfo[]
  serverConnected: boolean
  broadcast: (type: string, data?: any) => void
  sendToLeader: (type: string, data: any) => void
}

export function useBroadcast(options: BroadcastOptions): BroadcastHook {
  const { channelName, heartbeatInterval = 1000, leaderCheckInterval = 1500, staleThreshold = 3000 } = options

  const [tabId] = useState(() => Math.random().toString(36).substr(2, 9))
  const [isLeader, setIsLeader] = useState(false)
  const [connectedTabs, setConnectedTabs] = useState<TabInfo[]>([])
  const [serverConnected, setServerConnected] = useState(false)

  const channelRef = useRef<BroadcastChannel | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const leaderCheckRef = useRef<NodeJS.Timeout | null>(null)
  const messageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map())

  const electLeader = useCallback(() => {
    const now = Date.now()

    setConnectedTabs((prev) => {
      // Remove stale tabs
      const activeTabs = prev.filter((tab) => now - tab.lastSeen < staleThreshold)

      const currentTabIndex = activeTabs.findIndex((tab) => tab.id === tabId)
      if (currentTabIndex >= 0) {
        activeTabs[currentTabIndex].lastSeen = now
      } else {
        activeTabs.push({ id: tabId, isLeader: false, lastSeen: now })
      }

      // Check if we need a new leader
      const currentLeader = activeTabs.find((tab) => tab.isLeader)

      if (!currentLeader && activeTabs.length > 0) {
        // Elect leader (lowest tabId wins for deterministic election)
        const sortedTabs = [...activeTabs].sort((a, b) => a.id.localeCompare(b.id))
        const newLeaderId = sortedTabs[0].id

        // Broadcast leader election
        channelRef.current?.postMessage({
          type: "leader_elected",
          tabId,
          leaderId: newLeaderId,
          timestamp: now,
        })

        const updatedTabs = activeTabs.map((tab) => ({
          ...tab,
          isLeader: tab.id === newLeaderId,
        }))

        const amILeader = tabId === newLeaderId
        setIsLeader(amILeader)
        setServerConnected(amILeader)

        return updatedTabs
      }

      return activeTabs
    })
  }, [tabId, staleThreshold])

  const broadcast = useCallback(
    (type: string, data?: any) => {
      channelRef.current?.postMessage({
        type,
        tabId,
        timestamp: Date.now(),
        ...data,
      })
    },
    [tabId],
  )

  const sendToLeader = useCallback(
    (type: string, data: any) => {
      broadcast("message_to_leader", { messageType: type, data })
    },
    [broadcast],
  )

  const registerMessageHandler = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlersRef.current.set(type, handler)
    return () => messageHandlersRef.current.delete(type)
  }, [])

  useEffect(() => {
    channelRef.current = new BroadcastChannel(channelName)

    setConnectedTabs([{ id: tabId, isLeader: false, lastSeen: Date.now() }])

    const handleMessage = (event: MessageEvent) => {
      const { type, tabId: senderTabId, timestamp, leaderId, messageType, data } = event.data

      switch (type) {
        case "tab_announce":
          setConnectedTabs((prev) => {
            const existing = prev.find((tab) => tab.id === senderTabId)
            if (existing) {
              return prev.map((tab) => (tab.id === senderTabId ? { ...tab, lastSeen: timestamp } : tab))
            }
            return [...prev, { id: senderTabId, isLeader: false, lastSeen: timestamp }]
          })
          break

        case "leader_elected":
          if (senderTabId !== tabId) {
            // Only process leader elections from other tabs to avoid conflicts
            const amILeader = tabId === leaderId
            setIsLeader(amILeader)
            setServerConnected(amILeader)
            setConnectedTabs((prev) =>
              prev.map((tab) => ({
                ...tab,
                isLeader: tab.id === leaderId,
              })),
            )
          }
          break

        case "message_to_leader":
          // Check if current tab is leader and handle the message
          setConnectedTabs((currentTabs) => {
            const currentLeader = currentTabs.find((tab) => tab.id === tabId && tab.isLeader)
            if (currentLeader && messageType) {
              const handler = messageHandlersRef.current.get(messageType)
              if (handler) {
                handler(data)
              }
            }
            return currentTabs
          })
          break

        case "heartbeat":
          setConnectedTabs((prev) => {
            const existing = prev.find((tab) => tab.id === senderTabId)
            if (existing) {
              return prev.map((tab) => (tab.id === senderTabId ? { ...tab, lastSeen: timestamp } : tab))
            }
            return [...prev, { id: senderTabId, isLeader: false, lastSeen: timestamp }]
          })
          break

        case "request_status":
          // Respond with current status
          broadcast("tab_announce")
          break

        default:
          // Handle custom message types
          const handler = messageHandlersRef.current.get(type)
          if (handler) {
            handler(event.data)
          }
          break
      }
    }

    channelRef.current.addEventListener("message", handleMessage)

    const announcePresence = () => {
      broadcast("request_status")
      setTimeout(() => {
        broadcast("tab_announce")
      }, 100)
    }



    announcePresence()

    // Set up heartbeat
    heartbeatRef.current = setInterval(() => {
      broadcast("heartbeat")
    }, heartbeatInterval)

    // Set up leader election check
    leaderCheckRef.current = setInterval(() => {
      electLeader()
    }, leaderCheckInterval)

    // Initial leader election
    setTimeout(() => {
      electLeader()
    }, 500)

    return () => {
      channelRef.current?.removeEventListener("message", handleMessage)
      channelRef.current?.close()
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (leaderCheckRef.current) clearInterval(leaderCheckRef.current)
    }
  }, [channelName, tabId, heartbeatInterval, leaderCheckInterval, electLeader, broadcast])

  return {
    tabId,
    isLeader,
    connectedTabs,
    serverConnected,
    broadcast,
    sendToLeader,
    // Expose the message handler registration for external use
    registerMessageHandler,
  } as BroadcastHook & { registerMessageHandler: typeof registerMessageHandler }
}
