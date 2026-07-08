import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

export interface Document {
  id: number
  filename: string
  original_name: string
  file_size: number
  page_count: number
  chunk_count: number
  status: 'pending' | 'processing' | 'indexed' | 'failed'
  error_message?: string
  created_at: string
}

interface UploadContextType {
  documents: Document[]
  isLoading: boolean
  uploadProgress: { [key: string]: number }
  fetchDocuments: () => Promise<void>
  uploadDocument: (file: File) => Promise<Document>
  deleteDocument: (id: number) => Promise<void>
}

const UploadContext = createContext<UploadContextType | undefined>(undefined)

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/documents/')
      setDocuments(res.data)
    } catch (e) {
      console.error('Could not fetch documents:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const uploadDocument = async (file: File): Promise<Document> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const progressKey = `${file.name}-${Date.now()}`
    setUploadProgress((prev) => ({ ...prev, [progressKey]: 0 }))

    try {
      const res = await api.post<Document>('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size
          const current = progressEvent.loaded
          const pct = Math.round((current * 100) / total)
          setUploadProgress((prev) => ({ ...prev, [progressKey]: pct }))
        }
      })
      
      // Refresh documents
      await fetchDocuments()
      return res.data
    } catch (e) {
      console.error('Error uploading file:', e)
      throw e
    } finally {
      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev }
          delete next[progressKey]
          return next
        })
      }, 5000)
    }
  }

  const deleteDocument = async (id: number) => {
    try {
      await api.delete(`/documents/${id}`)
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
    } catch (e) {
      console.error('Error deleting document:', e)
      throw e
    }
  }

  useEffect(() => {
    fetchDocuments()
    
    // Poll indexing status if any document is pending/processing
    const interval = setInterval(() => {
      const hasProcessing = documents.some(
        (doc) => doc.status === 'pending' || doc.status === 'processing'
      )
      if (hasProcessing) {
        fetchDocuments()
      }
    }, 4000)
    
    return () => clearInterval(interval)
  }, [documents, fetchDocuments])

  return (
    <UploadContext.Provider
      value={{
        documents,
        isLoading,
        uploadProgress,
        fetchDocuments,
        uploadDocument,
        deleteDocument
      }}
    >
      {children}
    </UploadContext.Provider>
  )
}

export const useUpload = () => {
  const context = useContext(UploadContext)
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider')
  }
  return context
}
