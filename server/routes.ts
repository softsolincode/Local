import { Router, Request, Response, NextFunction } from 'express';
import {
  findUserById,
  registerUser,
  verifyUserLogin,
  resetPasswordWithPin,
  updateUserPassword,
  updateUserOrgSettings,
  createSession,
  getSession,
  deleteSession,
  getUserProducts,
  createUserProduct,
  updateUserProduct,
  deleteUserProduct,
  getUserTransactions,
  createUserTransaction,
  updateUserTransaction,
  deleteUserTransaction,
  getUserDashboardData,
  exportUserBackupData,
  importUserBackupData,
  calculateProductStock,
} from './sqlite-manager';

export const apiRouter = Router();

// Middleware: Authenticate Session
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.stock_session || (req.headers.authorization?.replace('Bearer ', ''));
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No session provided' });
  }

  const session = await getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please login.' });
  }

  const user = await findUserById(session.user_id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  (req as any).user = user;
  (req as any).session = session;
  next();
}

// Wrapper to catch async route errors
export function asyncWrapper(handler: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (err: any) {
      const statusCode = err.status || 500;
      if (!res.headersSent) {
        res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
      }
    }
  };
}

// ---------------- HEALTH CHECK ----------------
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'SQLite Multi-Tenant Store (Node.js & PHP compatible)',
    timestamp: new Date().toISOString(),
  });
});

// ---------------- AUTH ROUTES ----------------

