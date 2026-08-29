"use client";
import React, { useState } from "react";
import { ShieldCheck, Check, X } from "lucide-react";

interface ConsentModalProps {
  onConsent: (lang: string) => void;
  onCancel: () => void;
}

export default function ConsentModal({ onConsent, onCancel }: ConsentModalProps) {
  const [lang, setLang] = useState<"en" | "hi" | "te">("en");

  const consentTexts = {
    en: {
      title: "Patient Consent for AI Documentation",
      body: "This consultation is audio-recorded to assist the clinician in generating medical notes via AI. Personal identity details are scrubbed prior to processing. You may request deletion under the DPDP Act 2023.",
      agree: "Consent & Proceed",
      cancel: "Decline"
    },
    hi: {
      title: "एआई मेडिकल दस्तावेज़ के लिए मरीज़ की सहमति",
      body: "इस परामर्श को एआई के माध्यम से मेडिकल रिकॉर्ड तैयार करने के लिए रिकॉर्ड किया जा रहा है। व्यक्तिगत पहचान हटा दी जाती है। आपको डीपीडीपी अधिनियम 2023 के तहत इसे हटाने का अधिकार है।",
      agree: "सहमत हूँ",
      cancel: "अस्वीकार"
    },
    te: {
      title: "AI మెడికల్ రికార్డ్ తయారీకి రోగి సమ్మతి",
      body: "AI ద్వారా వైద్య రికార్డులను రూపొందించడానికి ఈ సంభాషణ రికార్డ్ చేయబడుతోంది. మీ వ్యక్తిగత వివరాలు భద్రపరచబడతాయి. DPDP చట్టం 2023 ప్రకారం దీనిని తొలగించమని కోరవచ్చు.",
      agree: "అంగీకరిస్తున్నాను",
      cancel: "రద్దు"
    }
  };

  const current = consentTexts[lang];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      {/* Glassmorphic Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-fade-in-up" 
        style={{ animationDuration: '200ms' }}
        onClick={onCancel}
      ></div>
      
      {/* Modal Card with Soft Rounded Curves */}
      <div 
        className="relative w-full max-w-md bg-white rounded-[32px] p-5 sm:p-7 animate-fade-in-up shadow-2xl overflow-hidden border border-slate-200/90 max-h-[92vh] flex flex-col justify-between"
      >
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">DPDP Statutory Notice</h3>
              <p className="text-[10px] text-slate-400 font-medium">Digital Personal Data Protection</p>
            </div>
          </div>
          
          {/* Language Selector Tabs (Soft Pill) */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-full shrink-0 border border-slate-200/60">
            {(["en", "hi", "te"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 text-[11px] rounded-full font-bold uppercase transition-all cursor-pointer ${
                  lang === l 
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/60" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="py-4 space-y-3 overflow-y-auto">
          <h2 className="text-sm sm:text-base font-display font-bold text-slate-900 leading-snug">
            {current.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            {current.body}
          </p>
          
          <div className="bg-emerald-50/80 border border-emerald-100/90 rounded-2xl p-3 mt-1 shadow-xs">
            <p className="text-emerald-800 text-[11px] font-medium leading-snug flex items-start gap-2">
              <span className="text-emerald-600 shrink-0 mt-0.5">🔒</span>
              <span>Audio is processed strictly for note generation. Personal identifiers (PII) are scrubbed.</span>
            </p>
          </div>
        </div>

        {/* Action Buttons (Soft Curved Pills) */}
        <div className="flex items-center gap-3 pt-3.5 border-t border-slate-100 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 border border-slate-200 text-slate-700 font-bold rounded-full hover:bg-slate-50 transition-all text-xs cursor-pointer shadow-xs"
          >
            <X className="w-4 h-4" />
            {current.cancel}
          </button>
          <button
            onClick={() => onConsent(lang)}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-full shadow-md shadow-emerald-500/20 transition-all text-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            {current.agree}
          </button>
        </div>
      </div>
    </div>
  );
}