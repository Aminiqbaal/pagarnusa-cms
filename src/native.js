// Deteksi & penyesuaian saat berjalan di dalam aplikasi Capacitor (Android/iOS).
// Sengaja TIDAK mengimpor paket @capacitor/*: plugin diakses lewat window.Capacitor,
// sehingga build web (Vercel) tidak bergantung pada paket Capacitor.
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const platform = () => window.Capacitor?.getPlatform?.() || "web";

export function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add("native", "native-" + platform());
  const P = window.Capacitor.Plugins || {};
  try { P.StatusBar?.setOverlaysWebView?.({ overlay: false }); } catch { /* plugin opsional */ }
  // Tombol kembali Android: tutup dialog -> tutup menu -> kembali ke Dashboard -> keluar aplikasi.
  P.App?.addListener?.("backButton", ({ canGoBack }) => {
    const d = document.getElementById("dlg");
    if (d?.open) return d.close();
    if (document.body.classList.contains("nav-open")) return document.body.classList.remove("nav-open");
    const h = location.hash;
    if (h && h !== "#dasbor") { if (canGoBack) history.back(); else location.hash = "#dasbor"; return; }
    P.App.exitApp?.();
  });
}
