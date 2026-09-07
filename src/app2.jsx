// import React, { useState, useEffect, useCallback } from 'react';
// import { api } from './lib/api';
// import Navbar from './components/Navbar';
// import Sidebar from './components/Sidebar';
// import BottomNav from './components/BottomNav';
// import AuthView from './components/AuthView';
// import DashboardView from './components/DashboardView';
// import TransactionsView from './components/TransactionsView';
// import InventoryView from './components/InventoryView';
// import ReportsView from './components/ReportsView';
// import SettingsView from './components/SettingsView';
// import ProductStatementModal from './components/ProductStatementModal';
// import Toast from './components/Toast';
// import {
//   TransactionModal,
//   ProductModal,
//   ConfirmModal,
//   ChangePasswordModal,
// } from './components/Modals';

// export default function App() {
//   const [user, setUser] = useState(null);
//   const [authChecking, setAuthChecking] = useState(true);
//   const [currentSection, setCurrentSection] = useState('dashboard');

//   // Application Data State
//   const [products, setProducts] = useState([]);
//   const [transactions, setTransactions] = useState([]);
//   const [metrics, setMetrics] = useState(null);
//   const [recentTransactions, setRecentTransactions] = useState([]);

//   // Toast State
//   const [toast, setToast] = useState({ show: false, message: '', type: 'success', undoFn: null });
//   const [isPageLoading, setIsPageLoading] = useState(false);

//   // Modals State
//   const [txModalOpen, setTxModalOpen] = useState(false);
//   const [txToEdit, setTxToEdit] = useState(null);
//   const [quickTxProduct, setQuickTxProduct] = useState('');
//   const [quickTxType, setQuickTxType] = useState('purchase');

//   const [productModalOpen, setProductModalOpen] = useState(false);
//   const [productToEdit, setProductToEdit] = useState(null);

//   const [changePassModalOpen, setChangePassModalOpen] = useState(false);
//   const [logoutModalOpen, setLogoutModalOpen] = useState(false);

//   const [deleteConfirm, setDeleteConfirm] = useState({
//     isOpen: false,
//     title: '',
//     message: '',
//     onConfirm: null,
//   });

//   const [statementProductName, setStatementProductName] = useState(null);
//   const [dateRangeTransactions, setDateRangeTransactions] = useState([]);

//   // const showToast = useCallback((message, type = 'success', undoFn = null) => {
//   //   setToast({ show: true, message, type, undoFn });
//   // }, []);

//   // const hideToast = useCallback(() => {
//   //   setToast((prev) => ({ ...prev, show: false }));
//   // }, []);



//   const showToast = useCallback((message, type = 'success', undoFn = null) => {
//     setToast({
//       show: true,
//       message,
//       type,
//       undoFn
//     });
//   }, []);

//   const hideToast = useCallback(() => {
//     setToast((prev) => ({
//       ...prev,
//       show: false
//     }));
//   }, []);

//   useEffect(() => {
//     if (!toast.show) return;

//     const timer = setTimeout(() => {
//       hideToast();
//     }, 2000);

//     return () => clearTimeout(timer);
//   }, [toast.show, hideToast]);




//   const getdash = useCallback(async () => {
//     try {
//       const dashData = await api.getDashboard().catch(() => null)
//       if (dashData) {
//         setMetrics(dashData.metrics);
//         setRecentTransactions((dashData.recentTransactions || []).slice(0, 7));
//         if (dashData.user) {
//           setUser((prev) => ({ ...prev, ...dashData.user }));
//         }
//       }
//     } catch (err) {
//       console.error('Failed to load application data:', err);
//     }

//   }, []);



//   const gettransaction = useCallback(async () => {
//     try {
//       const txsData = await api.getTransactions().catch(() => ({ transactions: [] }))



//       // console.log(dashData , "dadadadadada");


//       // if (dashData) {
//       //   setMetrics(dashData.metrics);


//       //   setRecentTransactions((dashData.recentTransactions || []).slice(0 ,7));
//       //   if (dashData.user) {
//       //     setUser((prev) => ({ ...prev, ...dashData.user }));
//       //   }
//       // }

//       // setProducts(prodsData.products || []);
//       setTransactions(txsData.transactions || []);
//     } catch (err) {
//       console.error('Failed to load application data:', err);
//     }
//   }, []);


//   const GetDateWiseTxs = useCallback(async ({ fromDate,
//     toDate,
//     product }) => {
//     try {
//       const txsData = await api.GetDateWiseTxs({
//         fromDate,
//         toDate,
//         product , 
        
//       }).catch(() => ({ transactions: [] }))
//       // setTransactions(txsData.transactions || []);
// setDateRangeTransactions(txsData.transactions || []);
//     } catch (err) {
//       console.error('Failed to load application data:', err);
//     }
//   }, []);



