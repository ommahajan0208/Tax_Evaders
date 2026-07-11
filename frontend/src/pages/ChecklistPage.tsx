import React, { useState, useEffect } from 'react'
import {
  ClipboardCheck, ChevronDown, RefreshCw, Download,
  CheckCircle2, Clock, AlertCircle, XCircle, MinusCircle,
  Sparkles, FileText, ChevronRight, BarChart3
} from 'lucide-react'
import api from '../utils/api'

interface Circular {
  id: number
  title: string
  doc_type: string
  status: string
  created_at: string
}

interface ChecklistItem {
  id: number
  checklist_id: number
  obligation_id: number | null
  description: string
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'not_applicable'
  assigned_to: number | null
  due_date: string | null
  section_reference: string | null
}

interface Checklist {
  id: number
  name: string
  entity_type: string
  circular_id: number
  circular_title: string | null
  created_at: string
  total_items: number
  completed_items: number
  items: ChecklistItem[]
}

const ENTITY_TYPES = [
  { value: 'broker', label: 'Stock Broker' },
  { value: 'dp', label: 'Depository Participant' },
  { value: 'amc', label: 'Mutual Fund AMC' },
  { value: 'rta', label: 'Registrar & Transfer Agent' },
  { value: 'listed_co', label: 'Listed Company' },
  { value: 'all', label: 'All Entities' },
]

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  not_started: { label: 'Not Started', icon: <Clock className="w-4 h-4" />, color: 'text-slate-400' },
  in_progress: { label: 'In Progress', icon: <RefreshCw className="w-4 h-4" />, color: 'text-blue-400' },
  completed: { label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400' },
  overdue: { label: 'Overdue', icon: <AlertCircle className="w-4 h-4" />, color: 'text-rose-400' },
  not_applicable: { label: 'N/A', icon: <MinusCircle className="w-4 h-4" />, color: 'text-slate-600' },
}

