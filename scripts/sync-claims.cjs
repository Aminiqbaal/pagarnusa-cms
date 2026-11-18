// Menyalin role/org/hierarki_path dari dokumen users ke custom claims Firebase Auth.
// Perlu dijalankan setelah menambah anggota baru dari CMS agar mereka dapat memakai aplikasi mobile.
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("../serviceAccount.json")) });
(async () => {
  const snap = await admin.firestore().collection("users").get();
  let n = 0;
  for (const d of snap.docs) {
    const u = d.data();
    if (!u.role || !u.org_id || !u.hierarki_path) continue;
    try {
      await admin.auth().setCustomUserClaims(d.id, { role: u.role, org_id: u.org_id, hierarki_path: u.hierarki_path });
      n++;
    } catch (e) { console.log("Lewati", d.id, e.code); }
  }
  console.log(`${n} akun disinkronkan.`);
})();
