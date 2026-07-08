import React, { useState, useEffect, useCallback } from 'react'
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  HelpCircle,
  FileText,
  Upload,
  Calendar,
  X,
  Sparkles,
  ShieldCheck,
  ClipboardList
} from 'lucide-react'
import api from '../utils/api'

interface Rule {
  id: number
  circular_name: string
  section_reference: string
  obligation_text: string
  frequency: string
  verification_criteria: string
}

interface Task {
  id: number
  rule_id: number
  assignee_department: string
  due_date: string
  status: 'Pending' | 'Under Review' | 'Compliant' | 'Non-Compliant' | 'Overdue'
  evidence_file_path?: string
  verification_feedback?: string
  completed_at?: string
  rule?: Rule
}

interface AuditLog {
  id: number
  task_id?: number
  user_name: string
  action_type: string
  action_details: string
  timestamp: string
}

export const DashboardPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [activeDept, setActiveDept] = useState<string>('All')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Verification upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationFeedback, setVerificationFeedback] = useState<any | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      // Get tasks
      const deptFilter = activeDept === 'All' ? '' : `?department=${activeDept}`
      const tasksRes = await api.get<Task[]>(`/compliance/tasks${deptFilter}`)
      setTasks(tasksRes.data)
      
      // Get audit logs
      const auditRes = await api.get<AuditLog[]>('/compliance/audit')
      setAuditLogs(auditRes.data)
    } catch (e) {
      console.error("Error loading dashboard data:", e)
    }
  }, [activeDept])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile || !selectedTask) return
    
    setIsVerifying(true)
    setErrorMsg(null)
    setVerificationFeedback(null)
    
    const formData = new FormData()
    formData.append('file', uploadFile)
    
    try {
      const res = await api.post(`/compliance/tasks/${selectedTask.id}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setVerificationFeedback(res.data)
      await fetchDashboardData()
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Verification request failed.')
    } finally {
      setIsVerifying(false)
    }
  }

  const getTaskStatusIcon = (status: Task['status']) => {
    switch(status) {
      case 'Compliant': 
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      case 'Non-Compliant': 
        return <AlertCircle className="w-5 h-5 text-rose-400" />
      case 'Under Review': 
        return <Clock className="w-5 h-5 text-blue-400 animate-spin" />
      case 'Overdue': 
        return <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
      default: 
        return <Clock className="w-5 h-5 text-amber-400" />
    }
  }

  const getStatusBadgeClass = (status: Task['status']) => {
    switch(status) {
      case 'Compliant': 
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'Non-Compliant': 
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      case 'Under Review': 
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      case 'Overdue': 
        return 'bg-red-500/10 text-red-400 border border-red-500/20'
      default: 
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    }
  }

  // Calculate high-level stats
  const totalCount = tasks.length
  const compliantCount = tasks.filter(t => t.status === 'Compliant').length
  const pendingCount = tasks.filter(t => t.status === 'Pending').length
  const alertCount = tasks.filter(t => t.status === 'Non-Compliant' || t.status === 'Overdue').length

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* 1. Quick Stats Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="glassmorphism rounded-2xl p-5 shadow-lg border border-slate-800">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Tasks</span>
            <ClipboardList className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white mt-3">{totalCount}</p>
        </div>
        <div className="glassmorphism rounded-2xl p-5 shadow-lg border border-slate-800">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Compliant</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-3">{compliantCount}</p>
        </div>
        <div className="glassmorphism rounded-2xl p-5 shadow-lg border border-slate-800">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Pending</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-amber-400 mt-3">{pendingCount}</p>
        </div>
        <div className="glassmorphism rounded-2xl p-5 shadow-lg border border-slate-800">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Non-Compliant</span>
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-3xl font-extrabold text-rose-400 mt-3">{alertCount}</p>
        </div>
      </div>

      {/* 2. Department filter tabs */}
      <div className="flex border-b border-slate-850 space-x-6">
        {['All', 'Finance', 'Operations', 'IT', 'Compliance'].map((dept) => (
          <button
            key={dept}
            onClick={() => setActiveDept(dept)}
            className={`pb-3 text-sm font-bold tracking-tight transition border-b-2 ${
              activeDept === dept 
                ? 'border-blue-500 text-blue-400 font-extrabold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {dept === 'All' ? 'All Departments' : `${dept} Team`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 3. Left Tasks Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-bold text-lg text-slate-200">Compliance Calendar Tasks</h3>
            <span className="text-xs text-slate-400">Sorted by proximity</span>
          </div>

          {tasks.length === 0 ? (
            <div className="glassmorphism rounded-3xl p-16 text-center text-slate-500 border border-slate-850">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No compliance tasks generated yet.</p>
              <p className="text-xs mt-1 text-slate-600">Please go to Document Control page and upload SEBI Circular PDFs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="glassmorphism rounded-2xl p-5 border border-slate-800 hover:border-slate-700/80 transition duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2.5">
                      {getTaskStatusIcon(task.status)}
                      <span className="font-bold text-slate-200 text-sm">
                        {task.rule?.section_reference}
                      </span>
                      <span className="text-xs text-slate-500">
                        {task.rule?.circular_name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 pr-4 leading-relaxed">
                      {task.rule?.obligation_text}
                    </p>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-850 text-slate-400">
                        Dept: {task.assignee_department}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-850 text-slate-400">
                        Due: {task.due_date}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${getStatusBadgeClass(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center">
                    <button
                      onClick={() => {
                        setSelectedTask(task)
                        setUploadFile(null)
                        setVerificationFeedback(null)
                        setErrorMsg(null)
                      }}
                      className="w-full md:w-auto px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800/80 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" /> Verify Compliance
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Right Audit Log Panel */}
        <div className="glassmorphism rounded-3xl p-5 border border-slate-800 flex flex-col h-[500px]">
          <div className="pb-4 border-b border-slate-850 mb-4 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> Immutable Audit Trail
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center pt-16">No compliance audit logs recorded.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-900/40 border border-slate-850/65 rounded-xl space-y-1 text-[11px] leading-relaxed">
                  <div className="flex justify-between font-bold">
                    <span className="text-indigo-400">{log.action_type}</span>
                    <span className="text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="text-slate-300 italic">"{log.action_details}"</p>
                  <div className="text-[9px] text-slate-500 flex justify-between pt-0.5">
                    <span>Operator: {log.user_name}</span>
                    <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Evidence Verification Dialog/Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="glassmorphism bg-[#0d1222] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setSelectedTask(null)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse-glow" /> Agentic Verifier
                </span>
                <h3 className="text-xl font-bold text-slate-100 mt-1">Verify Obligation: {selectedTask.rule?.section_reference}</h3>
              </div>
              
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-850 text-xs space-y-2 leading-relaxed">
                <p className="font-bold text-slate-300">Obligation:</p>
                <p className="text-slate-400 italic">"{selectedTask.rule?.obligation_text}"</p>
              </div>

              <div className="p-4 bg-blue-600/5 rounded-2xl border border-blue-500/20 text-xs space-y-2 leading-relaxed">
                <p className="font-bold text-blue-400 flex items-center gap-1">🛡️ Target Verification Criteria:</p>
                <p className="text-slate-400">
                  {selectedTask.rule?.verification_criteria}
                </p>
              </div>

              {/* Upload Proof Area */}
              {!verificationFeedback ? (
                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Upload evidence (CSV or PDF reconciliation reports)
                    </label>
                    <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center hover:bg-slate-900/30 transition duration-200">
                      <input 
                        type="file" 
                        required
                        className="hidden" 
                        id="evidence-upload"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="evidence-upload" className="cursor-pointer space-y-2 flex flex-col items-center">
                        <Upload className="w-6 h-6 text-blue-400" />
                        <span className="text-xs text-slate-300 font-semibold">
                          {uploadFile ? uploadFile.name : "Select audit statement or reconciliation log"}
                        </span>
                        <span className="text-[10px] text-slate-500">PDF, CSV, or Text format</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || !uploadFile}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Verifying reconciliation logs...
                      </>
                    ) : (
                      "Submit Proof to Verification Agent"
                    )}
                  </button>
                  {errorMsg && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-xs font-semibold">
                      {errorMsg}
                    </div>
                  )}
                </form>
              ) : (
                /* Agent verification feedback results */
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border text-center ${
                    verificationFeedback.is_compliant 
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                  }`}>
                    <h4 className="font-extrabold text-md flex items-center justify-center gap-1.5">
                      {verificationFeedback.is_compliant ? "✅ Compliance Status Verified" : "❌ Discrepancies Flagged"}
                    </h4>
                    <p className="text-xs mt-1">
                      The Agentic Verifier has marked the task as <strong>{verificationFeedback.is_compliant ? "COMPLIANT" : "NON-COMPLIANT"}</strong>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Agent Analysis Feedback</p>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 border border-slate-850 p-3 rounded-xl">
                      {verificationFeedback.feedback}
                    </p>
                  </div>

                  {verificationFeedback.anomalies !== "None" && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-rose-400">Anomalies Detected</p>
                      <p className="text-xs text-rose-400 leading-relaxed bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl font-mono">
                        {verificationFeedback.anomalies}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedTask(null)}
                    className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition"
                  >
                    Close Control Panel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default DashboardPage
