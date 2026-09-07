<?php
/**
 * StockTrack PHP API Router & Controller
 * Pure PHP REST API with Multi-Tenant SQLite Database Architecture
 * Zero external driver required (uses standard PDO SQLite / sqlite3)
 * Full CORS support for independent frontend/backend ports
 */

// Allow CORS from any origin for separate port development & production
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Normalize path: strip script names, subdirectories (/server, /backend-php, etc.)
$path = preg_replace('#^/server(/index\.php)?#i', '', $path);
$path = preg_replace('#^/backend-php(/index\.php)?#i', '', $path);
$path = preg_replace('#^/api/index\.php#i', '/api', $path);
$path = preg_replace('#^/index\.php#i', '', $path);

// Strip duplicate leading /api if present
$path = preg_replace('#^/api/api/#i', '/api/', $path);

// Ensure path begins with /api
if (!preg_match('#^/api(/|$)#i', $path)) {
    $path = '/api' . (strpos($path, '/') === 0 ? $path : '/' . $path);
}
if ($path === '/api' || $path === '/api/') {
    $path = '/api/health';
}

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?? [];

// Helper to get authenticated user from Bearer header or cookie
function getAuthUser() {
    $token = $_COOKIE['stock_session'] ?? '';
    if (!$token) {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = trim($matches[1]);
        }
    }
    if (!$token) return null;

    try {
        $mainDb = DatabaseManager::getMainDb();
        $stmt = $mainDb->prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')");
        $stmt->execute([$token]);
        $session = $stmt->fetch();
        if (!$session) return null;

        $uStmt = $mainDb->prepare("SELECT * FROM users WHERE id = ?");
        $uStmt->execute([$session['user_id']]);
        return $uStmt->fetch();
    } catch (Exception $e) {
        return null;
    }
}

// Helper to send JSON responses
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------
// PUBLIC & HEALTH ENDPOINTS
// ----------------------------------------------------
if ($path === '/api/health' && $method === 'GET') {
    sendResponse([
        'status' => 'ok',
        'engine' => 'PHP ' . PHP_VERSION . ' + SQLite PDO Native',
        'database' => 'main.sqlite + per-user isolated SQLite databases',
        'timestamp' => date('c')
    ]);
}

// ----------------------------------------------------
// AUTHENTICATION REST APIS
// ----------------------------------------------------
if ($path === '/api/auth/register' && $method === 'POST') {
    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');
    $pin = trim($body['pin'] ?? '');

    if (!$username || !$password || !$pin) {
        sendResponse(['error' => 'Username, password, and 4-digit PIN are required'], 400);
    }
    if (strlen($pin) !== 4 || !ctype_digit($pin)) {
        sendResponse(['error' => 'Recovery PIN must be exactly 4 numeric digits'], 400);
    }

    $mainDb = DatabaseManager::getMainDb();
    $chk = $mainDb->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)");
    $chk->execute([$username]);
    if ($chk->fetch()) {
        sendResponse(['error' => 'Username already registered. Please choose another username or log in.'], 400);
    }

    $passHash = hash('sha256', $password);
    $pinHash = hash('sha256', $pin);
    $ins = $mainDb->prepare("
        INSERT INTO users (username, password_hash, pin_hash, org_name, report_header, created_at, last_login)
        VALUES (?, ?, ?, '', '', datetime('now'), datetime('now'))
    ");
    $ins->execute([$username, $passHash, $pinHash]);
    $userId = (int)$mainDb->lastInsertId();

    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
    $sIns = $mainDb->prepare("INSERT INTO sessions (token, user_id, username, created_at, expires_at) VALUES (?, ?, ?, datetime('now'), ?)");
    $sIns->execute([$token, $userId, $username, $expires]);

    // Provision private user SQLite database
    DatabaseManager::getUserDb($userId);

    // setcookie('stock_session', $token, time() + 30 * 86400, '/', '', false, true);

   $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (strpos($origin, 'http://localhost:') === 0) {
    // Development only
    header(
        'Set-Cookie: stock_session=' . $token .
        '; Max-Age=' . (30 * 86400) .
        '; Path=/; Secure; HttpOnly; SameSite=None',
        false
    );
} else {
    // Production — unchanged
    setcookie(
        'stock_session',
        $token,
        time() + (30 * 86400),
        '/',
        '',
        false,
        true
    );
}
    sendResponse([
        'success' => true,
        'message' => 'Registered successfully with private SQLite database',
        'token' => $token,
        'user' => [
            'id' => $userId,
            'username' => $username,
            'org_name' => '',
            'report_header' => ''
        ]
    ]);
}

