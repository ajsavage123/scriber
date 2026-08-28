"use client";
import React, { useState } from "react";
import { ShieldCheck, Globe } from "lucide-react";

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
      body: "AI ద్వారా వైద్య రికార్డులను రూపొందించడానికి ఈ సంభాషణ రికార్డ్ చేయబడింది. మీ వ్యక్తిగత గుర్తింపు వివరాలు భద్రపరచబడతాయి. DPDP చట్టం 2023 ప్రకారం ఈ రికార్డును తొలగించమని కోరే హక్కు మీకు ఉంది。",
      agree: "నేను అంగీకరిస్తున్నాను",
      cancel: "రద్దు చేయండి"
    }
  };

  const current = consentTexts[lang];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>DPDP Statutory Notice</span>
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(["en", "hi", "te"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${
                  lang === l ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="my-5 space-y-2">
          <h3 className="text-lg font-bold text-gray-900">{current.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{current.body}</p>
        </div>

        <div className="flex gap-3 pt-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
          >
            {current.cancel}
          </button>
          <button
            onClick={() => onConsent(lang)}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition text-sm shadow-md"
          >
            {current.agree}
          </button>
        </div>
      </div>
    </div>
  );
}