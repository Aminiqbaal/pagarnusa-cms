import { initializeApp, getApps } from "firebase/app";
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { isNative } from "./native.js";

const e = import.meta.env;
if (!e.VITE_FIREBASE_API_KEY || !e.VITE_FIREBASE_APP_ID) throw new Error("Konfigurasi Firebase kosong (VITE_FIREBASE_API_KEY / VITE_FIREBASE_APP_ID). Buat berkas .env sebelum build.");
const app = initializeApp({
  apiKey: e.VITE_FIREBASE_API_KEY,
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: e.VITE_FIREBASE_PROJECT_ID,
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: e.VITE_FIREBASE_APP_ID,
});
// Di WebView Capacitor, hindari resolver popup/iframe bawaan getAuth(); cukup email+kata sandi.
export const auth = isNative() ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }) : getAuth(app);
// Deteksi otomatis long-polling agar stabil di WebView/jaringan yang membatasi WebSocket.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export const API = (e.VITE_API_URL || "").replace(/\/$/, "");

// Instans kedua (sesi hanya di memori) untuk membuat akun anggota tanpa mengeluarkan admin yang login.
let sec;
export function secondaryAuth() {
  if (sec) return sec;
  const a = getApps().find((x) => x.name === "secondary") || initializeApp(app.options, "secondary");
  try { sec = initializeAuth(a, { persistence: inMemoryPersistence }); } catch { sec = getAuth(a); }
  return sec;
}
