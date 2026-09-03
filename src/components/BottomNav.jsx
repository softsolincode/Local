import React from 'react';

export default function BottomNav({ currentSection, onSelectSection }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'transaction', label: 'Transaction', icon: '📑' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[56px] bg-white border-t border-slate-200 flex justify-around items-center z-40 pb-[env(safe-area-inset-bottom,0px)] shadow-lg">
      {navItems.map((item) => {
        const isActive = currentSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectSection(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer transition-colors ${
              isActive ? 'text-sky-600 font-extrabold' : 'text-slate-500 font-medium'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="text-[10px] leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
