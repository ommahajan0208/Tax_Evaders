import React, { useState, useRef } from 'react'
import { 
  FileUp, 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  AlertTriangle,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react'
import { useUpload, Document } from '../contexts/UploadContext'

export const UploadPage: React.FC = () => {
  const { documents, uploadDocument, deleteDocument, uploadProgress } = useUpload()
  const [dragActive, setDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFiles(e.dataTransfer.files)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFiles(e.target.files)
    }
  }

  const processFiles = async (fileList: FileList) => {
    setUploadError(null)
    setIsUploading(true)
    
    const file = fileList[0]
    if (!file.name.endsWith('.pdf')) {
      setUploadError('Only PDF files are supported for SEBI Circular indexing.')
      setIsUploading(false)
      return
    }

    try {
      await uploadDocument(file)
    } catch (e: any) {
      setUploadError(e.response?.data?.detail || 'Failed to complete document ingestion.')
    } finally {
      setIsUploading(false)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'indexed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Indexed
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chunking
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        )
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Upload Zone Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Drag & Drop Area */}
        <div className="lg:col-span-2">
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`h-64 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center cursor-pointer transition duration-300 relative overflow-hidden group ${
              dragActive 
                ? 'border-blue-500 bg-blue-500/5' 
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/35 hover:bg-slate-900/50'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            
            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-850 group-hover:scale-105 transition duration-300 shadow-md">
              <FileUp className="w-8 h-8 text-blue-400 group-hover:animate-bounce" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-200 mt-4">
              Drag & drop regulatory PDF here
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              or click to browse local files (max size 20MB)
            </p>
            
            {/* Live progress indicators */}
            {Object.keys(uploadProgress).map((key) => (
              <div key={key} className="absolute bottom-4 left-4 right-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
                  <span className="truncate">{key.split('-')[0]}</span>
                  <span>{uploadProgress[key]}%</span>
                </div>
                <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress[key]}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Info Card */}
        <div className="glassmorphism rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Pipeline Status
            </span>
            <h3 className="text-xl font-bold text-slate-100">Document Processing</h3>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              When a SEBI Master Circular or notification is uploaded, it triggers a multi-stage background pipeline:
            </p>
            <ul className="text-xs text-slate-500 space-y-2 mt-4">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0">1</span>
                <span>PyMuPDF parses layout-grounded text.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0">2</span>
                <span>Split into 500-token chunks with 50-token overlaps.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0">3</span>
                <span>Sentence-Transformers vectorize chunks to 384 dimensions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0">4</span>
                <span>Gemini extracts regulatory rules and schedules tasks.</span>
              </li>
            </ul>
          </div>
          
          {uploadError && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
              {uploadError}
            </div>
          )}
        </div>
      </div>

      {/* Library Ingestion Table */}
      <div className="glassmorphism rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-850 flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-200">Ingested Document Library</h3>
          <span className="text-xs font-semibold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-850">
            {documents.length} Total Files
          </span>
        </div>
        
        {documents.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No regulatory documents indexed yet.</p>
            <p className="text-xs mt-1">Upload a SEBI PDF circular to initialize the RAG assistant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/40 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-850">
                  <th className="px-6 py-4">Document Details</th>
                  <th className="px-6 py-4">File Size</th>
                  <th className="px-6 py-4 text-center">Pages</th>
                  <th className="px-6 py-4 text-center">FAISS Chunks</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-200 truncate max-w-sm">
                            {doc.original_name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-xs">
                            {doc.filename}
                          </p>
                          {doc.error_message && (
                            <p className="text-[10px] text-rose-400 mt-1 font-medium bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 inline-block">
                              Error: {doc.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {formatBytes(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      {doc.page_count || '-'}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      {doc.chunk_count || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-xl transition duration-200"
                        title="Delete document and erase indices"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

export default UploadPage
