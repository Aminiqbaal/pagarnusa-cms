// Menetapkan role + unit untuk sebuah akun. Dipakai untuk admin pertama,
// sebelum backend Axum tersedia.  Contoh:
//   npm run set-role -- <UID> admin_pusat PP
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("../serviceAccount.json")) });
const [, , uid, role, org] = process.argv;
const ROLES = ["super_admin","admin_pusat","admin_wilayah","admin_cabang","admin_pac","admin_rayon","admin_ranting","member"];
(async () => {
  if (!uid || !ROLES.includes(role) || !org) throw new Error("Pemakaian: npm run set-role -- <UID> <role> <ORG_ID>");
  const db = admin.firestore();
  const o = await db.doc(`organizations/${org}`).get();
  if (!o.exists) throw new Error("Unit tidak ditemukan: " + org + " (jalankan npm run seed dulu)");
  const path = o.data().hierarki_path;
  const user = await admin.auth().getUser(uid);
  const prev = (await db.doc(`users/${uid}`).get()).data() || {};
  const nama = prev.nama_lengkap || user.displayName || user.email;
  await admin.auth().setCustomUserClaims(uid, { role, org_id: org, hierarki_path: path });
  await db.doc(`users/${uid}`).set({ nama_lengkap: nama, role, org_id: org, hierarki_path: path, status_aktif: true }, { merge: true });
  await db.collection("audit_logs").add({
    aksi: "CHANGE_ROLE", pelaku_uid: "script", pelaku_nama: "Skrip admin", target_uid: uid, target_nama: nama,
    role_lama: prev.role || null, role_baru: role, timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`${nama} sekarang ${role} @ ${org}. Minta pengguna logout lalu login lagi.`);
})().catch(e => { console.error(e.message); process.exit(1); });
