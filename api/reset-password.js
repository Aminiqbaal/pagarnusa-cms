// Fungsi serverless Vercel: mengembalikan kata sandi anggota ke default (= alamat email).
// Hanya admin yang berpangkat LEBIH TINGGI dari anggota itu dan unitnya berada di atas/sama dengan unit anggota.
// Memakai Firebase Admin SDK; kredensial disimpan di Vercel (FIREBASE_SERVICE_ACCOUNT), tidak pernah ke browser.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const LV = { super_admin: -1, admin_pusat: 0, admin_wilayah: 1, admin_cabang: 2, admin_pac: 3, admin_rayon: 4, admin_ranting: 4, member: 5 };

function init() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT belum diatur di Vercel.");
  initializeApp({ credential: cert(JSON.parse(raw)) });
}
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
    init();
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Perlu login." });
    let caller;
    try { caller = await getAuth().verifyIdToken(token); } catch { return res.status(401).json({ message: "Token tidak valid atau kedaluwarsa." }); }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const uid = String(body.uid || "");
    if (!uid || uid === caller.uid) return res.status(400).json({ message: "Anggota tujuan tidak valid." });

    const db = getFirestore();
    const [cs, ts] = await Promise.all([db.doc(`users/${caller.uid}`).get(), db.doc(`users/${uid}`).get()]);
    const c = cs.data(), t = ts.data();
    if (!c || !(c.role in LV) || LV[c.role] >= LV.member || c.status_aktif === false) return res.status(403).json({ message: "Hanya pengurus aktif yang dapat mereset kata sandi." });
    if (!t || !(t.role in LV)) return res.status(404).json({ message: "Anggota tidak ditemukan." });
    if (!(LV[t.role] > LV[c.role])) return res.status(403).json({ message: "Anda hanya dapat mereset anggota yang berpangkat di bawah Anda." });
    if (!(t.hierarki_path || []).includes(c.org_id)) return res.status(403).json({ message: "Anggota ini berada di luar cakupan unit Anda." });

    const rec = await getAuth().getUser(uid);
    const email = (rec.email || "").toLowerCase();
    if (email.length < 6) return res.status(400).json({ message: "Email anggota tidak dapat dijadikan kata sandi default." });
    await getAuth().updateUser(uid, { password: email });
    await getAuth().revokeRefreshTokens(uid); // keluarkan sesi yang sedang aktif
    await db.collection("audit_logs").add({ aksi: "RESET_PASSWORD", pelaku_uid: caller.uid, pelaku_nama: c.nama_lengkap || caller.email || caller.uid, target_uid: uid, target_nama: t.nama_lengkap || email, timestamp: FieldValue.serverTimestamp() });
    return res.status(200).json({ ok: true, message: "Kata sandi dikembalikan ke default." });
  } catch (e) {
    return res.status(500).json({ message: "Kesalahan server: " + (e.message || e) });
  }
}
