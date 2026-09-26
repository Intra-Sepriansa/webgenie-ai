# WebGenie AI - Autonomous Web Developer for VS Code (DeepSeek Edition)

WebGenie AI adalah ekstensi VS Code yang bertindak sebagai agen web developer otonom bertenaga DeepSeek AI (`deepseek-chat` & `deepseek-reasoner`). 
Cukup ketik deskripsi aplikasi web yang ingin kamu buat (misal: *"bikin landing page barbershop modern dengan dark mode dan booking modal"*), WebGenie AI akan merancang arsitektur, menulis seluruh file ke workspace, dan menyediakan tombol menjalankan server di terminal.

---

## ⚡ Cara Install / Update via Terminal (Paling Gampang Diingat)

Kapan pun kamu ingin meng-compile, memaketkan, dan meng-install ekstensi ini ke VS Code, cukup jalankan **1 baris perintah** ini di terminal:

```bash
npm run install-ext
```

*(Atau bisa juga: `npm run setup`)*

Perintah ini otomatis:
1. Meng-compile TypeScript & Webpack
2. Memaketkan file `.vsix`
3. Langsung meng-install ke VS Code kamu secara otomatis!

Setelah selesai, cukup reload VS Code:
- Tekan **`Cmd + Shift + P`** -> pilih **`Developer: Reload Window`**.

---

## 🎨 Tampilan Minimalis Hitam Putih (Monochrome)
- Desain serba monokrom (hitam, putih, dan abu-abu minimalis ala Vercel / Linear).
- Bersih tanpa emoji, menggunakan icon SVG minimalis.
- Tombol kontras tinggi putih-hitam.
- Badge & status indicator minimalis.

---

## 🚀 Fitur Utama

- **Autonomous Workspace Writer**: Menghasilkan file & folder secara rekursif langsung ke workspace aktif via `vscode.workspace.fs.writeFile`.
- **DeepSeek AI Engine**: Menggunakan model `deepseek-chat` (DeepSeek-V3) dengan JSON mode yang super cepat dan presisi, serta mendukung `deepseek-reasoner` (R1) untuk arsitektur rumit.
- **Secure Key Storage**: Menyimpan API Key DeepSeek secara aman di keychain bawaan VS Code via `context.secrets`.
- **Terminal Automation**: Tombol langsung untuk menjalankan `npm install && npm run dev` di terminal VS Code.
