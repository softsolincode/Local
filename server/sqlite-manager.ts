import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import crypto from 'crypto';

let SQL: SqlJsStatic | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const MAIN_DB_PATH = path.join(DATA_DIR, 'main.sqlite');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_DIR)) {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

// In-memory cache of opened SQLite databases
const userDbCache = new Map<number, { db: Database; lastAccessed: number }>();
let mainDb: Database | null = null;

export async function getSqlEngine(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

function saveDbToFile(db: Database, filePath: string) {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.error(`Failed to persist SQLite database to ${filePath}:`, err);
  }
}

export async function getMainDb(): Promise<Database> {
  if (mainDb) return mainDb;
  const sql = await getSqlEngine();

  if (fs.existsSync(MAIN_DB_PATH)) {
    const fileBuffer = fs.readFileSync(MAIN_DB_PATH);
    mainDb = new sql.Database(fileBuffer);
  } else {
    mainDb = new sql.Database();
  }

  // Initialize main DB schema
  mainDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      org_name TEXT DEFAULT '',
      report_header TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
  `);

  saveDbToFile(mainDb, MAIN_DB_PATH);
  return mainDb;
}

export function saveMainDb() {
  if (mainDb) {
    saveDbToFile(mainDb, MAIN_DB_PATH);
  }
}

export async function getUserDb(userId: number): Promise<Database> {
  const cached = userDbCache.get(userId);
  if (cached) {
    cached.lastAccessed = Date.now();
    return cached.db;
  }

  const sql = await getSqlEngine();
  const userDbPath = path.join(USERS_DIR, `user_${userId}.sqlite`);

  let db: Database;
  if (fs.existsSync(userDbPath)) {
    const buffer = fs.readFileSync(userDbPath);
    db = new sql.Database(buffer);
  } else {
    db = new sql.Database();
  }

  // Initialize user DB schema
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      supplier TEXT DEFAULT '',
      opening_qty INTEGER DEFAULT 0,
      reminder_date TEXT DEFAULT '',
      threshold INTEGER DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      product_name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'purchase' or 'sales'
      qty INTEGER NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  saveDbToFile(db, userDbPath);
  userDbCache.set(userId, { db, lastAccessed: Date.now() });
  return db;
}

export function saveUserDb(userId: number) {
  const cached = userDbCache.get(userId);
  if (cached) {
    const userDbPath = path.join(USERS_DIR, `user_${userId}.sqlite`);
    saveDbToFile(cached.db, userDbPath);
  }
}

// Utility: Hash strings with SHA-256
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ---------------- USER & AUTH MANAGEMENT ----------------

export async function findUserByUsername(username: string) {
  const main = await getMainDb();
  const stmt = main.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`);
  stmt.bind([username.trim()]);
  let user: any = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();
  return user;
}

export async function findUserById(id: number) {
  const main = await getMainDb();
  const stmt = main.prepare(`SELECT * FROM users WHERE id = ?`);
  stmt.bind([id]);
  let user: any = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();
  return user;
}

export async function registerUser(username: string, password: string, pin: string) {
  const existing = await findUserByUsername(username);
  if (existing) {
    throw new Error('Username already exists. Please choose a different username.');
  }

  const passHash = sha256(password);
  const pinHash = sha256(pin);

  const main = await getMainDb();
  main.run(
    `INSERT INTO users (username, password_hash, pin_hash, org_name, report_header, created_at, last_login)
     VALUES (?, ?, ?, '', '', datetime('now'), datetime('now'))`,
    [username.trim(), passHash, pinHash]
  );
  saveMainDb();

  const user = await findUserByUsername(username);
  if (!user) throw new Error('Failed to register user');

  // Pre-seed dedicated SQLite database
  await getUserDb(user.id);

  return user;
}

export async function verifyUserLogin(username: string, password: string) {
  const user = await findUserByUsername(username);
  if (!user) return null;

  const passHash = sha256(password);
  if (user.password_hash !== passHash) {
    return null;
  }

  const main = await getMainDb();
  main.run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [user.id]);
  saveMainDb();

  return user;
}

export async function resetPasswordWithPin(username: string, pin: string, newPassword: string) {
  const user = await findUserByUsername(username);
  if (!user) {
    throw new Error('Username not found');
  }

  const pinHash = sha256(pin);
  if (user.pin_hash !== pinHash) {
    throw new Error('Invalid 4-digit Recovery PIN');
  }

  const newPassHash = sha256(newPassword);
  const main = await getMainDb();
  main.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newPassHash, user.id]);
  saveMainDb();

  return user;
}

export async function updateUserPassword(userId: number, newPassword: string) {
  const newPassHash = sha256(newPassword);
  const main = await getMainDb();
  main.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newPassHash, userId]);
  saveMainDb();
}

