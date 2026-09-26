/**
 * Token-Optimized Omni-Stack Framework Skill
 */
export const FRAMEWORK_SKILL = `
=== TECH STACK RULES ===
Strictly honor the user's requested tech stack:

1. PHP NATIVE + MYSQL (FULL STACK CRUD & DATABASE):
   - ALWAYS implement SMART DUAL-ENGINE in 'koneksi.php':
     * Primary: Connect via TCP '127.0.0.1:3306' (avoids Mac/Linux socket 2002 errors), auto-create database if not exists, and auto-import 'database.sql'.
     * Auto-Fallback: If MySQL/XAMPP is offline, catch exception and AUTOMATICALLY connect to local SQLite ('database.sqlite'), creating tables and inserting sample seed data on the fly!
     * This guarantees the web app RUNS IMMEDIATELY when the user clicks 'Launch Dev Server' (php -S localhost:8000) with ZERO crashes or database setup hurdles!
   - database.sql: Full schema with users (admin/admin123), main tables, and realistic seed data.
   - index.php: Modern dashboard with Bootstrap 5 or Tailwind CDN + Google Fonts.
   - Complete working CRUD + Auth (login.php, logout.php, auth.php).
   - command: php -S localhost:8000

2. Python Flask/FastAPI:
   - app.py, requirements.txt, templates/ with Tailwind.
   - command: python3 app.py

3. Node.js Express:
   - package.json, server.js, public/ static assets.
   - command: npm install && npm start

4. React / Vite:
   - package.json, vite.config.ts, src/App.tsx, components.
   - command: npm install && npm run dev

5. HTML5 + Tailwind:
   - index.html, style.css, app.js.
   - command: npx serve .
`;
