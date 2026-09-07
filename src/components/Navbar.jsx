import React from 'react';

export default function Navbar({ user, orgName, onLogoutClick }) {
  const displayTitle = orgName || 'StockTrack';

  return (
    
   
<div className="">
  <header
    className="
      w-full
      bg-white
      border-b border-slate-200
      shadow-sm
      px-4 py-2.5
      flex justify-between items-center
    "
  >
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-sky-600 to-sky-800 flex items-center justify-center text-white font-black text-base shadow-xs">
        S
      </div>

      <span className="font-extrabold text-slate-900 text-lg tracking-tight truncate">
        {displayTitle}
      </span>
    </div>

    <div
      onClick={onLogoutClick}
      className="
        flex-shrink-0
        flex items-center
        bg-slate-100 hover:bg-slate-200
        border border-slate-200
        px-3 py-1.5
        rounded-full
        cursor-pointer
        transition-all
        select-none
        text-xs font-bold text-slate-700
      "
    >
      Logout
    </div>
  </header>
</div>
  );
}
