// Mencegah berkas rahasia ikut ter-commit. Jalankan: npm run check:secrets
// Pasang sebagai pre-commit:  printf '#!/bin/sh\nnpm run -s check:secrets\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
const { execSync } = require("child_process"), fs = require("fs");
const sh = (c) => { try { return execSync(c, { encoding: "utf8" }).split("\n").filter(Boolean); } catch { return null; } };
const tracked = sh("git ls-files"), staged = sh("git diff --cached --name-only");
if (!tracked) { console.log("Bukan repositori git; dilewati."); process.exit(0); }
const files = [...new Set([...tracked, ...(staged || [])])].filter((f) => fs.existsSync(f));
const nameBad = (f) => /(^|\/)\.env(\.(?!example$)[^/]*)?$/.test(f) || /serviceAccount[^/]*\.json$/i.test(f) || /-firebase-adminsdk-[^/]*\.json$/i.test(f)
  || /\.(jks|keystore|p12|pfx)$/i.test(f) || /(^|\/)keystore\.properties$/.test(f) || /(^|\/)local\.properties$/.test(f) || /\.(apk|aab)$/i.test(f);
const bad = files.filter(nameBad);
for (const f of files) { try { if (fs.statSync(f).size < 2e6 && /-----BEGIN (RSA |EC )?PRIVATE KEY-----|"private_key"\s*:/.test(fs.readFileSync(f, "utf8")) && !bad.includes(f)) bad.push(f + "  (memuat kunci privat)"); } catch { /* biner */ } }
if (bad.length) { console.error("BERKAS RAHASIA TERDETEKSI di git:\n - " + bad.join("\n - ") + "\nHapus dari git: git rm --cached <berkas>, tambahkan ke .gitignore, dan putar (rotate) kuncinya bila sudah pernah di-push."); process.exit(1); }
console.log("Aman: tidak ada berkas rahasia yang ter-commit.");
