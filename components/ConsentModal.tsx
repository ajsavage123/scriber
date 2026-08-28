"use client";
import React, { useState } from "react";
import { ShieldCheck, Globe, Check, X } from "lucide-react";

interface ConsentModalProps {
  onConsent: (lang: string) => void;
  onCancel: () => void;
}

export default function ConsentModal({ onConsent, onCancel }: ConsentModalProps) {
  const [lang, setLang] = useState<"en" | "hi" | "te">("en");

  const consentTexts = {
    en: {
      title: "Patient Consent for AI Medical Documentation",
      body: "This consultation is being audio-recorded to assist the physician in generating clinical medical records via AI. Personal identity details (name, phone, IDs) are stripped before processing. You have the right to request deletion of this record at any time under the DPDP Act 2023.",
      agree: "I Consent & Agree",
      cancel: "Decline"
    },
    hi: {
      title: "एआई मेडिकल दस्तावेज़ के लिए मरीज़ की सहमति",
      body: "इस परामर्श को एआई के माध्यम से मेडिकल रिकॉर्ड तैयार करने के लिए रिकॉर्ड किया जा रहा है। प्रसंस्करण से पहले व्यक्तिगत पहचान हटा दी जाती है। आपको डीपीडीपी अधिनियम 2023 के तहत किसी भी समय इसे हटाने का अनुरोध करने का अधिकार है।",
      agree: "मैं सहमत हूँ",
      cancel: "अस्वीकार करें"
    },
    te: {
      title: "AI మెడికల్ రికార్డ్ తయారీకి రోగి సమ్మతి",
      body: "AI ద్వారా వైద్య రికార్డులను రూపొందించడానికి ఈ సంభాషణ రికార్డ్ చేయబడుతోంది. మీ వ్యక్తిగత గుర్తింపు వివరాలు భద్రపరచబడతాయి. DPDP చట్టం 2023 ప్రకారం ఈ రికార్డును తొలగించమని కోరే హక్కు మీకు ఉంది.",
      agree: "నేను అంగీకరిస్తున్నాను",
      cancel: "రద్దు చేయండి"
    }
  };

  const current = consentTexts[lang];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Glassmorphic Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md animate-fade-in-up" 
        style={{ animationDuration: '300ms' }}
        onClick={onCancel}
      ></div>
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-xl glass-card rounded-3xl p-6 sm:p-8 animate-fade-in-up shadow-2xl overflow-hidden"
        style={{ animationDelay: '100ms' }}
      >
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-gray-900 font-bold font-display leading-tight">DPDP Statutory Notice</h3>
              <p className="text-xs text-gray-500 font-medium">Digital Personal Data Protection Act</p>
            </div>
          </div>
          
          <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl self-start sm:self-auto">
            {(["en", "hi", "te"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`relative px-3 py-1.5 text-xs rounded-lg font-bold uppercase tracking-wider transition-all duration-300 ${
                  lang === l 
                    ? "text-gray-900 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                }`}
              >
                {lang === l && (
                  <div className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"></div>
                )}
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="py-8 space-y-4">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">
            {current.title}
          </h2>
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
            {current.body}
          </p>
          
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-6">
            <p className="text-amber-800 text-xs font-semibold flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">ℹ️</span>
              By proceeding, you consent to the processing of voice data to text for the sole purpose of clinical documentation generation.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm"
          >
            <X className="w-4 h-4" />
            {current.cancel}
          </button>
          <button
            onClick={() => onConsent(lang)}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 text-sm"
          >
            <Check className="w-4 h-4" />
            {current.agree}
          </button>
        </div>
      </div>
    </div>
  );
}