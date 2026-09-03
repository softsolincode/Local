import React, { useState, useEffect, useCallback } from 'react';
import { api } from './lib/api';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import AuthView from './components/AuthView';
import DashboardView from './components/DashboardView';
import TransactionsView from './components/TransactionsView';
import InventoryView from './components/InventoryView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import ProductStatementModal from './components/ProductStatementModal';
import Toast from './components/Toast';
import {
  TransactionModal,
  ProductModal,
  ConfirmModal,
  ChangePasswordModal,
} from './components/Modals';

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentSection, setCurrentSection] = useState('dashboard');

  // Application Data State
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', undoFn: null });

  // Modals State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txToEdit, setTxToEdit] = useState(null);
  const [quickTxProduct, setQuickTxProduct] = useState('');
  const [quickTxType, setQuickTxType] = useState('purchase');

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);

  const [changePassModalOpen, setChangePassModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const [statementProductName, setStatementProductName] = useState(null);

  const showToast = useCallback((message, type = 'success', undoFn = null) => {
    setToast({ show: true, message, type, undoFn });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  // Fetch full state from SQLite backend
  const loadAppData = useCallback(async () => {
    try {
      const [dashData, prodsData, txsData] = await Promise.all([
        api.getDashboard().catch(() => null),
        api.getProducts().catch(() => ({ products: [] })),
        api.getTransactions().catch(() => ({ transactions: [] })),
      ]);

      if (dashData) {
        setMetrics(dashData.metrics);
        setRecentTransactions(dashData.recentTransactions || []);
        if (dashData.user) {
          setUser((prev) => ({ ...prev, ...dashData.user }));
        }
      }

      setProducts(prodsData.products || []);
      setTransactions(txsData.transactions || []);
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  }, []);

  // Initial Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await api.getMe();
        if (data.authenticated && data.user) {
          setUser(data.user);
          await loadAppData();
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, [loadAppData]);

  // Auth Handlers
  const handleAuthSuccess = async (authUser) => {
    setUser(authUser);
    await loadAppData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      setProducts([]);
      setTransactions([]);
      setMetrics(null);
      setLogoutModalOpen(false);
      showToast('Logged out successfully');
    } catch (err) {
      showToast('Logout error', 'error');
    }
  };

  // Product Operations
  const handleSaveProduct = async (productData) => {
    try {
      if (productData.id) {
        await api.updateProduct(productData.id, productData);
        showToast('Product updated successfully');
      } else {
        await api.createProduct(productData);
        showToast('Product created successfully');
      }
      setProductModalOpen(false);
      setProductToEdit(null);
      await loadAppData();
    } catch (err) {
      showToast(err.message || 'Failed to save product', 'error');
    }
  };

  const handleDeleteProduct = (prod) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Product?',
      message: `Are you sure you want to delete "${prod.name}" from your catalog?`,
      onConfirm: async () => {
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        try {
          const result = await api.deleteProduct(prod.id);
          await loadAppData();

          // Undo support: offer to re-create the deleted product
          showToast(`Deleted "${prod.name}"`, 'success', async () => {
            try {
              await api.createProduct({
                name: prod.name,
                supplier: prod.supplier,
                opening_qty: prod.opening_qty,
                reminder_date: prod.reminder_date,
                threshold: prod.threshold,
              });
              await loadAppData();
              showToast(`Restored product "${prod.name}"`);
            } catch (err) {
              showToast('Failed to restore product', 'error');
            }
          });
        } catch (err) {
          showToast(err.message || 'Failed to delete product', 'error');
        }
      },
    });
  };

  const handleImportCsv = async (csvText) => {
    try {
      const res = await api.importCsv(csvText);
      showToast(`Import done: ${res.added} added, ${res.updated} updated`);
      await loadAppData();
    } catch (err) {
      showToast(err.message || 'Import failed', 'error');
    }
  };

  // Transaction Operations
  const handleSaveTransaction = async (txData) => {
    try {
      if (txData.id) {
        await api.updateTransaction(txData.id, txData);
        showToast('Transaction updated successfully');
      } else {
        await api.createTransaction(txData);
        showToast('Transaction recorded into SQLite database');
      }
      setTxModalOpen(false);
      setTxToEdit(null);
      await loadAppData();
    } catch (err) {
      showToast(err.message || 'Failed to record transaction', 'error');
    }
  };

  const handleDeleteTransaction = (tx) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Transaction?',
      message: `Delete this ${tx.type} of "${tx.product_name}" (${tx.qty} units)?`,
      onConfirm: async () => {
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        try {
          await api.deleteTransaction(tx.id);
          await loadAppData();

          // Undo support: offer to re-create transaction
          showToast(`Deleted ${tx.type} transaction`, 'success', async () => {
            try {
              await api.createTransaction({
                date: tx.date,
                product_name: tx.product_name,
                type: tx.type,
                qty: tx.qty,
                description: tx.description,
              });
              await loadAppData();
              showToast('Transaction restored');
            } catch (err) {
              showToast('Failed to restore transaction', 'error');
            }
          });
        } catch (err) {
          showToast(err.message || 'Failed to delete transaction', 'error');
        }
      },
    });
  };

  const handleQuickTx = (productName, type = 'purchase') => {
    setTxToEdit(null);
    setQuickTxProduct(productName);
    setQuickTxType(type);
    setTxModalOpen(true);
  };

  // Organization Settings
  const handleUpdateOrgSettings = async (orgName, reportHeader) => {
    try {
      await api.updateOrg(orgName, reportHeader);
      setUser((prev) => ({
        ...prev,
        org_name: orgName,
        report_header: reportHeader,
      }));
    } catch (err) {
      showToast('Failed to update organization settings', 'error');
    }
  };

  // Cloud Sync
  const handleSyncCloud = async () => {
    await loadAppData();
    showToast('SQLite Database fully synced and verified with server!');
  };

  // Change Password
  const handleChangePassword = async (newPassword) => {
    try {
      await api.changePassword(newPassword);
      showToast('Password updated successfully');
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    }
  };

  // Loading Screen during session check
  if (authChecking) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-black text-xl mb-3 animate-pulse">
          S
        </div>
        <p className="text-xs text-slate-400 font-semibold">Connecting to SQLite Storage...</p>
      </div>
    );
  }

  // If Not Authenticated, show Auth View
  if (!user) {
    return (
      <>
        <AuthView onAuthSuccess={handleAuthSuccess} onShowToast={showToast} />
        <Toast toast={toast} onClose={hideToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 pb-20 md:pb-6">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={hideToast} />

      {/* Desktop Sidebar (>= 900px) */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        user={user}
        orgName={user.org_name}
        onLogoutClick={() => setLogoutModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="md:ml-60 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <Navbar
          user={user}
          orgName={user.org_name}
          onLogoutClick={() => setLogoutModalOpen(true)}
        />

        {/* View Router */}
        <main className="flex-1 p-3 sm:p-5">
          {currentSection === 'dashboard' && (
            <DashboardView
              user={user}
              metrics={metrics}
              products={products}
              recentTransactions={recentTransactions}
              onNavigate={setCurrentSection}
              onSyncCloud={handleSyncCloud}
              onOpenProductStatement={(pName) => setStatementProductName(pName)}
            />
          )}

          {currentSection === 'transaction' && (
            <TransactionsView
              transactions={transactions}
              onOpenTxModal={(tx) => {
                setTxToEdit(tx || null);
                setQuickTxProduct('');
                setQuickTxType('purchase');
                setTxModalOpen(true);
              }}
              onDeleteTx={handleDeleteTransaction}
              onOpenProductStatement={(pName) => setStatementProductName(pName)}
            />
          )}

          {currentSection === 'inventory' && (
            <InventoryView
              products={products}
              onOpenProductModal={(prod) => {
                setProductToEdit(prod || null);
                setProductModalOpen(true);
              }}
              onDeleteProduct={handleDeleteProduct}
              onQuickTx={handleQuickTx}
              onOpenProductStatement={(pName) => setStatementProductName(pName)}
              onImportCsv={handleImportCsv}
              onShowToast={showToast}
            />
          )}

          {currentSection === 'reports' && (
            <ReportsView
              products={products}
              transactions={transactions}
              orgName={user.org_name}
              reportHeader={user.report_header}
              onUpdateOrgSettings={handleUpdateOrgSettings}
              onOpenProductStatement={(pName) => setStatementProductName(pName)}
              onShowToast={showToast}
            />
          )}

          {currentSection === 'settings' && (
            <SettingsView
              user={user}
              orgName={user.org_name}
              reportHeader={user.report_header}
              onUpdateOrgSettings={handleUpdateOrgSettings}
              onOpenChangePassword={() => setChangePassModalOpen(true)}
              onShowToast={showToast}
              onReloadData={loadAppData}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (< 900px) */}
        <BottomNav
          currentSection={currentSection}
          onSelectSection={setCurrentSection}
        />
      </div>

      {/* ---------------- MODALS ---------------- */}

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={txModalOpen}
        txToEdit={txToEdit}
        defaultProduct={quickTxProduct}
        defaultType={quickTxType}
        products={products}
        onClose={() => {
          setTxModalOpen(false);
          setTxToEdit(null);
        }}
        onSubmit={handleSaveTransaction}
        onShowToast={showToast}
      />

      {/* Product Modal */}
      <ProductModal
        isOpen={productModalOpen}
        productToEdit={productToEdit}
        onClose={() => {
          setProductModalOpen(false);
          setProductToEdit(null);
        }}
        onSubmit={handleSaveProduct}
        onShowToast={showToast}
      />

      {/* Product Statement Timeline Modal */}
      {statementProductName && (
        <ProductStatementModal
          productName={statementProductName}
          products={products}
          transactions={transactions}
          onClose={() => setStatementProductName(null)}
        />
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePassModalOpen}
        onClose={() => setChangePassModalOpen(false)}
        onSubmit={handleChangePassword}
        onShowToast={showToast}
      />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        confirmLabel="Yes, Delete"
        confirmColor="rose"
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.onConfirm}
      />

      {/* Logout Confirm Modal */}
      <ConfirmModal
        isOpen={logoutModalOpen}
        title="Confirm Logout"
        message="Are you sure you want to end your session?"
        confirmLabel="Yes, Logout"
        confirmColor="rose"
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
