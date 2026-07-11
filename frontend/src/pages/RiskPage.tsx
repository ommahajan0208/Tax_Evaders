import React, { useState, useEffect } from 'react'
import {
  BarChart2, Shield, AlertTriangle, CheckCircle2,
  ChevronDown, RefreshCw, Info, TrendingUp
} from 'lucide-react'
import api from '../utils/api'

interface RiskFinding {
  id: number
  obligation_id: number | null
  risk_score: number
  likelihood: number
  impact: number
  rationale: string
  status: 'open' | 'mitigated' | 'accepted'
  mitigation_notes: string | null
  obligation_text: string | null
  section_reference: string | null
  entity_type: string | null
}

interface RiskSummary {
  total_findings: number
  open: number
  high_risk: number
  mitigated: number
  accepted: number
  average_score: number
  heatmap: Array<{ likelihood: number; impact: number; count: number }>
}

const RISK_BAND = (score: number) =>
  score >= 20 ? 'Critical' :
  score >= 16 ? 'High' :
  score >= 9  ? 'Medium' : 'Low'

const RISK_CELL_COLOR = (count: number, L: number, I: number): string => {
  const score = L * I
  if (count === 0) return 'bg-slate-900/50 text-slate-700'
  if (score >= 20) return 'bg-rose-600/80 text-white'
  if (score >= 16) return 'bg-orange-500/80 text-white'
  if (score >= 9)  return 'bg-amber-500/70 text-slate-900'
  return 'bg-emerald-600/60 text-white'
}

