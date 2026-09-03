import React, { useState } from 'react';

export default function TransactionsView({
  transactions,
  onOpenTxModal,
  onDeleteTx,
  onOpenProductStatement,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.product_name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.type.toLowerCase().includes(q) ||
      t.date.includes(q)
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4 max-w-5xl mx-auto">
      {/* Header & Controls */}
      <div className="space-y-3 pb-2 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Transaction Log
            </h3>
            <p className="text-xs text-slate-500">
              All purchase (in) and sales (out) movements logged in your SQLite DB
            </p>
          </div>
          <button
            onClick={() => onOpenTxModal()}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Add Transaction</span>
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search by product, party, type or description..."
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-sky-500 focus:bg-white transition-all"
        />
      </div>

      {/* Desktop Table View (md and up) */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl max-h-[60vh]">
        <table className="w-full text-left border-collapse min-w-[550px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
            <tr>
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Product Name</th>
              <th className="p-2.5">Type</th>
              <th className="p-2.5 text-right">Quantity</th>
              <th className="p-2.5">Description / Party</th>
              <th className="p-2.5 text-center w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isPurchase = item.type === 'purchase';
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-mono text-[11px] text-slate-600">{item.date}</td>
                    <td
                      onClick={() => onOpenProductStatement(item.product_name)}
                      className="p-2.5 font-bold text-slate-900 hover:text-sky-600 cursor-pointer"
                    >
                      {item.product_name}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isPurchase
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td
                      className={`p-2.5 text-right font-black ${
                        isPurchase ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isPurchase ? '+' : '-'}{item.qty}
                    </td>
                    <td className="p-2.5 text-slate-600 truncate max-w-xs">
                      {item.description || '-'}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenTxModal(item)}
                          className="px-2 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-[11px] font-bold rounded cursor-pointer transition-colors"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDeleteTx(item)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold rounded cursor-pointer transition-colors"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No transactions found
          </div>
        ) : (
          filtered.map((item) => {
            const isPurchase = item.type === 'purchase';
            return (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span
                    onClick={() => onOpenProductStatement(item.product_name)}
                    className="font-bold text-slate-900 text-sm hover:text-sky-600 cursor-pointer"
                  >
                    {item.product_name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      isPurchase
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {item.type} ({isPurchase ? '+' : '-'}{item.qty})
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>
                    {item.date} • {item.description || 'No notes'}
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onOpenTxModal(item)}
                      className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 font-bold rounded"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDeleteTx(item)}
                      className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
