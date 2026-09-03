import React from 'react';

export default function ProductStatementModal({
  productName,
  products,
  transactions,
  onClose,
}) {
  const prod = products.find(
    (p) => p.name.toLowerCase() === productName?.toLowerCase()
  );

  if (!prod) return null;

  const threshold = prod.threshold ?? 2;
  const openingQty = parseInt(prod.opening_qty) || 0;

  // Filter and sort transactions chronologically
  const prodTxs = transactions
    .filter((t) => t.product_name.toLowerCase() === prod.name.toLowerCase())
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBal = openingQty;
  let totalPurchased = 0;
  let totalSold = 0;

  const statementRows = prodTxs.map((t) => {
    const isPur = t.type === 'purchase';
    const q = parseInt(t.qty) || 0;
    if (isPur) {
      runningBal += q;
      totalPurchased += q;
    } else {
      runningBal -= q;
      totalSold += q;
    }
    return {
      ...t,
      purQty: isPur ? q : 0,
      salQty: !isPur ? q : 0,
      balanceAfter: runningBal,
    };
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              ← Back
            </button>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>📒</span> {prod.name}
              </h3>
              <p className="text-[11px] text-slate-500">
                Supplier: {prod.supplier || 'Unassigned'} • Reorder Threshold: {threshold}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Summary Chips */}
        <div className="flex flex-wrap gap-2.5 my-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
          <div>
            📈 Purchased: <span className="font-extrabold text-emerald-600">+{totalPurchased}</span>
          </div>
          <span className="text-slate-300">•</span>
          <div>
            📉 Sold: <span className="font-extrabold text-rose-600">-{totalSold}</span>
          </div>
          <span className="text-slate-300">•</span>
          <div>
            📦 Current Balance:{' '}
            <span
              className={`font-black ${
                runningBal <= threshold ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {runningBal}
            </span>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5 text-right text-emerald-700">Purchase (+)</th>
                <th className="p-2.5 text-right text-rose-700">Sales (-)</th>
                <th className="p-2.5 text-right">Balance</th>
                <th className="p-2.5">Description / Party</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {/* Opening Stock Row */}
              <tr className="bg-slate-100/70 font-bold">
                <td className="p-2.5 font-mono text-slate-500">--</td>
                <td className="p-2.5 text-right text-slate-400">--</td>
                <td className="p-2.5 text-right text-slate-400">--</td>
                <td className="p-2.5 text-right font-extrabold">{openingQty}</td>
                <td className="p-2.5 text-slate-500 text-[11px]">
                  Opening Stock Record
                </td>
              </tr>

              {/* Transactions */}
              {statementRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No purchase or sales movements logged yet
                  </td>
                </tr>
              ) : (
                statementRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono text-[11px] text-slate-600">{row.date}</td>
                    <td className="p-2.5 text-right font-extrabold text-emerald-600">
                      {row.purQty > 0 ? `+${row.purQty}` : '-'}
                    </td>
                    <td className="p-2.5 text-right font-extrabold text-rose-600">
                      {row.salQty > 0 ? `-${row.salQty}` : '-'}
                    </td>
                    <td
                      className={`p-2.5 text-right font-black ${
                        row.balanceAfter <= threshold ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {row.balanceAfter}
                    </td>
                    <td className="p-2.5 text-slate-600 truncate max-w-xs">
                      {row.description || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
