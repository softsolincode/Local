import React from 'react';

export default function Navbar({ user, orgName, onLogoutClick }) {
  const displayTitle = orgName || 'StockTrack';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs px-4 py-2.5 flex justify-between items-center transition-colors">
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-600 to-sky-800 flex items-center justify-center text-white font-black text-base shadow-xs">
          S
        </div>
        <span className="font-extrabold text-slate-900 text-lg tracking-tight">
          {displayTitle}
        </span>
      </div>

      <div className="hidden md:flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          SQLite Engine: <span className="text-slate-800 font-mono font-bold">{user?.database_file || 'user.sqlite'}</span>
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          onClick={onLogoutClick}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-2.5 py-1 rounded-full cursor-pointer transition-all select-none"
          title="Click to logout"
        >
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt="Avatar"
            className="w-6 h-6 rounded-full object-cover border border-slate-300"
          />
          <span className="text-xs font-bold text-slate-700">{user?.username || 'User'}</span>
          <span className="text-[11px] font-extrabold text-rose-500 hover:text-rose-600">Logout</span>
        </div>
      </div>
    </header>
  );
}