if ($path === '/api/auth/login' && $method === 'POST') {
    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');

    if (!$username || !$password) {
        sendResponse(['error' => 'Username and password required'], 400);
    }

    $passHash = hash('sha256', $password);
    $mainDb = DatabaseManager::getMainDb();
    $stmt = $mainDb->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password_hash = ?");
    $stmt->execute([$username, $passHash]);
    $user = $stmt->fetch();

    if (!$user) {
        sendResponse(['error' => 'Invalid username or password'], 401);
    }

    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
    $sIns = $mainDb->prepare("INSERT INTO sessions (token, user_id, username, created_at, expires_at) VALUES (?, ?, ?, datetime('now'), ?)");
    $sIns->execute([$token, $user['id'], $user['username'], $expires]);

    $mainDb->prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?")->execute([$user['id']]);

    // setcookie('stock_session', $token, time() + 30 * 86400, '/', '', false, true);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (strpos($origin, 'http://localhost:') === 0) {
    // Development: localhost frontend -> HTTPS API
    header(
        'Set-Cookie: stock_session=' . $token .
        '; Max-Age=' . (30 * 86400) .
        '; Path=/; Secure; HttpOnly; SameSite=None',
        false
    );
} else {
    // Production: keep existing behavior
    setcookie(
        'stock_session',
        $token,
        time() + (30 * 86400),
        '/',
        '',
        false,
        true
    );
}
    sendResponse([
        'success' => true,
        'message' => 'Logged in successfully',
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'org_name' => $user['org_name'] ?? '',
            'report_header' => $user['report_header'] ?? ''
        ]
    ]);
}

if ($path === '/api/auth/reset-password-pin' && $method === 'POST') {
    $username = trim($body['username'] ?? '');
    $pin = trim($body['pin'] ?? '');
    $newPassword = trim($body['newPassword'] ?? '');

    if (!$username || !$pin || !$newPassword) {
        sendResponse(['error' => 'Username, 4-digit PIN, and new password are required'], 400);
    }
    if (strlen($newPassword) < 6) {
        sendResponse(['error' => 'Password must be at least 6 characters'], 400);
    }

    $pinHash = hash('sha256', $pin);
    $mainDb = DatabaseManager::getMainDb();
    $stmt = $mainDb->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND pin_hash = ?");
    $stmt->execute([$username, $pinHash]);
    $user = $stmt->fetch();

    if (!$user) {
        sendResponse(['error' => 'Invalid username or 4-digit PIN verification failed'], 400);
    }

    $newPassHash = hash('sha256', $newPassword);
    $mainDb->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$newPassHash, $user['id']]);

    sendResponse(['success' => true, 'message' => 'Password reset successfully. You can now log in with your new password.']);
}

if ($path === '/api/auth/logout' && $method === 'POST') {
    $user = getAuthUser();
    if ($user) {
        $token = $_COOKIE['stock_session'] ?? '';
        if ($token) {
            $mainDb = DatabaseManager::getMainDb();
            $mainDb->prepare("DELETE FROM sessions WHERE token = ?")->execute([$token]);
        }
    }
    // setcookie('stock_session', '', time() - 3600, '/', '', false, true);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (strpos($origin, 'http://localhost:') === 0) {
    header(
        'Set-Cookie: stock_session=;' .
        ' Max-Age=0;' .
        ' Path=/;' .
        ' Secure;' .
        ' HttpOnly;' .
        ' SameSite=None',
        false
    );
} else {
    setcookie(
        'stock_session',
        '',
        time() - 3600,
        '/',
        '',
        false,
        true
    );
}
    sendResponse(['success' => true, 'message' => 'Logged out successfully']);
}

if ($path === '/api/auth/me' && $method === 'GET') {
    $user = getAuthUser();
    if (!$user) {
        sendResponse(['authenticated' => false, 'user' => null]);
    }
    sendResponse([
        'authenticated' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'org_name' => $user['org_name'] ?? '',
            'report_header' => $user['report_header'] ?? '',
            'database_file' => 'user_' . $user['id'] . '.sqlite'
        ]
    ]);
}

