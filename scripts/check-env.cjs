// Membatalkan build bila konfigurasi Firebase belum diisi (mencegah APK/web yang layarnya kosong).
// Nilai boleh dari berkas .env* atau variabel lingkungan (mis. Vercel > Environment Variables).
const fs = require("fs");
const need = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_APP_ID", "VITE_FIREBASE_PROJECT_ID"];
const file = {};
for (const f of [".env", ".env.production", ".env.local", ".env.production.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) file[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
}
const miss = need.filter((k) => !(process.env[k] || file[k]));
if (miss.length) { console.error(`\nBuild dibatalkan: belum diisi -> ${miss.join(", ")}\nBuat berkas .env (lihat .env.example) atau isi di Vercel > Environment Variables.\n`); process.exit(1); }
console.log("Konfigurasi Firebase terdeteksi.");
