# CMS Admin – Pagar Nusa Gresik

Web CMS (Vite + JavaScript) untuk proyek Firebase **pn-gresik**. Akses dibatasi per jenjang lewat custom claims + Firestore Rules.

## Alamat
- **CMS:** `/admin` (mis. http://localhost:5173/admin, setelah deploy https://pn-gresik.web.app/admin)
- **Website publik per unit:** `/` = Pusat, `/jawatimur`, `/jawatimur/gresik`, `/jawatimur/gresik/manyar`, `/jawatimur/gresik/manyar/suci`, dst.
  Alamat tiap unit tersimpan di field `url_path` pada koleksi `organizations` (diisi oleh `npm run seed`).

## Fitur
- Keuangan per unit (privat) + donasi rayon/ranting ke PAC; kategori konten; konten berjenjang; anggota/pengurus (nama, alamat, email, NIA, role).
- **Ubah jabatan dari website.** Peran dibaca dari dokumen `users/{uid}` (bukan custom claims), jadi tidak perlu Axum atau `sync-claims`.
- Tipe role khusus dengan isian dinamis: Pelatih, PASTI (Pasukan Inti; prasyarat Pelatih), Anggota Tetap.
- UKT: rayon/ranting mengajukan, PAC memverifikasi, Hitam dilanjutkan cabang. Sertifikat (PNG/PDF) terbit otomatis dari desain yang diunggah admin cabang.
- Website publik tiap unit menampilkan profil dan konten bertanda “Web”.
- Anggota baru otomatis dibuatkan akun login: **kata sandi awal = alamat email**; CMS memaksa penggantian kata sandi saat login pertama.
- UKT: dilaksanakan mandiri oleh ranting/rayon atau didelegasikan ke PAC; PAC memverifikasi lalu mengajukan sertifikat ke cabang; cabang menerbitkan.
- SK Kepengurusan: Ranting/Rayon → PAC → dilantik Cabang; PAC → Cabang → dilantik Wilayah; Cabang → Wilayah → dilantik Pusat. Template (.doc/.docx/.pdf) diunggah unit pelantik; SK terbit dapat diunggah dan diunduh.

## Tambahan terbaru
- **Super Admin** (`super_admin`): akses semua menu dan dapat menonaktifkan/mengaktifkan semua pengguna (termasuk Admin Pusat). Buat yang pertama dengan `npm run set-role -- <UID> super_admin PP`. Kas privat tiap unit tetap hanya terbaca unit itu sendiri.
- **Sertifikat UKT**: posisi nama/nomor diatur dengan seret-dan-lepas di pratinjau; nomor terakhir yang sudah dicetak dan format nomor dapat diubah per tingkat.
- **SK**: susunan pengurus fleksibel (jabatan + nama), SK dibuat otomatis sebagai PDF dengan nomor `urut/KODE-PENGESAH/A1/tahun`, ditandatangani Ketua dan Sekretaris pengesah (nama dan gambar tanda tangan di Profil & website).
- **Pelatihan** (menu berisi **Pelatih** dan **Wasit Juri**). Wasit Juri: Internal Pagar Nusa (per cabang) atau IPSI (Kabupaten/Kota, Provinsi, Nasional); alur sama dengan Pelatih, dan untuk IPSI cabang menerbitkan surat rekomendasi (PDF) ke IPSI.
- **Pelatihan Pelatih** (minimal sabuk Coklat): ranting/rayon mendaftarkan, PAC memverifikasi lalu membayar ke cabang (unggah bukti), cabang memverifikasi pembayaran; cabang mengelola rekening, QRIS, dan biaya.

## Langkah awal (sekali saja)

1. **Firebase Console**: aktifkan *Authentication → Email/Password*, buat *Firestore Database* (`asia-southeast2`),
   dan daftarkan *Web app* di Project settings untuk mendapat `firebaseConfig`.
2. `cp .env.example .env`, lalu isi `VITE_FIREBASE_API_KEY` dan `VITE_FIREBASE_APP_ID`.
3. Unduh kunci service account (Project settings → Service accounts → Generate new private key),
   simpan sebagai `serviceAccount.json` di folder ini. **Jangan di-commit atau dibagikan.**
4. `npm install`
5. `npm run seed` (mengisi unit, tipe role PASTI/Pelatih, dan kategori awal; aman diulang)
6. Buat akun di Authentication → Users, salin UID-nya, lalu:
   `npm run set-role -- <UID> admin_pusat PP`
7. `npx firebase-tools login`, lalu `npx firebase-tools deploy --only firestore` (menerbitkan Rules).
8. `npm run dev`, lalu buka `http://localhost:5173/admin`. Masuk dengan akun tadi.

## Menerbitkan ke Firebase Hosting

```
npm run deploy      # build + deploy hosting & firestore
```
Situs aktif di https://pn-gresik.web.app

## Setelah memperbarui kode
- Terbitkan ulang aturan: `npx firebase-tools deploy --only firestore` (atau tempel `firestore.rules` di Console > Rules > Publish).
- Jalankan ulang `npm run seed` agar tipe role dan kategori awal terisi.

## Catatan
- Kas ditulis langsung dari klien dan dibatasi Rules ke unit sendiri. Ini belum anti-manipulasi seperti lewat server Axum; pindahkan penulisan kas ke Axum untuk produksi.
- Desain sertifikat disimpan di Firestore (dikompres hingga ±900 KB) agar tidak butuh Cloud Storage/Blaze. Pindahkan ke Storage bila nanti memakai Blaze.
- Prasyarat dan “pemberi minimal” pada tipe role ditegakkan di tampilan CMS, belum di Firestore Rules.
- Pengaturan menu hanya mengatur tampilan; hak akses data tetap ditentukan Rules.
- Kata sandi awal sama dengan email itu mudah ditebak. Pemaksaan ganti sandi hanya berlaku di CMS ini (bukan di server); terapkan hal yang sama di aplikasi mobile.
- Berkas template/SK disimpan di Firestore (dipecah, maks. 3 MB per berkas). Pindahkan ke Cloud Storage bila nanti memakai Blaze.
- Akun login anggota tidak bisa dihapus dari klien; “Nonaktifkan” hanya menandai profil.

- Jabatan diubah dari menu Anggota di CMS; `npm run set-role` hanya dibutuhkan untuk admin pertama.
- Data uang (`financial_reports`, `donations`, dst.) hanya dibaca klien; Rules menolak semua tulisan.
- Rules `posts` membatasi tulis/hapus ke unit dalam cakupan admin. Baca konten untuk admin tidak dibatasi cakupan
  oleh Rules (tampilan CMS menyaringnya); perketat bila konten draf antarunit bersifat rahasia.
- Uji Rules dengan Firebase Emulator sebelum dipakai untuk data sungguhan.
- Anggota (`member`) tidak dapat masuk CMS; mereka memakai aplikasi mobile.
- Paket belum dijalankan/diuji di lingkungan ini (tanpa akses internet untuk `npm install`).

---

# Web (Vercel) + Android/iOS (Capacitor) dalam satu kodebase

Satu hasil build Vite (`dist/`) dipakai tiga tempat: **web di Vercel**, **aplikasi Android (.apk)**, dan **aplikasi iOS**.
Di dalam aplikasi, halaman pertama langsung CMS (login); di web, `/admin` = CMS dan alamat lain = website publik unit.

## 1. Konfigurasi rilis & tombol Download APK
- Semua data rilis ada di **`src/release.config.json`** (versi, versionCode, nama berkas, GitHub owner/repo, tanggal, catatan).
- Tautan unduhan = `downloadUrl` bila diisi (mis. Firebase Storage), jika kosong otomatis:
  `https://github.com/<owner>/<repo>/releases/download/v<versi>/<fileName>`.
- Tombol muncul di halaman login CMS dan footer website publik (`src/components/download-apk.js`); disembunyikan di dalam aplikasi.
- Isi `github.owner` dan `github.repo` sekali saja. Selama masih `GANTI_...`, tombol tampil nonaktif "segera hadir".
- Rilis baru: `npm run release:set -- 1.1.0 --size 12.4 --notes "Perbaikan"` lalu commit & push. Vercel build ulang, label dan tautan ikut berubah.

## 2. Deploy web ke Vercel
1. Pastikan aman: `npm run check:secrets`, lalu push repo ke GitHub.
2. vercel.com → *Add New → Project* → impor repo. Preset *Vite* (Build `npm run build`, Output `dist`). `vercel.json` sudah mengarahkan semua alamat ke `index.html` (dibutuhkan untuk `/admin` dan `/jawatimur/gresik`).
3. *Settings → Environment Variables*: isi semua `VITE_*` dari `.env.example` (termasuk `VITE_SITE_URL` = domain Vercel Anda). Deploy ulang setelah mengisinya.
4. Tiap push ke branch utama = deploy otomatis.

## 3. Capacitor: pemasangan awal (sekali)
Ubah `appId` di `capacitor.config.json` lebih dulu (tidak boleh diganti setelah dirilis), lalu:
```
npm install
npm i @capacitor/core @capacitor/app @capacitor/status-bar @capacitor/filesystem @capacitor/share
npm i -D @capacitor/cli
npm i @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios            # hanya di macOS + Xcode
```
Plugin Filesystem dan Share dibutuhkan agar unduh sertifikat/SK/surat bisa disimpan dari dalam aplikasi.

## 4. Sinkron hasil build ke Android & buat APK
```
npm run android            # vite build + cap sync android + buka Android Studio
cd android && ./gradlew assembleDebug      # uji: android/app/build/outputs/apk/debug/app-debug.apk
```
**APK rilis (bertanda tangan):**
```
keytool -genkey -v -keystore ~/pagarnusa-release.jks -alias pagarnusa -keyalg RSA -keysize 2048 -validity 10000
```
Simpan keystore **di luar repo** dan cadangkan (jika hilang, aplikasi tidak bisa diperbarui). Buat `android/keystore.properties` (sudah di-.gitignore):
```
storeFile=/Users/ANDA/pagarnusa-release.jks
storePassword=...
keyAlias=pagarnusa
keyPassword=...
```
Tambahkan di `android/app/build.gradle` (bagian atas dan di dalam `android { }`):
```groovy
def ksFile = rootProject.file("keystore.properties")
def ks = new Properties(); if (ksFile.exists()) ks.load(new FileInputStream(ksFile))

android {
  signingConfigs { release { if (ksFile.exists()) { storeFile file(ks["storeFile"]); storePassword ks["storePassword"]; keyAlias ks["keyAlias"]; keyPassword ks["keyPassword"] } } }
  buildTypes { release { signingConfig signingConfigs.release } }
}
```
Lalu `cd android && ./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`; ganti namanya menjadi `pagar-nusa-cms.apk`.

## 5. Alur rilis lengkap
```
npm run release:set -- 1.0.0 --size 12.4        # versi web + android/app/build.gradle
cd android && ./gradlew assembleRelease && cd ..
gh release create v1.0.0 pagar-nusa-cms.apk --title "v1.0.0" --notes "Rilis pertama"   # unggah APK DULU
git add -A && git commit -m "Rilis APK 1.0.0" && git push                             # lalu push -> Vercel
```
Unggah APK ke GitHub Releases sebelum push agar tautan di web tidak sempat 404.

## 6. Keamanan berkas sensitif
- `.gitignore` mengecualikan `.env*`, `serviceAccount*.json`, keystore (`*.jks`, `keystore.properties`), `*.apk/*.aab`, dan artefak build.
- `npm run check:secrets` memeriksa berkas yang ter-commit; pasang sebagai pre-commit:
  `printf '#!/bin/sh\nnpm run -s check:secrets\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
- Bila `serviceAccount.json` pernah ter-push, buat kunci baru di Firebase Console dan hapus yang lama.
- Nilai `VITE_FIREBASE_*` memang tampil di sisi klien (normal untuk Firebase web); pengamannya adalah Firestore Rules.

## 7. Catatan platform
- iOS: berkas `.ipa` tidak bisa dibagikan lewat tautan; distribusi lewat TestFlight/App Store (perlu Apple Developer Program).
- Di aplikasi, tombol "Lihat blog" memakai `VITE_SITE_URL` (alamat bawaan di aplikasi adalah `https://localhost`).
- Jika status bar Android menimpa tajuk, pastikan plugin `@capacitor/status-bar` terpasang (kode sudah mengatur overlay mati).
- Aplikasi memerlukan internet (Firestore/Auth); belum ada mode offline.