if ($path === '/api/auth/change-password' && $method === 'POST') {
    $user = getAuthUser();
    if (!$user) sendResponse(['error' => 'Unauthorized'], 401);

    $newPassword = trim($body['newPassword'] ?? '');
    if (strlen($newPassword) < 6) {
        sendResponse(['error' => 'New password must be at least 6 characters'], 400);
    }

    $newHash = hash('sha256', $newPassword);
    $mainDb = DatabaseManager::getMainDb();
    $mainDb->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$newHash, $user['id']]);

    sendResponse(['success' => true, 'message' => 'Password updated successfully']);
}

// ----------------------------------------------------
// PROTECTED REST APIS - REQUIRE AUTHENTICATION
// ----------------------------------------------------
$currentUser = getAuthUser();
if (!$currentUser) {
    sendResponse(['error' => 'Authentication required'], 401);
}

$userDb = DatabaseManager::getUserDb((int)$currentUser['id']);

// ---------------- DASHBOARD ----------------
if ($path === '/api/dashboard' && $method === 'GET') {
    $prods = $userDb->query("SELECT * FROM products ORDER BY name ASC")->fetchAll();
    // $txs = $userDb->query("SELECT * FROM transactions ORDER BY date DESC, id DESC")->fetchAll();
    $txs = $userDb->query("SELECT * FROM transactions ORDER BY date DESC, id DESC")->fetchAll();

    $totalStockUnits = 0;
    $totalPurchased = 0;
    $totalSold = 0;
    $lowStock = [];
    $reminders = [];
    $today = date('Y-m-d');

    // Calculate live running balances for each product
    $prodStockMap = [];
    foreach ($prods as $p) {
        $prodStockMap[strtolower($p['name'])] = (int)$p['opening_qty'];
    }

    foreach ($txs as $t) {
        $nameLower = strtolower($t['product_name']);
        $q = (int)$t['qty'];
        if ($t['type'] === 'purchase') {
            $totalPurchased += $q;
            if (isset($prodStockMap[$nameLower])) $prodStockMap[$nameLower] += $q;
        } else {
            $totalSold += $q;
            if (isset($prodStockMap[$nameLower])) $prodStockMap[$nameLower] -= $q;
        }
    }

    $prodsWithStock = [];
    foreach ($prods as $p) {
        $cur = $prodStockMap[strtolower($p['name'])] ?? (int)$p['opening_qty'];
        $totalStockUnits += $cur;
        $th = (int)($p['threshold'] ?? 2);

        $pWithCur = array_merge($p, ['current_stock' => $cur]);
        $prodsWithStock[] = $pWithCur;

        if ($cur <= $th) {
            $lowStock[] = [
                'id' => $p['id'],
                'name' => $p['name'],
                'available' => $cur,
                'threshold' => $th,
                'supplier' => $p['supplier'] ?? ''
            ];
        }

        if (!empty($p['reminder_date'])) {
            $reminders[] = [
                'id' => $p['id'],
                'name' => $p['name'],
                'reminder_date' => $p['reminder_date'],
                'is_due' => $p['reminder_date'] <= $today,
                'supplier' => $p['supplier'] ?? '',
                'stock' => $cur
            ];
        }
    }

    $recentTxs = array_slice($txs, 0, 7);

    sendResponse([
        'user' => [
            'id' => $currentUser['id'],
            'username' => $currentUser['username'],
            'org_name' => $currentUser['org_name'] ?? '',
            'report_header' => $currentUser['report_header'] ?? '',
            'database_file' => 'user_' . $currentUser['id'] . '.sqlite'
        ],
        'metrics' => [
            'totalStockUnits' => $totalStockUnits,
            'totalProducts' => count($prods),
            'totalPurchased' => $totalPurchased,
            'totalSold' => $totalSold,
            'reminders' => $reminders,
            'lowStock' => $lowStock
        ],
        'products' => $prodsWithStock,
        'recentTransactions' => $recentTxs
    ]);
}

// ---------------- PRODUCTS ----------------
if ($path === '/api/products' && $method === 'GET') {
    $prods = $userDb->query("SELECT * FROM products ORDER BY name ASC")->fetchAll();
    $txs = $userDb->query("SELECT product_name, type, qty FROM transactions")->fetchAll();

    $prodStockMap = [];
    foreach ($prods as $p) {
        $prodStockMap[strtolower($p['name'])] = (int)$p['opening_qty'];
    }
    foreach ($txs as $t) {
        $nameLower = strtolower($t['product_name']);
        $q = (int)$t['qty'];
        if (isset($prodStockMap[$nameLower])) {
            if ($t['type'] === 'purchase') $prodStockMap[$nameLower] += $q;
            else $prodStockMap[$nameLower] -= $q;
        }
    }

    $results = [];
    foreach ($prods as $p) {
        $results[] = array_merge($p, [
            'current_stock' => $prodStockMap[strtolower($p['name'])] ?? (int)$p['opening_qty']
        ]);
    }

    sendResponse(['products' => $results]);
}