//   const GetReports = useCallback(async () => {
//     try {
//       const [prodsData, txsData] = await Promise.all([
//         api.getProducts().catch(() => ({ products: [] })),
//         api.getTransactions().catch(() => ({ transactions: [] })),
//       ]);

//       setProducts(prodsData.products || []);
//       setTransactions(txsData.transactions || []);
//     } catch (err) {
//       console.error('Failed to load GetReports data:', err);
//     }
//   }, []);



//   const GetInventory = useCallback(async () => {
//     try {
//       const prodsData = await api.getProducts().catch(() => ({ products: [] }))
//       setProducts(prodsData.products || []);
//     } catch (err) {
//       console.error('Failed to load application data:', err);
//     }
//   }, []);




//   // Fetch full state from SQLite backend
//   const loadAppData = useCallback(async () => {
//     try {
//       const [dashData, prodsData, txsData] = await Promise.all([
//         api.getDashboard().catch(() => null),
//         api.getProducts().catch(() => ({ products: [] })),
//         api.getTransactions().catch(() => ({ transactions: [] })),
//       ]);


//       // console.log(dashData , "dadadadadada");


//       if (dashData) {
//         setMetrics(dashData.metrics);


//         setRecentTransactions((dashData.recentTransactions || []).slice(0, 7));
//         if (dashData.user) {
//           setUser((prev) => ({ ...prev, ...dashData.user }));
//         }
//       }

//       setProducts(prodsData.products || []);
//       setTransactions(txsData.transactions || []);
//     } catch (err) {
//       console.error('Failed to load application data:', err);
//     }
//   }, []);

//   // Initial Auth Check
//   useEffect(() => {
//     const checkAuth = async () => {
//       try {
//         const data = await api.getMe();
//         // console.log(data  ,  "dadada tjahjhjahjsdhahh ");

//         if (data.authenticated && data.user) {
//           setUser(data.user);
//           await loadAppData();
//         } else {
//           setUser(null);
//         }
//       } catch (err) {
//         setUser(null);
//       } finally {
//         setAuthChecking(false);
//       }
//     };
//     checkAuth();
//   }, [loadAppData]);

//   // Auth Handlers
//   const handleAuthSuccess = async (authUser) => {
//     setUser(authUser);
//     await loadAppData();
//   };

//   const handleLogout = async () => {
//     setIsPageLoading(true);
//     try {
//       await api.logout();
//       setUser(null);
//       setProducts([]);
//       setTransactions([]);
//       setMetrics(null);
//       setLogoutModalOpen(false);
//       showToast('Logged out successfully');
//     } catch (err) {
//       showToast('Logout error', 'error');
//     } finally {
//       setIsPageLoading(false);
//     }

//   };

//   // Product Operations
//   const handleSaveProduct = async (productData) => {
//     setIsPageLoading(true);
//     try {
//       if (productData.id) {
//         await api.updateProduct(productData.id, productData);
//         showToast('Product updated successfully');
//       } else {
//         await api.createProduct(productData);
//         showToast('Product created successfully');
//       }
//       setProductModalOpen(false);
//       setProductToEdit(null);
//       GetInventory()
//       // await loadAppData();
//     } catch (err) {
//       showToast(err.message || 'Failed to save product', 'error');
//     }
//     finally {
//       setIsPageLoading(false);
//     }
//   };

//   const handleDeleteProduct = (prod) => {
//     setDeleteConfirm({
//       isOpen: true,
//       title: 'Delete Product?',
//       message: `Are you sure you want to delete "${prod.name}" from your catalog?`,
//       onConfirm: async () => {
//         setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
//         setIsPageLoading(true);
//         try {
//           const result = await api.deleteProduct(prod.id);
//           // await loadAppData();
//           await GetInventory()
//           // Undo support: offer to re-create the deleted product
//           showToast(`Deleted "${prod.name}"`, 'success', async () => {
//             try {
//               await api.createProduct({
//                 name: prod.name,
//                 supplier: prod.supplier,
//                 opening_qty: prod.opening_qty,
//                 reminder_date: prod.reminder_date,
//                 threshold: prod.threshold,
//               });
//               // await loadAppData();
//               await GetInventory()

//               showToast(`Restored product "${prod.name}"`);
//             } catch (err) {
//               showToast('Failed to restore product', 'error');
//             }
//             finally {
//               setIsPageLoading(false);
//             }
//           });
//         } catch (err) {
//           showToast(err.message || 'Failed to delete product', 'error');
//         } finally {
//           setIsPageLoading(false);
//         }
//       },
//     });
//   };

