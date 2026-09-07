import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/* ------------------------------------------------------------------ */
/*  Constants & pure helpers                                          */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const qty = (t) => parseInt(t.qty, 10) || 0;

function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const bits = String(dateStr).split('-').map(Number);
  if (bits.length < 3 || bits.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = bits;
  return { year, month: month - 1, day };
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('default', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sumTransactions(txs) {
  let purchased = 0;
  let sold = 0;
  txs.forEach((t) => {
    if (t.type === 'purchase') purchased += qty(t);
    else sold += qty(t);
  });
  return { purchased, sold, net: purchased - sold, count: txs.length };
}

function computeProductStats(products, transactions, productFilter) {
  const list = productFilter && productFilter !== 'ALL'
    ? products.filter((p) => p.name.toLowerCase() === productFilter.toLowerCase())
    : products;

  return list.map((p) => {
    let purchased = 0;
    let sold = 0;
    transactions.forEach((t) => {
      if ((t.product_name || '').toLowerCase() === p.name.toLowerCase()) {
        if (t.type === 'purchase') purchased += qty(t);
        else sold += qty(t);
      }
    });
    const opening = parseInt(p.opening_qty, 10) || 0;
    const available = opening + purchased - sold;
    const threshold = p.threshold ?? 2;
    return { ...p, opening, purchased, sold, available, threshold, isLow: available <= threshold };
  });
}

function getMonthCalendarCells(year, monthIdx) {
  const firstWeekday = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  return cells;
}

function slugify(text) {
  const s = (text || 'report').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return s || 'report';
}

/**
 * Single shared PDF export routine. Clones the given node off-screen so
 * exporting never disturbs the live scroll position, flattens problematic
 * modern CSS colors (oklch etc. that html2canvas can't rasterize), paginates
 * a tall render across as many A4 pages as needed, and stamps a footer with
 * a title + page count on every page.
 */
async function exportNodeToPdf({ node, filename, footerLabel, onError }) {
  if (!node) return false;

  const clone = node.cloneNode(true);
  clone.querySelectorAll('*').forEach((el) => {
    el.style.maxHeight = 'none';
    el.style.height = 'auto';
    el.style.overflow = 'visible';
    el.style.color = '#0f172a';
    el.style.borderColor = '#d1d5db';
  });
  clone.style.position = 'fixed';
  clone.style.left = '-99999px';
  clone.style.top = '0';
  clone.style.width = '1100px';
  clone.style.background = '#ffffff';
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
    heightLeft -= contentHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
      heightLeft -= contentHeight;
    }

    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(footerLabel || '', margin, pageHeight - 4);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
    }

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('PDF export error:', error);
    onError?.(error);
    return false;
  } finally {
    document.body.removeChild(clone);
  }
}

