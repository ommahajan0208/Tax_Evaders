import React, { createContext, useContext, useState, useEffect } from 'react'
import { useStreaming, Message } from '../hooks/useStreaming'
import api from '../utils/api'

interface ChatContextType {
  sessionId: string
  setSessionId: (id: string) => void
  sessions: string[]
  fetchSessions: () => Promise<void>
  messages: Message[]
  isStreaming: boolean
  currentSources: any[]
  error: string | null
  sendMessage: (q: string) => Promise<void>
  clearMessages: () => void
  selectSession: (id: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string>(() => `session-${Date.now()}`)
  const [sessions, setSessions] = useState<string[]>([])
  
  const stream = useStreaming(sessionId)

  const fetchSessions = async () => {
    try {
      const res = await api.get('/chat/sessions')
      setSessions(res.data.sessions || [])
    } catch (e) {
      console.error("Could not fetch sessions:", e)
    }
  }

  const selectSession = async (id: string) => {
    setSessionId(id)
    stream.clearMessages()
    try {
      const res = await api.get(`/chat/history?session_id=${id}`)
      stream.loadHistory(res.data)
    } catch (e) {
      console.error("Could not fetch session history:", e)
    }
  }

  const deleteSession = async (id: string) => {
    try {
      await api.delete(`/chat/history?session_id=${id}`)
      await fetchSessions()
      if (id === sessionId) {
        const nextId = `session-${Date.now()}`
        setSessionId(nextId)
        stream.clearMessages()
      }
    } catch (e) {
      console.error("Could not delete session history:", e)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [sessionId])

  return (
    <ChatContext.Provider
      value={{
        sessionId,
        setSessionId,
        sessions,
        fetchSessions,
        messages: stream.messages,
        isStreaming: stream.isStreaming,
        currentSources: stream.currentSources,
        error: stream.error,
        sendMessage: stream.sendMessage,
        clearMessages: stream.clearMessages,
        selectSession,
        deleteSession
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
