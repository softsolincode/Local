import React from 'react';

export default function Toast({ toast, onUndo, onClose }) {
  if (!toast || !toast.show) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      id="fintrack-toast"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[99999999] min-w-[280px] max-w-[90vw] px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-2xl flex items-center justify-between gap-3 transition-all duration-300 ${
        isSuccess ? 'bg-emerald-600' : isError ? 'bg-rose-600' : 'bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{isSuccess ? '✓' : isError ? '✕' : 'ℹ'}</span>
        <span className="leading-snug">{toast.message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {toast.undoFn && (
          <button
            onClick={() => {
              if (toast.undoFn) toast.undoFn();
              if (onClose) onClose();
            }}
            className="bg-white/25 hover:bg-white/35 border border-white/40 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            UNDO
          </button>
        )}
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white text-xs cursor-pointer px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
