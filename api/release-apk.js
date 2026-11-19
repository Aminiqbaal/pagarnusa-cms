// Fungsi serverless Vercel: memulai workflow "Build APK" di GitHub dari CMS.
// Hanya Super Admin. Token GitHub disimpan di Vercel (Environment Variables), tidak pernah ke browser.
import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT = process.env.FIREBASE_PROJECT_ID || "pn-gresik";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Gunakan metode POST." });
  try {
    // 1) verifikasi ID token Firebase
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Perlu login." });
    let uid;
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT}`, audience: PROJECT });
      uid = payload.sub;
    } catch { return res.status(401).json({ message: "Token tidak valid atau kedaluwarsa." }); }

    // 2) peran dibaca dengan token pengguna sendiri -> aturan Firestore tetap berlaku
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return res.status(403).json({ message: "Profil pengguna tidak dapat dibaca." });
    const f = (await r.json()).fields || {};
    if (f.role?.stringValue !== "super_admin" || f.status_aktif?.booleanValue === false) return res.status(403).json({ message: "Hanya Super Admin yang boleh merilis APK." });

    // 3) validasi masukan
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const version = String(body.version || ""), notes = String(body.notes || "").slice(0, 200);
    if (!/^\d+\.\d+\.\d+$/.test(version)) return res.status(400).json({ message: "Format versi harus x.y.z, mis. 1.0.1." });
    const { GITHUB_TOKEN, GITHUB_REPO } = process.env;
    if (!GITHUB_TOKEN || !GITHUB_REPO) return res.status(500).json({ message: "GITHUB_TOKEN dan GITHUB_REPO belum diatur di Vercel." });

    // 4) mulai workflow
    const gh = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/build-apk.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME || "main", inputs: { version, notes } }),
    });
    if (!gh.ok) return res.status(502).json({ message: `GitHub menolak permintaan (${gh.status}). ${(await gh.text()).slice(0, 200)}` });
    return res.status(200).json({ ok: true, message: "Build dimulai." });
  } catch (e) {
    return res.status(500).json({ message: "Kesalahan server: " + (e.message || e) });
  }
}
