# Hostinger Deployment Guide for StockTrack (React + PHP + SQLite)

## Why did you see `404 Not Found` with `Unexpected token '<', "<!DOCTYPE ..."`?

1. **Missing `.htaccess` rewrite rule**: When your browser sends a request to `https://stkldg.nimagagi.com/api/auth/register`, Hostinger's Apache/LiteSpeed web server looks for a physical folder `/api/auth/register`. Because it does not exist as a physical folder, Hostinger returns its default HTML 404 error page (`<!DOCTYPE html>...`).
2. When the React app attempts to parse this HTML page as JSON, it encounters `<` from `<!DOCTYPE>` and throws `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

---

## How to Deploy Correctly on Hostinger (Step-by-Step)

### Option 1: Single Domain Deployment (Frontend & Backend on `stkldg.nimagagi.com`)

In Hostinger hPanel -> **File Manager** (or via FTP / FileZilla) in `public_html/`:

1. **Build the React Frontend**:
   ```bash
   npm run build
   ```
2. **Upload contents of the `dist/` folder** directly into `public_html/`:
   - `index.html`
   - `assets/`
   - `.htaccess` (included in dist)
3. **Upload the `backend-php/` folder contents** into `public_html/api/`:
   - Create a folder named `api` inside `public_html/`
   - Place inside `public_html/api/`:
     - `index.php`
     - `db.php`
     - `.htaccess`
     - `data/` folder (with `755` or `775` write permissions)

#### Final Folder Structure in Hostinger `public_html/`:
```text
public_html/
├── .htaccess                <-- (Routes /api to api/index.php and frontend to index.html)
├── index.html               <-- (From dist/)
├── assets/                  <-- (From dist/)
└── api/                     <-- (Your backend-php folder renamed to api)
    ├── .htaccess            <-- (Rewrites all /api/* requests to index.php)
    ├── index.php            <-- (PHP API router)
    ├── db.php               <-- (SQLite manager)
    └── data/                <-- (Where SQLite databases are saved)
```

---

### Option 2: Separate Subdomain for API (e.g. `api.nimagagi.com`)

If your PHP backend is hosted on a separate subdomain like `https://api.nimagagi.com`:

1. Upload `backend-php/*` into the subdomain's `public_html/` folder (including `.htaccess`).
2. In your React frontend `.env.production` file:
   ```env
   VITE_API_URL=https://api.nimagagi.com/api
   ```
3. Run `npm run build` and upload `dist/` to `stkldg.nimagagi.com`.

---

### Important Hostinger Settings & Troubleshooting:

1. **Ensure SQLite is enabled in PHP**:
   - In Hostinger hPanel -> **Advanced** -> **PHP Configuration** -> **PHP Extensions**.
   - Make sure `pdo_sqlite` and `sqlite3` are checked/enabled (enabled by default on Hostinger).
2. **Permissions for SQLite Data**:
   - Ensure the `api/data` folder has write permissions (chmod `755` or `775`).
3. **Verify Health Endpoint**:
   - Open in your browser: `https://stkldg.nimagagi.com/api/health`
   - It should return:
     ```json
     {
       "status": "ok",
       "engine": "PHP PDO SQLite Multi-Tenant",
       "php_version": "8.x.x"
     }
     ```