if ($path === '/api/products' && $method === 'POST') {
    $name = trim($body['name'] ?? '');
    $supplier = trim($body['supplier'] ?? '');
    $openingQty = (int)($body['opening_qty'] ?? 0);
    $reminderDate = trim($body['reminder_date'] ?? '');
    $threshold = isset($body['threshold']) ? (int)$body['threshold'] : 2;

    if (!$name) {
        sendResponse(['error' => 'Product name is required'], 400);
    }

    $chk = $userDb->prepare("SELECT id FROM products WHERE LOWER(name) = LOWER(?)");
    $chk->execute([$name]);
    if ($chk->fetch()) {
        sendResponse(['error' => "Product '$name' already exists in your inventory catalog"], 400);
    }

    $ins = $userDb->prepare("
        INSERT INTO products (name, supplier, opening_qty, reminder_date, threshold, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ");
    $ins->execute([$name, $supplier, $openingQty, $reminderDate, $threshold]);
    $prodId = (int)$userDb->lastInsertId();

    $fetch = $userDb->prepare("SELECT * FROM products WHERE id = ?");
    $fetch->execute([$prodId]);
    $prod = $fetch->fetch();
    $prod['current_stock'] = $openingQty;

    sendResponse(['success' => true, 'product' => $prod]);
}

if (preg_match('#^/api/products/(\d+)$#', $path, $matches) && $method === 'PUT') {
    $id = (int)$matches[1];
    $name = trim($body['name'] ?? '');
    $supplier = trim($body['supplier'] ?? '');
    $openingQty = (int)($body['opening_qty'] ?? 0);
    $reminderDate = trim($body['reminder_date'] ?? '');
    $threshold = isset($body['threshold']) ? (int)$body['threshold'] : 2;

    if (!$name) sendResponse(['error' => 'Product name is required'], 400);

    $origStmt = $userDb->prepare("SELECT * FROM products WHERE id = ?");
    $origStmt->execute([$id]);
    $orig = $origStmt->fetch();
    if (!$orig) sendResponse(['error' => 'Product not found'], 404);

    if (strtolower($orig['name']) !== strtolower($name)) {
        $chk = $userDb->prepare("SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND id != ?");
        $chk->execute([$name, $id]);
        if ($chk->fetch()) {
            sendResponse(['error' => "Another product named '$name' already exists"], 400);
        }

        // Rename across transactions for ledger integrity
        $userDb->prepare("UPDATE transactions SET product_name = ? WHERE LOWER(product_name) = LOWER(?)")
               ->execute([$name, $orig['name']]);
    }

    $userDb->prepare("
        UPDATE products
        SET name = ?, supplier = ?, opening_qty = ?, reminder_date = ?, threshold = ?, updated_at = datetime('now')
        WHERE id = ?
    ")->execute([$name, $supplier, $openingQty, $reminderDate, $threshold, $id]);

    $fetch = $userDb->prepare("SELECT * FROM products WHERE id = ?");
    $fetch->execute([$id]);
    sendResponse(['success' => true, 'product' => $fetch->fetch()]);
}

if (preg_match('#^/api/products/(\d+)$#', $path, $matches) && $method === 'DELETE') {
    $id = (int)$matches[1];
    $origStmt = $userDb->prepare("SELECT * FROM products WHERE id = ?");
    $origStmt->execute([$id]);
    $prod = $origStmt->fetch();

    if ($prod) {
        $userDb->prepare("DELETE FROM transactions WHERE LOWER(product_name) = LOWER(?)")->execute([$prod['name']]);
        $userDb->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);
    }
    sendResponse(['success' => true, 'message' => 'Product and associated movements deleted']);
}

// ---------------- CSV IMPORT ----------------
if ($path === '/api/products/import-csv' && $method === 'POST') {
    $csvText = trim($body['csv'] ?? '');
    if (!$csvText) sendResponse(['error' => 'CSV payload is empty'], 400);

    $lines = preg_split('/\r\n|\r|\n/', $csvText);
    $added = 0;
    $updated = 0;

    foreach ($lines as $idx => $line) {
        $line = trim($line);
        if (!$line || $idx === 0 && stripos($line, 'name') !== false) continue;

        $cols = str_getcsv($line);
        $name = trim($cols[0] ?? '');
        if (!$name) continue;

        $supplier = trim($cols[1] ?? '');
        $opening = (int)($cols[2] ?? 0);
        $reminder = trim($cols[3] ?? '');
        $threshold = isset($cols[4]) ? (int)$cols[4] : 2;

        $chk = $userDb->prepare("SELECT id FROM products WHERE LOWER(name) = LOWER(?)");
        $chk->execute([$name]);
        $existing = $chk->fetch();

        if ($existing) {
            $userDb->prepare("UPDATE products SET supplier = ?, opening_qty = ?, reminder_date = ?, threshold = ?, updated_at = datetime('now') WHERE id = ?")
                   ->execute([$supplier, $opening, $reminder, $threshold, $existing['id']]);
            $updated++;
        } else {
            $userDb->prepare("INSERT INTO products (name, supplier, opening_qty, reminder_date, threshold, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))")
                   ->execute([$name, $supplier, $opening, $reminder, $threshold]);
            $added++;
        }
    }

    sendResponse(['success' => true, 'added' => $added, 'updated' => $updated]);
}

// ---------------- TRANSACTIONS ----------------
if ($path === '/api/transactions' && $method === 'GET') {
    $txs = $userDb->query("SELECT * FROM transactions ORDER BY date DESC, id DESC")->fetchAll();
    sendResponse(['transactions' => $txs]);
}


if ($path === '/api/datetransactions' && $method === 'POST') {

    $fromDate = trim($body['fromDate'] ?? '');
    $toDate   = trim($body['toDate'] ?? '');
    $product  = trim($body['product'] ?? 'all');

    // Validate dates
    if (!$fromDate || !$toDate) {
        sendResponse([
            'error' => 'From date and To date are required'
        ], 400);
    }

    // Validate date range
    if ($fromDate > $toDate) {
        sendResponse([
            'error' => 'From date cannot be greater than To date'
        ], 400);
    }

    /*
     * If product = "all"
     *     → return transactions for all products
     *
     * If product contains a product name
     *     → return only that product's transactions
     */

    if (strtolower($product) === 'all') {

        $stmt = $userDb->prepare("
            SELECT *
            FROM transactions
            WHERE date >= ?
              AND date <= ?
            ORDER BY date DESC, id DESC
        ");

        $stmt->execute([
            $fromDate,
            $toDate
        ]);

    } else {

        $stmt = $userDb->prepare("
            SELECT *
            FROM transactions
            WHERE date >= ?
              AND date <= ?
              AND LOWER(product_name) = LOWER(?)
            ORDER BY date DESC, id DESC
        ");

        $stmt->execute([
            $fromDate,
            $toDate,
            $product
        ]);
    }

    $txs = $stmt->fetchAll();

    sendResponse([
        'success' => true,
        'fromDate' => $fromDate,
        'toDate' => $toDate,
        'product' => strtolower($product) === 'all' ? 'all' : $product,
        'transactions' => $txs
    ]);
}
if ($path === '/api/transactions' && $method === 'POST') {
    $date = trim($body['date'] ?? date('Y-m-d'));
    $productName = trim($body['product_name'] ?? '');
    $type = strtolower(trim($body['type'] ?? 'purchase'));
    $qty = (int)($body['qty'] ?? 0);
    $description = trim($body['description'] ?? '');

    if (!$productName || $qty <= 0) {
        sendResponse(['error' => 'Valid product name and positive quantity are required'], 400);
    }
    if ($type !== 'purchase' && $type !== 'sales') {
        sendResponse(['error' => 'Type must be purchase or sales'], 400);
    }

    $pStmt = $userDb->prepare("SELECT name FROM products WHERE LOWER(name) = LOWER(?)");
    $pStmt->execute([$productName]);
    $prod = $pStmt->fetch();
    if (!$prod) {
        sendResponse(['error' => "Product '$productName' does not exist in inventory catalog. Please add product first."], 400);
    }
    $canonicalName = $prod['name'];

    $ins = $userDb->prepare("
        INSERT INTO transactions (date, product_name, type, qty, description, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
    ");
    $ins->execute([$date, $canonicalName, $type, $qty, $description]);
    $txId = (int)$userDb->lastInsertId();

    $fetch = $userDb->prepare("SELECT * FROM transactions WHERE id = ?");
    $fetch->execute([$txId]);
    sendResponse(['success' => true, 'transaction' => $fetch->fetch()]);
}

if (preg_match('#^/api/transactions/(\d+)$#', $path, $matches) && $method === 'PUT') {
    $id = (int)$matches[1];
    $date = trim($body['date'] ?? date('Y-m-d'));
    $productName = trim($body['product_name'] ?? '');
    $type = strtolower(trim($body['type'] ?? 'purchase'));
    $qty = (int)($body['qty'] ?? 0);
    $description = trim($body['description'] ?? '');

    if (!$productName || $qty <= 0) sendResponse(['error' => 'Valid product name and quantity required'], 400);

    $pStmt = $userDb->prepare("SELECT name FROM products WHERE LOWER(name) = LOWER(?)");
    $pStmt->execute([$productName]);
    $prod = $pStmt->fetch();
    if (!$prod) sendResponse(['error' => "Product '$productName' not found"], 400);

    $userDb->prepare("
        UPDATE transactions
        SET date = ?, product_name = ?, type = ?, qty = ?, description = ?
        WHERE id = ?
    ")->execute([$date, $prod['name'], $type, $qty, $description, $id]);

    $fetch = $userDb->prepare("SELECT * FROM transactions WHERE id = ?");
    $fetch->execute([$id]);
    sendResponse(['success' => true, 'transaction' => $fetch->fetch()]);
}

if (preg_match('#^/api/transactions/(\d+)$#', $path, $matches) && $method === 'DELETE') {
    $id = (int)$matches[1];
    $userDb->prepare("DELETE FROM transactions WHERE id = ?")->execute([$id]);
    sendResponse(['success' => true, 'message' => 'Transaction deleted']);
}

// ---------------- SETTINGS ----------------
if ($path === '/api/settings/org' && $method === 'PUT') {
    $orgName = trim($body['org_name'] ?? '');
    $reportHeader = trim($body['report_header'] ?? '');

    $mainDb = DatabaseManager::getMainDb();
    $mainDb->prepare("UPDATE users SET org_name = ?, report_header = ? WHERE id = ?")
           ->execute([$orgName, $reportHeader, $currentUser['id']]);

    sendResponse(['success' => true, 'org_name' => $orgName, 'report_header' => $reportHeader]);
}

// ---------------- BACKUP & RESTORE ----------------
if ($path === '/api/backup' && $method === 'GET') {
    $prods = $userDb->query("SELECT * FROM products ORDER BY id ASC")->fetchAll();
    $txs = $userDb->query("SELECT * FROM transactions ORDER BY id ASC")->fetchAll();

    sendResponse([
        'version' => '1.0',
        'exported_at' => date('c'),
        'user' => $currentUser['username'],
        'products' => $prods,
        'transactions' => $txs
    ]);
}

if ($path === '/api/backup/restore' && $method === 'POST') {
    $prods = $body['products'] ?? [];
    $txs = $body['transactions'] ?? [];
    $replace = !empty($body['replace']);

    if (!is_array($prods) || !is_array($txs)) {
        sendResponse(['error' => 'Invalid backup structure'], 400);
    }

    if ($replace) {
        $userDb->exec("DELETE FROM transactions");
        $userDb->exec("DELETE FROM products");
    }

    $pIns = $userDb->prepare("
        INSERT OR REPLACE INTO products (name, supplier, opening_qty, reminder_date, threshold, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ");
    foreach ($prods as $p) {
        $name = trim($p['name'] ?? '');
        if (!$name) continue;
        $pIns->execute([
            $name,
            $p['supplier'] ?? '',
            (int)($p['opening_qty'] ?? 0),
            $p['reminder_date'] ?? '',
            (int)($p['threshold'] ?? 2)
        ]);
    }

    $tIns = $userDb->prepare("
        INSERT INTO transactions (date, product_name, type, qty, description, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
    ");
    foreach ($txs as $t) {
        $pName = trim($t['product_name'] ?? '');
        $q = (int)($t['qty'] ?? 0);
        if (!$pName || $q <= 0) continue;
        $tIns->execute([
            $t['date'] ?? date('Y-m-d'),
            $pName,
            $t['type'] ?? 'purchase',
            $q,
            $t['description'] ?? ''
        ]);
    }

    sendResponse(['success' => true, 'message' => 'Backup restored into SQLite successfully!']);
}

// 404 Fallback
sendResponse(['error' => 'REST API endpoint not found: ' . $path], 404);
?>
