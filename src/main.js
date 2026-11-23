// Router: /admin atau aplikasi Capacitor -> CMS; selain itu -> website publik unit.
import { isNative, initNative } from "./native.js";
initNative();

// Jangan biarkan layar kosong: bila gagal dimuat, tampilkan penyebabnya.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function showFatal(err) {
  const app = document.getElementById("app");
  if (!app || app.childElementCount) return; // hanya bila layar masih kosong
  const msg = String(err?.code || err?.message || err || "Kesalahan tidak diketahui");
  const envHint = /api-key|Konfigurasi Firebase/i.test(msg)
    ? "Berkas .env belum ada saat build. Buat .env (lihat .env.example), lalu build ulang: npm run build && npx cap sync android."
    : "Muat ulang aplikasi. Bila berulang, kirim pesan ini ke pengembang.";
  app.innerHTML = `<div style="max-width:420px;margin:12vh auto;padding:20px;font:15px/1.55 system-ui,sans-serif;color:#e6ece8">
    <h2 style="margin:0 0 8px;font-size:20px">Aplikasi tidak dapat dimuat</h2>
    <p style="color:#c7d2cb;overflow-wrap:anywhere">${esc(msg)}</p><p style="color:#93a198;font-size:13px">${esc(envHint)}</p>
    <button onclick="location.reload()" style="min-height:44px;padding:0 16px;border-radius:10px;border:0;background:#1f6b4f;color:#fff;font:inherit">Muat ulang</button></div>`;
}
addEventListener("error", (e) => showFatal(e.error || e.message));
addEventListener("unhandledrejection", (e) => showFatal(e.reason));

const p = location.pathname.replace(/\/+$/, "");
async function pick() {
  if (p === "/admin" || p.startsWith("/admin/")) return import("./cms.js");
  if (isNative()) {
    // Aplikasi: sudah login -> langsung CMS; belum login -> berita Pengurus Pusat (dengan tombol "Masuk pengurus").
    try { const { auth } = await import("./firebase.js"); await auth.authStateReady(); if (auth.currentUser) return import("./cms.js"); } catch { /* lanjut ke website */ }
  }
  return import("./site.js");
}
pick().catch(showFatal);
