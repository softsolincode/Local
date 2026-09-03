import React, { useState, useEffect } from 'react';

// ---------------- TRANSACTION MODAL ----------------
export function TransactionModal({
  isOpen,
  txToEdit,
  defaultProduct,
  defaultType,
  products,
  onClose,
  onSubmit,
  onShowToast,
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [productName, setProductName] = useState('');
  const [type, setType] = useState('purchase');
  const [qty, setQty] = useState('');
  const [description, setDescription] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (txToEdit) {
        setDate(txToEdit.date || new Date().toISOString().slice(0, 10));
        setProductName(txToEdit.product_name || '');
        setType(txToEdit.type || 'purchase');
        setQty(String(txToEdit.qty || ''));
        setDescription(txToEdit.description || '');
      } else {
        setDate(new Date().toISOString().slice(0, 10));
        setProductName(defaultProduct || '');
        setType(defaultType || 'purchase');
        setQty('');
        setDescription('');
      }
    }
  }, [isOpen, txToEdit, defaultProduct, defaultType]);

  if (!isOpen) return null;

  const currentProd = products.find(
    (p) => p.name.toLowerCase() === productName.trim().toLowerCase()
  );
  const curStock = currentProd ? (currentProd.current_stock ?? 0) : null;

  const handleProductInputChange = (val) => {
    setProductName(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const matches = products.filter((p) =>
      p.name.toLowerCase().includes(val.toLowerCase().trim())
    );
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const handleSelectSuggestion = (name) => {
    setProductName(name);
    setShowSuggestions(false);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const pName = productName.trim();
    const quantity = parseInt(qty) || 0;

    if (!date) {
      onShowToast('Please select a date', 'error');
      return;
    }
    if (!pName || quantity <= 0) {
      onShowToast('Enter valid product name and positive quantity', 'error');
      return;
    }

    const matched = products.find(
      (p) => p.name.toLowerCase() === pName.toLowerCase()
    );
    if (!matched) {
      onShowToast('Product does not exist in inventory catalog. Please add it first.', 'error');
      return;
    }

    // Safety check for sales > available stock
    if (type === 'sales' && curStock !== null) {
      let effectiveStock = curStock;
      if (txToEdit && txToEdit.type === 'sales' && txToEdit.product_name.toLowerCase() === matched.name.toLowerCase()) {
        effectiveStock += parseInt(txToEdit.qty) || 0;
      }

      if (quantity > effectiveStock) {
        const proceed = window.confirm(
          `⚠️ Warning: You are logging a sale of ${quantity} units, but available stock is only ${effectiveStock}.\n\nDo you want to proceed anyway?`
        );
        if (!proceed) return;
      }
    }

    onSubmit({
      id: txToEdit?.id,
      date,
      product_name: matched.name,
      type,
      qty: quantity,
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <h4 className="text-base font-extrabold text-slate-900 mb-3 text-left">
          {txToEdit
            ? '✏️ Edit Transaction'
            : type === 'purchase'
            ? '📥 Stock In (Purchase)'
            : '📤 Stock Out (Sales)'}
        </h4>

        <form onSubmit={handleFormSubmit} className="space-y-3 text-left">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
              required
            />
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-600">Product Name</label>
              {curStock !== null && (
                <span className="text-[10px] font-extrabold text-sky-600">
                  📦 Stock: {curStock}
                </span>
              )}
            </div>
            <input
              type="text"
              value={productName}
              onChange={(e) => handleProductInputChange(e.target.value)}
              onFocus={() => {
                if (productName.trim()) {
                  const matches = products.filter((p) =>
                    p.name.toLowerCase().includes(productName.toLowerCase().trim())
                  );
                  setSuggestions(matches);
                  setShowSuggestions(matches.length > 0);
                }
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Type or search product..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
              required
            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl max-h-36 overflow-y-auto z-20">
                {suggestions.map((p) => (
                  <div
                    key={p.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(p.name);
                    }}
                    className="p-2 text-xs font-bold text-slate-800 hover:bg-sky-50 hover:text-sky-700 cursor-pointer border-b border-slate-100 flex justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Stock: {p.current_stock ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Transaction Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="purchase">Purchase (Stock In)</option>
              <option value="sales">Sales (Stock Out)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Quantity</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Description / Party</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes or party details"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- PRODUCT MODAL ----------------
export function ProductModal({
  isOpen,
  productToEdit,
  onClose,
  onSubmit,
  onShowToast,
}) {
  const [name, setName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [openingQty, setOpeningQty] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [threshold, setThreshold] = useState('2');

  useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        setName(productToEdit.name || '');
        setSupplier(productToEdit.supplier || '');
        setOpeningQty(String(productToEdit.opening_qty ?? ''));
        setReminderDate(productToEdit.reminder_date || '');
        setThreshold(String(productToEdit.threshold ?? 2));
      } else {
        setName('');
        setSupplier('');
        setOpeningQty('');
        setReminderDate('');
        setThreshold('2');
      }
    }
  }, [isOpen, productToEdit]);

  if (!isOpen) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const pName = name.trim();
    if (!pName) {
      onShowToast('Enter product name', 'error');
      return;
    }

    onSubmit({
      id: productToEdit?.id,
      name: pName,
      supplier: supplier.trim(),
      opening_qty: parseInt(openingQty) || 0,
      reminder_date: reminderDate.trim(),
      threshold: parseInt(threshold) || 2,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <h4 className="text-base font-extrabold text-slate-900 mb-3 text-left">
          {productToEdit ? '✏️ Edit Product' : '➕ Add New Product'}
        </h4>

        <form onSubmit={handleFormSubmit} className="space-y-3 text-left">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Widget A"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Supplier Name
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Opening / Initial Quantity
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={openingQty}
              onChange={(e) => setOpeningQty(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Reminder Date
            </label>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Low Stock Warning Threshold
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="2"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- CONFIRM MODAL (Delete / Back / Custom) ----------------
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Yes',
  confirmColor = 'rose',
  onClose,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 text-center shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <h4 className={`text-base font-extrabold mb-1 ${confirmColor === 'rose' ? 'text-rose-600' : 'text-slate-900'}`}>
          {title}
        </h4>
        <p className="text-xs text-slate-600 mb-4">{message}</p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 text-white font-extrabold text-xs rounded-lg transition-colors cursor-pointer ${
              confirmColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- CHANGE PASSWORD MODAL ----------------
export function ChangePasswordModal({ isOpen, onClose, onSubmit, onShowToast }) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.trim().length < 6) {
      onShowToast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(newPassword.trim());
      onClose();
      setNewPassword('');
    } catch (err) {
      onShowToast('Failed to update password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <h4 className="text-base font-extrabold text-sky-700 mb-2 text-left">
          🔒 Change Password
        </h4>
        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              New Password (min 6 chars)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-sky-500"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
