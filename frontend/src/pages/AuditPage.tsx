import React, { useState, useEffect } from 'react'
import {
  Lock, Search, ShieldCheck, ShieldAlert, RefreshCw, FileSpreadsheet,
  Clock, User, Tag, HelpCircle, Activity
} from 'lucide-react'
import api from '../utils/api'

interface AuditLog {
  id: number
  task_id: number | null
  trace_id: string | null
  actor_type: string
  actor_id: string | null
  user_name: string
  action_type: string
  action_details: string
  timestamp: string
  prev_hash: string | null
  hash: string | null
}

interface VerificationResult {
  is_chain_valid: boolean
  total_records_checked: number
  mismatch_count: number
  mismatches: any[]
}

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const fetchAuditLogs = async () => {
    setIsLoading(true)
    try {
      const res = await api.get<AuditLog[]>('/compliance/audit')
      setLogs(res.data)
    } catch {}
    setIsLoading(false)
  }

  const handleVerifyChain = async () => {
    setIsVerifying(true)
    setVerificationResult(null)
    try {
      const res = await api.get<VerificationResult>('/compliance/audit/verify')
      setVerificationResult(res.data)
    } catch {}
    setIsVerifying(false)
  }

  // Filter logs by search (action_type, username, action_details, trace_id)
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase()
    return (
      log.action_type.toLowerCase().includes(term) ||
      log.user_name.toLowerCase().includes(term) ||
      log.action_details.toLowerCase().includes(term) ||
      (log.trace_id && log.trace_id.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <Lock className="w-7 h-7 text-emerald-400" />
            Immutable Audit Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Machine-verifiable, SHA-256 hash-chained log proving audit trail integrity.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            id="verify-chain-btn"
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-emerald-500/10"
          >
            {isVerifying ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying...</>
            ) : (
              <><ShieldCheck className="w-4 h-4" /> Verify Ledger Integrity</>
            )}
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          id="verification-banner"
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all duration-300 ${
            verificationResult.is_chain_valid
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {verificationResult.is_chain_valid ? (
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="font-bold text-sm">
              {verificationResult.is_chain_valid
                ? 'Cryptographic Ledger Verified'
                : 'Cryptographic Ledger Integrity Failure!'}
            </h3>
            <p className="text-xs mt-0.5 opacity-90">
              {verificationResult.is_chain_valid
                ? `Successfully checked all ${verificationResult.total_records_checked} audit trail blocks. Every link in the SHA-256 hash chain matches. Record is untampered.`
                : `Detected ${verificationResult.mismatch_count} hash mismatch(es) in the chain! One or more historical audit trail logs were modified post-write.`}
            </p>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs hover:underline opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glassmorphism rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-500 pl-1 shrink-0" />
        <input
          id="audit-search-input"
          type="text"
          placeholder="Search by action, trace ID, details or user..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-0"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-500 hover:text-slate-300 px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Timeline View */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glassmorphism rounded-2xl p-16 text-center border border-slate-800">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-semibold">No audit logs match your search</p>
            <p className="text-xs text-slate-500 mt-1">Try another keyword or run actions to populate the ledger</p>
          </div>
        ) : (
          <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6">
            {filteredLogs.map(log => {
              const isHashed = !!log.hash
              return (
                <div key={log.id} id={`audit-log-${log.id}`} className="relative group">
                  {/* Dot indicator */}
                  <span className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center border transition-all ${
                    isHashed
                      ? 'bg-slate-950 border-emerald-500 text-emerald-400'
                      : 'bg-slate-950 border-slate-700 text-slate-500'
                  }`} title={isHashed ? 'SHA-256 Hashed' : 'No Hash'}>
                    <Lock className="w-2.5 h-2.5" />
                  </span>

                  {/* Log body card */}
                  <div className="glassmorphism rounded-2xl p-4 border border-slate-800/80 hover:border-slate-700/80 transition relative">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-200">{log.action_type}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                            <User className="w-3 h-3 text-indigo-400" /> {log.user_name}
                          </span>
                          {log.trace_id && (
                            <span className="text-[9px] text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
                              Trace: {log.trace_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mt-1">{log.action_details}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Hash visualization */}
                    {isHashed && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/40 flex flex-col md:flex-row justify-between gap-1 text-[9px] text-slate-600 font-mono">
                        <span className="truncate max-w-[280px]" title={`Current block: ${log.hash}`}>
                          Block: {log.hash?.slice(0, 16)}...
                        </span>
                        <span className="truncate max-w-[280px]" title={`Prev block: ${log.prev_hash || 'Genesis'}`}>
                          Prev: {log.prev_hash ? `${log.prev_hash.slice(0, 16)}...` : 'Genesis'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditPage
