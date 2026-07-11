import React, { useState, useEffect } from 'react'
import { Download, RefreshCw, FileText, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react'
import api from '../utils/api'

interface Report {
  id: number
  report_type: string
  status: 'generating' | 'ready' | 'failed'
  scope: Record<string, any>
  created_at: string
  content?: string
}

const REPORT_TYPES = [
  {
    value: 'compliance_summary',
    label: 'Compliance Summary',
    desc: 'Overall compliance posture, checklist progress, and pending items',
    color: 'from-blue-600/20 to-indigo-600/10',
    border: 'border-blue-500/30',
    icon: '📋',
  },
  {
    value: 'risk',
    label: 'Risk Assessment',
    desc: 'Ranked risk findings with likelihood × impact scores',
    color: 'from-orange-600/20 to-rose-600/10',
    border: 'border-orange-500/30',
    icon: '⚠️',
  },
  {
    value: 'audit',
    label: 'Audit Trail Report',
    desc: 'Immutable audit log narrative with evidence citations',
    color: 'from-emerald-600/20 to-teal-600/10',
    border: 'border-emerald-500/30',
    icon: '🔐',
  },
]

const STATUS_CONFIG = {
  generating: { icon: <RefreshCw className="w-4 h-4 animate-spin" />, color: 'text-blue-400', label: 'Generating...' },
  ready: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400', label: 'Ready' },
  failed: { icon: <AlertCircle className="w-4 h-4" />, color: 'text-rose-400', label: 'Failed' },
}

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([])
  const [selectedType, setSelectedType] = useState('compliance_summary')
  const [dateRange, setDateRange] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [viewContent, setViewContent] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  useEffect(() => {
    fetchReports()
    // Poll for generating reports
    const interval = setInterval(fetchReports, 8000)
    return () => clearInterval(interval)
  }, [])

  const fetchReports = async () => {
    try {
      const res = await api.get<Report[]>('/reports/')
      setReports(res.data)
    } catch {}
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const params = new URLSearchParams({ report_type: selectedType })
      if (dateRange) params.append('date_range', dateRange)
      await api.post(`/reports/generate?${params.toString()}`)
      await fetchReports()
    } catch {}
    setIsGenerating(false)
  }

  const handleView = async (report: Report) => {
    setSelectedReport(report)
    setIsLoadingContent(true)
    try {
      const res = await api.get<Report>(`/reports/${report.id}`)
      setViewContent(res.data.content || 'No content available.')
    } catch {}
    setIsLoadingContent(false)
  }

  const handleDownload = async (report: Report) => {
    try {
      const res = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${report.id}_${report.report_type}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
          <FileText className="w-7 h-7 text-indigo-400" />
          Reports
        </h1>
        <p className="text-sm text-slate-400 mt-1">Generate and download compliance, audit, and risk reports</p>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.value}
            id={`report-type-${rt.value}`}
            onClick={() => setSelectedType(rt.value)}
            className={`text-left p-5 rounded-2xl border bg-gradient-to-br ${rt.color} ${rt.border} transition ${
              selectedType === rt.value ? 'ring-2 ring-blue-500/50' : 'hover:opacity-90'
            }`}
          >
            <div className="text-2xl mb-2">{rt.icon}</div>
            <h3 className="font-bold text-slate-100 text-sm">{rt.label}</h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{rt.desc}</p>
          </button>
        ))}
      </div>

      {/* Generator */}
      <div className="glassmorphism rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Range (optional)</label>
          <input
            type="text"
            id="date-range-input"
            placeholder="e.g. 2024-Q1 or 2025-01-01 to 2025-06-30"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
          />
        </div>
        <button
          id="generate-report-btn"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 disabled:opacity-40 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-500/20 shrink-0"
        >
          {isGenerating ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Queuing...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate {REPORT_TYPES.find(r => r.value === selectedType)?.label}</>
          )}
        </button>
      </div>

      {/* Reports History */}
      <div className="glassmorphism rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/30">
          <h3 className="text-sm font-bold text-slate-300">Report History</h3>
        </div>
        {reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold text-sm">No reports generated yet</p>
            <p className="text-xs text-slate-500 mt-1">Generate your first report above</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {reports.map(r => {
              const sc = STATUS_CONFIG[r.status]
              const typeInfo = REPORT_TYPES.find(t => t.value === r.report_type)
              return (
                <div key={r.id} id={`report-row-${r.id}`} className="p-4 flex items-center gap-4 hover:bg-slate-800/20 transition">
                  <span className="text-xl shrink-0">{typeInfo?.icon || '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-200">{typeInfo?.label || r.report_type}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(r.created_at).toLocaleString('en-IN')}
                      {r.scope?.date_range && ` · ${r.scope.date_range}`}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${sc.color}`}>
                    {sc.icon} {sc.label}
                  </div>
                  {r.status === 'ready' && (
                    <div className="flex gap-2">
                      <button
                        id={`view-report-${r.id}`}
                        onClick={() => handleView(r)}
                        className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition"
                      >
                        View
                      </button>
                      <button
                        id={`download-report-${r.id}`}
                        onClick={() => handleDownload(r)}
                        className="text-xs px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-lg transition flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> .md
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Report Content Viewer */}
      {selectedReport && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glassmorphism bg-[#0d1222] border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-100">
                {REPORT_TYPES.find(t => t.value === selectedReport.report_type)?.label} · Report #{selectedReport.id}
              </h3>
              <button
                onClick={() => { setSelectedReport(null); setViewContent(null) }}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : (
                <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                  {viewContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