// Register
apiRouter.post(
  '/auth/register',
  asyncWrapper(async (req, res) => {
    const { username, password, pin } = req.body;
    if (!username || !password || !pin) {
      return res.status(400).json({ error: 'Username, password, and 4-digit PIN are required' });
    }

    if (typeof pin !== 'string' || pin.trim().length !== 4 || !/^\d{4}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'Recovery PIN must be exactly 4 numeric digits' });
    }

    try {
      const user = await registerUser(username.trim(), password.trim(), pin.trim());
      const session = await createSession(user.id, user.username);

      res.cookie('stock_session', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        success: true,
        message: 'Account created with dedicated private SQLite database',
        token: session.token,
        user: {
          id: user.id,
          username: user.username,
          org_name: user.org_name,
          report_header: user.report_header,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// Login
apiRouter.post(
  '/auth/login',
  asyncWrapper(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await verifyUserLogin(username.trim(), password.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const session = await createSession(user.id, user.username);

    res.cookie('stock_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: 'Logged in successfully',
      token: session.token,
      user: {
        id: user.id,
        username: user.username,
        org_name: user.org_name,
        report_header: user.report_header,
      },
    });
  })
);

// Get current session
apiRouter.get(
  '/auth/me',
  asyncWrapper(async (req, res) => {
    const token = req.cookies?.stock_session || (req.headers.authorization?.replace('Bearer ', ''));
    if (!token) {
      return res.json({ authenticated: false, user: null });
    }

    const session = await getSession(token);
    if (!session) {
      return res.json({ authenticated: false, user: null });
    }

    const user = await findUserById(session.user_id);
    if (!user) {
      return res.json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        org_name: user.org_name,
        report_header: user.report_header,
        database_file: `user_${user.id}.sqlite`,
      },
    });
  })
);

// Logout
apiRouter.post(
  '/auth/logout',
  asyncWrapper(async (req, res) => {
    const token = req.cookies?.stock_session || (req.headers.authorization?.replace('Bearer ', ''));
    if (token) {
      await deleteSession(token);
    }
    res.clearCookie('stock_session');
    return res.json({ success: true, message: 'Logged out successfully' });
  })
);

// Reset Password with PIN
apiRouter.post(
  '/auth/reset-pin',
  asyncWrapper(async (req, res) => {
    const { username, pin, newPassword } = req.body;
    if (!username || !pin || !newPassword) {
      return res.status(400).json({ error: 'Username, 4-digit PIN, and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
      const user = await resetPasswordWithPin(username.trim(), pin.trim(), newPassword.trim());
      return res.json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.',
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// Change Password for logged in user
apiRouter.post(
  '/auth/change-password',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
      await updateUserPassword(user.id, newPassword);
      return res.json({ success: true, message: 'Password updated successfully' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// Update Org Settings
apiRouter.post(
  '/auth/update-org',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const { orgName, reportHeader } = req.body;

    try {
      const updated = await updateUserOrgSettings(user.id, orgName ?? user.org_name, reportHeader ?? user.report_header);
      return res.json({
        success: true,
        user: {
          id: updated.id,
          username: updated.username,
          org_name: updated.org_name,
          report_header: updated.report_header,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// ---------------- DASHBOARD & AGGREGATE ----------------
apiRouter.get(
  '/dashboard',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const data = await getUserDashboardData(user.id);
    return res.json(data);
  })
);

// ---------------- PRODUCTS CRUD ----------------

// Get all products
apiRouter.get(
  '/products',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const products = await getUserProducts(user.id);
    const transactions = await getUserTransactions(user.id);

    // Calculate dynamic current stock for each product
    const stockMap = new Map<string, number>();
    products.forEach((p) => {
      const initial = parseInt(p.opening_qty) || 0;
      stockMap.set(p.name.toLowerCase(), initial);
    });

    transactions.forEach((t) => {
      const key = t.product_name.toLowerCase();
      const current = stockMap.get(key) ?? 0;
      const q = parseInt(t.qty) || 0;
      if (t.type === 'purchase') {
        stockMap.set(key, current + q);
      } else if (t.type === 'sales') {
        stockMap.set(key, current - q);
      }
    });

    const enriched = products.map((p) => ({
      ...p,
      current_stock: stockMap.get(p.name.toLowerCase()) ?? (parseInt(p.opening_qty) || 0),
    }));

    return res.json({ products: enriched });
  })
);

// Create product
apiRouter.post(
  '/products',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const { name, supplier, opening_qty, reminder_date, threshold } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    try {
      const product = await createUserProduct(user.id, {
        name: name.trim(),
        supplier: supplier?.trim() || '',
        opening_qty: parseInt(opening_qty) || 0,
        reminder_date: reminder_date?.trim() || '',
        threshold: threshold !== undefined ? parseInt(threshold) : 2,
      });

      return res.status(201).json({
        success: true,
        product: {
          ...product,
          current_stock: parseInt(product.opening_qty) || 0,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// Update product
apiRouter.put(
  '/products/:id',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    const { name, supplier, opening_qty, reminder_date, threshold } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    try {
      const product = await updateUserProduct(user.id, id, {
        name: name.trim(),
        supplier: supplier?.trim() || '',
        opening_qty: opening_qty !== undefined ? parseInt(opening_qty) : undefined,
        reminder_date: reminder_date !== undefined ? reminder_date.trim() : undefined,
        threshold: threshold !== undefined ? parseInt(threshold) : undefined,
      });

      const currentStock = await calculateProductStock(user.id, product.name);

      return res.json({
        success: true,
        product: {
          ...product,
          current_stock: currentStock,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// Delete product
apiRouter.delete(
  '/products/:id',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const id = parseInt(req.params.id);

    try {
      const product = await deleteUserProduct(user.id, id);
      return res.json({
        success: true,
        message: 'Product and associated movements deleted',
        product,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// CSV Bulk Import
apiRouter.post(
  '/products/import-csv',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const { csvText } = req.body;
    if (!csvText || !csvText.trim()) {
      return res.status(400).json({ error: 'CSV data is required' });
    }

    const lines = csvText.trim().split(/\r?\n/);
    let added = 0;
    let updated = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Skip header if line has 'name' and 'supplier'
      if (i === 0 && line.toLowerCase().includes('name') && line.toLowerCase().includes('supplier')) {
        continue;
      }

      const parts = line.split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
      const name = parts[0];
      if (!name) continue;

      const supplier = parts[1] || '';
      const opening_qty = parseInt(parts[2]) || 0;
      const reminder_date = parts[3] || '';
      const threshold = parts[4] !== undefined && parts[4] !== '' ? parseInt(parts[4]) : 2;

      const existingProducts = await getUserProducts(user.id);
      const existing = existingProducts.find((p) => p.name.toLowerCase() === name.toLowerCase());

      if (existing) {
        await updateUserProduct(user.id, existing.id, {
          supplier,
          opening_qty,
          reminder_date,
          threshold,
        });
        updated++;
      } else {
        await createUserProduct(user.id, {
          name,
          supplier,
          opening_qty,
          reminder_date,
          threshold,
        });
        added++;
      }
    }

    return res.json({
      success: true,
      message: `CSV imported: ${added} added, ${updated} updated.`,
      added,
      updated,
    });
  })
);

// ---------------- TRANSACTIONS CRUD ----------------

// Get all transactions
apiRouter.get(
  '/transactions',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const transactions = await getUserTransactions(user.id);
    return res.json({ transactions });
  })
);

// Create transaction
apiRouter.post(
  '/transactions',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const { date, product_name, type, qty, description } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    const q = parseInt(qty);
    if (!q || q <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }
    const txType = (type || 'purchase').toLowerCase();
    if (txType !== 'purchase' && txType !== 'sales') {
      return res.status(400).json({ error: 'Type must be purchase or sales' });
    }

    try {
      const tx = await createUserTransaction(user.id, {
        date: date || new Date().toISOString().split('T')[0],
        product_name: product_name.trim(),
        type: txType as 'purchase' | 'sales',
        qty: q,
        description: description?.trim() || '',
      });

      return res.status(201).json({ success: true, transaction: tx });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// Update transaction
apiRouter.put(
  '/transactions/:id',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    const { date, product_name, type, qty, description } = req.body;

    try {
      const tx = await updateUserTransaction(user.id, id, {
        date,
        product_name: product_name?.trim(),
        type,
        qty: qty !== undefined ? parseInt(qty) : undefined,
        description: description !== undefined ? description.trim() : undefined,
      });

      return res.json({ success: true, transaction: tx });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// Delete transaction
apiRouter.delete(
  '/transactions/:id',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    try {
      const tx = await deleteUserTransaction(user.id, id);
      return res.json({ success: true, message: 'Transaction deleted', transaction: tx });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);

// ---------------- BACKUP & RESTORE ----------------

// Backup Export
apiRouter.get(
  '/backup',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const backup = await exportUserBackupData(user.id);
    return res.json(backup);
  })
);

// Backup Restore
apiRouter.post(
  '/backup/restore',
  authMiddleware,
  asyncWrapper(async (req, res) => {
    const user = (req as any).user;
    const { backupData, replaceMode } = req.body;
    try {
      const stats = await importUserBackupData(user.id, backupData, !!replaceMode);
      return res.json({ success: true, message: 'Backup restored successfully', stats });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  })
);
