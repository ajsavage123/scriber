"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mic, FileText, History, Settings } from "lucide-react";

export default function MobileFooterNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isRecordActive = pathname === "/";
  const isHistoryActive = pathname === "/history";
  const isSettingsActive = pathname === "/settings";

  const handleRecordClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNotesClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      const noteSection = document.getElementById("notes-section") || document.querySelector("article");
      if (noteSection) {
        noteSection.scrollIntoView({ behavior: "smooth" });
      } else {
        // Scroll slightly down to review area if no note yet
        window.scrollTo({ top: 400, behavior: "smooth" });
      }
    } else {
      router.push("/#notes");
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none pb-[max(0.6rem,env(safe-area-inset-bottom))] px-4">
      {/* Background with Soft Floating Dark Glass Pill matching modern iOS UI */}
      <nav 
        className="pointer-events-auto max-w-sm mx-auto bg-slate-950/95 backdrop-blur-2xl border border-slate-700/80 shadow-[0_14px_40px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)] px-3.5 py-2 rounded-full"
        aria-label="Mobile Navigation"
      >
        <div className="flex items-center justify-around">
          {/* 1. Record */}
          <Link
            href="/"
            onClick={handleRecordClick}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 group ${
              isRecordActive
                ? "text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative flex items-center justify-center w-8 h-8">
              <Mic 
                className={`w-6 h-6 transition-transform duration-200 ${
                  isRecordActive ? "scale-110 stroke-[2.25] text-emerald-400" : "group-hover:scale-105 stroke-[1.75]"
                }`} 
              />
              {isRecordActive && (
                <span className="absolute -inset-1 bg-emerald-500/20 rounded-full blur-sm -z-10 animate-pulse"></span>
              )}
            </div>
            <span className={`text-[11px] mt-1 tracking-tight font-medium ${
              isRecordActive ? "font-bold text-emerald-400" : "text-slate-400"
            }`}>
              Record
            </span>
          </Link>

          {/* 2. Notes */}
          <Link
            href="/#notes"
            onClick={handleNotesClick}
            className="flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 text-slate-400 hover:text-slate-200 group"
          >
            <div className="relative flex items-center justify-center w-8 h-8">
              <FileText className="w-6 h-6 group-hover:scale-105 stroke-[1.75] transition-transform duration-200" />
            </div>
            <span className="text-[11px] mt-1 tracking-tight font-medium text-slate-400">
              Notes
            </span>
          </Link>

          {/* 3. History */}
          <Link
            href="/history"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 group ${
              isHistoryActive
                ? "text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative flex items-center justify-center w-8 h-8">
              <History 
                className={`w-6 h-6 transition-transform duration-200 ${
                  isHistoryActive ? "scale-110 stroke-[2.25] text-emerald-400" : "group-hover:scale-105 stroke-[1.75]"
                }`} 
              />
              {isHistoryActive && (
                <span className="absolute -inset-1 bg-emerald-500/20 rounded-full blur-sm -z-10 animate-pulse"></span>
              )}
            </div>
            <span className={`text-[11px] mt-1 tracking-tight font-medium ${
              isHistoryActive ? "font-bold text-emerald-400" : "text-slate-400"
            }`}>
              History
            </span>
          </Link>

          {/* 4. Settings */}
          <Link
            href="/settings"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 group ${
              isSettingsActive
                ? "text-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative flex items-center justify-center w-8 h-8">
              <Settings 
                className={`w-6 h-6 transition-transform duration-200 ${
                  isSettingsActive ? "scale-110 stroke-[2.25] text-emerald-400" : "group-hover:scale-105 stroke-[1.75]"
                }`} 
              />
              {isSettingsActive && (
                <span className="absolute -inset-1 bg-emerald-500/20 rounded-full blur-sm -z-10 animate-pulse"></span>
              )}
            </div>
            <span className={`text-[11px] mt-1 tracking-tight font-medium ${
              isSettingsActive ? "font-bold text-emerald-400" : "text-slate-400"
            }`}>
              Settings
            </span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
