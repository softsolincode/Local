import React from 'react';
import jsPDF from 'jspdf';

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

  const downloadPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    // ===== HEADER =====
    // Institute Name
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('STOCK TRACK SYSTEM', pageWidth / 2, y, { align: 'center' });
    y += 7;

    // Report Title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCT STATEMENT', pageWidth / 2, y, { align: 'center' });
    y += 6;

    // Product Name
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Product: ${prod.name}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Divider line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // ===== INFO & SUMMARY =====
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Left: Product Info
    doc.text(`Supplier: ${prod.supplier || 'Unassigned'}`, margin, y);
    doc.text(`Threshold: ${threshold}`, margin + 60, y);
    doc.text(`Opening: ${openingQty}`, margin + 110, y);

    // Right: Summary
    const sumX = pageWidth - 130;
    doc.text(`Purchased: +${totalPurchased}`, sumX, y);
    doc.text(`Sold: -${totalSold}`, sumX + 50, y);
    doc.text(`Balance: ${runningBal}`, sumX + 95, y);
    y += 8;

    // Second divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // ===== TABLE =====
    const colWidths = [30, 32, 32, 32, 'auto'];
    const headers = ['Date', 'Purchase', 'Sales', 'Balance', 'Description'];
    const tableX = margin;
    const tableWidth = pageWidth - (margin * 2);

    // Table Header
    doc.setFillColor(240, 240, 240);
    doc.rect(tableX, y - 2, tableWidth, 8, 'F');

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');

    let x = tableX;
    headers.forEach((header, i) => {
      const align = i >= 1 && i <= 3 ? 'right' : 'left';
      const w = colWidths[i] === 'auto' ? tableWidth - 126 : colWidths[i];
      const tx = align === 'right' ? x + w : x + 2;
      doc.text(header, tx, y + 4, { align });
      x += w;
    });

    y += 10;
    let rowCount = 0;
    const maxRows = Math.floor((pageHeight - y - 20) / 6.5);

    const drawRow = (data, isOpening = false, isEven = false) => {
      // Background
      if (isOpening) {
        doc.setFillColor(245, 245, 245);
      } else if (isEven) {
        doc.setFillColor(248, 248, 248);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(tableX, y - 1.5, tableWidth, 6.5, 'F');

      // Row border
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(tableX, y + 5, tableX + tableWidth, y + 5);

      // Data
      let xPos = tableX;
      data.forEach((val, i) => {
        const align = i >= 1 && i <= 3 ? 'right' : 'left';
        const w = colWidths[i] === 'auto' ? tableWidth - 126 : colWidths[i];

        // Styling
        if (isOpening) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 100, 100);
        } else if (i === 1 && val !== '-') {
          doc.setTextColor(16, 185, 129);
          doc.setFont('helvetica', 'bold');
        } else if (i === 2 && val !== '-') {
          doc.setTextColor(239, 68, 68);
          doc.setFont('helvetica', 'bold');
        } else if (i === 3 && !isOpening) {
          const bal = parseInt(val);
          if (bal <= threshold) {
            doc.setTextColor(220, 38, 38);
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
          }
        } else {
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
        }

        const tx = align === 'right' ? xPos + w : xPos + 2;
        doc.setFontSize(7.5);
        doc.text(val.toString(), tx, y + 4, { align });
        xPos += w;
      });

      y += 6.5;
      rowCount++;
    };

    // Opening Stock
    drawRow(['--', '--', '--', openingQty.toString(), 'Opening Stock'], true);

    // Transactions
    if (statementRows.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('No transactions found', pageWidth / 2, y + 4, { align: 'center' });
    } else {
      statementRows.forEach((row, i) => {
        if (rowCount >= maxRows) {
          doc.addPage();
          y = margin + 10;
          rowCount = 0;

          // Redraw header
          doc.setFillColor(240, 240, 240);
          doc.rect(tableX, y - 2, tableWidth, 8, 'F');
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');

          let xPos = tableX;
          headers.forEach((header, idx) => {
            const align = idx >= 1 && idx <= 3 ? 'right' : 'left';
            const w = colWidths[idx] === 'auto' ? tableWidth - 126 : colWidths[idx];
            const tx = align === 'right' ? xPos + w : xPos + 2;
            doc.text(header, tx, y + 4, { align });
            xPos += w;
          });
          y += 10;
        }

        drawRow([
          row.date,
          row.purQty > 0 ? `+${row.purQty}` : '-',
          row.salQty > 0 ? `-${row.salQty}` : '-',
          row.balanceAfter.toString(),
          row.description || '-'
        ], false, i % 2 === 0);
      });
    }

    // ===== FOOTER =====
    const fy = pageHeight - 10;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(margin, fy - 4, pageWidth - margin, fy - 4);

    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');

    const totalRecords = statementRows.length + 1;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, fy);
    doc.text(`Records: ${totalRecords}`, pageWidth / 2, fy, { align: 'center' });
    doc.text(`Page 1`, pageWidth - margin, fy, { align: 'right' });

    doc.save(`Product_Statement_${prod.name.replace(/\s+/g, '_')}.pdf`);
  };

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
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPDF}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
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