//   const handleImportCsv = async (csvText) => {
//     try {
//       const res = await api.importCsv(csvText);
//       showToast(`Import done: ${res.added} added, ${res.updated} updated`);
//       // await loadAppData();
//     } catch (err) {
//       showToast(err.message || 'Import failed', 'error');
//     }
//   };

//   // Transaction Operations
//   const handleSaveTransaction = async (txData) => {
//     setIsPageLoading(true);
//     try {
//       if (txData.id) {
//         await api.updateTransaction(txData.id, txData);
//         showToast('Transaction updated successfully');
//       } else {
//         await api.createTransaction(txData);
//         showToast('Transaction recorded into SQLite database');
//       }
//       setTxModalOpen(false);
//       setTxToEdit(null);
//       gettransaction()
//       // await loadAppData();
//     } catch (err) {
//       showToast(err.message || 'Failed to record transaction', 'error');
//     } finally {
//       setIsPageLoading(false);
//     }
//   };

//   const handleDeleteTransaction = (tx) => {
//     setIsPageLoading(true);
//     setDeleteConfirm({
//       isOpen: true,
//       title: 'Delete Transaction?',
//       message: `Delete this ${tx.type} of "${tx.product_name}" (${tx.qty} units)?`,
//       onConfirm: async () => {
//         setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
//         try {
//           await api.deleteTransaction(tx.id);
//           await gettransaction()

//           // await loadAppData();



//           // Undo support: offer to re-create transaction
//           showToast(`Deleted ${tx.type} transaction`, 'success', async () => {
//             setIsPageLoading(true);
//             try {
//               await api.createTransaction({
//                 date: tx.date,
//                 product_name: tx.product_name,
//                 type: tx.type,
//                 qty: tx.qty,
//                 description: tx.description,
//               });
//               // await loadAppData();
//               await gettransaction()

//               showToast('Transaction restored');
//             } catch (err) {
//               showToast('Failed to restore transaction', 'error');
//             } finally {
//               setIsPageLoading(false);
//             }
//           });
//         } catch (err) {
//           showToast(err.message || 'Failed to delete transaction', 'error');
//         } finally {
//           setIsPageLoading(false);
//         }
//       },
//     });
//   };

//   const handleQuickTx = (productName, type = 'purchase') => {
//     setTxToEdit(null);
//     setQuickTxProduct(productName);
//     setQuickTxType(type);
//     setTxModalOpen(true);
//   };

//   // Organization Settings
//   const handleUpdateOrgSettings = async (orgName, reportHeader) => {
//     try {
//       await api.updateOrg(orgName, reportHeader);
//       setUser((prev) => ({
//         ...prev,
//         org_name: orgName,
//         report_header: reportHeader,
//       }));
//     } catch (err) {
//       showToast('Failed to update organization settings', 'error');
//     }
//   };

//   // Cloud Sync
//   const handleSyncCloud = async () => {
//     await loadAppData();
//     showToast('SQLite Database fully synced and verified with server!');
//   };

//   // Change Password
//   const handleChangePassword = async (newPassword) => {
//     try {
//       await api.changePassword(newPassword);
//       showToast('Password updated successfully');
//     } catch (err) {
//       showToast(err.message || 'Failed to change password', 'error');
//     }
//   };

//   // Loading Screen during session check
//   if (authChecking) {
//     return (
//       <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white">
//         <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-black text-xl mb-3 animate-pulse">
//           S
//         </div>
//         <p className="text-xs text-slate-400 font-semibold">Loading Please Wait...</p>
//       </div>
//     );
//   }

//   // If Not Authenticated, show Auth View
//   if (!user) {
//     return (
//       <>
//         <AuthView onAuthSuccess={handleAuthSuccess} onShowToast={showToast} />
//         <Toast toast={toast} onClose={hideToast} />
//       </>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-100/60 text-slate-900 pb-20 md:pb-6">


//       {isPageLoading && (
//         <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex flex-col items-center justify-center text-white z-[100] transition-opacity">
//           <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
//           <p className="text-sm font-semibold tracking-wide text-slate-100">Processing, please wait...</p>
//         </div>
//       )}
//       {/* Toast Notification */}
//       <Toast toast={toast} onClose={hideToast} />

//       {/* Desktop Sidebar (>= 900px) */}
//       <Sidebar
//         currentSection={currentSection}
//         onSelectSection={setCurrentSection}
//         user={user}
//         orgName={user.org_name}
//         onLogoutClick={() => setLogoutModalOpen(true)}
//       />

//       {/* Main Content Area */}
//       <div className="md:ml-60 flex flex-col min-h-screen">
//         {/* Top Navbar */}
//         <div className="block md:hidden sticky top-0 left-0 right-0">
//           <Navbar
//             user={user}
//             orgName={user.org_name}
//             onLogoutClick={() => setLogoutModalOpen(true)}
//           />

