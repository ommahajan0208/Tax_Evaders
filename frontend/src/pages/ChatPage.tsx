import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { 
  Send, 
  ChevronRight, 
  MessageSquare, 
  Trash2, 
  Sparkles,
  FileText,
  Bookmark,
  ShieldCheck,
  Menu,
  ChevronLeft,
  RefreshCw,
  Plus,
  AlertCircle
} from 'lucide-react'
import { useChat } from '../contexts/ChatContext'
import { useAuthStore } from '../store/authStore'

export const ChatPage: React.FC = () => {
  const { 
    messages, 
    isStreaming, 
    currentSources, 
    sendMessage, 
    sessions, 
    sessionId,
    selectSession, 
    deleteSession 
  } = useChat()
  
  const [input, setInput] = useState('')
  const [historyOpen, setHistoryOpen] = useState(true)
  const [citationsOpen, setCitationsOpen] = useState(true)
  const [streamStep, setStreamStep] = useState(0)
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  const streamMessages = [
    "Retrieving SEBI circular text chunks...",
    "Extracting obligations via Obligation Extraction Agent...",
    "Verifying claims with Citation Entailment Agent...",
    "Finalizing response generation..."
  ]

  useEffect(() => {
    let interval: any
    if (isStreaming) {
      interval = setInterval(() => {
        setStreamStep((prev) => (prev + 1) % 4)
      }, 2500)
    } else {
      setStreamStep(0)
    }
    return () => clearInterval(interval)
  }, [isStreaming])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    
    const queryText = input
    setInput('')
    await sendMessage(queryText)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Get active assistant message sources
  const activeSources = currentSources.length > 0 
    ? currentSources 
    : (messages.slice().reverse().find(m => m.role === 'assistant' && m.sources)?.sources || [])

  // Calculate overall AI confidence score
  const calculateConfidence = () => {
    if (activeSources.length === 0) return 0
    const total = activeSources.reduce((acc: number, src: any) => acc + src.score, 0)
    return Math.round((total / activeSources.length) * 100)
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex -mx-8 -my-8 overflow-hidden bg-[#070b16] relative">
      
      {/* 1. Left Session History Drawer */}
      <div className={`transition-all duration-300 border-r border-slate-850 bg-[#0d1222]/40 glassmorphism flex flex-col shrink-0 ${
        historyOpen ? 'w-64' : 'w-0 border-r-0'
      } overflow-hidden`}>
        <div className="p-4 border-b border-slate-850 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-400">Conversations</h3>
          <button 
            onClick={() => selectSession(`session-${Date.now()}`)}
            className="p-1.5 hover:bg-slate-800 text-indigo-400 rounded-lg transition"
            title="Start new workspace chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {sessions.map((sId) => (
            <div 
              key={sId}
              onClick={() => selectSession(sId)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition group ${
                sId === sessionId 
                  ? 'bg-blue-600/15 text-blue-400 border-l border-blue-500 shadow-md' 
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2 truncate min-w-0">
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{sId.replace('session-', 'Workspace ')}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSession(sId)
                }}
                className="p-1 hover:bg-slate-700/60 rounded-md text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle History Button */}
      <button 
        onClick={() => setHistoryOpen(!historyOpen)}
        className="absolute left-2 top-2 p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white shadow z-10"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* 2. Middle Main Chat Feed Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070b16]/95">
        {/* Messages scroll grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-12">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
              <div className="p-4 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl shadow-xl shadow-blue-500/20 mb-6">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-100">Grounded Regulatory Q&A</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Submit queries regarding stockbroker rules or advisory regulations. Every query searches local vector indexes and is validated using Gemini 2.5 Flash logic.
              </p>
              <div className="mt-8 grid grid-cols-1 gap-3 w-full">
                <button 
                  onClick={() => setInput("What are the daily reconciliation requirements in Section 2.1 of stockbroker circular?")}
                  className="p-3 bg-slate-900/60 hover:bg-slate-900 text-slate-300 rounded-xl border border-slate-850 hover:border-slate-800 text-xs text-left transition duration-200"
                >
                  "What are the daily reconciliation requirements in Section 2.1 of stockbroker circular?"
                </button>
                <button 
                  onClick={() => setInput("How is the segregation of client securities and funds defined under SEBI rules?")}
                  className="p-3 bg-slate-900/60 hover:bg-slate-900 text-slate-300 rounded-xl border border-slate-850 hover:border-slate-800 text-xs text-left transition duration-200"
                >
                  "How is the segregation of client securities and funds defined under SEBI rules?"
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={msg.id} 
                className={`flex gap-4 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar Icon */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                }`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                
                {/* Message Bubble text content */}
                <div className="flex flex-col gap-2 max-w-full">
                  <div className={`p-4 rounded-3xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-slate-900/70 border border-slate-800/80 text-slate-200 rounded-tl-none glassmorphism'
                  }`}>
                    {/* Low confidence warning banner (PRD Section 11.2) */}
                    {msg.role === 'assistant' && msg.confidence_score !== undefined && msg.confidence_score < 0.75 && (
                      <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p>Warning: This response has low grounding confidence ({Math.round(msg.confidence_score * 100)}%).</p>
                          <p className="text-[10px] opacity-80 mt-0.5">Please cross-reference with the citations in the right-side panel.</p>
                        </div>
                      </div>
                    )}
                    <ReactMarkdown 
                      className="prose prose-invert prose-xs text-inherit max-w-none break-words"
                      components={{
                        table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="min-w-full divide-y divide-slate-850/40 text-xs border border-slate-800" {...props}/></div>,
                        th: ({node, ...props}) => <th className="px-3 py-2 bg-slate-950 font-bold border-b border-slate-800" {...props}/>,
                        td: ({node, ...props}) => <td className="px-3 py-2 border-b border-slate-850" {...props}/>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}
          {isStreaming && (
            <div className="flex gap-4 max-w-3xl mr-auto">
              <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-4 rounded-3xl rounded-tl-none bg-slate-900/70 border border-slate-850 text-slate-400 text-xs italic flex items-center space-x-2 glassmorphism">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]"></span>
                <span className="pl-1.5 text-slate-500">{streamMessages[streamStep]}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Multiline Query Input Form */}
        <div className="p-6 border-t border-slate-850 bg-[#0d1222]/15">
          <form onSubmit={handleSend} className="relative max-w-3xl mx-auto flex items-end bg-slate-900 border border-slate-800 rounded-2xl p-2.5 focus-within:border-blue-500 transition shadow-inner">
            <textarea
              required
              rows={1}
              placeholder="Submit regulatory compliance query..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              className="flex-1 max-h-32 bg-transparent text-slate-200 placeholder-slate-500 text-sm focus:outline-none pl-3.5 pr-12 py-2.5 resize-none overflow-y-auto"
            />
            <button 
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl transition duration-200 shadow-md"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </form>
          <div className="flex justify-between items-center max-w-3xl mx-auto mt-2 text-[10px] text-slate-500 px-3">
            <span>Press Enter to send, Shift+Enter for newline</span>
            <button 
              type="button" 
              onClick={() => setCitationsOpen(!citationsOpen)} 
              className="hover:text-slate-300 font-semibold"
            >
              {citationsOpen ? "Hide Sources" : "Show Sources"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Right Collapsible Source Citation Drawer */}
      <div className={`transition-all duration-300 border-l border-slate-850 bg-[#0d1222]/40 glassmorphism flex flex-col shrink-0 ${
        citationsOpen && activeSources.length > 0 ? 'w-80' : 'w-0 border-l-0'
      } overflow-hidden`}>
        <div className="p-4 border-b border-slate-850 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-indigo-500" /> Reference Citations
          </h3>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-850 px-2 py-0.5 rounded-md">
            {activeSources.length} Grounded Chunks
          </span>
        </div>
        
        {/* Confidence score gauge */}
        {activeSources.length > 0 && (
          <div className="p-4 border-b border-slate-850/60 bg-slate-950/20 shrink-0">
            <div className="flex justify-between text-xs text-slate-400 font-semibold mb-1.5">
              <span>Overall Answer Grounding Confidence</span>
              <span className="text-emerald-400 font-bold">{calculateConfidence()}%</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
              <div 
                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-500"
                style={{ width: `${calculateConfidence()}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Citations items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSources.map((src: any, index: number) => (
            <div key={index} className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-2 text-xs relative group hover:border-slate-700/80 transition">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-400 uppercase text-[9px] px-2 py-0.5 bg-slate-950 border border-slate-850 rounded-md">
                  Source [{index+1}]
                </span>
                <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                  Score: <span className="text-indigo-400">{(src.score || 0).toFixed(3)}</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold text-slate-300 truncate max-w-[180px]" title={src.file}>
                  {src.file}
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                  Pg {src.page}
                </span>
              </div>
              <p className="text-slate-400 leading-relaxed bg-slate-950/30 p-2 rounded-lg border border-slate-900 italic max-h-36 overflow-y-auto select-none">
                "{src.text_preview}..."
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

export default ChatPage
