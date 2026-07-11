import { useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'

export interface Source {
  file: string
  page: number
  text_preview: string
  score: float
}

export interface Message {
  id: string | number
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence_score?: number
  created_at: string
}

export const useStreaming = (sessionId: string) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentSources, setCurrentSources] = useState<Source[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const token = useAuthStore((state) => state.token)

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentSources([])
  }, [])

  const loadHistory = useCallback((history: Message[]) => {
    setMessages(history)
  }, [])

  const sendMessage = useCallback(async (question: string) => {
    setIsStreaming(true)
    setError(null)
    setCurrentSources([])
    
    // 1. Add the user message immediately
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      created_at: new Date().toISOString()
    }
    setMessages((prev) => [...prev, userMsg])
    
    // 2. Prepare placeholder assistant message
    const assistantMsgId = `assistant-${Date.now()}`
    const placeholderAssistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    }
    setMessages((prev) => [...prev, placeholderAssistantMsg])

    try {
      const response = await fetch('/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question,
          session_id: sessionId
        })
      })

      if (!response.ok) {
        throw new Error(`Chat request failed with status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('ReadableStream is not supported by the browser.')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      let accumulatedContent = ''
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim()
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim()
            if (!dataStr) continue

            try {
              const data = JSON.parse(dataStr)
              
              if (currentEvent === 'sources') {
                setCurrentSources(data)
                // Append sources to the assistant message inside the state
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, sources: data }
                      : msg
                  )
                )
              } else if (currentEvent === 'token') {
                accumulatedContent += data
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                )
              } else if (currentEvent === 'confidence') {
                // Update assistant message with confidence score and the final verified text (with [UNVERIFIED] flags if any)
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, confidence_score: data.confidence_score, content: data.verified_answer }
                      : msg
                  )
                )
              }
            } catch (e) {
              console.error('Error parsing streaming event JSON:', e, dataStr)
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong during streaming.')
      // Update assistant message to show error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: `Error: ${err.message || 'Could not reach streaming service.'}` }
            : msg
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }, [sessionId, token])

  return {
    messages,
    isStreaming,
    currentSources,
    error,
    sendMessage,
    clearMessages,
    loadHistory
  }
}