export const ChecklistPage: React.FC = () => {
  const [circulars, setCirculars] = useState<Circular[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null)
  const [selectedCircularId, setSelectedCircularId] = useState<number | ''>('')
  const [selectedEntityType, setSelectedEntityType] = useState('broker')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [updatingItem, setUpdatingItem] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCirculars()
    fetchChecklists()
  }, [])

  const fetchCirculars = async () => {
    try {
      const res = await api.get<Circular[]>('/circulars/')
      setCirculars(res.data)
      if (res.data.length > 0 && !selectedCircularId) {
        setSelectedCircularId(res.data[0].id)
      }
    } catch {}
  }

  const fetchChecklists = async () => {
    try {
      const res = await api.get<Checklist[]>('/checklists/')
      setChecklists(res.data)
    } catch {}
  }

  const fetchChecklistDetail = async (id: number) => {
    try {
      const res = await api.get<Checklist>(`/checklists/${id}`)
      setSelectedChecklist(res.data)
    } catch {}
  }

  const handleGenerate = async () => {
    if (!selectedCircularId) return
    setIsGenerating(true)
    setError(null)
    try {
      const res = await api.post<Checklist>(
        `/checklists/generate?circular_id=${selectedCircularId}&entity_type=${selectedEntityType}`
      )
      setSelectedChecklist(res.data)
      await fetchChecklists()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to generate checklist.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStatusChange = async (itemId: number, newStatus: string) => {
    if (!selectedChecklist) return
    setUpdatingItem(itemId)
    try {
      await api.patch(`/checklists/${selectedChecklist.id}/items/${itemId}?status=${newStatus}`)
      await fetchChecklistDetail(selectedChecklist.id)
    } catch {}
    setUpdatingItem(null)
  }

  const handleExport = async () => {
    if (!selectedChecklist) return
    setIsExporting(true)
    try {
      const res = await api.get<{ markdown: string; checklist_name: string }>(
        `/checklists/${selectedChecklist.id}/export`
      )
      const blob = new Blob([res.data.markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${res.data.checklist_name.replace(/\s+/g, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setIsExporting(false)
  }

  const completionPct = selectedChecklist
    ? Math.round((selectedChecklist.completed_items / Math.max(1, selectedChecklist.total_items)) * 100)
    : 0

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-emerald-400" />
            Compliance Checklist Generator
          </h1>
          <p className="text-sm text-slate-400 mt-1">Auto-generate obligation checklists from SEBI circulars</p>
        </div>
        <div className="flex gap-2">
          {selectedChecklist && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              id="export-checklist-btn"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export Report'}
            </button>
          )}
        </div>
      </div>

      {/* Generator Controls */}
      <div className="glassmorphism rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" /> Generate New Checklist
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Circular</label>
            <select
              id="circular-select"
              value={selectedCircularId}
              onChange={(e) => setSelectedCircularId(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Select a circular...</option>
              {circulars.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Entity Type</label>
            <select
              id="entity-type-select"
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
            >
              {ENTITY_TYPES.map(et => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              id="generate-checklist-btn"
              onClick={handleGenerate}
              disabled={isGenerating || !selectedCircularId}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 disabled:opacity-40 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isGenerating ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Checklist</>
              )}
            </button>
          </div>
        </div>
        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">{error}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Checklist Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Saved Checklists</h3>
          {checklists.length === 0 ? (
            <div className="glassmorphism rounded-2xl p-6 text-center border border-slate-800">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No checklists yet.<br />Generate one above.</p>
            </div>
          ) : (
            checklists.map(cl => {
              const pct = Math.round((cl.completed_items / Math.max(1, cl.total_items)) * 100)
              return (
                <button
                  key={cl.id}
                  id={`checklist-item-${cl.id}`}
                  onClick={() => fetchChecklistDetail(cl.id)}
                  className={`w-full text-left glassmorphism rounded-xl p-3.5 border transition ${
                    selectedChecklist?.id === cl.id
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-200 line-clamp-2">{cl.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{cl.completed_items}/{cl.total_items} done</span>
                    <span className={`text-[10px] font-bold ${pct === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>{pct}%</span>
                  </div>
                  <div className="mt-1.5 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Checklist Detail */}
        <div className="lg:col-span-3">
          {selectedChecklist ? (
            <div className="space-y-4">
              {/* Progress Header */}
              <div className="glassmorphism rounded-2xl p-5 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-extrabold text-slate-100 text-lg">{selectedChecklist.name}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ENTITY_TYPES.find(e => e.value === selectedChecklist.entity_type)?.label} · {selectedChecklist.total_items} items
                    </p>
                  </div>
                  {/* Progress Ring */}
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                      <circle
                        cx="32" cy="32" r="28"
                        fill="none"
                        stroke={completionPct === 100 ? '#34d399' : '#3b82f6'}
                        strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - completionPct / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-slate-100">
                      {completionPct}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-800/60 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="glassmorphism rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">#</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Obligation</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Section</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Due</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {selectedChecklist.items.map((item, idx) => {
                      const sc = STATUS_CONFIG[item.status]
                      return (
                        <tr key={item.id} id={`checklist-row-${item.id}`} className="hover:bg-slate-800/20 transition">
                          <td className="px-4 py-3 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs">
                            <p className="line-clamp-2 leading-relaxed">{item.description}</p>
                          </td>
                          <td className="px-4 py-3">
                            {item.section_reference ? (
                              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono text-[10px]">
                                {item.section_reference}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono">{item.due_date || '—'}</td>
                          <td className="px-4 py-3">
                            <select
                              id={`status-select-${item.id}`}
                              value={item.status}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              disabled={updatingItem === item.id}
                              className={`bg-transparent border-0 text-[11px] font-bold cursor-pointer focus:outline-none focus:ring-0 ${sc.color} ${updatingItem === item.id ? 'opacity-50' : ''}`}
                            >
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <option key={k} value={k} className="bg-slate-900 text-slate-200">{v.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="glassmorphism rounded-2xl p-16 text-center border border-slate-800">
              <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-semibold">Select or generate a checklist</p>
              <p className="text-xs text-slate-500 mt-1">Choose a circular and entity type, then click Generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChecklistPage
