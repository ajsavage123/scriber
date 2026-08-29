"use client";
import React, { useState, useEffect } from "react";
import { Settings, ShieldCheck, Stethoscope, Cpu, CheckCircle2, Zap, Server, RefreshCw, DollarSign, BarChart3, Globe, Sparkles, Sliders } from "lucide-react";
import { useToast } from "@/components/Toast";
import { DEMO_SCENARIOS, DemoScenario } from "@/lib/demoAudioSimulator";

export default function SettingsPage() {
  const [specialty, setSpecialty] = useState("General Practice");
  const [language, setLanguage] = useState("multi");
  const [autoScrub, setAutoScrub] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [demoScenario, setDemoScenario] = useState<DemoScenario>("full_test");
  const { addToast } = useToast();
  
  const [usage, setUsage] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const fetchUsage = async (force = false) => {
    setLoadingUsage(true);
    try {
      const res = await fetch(`/api/usage${force ? "?refresh=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      } else {
        console.error("Failed to fetch usage stats");
      }
    } catch (err) {
      console.error("Error fetching usage:", err);
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("medical_specialty");
    if (saved) setSpecialty(saved);
    const savedLang = localStorage.getItem("preferred_language");
    if (savedLang) setLanguage(savedLang);
    const savedDemo = localStorage.getItem("demo_sandbox_mode");
    if (savedDemo !== null) setDemoMode(savedDemo === "true");
    const savedScenario = localStorage.getItem("demo_scenario");
    if (savedScenario) setDemoScenario(savedScenario as DemoScenario);
    fetchUsage(false);
  }, []);

  const handleSave = () => {
    localStorage.setItem("medical_specialty", specialty);
    localStorage.setItem("preferred_language", language);
    localStorage.setItem("demo_sandbox_mode", String(demoMode));
    localStorage.setItem("demo_scenario", demoScenario);
    addToast("success", "Settings Saved", `Configuration updated successfully (${demoMode ? "Demo Sandbox" : "Live API"}).`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-gray-100 pb-6">
        <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-emerald-600" />
          System Settings & Audio Engine
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure Demo vs Live execution modes, clinical parameters, and statutory DPDP compliance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Settings Panel */}
        <div className="md:col-span-2 space-y-6">
          {/* Demo Sandbox vs Live Cloud API Execution Mode */}
          <div className="glass-card rounded-3xl p-6 lg:p-7 space-y-5 border-2 border-emerald-500/30 shadow-lg">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-lg font-display">
                <Zap className="w-5 h-5 text-amber-500" />
                Execution Mode (Demo vs Live)
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                demoMode ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-emerald-100 text-emerald-800 border border-emerald-300"
              }`}>
                {demoMode ? "⚡ Demo Sandbox (0 Tokens)" : "🌐 Live Cloud AI"}
              </span>
            </div>

            {/* Mode Switcher Buttons */}
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setDemoMode(false)}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  !demoMode 
                    ? "bg-white text-emerald-800 shadow-md border border-slate-200 scale-[1.02]" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-1.5 font-bold text-sm">
                  🌐 Live Cloud AI
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Real Mic + Deepgram + Cloudflare</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoMode(true)}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  demoMode 
                    ? "bg-white text-amber-800 shadow-md border border-amber-200 scale-[1.02]" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-1.5 font-bold text-sm">
                  ⚡ Demo Sandbox
                </span>
                <span className="text-[10px] text-slate-500 font-normal">0 API Tokens • Full Simulation</span>
              </button>
            </div>

            {/* Demo Scenario Selector (Shown when in Demo Sandbox Mode) */}
            {demoMode && (
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2.5 animate-fade-in-up">
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Select Demo Clinical Scenario
                </label>
                <select
                  value={demoScenario}
                  onChange={(e) => setDemoScenario(e.target.value as DemoScenario)}
                  className="w-full bg-white border border-amber-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                >
                  {DEMO_SCENARIOS.map((sc) => (
                    <option key={sc.key} value={sc.key}>
                      {sc.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-800/80 leading-relaxed font-medium">
                  {DEMO_SCENARIOS.find(s => s.key === demoScenario)?.description}
                </p>
              </div>
            )}
          </div>
          {/* Spoken Language & Audio Model */}
          <div className="glass-card rounded-3xl p-6 lg:p-7 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-lg font-display border-b pb-3">
              <Globe className="w-5 h-5 text-cyan-600" />
              Consultation Language & Audio Engine
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Primary Encounter Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl p-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
              >
                <option value="multi">🌐 Auto-Detect (Mixed Telugu / Hindi / English)</option>
                <option value="en">English (en)</option>
                <option value="hi">हिन्दी (Hindi - hi)</option>
                <option value="te">తెలుగు (Telugu - te)</option>
              </select>
              <p className="text-xs text-gray-400 mt-2">
                Sets the speech recognition model profile and clinical multilingual diarization parser.
              </p>
            </div>
          </div>

          {/* Clinical Profile */}
          <div className="glass-card rounded-3xl p-6 lg:p-7 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-lg font-display border-b pb-3">
              <Stethoscope className="w-5 h-5 text-emerald-600" />
              Clinical Profile
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Medical Specialty Context
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl p-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              >
                <option value="General Practice">General Practice / Family Medicine</option>
                <option value="Internal Medicine">Internal Medicine</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Dermatology">Dermatology</option>
                <option value="Orthopedics">Orthopedics</option>
              </select>
              <p className="text-xs text-gray-400 mt-2">
                Influences AI SOAP note structuring vocabulary and clinical abbreviations.
              </p>
            </div>
          </div>

          {/* Privacy & DPDP */}
          <div className="glass-card rounded-3xl p-6 lg:p-7 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-lg font-display border-b pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              DPDP Act 2023 Statutory Privacy Controls
            </div>

            <div className="flex items-center justify-between p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 shadow-2xs">
              <div>
                <p className="font-bold text-sm text-gray-900">Automatic PII De-Identification</p>
                <p className="text-xs text-gray-600 mt-0.5">Strips phone numbers, emails, Aadhaar IDs, and PAN numbers before sending audio/text to AI.</p>
              </div>
              <input
                type="checkbox"
                checked={autoScrub}
                onChange={(e) => setAutoScrub(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded-md cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-full shadow-md shadow-emerald-600/20 transition-all text-sm cursor-pointer"
          >
            Save Configuration
          </button>
        </div>

        {/* API Usage & Health Dashboard */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 lg:p-7 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm uppercase tracking-wider">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                API Usage & Health
              </div>
              <button
                onClick={() => fetchUsage(true)}
                disabled={loadingUsage}
                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 rounded-lg transition-all"
                title="Refresh stats"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsage ? "animate-spin text-emerald-600" : ""}`} />
              </button>
            </div>

            {/* Deepgram Nova-3 Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  Deepgram Nova-3
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  usage?.deepgram?.status === "operational" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}>
                  {usage?.deepgram?.status || "Checking..."}
                </span>
              </div>
              
              <div className="bg-gray-50/80 rounded-xl p-3 space-y-2.5 border border-gray-100">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] font-medium text-gray-500">Remaining Balance:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {loadingUsage ? "..." : `$${(usage?.deepgram?.balance ?? 0.00).toFixed(2)}`}
                  </span>
                </div>
                {/* Progress bar based on a standard $200.00 credit or budget */}
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(0, ((usage?.deepgram?.balance ?? 0) / 200) * 100))}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-400 font-medium">
                    <span>$0.00</span>
                    <span>$200.00 max</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-gray-100/60">
                  <div>
                    <p className="text-[9px] text-gray-400 font-medium uppercase">Requests</p>
                    <p className="text-xs font-bold text-gray-800">{usage?.deepgram?.totalRequests ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 font-medium uppercase">Duration</p>
                    <p className="text-xs font-bold text-gray-800">{usage?.deepgram?.totalHours ?? 0} hrs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cloudflare Llama 3.3 Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                  <Cpu className="w-3.5 h-3.5 text-cyan-600" />
                  Cloudflare Llama 3.3
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  usage?.cloudflare?.status === "operational" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}>
                  {usage?.cloudflare?.status || "Checking..."}
                </span>
              </div>

              <div className="bg-gray-50/80 rounded-xl p-3 space-y-2 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-[11px] font-medium text-gray-500">Clinical Summaries:</span>
                  <span className="text-xs font-bold text-gray-900">{usage?.cloudflare?.totalRuns ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] font-medium text-gray-500">Tokens (Est.):</span>
                  <span className="text-xs font-bold text-gray-900">
                    {(usage?.cloudflare?.estimatedTokens ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] font-medium text-gray-500">Neurons (Est.):</span>
                  <span className="text-xs font-bold text-gray-900">
                    {(usage?.cloudflare?.estimatedNeurons ?? Math.round((usage?.cloudflare?.totalRuns ?? 0) * 255)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Supabase Database Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                  <Server className="w-3.5 h-3.5 text-indigo-600" />
                  Supabase DB
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  usage?.database?.status === "connected" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}>
                  {usage?.database?.status || "Checking..."}
                </span>
              </div>

              <div className="bg-gray-50/80 rounded-xl p-3 space-y-2 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-[11px] font-medium text-gray-500">Audited Records:</span>
                  <span className="text-xs font-bold text-gray-900">{usage?.database?.totalConsultations ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
