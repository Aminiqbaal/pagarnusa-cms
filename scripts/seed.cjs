// Mengisi unit (organizations), tipe role khusus, dan kategori konten awal. Aman dijalankan ulang.
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("../serviceAccount.json")) });
// [id, nama, tingkat, parent, slug]  -> alamat website = /slug-wilayah/slug-cabang/slug-pac/slug-ranting
const ORGS = [
  ["PP", "Pimpinan Pusat", "pusat", null, ""],
  ["PW-JATIM", "Pimpinan Wilayah Jawa Timur", "wilayah", "PP", "jawatimur"],
  ["PC-GRESIK", "Pimpinan Cabang Gresik", "cabang", "PW-JATIM", "gresik"],
  ["PAC-MANYAR", "Pimpinan Anak Cabang Manyar", "pac", "PC-GRESIK", "manyar"],
  ["PAC-KEBOMAS", "Pimpinan Anak Cabang Kebomas", "pac", "PC-GRESIK", "kebomas"],
  ["RNT-SUCI", "Pimpinan Ranting Suci", "ranting", "PAC-MANYAR", "suci"],
  ["RYN-SMAN1", "Pimpinan Rayon SMAN 1 Manyar", "rayon", "PAC-MANYAR", "sman1"],
  ["RNT-INDRO", "Pimpinan Ranting Indro", "ranting", "PAC-KEBOMAS", "indro"],
];
const byId = Object.fromEntries(ORGS.map((o) => [o[0], o]));
const pathOf = (id) => (byId[id][3] ? [...pathOf(byId[id][3]), id] : [id]);
(async () => {
  const db = admin.firestore();
  const b = db.batch();
  for (const [id, nama_unit, tingkat, parent_id, slug] of ORGS) {
    const path = pathOf(id);
    const url_path = path.slice(1).map((o) => byId[o][4]).join("/");
    b.set(db.doc(`organizations/${id}`), { nama_unit, tingkat, parent_id, hierarki_path: path, slug, url_path }, { merge: true });
  }
  // Tipe role khusus (dimiliki Pusat; dapat diubah di CMS > Role & menu)
  b.set(db.doc("role_types/pelatih"), { nama: "Pelatih", min_pemberi: "ranting", butuh_internal: true, butuh_ipsi: true, prasyarat: "", fields: [], org_id: "PP", created_by: "seed" }, { merge: true });
  b.set(db.doc("role_types/pasti"), { nama: "PASTI (Pasukan Inti)", min_pemberi: "cabang", butuh_internal: false, butuh_ipsi: false, prasyarat: "pelatih",
    fields: [{ key: "nomor_anggota_pasti", label: "Nomor Anggota PASTI", type: "teks", options: [] }, { key: "jenjang_pasti", label: "Jenjang PASTI", type: "teks", options: [] }], org_id: "PP", created_by: "seed" }, { merge: true });
  b.set(db.doc("role_types/anggota_tetap"), { nama: "Anggota Tetap", min_pemberi: "ranting", butuh_internal: false, butuh_ipsi: false, prasyarat: "",
    fields: [{ key: "tahun_pembaiatan", label: "Tahun Pembaiatan", type: "angka", options: [] }, { key: "alamat_domisili", label: "Alamat Domisili", type: "teks", options: [] },
             { key: "jenjang_tingkatan", label: "Jenjang Tingkatan", type: "pilihan", options: ["Putih", "Kuning", "Merah", "Biru", "Coklat", "Hitam"] }], org_id: "PP", created_by: "seed" }, { merge: true });
  for (const [id, nama] of [["pengumuman", "Pengumuman"], ["kegiatan", "Kegiatan"], ["prestasi", "Prestasi"]])
    b.set(db.doc(`post_categories/${id}`), { nama, org_id: "PP", created_by: "seed" }, { merge: true });
  await b.commit();
  console.log(`${ORGS.length} unit (dengan alamat website), 3 tipe role, 3 kategori tersimpan.`);
})();
