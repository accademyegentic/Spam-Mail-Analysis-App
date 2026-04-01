import React from 'react';
import { Mail, Zap } from 'lucide-react';

export default function RootLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen text-slate-900 font-sans">
      {/* Accent bar at top */}
      <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 fixed top-0 left-0 right-0 z-20" />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0.5 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-xl blur-sm opacity-30" />
              <div className="relative bg-gradient-to-br from-indigo-500 to-indigo-700 p-2.5 rounded-xl shadow-md">
                <Mail className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-extrabold bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight tracking-tight">
                MailPulse Analytics
              </h1>
              <p className="text-[10px] text-slate-400 font-medium leading-none tracking-wide uppercase">
                Local Analysis Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Ready
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
              <Zap className="w-3 h-3" />
              v2.0
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
