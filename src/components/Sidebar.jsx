import React from 'react';

export default function Sidebar({ currentSection, onSelectSection, user, orgName, onLogoutClick }) {
  const displayTitle = orgName || 'StockTrack';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'transaction', label: 'Transaction', icon: '📑' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'settings', label: 'Settings & DB', icon: '⚙️' },
  ];

  return (
    <aside className="hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-60 bg-gradient-to-b from-slate-100 via-slate-100/90 to-slate-200 border-r border-slate-300 z-50 p-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-4 mb-3 border-b border-slate-300/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 flex items-center justify-center text-white font-black text-lg shadow-sm">
          S
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-black text-slate-900 text-lg tracking-tight truncate">
            {displayTitle}
          </div>
          {/* <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
            SQLite Pro
          </div> */}
        </div>
      </div>

      {/* Menu Label */}
      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3 py-2">
        Menu
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1.5 flex-1">
        {navItems.map((item) => {
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${isActive
                  ? 'bg-white text-sky-700 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer User Info */}
      {/* <div className="pt-3 flex border-t border-slate-300/80">
        <div
          onClick={onLogoutClick}
          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/70 hover:bg-white border border-slate-300/70 cursor-pointer transition-all"
          title="Click to logout"
        >
        
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold text-slate-800 truncate">
              {user?.username || 'User'}
            </div>
            <div className="text-[10px] font-bold text-rose-500">
              Logout
            </div>
          </div>
        </div>
      </div> */}



      <div className="pt-3 border-t border-slate-200">
        <div
          onClick={onLogoutClick}
          className="
      group
      flex items-center justify-between
      p-3
      rounded-xl
      bg-gradient-to-r from-white to-slate-50
      border border-slate-200
      hover:border-rose-300
      hover:shadow-md
      cursor-pointer
      transition-all duration-200
    "
          title="Logout"
        >
          {/* Left Side */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div
              className="
          w-10 h-10
          rounded-full
          bg-gradient-to-br
          from-blue-500
          to-indigo-600
          flex items-center justify-center
          text-white
          font-bold
          text-sm
          shrink-0
        "
            >
              {(user?.username?.[0] || 'U').toUpperCase()}
            </div>

            {/* User Info */}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">
                {user?.username || 'User'}
              </div>

              <div className="flex items-center gap-2">


              </div>
            </div>
          </div>

          {/* Logout Icon */}
          <div
            className="
        w-9 h-9
        rounded-lg
        flex items-center justify-center
        bg-rose-50
        text-rose-600
        group-hover:bg-rose-100
        transition-all
      "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3h9m0 0l-3-3m3 3l-3 3"
              />
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 px-1 flex items-center justify-between">
          <span className="text-[12px] text-dark-400">
            StockTrack ERP
          </span>

          <span className="text-[12px] text-dark-400">
            Version 1.0.2
          </span>
        </div>
      </div>
    </aside>
  );
}
