# StockTrack - Running Frontend and PHP Backend on Separate Ports

You can run your PHP backend and React frontend completely independently on two different ports, communicating seamlessly over standard REST API calls.

---

## 1. Start the PHP Backend (e.g. Port 8000)

Navigate to your project root or backend folder and run PHP's built-in development server (or serve via Apache/Nginx/XAMPP):

```bash
# Option A: Built-in PHP server (pointing router to index.php)
php -S 0.0.0.0:8000 backend-php/index.php
```

- Your PHP API will be live at: `http://localhost:8000`
- Health check: `http://localhost:8000/api/health`
- Dedicated SQLite databases will automatically be stored directly inside `backend-php/data/` (`backend-php/data/main.sqlite` and `backend-php/data/users/user_<id>.sqlite`).

---

## 2. Configure & Start the Frontend (e.g. Port 3000)

In your root directory:

1. In `.env` (or `.env.local`), set the `VITE_API_URL` pointing to your PHP port:
   ```env
   VITE_API_URL=http://localhost:8000/api
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

- Your Frontend will run on `http://localhost:3000` (or `http://localhost:5173`).
- All REST requests (`/auth/*`, `/products`, `/transactions`, `/dashboard`, `/backup`) will call `http://localhost:8000/api/*`.
- Full CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`) are enabled in `backend-php/index.php`.

---

## 3. Production Deployment (Apache / Nginx)

- **PHP Backend**: Host the `/backend-php/` folder on your PHP hosting (Apache, Nginx, or LiteSpeed) with `pdo_sqlite` enabled.
- **Frontend**: Build the static assets using `npm run build` and host the generated `dist/` directory on any CDN or static hosting (Vercel, Netlify, Cloudflare Pages, S3, Apache, etc.) with `VITE_API_URL=https://your-php-api-domain.com/api`.