export async function updateUserOrgSettings(userId: number, orgName: string, reportHeader: string) {
  const main = await getMainDb();
  main.run(
    `UPDATE users SET org_name = ?, report_header = ? WHERE id = ?`,
    [orgName.trim(), reportHeader.trim(), userId]
  );
  saveMainDb();
  return await findUserById(userId);
}

// ---------------- SESSIONS MANAGEMENT ----------------

export async function createSession(userId: number, username: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const main = await getMainDb();
  main.run(
    `INSERT INTO sessions (token, user_id, username, created_at, expires_at)
     VALUES (?, ?, ?, datetime('now'), ?)`,
    [token, userId, username, expiresAt]
  );
  saveMainDb();

  return { token, userId, username, expiresAt };
}

export async function getSession(token: string) {
  const main = await getMainDb();
  const stmt = main.prepare(`SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`);
  stmt.bind([token]);
  let session: any = null;
  if (stmt.step()) {
    session = stmt.getAsObject();
  }
  stmt.free();
  return session;
}

export async function deleteSession(token: string) {
  const main = await getMainDb();
  main.run(`DELETE FROM sessions WHERE token = ?`, [token]);
  saveMainDb();
}

// ---------------- PRODUCTS REPOSITORY ----------------

export async function getUserProducts(userId: number) {
  const db = await getUserDb(userId);
  const stmt = db.prepare(`SELECT * FROM products ORDER BY name ASC`);
  const products: any[] = [];
  while (stmt.step()) {
    products.push(stmt.getAsObject());
  }
  stmt.free();
  return products;
}

export async function createUserProduct(
  userId: number,
  data: { name: string; supplier?: string; opening_qty?: number; reminder_date?: string; threshold?: number }
) {
  const db = await getUserDb(userId);
  const checkStmt = db.prepare(`SELECT id FROM products WHERE LOWER(name) = LOWER(?)`);
  checkStmt.bind([data.name.trim()]);
  if (checkStmt.step()) {
    checkStmt.free();
    throw new Error(`Product "${data.name}" already exists in your inventory`);
  }
  checkStmt.free();

  const supplier = data.supplier || '';
  const openingQty = data.opening_qty ?? 0;
  const reminderDate = data.reminder_date || '';
  const threshold = data.threshold ?? 2;

  db.run(
    `INSERT INTO products (name, supplier, opening_qty, reminder_date, threshold, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [data.name.trim(), supplier, openingQty, reminderDate, threshold]
  );
  saveUserDb(userId);

  const stmt = db.prepare(`SELECT * FROM products WHERE name = ?`);
  stmt.bind([data.name.trim()]);
  stmt.step();
  const product = stmt.getAsObject();
  stmt.free();
  return product;
}

export async function updateUserProduct(
  userId: number,
  id: number,
  data: { name?: string; supplier?: string; opening_qty?: number; reminder_date?: string; threshold?: number }
) {
  const db = await getUserDb(userId);
  const origStmt = db.prepare(`SELECT * FROM products WHERE id = ?`);
  origStmt.bind([id]);
  if (!origStmt.step()) {
    origStmt.free();
    throw new Error('Product not found');
  }
  const original = origStmt.getAsObject();
  origStmt.free();

  const newName = data.name !== undefined ? data.name.trim() : original.name;
  const newSupplier = data.supplier !== undefined ? data.supplier : original.supplier;
  const newOpening = data.opening_qty !== undefined ? data.opening_qty : original.opening_qty;
  const newReminder = data.reminder_date !== undefined ? data.reminder_date : original.reminder_date;
  const newThreshold = data.threshold !== undefined ? data.threshold : original.threshold;

  if (newName.toLowerCase() !== String(original.name).toLowerCase()) {
    const checkStmt = db.prepare(`SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND id != ?`);
    checkStmt.bind([newName, id]);
    if (checkStmt.step()) {
      checkStmt.free();
      throw new Error(`Another product named "${newName}" already exists`);
    }
    checkStmt.free();

    // Rename associated transactions
    db.run(`UPDATE transactions SET product_name = ? WHERE LOWER(product_name) = LOWER(?)`, [
      newName,
      original.name,
    ]);
  }

  db.run(
    `UPDATE products
     SET name = ?, supplier = ?, opening_qty = ?, reminder_date = ?, threshold = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [newName, newSupplier, newOpening, newReminder, newThreshold, id]
  );
  saveUserDb(userId);

  const stmt = db.prepare(`SELECT * FROM products WHERE id = ?`);
  stmt.bind([id]);
  stmt.step();
  const updated = stmt.getAsObject();
  stmt.free();
  return updated;
}

