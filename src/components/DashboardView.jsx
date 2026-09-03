import React, { useState } from 'react';

export default function DashboardView({
  user,
  metrics,
  products,
  recentTransactions,
  onNavigate,
  onSyncCloud,
  onOpenProductStatement,
}) {
  const [showAllLowStock, setShowAllLowStock] = useState(false);

  const totalStock = metrics?.totalStockUnits || 0;
  const totalProducts = metrics?.totalProducts || products?.length || 0;
  const totalIn = metrics?.totalPurchased || 0;
  const totalOut = metrics?.totalSold || 0;
  const reminders = metrics?.reminders || [];
  const lowStock = metrics?.lowStock || [];

  const displayLimit = 3;
  const displayedLowStock = showAllLowStock ? lowStock : lowStock.slice(0, displayLimit);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-sky-900 rounded-2xl p-5 text-white shadow-lg shadow-sky-900/20">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Welcome, {user?.username || 'User'} 👋
            </h2>
            <p className="text-xs text-sky-100 font-medium opacity-90">
              Inventory & Stock Control Overview
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-md border border-white/30 px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Live SQLite Stats
          </div>
        </div>

        {/* Balance Card inside Hero */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/20 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-200 uppercase tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            Total Available Inventory Stock
          </div>
          <div className="flex justify-between items-baseline">
            <div className="text-3xl font-black tracking-tight text-white">
              {totalStock.toLocaleString()} <span className="text-lg font-bold text-sky-200">Units</span>
            </div>
            <div className="text-xs text-sky-200/80 font-semibold">
              Across {totalProducts} items
            </div>
          </div>
        </div>
      </div>

      {/* Reminders Alert */}
      {reminders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <span className="text-base">⏰</span>
          <span>
            Reminder Due for: <span className="font-extrabold text-amber-950">{reminders.join(', ')}</span>
          </span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Stock Summary Metrics
          </h3>
          <button
            onClick={() => onNavigate('inventory')}
            className="text-xs font-bold text-sky-600 hover:text-sky-700 cursor-pointer"
          >
            View Inventory →
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Products Box */}
          <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-sky-600 rounded-xl p-3 flex flex-col justify-between min-h-[75px]">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase">
              <span>Products</span>
              <span>📦</span>
            </div>
            <div className="text-base font-black text-sky-600 my-0.5">
              {totalProducts}
            </div>
            <div className="text-[9px] font-bold text-slate-400">
              Catalog Items
            </div>
          </div>

          {/* Purchased Box */}
          <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-emerald-600 rounded-xl p-3 flex flex-col justify-between min-h-[75px]">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase">
              <span>Purchased</span>
              <span>📈</span>
            </div>
            <div className="text-base font-black text-emerald-600 my-0.5">
              +{totalIn.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-slate-400">
              Total Units In
            </div>
          </div>

          {/* Sold Box */}
          <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-rose-600 rounded-xl p-3 flex flex-col justify-between min-h-[75px]">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase">
              <span>Sold</span>
              <span>📉</span>
            </div>
            <div className="text-base font-black text-rose-600 my-0.5">
              -{totalOut.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-slate-400">
              Total Units Out
            </div>
          </div>
        </div>
      </div>

      {/* Twin CTA Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onSyncCloud}
          className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>☁️</span>
          <span>Sync SQLite Cloud</span>
        </button>
        <button
          onClick={() => onNavigate('transaction')}
          className="py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>📑</span>
          <span>Open Sheet →</span>
        </button>
      </div>

      {/* Lower Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Low Stock Alert */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Low Stock Alert
              </h4>
              <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
                {lowStock.length} Warning{lowStock.length === 1 ? '' : 's'}
              </span>
            </div>

            {lowStock.length === 0 ? (
              <div className="text-xs text-slate-400 font-medium py-3 text-center">
                ✅ All items sufficiently stocked
              </div>
            ) : (
              <div className="space-y-1.5 text-xs font-semibold">
                {displayedLowStock.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenProductStatement(item.name)}
                    className="flex justify-between items-center py-1.5 px-2 bg-rose-50/70 hover:bg-rose-100/80 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="text-rose-900 font-bold">
                      • {item.name}
                    </div>
                    <div className="text-rose-600 font-extrabold text-[11px]">
                      {item.currentStock} left (limit: {item.threshold})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lowStock.length > displayLimit && (
            <button
              onClick={() => setShowAllLowStock(!showAllLowStock)}
              className="mt-2 text-left text-xs font-bold text-sky-600 hover:text-sky-700 cursor-pointer"
            >
              {showAllLowStock ? '▲ View Less' : `+ View More (${lowStock.length - displayLimit} more)`}
            </button>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex justify-between items-center mb-2.5">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Recent Movements
            </h4>
            <button
              onClick={() => onNavigate('transaction')}
              className="text-[11px] font-bold text-sky-600 hover:text-sky-700 cursor-pointer"
            >
              View All
            </button>
          </div>

          {(!recentTransactions || recentTransactions.length === 0) ? (
            <div className="text-xs text-slate-400 font-medium py-3 text-center">
              No movements logged yet
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => {
                const isPurchase = tx.type === 'purchase';
                return (
                  <div
                    key={tx.id}
                    onClick={() => onOpenProductStatement(tx.product_name)}
                    className="py-2 flex items-center justify-between cursor-pointer hover:bg-slate-50 px-1 rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          isPurchase ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isPurchase ? '↓' : '↑'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {tx.product_name}{' '}
                          <span className="text-[10px] text-slate-400 font-normal capitalize">
                            ({tx.type})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">{tx.date}</div>
                      </div>
                    </div>
                    <div
                      className={`text-xs font-extrabold ${
                        isPurchase ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isPurchase ? '+' : '-'}{tx.qty} units
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