//         </div>



//         {/* View Router */}
//         <main className="flex-1">
//           {currentSection === 'dashboard' && (
//             <DashboardView
//               user={user}
//               metrics={metrics}
//               products={products}
//               recentTransactions={recentTransactions}
//               onNavigate={setCurrentSection}
//               onSyncCloud={handleSyncCloud}
//               onOpenProductStatement={(pName) => setStatementProductName(pName)}
//               getdash={getdash}
//             />
//           )}

//           {currentSection === 'transaction' && (
//             <TransactionsView
//               transactions={transactions}
//               onOpenTxModal={(tx) => {
//                 setTxToEdit(tx || null);
//                 setQuickTxProduct('');
//                 setQuickTxType('purchase');
//                 setTxModalOpen(true);
//               }}
//               onDeleteTx={handleDeleteTransaction}
//               onOpenProductStatement={(pName) => setStatementProductName(pName)}
//               gettransaction={gettransaction}
//             />
//           )}

//           {currentSection === 'inventory' && (
//             <InventoryView
//               products={products}
//               onOpenProductModal={(prod) => {
//                 setProductToEdit(prod || null);
//                 setProductModalOpen(true);
//               }}
//               onDeleteProduct={handleDeleteProduct}
//               onQuickTx={handleQuickTx}
//               onOpenProductStatement={(pName) => setStatementProductName(pName)}
//               onImportCsv={handleImportCsv}
//               onShowToast={showToast}
//               GetInventory={GetInventory}
//             />
//           )}

//           {currentSection === 'reports' && (
//             <ReportsView
//               products={products}
//               transactions={transactions}
//               orgName={user.org_name}
//               reportHeader={user.report_header}
//               onUpdateOrgSettings={handleUpdateOrgSettings}
//               onOpenProductStatement={(pName) => setStatementProductName(pName)}
//               onShowToast={showToast}
//               GetReports={GetReports}
//               GetDateWiseTxs={GetDateWiseTxs}
//               dateRangeTransactions = {dateRangeTransactions}
//             />
//           )}

//           {currentSection === 'settings' && (
//             <SettingsView
//               user={user}
//               orgName={user.org_name}
//               reportHeader={user.report_header}
//               onUpdateOrgSettings={handleUpdateOrgSettings}
//               onOpenChangePassword={() => setChangePassModalOpen(true)}
//               onShowToast={showToast}
//               onReloadData={loadAppData}
//             />
//           )}
//         </main>

//         {/* Mobile Bottom Navigation Bar (< 900px) */}
//         <BottomNav
//           currentSection={currentSection}
//           onSelectSection={setCurrentSection}
//         />
//       </div>

//       {/* ---------------- MODALS ---------------- */}

//       {/* Transaction Modal */}
//       <TransactionModal
//         isOpen={txModalOpen}
//         txToEdit={txToEdit}
//         defaultProduct={quickTxProduct}
//         defaultType={quickTxType}
//         products={products}
//         onClose={() => {
//           setTxModalOpen(false);
//           setTxToEdit(null);
//         }}
//         onSubmit={handleSaveTransaction}
//         onShowToast={showToast}
//       />

//       {/* Product Modal */}
//       <ProductModal
//         isOpen={productModalOpen}
//         productToEdit={productToEdit}
//         onClose={() => {
//           setProductModalOpen(false);
//           setProductToEdit(null);
//         }}
//         onSubmit={handleSaveProduct}
//         onShowToast={showToast}
//       />

//       {/* Product Statement Timeline Modal */}
//       {statementProductName && (
//         <ProductStatementModal
//           productName={statementProductName}
//           products={products}
//           transactions={transactions}
//           onClose={() => setStatementProductName(null)}
//         />
//       )}

//       {/* Change Password Modal */}
//       <ChangePasswordModal
//         isOpen={changePassModalOpen}
//         onClose={() => setChangePassModalOpen(false)}
//         onSubmit={handleChangePassword}
//         onShowToast={showToast}
//       />

//       {/* Confirm Delete Modal */}
//       <ConfirmModal
//         isOpen={deleteConfirm.isOpen}
//         title={deleteConfirm.title}
//         message={deleteConfirm.message}
//         confirmLabel="Yes, Delete"
//         confirmColor="rose"
//         onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
//         onConfirm={deleteConfirm.onConfirm}
//       />

//       {/* Logout Confirm Modal */}
//       <ConfirmModal
//         isOpen={logoutModalOpen}
//         title="Confirm Logout"
//         message="Are you sure you want to end your session?"
//         confirmLabel="Yes, Logout"
//         confirmColor="rose"
//         onClose={() => setLogoutModalOpen(false)}
//         onConfirm={handleLogout}
//       />
//     </div>
//   );
// }
// // 