/* ------------------------------------------------------------------ */
/*  Small presentational primitives                                   */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
  };
  return (
    <div className={`rounded-xl border p-3 min-w-[120px] ${tones[tone] || tones.slate}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-black mt-0.5">{value}</div>
    </div>
  );
}

function EmptyState({ icon = '📭', title, message }) {
  return (
    <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
      <span className="text-3xl block mb-2">{icon}</span>
      <h5 className="font-extrabold text-slate-800 text-sm">{title}</h5>
      {message && <p className="text-xs text-slate-500 mt-1">{message}</p>}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
        active
          ? 'bg-sky-100 text-sky-800 border border-sky-300'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

function SubTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
        active
          ? 'bg-sky-600 text-white border-sky-600'
          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function ReportsView({
  products,
  transactions,
  orgName,
  reportHeader,
  onUpdateOrgSettings,
  onOpenProductStatement,
  onShowToast,
  GetReports,
  GetDateWiseTxs,
  dateRangeTransactions,
}) {
  const safeProducts = products || [];
  const safeTransactions = transactions || [];

  // Top-level navigation
  const [activeCategory, setActiveCategory] = useState('inventory'); // inventory | time | supplier
  const [activeReport, setActiveReport] = useState('summary'); // summary | stockledger | lowstock | drilldown | range | supplier

  // Shared filters
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [productSearch, setProductSearch] = useState('');

  // PDF header + export state
  const [customHeader, setCustomHeader] = useState(
    reportHeader || (orgName ? `${orgName} — Inventory Report` : 'Inventory Report')
  );
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportCanvasRef = useRef(null);

  // Custom date-range report
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRangeLoading, setDateRangeLoading] = useState(false);

  // Calendar drilldown: Year -> Month -> Day -> Transactions
  const [drillLevel, setDrillLevel] = useState('year');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD'
  const [jumpDate, setJumpDate] = useState('');

  useEffect(() => {
    GetReports();
  }, [GetReports]);

  useEffect(() => {
    setCustomHeader(reportHeader || (orgName ? `${orgName} — Inventory Report` : 'Inventory Report'));
  }, [reportHeader, orgName]);

  const handleHeaderChange = (val) => {
    setCustomHeader(val);
    onUpdateOrgSettings(orgName, val);
  };

  const suppliers = useMemo(
    () => Array.from(new Set(safeProducts.map((p) => p.supplier).filter(Boolean))),
    [safeProducts]
  );

  const productFilteredTx = useMemo(() => {
    if (selectedProduct === 'ALL') return safeTransactions;
    return safeTransactions.filter(
      (t) => (t.product_name || '').toLowerCase() === selectedProduct.toLowerCase()
    );
  }, [safeTransactions, selectedProduct]);

  const availableYears = useMemo(() => {
    const years = new Set();
    safeTransactions.forEach((t) => {
      const parts = parseDateParts(t.date);
      if (parts) years.add(parts.year);
    });
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [safeTransactions]);

  const todayStr = formatDate(new Date());

  /* ---------------- Calendar drilldown navigation ---------------- */

  const goToYearsLevel = () => {
    setDrillLevel('year');
    setSelectedYear(null);
    setSelectedMonthIndex(null);
    setSelectedDate(null);
  };
  const goToMonthsLevel = (year) => {
    setSelectedYear(year);
    setSelectedMonthIndex(null);
    setSelectedDate(null);
    setDrillLevel('month');
  };
  const goToDaysLevel = (monthIdx) => {
    setSelectedMonthIndex(monthIdx);
    setSelectedDate(null);
    setDrillLevel('day');
  };
  const goToTransactionsLevel = (dStr) => {
    setSelectedDate(dStr);
    setDrillLevel('transactions');
  };
  const handleJumpDate = (value) => {
    setJumpDate(value);
    const parts = parseDateParts(value);
    if (!parts) return;
    setSelectedYear(parts.year);
    setSelectedMonthIndex(parts.month);
    setSelectedDate(value);
    setDrillLevel('transactions');
  };

  /* ---------------- Custom range fetch ---------------- */

  const fetchDateRangeReport = async () => {
    setDateRangeLoading(true);
    try {
      await GetDateWiseTxs({
        fromDate,
        toDate,
        product: selectedProduct === 'ALL' ? 'all' : selectedProduct,
      });
    } catch (error) {
      console.error('Failed to fetch date range transactions:', error);
      onShowToast('Failed to load date range report', 'error');
    } finally {
      setDateRangeLoading(false);
    }
  };

  /* ---------------- PDF export ---------------- */

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    onShowToast('Preparing PDF...');
    const ok = await exportNodeToPdf({
      node: reportCanvasRef.current,
      filename: `${slugify(customHeader)}.pdf`,
      footerLabel: customHeader,
      onError: () => onShowToast('Failed to generate PDF', 'error'),
    });
    if (ok) onShowToast('PDF downloaded successfully!');
    setExportingPdf(false);
  };

  /* ---------------- Subtitle shown above every report ---------------- */

  const getReportSubtitle = () => {
    if (activeCategory === 'inventory') {
      const label = activeReport === 'summary' ? 'Stock Summary'
        : activeReport === 'stockledger' ? 'Stock Ledger'
          : 'Low Stock & Reorder';
      return `${label} • Generated ${todayStr}`;
    }
    if (activeCategory === 'supplier') return `Supplier Stock Grouping • Generated ${todayStr}`;
    if (activeReport === 'range') {
      return `Custom Range • ${fromDate ? formatDate(fromDate) : '—'} to ${toDate ? formatDate(toDate) : '—'}`;
    }
    if (drillLevel === 'year') return 'All Years Overview';
    if (drillLevel === 'month') return `${selectedYear} — Monthly Breakdown`;
    if (drillLevel === 'day') return `${MONTH_NAMES[selectedMonthIndex]} ${selectedYear} — Daily Breakdown`;
    if (drillLevel === 'transactions') return `${formatDate(selectedDate)} — Transactions`;
    return '';
  };

  /* ---------------------------------------------------------------- */
  /*  Report renderers                                                 */
  /* ---------------------------------------------------------------- */

  const renderSummaryReport = () => {
    let rows = computeProductStats(safeProducts, safeTransactions, selectedProduct);
    if (productSearch.trim()) {
      const q = productSearch.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    const totalAvail = rows.reduce((sum, r) => sum + r.available, 0);

    if (rows.length === 0) {
      return <EmptyState title="No products match" message="Try a different product filter or search term." />;
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <StatCard label="Products" value={rows.length} tone="sky" />
          <StatCard label="Total Available" value={`${totalAvail} units`} tone="slate" />
          <StatCard label="Low Stock Alerts" value={rows.filter((r) => r.isLow).length} tone="rose" />
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
              <tr>
                <th className="p-2.5 text-center">S.No</th>
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
              {rows.map((r, index) => (
                <tr
                  key={r.id}
                  onClick={() => onOpenProductStatement(r.name)}
                  className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                >
                  <td className="p-2.5 text-center font-bold">{index + 1}</td>
                  <td className="p-2.5 font-bold text-slate-900">{r.name}</td>
                  <td className="p-2.5 text-slate-600">{r.supplier || '-'}</td>
                  <td className="p-2.5 text-right font-mono">{r.opening}</td>
                  <td className="p-2.5 text-right font-extrabold text-emerald-600">+{r.purchased}</td>
                  <td className="p-2.5 text-right font-extrabold text-rose-600">-{r.sold}</td>
                  <td className={`p-2.5 text-right font-black ${r.isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                    {r.available}
                  </td>
                  <td className="p-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${r.isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
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

  const renderStockLedgerReport = () => {
    let targetProds = selectedProduct === 'ALL'
      ? safeProducts
      : safeProducts.filter((p) => p.name.toLowerCase() === selectedProduct.toLowerCase());
    if (productSearch.trim()) {
      const q = productSearch.trim().toLowerCase();
      targetProds = targetProds.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (targetProds.length === 0) {
      return <EmptyState title="No products match" message="Try a different product filter or search term." />;
    }

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
            <tr>
              <th className="p-2.5 text-center">S.No</th>
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
              let runningBal = parseInt(prod.opening_qty, 10) || 0;
              const prodTxs = safeTransactions
                .filter((t) => (t.product_name || '').toLowerCase() === prod.name.toLowerCase())
                .slice()
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              return (
                <React.Fragment key={prod.id}>
                  <tr
                    onClick={() => onOpenProductStatement(prod.name)}
                    className="bg-slate-100/80 font-bold hover:bg-slate-200/80 cursor-pointer"
                  >
                    <td className="p-2.5 text-center text-slate-400">—</td>
                    <td className="p-2.5 font-mono text-slate-500">--</td>
                    <td className="p-2.5 text-slate-900 font-extrabold">{prod.name} (Opening)</td>
                    <td className="p-2.5 text-slate-600">{prod.supplier || '-'}</td>
                    <td className="p-2.5 text-right text-slate-400">--</td>
                    <td className="p-2.5 text-right text-slate-400">--</td>
                    <td className="p-2.5 text-right font-black">{runningBal}</td>
                    <td className="p-2.5 text-slate-500 text-[11px]">Opening Balance Baseline</td>
                  </tr>

                  {prodTxs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-3 text-center text-slate-400 text-[11px]">
                        No movements recorded
                      </td>
                    </tr>
                  ) : (
                    prodTxs.map((t, index) => {
                      const isPur = t.type === 'purchase';
                      const q = qty(t);
                      runningBal += isPur ? q : -q;

                      return (
                        <tr
                          key={t.id}
                          onClick={() => onOpenProductStatement(prod.name)}
                          className="hover:bg-sky-50/50 cursor-pointer transition-colors"
                        >
                          <td className="p-2.5 text-center font-bold">{index + 1}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">{t.date}</td>
                          <td className="p-2.5 font-bold text-slate-800">{prod.name}</td>
                          <td className="p-2.5 text-slate-500">{prod.supplier || '-'}</td>
                          <td className="p-2.5 text-right font-extrabold text-emerald-600">{isPur ? `+${q}` : '-'}</td>
                          <td className="p-2.5 text-right font-extrabold text-rose-600">{!isPur ? `-${q}` : '-'}</td>
                          <td className={`p-2.5 text-right font-black ${runningBal <= (prod.threshold ?? 2) ? 'text-rose-600' : 'text-slate-900'}`}>
                            {runningBal}
                          </td>
                          <td className="p-2.5 text-slate-600 truncate max-w-xs">{t.description || '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLowStockReport = () => {
    let lowItems = computeProductStats(safeProducts, safeTransactions, 'ALL')
      .filter((p) => p.isLow)
      .map((p) => ({ ...p, reorderQty: Math.max(p.threshold * 2 - p.available, p.threshold, 1) }))
      .sort((a, b) => a.available - b.available);

    if (productSearch.trim()) {
      const q = productSearch.trim().toLowerCase();
      lowItems = lowItems.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (lowItems.length === 0) {
      return (
        <EmptyState
          icon="✅"
          title="All Items Well-Stocked"
          message="No products are currently at or below their reorder threshold."
        />
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <StatCard label="Items Needing Reorder" value={lowItems.length} tone="rose" />
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
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
                  <td className="p-2.5 text-right font-black text-rose-600">{p.available}</td>
                  <td className="p-2.5 text-center font-semibold">{p.threshold}</td>
                  <td className="p-2.5 text-right font-extrabold text-emerald-600">+{p.reorderQty}</td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-600">{p.reminder_date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSupplierReport = () => {
    const grouped = {};
    safeProducts.forEach((p) => {
      const supp = p.supplier || 'Unassigned';
      if (!grouped[supp]) grouped[supp] = [];
      grouped[supp].push(p);
    });

    let suppKeys = Object.keys(grouped);
    if (selectedSupplier !== 'ALL') suppKeys = suppKeys.filter((s) => s === selectedSupplier);

    if (suppKeys.length === 0) {
      return <EmptyState title="No suppliers match" message="Try a different supplier filter." />;
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <StatCard label="Suppliers" value={Object.keys(grouped).length} tone="sky" />
          <StatCard label="Products" value={safeProducts.length} tone="slate" />
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[550px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
              <tr>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5">Product</th>
                <th className="p-2.5 text-right text-emerald-700">Purchased</th>
                <th className="p-2.5 text-right text-rose-700">Sold</th>
                <th className="p-2.5 text-right">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {suppKeys.flatMap((supp) =>
                computeProductStats(grouped[supp], safeTransactions, 'ALL').map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onOpenProductStatement(p.name)}
                    className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                  >
                    <td className="p-2.5 font-bold text-sky-700">{supp}</td>
                    <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                    <td className="p-2.5 text-right font-extrabold text-emerald-600">+{p.purchased}</td>
                    <td className="p-2.5 text-right font-extrabold text-rose-600">-{p.sold}</td>
                    <td className="p-2.5 text-right font-black text-slate-900">{p.available}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBreadcrumb = () => (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-bold flex-wrap">
        <button
          onClick={goToYearsLevel}
          className={drillLevel === 'year' ? 'text-sky-700' : 'text-slate-500 hover:text-sky-700'}
        >
          All Years
        </button>
        {selectedYear != null && (
          <>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => goToMonthsLevel(selectedYear)}
              className={drillLevel === 'month' ? 'text-sky-700' : 'text-slate-500 hover:text-sky-700'}
            >
              {selectedYear}
            </button>
          </>
        )}
        {selectedMonthIndex != null && (
          <>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => goToDaysLevel(selectedMonthIndex)}
              className={drillLevel === 'day' ? 'text-sky-700' : 'text-slate-500 hover:text-sky-700'}
            >
              {MONTH_NAMES[selectedMonthIndex]}
            </button>
          </>
        )}
        {selectedDate && (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800">{formatDate(selectedDate)}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-extrabold text-slate-500 uppercase">Jump to date</label>
        <input
          type="date"
          value={jumpDate}
          onChange={(e) => handleJumpDate(e.target.value)}
          className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
        />
      </div>
    </div>
  );

  const renderCalendarDrilldown = () => {
    if (drillLevel === 'year') {
      const rows = availableYears.map((year) => {
        const txs = productFilteredTx.filter((t) => parseDateParts(t.date)?.year === year);
        return { year, ...sumTransactions(txs) };
      });

      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Select a year to drill into monthly and daily activity.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {rows.map((r) => (
              <button
                key={r.year}
                onClick={() => goToMonthsLevel(r.year)}
                className="text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-sky-400 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="text-sm font-black text-slate-900">{r.year}</div>
                <div className="mt-1.5 flex gap-3 text-[11px] font-bold">
                  <span className="text-emerald-600">+{r.purchased}</span>
                  <span className="text-rose-600">-{r.sold}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{r.count} transactions</div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (drillLevel === 'month' && selectedYear != null) {
      const rows = MONTH_NAMES.map((name, idx) => {
        const txs = productFilteredTx.filter((t) => {
          const p = parseDateParts(t.date);
          return p && p.year === selectedYear && p.month === idx;
        });
        return { idx, name, ...sumTransactions(txs) };
      });

      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Choose a month in {selectedYear} to see its daily breakdown.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.map((r) => (
              <button
                key={r.idx}
                onClick={() => goToDaysLevel(r.idx)}
                disabled={r.count === 0}
                className={`text-left p-3 rounded-xl border transition-all ${
                  r.count === 0
                    ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                    : 'border-slate-200 bg-white hover:border-sky-400 hover:shadow-sm cursor-pointer'
                }`}
              >
                <div className="text-sm font-black text-slate-900">{r.name}</div>
                <div className="mt-1.5 flex gap-3 text-[11px] font-bold">
                  <span className="text-emerald-600">+{r.purchased}</span>
                  <span className="text-rose-600">-{r.sold}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{r.count} transactions</div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (drillLevel === 'day' && selectedYear != null && selectedMonthIndex != null) {
      const cells = getMonthCalendarCells(selectedYear, selectedMonthIndex);
      const dayTotals = {};
      productFilteredTx.forEach((t) => {
        const p = parseDateParts(t.date);
        if (p && p.year === selectedYear && p.month === selectedMonthIndex) {
          if (!dayTotals[p.day]) dayTotals[p.day] = { purchased: 0, sold: 0, count: 0 };
          if (t.type === 'purchase') dayTotals[p.day].purchased += qty(t);
          else dayTotals[p.day].sold += qty(t);
          dayTotals[p.day].count += 1;
        }
      });

      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Pick a date in {MONTH_NAMES[selectedMonthIndex]} {selectedYear} to view that day's transactions.
          </p>
          <div className="grid grid-cols-13 gap-1.5 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-[10px] font-extrabold text-slate-400 uppercase py-1">{w}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} />;
              const totals = dayTotals[day];
              const dStr = dateKey(selectedYear, selectedMonthIndex, day);
              return (
                <button
                  key={dStr}
                  onClick={() => goToTransactionsLevel(dStr)}
                  className={`aspect-square rounded-lg border-2 border-red-300 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-all ${
                    totals
                      ? 'border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100'
                      : 'border-amber-900 bg-white hover:bg-slate-50 text-slate-400'
                  }`}
                >
                  <span className={totals ? 'text-slate-900 font-extrabold' : ''}>{day}</span>
                  {totals && (
                    <span className="flex gap-1 leading-none">
                      {totals.purchased > 0 && <span className="text-emerald-600">+{totals.purchased}</span>}
                      {totals.sold > 0 && <span className="text-rose-600">-{totals.sold}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (drillLevel === 'transactions' && selectedDate) {
      const txs = productFilteredTx
        .filter((t) => t.date === selectedDate)
        .slice()
        .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)));
      const totals = sumTransactions(txs);

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <StatCard label="Date" value={formatDate(selectedDate)} tone="slate" />
            <StatCard label="Purchased" value={`+${totals.purchased}`} tone="emerald" />
            <StatCard label="Sold" value={`-${totals.sold}`} tone="rose" />
            <StatCard label="Net Movement" value={totals.net >= 0 ? `+${totals.net}` : totals.net} tone="sky" />
          </div>

          {txs.length === 0 ? (
            <EmptyState icon="📅" title="No transactions on this date" message="Try a different date." />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 text-center">S.No</th>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-right">Quantity</th>
                    <th className="p-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {txs.map((t, index) => {
                    const isPurchase = t.type === 'purchase';
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onOpenProductStatement(t.product_name)}
                        className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                      >
                        <td className="p-2.5 text-center font-bold">{index + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900">{t.product_name}</td>
                        <td className={`p-2.5 font-extrabold ${isPurchase ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPurchase ? 'Purchase' : 'Sales'}
                        </td>
                        <td className={`p-2.5 text-right font-black ${isPurchase ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPurchase ? `+${qty(t)}` : `-${qty(t)}`}
                        </td>
                        <td className="p-2.5 text-slate-600">{t.description || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const renderCustomRangeReport = () => {
    const txs = dateRangeTransactions || [];
    const totals = sumTransactions(txs);

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="From Date" value={fromDate ? formatDate(fromDate) : '-'} tone="slate" />
          <StatCard label="To Date" value={toDate ? formatDate(toDate) : '-'} tone="slate" />
          <StatCard label="Purchased" value={`+${totals.purchased}`} tone="emerald" />
          <StatCard label="Sold" value={`-${totals.sold}`} tone="rose" />
        </div>

        {txs.length === 0 ? (
          <EmptyState icon="📭" title="No transactions found" message="Pick a date range and hit Apply to generate this report." />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase sticky top-0 z-10">
                <tr>
                  <th className="p-2.5 text-center">S.No</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5 text-right">Quantity</th>
                  <th className="p-2.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {txs.map((t, index) => {
                  const isPurchase = t.type === 'purchase';
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onOpenProductStatement(t.product_name)}
                      className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                    >
                      <td className="p-2.5 text-center font-bold">{index + 1}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">{t.date}</td>
                      <td className="p-2.5 font-bold text-slate-900">{t.product_name}</td>
                      <td className={`p-2.5 font-extrabold ${isPurchase ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPurchase ? 'Purchase' : 'Sales'}
                      </td>
                      <td className={`p-2.5 text-right font-black ${isPurchase ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPurchase ? `+${qty(t)}` : `-${qty(t)}`}
                      </td>
                      <td className="p-2.5 text-slate-600">{t.description || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs max-w-10xl mx-auto h-full flex flex-col overflow-hidden">
      {/* Sticky control header — stays fixed while the report body scrolls below */}
      <div className="shrink-0 bg-white p-4 pb-3 border-b border-slate-100 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Reports & Intelligence</h3>
            <p className="text-xs text-slate-500">
              Stock ledgers, movement summaries, reorder alerts & date drilldowns — export any view to PDF
            </p>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>⬇️</span>
            <span>{exportingPdf ? 'Exporting...' : 'Download PDF'}</span>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Pill
            active={activeCategory === 'inventory'}
            onClick={() => { setActiveCategory('inventory'); setActiveReport('summary'); }}
          >
            📦 Inventory Reports
          </Pill>
          <Pill
            active={activeCategory === 'time'}
            onClick={() => { setActiveCategory('time'); setActiveReport('drilldown'); }}
          >
            📅 Day / Month / Year
          </Pill>
          <Pill
            active={activeCategory === 'supplier'}
            onClick={() => { setActiveCategory('supplier'); setActiveReport('supplier'); }}
          >
            🏢 Supplier Reports
          </Pill>
        </div>

        {/* Sub-report tabs */}
        <div className="flex gap-2 flex-wrap">
          {activeCategory === 'inventory' && (
            <>
              <SubTab active={activeReport === 'summary'} onClick={() => setActiveReport('summary')}>Stock Summary</SubTab>
              <SubTab active={activeReport === 'stockledger'} onClick={() => setActiveReport('stockledger')}>Stock Ledger</SubTab>
              <SubTab active={activeReport === 'lowstock'} onClick={() => setActiveReport('lowstock')}>⚠️ Low Stock & Reorder</SubTab>
            </>
          )}
          {activeCategory === 'time' && (
            <>
              <SubTab active={activeReport === 'drilldown'} onClick={() => setActiveReport('drilldown')}>Calendar Drilldown</SubTab>
              <SubTab active={activeReport === 'range'} onClick={() => setActiveReport('range')}>Custom Range</SubTab>
            </>
          )}
          {activeCategory === 'supplier' && (
            <SubTab active={activeReport === 'supplier'} onClick={() => setActiveReport('supplier')}>Supplier Stock Grouping</SubTab>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
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

          {activeCategory !== 'supplier' && (
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
                {safeProducts.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} {p.supplier ? `(${p.supplier})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeCategory === 'supplier' && (
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
                  <option key={idx} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {activeCategory === 'inventory' && (
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                Search Product Name
              </label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Type to filter rows..."
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
              />
            </div>
          )}

          {activeCategory === 'time' && activeReport === 'range' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                />
              </div>
              <button
                onClick={fetchDateRangeReport}
                disabled={!fromDate || !toDate || dateRangeLoading}
                className="self-end px-4 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
              >
                {dateRangeLoading ? 'Loading...' : 'Apply'}
              </button>
            </div>
          )}
        </div>

        {activeCategory === 'time' && activeReport === 'drilldown' && renderBreadcrumb()}
      </div>

      {/* Scrollable, exportable report canvas */}
      <div ref={reportCanvasRef} data-report-container className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {dateRangeLoading && activeCategory === 'time' && activeReport === 'range' && (
          <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
              <div className="text-sm font-bold text-slate-700">Loading report...</div>
              <div className="text-xs text-slate-500">Fetching transactions for the selected date range</div>
            </div>
          </div>
        )}

        <div className="border-b border-slate-200 pb-2">
          <h4 className="text-lg font-black text-slate-900 tracking-tight">{customHeader}</h4>
          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{getReportSubtitle()}</p>
        </div>

        {activeCategory === 'inventory' && activeReport === 'summary' && renderSummaryReport()}
        {activeCategory === 'inventory' && activeReport === 'stockledger' && renderStockLedgerReport()}
        {activeCategory === 'inventory' && activeReport === 'lowstock' && renderLowStockReport()}
        {activeCategory === 'time' && activeReport === 'drilldown' && renderCalendarDrilldown()}
        {activeCategory === 'time' && activeReport === 'range' && renderCustomRangeReport()}
        {activeCategory === 'supplier' && renderSupplierReport()}
      </div>
    </div>
  );
}
