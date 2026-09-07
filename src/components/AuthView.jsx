import React, { useState } from 'react';
import { api } from '../lib/api';



export default function AuthView({ onAuthSuccess, onShowToast }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const u = username.trim().toLowerCase();
    const p = password.trim();
    const recoveryPin = pin.trim();

    if (!u || !p) {
      onShowToast('Please fill all credentials', 'error');
      return;
    }
    if (p.length < 6) {
      onShowToast('Password must be at least 6 characters', 'error');
      return;
    }

    if (mode === 'register') {
      if (!recoveryPin || recoveryPin.length !== 4 || !/^\d{4}$/.test(recoveryPin)) {
        onShowToast('Enter a valid 4-digit PIN', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        // const res = await fetch('/server/api/auth/register', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   credentials: 'include',
        //   body: JSON.stringify({ username: u, password: p, pin: recoveryPin }),
        // });
        // const data = await res.json();

           const data = await api.register(u, p, recoveryPin);
        // if (!res.ok) throw new Error(data.error || 'Registration failed');
        onShowToast('Account registered successfully with private SQLite DB!');
        onAuthSuccess(data.user);
      } else {
        // const res = await fetch('/api/auth/login', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   credentials: 'include',
        //   body: JSON.stringify({ username: u, password: p }),
        // });
        // const data = await res.json();
        const data = await api.login(u, p);

        // if (!res.ok) throw new Error(data.error || 'Login failed');
        onShowToast('Welcome back!');
        onAuthSuccess(data.user);
      }
    } catch (err) {
      onShowToast(err.message || 'Authentication error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    const u = resetUsername.trim().toLowerCase();
    const p = resetPin.trim();
    const newPass = resetPassword.trim();

    if (!u || !p || !newPass) {
      onShowToast('Please fill all fields', 'error');
      return;
    }
    if (p.length !== 4 || !/^\d{4}$/.test(p)) {
      onShowToast('Enter a valid 4-digit PIN', 'error');
      return;
    }
    if (newPass.length < 6) {
      onShowToast('New password must be at least 6 characters', 'error');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, pin: p, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');
      onShowToast('Password reset successful! Please login.');
      setShowForgotModal(false);
      setResetPassword('');
      setResetPin('');
    } catch (err) {
      onShowToast(err.message || 'Reset failed', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-sm p-7 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 mx-auto flex items-center justify-center text-white font-black text-2xl shadow-md mb-3">
          S
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">StockTrack</h1>
        <p className="text-xs text-slate-500 font-medium mb-6">
          {mode === 'register'
            ? 'Create your account & dedicated SQLite DB'
            : 'Multi-Tenant Inventory & Stock Control'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. store_manager"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 focus:bg-white transition-all"
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                4-Digit Recovery PIN
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 focus:bg-white transition-all tracking-widest text-center"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Used to instantly reset password if forgotten
              </span>
            </div>
          )}

          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 focus:bg-white transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-7 text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Processing...' : mode === 'register' ? 'Register Account' : 'Login'}
          </button>
        </form>

        <div className="flex justify-between items-center mt-5 text-xs">
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-slate-500 hover:text-sky-600 font-bold cursor-pointer"
          >
            Forgot Password?
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
            }}
            className="text-sky-600 hover:text-sky-700 font-extrabold cursor-pointer"
          >
            {mode === 'login' ? 'Create Account' : 'Have account? Login'}
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-left shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter your username, 4-digit recovery PIN, and new password.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">4-Digit PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-Digit PIN"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 tracking-widest text-center"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">New Password</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="New Password (min 6 chars)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {resetLoading ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