export async function deleteUserProduct(userId: number, id: number) {
  const db = await getUserDb(userId);
  const origStmt = db.prepare(`SELECT * FROM products WHERE id = ?`);
  origStmt.bind([id]);
  if (!origStmt.step()) {
    origStmt.free();
    throw new Error('Product not found');
  }
  const original = origStmt.getAsObject();
  origStmt.free();

  // Delete product and its movements
  db.run(`DELETE FROM transactions WHERE LOWER(product_name) = LOWER(?)`, [original.name]);
  db.run(`DELETE FROM products WHERE id = ?`, [id]);
  saveUserDb(userId);
  return original;
}

// ---------------- TRANSACTIONS REPOSITORY ----------------

export async function getUserTransactions(userId: number) {
  const db = await getUserDb(userId);
  const stmt = db.prepare(`SELECT * FROM transactions ORDER BY date DESC, id DESC`);
  const transactions: any[] = [];
  while (stmt.step()) {
    transactions.push(stmt.getAsObject());
  }
  stmt.free();
  return transactions;
}

export async function calculateProductStock(userId: number, productName: string): Promise<number> {
  const db = await getUserDb(userId);
  const pStmt = db.prepare(`SELECT opening_qty FROM products WHERE LOWER(name) = LOWER(?)`);
  pStmt.bind([productName.trim()]);
  let opening = 0;
  if (pStmt.step()) {
    opening = parseInt((pStmt.getAsObject() as any).opening_qty) || 0;
  }
  pStmt.free();

  const tStmt = db.prepare(`SELECT type, qty FROM transactions WHERE LOWER(product_name) = LOWER(?)`);
  tStmt.bind([productName.trim()]);
  let current = opening;
  while (tStmt.step()) {
    const t = tStmt.getAsObject() as any;
    const q = parseInt(t.qty) || 0;
    if (t.type === 'purchase') {
      current += q;
    } else if (t.type === 'sales') {
      current -= q;
    }
  }
  tStmt.free();
  return current;
}

