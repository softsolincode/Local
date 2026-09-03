import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

export default function SettingsView({
  user,
  orgName,
  reportHeader,
  onUpdateOrgSettings,
  onOpenChangePassword,
  onShowToast,
  onReloadData,
}) {
  const [currentOrg, setCurrentOrg] = useState(orgName || '');
  const restoreFileRef = useRef(null);

  useEffect(() => {
    setCurrentOrg(orgName || '');
  }, [orgName]);

  const handleSaveOrg = async () => {
    const trimmed = currentOrg.trim();
    try {
      await onUpdateOrgSettings(trimmed, reportHeader);
      onShowToast(trimmed ? 'Organization name updated' : 'Organization name cleared');
    } catch (err) {
      onShowToast('Failed to save organization settings', 'error');
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await api.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stocktrack_backup_${user?.username || 'user'}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('JSON backup downloaded successfully!');
    } catch (err) {
      onShowToast('Failed to export backup', 'error');
    }
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (!Array.isArray(parsed.products) || !Array.isArray(parsed.transactions)) {
          onShowToast("File is not a valid StockTrack JSON backup", "error");
          return;
        }

        const replace = window.confirm(
          `This backup contains ${parsed.products.length} product(s) and ${parsed.transactions.length} transaction(s).\n\n` +
          `Click OK to REPLACE existing records, or Cancel to MERGE them.`
        );

        const result = await api.restoreBackup(parsed, replace);
        onShowToast(result.message || 'Backup restored successfully!');
        if (onReloadData) onReloadData();
      } catch (err) {
        onShowToast('Failed to process backup file', 'error');
      } finally {
        if (restoreFileRef.current) restoreFileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="pb-3 border-b border-slate-100">
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
          System Settings & SQLite Database
        </h3>
        <p className="text-xs text-slate-500">
          Organization branding, database status, and backup & restore management
        </p>
      </div>

      {/* Organization Setup */}
      <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Organization / Company Identity
        </h4>
        <div className="flex gap-2.5 max-w-md">
          <input
            type="text"
            value={currentOrg}
            onChange={(e) => setCurrentOrg(e.target.value)}
            placeholder="e.g. Acme Trading Co."
            className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
          />
          <button
            onClick={handleSaveOrg}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            Save
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Displayed in the navigation bar and applied as the default header for inventory reports.
        </p>
      </div>

      {/* SQLite Architecture Status */}
      <div className="bg-sky-50/70 border border-sky-200 p-4 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>🗄️</span> SQLite Storage Engine
          </h4>
          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
            Active & Isolated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="bg-white p-3 rounded-lg border border-sky-100 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Main System Database</div>
            <div className="font-mono font-bold text-slate-800 text-xs">/data/main.sqlite</div>
            <p className="text-[11px] text-slate-500">
              Stores global accounts, credentials, and session tokens.
            </p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-sky-100 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Dedicated User Database</div>
            <div className="font-mono font-bold text-slate-800 text-xs">
              /data/users/{user?.database_file || 'user.sqlite'}
            </div>
            <p className="text-[11px] text-slate-500">
              Private isolated database storing all your products, movements, and stock records.
            </p>
          </div>
        </div>
      </div>

      {/* Backup & Actions */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Data Management & Account Security
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExportBackup}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left text-xs font-bold text-slate-800 cursor-pointer transition-colors flex items-center justify-between shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <span>📤</span> Export JSON Backup
            </span>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          <input
            type="file"
            ref={restoreFileRef}
            accept=".json,application/json"
            className="hidden"
            onChange={handleRestoreFile}
          />
          <button
            onClick={() => restoreFileRef.current?.click()}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left text-xs font-bold text-slate-800 cursor-pointer transition-colors flex items-center justify-between shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <span>📥</span> Restore Backup
            </span>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          <button
            onClick={onOpenChangePassword}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left text-xs font-bold text-slate-800 cursor-pointer transition-colors flex items-center justify-between shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <span>🔒</span> Change Password
            </span>
            <span className="text-slate-400 text-sm">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
