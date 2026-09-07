import React, { useState, useRef , useEffect } from 'react';

export default function InventoryView({
  products,
  onOpenProductModal,
  onDeleteProduct,
  onQuickTx,
  onOpenProductStatement,
  onImportCsv,
  onShowToast,
  GetInventory
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.supplier && p.supplier.toLowerCase().includes(q))
    );
  });

  const handleExportCsv = () => {
    if (products.length === 0) {
      onShowToast('No products to export', 'error');
      return;
    }
    const headers = ['name', 'supplier', 'opening_qty', 'reminder_date', 'threshold', 'current_stock'];
    const rows = [headers.join(',')];

    products.forEach((p) => {
      const escapeField = (val) => {
        const s = String(val ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      rows.push(
        [
          p.name,
          p.supplier || '',
          p.opening_qty ?? 0,
          p.reminder_date || '',
          p.threshold ?? 2,
          p.current_stock ?? 0,
        ]
          .map(escapeField)
          .join(',')
      );
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_products_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`Exported ${products.length} products to CSV`);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = String(event.target?.result || '');
        await onImportCsv(text);
      } catch (err) {
        onShowToast('Failed to parse CSV file', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
useEffect(() => {
  GetInventory()
}, [GetInventory])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4 max-w-10xl mx-auto">
      {/* Header & Action Bar */}
      <div className="space-y-3 pb-2 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Product Catalog & Stock
            </h3>
            <p className="text-xs text-slate-500">
              Manage product master records, thresholds, suppliers, and available units
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              ⬆️ Import CSV
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              ⬇️ Export CSV
            </button>
            <button
              onClick={() => onOpenProductModal()}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search product or supplier..."
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-sky-500 focus:bg-white transition-all"
        />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl max-h-[60vh]">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
            <tr>
              <th className="p-2.5">Product Name</th>
              <th className="p-2.5">Supplier</th>
              <th className="p-2.5 text-right">Available Stock</th>
              <th className="p-2.5">Reminder Date</th>
              <th className="p-2.5 text-center">Threshold</th>
              <th className="p-2.5 text-center w-52">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  No products found
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const curStock = item.current_stock ?? 0;
                const threshold = item.threshold ?? 2;
                const isLow = curStock <= threshold;
                const canDelete = curStock === 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td
                      onClick={() => onOpenProductStatement(item.name)}
                      className="p-2.5 font-bold text-slate-900 hover:text-sky-600 cursor-pointer"
                    >
                      {item.name}
                    </td>
                    <td className="p-2.5">
                      {item.supplier ? (
                        <span className="inline-block bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-sky-100">
                          {item.supplier}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td
                      className={`p-2.5 text-right font-black ${
                        isLow ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {curStock.toLocaleString()}{' '}
                      {isLow && (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded ml-1">
                          Low
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                      {item.reminder_date || '-'}
                    </td>
                    <td className="p-2.5 text-center text-slate-600">{threshold}</td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onQuickTx(item.name, 'purchase')}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded cursor-pointer transition-colors"
                          title="Stock In (Purchase)"
                        >
                          ➕ In
                        </button>
                        <button
                          onClick={() => onQuickTx(item.name, 'sales')}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold rounded cursor-pointer transition-colors"
                          title="Stock Out (Sales)"
                        >
                          ➖ Out
                        </button>
                        <button
                          onClick={() => onOpenProductModal(item)}
                          className="px-2 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-[11px] font-bold rounded cursor-pointer transition-colors"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (canDelete) {
                              onDeleteProduct(item);
                            } else {
                              onShowToast(
                                `Cannot delete "${item.name}" — reduce stock to 0 first (currently ${curStock})`,
                                'error'
                              );
                            }
                          }}
                          disabled={!canDelete}
                          className={`px-2 py-1 border text-[11px] font-bold rounded transition-colors ${
                            canDelete
                              ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 cursor-pointer'
                              : 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                          }`}
                          title={
                            canDelete
                              ? 'Delete Product'
                              : `Stock must be 0 to delete (currently ${curStock})`
                          }
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

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No products found
          </div>
        ) : (
          filtered.map((item) => {
            const curStock = item.current_stock ?? 0;
            const threshold = item.threshold ?? 2;
            const isLow = curStock <= threshold;
            const canDelete = curStock === 0;

            return (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span
                    onClick={() => onOpenProductStatement(item.name)}
                    className="font-bold text-slate-900 text-sm hover:text-sky-600 cursor-pointer"
                  >
                    {item.name}
                  </span>
                  <span
                    className={`font-black text-sm ${
                      isLow ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    Stock: {curStock}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>
                    Supplier: {item.supplier || '-'} • Rem: {item.reminder_date || 'None'}
                  </span>
                </div>

                <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-200/60">
                  <button
                    onClick={() => onQuickTx(item.name, 'purchase')}
                    className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded"
                  >
                    ➕ In
                  </button>
                  <button
                    onClick={() => onQuickTx(item.name, 'sales')}
                    className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded"
                  >
                    ➖ Out
                  </button>
                  <button
                    onClick={() => onOpenProductModal(item)}
                    className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-700 font-bold rounded"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      if (canDelete) {
                        onDeleteProduct(item);
                      } else {
                        onShowToast(
                          `Reduce stock to 0 first (currently ${curStock})`,
                          'error'
                        );
                      }
                    }}
                    disabled={!canDelete}
                    className={`px-2.5 py-1 border font-bold rounded ${
                      canDelete
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-slate-100 border-slate-200 text-slate-400 opacity-50'
                    }`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
