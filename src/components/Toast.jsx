import React, { useEffect } from 'react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast?.show) return;

    // Different durations
    const duration =
      toast.undoFn
        ? 7000 // 7 sec if undo available
        : toast.type === 'error'
        ? 5000 // 5 sec for errors
        : 3000; // 3 sec default

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast?.show) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      id="fintrack-toast"
      className={`
        fixed top-4 right-4
        z-[99999999]
        flex items-center justify-between
        gap-4
        min-w-[320px]
        max-w-[420px]
        px-4 py-3
        rounded-xl
        border
        shadow-2xl
        backdrop-blur-sm
        animate-in slide-in-from-right duration-300
        ${
          isSuccess
            ? 'bg-emerald-700 border-emerald-600 text-white'
            : isError
            ? 'bg-red-700 border-red-600 text-white'
            : 'bg-slate-900 border-slate-700 text-white'
        }
      `}
    >
      {/* Left Section */}
      <div className="flex items-center gap-3 flex-1">
        <div
          className={`
            w-8 h-8
            rounded-full
            flex items-center justify-center
            font-bold
            shrink-0
            ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-300'
                : isError
                ? 'bg-red-500/20 text-red-300'
                : 'bg-slate-500/20 text-slate-300'
            }
          `}
        >
          {isSuccess ? '✓' : isError ? '✕' : 'ℹ'}
        </div>

        <div className="flex flex-col">
          <span className="font-semibold text-sm">
            {isSuccess
              ? 'Success'
              : isError
              ? 'Error'
              : 'Notification'}
          </span>

          <span className="text-sm text-white/90 break-words">
            {toast.message}
          </span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {toast.undoFn && (
          <button
            onClick={() => {
              toast.undoFn();
              onClose();
            }}
            className="
              px-3 py-1.5
              rounded-md
              bg-white/10
              hover:bg-white/20
              text-xs
              font-semibold
              text-white
              transition
              cursor-pointer
            "
          >
            UNDO
          </button>
        )}

        <button
          onClick={onClose}
          className="
            w-8 h-8
            flex items-center justify-center
            rounded-full
            text-white/70
            hover:text-white
            hover:bg-white/10
            transition
            cursor-pointer
          "
        >
          ✕
        </button>
      </div>
    </div>
  );
}