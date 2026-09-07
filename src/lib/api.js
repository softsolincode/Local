/**
 * StockTrack API Client
 * Clean HTTP communication with the SQLite REST API Backend (PHP / Express).
 * Base URL can be configured via import.meta.env.VITE_API_URL or defaults to relative '/api'.
 * Uses HTTP cookies / server sessions without any localStorage token storage.
 */

const API_BASE_URL = "https://stkldg.nimagagi.com/server/api/"


async function request(path, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // Includes HTTP-only session cookies
  };

  try {
    const url = `${API_BASE_URL.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, config);
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      // Server returned HTML (e.g. Apache/Hostinger 404 error page)
      if (!res.ok) {
        throw new Error(
          `Server returned HTTP ${res.status} (${res.statusText}) at ${url}. Please verify that .htaccess rewrite is uploaded to Hostinger public_html and PHP is running.`
        );
      }
      throw new Error(`Invalid response received from API server (not JSON).`);
    }

    if (!res.ok) {
      const errorMsg = data?.error || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  // Auth
  register: (username, password, pin) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, pin }) }),

  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getMe: () =>
    request('/auth/me', { method: 'GET' }),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  resetPin: (username, pin, newPassword) =>
    request('/auth/reset-pin', { method: 'POST', body: JSON.stringify({ username, pin, newPassword }) }),

  changePassword: (newPassword) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),

  updateOrg: (orgName, reportHeader) =>
    request('/auth/update-org', { method: 'POST', body: JSON.stringify({ orgName, reportHeader }) }),

  // Dashboard & Products
  getDashboard: () =>
    request('/dashboard', { method: 'GET' }),

  getProducts: () =>
    request('/products', { method: 'GET' }),

  createProduct: (productData) =>
    request('/products', { method: 'POST', body: JSON.stringify(productData) }),

  updateProduct: (id, productData) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(productData) }),

  deleteProduct: (id) =>
    request(`/products/${id}`, { method: 'DELETE' }),

  importCsv: (csvText) =>
    request('/products/import-csv', { method: 'POST', body: JSON.stringify({ csvText }) }),

  // Transactions
  getTransactions: () =>
    request('/transactions', { method: 'GET' }),

  GetDateWiseTxs: ({ fromDate,
                  toDate,
                  product }) =>
    request('/datetransactions', { method: 'POST', body: JSON.stringify({ fromDate , toDate , product  }) }),

  createTransaction: (txData) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(txData) }),

  updateTransaction: (id, txData) =>
    request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(txData) }),

  deleteTransaction: (id) =>
    request(`/transactions/${id}`, { method: 'DELETE' }),

  // Backups
  getBackup: () =>
    request('/backup', { method: 'GET' }),

  restoreBackup: (backupData, replaceMode = false) =>
    request('/backup/restore', { method: 'POST', body: JSON.stringify({ backupData, replaceMode }) }),
};
