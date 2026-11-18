// Tombol "Download APK". Versi, nama berkas, dan tautan seluruhnya dibaca dari src/release.config.json.
// Ubah berkas itu -> push ke GitHub -> Vercel build ulang -> label dan tautan di web otomatis berubah.
import cfg from "../release.config.json";
import { isNative } from "../native.js";
import "./apk.css";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const apkConfigured = (c = cfg) => !!c.downloadUrl || !!(c.github?.owner && c.github?.repo && !/^GANTI/i.test(c.github.owner + c.github.repo));
// Prioritas: downloadUrl (mis. Firebase Storage) -> GitHub Releases bertag v<versi>.
export const apkUrl = (c = cfg) => c.downloadUrl || `https://github.com/${c.github.owner}/${c.github.repo}/releases/download/v${c.version}/${encodeURIComponent(c.fileName)}`;

export function apkButtonHTML({ compact = false } = {}) {
  if (isNative()) return ""; // tidak perlu di dalam aplikasi
  if (!apkConfigured()) return `<div class="apk${compact ? " compact" : ""}"><span class="apk-btn off" aria-disabled="true">Download APK <span class="apk-ver">segera hadir</span></span></div>`;
  const tgl = cfg.releasedAt ? new Date(cfg.releasedAt + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
  const meta = [tgl && "Dirilis " + tgl, `Android ${cfg.minAndroid || "7.0"}+`, cfg.sizeMB && cfg.sizeMB + " MB"].filter(Boolean).join(" · ");
  return `<div class="apk${compact ? " compact" : ""}">
    <a class="apk-btn" href="${esc(apkUrl())}" download="${esc(cfg.fileName)}" rel="noopener" data-apk-version="${esc(cfg.version)}">⬇ Download APK <span class="apk-ver">v${esc(cfg.version)}</span></a>
    <span class="apk-meta">${esc(meta)}</span>
    ${isIOS() ? '<span class="apk-meta">APK hanya untuk Android. Pengguna iPhone: gunakan versi web.</span>' : '<span class="apk-meta">Izinkan “instal aplikasi dari sumber ini” saat diminta Android.</span>'}
    ${cfg.notes ? `<span class="apk-meta">${esc(cfg.notes)}</span>` : ""}</div>`;
}
export function mountApkButton(el, opts) { if (el) el.innerHTML = apkButtonHTML(opts); }
