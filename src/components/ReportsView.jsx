import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ReportsView({
  products,
  transactions,
  orgName,
  reportHeader,
  onUpdateOrgSettings,
  onOpenProductStatement,
  onShowToast,
}) {
  const [activeCategory, setActiveCategory] = useState('inventory'); // 'inventory' | 'daywise' | 'supplier'
  const [activeReport, setActiveReport] = useState('summary'); // 'summary', 'stockledger', 'lowstock', 'daywise', 'monthwise', 'yearwise', 'supplier'
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [customHeader, setCustomHeader] = useState(
    reportHeader || (orgName ? `${orgName} — Inventory Report` : 'StockTrack Inventory Report')
  );
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportTableRef = useRef(null);

  // Extract unique suppliers
  const suppliers = Array.from(
    new Set(products.map((p) => p.supplier).filter((s) => Boolean(s)))
  );

  const handleHeaderChange = (val) => {
    setCustomHeader(val);
    onUpdateOrgSettings(orgName, val);
  };

  const downloadPdf = async () => {
    if (!reportTableRef.current) return;
    setExportingPdf(true);
    onShowToast('Preparing high-res PDF...');

    try {
      const element = reportTableRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      const safeName = (customHeader || 'inventory_report')
        .replace(/[^a-z0-9]+/gi, '_')
        .toLowerCase();
      pdf.save(`${safeName}.pdf`);
      onShowToast('PDF downloaded successfully!');
    } catch (err) {
      console.error(err);
      onShowToast('Failed to generate PDF', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  // ---------------- REPORT CALCULATIONS ----------------

  // 1. Stock Summary
  const renderSummaryReport = () => {
    let filteredProds = products;
    if (selectedProduct !== 'ALL') {
      filteredProds = products.filter(
        (p) => p.name.toLowerCase() === selectedProduct.toLowerCase()
      );
    }

    let totalAvail = 0;
    const rows = filteredProds.map((p) => {
      let pur = 0;
      let sal = 0;
      transactions.forEach((t) => {
        if (t.product_name.toLowerCase() === p.name.toLowerCase()) {
          const q = parseInt(t.qty) || 0;
          if (t.type === 'purchase') pur += q;
          else sal += q;
        }
      });
      const cur = (parseInt(p.opening_qty) || 0) + pur - sal;
      totalAvail += cur;
      const isLow = cur <= (p.threshold ?? 2);

      return {
        ...p,
        purchased: pur,
        sold: sal,
        available: cur,
        isLow,
      };
    });

    return (
      <div className="space-y-3">
        <div className="flex gap-4 text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div>📦 Products: <span className="font-bold">{rows.length}</span></div>
          <div>📊 Total Available: <span className="font-extrabold text-slate-900">{totalAvail} units</span></div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[550px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
              <tr>
                <th className="p-2.5">Product Name</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5 text-right">Opening</th>
                <th className="p-2.5 text-right text-emerald-700">Purchased</th>
                <th className="p-2.5 text-right text-rose-700">Sold</th>
                <th className="p-2.5 text-right">Available</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onOpenProductStatement(r.name)}
                  className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                >
                  <td className="p-2.5 font-bold text-slate-900">{r.name}</td>
                  <td className="p-2.5 text-slate-600">{r.supplier || '-'}</td>
                  <td className="p-2.5 text-right font-mono">{r.opening_qty || 0}</td>
                  <td className="p-2.5 text-right font-extrabold text-emerald-600">+{r.purchased}</td>
                  <td className="p-2.5 text-right font-extrabold text-rose-600">-{r.sold}</td>
                  <td className={`p-2.5 text-right font-black ${r.isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                    {r.available}
                  </td>
                  <td className="p-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        r.isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {r.isLow ? '⚠️ Low' : '✅ OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 2. Stock Ledger
  const renderStockLedgerReport = () => {
    let targetProds = products;
    if (selectedProduct !== 'ALL') {
      targetProds = products.filter(
        (p) => p.name.toLowerCase() === selectedProduct.toLowerCase()
      );
    }

    let grandPurchased = 0;
    let grandSold = 0;

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[60vh]">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Product</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5 text-right text-emerald-700">Purchase (+)</th>
                <th className="p-2.5 text-right text-rose-700">Sales (-)</th>
                <th className="p-2.5 text-right">Balance</th>
                <th className="p-2.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {targetProds.map((prod) => {
                let runningBal = parseInt(prod.opening_qty) || 0;
                const prodTxs = transactions
                  .filter((t) => t.product_name.toLowerCase() === prod.name.toLowerCase())
                  .slice()
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                return (
                  <React.Fragment key={prod.id}>
                    {/* Opening row */}
                    <tr
                      onClick={() => onOpenProductStatement(prod.name)}
                      className="bg-slate-100/80 font-bold hover:bg-slate-200/80 cursor-pointer"
                    >
                      <td className="p-2.5 font-mono text-slate-500">--</td>
                      <td className="p-2.5 text-slate-900 font-extrabold">{prod.name} (Opening)</td>
                      <td className="p-2.5 text-slate-600">{prod.supplier || '-'}</td>
                      <td className="p-2.5 text-right text-slate-400">--</td>
                      <td className="p-2.5 text-right text-slate-400">--</td>
                      <td className="p-2.5 text-right font-black">{runningBal}</td>
                      <td className="p-2.5 text-slate-500 text-[11px]">Opening Balance Baseline</td>
                    </tr>

                    {/* Associated movements */}
                    {prodTxs.map((t) => {
                      const isPur = t.type === 'purchase';
                      const q = parseInt(t.qty) || 0;
                      if (isPur) {
                        runningBal += q;
                        grandPurchased += q;
                      } else {
                        runningBal -= q;
                        grandSold += q;
                      }

                      return (
                        <tr
                          key={t.id}
                          onClick={() => onOpenProductStatement(prod.name)}
                          className="hover:bg-sky-50/50 cursor-pointer transition-colors"
                        >
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">{t.date}</td>
                          <td className="p-2.5 font-bold text-slate-800">{prod.name}</td>
                          <td className="p-2.5 text-slate-500">{prod.supplier || '-'}</td>
                          <td className="p-2.5 text-right font-extrabold text-emerald-600">
                            {isPur ? `+${q}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-extrabold text-rose-600">
                            {!isPur ? `-${q}` : '-'}
                          </td>
                          <td
                            className={`p-2.5 text-right font-black ${
                              runningBal <= (prod.threshold ?? 2) ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {runningBal}
                          </td>
                          <td className="p-2.5 text-slate-600 truncate max-w-xs">{t.description || '-'}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 3. Low Stock & Reorder Report
  const renderLowStockReport = () => {
    const lowItems = products
      .map((p) => {
        let pur = 0;
        let sal = 0;
        transactions.forEach((t) => {
          if (t.product_name.toLowerCase() === p.name.toLowerCase()) {
            const q = parseInt(t.qty) || 0;
            if (t.type === 'purchase') pur += q;
            else sal += q;
          }
        });
        const cur = (parseInt(p.opening_qty) || 0) + pur - sal;
        const th = p.threshold ?? 2;
        const reorderQty = Math.max(th * 2 - cur, th, 1);
        return {
          ...p,
          cur,
          threshold: th,
          reorderQty,
        };
      })
      .filter((p) => p.cur <= p.threshold)
      .sort((a, b) => a.cur - b.cur);

    return (
      <div className="space-y-3">
        {lowItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-3xl block mb-2">✅</span>
            <h5 className="font-extrabold text-slate-800 text-sm">All Items Well-Stocked</h5>
            <p className="text-xs text-slate-500">No products are currently at or below their reorder threshold.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse min-w-[550px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
                <tr>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Supplier</th>
                  <th className="p-2.5 text-right text-rose-700">Available</th>
                  <th className="p-2.5 text-center">Threshold</th>
                  <th className="p-2.5 text-right text-emerald-700">Suggested Reorder</th>
                  <th className="p-2.5">Reminder Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {lowItems.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onOpenProductStatement(p.name)}
                    className="hover:bg-rose-50/60 cursor-pointer transition-colors"
                  >
                    <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                    <td className="p-2.5 text-slate-600">{p.supplier || '-'}</td>
                    <td className="p-2.5 text-right font-black text-rose-600">{p.cur}</td>
                    <td className="p-2.5 text-center font-semibold">{p.threshold}</td>
                    <td className="p-2.5 text-right font-extrabold text-emerald-600">+{p.reorderQty}</td>
                    <td className="p-2.5 font-mono text-[11px] text-slate-600">{p.reminder_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // 4. Time-based Aggregates (Day-wise / Month-wise / Year-wise)
  const renderTimeAggregateReport = (type) => {
    const grouping = {};
    let filteredTxs = transactions;
    if (selectedProduct !== 'ALL') {
      filteredTxs = filteredTxs.filter(
        (t) => t.product_name.toLowerCase() === selectedProduct.toLowerCase()
      );
    }

    filteredTxs.forEach((t) => {
      if (!t.date) return;
      const parts = t.date.split('-');
      if (parts.length < 3) return;
      const [yr, mo] = parts;
      let periodKey = t.date;
      if (type === 'monthwise') periodKey = `${yr}-${mo}`;
      if (type === 'yearwise') periodKey = yr;

      const comboKey = `${periodKey}___${t.product_name}`;
      if (!grouping[comboKey]) {
        grouping[comboKey] = {
          period: periodKey,
          product: t.product_name,
          purchase: 0,
          sales: 0,
          count: 0,
        };
      }
      const q = parseInt(t.qty) || 0;
      if (t.type === 'purchase') grouping[comboKey].purchase += q;
      else grouping[comboKey].sales += q;
      grouping[comboKey].count += 1;
    });

    const keys = Object.keys(grouping).sort().reverse();
    const periodLabel = type === 'daywise' ? 'Date' : type === 'monthwise' ? 'Month' : 'Year';

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
              <tr>
                <th className="p-2.5">{periodLabel}</th>
                <th className="p-2.5">Stock / Product Name</th>
                <th className="p-2.5 text-right text-emerald-700">Purchase (+)</th>
                <th className="p-2.5 text-right text-rose-700">Sales (-)</th>
                <th className="p-2.5 text-right">Net Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No transaction data for this selection
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const item = grouping[k];
                  const net = item.purchase - item.sales;
                  return (
                    <tr
                      key={k}
                      onClick={() => onOpenProductStatement(item.product)}
                      className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                    >
                      <td className="p-2.5 font-mono text-[11px] font-bold text-slate-700">{item.period}</td>
                      <td className="p-2.5 font-bold text-slate-900">
                        {item.product}{' '}
                        <span className="text-[10px] font-semibold text-slate-400">
                          ({item.count} tx)
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-extrabold text-emerald-600">
                        {item.purchase > 0 ? `+${item.purchase}` : '0'}
                      </td>
                      <td className="p-2.5 text-right font-extrabold text-rose-600">
                        {item.sales > 0 ? `-${item.sales}` : '0'}
                      </td>
                      <td
                        className={`p-2.5 text-right font-black ${
                          net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {net >= 0 ? `+${net}` : net}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 5. Supplier-wise Report
  const renderSupplierReport = () => {
    const supplierMap = {};
    products.forEach((p) => {
      const supp = p.supplier || 'Unassigned';
      if (!supplierMap[supp]) supplierMap[supp] = [];
      supplierMap[supp].push(p);
    });

    let suppKeys = Object.keys(supplierMap);
    if (selectedSupplier !== 'ALL') {
      suppKeys = suppKeys.filter((s) => s === selectedSupplier);
    }

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
              <tr>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5">Product</th>
                <th className="p-2.5 text-right text-emerald-700">Purchased</th>
                <th className="p-2.5 text-right text-rose-700">Sold</th>
                <th className="p-2.5 text-right">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {suppKeys.map((supp) => {
                const prods = supplierMap[supp];
                return prods.map((p) => {
                  let pur = 0;
                  let sal = 0;
                  transactions.forEach((t) => {
                    if (t.product_name.toLowerCase() === p.name.toLowerCase()) {
                      const q = parseInt(t.qty) || 0;
                      if (t.type === 'purchase') pur += q;
                      else sal += q;
                    }
                  });
                  const cur = (parseInt(p.opening_qty) || 0) + pur - sal;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onOpenProductStatement(p.name)}
                      className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                    >
                      <td className="p-2.5 font-bold text-sky-700">{supp}</td>
                      <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                      <td className="p-2.5 text-right font-extrabold text-emerald-600">+{pur}</td>
                      <td className="p-2.5 text-right font-extrabold text-rose-600">-{sal}</td>
                      <td className="p-2.5 text-right font-black text-slate-900">{cur}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4 max-w-5xl mx-auto">
      {/* Category Pills Header */}
      <div className="space-y-3 pb-2 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Reports & Intelligence
            </h3>
            <p className="text-xs text-slate-500">
              Generate stock ledgers, movement summaries, reorder alerts & export to PDF
            </p>
          </div>

          <button
            onClick={downloadPdf}
            disabled={exportingPdf}
            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>⬇️</span>
            <span>{exportingPdf ? 'Exporting...' : 'Download PDF'}</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setActiveCategory('inventory');
              setActiveReport('summary');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeCategory === 'inventory'
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📦 Inventory Reports
          </button>
          <button
            onClick={() => {
              setActiveCategory('daywise');
              setActiveReport('daywise');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeCategory === 'daywise'
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📅 Day / Time-wise
          </button>
          <button
            onClick={() => {
              setActiveCategory('supplier');
              setActiveReport('supplier');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeCategory === 'supplier'
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🏢 Supplier Reports
          </button>
        </div>

        {/* Sub-report buttons */}
        <div className="flex gap-2 flex-wrap">
          {activeCategory === 'inventory' && (
            <>
              <button
                onClick={() => setActiveReport('summary')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  activeReport === 'summary'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Stock Summary
              </button>
              <button
                onClick={() => setActiveReport('stockledger')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  activeReport === 'stockledger'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Stock Ledger
              </button>
              <button
                onClick={() => setActiveReport('lowstock')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  activeReport === 'lowstock'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ⚠️ Low Stock & Reorder
              </button>
            </>
          )}

          {activeCategory === 'daywise' && (
            <>
              <button
                onClick={() => setActiveReport('daywise')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  activeReport === 'daywise'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Day-wise
              </button>
              <button
                onClick={() => setActiveReport('monthwise')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  activeReport === 'monthwise'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Month-wise
              </button>
              <button
                onClick={() => setActiveReport('yearwise')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  activeReport === 'yearwise'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Year-wise
              </button>
            </>
          )}

          {activeCategory === 'supplier' && (
            <button
              onClick={() => setActiveReport('supplier')}
              className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                activeReport === 'supplier'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Supplier Stock Grouping
            </button>
          )}
        </div>
      </div>

      {/* Filters & Custom Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
            Report Header Name (for PDF)
          </label>
          <input
            type="text"
            value={customHeader}
            onChange={(e) => handleHeaderChange(e.target.value)}
            placeholder="Company or Report Header"
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
            Filter by Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="ALL">-- All Products --</option>
            {products.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} {p.supplier ? `(${p.supplier})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
            Filter by Supplier
          </label>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="ALL">-- All Suppliers --</option>
            {suppliers.map((s, idx) => (
              <option key={idx} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Printable Report Canvas Area */}
      <div ref={reportTableRef} className="p-3 bg-white space-y-3">
        {/* PDF Header Block */}
        <div className="border-b border-slate-200 pb-2">
          <h4 className="text-lg font-black text-slate-900 tracking-tight">{customHeader}</h4>
          <div className="flex justify-between text-[11px] text-slate-500 font-semibold mt-0.5">
            <span className="capitalize">
              {activeReport.replace(/([A-Z])/g, ' $1')} Analysis
            </span>
            <span>
              Generated on {new Date().toLocaleDateString('default', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Selected Report Content */}
        {activeReport === 'summary' && renderSummaryReport()}
        {activeReport === 'stockledger' && renderStockLedgerReport()}
        {activeReport === 'lowstock' && renderLowStockReport()}
        {(activeReport === 'daywise' || activeReport === 'monthwise' || activeReport === 'yearwise') &&
          renderTimeAggregateReport(activeReport)}
        {activeReport === 'supplier' && renderSupplierReport()}
      </div>
    </div>
  );
}