export const RiskPage: React.FC = () => {
  const [findings, setFindings] = useState<RiskFinding[]>([])
  const [summary, setSummary] = useState<RiskSummary | null>(null)
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedFinding, setSelectedFinding] = useState<RiskFinding | null>(null)
  const [mitigationNote, setMitigationNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [heatmapFilter, setHeatmapFilter] = useState<string | null>(null)

  useEffect(() => {
    fetchFindings()
    fetchSummary()
  }, [statusFilter])

  const fetchFindings = async () => {
    try {
      const res = await api.get<RiskFinding[]>(`/risk/findings?status=${statusFilter}&limit=100`)
      setFindings(res.data)
    } catch {}
  }

  const fetchSummary = async () => {
    try {
      const res = await api.get<RiskSummary>('/risk/summary')
      setSummary(res.data)
    } catch {}
  }

  const handleMitigate = async () => {
    if (!selectedFinding) return
    setIsSubmitting(true)
    try {
      await api.post(`/risk/findings/${selectedFinding.id}/mitigate?mitigation_notes=${encodeURIComponent(mitigationNote)}`)
      setSelectedFinding(null)
      setMitigationNote('')
      await fetchFindings()
      await fetchSummary()
    } catch {}
    setIsSubmitting(false)
  }

  const handleAccept = async (id: number) => {
    try {
      await api.post(`/risk/findings/${id}/accept`)
      await fetchFindings()
      await fetchSummary()
    } catch {}
  }

  // Filter findings by heatmap cell click
  const displayedFindings = heatmapFilter
    ? findings.filter(f => `${Math.round(f.likelihood)},${Math.round(f.impact)}` === heatmapFilter)
    : findings

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <BarChart2 className="w-7 h-7 text-orange-400" />
            Risk Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">Likelihood × impact risk matrix across all obligations</p>
        </div>
        {heatmapFilter && (
          <button
            onClick={() => setHeatmapFilter(null)}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg transition"
          >
            Clear heatmap filter
          </button>
        )}
      </div>

      {/* Stat Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Findings', value: summary.total_findings, color: 'text-slate-200' },
            { label: 'Open', value: summary.open, color: 'text-amber-400' },
            { label: 'High Risk', value: summary.high_risk, color: 'text-rose-400' },
            { label: 'Mitigated', value: summary.mitigated, color: 'text-emerald-400' },
            { label: 'Avg Score', value: summary.average_score, color: 'text-indigo-400' },
          ].map(stat => (
            <div key={stat.label} className="glassmorphism rounded-2xl p-4 border border-slate-800 text-center">
              <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Heatmap */}
        <div className="lg:col-span-2 glassmorphism rounded-2xl p-5 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" /> Risk Heatmap (Likelihood × Impact)
          </h3>
          {/* Y-axis label */}
          <div className="flex gap-1">
            <div className="flex flex-col justify-around text-[9px] text-slate-500 font-bold pr-1 py-1">
              {[5, 4, 3, 2, 1].map(l => (
                <span key={l} className="h-8 flex items-center">{l}</span>
              ))}
            </div>
            {/* Grid */}
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map(L => (
                <div key={L} className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(I => {
                    const cell = summary?.heatmap.find(h => h.likelihood === L && h.impact === I)
                    const count = cell?.count || 0
                    const key = `${L},${I}`
                    return (
                      <button
                        key={I}
                        id={`heatmap-cell-${L}-${I}`}
                        onClick={() => setHeatmapFilter(heatmapFilter === key ? null : key)}
                        className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-bold transition hover:ring-2 hover:ring-white/20 ${RISK_CELL_COLOR(count, L, I)} ${heatmapFilter === key ? 'ring-2 ring-white/40' : ''}`}
                        title={`L=${L}, I=${I}: ${count} findings`}
                      >
                        {count > 0 ? count : ''}
                      </button>
                    )
                  })}
                </div>
              ))}
              {/* X-axis */}
              <div className="flex gap-1 pt-1">
                {[1, 2, 3, 4, 5].map(I => (
                  <div key={I} className="flex-1 text-center text-[9px] text-slate-500 font-bold">{I}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-[9px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600/60 inline-block" /> Low</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/70 inline-block" /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500/80 inline-block" /> High</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-600/80 inline-block" /> Critical</span>
          </div>
          <p className="text-[9px] text-slate-600 mt-2">X = Impact (1–5) · Y = Likelihood (1–5)</p>
        </div>

        {/* Findings Table */}
        <div className="lg:col-span-3 glassmorphism rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-400" /> Findings
              {heatmapFilter && (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                  Filtered
                </span>
              )}
            </h3>
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="open">Open</option>
              <option value="mitigated">Mitigated</option>
              <option value="accepted">Accepted</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 max-h-[450px]">
            {displayedFindings.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-semibold">No open risk findings</p>
                <p className="text-xs text-slate-500 mt-1">Upload circulars to generate risk analysis</p>
              </div>
            ) : (
              displayedFindings.map(f => {
                const band = RISK_BAND(f.risk_score)
                const bandColor =
                  band === 'Critical' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                  band === 'High'     ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                  band === 'Medium'   ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                        'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                return (
                  <div
                    key={f.id}
                    id={`finding-row-${f.id}`}
                    className="p-4 hover:bg-slate-800/20 transition cursor-pointer"
                    onClick={() => setSelectedFinding(selectedFinding?.id === f.id ? null : f)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${bandColor}`}>
                            {band} · {f.risk_score}
                          </span>
                          {f.section_reference && (
                            <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
                              {f.section_reference}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            L:{f.likelihood} × I:{f.impact}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                          {f.obligation_text || 'No obligation text available.'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 italic">{f.rationale}</p>
                      </div>
                    </div>

                    {/* Expanded actions */}
                    {selectedFinding?.id === f.id && f.status === 'open' && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2" onClick={e => e.stopPropagation()}>
                        <input
                          id={`mitigation-note-${f.id}`}
                          type="text"
                          placeholder="Add mitigation notes..."
                          value={mitigationNote}
                          onChange={(e) => setMitigationNote(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-2">
                          <button
                            id={`mitigate-btn-${f.id}`}
                            onClick={handleMitigate}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg transition"
                          >
                            Mark Mitigated
                          </button>
                          <button
                            id={`accept-btn-${f.id}`}
                            onClick={() => handleAccept(f.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 text-xs font-bold rounded-lg transition"
                          >
                            Accept Risk
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RiskPage
