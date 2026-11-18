// Memperbarui src/release.config.json (dan versi Android bila folder android/ ada).
// Pemakaian: npm run release:set -- 1.1.0 [--notes "Catatan"] [--url https://...] [--size 12.4] [--code 7]
// Setelah itu: git add -A && git commit && git push  -> Vercel build ulang -> tombol & label APK di web ikut berubah.
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2), version = args[0];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) { console.error("Pemakaian: npm run release:set -- <versi, mis. 1.1.0> [--notes ...] [--url ...] [--size MB] [--code N]"); process.exit(1); }
const opt = (k) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : undefined; };
const cfgPath = path.join(__dirname, "..", "src", "release.config.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
cfg.versionCode = opt("code") !== undefined ? Number(opt("code")) : (cfg.versionCode || 0) + 1;
cfg.version = version;
cfg.releasedAt = new Date().toISOString().slice(0, 10);
if (opt("notes") !== undefined) cfg.notes = opt("notes");
if (opt("url") !== undefined) cfg.downloadUrl = opt("url");   // "" = kembali ke GitHub Releases
if (opt("size") !== undefined) cfg.sizeMB = Number(opt("size"));
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
const g = path.join(__dirname, "..", "android", "app", "build.gradle");
if (fs.existsSync(g)) {
  let t = fs.readFileSync(g, "utf8");
  t = t.replace(/(versionCode\s*=?\s*)\d+/, `$1${cfg.versionCode}`).replace(/(versionName\s*=?\s*)"[^"]*"/, `$1"${version}"`);
  fs.writeFileSync(g, t); console.log("android/app/build.gradle diperbarui");
}
const { owner, repo } = cfg.github || {};
console.log(`Rilis ${version} (code ${cfg.versionCode}) tersimpan.`);
console.log("Unggah berkas APK dengan nama:", cfg.fileName);
console.log("ke:", cfg.downloadUrl || `https://github.com/${owner}/${repo}/releases/new?tag=v${version}`);
