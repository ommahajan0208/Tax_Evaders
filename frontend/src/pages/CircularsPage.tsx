import React, { useState, useEffect } from 'react'
import { FileSearch, RefreshCw, ChevronRight, GitCompare, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import api from '../utils/api'

interface Circular {
  id: number
  title: string
  doc_type: string
  status: string
  issue_date: string | null
  effective_date: string | null
  created_at: string
}

interface ChangeEvent {
  new_obligation_id: number
  existing_obligation_id: number
  new_section: string | null
  existing_section: string | null
  overlap_score: number
  change_type: string
  diff_summary: string
}

interface ChangesResult {
  circular_id: number
  new_obligations_count: number
  affected_existing_count: number
  changes: ChangeEvent[]
}

const DOC_TYPE_BADGE: Record<string, string> = {
  circular: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  master_circular: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  notification: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  amendment: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  superseded: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  withdrawn: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

export const CircularsPage: React.FC = () => {
  const [circulars, setCirculars] = useState<Circular[]>([])
  const [selected, setSelected] = useState<Circular | null>(null)
  const [changes, setChanges] = useState<ChangesResult | null>(null)
  const [obligations, setObligations] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'obligations' | 'changes'>('obligations')
  const [isLoading, setIsLoading] = useState(false)
  const [docTypeFilter, setDocTypeFilter] = useState('')

  useEffect(() => {
    fetchCirculars()
  }, [docTypeFilter])

  const fetchCirculars = async () => {
    try {
      const params = docTypeFilter ? `?doc_type=${docTypeFilter}` : ''
      const res = await api.get<Circular[]>(`/circulars/${params}`)
      setCirculars(res.data)
    } catch {}
  }

  const handleSelectCircular = async (c: Circular) => {
    setSelected(c)
    setIsLoading(true)
    try {
      const [obRes, chRes] = await Promise.all([
        api.get(`/circulars/${c.id}/obligations`),
        api.get<ChangesResult>(`/circulars/${c.id}/changes`),
      ])
      setObligations(obRes.data)
      setChanges(chRes.data)
    } catch {}
    setIsLoading(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <FileSearch className="w-7 h-7 text-blue-400" />
            Regulatory Circulars
          </h1>
          <p className="text-sm text-slate-400 mt-1">Browse indexed circulars, obligations, and change diffs</p>
        </div>
        <select
          id="doc-type-filter"
          value={docTypeFilter}
          onChange={(e) => setDocTypeFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="circular">Circular</option>
          <option value="master_circular">Master Circular</option>
          <option value="notification">Notification</option>
          <option value="amendment">Amendment</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Circulars List */}
        <div className="lg:col-span-2 space-y-3">
          {circulars.length === 0 ? (
            <div className="glassmorphism rounded-2xl p-10 text-center border border-slate-800">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-semibold">No circulars indexed yet</p>
              <p className="text-xs text-slate-500 mt-1">Upload SEBI PDF circulars to populate this feed</p>
            </div>
          ) : (
            circulars.map(c => (
              <button
                key={c.id}
                id={`circular-item-${c.id}`}
                onClick={() => handleSelectCircular(c)}
                className={`w-full text-left glassmorphism rounded-xl p-4 border transition ${
                  selected?.id === c.id
                    ? 'border-blue-500/50 bg-blue-500/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-200 line-clamp-2 flex-1">{c.title}</p>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${DOC_TYPE_BADGE[c.doc_type] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {c.doc_type.replace('_', ' ')}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${STATUS_BADGE[c.status] || ''}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  {new Date(c.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="glassmorphism rounded-2xl p-16 text-center border border-slate-800">
              <FileSearch className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-semibold">Select a circular to view details</p>
              <p className="text-xs text-slate-500 mt-1">Obligations, changes, and citation history</p>
            </div>
          ) : (
            <div className="glassmorphism rounded-2xl border border-slate-800 overflow-hidden">
              {/* Circular header */}
              <div className="p-5 border-b border-slate-800 bg-slate-900/30">
                <h2 className="font-extrabold text-slate-100 text-lg">{selected.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${DOC_TYPE_BADGE[selected.doc_type] || ''}`}>
                    {selected.doc_type.replace('_', ' ')}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${STATUS_BADGE[selected.status] || ''}`}>
                    {selected.status}
                  </span>
                  {selected.issue_date && (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                      Issued: {selected.issue_date}
                    </span>
                  )}
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex border-b border-slate-800">
                {[
                  { key: 'obligations', label: `Obligations (${obligations.length})` },
                  { key: 'changes', label: `Change Diff (${changes?.changes?.length || 0})` },
                ].map(tab => (
                  <button
                    key={tab.key}
                    id={`tab-${tab.key}`}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`px-5 py-3 text-xs font-bold transition border-b-2 ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[500px]">
                  {activeTab === 'obligations' ? (
                    <div className="divide-y divide-slate-800/60">
                      {obligations.length === 0 ? (
                        <div className="p-10 text-center text-slate-500 text-sm">No obligations extracted yet.</div>
                      ) : (
                        obligations.map((ob, idx) => (
                          <div key={ob.id} id={`obligation-${ob.id}`} className="p-4 hover:bg-slate-800/10 transition">
                            <div className="flex items-start gap-3">
                              <span className="text-[10px] font-mono text-slate-600 mt-0.5 shrink-0">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap gap-1.5 mb-1.5">
                                  {ob.section_reference && (
                                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                                      {ob.section_reference}
                                    </span>
                                  )}
                                  {ob.obligated_entity_type && (
                                    <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                      {ob.obligated_entity_type}
                                    </span>
                                  )}
                                  {ob.deadline_type && (
                                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                      {ob.deadline_type}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                    conf: {Math.round((ob.confidence_score || 0.8) * 100)}%
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{ob.obligation_text}</p>
                                {ob.deadline_value && (
                                  <p className="text-[10px] text-amber-400/70 mt-1">⏱ {ob.deadline_value}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div>
                      {changes && changes.changes.length > 0 ? (
                        <div>
                          <div className="p-4 bg-amber-500/5 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="font-semibold">
                              {changes.affected_existing_count} existing obligation(s) potentially affected by this circular.
                            </span>
                          </div>
                          <div className="divide-y divide-slate-800/60">
                            {changes.changes.map((change, idx) => (
                              <div key={idx} id={`change-${idx}`} className="p-4 hover:bg-slate-800/10 transition">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <GitCompare className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="text-[10px] font-bold text-amber-400 uppercase">potential_amendment</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{change.diff_summary}</p>
                                <div className="flex gap-3 mt-1.5">
                                  {change.new_section && (
                                    <span className="text-[10px] text-blue-400">New: {change.new_section}</span>
                                  )}
                                  {change.existing_section && (
                                    <span className="text-[10px] text-slate-400">Existing: {change.existing_section}</span>
                                  )}
                                  <span className="text-[10px] text-slate-500">Overlap: {change.overlap_score}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-10 text-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-400 font-semibold">No overlapping obligations detected</p>
                          <p className="text-xs text-slate-500 mt-1">This circular appears to introduce new obligations</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CircularsPage
