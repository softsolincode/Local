<?php
/**
 * StockTrack PHP Backend - SQLite Database Manager
 * Zero external driver required (uses standard PDO SQLite / sqlite3)
 */

class DatabaseManager {
    private static $mainDb = null;
    private static $userDbs = [];
    private static $dataDir = __DIR__ . '/data';
    private static $usersDir = __DIR__ . '/data/users';

    public static function init() {
        if (!file_exists(self::$dataDir)) {
            mkdir(self::$dataDir, 0777, true);
        }
        if (!file_exists(self::$usersDir)) {
            mkdir(self::$usersDir, 0777, true);
        }
    }

    public static function getMainDb(): PDO {
        self::init();
        if (self::$mainDb !== null) {
            return self::$mainDb;
        }

        $dbPath = self::$dataDir . '/main.sqlite';
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Main DB Schema
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                pin_hash TEXT NOT NULL,
                org_name TEXT DEFAULT '',
                report_header TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL
            );
        ");

        self::$mainDb = $pdo;
        return self::$mainDb;
    }

    public static function getUserDb(int $userId): PDO {
        self::init();
        if (isset(self::$userDbs[$userId])) {
            return self::$userDbs[$userId];
        }

        $dbPath = self::$usersDir . '/user_' . $userId . '.sqlite';
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // User DB Schema
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                supplier TEXT DEFAULT '',
                opening_qty INTEGER DEFAULT 0,
                reminder_date TEXT DEFAULT '',
                threshold INTEGER DEFAULT 2,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                product_name TEXT NOT NULL,
                type TEXT NOT NULL,
                qty INTEGER NOT NULL,
                description TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        ");

        self::$userDbs[$userId] = $pdo;
        return self::$userDbs[$userId];
    }
}
?>
