"use client";
import React, { useState, useEffect } from "react";
import { Settings, ShieldCheck, Stethoscope, Cpu, CheckCircle2, Zap, Server } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function SettingsPage() {
  const [specialty, setSpecialty] = useState("General Practice");
  const [autoScrub, setAutoScrub] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("medical_specialty");
    if (saved) setSpecialty(saved);
  }, []);

  const handleSave = () => {
    localStorage.setItem("medical_specialty", specialty);
    addToast("success", "Settings Saved", `Clinical specialty updated to ${specialty}.`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-gray-100 pb-6">
        <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-emerald-600" />
          System Settings & Compliance
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure clinical parameters, API integrations, and statutory DPDP compliance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Settings Panel */}
        <div className="md:col-span-2 space-y-6">
          {/* Clinical Profile */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
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
                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
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
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-lg font-display border-b pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              DPDP Act 2023 Statutory Privacy Controls
            </div>

            <div className="flex items-center justify-between p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <div>
                <p className="font-bold text-sm text-gray-900">Automatic PII De-Identification</p>
                <p className="text-xs text-gray-600 mt-0.5">Strips phone numbers, emails, Aadhaar IDs, and PAN numbers before sending audio/text to AI.</p>
              </div>
              <input
                type="checkbox"
                checked={autoScrub}
                onChange={(e) => setAutoScrub(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-md transition-all text-sm"
          >
            Save Configuration
          </button>
        </div>

        {/* API Health & Integration Panel */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-sm uppercase tracking-wider border-b pb-3">
              <Cpu className="w-4 h-4 text-emerald-600" />
              API Service Health
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  Deepgram Nova-3
                </div>
                <span className="flex items-center gap-1 font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <Cpu className="w-4 h-4 text-cyan-600" />
                  Cloudflare Llama 3.3
                </div>
                <span className="flex items-center gap-1 font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <Server className="w-4 h-4 text-indigo-600" />
                  Supabase ap-south-1
                </div>
                <span className="flex items-center gap-1 font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
