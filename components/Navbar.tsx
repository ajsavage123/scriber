"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, History, Settings, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-2 sm:top-3 left-0 right-0 z-50 px-3 sm:px-6 pointer-events-none">
      <div className="max-w-5xl mx-auto pointer-events-auto">
        <nav className="flex justify-between items-center h-12 sm:h-13 px-3 sm:px-5 rounded-full bg-white/85 backdrop-blur-xl border border-slate-200/90 shadow-[0_10px_28px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)]">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200/70 shadow-xs group-hover:shadow-sm transition-all duration-300">
                <Activity className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform duration-300" />
                {/* Glowing dot */}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse border-1.5 border-white shadow-xs"></div>
              </div>
              <span className="self-center text-sm sm:text-base font-display font-bold tracking-tight text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-emerald-600 group-hover:to-cyan-600 transition-all duration-300">
                Ambient Scribe
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links (Soft Pill Capsule) */}
          <div className="hidden md:flex items-center p-1 rounded-full bg-slate-100/90 border border-slate-200/80 my-auto shadow-xs">
            <NavLink href="/" icon={<LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />} label="Dashboard" active={pathname === "/"} />
            <NavLink href="/history" icon={<History className="w-3.5 h-3.5 mr-1.5" />} label="History" active={pathname === "/history"} />
            <NavLink href="/settings" icon={<Settings className="w-3.5 h-3.5 mr-1.5" />} label="Settings" active={pathname === "/settings"} />
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              suppressHydrationWarning
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded-full bg-slate-100/80 text-gray-700 hover:bg-slate-200/80 border border-slate-200/80 transition-colors shadow-xs"
              aria-label="Toggle Menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="pointer-events-auto max-w-sm mx-auto mt-2 bg-white/95 backdrop-blur-2xl border border-slate-200/90 p-3 space-y-1.5 rounded-3xl shadow-2xl animate-fade-in-up">
          <MobileNavLink href="/" icon={<LayoutDashboard className="w-4 h-4 mr-3" />} label="Dashboard" active={pathname === "/"} onClick={() => setMobileOpen(false)} />
          <MobileNavLink href="/history" icon={<History className="w-4 h-4 mr-3" />} label="History" active={pathname === "/history"} onClick={() => setMobileOpen(false)} />
          <MobileNavLink href="/settings" icon={<Settings className="w-4 h-4 mr-3" />} label="Settings" active={pathname === "/settings"} onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
  );
}

function NavLink({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`relative flex items-center px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 group ${
        active 
          ? "text-emerald-700 bg-white shadow-xs border border-slate-200/80" 
          : "text-gray-600 hover:text-emerald-600 hover:bg-white/60"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileNavLink({ href, icon, label, active = false, onClick }: { href: string; icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
        active 
          ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60 shadow-xs" 
          : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}