export async function createUserTransaction(
  userId: number,
  data: { date: string; product_name: string; type: 'purchase' | 'sales'; qty: number; description?: string }
) {
  const db = await getUserDb(userId);
  const pStmt = db.prepare(`SELECT name FROM products WHERE LOWER(name) = LOWER(?)`);
  pStmt.bind([data.product_name.trim()]);
  if (!pStmt.step()) {
    pStmt.free();
    throw new Error(`Product "${data.product_name}" does not exist in inventory catalog.`);
  }
  const canonicalName = (pStmt.getAsObject() as any).name;
  pStmt.free();

  const desc = data.description || '';
  db.run(
    `INSERT INTO transactions (date, product_name, type, qty, description, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [data.date, canonicalName, data.type, data.qty, desc]
  );
  saveUserDb(userId);

  const lastStmt = db.prepare(`SELECT * FROM transactions WHERE id = last_insert_rowid()`);
  lastStmt.step();
  const tx = lastStmt.getAsObject();
  lastStmt.free();
  return tx;
}

export async function updateUserTransaction(
  userId: number,
  id: number,
  data: { date?: string; product_name?: string; type?: 'purchase' | 'sales'; qty?: number; description?: string }
) {
  const db = await getUserDb(userId);
  const origStmt = db.prepare(`SELECT * FROM transactions WHERE id = ?`);
  origStmt.bind([id]);
  if (!origStmt.step()) {
    origStmt.free();
    throw new Error('Transaction not found');
  }
  const original = origStmt.getAsObject();
  origStmt.free();

  const date = data.date || original.date;
  const type = data.type || original.type;
  const qty = data.qty !== undefined ? data.qty : original.qty;
  const desc = data.description !== undefined ? data.description : original.description;
  const prodName = data.product_name || original.product_name;

  const pStmt = db.prepare(`SELECT name FROM products WHERE LOWER(name) = LOWER(?)`);
  pStmt.bind([prodName.trim()]);
  if (!pStmt.step()) {
    pStmt.free();
    throw new Error(`Product "${prodName}" does not exist in inventory`);
  }
  const canonicalName = (pStmt.getAsObject() as any).name;
  pStmt.free();

  db.run(
    `UPDATE transactions SET date = ?, product_name = ?, type = ?, qty = ?, description = ?
     WHERE id = ?`,
    [date, canonicalName, type, qty, desc, id]
  );
  saveUserDb(userId);

  const updatedStmt = db.prepare(`SELECT * FROM transactions WHERE id = ?`);
  updatedStmt.bind([id]);
  updatedStmt.step();
  const tx = updatedStmt.getAsObject();
  updatedStmt.free();
  return tx;
}

export async function deleteUserTransaction(userId: number, id: number) {
  const db = await getUserDb(userId);
  const stmt = db.prepare(`SELECT * FROM transactions WHERE id = ?`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Transaction not found');
  }
  const tx = stmt.getAsObject();
  stmt.free();

  db.run(`DELETE FROM transactions WHERE id = ?`, [id]);
  saveUserDb(userId);
  return tx;
}

// Full Dashboard & Reports Aggregator
export async function getUserDashboardData(userId: number) {
  const products = await getUserProducts(userId);
  const transactions = await getUserTransactions(userId);
  const user = await findUserById(userId);

  const todayStr = new Date().toISOString().split('T')[0];
  let totalStockUnits = 0;
  let totalPurchased = 0;
  let totalSold = 0;
  const reminders: string[] = [];
  const lowStock: Array<{ name: string; currentStock: number; threshold: number; supplier: string }> = [];

  // Calculate stock per product
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
      totalPurchased += q;
    } else if (t.type === 'sales') {
      stockMap.set(key, current - q);
      totalSold += q;
    }
  });

  products.forEach((p) => {
    const cur = stockMap.get(p.name.toLowerCase()) ?? (parseInt(p.opening_qty) || 0);
    totalStockUnits += cur;
    if (p.reminder_date && p.reminder_date <= todayStr) {
      reminders.push(p.name);
    }
    const th = p.threshold ?? 2;
    if (cur <= th) {
      lowStock.push({
        name: p.name,
        currentStock: cur,
        threshold: th,
        supplier: p.supplier || '',
      });
    }
  });

  const recentTxs = transactions.slice(0, 5);

  return {
    user: {
      id: user?.id,
      username: user?.username,
      org_name: user?.org_name || '',
      report_header: user?.report_header || '',
      database_file: `user_${userId}.sqlite`,
    },
    metrics: {
      totalStockUnits,
      totalProducts: products.length,
      totalPurchased,
      totalSold,
      reminders,
      lowStock,
    },
    products: products.map((p) => ({
      ...p,
      current_stock: stockMap.get(p.name.toLowerCase()) ?? (parseInt(p.opening_qty) || 0),
    })),
    recentTransactions: recentTxs,
  };
}

// Backup & Restore
export async function exportUserBackupData(userId: number) {
  const products = await getUserProducts(userId);
  const transactions = await getUserTransactions(userId);
  const user = await findUserById(userId);

  return {
    version: '2.0-sqlite',
    exportedAt: new Date().toISOString(),
    username: user?.username,
    org_name: user?.org_name,
    report_header: user?.report_header,
    products,
    transactions,
  };
}

export async function importUserBackupData(userId: number, backupData: any, replaceMode = false) {
  const db = await getUserDb(userId);

  if (!Array.isArray(backupData.products) || !Array.isArray(backupData.transactions)) {
    throw new Error('Invalid StockTrack backup format');
  }

  if (replaceMode) {
    db.run(`DELETE FROM transactions`);
    db.run(`DELETE FROM products`);
  }

  // Insert or update products
  let addedProducts = 0;
  let updatedProducts = 0;
  for (const p of backupData.products) {
    const name = String(p.name || '').trim();
    if (!name) continue;
    const supplier = String(p.supplier || '').trim();
    const openingQty = parseInt(String(p.opening_qty ?? p.qty ?? 0)) || 0;
    const reminderDate = String(p.reminder_date ?? p.reminder ?? '').trim();
    const threshold = parseInt(String(p.threshold ?? 2)) || 2;

    const checkStmt = db.prepare(`SELECT id FROM products WHERE LOWER(name) = LOWER(?)`);
    checkStmt.bind([name]);
    if (checkStmt.step()) {
      const id = (checkStmt.getAsObject() as any).id;
      checkStmt.free();
      db.run(
        `UPDATE products SET supplier = ?, opening_qty = ?, reminder_date = ?, threshold = ?, updated_at = datetime('now') WHERE id = ?`,
        [supplier, openingQty, reminderDate, threshold, id]
      );
      updatedProducts++;
    } else {
      checkStmt.free();
      db.run(
        `INSERT INTO products (name, supplier, opening_qty, reminder_date, threshold, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [name, supplier, openingQty, reminderDate, threshold]
      );
      addedProducts++;
    }
  }

  // Insert transactions
  let addedTxs = 0;
  for (const t of backupData.transactions) {
    const date = String(t.date || '').trim();
    const prodName = String(t.product_name ?? t.product ?? '').trim();
    const type = String(t.type || 'purchase').toLowerCase() === 'sales' ? 'sales' : 'purchase';
    const qty = Math.abs(parseInt(String(t.qty || 0)) || 0);
    const desc = String(t.description ?? t.desc ?? '').trim();

    if (!date || !prodName || qty <= 0) continue;

    db.run(
      `INSERT INTO transactions (date, product_name, type, qty, description, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [date, prodName, type, qty, desc]
    );
    addedTxs++;
  }

  saveUserDb(userId);

  return {
    addedProducts,
    updatedProducts,
    addedTransactions: addedTxs,
  };
}
