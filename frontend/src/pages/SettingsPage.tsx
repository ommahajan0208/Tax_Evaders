import React, { useState, useEffect } from 'react'
import {
  Settings, Building2, Key, BellRing, Save, Sparkles,
  ShieldCheck, HelpCircle, Eye, EyeOff
} from 'lucide-react'

export const SettingsPage: React.FC = () => {
  const [orgName, setOrgName] = useState('Tax Evaders Brokerage Pvt Ltd')
  const [sebiReg, setSebiReg] = useState('INZ000203040')
  const [entityType, setEntityType] = useState('broker')
  const [apiKey, setApiKey] = useState('g.flash.2.5_xxxxxxxxxxxx')
  const [showKey, setShowKey] = useState(false)
  const [notifPreferences, setNotifPreferences] = useState({
    new_circulars: true,
    risk_escalation: true,
    deadline_reminders: true,
    change_alerts: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  const handleSave = () => {
    setIsSaving(true)
    setSaveStatus(null)
    setTimeout(() => {
      setIsSaving(false)
      setSaveStatus('Settings saved successfully.')
    }, 800)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-400" />
          Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">Configure your organization profile, regulatory alert streams, and API keys</p>
      </div>

      {saveStatus && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          {saveStatus}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation tabs layout */}
        <div className="md:col-span-1 space-y-2">
          {[
            { label: 'Organization Profile', icon: <Building2 className="w-4.5 h-4.5" />, active: true },
            { label: 'API Keys & LLM Config', icon: <Key className="w-4.5 h-4.5" /> },
            { label: 'Notification Settings', icon: <BellRing className="w-4.5 h-4.5" /> },
          ].map(tab => (
            <div
              key={tab.label}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                tab.active
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-300 cursor-pointer'
              }`}
            >
              {tab.icon}
              {tab.label}
            </div>
          ))}
        </div>

        {/* Content Form */}
        <div className="md:col-span-2 space-y-6">
          {/* Org Section */}
          <div className="glassmorphism rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Building2 className="w-4.5 h-4.5 text-blue-400" /> Organization Profile
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold">Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold">SEBI Registration No</label>
                  <input
                    type="text"
                    value={sebiReg}
                    onChange={(e) => setSebiReg(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Primary Entity Type</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="broker">Stock Broker</option>
                    <option value="dp">Depository Participant</option>
                    <option value="amc">Mutual Fund AMC</option>
                    <option value="rta">Registrar & Transfer Agent</option>
                    <option value="listed_co">Listed Company</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* API Key Section */}
          <div className="glassmorphism rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Key className="w-4.5 h-4.5 text-amber-400" /> API Keys & LLM Config
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Gemini API Key</label>
                  <span className="text-[10px] text-slate-500 font-medium">Leave blank to use environment default</span>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-blue-500 transition font-mono"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="glassmorphism rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BellRing className="w-4.5 h-4.5 text-indigo-400" /> Notification Alert Rules
            </h3>
            <div className="space-y-3">
              {[
                { key: 'new_circulars', label: 'New Circular Ingested', desc: 'Alert when a new circular is indexed and parsed' },
                { key: 'change_alerts', label: 'Overlapping Change Detected', desc: 'Alert when new obligations conflict/amend older ones' },
                { key: 'risk_escalation', label: 'High Risk Escalation (Score ≥ 16)', desc: 'Immediate notification on risk scoring escalation' },
                { key: 'deadline_reminders', label: 'Deadline Calendar Alerts', desc: 'Reminders 7 days prior to fixed obligations' },
              ].map(pref => (
                <div key={pref.key} className="flex items-start justify-between p-2 rounded-lg hover:bg-slate-800/10 transition">
                  <div className="flex-1 pr-4">
                    <p className="text-xs font-semibold text-slate-200">{pref.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{pref.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={(notifPreferences as any)[pref.key]}
                    onChange={(e) => setNotifPreferences({ ...notifPreferences, [pref.key]: e.target.checked })}
                    className="mt-1 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 focus:ring-2 w-4 h-4"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-3">
            <button
              id="save-settings-btn"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
