import "./style.css";
import "./responsive.css";
import { enhanceTables } from "./ui/responsive.js";
import { apkButtonHTML } from "./components/download-apk.js";
import { isNative } from "./native.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword } from "firebase/auth";
import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  addDoc, updateDoc, deleteDoc, setDoc, getDoc, getDocs, writeBatch, runTransaction, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { auth, db, secondaryAuth } from "./firebase.js";

/* ---------- konstanta ---------- */
const RL = { super_admin: "Super Admin", admin_pusat: "Admin Pusat", admin_wilayah: "Admin Wilayah", admin_cabang: "Admin Cabang", admin_pac: "Admin PAC", admin_rayon: "Admin Rayon", admin_ranting: "Admin Ranting", member: "Anggota" };
const LV = { super_admin: -1, admin_pusat: 0, admin_wilayah: 1, admin_cabang: 2, admin_pac: 3, admin_rayon: 4, admin_ranting: 4, member: 5 };
const TNG = { pusat: "Pusat", wilayah: "Wilayah (Provinsi)", cabang: "Cabang (Kab/Kota)", pac: "PAC (Kecamatan)", rayon: "Rayon", ranting: "Ranting (Desa/Kel.)" };
const TL = { pusat: 0, wilayah: 1, cabang: 2, pac: 3, rayon: 4, ranting: 4 };
const ADMIN_FOR = { pusat: "admin_pusat", wilayah: "admin_wilayah", cabang: "admin_cabang", pac: "admin_pac", rayon: "admin_rayon", ranting: "admin_ranting" };
const JENJANG = { kabupaten: "Kabupaten/Kota", provinsi: "Provinsi", nasional: "Nasional" };
const VSTAT = [["belum", "Belum"], ["terverifikasi", "Terverifikasi"], ["ditolak", "Ditolak"]];
const LEVELS = ["Putih", "Kuning", "Merah", "Biru", "Coklat", "Hitam"];
const GRP = { Putih: "Santri", Kuning: "Santri", Merah: "Santri", Biru: "Santri", Coklat: "Asisten Pelatih", Hitam: "Pelatih" };
const STG = { pending: "Diajukan", disetujui_pac: "Diverifikasi PAC", diajukan_cabang: "Diajukan ke cabang", disetujui_cabang: "Sertifikat terbit", revisi: "Perlu revisi" };
const SKJ = { ranting_rayon: "SK Pimpinan Ranting/Rayon", pac: "SK Pimpinan Anak Cabang", cabang: "SK Pimpinan Cabang" };
const SKS = { diajukan: "Diajukan", diteruskan: "Diteruskan", dilantik: "SK terbit & dilantik", revisi: "Perlu revisi" };
const SK_BY_TNG = { ranting: "ranting_rayon", rayon: "ranting_rayon", pac: "pac", cabang: "cabang" };
const SK_ISSUE = { cabang: "ranting_rayon", wilayah: "pac", pusat: "cabang" };
const DEF_FMT = "{kode}/UKT-{TINGKAT}/{tahun}/{urut}";
const nomorFmt = (f, o) => String(f || DEF_FMT).replace(/\{urut\}/g, String(o.urut).padStart(4, "0")).replace(/\{kode\}/g, o.kode).replace(/\{TINGKAT\}/g, o.level.toUpperCase()).replace(/\{tingkat\}/g, o.level).replace(/\{tahun\}/g, o.year);
const PLS = { diajukan: "Diajukan", diverifikasi_pac: "Diverifikasi PAC", menunggu_bayar: "Menunggu verifikasi pembayaran", terdaftar: "Terdaftar", revisi: "Perlu revisi" };
const PAYS = { menunggu: "Menunggu verifikasi", terverifikasi: "Terverifikasi", ditolak: "Ditolak" };
const MENUS = [["dasbor", "Dashboard"], ["konten", "Konten"], ["kategori", "Kategori konten"], ["anggota", "Anggota"], ["ukt", "Verifikasi UKT"], ["pelatihan", "Pelatihan"], ["keuangan", "Keuangan"], ["sk", "SK Kepengurusan"], ["profil", "Profil & website"], ["role", "Role & menu"], ["audit", "Audit log"]];
const defMenus = (r) => (LV[r] >= 4 ? ["dasbor", "konten", "kategori", "anggota", "ukt", "pelatihan", "keuangan", "sk", "profil"] : MENUS.map((m) => m[0]));

const S = {
  me: null, orgs: {}, posts: [], upPosts: {}, cats: [], users: [], ukt: [], kas: [], donOut: [], donIn: [],
  types: [], myCfg: [], cfgOwn: [], tpl: [], sk: [], skTpl: [], pls: [], plp: [], accts: [], pset: null, cntRek: { n: 0 }, cnt: {}, cntSK: 0, sig: {}, mq: "", og: null, vSeen: "", v: "", audit: [], unsubs: [], q: "", fs: "", fk: "", sc: "", fu: "",
};

/* ---------- util ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const orgName = (id) => S.orgs[id]?.nama_unit || id;
const inScope = (id) => !!S.orgs[id]?.hierarki_path?.includes(S.me.org_id);
const dt = (t) => (t?.toDate ? t.toDate() : null);
const ts = (t) => dt(t)?.getTime() ?? Date.now();
const fmt = (t) => (dt(t) ? dt(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "–");
const fmtD = (t) => (dt(t) ? dt(t).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "–");
const R = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const docs = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
const val = (id) => $("#" + id).value.trim();
const myTng = () => S.orgs[S.me.org_id]?.tingkat;
const tbl = (h, rows, empty) => `<div class="tw"><table><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr>${rows || `<tr><td colspan="${h.length}" class="empty">${empty}</td></tr>`}</table></div>`;
const fld = (l, id, v = "", type = "text") => `<label for="${id}">${l}</label><input id="${id}" type="${type}" value="${esc(v)}">`;
const sel = (l, id, opts, cur) => `<label for="${id}">${l}</label><select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
const btn = (act, id, label, cls = "", dis = false) => `<button class="${cls}" data-act="${act}" data-id="${esc(id)}" ${dis ? "disabled" : ""}>${label}</button>`;
const errMsg = (e) => ({ "auth/email-already-in-use": "Email sudah terdaftar.", "auth/invalid-email": "Format email tidak valid.", "permission-denied": "Ditolak oleh aturan akses (permission-denied)." }[e.code] || e.code || e.message);
const hist = (status, catatan) => ({ status, oleh: S.me.nama, tanggal: new Date().toISOString(), ...(catatan ? { catatan } : {}) });

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 3800); }
const fail = (e) => toast("Gagal: " + errMsg(e));
function dlg(html) { const d = $("#dlg"); d.innerHTML = html; d.showModal(); }
const closeDlg = () => $("#dlg").close();
function modal(title, body, onSave, label = "Simpan", after) {
  dlg(`<h2>${title}</h2>${body}<div class="btns"><button id="c">Batal</button><button class="pri" id="ok">${label}</button></div>`);
  $("#c").onclick = closeDlg;
  $("#ok").onclick = async () => { try { if ((await onSave()) !== false) closeDlg(); } catch (e) { fail(e); } };
  after?.();
}

/* ---------- auth ---------- */
function stop() { S.unsubs.forEach((u) => u()); S.unsubs = []; S.upPosts = {}; }

onAuthStateChanged(auth, async (u) => {
  stop();
  if (!u) return loginScreen();
  let p;
  try { p = (await getDoc(doc(db, "users", u.uid))).data(); } catch { p = null; }
  if (!p || !p.role || p.role === "member" || p.status_aktif === false) return blocked(u, p?.role);
  if (sessionStorage.getItem("pn_force_pw")) return changePwScreen(u);
  S.me = { uid: u.uid, email: u.email, role: p.role, org_id: p.org_id, path: p.hierarki_path || [p.org_id], nama: p.nama_lengkap || u.email };
  // Jabatan diubah dari website -> muat ulang agar menu & akses langsung menyesuaikan.
  S.unsubs.push(onSnapshot(doc(db, "users", u.uid), (s) => {
    const d = s.data();
    if (d && S.me && (d.role !== S.me.role || d.org_id !== S.me.org_id || d.status_aktif === false)) location.reload();
  }));
  const orgs = await getDocs(collection(db, "organizations"));
  S.orgs = Object.fromEntries(orgs.docs.map((d) => [d.id, d.data()]));
  subscribe();
  shell();
});

function loginScreen() {
  $("#app").innerHTML = `<div class="card login"><h1>CMS Admin</h1><p class="mute">Pagar Nusa Gresik. Masuk dengan akun pengurus.</p>
  <label for="em">Email</label><input id="em" type="email" autocomplete="username">
  <label for="pw">Kata sandi</label><input id="pw" type="password" autocomplete="current-password">
  <div class="btns"><button class="pri" id="go">Masuk</button></div>${apkButtonHTML({ compact: true })}</div>`;
  const go = async () => {
    const em = $("#em").value.trim(), pw = $("#pw").value;
    // Kata sandi awal anggota baru = alamat email -> wajib diganti sebelum memakai CMS.
    if (pw && pw.toLowerCase() === em.toLowerCase()) sessionStorage.setItem("pn_force_pw", "1"); else sessionStorage.removeItem("pn_force_pw");
    try { await signInWithEmailAndPassword(auth, em, pw); }
    catch (e) { sessionStorage.removeItem("pn_force_pw"); toast(e.code === "auth/invalid-credential" ? "Email atau kata sandi salah." : "Gagal masuk: " + e.code); }
  };
  $("#go").onclick = go;
  $("#pw").onkeydown = (e) => { if (e.key === "Enter") go(); };
}

function changePwScreen(u) {
  $("#app").innerHTML = `<div class="card login"><h1>Buat kata sandi baru</h1>
  <p class="mute">Kata sandi awal Anda sama dengan alamat email. Demi keamanan, ganti dengan kata sandi baru sebelum melanjutkan.</p>
  <label for="n1">Kata sandi baru (minimal 8 karakter)</label><input id="n1" type="password" autocomplete="new-password">
  <label for="n2">Ulangi kata sandi baru</label><input id="n2" type="password" autocomplete="new-password">
  <div class="btns"><button id="out">Keluar</button><button class="pri" id="go">Simpan</button></div></div>`;
  $("#out").onclick = () => signOut(auth);
  $("#go").onclick = async () => {
    const a = $("#n1").value, b = $("#n2").value;
    if (a.length < 8) return toast("Kata sandi minimal 8 karakter.");
    if (a.toLowerCase() === (u.email || "").toLowerCase()) return toast("Kata sandi tidak boleh sama dengan email.");
    if (a !== b) return toast("Pengulangan kata sandi tidak sama.");
    try { await updatePassword(u, a); sessionStorage.removeItem("pn_force_pw"); toast("Kata sandi diperbarui."); setTimeout(() => location.reload(), 600); } catch (e) { toast("Gagal: " + (e.code === "auth/requires-recent-login" ? "masuk ulang lalu coba lagi." : e.code)); }
  };
}

function blocked(u, role) {
  $("#app").innerHTML = `<div class="card login"><h1>Akses belum tersedia</h1>
  <p class="mute">${role === "member" ? "CMS hanya untuk pengurus." : "Akun " + esc(u.email) + " belum diberi role pengurus."} Minta admin menetapkan jabatan Anda, atau jalankan <code>npm run set-role</code> untuk admin pertama. Setelah itu keluar dan masuk lagi.</p>
  <div class="btns"><button id="out">Keluar</button></div></div>`;
  $("#out").onclick = () => signOut(auth);
}

/* ---------- data real-time ---------- */
function sub(q, key, sort) {
  S.unsubs.push(onSnapshot(q, (s) => {
    S[key] = docs(s);
    if (sort) S[key].sort(sort);
    render();
  }, (e) => toast(`Gagal memuat ${key}: ${e.code}`)));
}
function subscribe() {
  const org = S.me.org_id, c = (n) => collection(db, n);
  sub(query(c("posts"), where("hierarki_path", "array-contains", org), limit(300)), "posts");
  S.me.path.filter((a) => a !== org).forEach((a) => S.unsubs.push(onSnapshot(
    query(c("posts"), where("target_org_id", "==", a), where("status", "==", "published"), limit(100)),
    (s) => { S.upPosts[a] = docs(s); render(); },
    (e) => toast("Gagal memuat konten dari atas: " + e.code))));
  sub(query(c("users"), where("hierarki_path", "array-contains", org)), "users", (a, b) => (a.nama_lengkap || "").localeCompare(b.nama_lengkap || ""));
  sub(query(c("ukt_registrations"), where("hierarki_path", "array-contains", org)), "ukt", (a, b) => ts(b.created_at) - ts(a.created_at));
  sub(query(c("sk_requests"), where("hierarki_path", "array-contains", org), limit(200)), "sk", (a, b) => ts(b.created_at) - ts(a.created_at));
  if (SK_ISSUE[myTng()]) sub(query(c("sk_templates"), where("org_id", "==", org)), "skTpl");
  const cabId = myTng() === "cabang" ? org : myTng() === "pac" ? S.orgs[org]?.parent_id : "";
  sub(query(c("pelatihan_registrations"), where("hierarki_path", "array-contains", org), limit(300)), "pls", (a, b) => ts(b.created_at) - ts(a.created_at));
  sub(query(c("pelatihan_payments"), where("hierarki_path", "array-contains", org), limit(200)), "plp", (a, b) => ts(b.created_at) - ts(a.created_at));
  if (cabId) {
    sub(query(c("payment_accounts"), where("org_id", "==", cabId)), "accts");
    S.unsubs.push(onSnapshot(doc(db, "pelatihan_settings", cabId), (d) => { S.pset = d.exists() ? d.data() : null; render(); }, () => {}));
  }
  if (S.me.role === "admin_cabang") S.unsubs.push(onSnapshot(doc(db, "counters", `${org}_REKWJ`), (d) => { S.cntRek = d.exists() ? d.data() : { n: 0 }; render(); }, () => {}));
  if (S.me.role === "admin_cabang") LEVELS.forEach((l) => S.unsubs.push(onSnapshot(doc(db, "counters", `${org}_${l}`), (d) => { S.cnt[l] = d.exists() ? d.data() : { n: 0 }; render(); }, () => {})));
  if (SK_ISSUE[myTng()]) S.unsubs.push(onSnapshot(doc(db, "counters", `${org}_SK${new Date().getFullYear()}`), (d) => { S.cntSK = d.exists() ? d.data().n : 0; render(); }, () => {}));
  S.unsubs.push(onSnapshot(doc(db, "org_signatures", org), (d) => { S.sig = d.exists() ? d.data() : {}; render(); }, () => {}));
  sub(query(c("financial_reports"), where("org_id", "==", org), limit(500)), "kas");
  sub(query(c("unit_donations"), where("from_org", "==", org), limit(200)), "donOut");
  sub(query(c("unit_donations"), where("to_org", "==", org), limit(200)), "donIn");
  sub(query(c("post_categories"), limit(500)), "cats");
  sub(query(c("role_types"), limit(200)), "types");
  sub(query(c("role_menus"), where("role", "==", S.me.role)), "myCfg");
  sub(query(c("role_menus"), where("org_id", "==", org)), "cfgOwn");
  if (S.me.role === "admin_cabang") sub(query(c("ukt_templates"), where("org_id", "==", org)), "tpl");
  sub(query(c("audit_logs"), orderBy("timestamp", "desc"), limit(50)), "audit");
}

/* ---------- turunan data ---------- */
function myMenus() {
  const p = S.me.path;
  const c = S.myCfg.filter((x) => x.org_id !== S.me.org_id && p.includes(x.org_id)).sort((a, b) => p.indexOf(b.org_id) - p.indexOf(a.org_id))[0];
  const m = c ? c.menus : defMenus(S.me.role);
  return MENUS.filter(([k]) => k === "dasbor" || m.includes(k));
}
const ownsPost = (p) => !!p.hierarki_path?.includes(S.me.org_id);
function allPosts() {
  const m = new Map();
  [...S.posts, ...Object.values(S.upPosts).flat()].forEach((p) => m.set(p.id, p));
  return [...m.values()].sort((a, b) => ts(b.created_at) - ts(a.created_at));
}
const visibleCats = () => S.cats.filter((c) => S.me.path.includes(c.org_id));
const catName = (p) => S.cats.find((c) => c.id === p.kategori_id)?.nama || p.kategori_nama || "–";
function fin() {
  const out = S.donOut.filter((d) => d.status === "diterima");
  const ti = S.kas.filter((k) => k.tipe === "pemasukan").reduce((a, k) => a + (k.nominal || 0), 0);
  const to = S.kas.filter((k) => k.tipe === "pengeluaran").reduce((a, k) => a + (k.nominal || 0), 0) + out.reduce((a, d) => a + (d.nominal || 0), 0);
  return { ti, to, out };
}
const uktFinal = (x) => x.status_verifikasi === "disetujui_cabang" || !!x.nomor_sertifikat;
const isSubRole = () => ["admin_ranting", "admin_rayon"].includes(S.me.role);
function uktActions(x) {
  if (x.nomor_sertifikat) return "";
  const r = S.me.role, st = x.status_verifikasi;
  if (r === "admin_pac" && st === "pending") return btn("ukt-ok", x.id, "Verifikasi", "pri") + btn("ukt-rev", x.id, "Minta revisi");
  if (r === "admin_pac" && st === "disetujui_pac") return btn("ukt-ok", x.id, "Ajukan sertifikat ke cabang", "pri");
  if (r === "admin_cabang" && st === "diajukan_cabang") return btn("ukt-ok", x.id, "Terbitkan sertifikat", "pri") + btn("ukt-back", x.id, "Kembalikan ke PAC");
  if (isSubRole() && st === "revisi") return btn("ukt-again", x.id, "Ajukan ulang");
  return "";
}
const todo = () => S.ukt.filter((x) => uktActions(x)).length;
function skActions(x) {
  const me = S.me.org_id, a = [];
  a.push(btn("sk-view", x.id, "Detail"));
  if (x.status === "diajukan" && x.parent_id === me) a.push(btn("sk-fwd", x.id, `Teruskan ke ${esc(orgName(x.issuer_id))}`, "pri"), btn("sk-rev", x.id, "Minta revisi"));
  if (x.status === "diteruskan" && x.issuer_id === me) a.push(btn("sk-issue", x.id, "Terbitkan SK & lantik", "pri"), btn("sk-rev", x.id, "Minta revisi"));
  if (x.status === "revisi" && x.org_id === me) a.push(btn("sk-edit", x.id, "Perbaiki & ajukan ulang", "pri"));
  if (["diajukan", "revisi"].includes(x.status) && x.org_id === me) a.push(btn("sk-del", x.id, "Batalkan", "bad"));
  if (x.status === "dilantik" && x.file) a.push(btn("sk-file", x.id, "Unduh SK"));
  return a.join("");
}
const skTodo = () => S.sk.filter((x) => skActions(x).includes("pri")).length;
const plTodo = () => S.pls.filter((x) => plActions(x)).length + (S.me.role === "admin_cabang" ? S.plp.filter((p) => p.status === "menunggu").length : 0);
const badge = (k) => { const n = k === "ukt" ? todo() : k === "sk" ? skTodo() : k === "pelatihan" ? plTodo() : 0; return n ? `<span class="n">${n}</span>` : ""; };

/* ---------- shell & routing ---------- */
function shell() {
  $("#app").innerHTML = `<aside><div class="brand">Pagar Nusa<small>CMS Admin · Gresik</small></div><div class="side-user" id="meSide"></div><nav id="nav"></nav></aside><div class="scrim" id="scrim"></div>
  <main><header class="top"><button class="burger" id="burger" aria-label="Buka menu" aria-expanded="false">☰</button><h1 id="ttl"></h1>
  <div class="who"><span class="mute" id="me"></span><a class="btn pri" id="blog" href="${esc(siteUrl(S.orgs[S.me.org_id] || {}))}" target="_blank" rel="noopener">Lihat blog</a><button id="th">Tema</button><button id="out">Keluar</button></div></header><section id="view"></section></main>`;
  $("#out").onclick = () => signOut(auth);
  const setNav = (open) => { document.body.classList.toggle("nav-open", open); $("#burger").setAttribute("aria-expanded", String(open)); };
  $("#burger").onclick = () => setNav(!document.body.classList.contains("nav-open"));
  $("#scrim").onclick = () => setNav(false);
  $("#nav").addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); }); // pilih menu -> laci menutup
  $("#th").onclick = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme === "dark" || (!r.dataset.theme && matchMedia("(prefers-color-scheme:dark)").matches);
    r.dataset.theme = dark ? "light" : "dark";
  };
  $("#nav").onclick = (e) => {
    const b = e.target.closest("button[data-grp]");
    if (!b) return;
    S.og = S.og === b.dataset.grp ? null : b.dataset.grp; // buka satu grup menutup grup lain
    navRender(myMenus());
  };
  $("#view").onclick = (e) => { const b = e.target.closest("button[data-act]"); if (b && !b.disabled) ACT[b.dataset.act]?.(b.dataset.id); };
  $("#me").textContent = `${S.me.nama} · ${RL[S.me.role]} · ${orgName(S.me.org_id)}`;
  $("#meSide").textContent = $("#me").textContent;
  render();
}
addEventListener("hashchange", render);

const GROUPS = [
  { id: "web", label: "Web", items: [["konten", "Konten"], ["kategori", "Kategori konten"], ["profil", "Profil & website"]] },
  { id: "org", label: "Organisasi", items: [["anggota", "Anggota"], ["ukt", "Verifikasi UKT"], ["sk", "SK Kepengurusan"]] },
  { id: "pelatihan", label: "Pelatihan", items: [["pelatihan-pelatih", "Pelatih"], ["pelatihan-wasit", "Wasit Juri"]] },
];
// Sidebar akordeon: hanya satu grup yang terbuka pada satu waktu.
function navRender(menus) {
  const ok = menus.map((m) => m[0]), v = S.v;
  const keyOf = (id) => (id.startsWith("pelatihan-") ? "pelatihan" : id);
  const groupOf = (id) => GROUPS.find((g) => g.items.some((i) => i[0] === id))?.id;
  if (S.vSeen !== v) { S.vSeen = v; const g = groupOf(v); if (g) S.og = g; }
  const num = (n) => (n ? ` <span class="n">${n}</span>` : "");
  const bd = { ukt: todo(), sk: skTodo() };
  const link = (id, label) => `<a href="#${id}" class="${id === v ? "on" : ""}">${label}${num(bd[id])}</a>`;
  const single = (k) => (ok.includes(k) ? link(k, MENUS.find((m) => m[0] === k)[1]) : "");
  const group = (g) => {
    const items = g.items.filter(([id]) => ok.includes(keyOf(id)));
    if (!items.length) return "";
    const open = S.og === g.id, n = g.id === "org" ? todo() + skTodo() : g.id === "pelatihan" ? plTodo() : 0;
    return `<button class="navg ${items.some((i) => i[0] === v) ? "has-on" : ""}" data-grp="${g.id}" aria-expanded="${open}" aria-controls="sub-${g.id}"><span>${g.label}${num(n)}</span><span class="chev" aria-hidden="true">▾</span></button>
      <div class="navsub ${open ? "open" : ""}" id="sub-${g.id}">${items.map(([id, l]) => link(id, l)).join("")}</div>`;
  };
  $("#nav").innerHTML = single("dasbor") + GROUPS.map(group).join("") + single("keuangan") + single("role") + single("audit");
}
const VIEWS = { dasbor, konten, kategori: kategoriView, anggota, ukt, "pelatihan-pelatih": () => pelatihan("pelatih"), "pelatihan-wasit": () => pelatihan("wasit_juri"), keuangan, sk, profil, role: roleView, audit };
function render() {
  if (!S.me || !$("#view")) return;
  const menus = myMenus(), ok = menus.map((m) => m[0]);
  let v = (location.hash || "#dasbor").slice(1);
  if (v === "pelatihan") v = "pelatihan-pelatih";
  if (!VIEWS[v] || !ok.includes(v.startsWith("pelatihan-") ? "pelatihan" : v)) v = "dasbor";
  S.v = v; navRender(menus);
  $("#ttl").textContent = v.startsWith("pelatihan-") ? "Pelatihan · " + (v === "pelatihan-wasit" ? "Wasit Juri" : "Pelatih") : MENUS.find((m) => m[0] === v)[1];
  const active = document.activeElement?.id;
  if (["profil"].includes(v) && ["p1", "p2", "p3", "p4", "p5", "p6"].includes(active)) return; // jangan timpa isian yang sedang diketik
  VIEWS[v]();
  enhanceTables($("#view"));
  if (active === "q") { const q = $("#q"); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }
}

/* ---------- dashboard ---------- */
function dasbor() {
  const f = fin(), p = allPosts();
  $("#view").innerHTML = `<p class="mute">Assalamu’alaikum, ${esc(S.me.nama)}. Anda mengelola <b>${esc(orgName(S.me.org_id))}</b> beserta unit di bawahnya.</p>
  <div class="grid">
   <div class="card stat"><b>${S.users.length}</b><span>Anggota dalam cakupan</span></div>
   <div class="card stat"><b>${p.filter((x) => ownsPost(x) && x.status === "published").length}</b><span>Konten terbit milik unit &amp; bawahan</span></div>
   <div class="card stat"><b>${todo()}</b><span>UKT menunggu tindakan Anda</span></div>
   <div class="card stat"><b>${skTodo()}</b><span>SK menunggu tindakan Anda</span></div>
   <div class="card stat"><b>${R(f.ti - f.to)}</b><span>Saldo kas unit ini</span></div></div>
  <div class="two"><div class="card"><b>Konten terbaru</b>${p.slice(0, 4).map((x) => `<p style="margin:8px 0">${esc(x.judul)}<br><span class="mute">${esc(catName(x))} · ${esc(orgName(x.target_org_id))}</span></p>`).join("") || '<p class="empty">Belum ada konten.</p>'}</div>
  <div class="card"><b>Aktivitas role</b>${S.audit.slice(0, 3).map((a) => `<p style="margin:8px 0">${esc(a.pelaku_nama || a.pelaku_uid)} → ${esc(a.target_nama || a.target_uid)}: ${RL[a.role_baru] || a.role_baru}<br><span class="mute">${fmt(a.timestamp)}</span></p>`).join("") || '<p class="empty">Belum ada.</p>'}</div></div>`;
}

/* ---------- konten ---------- */
function konten() {
  const rows = allPosts().filter((x) => (x.judul || "").toLowerCase().includes(S.q.toLowerCase())
    && (!S.fs || x.status === S.fs) && (!S.fk || x.kategori_id === S.fk)
    && (S.sc === "" || (S.sc === "own" ? ownsPost(x) : !ownsPost(x))));
  $("#view").innerHTML = `<p class="mute">Konten unit Anda otomatis tampil di semua unit di bawahnya. Konten bertanda “Web” juga tampil di website publik unit tujuan. Konten dari unit di atas hanya bisa dibaca.</p>
  <div class="bar"><input id="q" placeholder="Cari judul" value="${esc(S.q)}">
  <select id="fsc"><option value="">Semua sumber</option><option value="own" ${S.sc === "own" ? "selected" : ""}>Milik unit &amp; bawahan</option><option value="up" ${S.sc === "up" ? "selected" : ""}>Dari unit di atas</option></select>
  <select id="fk"><option value="">Semua kategori</option>${visibleCats().map((c) => `<option value="${c.id}" ${S.fk === c.id ? "selected" : ""}>${esc(c.nama)}</option>`).join("")}</select>
  <select id="fst"><option value="">Semua status</option><option value="published" ${S.fs === "published" ? "selected" : ""}>Terbit</option><option value="draft" ${S.fs === "draft" ? "selected" : ""}>Draf</option></select>
  <button class="pri" data-act="post-add">Tulis konten</button></div>` +
  tbl(["Judul", "Kategori", "Unit", "Status", ""], rows.map((x) => `<tr><td>${esc(x.judul)}<br><span class="mini">${esc(x.author_nama)} · ${fmt(x.created_at)}</span></td>
    <td>${esc(catName(x))}<br><span class="mini">${esc(x.kategori || "")}</span></td>
    <td>${esc(orgName(x.target_org_id))}${ownsPost(x) ? "" : '<br><span class="pill">Dari atas</span>'}</td>
    <td><span class="pill ${x.status === "published" ? "ok" : "warn"}">${x.status === "published" ? "Terbit" : "Draf"}</span>${x.publik ? ' <span class="pill role">Web</span>' : ""}</td>
    <td>${ownsPost(x) ? `<div class="act">${btn("post-edit", x.id, "Edit")}${btn("post-toggle", x.id, x.status === "published" ? "Tarik" : "Terbitkan")}${btn("post-web", x.id, x.publik ? "Sembunyikan di web" : "Tampilkan di web")}${x.status === "published" && x.publik ? postLink(x) : ""}${btn("post-del", x.id, "Hapus", "bad")}</div>` : `<div class="act">${x.publik ? postLink(x) : ""}<span class="mini">Hanya baca</span></div>`}</td></tr>`).join(""),
    "Belum ada konten yang cocok.");
  $("#q").oninput = (e) => { S.q = e.target.value; render(); };
  $("#fsc").onchange = (e) => { S.sc = e.target.value; render(); };
  $("#fk").onchange = (e) => { S.fk = e.target.value; render(); };
  $("#fst").onchange = (e) => { S.fs = e.target.value; render(); };
}

function postForm(id) {
  const x = allPosts().find((p) => p.id === id) || { judul: "", kategori: "berita", kategori_id: "", target_org_id: S.me.org_id, status: "draft", konten_html: "", publik: true };
  const orgs = Object.keys(S.orgs).filter(inScope), cats = visibleCats();
  modal(id ? "Edit konten" : "Tulis konten",
    fld("Judul", "f1", x.judul) +
    sel("Jenis", "f2", ["berita", "amalan", "prestasi"].map((k) => [k, k]), x.kategori) +
    sel("Kategori", "f6", [["", "Tanpa kategori"], ...cats.map((c) => [c.id, c.nama])], x.kategori_id || "") +
    sel("Unit sasaran (konten tampil di unit ini dan semua bawahannya)", "f3", orgs.map((o) => [o, orgName(o)]), x.target_org_id) +
    `<label for="f4">Isi (pisahkan paragraf dengan baris kosong)</label><textarea id="f4" rows="7">${esc(x.konten_html)}</textarea>` +
    sel("Status", "f5", [["draft", "Draf"], ["published", "Terbit"]], x.status) +
    `<label class="cb"><input type="checkbox" id="f7" ${x.publik !== false ? "checked" : ""}>Tampilkan di website publik unit tujuan</label>`,
    async () => {
      const judul = val("f1");
      if (!judul) { toast("Isi judul terlebih dahulu."); return false; }
      const cid = $("#f6").value, t = $("#f3").value;
      const data = { judul, kategori: $("#f2").value, kategori_id: cid, kategori_nama: cats.find((c) => c.id === cid)?.nama || "", target_org_id: t, hierarki_path: S.orgs[t].hierarki_path, konten_html: $("#f4").value, status: $("#f5").value, publik: $("#f7").checked };
      if (id) await updateDoc(doc(db, "posts", id), data);
      else await addDoc(collection(db, "posts"), { ...data, author_uid: S.me.uid, author_nama: S.me.nama, created_at: serverTimestamp() });
      toast("Konten disimpan.");
    });
}

/* ---------- kategori konten ---------- */
function kategoriView() {
  const cats = visibleCats(), p = allPosts();
  $("#view").innerHTML = `<p class="mute">Kategori dari unit di atas dapat dipakai, tetapi hanya bisa diubah oleh unit pemiliknya.</p>
  <div class="bar"><button class="pri" data-act="cat-add">Tambah kategori</button></div>` +
  tbl(["Kategori", "Pemilik", "Jumlah konten", ""], cats.map((c) => `<tr><td>${esc(c.nama)}</td><td>${esc(orgName(c.org_id))}</td><td>${p.filter((x) => x.kategori_id === c.id).length}</td>
    <td>${c.org_id === S.me.org_id ? `<div class="act">${btn("cat-edit", c.id, "Ubah nama")}${btn("cat-del", c.id, "Hapus", "bad")}</div>` : '<span class="mini">Dari unit atas</span>'}</td></tr>`).join(""),
    "Belum ada kategori. Tambahkan kategori pertama.");
}
function catForm(id) {
  const c = S.cats.find((x) => x.id === id);
  modal(id ? "Ubah kategori" : "Tambah kategori", fld("Nama kategori", "c1", c?.nama || ""), async () => {
    const nama = val("c1");
    if (!nama || nama.length > 60) { toast("Nama wajib diisi (maksimal 60 karakter)."); return false; }
    if (id) await updateDoc(doc(db, "post_categories", id), { nama, org_id: S.me.org_id });
    else await addDoc(collection(db, "post_categories"), { nama, org_id: S.me.org_id, created_by: S.me.uid });
    toast("Kategori disimpan.");
  });
}

/* ---------- tipe role khusus: blok isian dinamis ---------- */
const canGive = (t) => TL[myTng()] <= TL[t.min_pemberi || "ranting"];
const hasQual = (list, tid) => (list || []).some((k) => k.tipe_id === tid);
const visTypes = () => S.types.filter((t) => S.me.path.includes(t.org_id) && canGive(t));
function fieldHtml(tid, f, v) {
  const id = `qf_${tid}_${f.key}`;
  if (f.type === "pilihan") return sel(esc(f.label), id, [["", "—"], ...(f.options || []).map((o) => [o, o])], v ?? "");
  return fld(esc(f.label), id, v ?? "", f.type === "angka" ? "number" : "text");
}
function qblock(t, k) {
  return `<div class="card" style="margin:8px 0;padding:10px"><label class="cb" style="margin:0"><input type="checkbox" id="qc_${t.id}" ${k ? "checked" : ""}><b>${esc(t.nama)}</b></label>
  <div id="qb_${t.id}" style="display:${k ? "" : "none"}">
  ${(t.fields || []).map((f) => fieldHtml(t.id, f, k?.data?.[f.key])).join("")}
  ${t.butuh_internal ? sel("Verifikasi internal", `qi_${t.id}`, VSTAT, k?.internal?.status || "belum") : ""}
  ${t.butuh_ipsi ? sel("Status verifikasi IPSI", `qs_${t.id}`, VSTAT, k?.ipsi?.status || "belum") + sel("Jenjang IPSI", `qj_${t.id}`, Object.entries(JENJANG), k?.ipsi?.jenjang || "kabupaten") + fld("Nomor sertifikat IPSI", `qn_${t.id}`, k?.ipsi?.nomor || "") : ""}
  </div></div>`;
}
const bindBlocks = (types) => types.forEach((t) => { $("#qc_" + t.id).onchange = (e) => { $("#qb_" + t.id).style.display = e.target.checked ? "" : "none"; }; });
function readBlocks(types, existing = []) {
  const keep = existing.filter((k) => !types.some((t) => t.id === k.tipe_id)), out = [];
  for (const t of types) {
    if (!$("#qc_" + t.id).checked) continue;
    const prev = existing.find((k) => k.tipe_id === t.id), data = {};
    (t.fields || []).forEach((f) => { const v = $(`#qf_${t.id}_${f.key}`).value.trim(); data[f.key] = f.type === "angka" && v !== "" ? Number(v) : v; });
    const mk = (status, extra = {}, old) => (old && old.status === status ? old : { status, ...extra, oleh: S.me.nama, tanggal: new Date().toISOString() });
    out.push({
      tipe_id: t.id, nama: t.nama, data,
      internal: t.butuh_internal ? mk($(`#qi_${t.id}`).value, {}, prev?.internal) : null,
      ipsi: t.butuh_ipsi ? { ...mk($(`#qs_${t.id}`).value, {}, prev?.ipsi), jenjang: $(`#qj_${t.id}`).value, nomor: val(`qn_${t.id}`) } : null,
    });
  }
  return [...keep, ...out];
}
const qBadge = (k) => {
  const d = Object.values(k.data || {}).filter((v) => v !== "" && v != null).join(" / ");
  return `<span class="pill role">${esc(k.nama)}${d ? " · " + esc(d) : ""}${k.internal ? ` · internal ${k.internal.status === "terverifikasi" ? "✓" : k.internal.status === "ditolak" ? "✗" : "…"}` : ""}${k.ipsi ? ` · IPSI ${esc(JENJANG[k.ipsi.jenjang] || "")} ${k.ipsi.status === "terverifikasi" ? "✓" : k.ipsi.status === "ditolak" ? "✗" : "…"}` : ""}</span>`;
};

/* ---------- anggota ---------- */
const roleOpts = (orgId) => {
  const r = ADMIN_FOR[S.orgs[orgId]?.tingkat], o = [["member", "Anggota"]];
  if (r && LV[r] > LV[S.me.role]) o.push([r, `${RL[r]} – ${orgName(orgId)}`]);
  if (S.me.role === "super_admin" && S.orgs[orgId]?.tingkat === "pusat") o.push(["super_admin", "Super Admin"]);
  return o;
};
const canChange = (u) => u.id !== S.me.uid && LV[u.role] > LV[S.me.role] && roleOpts(u.org_id).some((o) => o[0] !== u.role);

function anggota() {
  $("#view").innerHTML = `<p class="mute">Tambahkan anggota atau pengurus di unit Anda atau unit bawahan. Anggota baru menerima email untuk membuat kata sandi sendiri. Jabatan dapat diubah dari tombol “Ubah jabatan”.</p>
  <div class="bar"><input id="q" placeholder="Cari nama, NIA, email, atau unit" value="${esc(S.mq)}"><button class="pri" data-act="mem-add">Tambah anggota</button></div>` +
  tbl(["Nama", "NIA", "Unit", "Role", "Sabuk", "Kualifikasi", ""], S.users.filter((u) => [u.nama_lengkap, u.nia, u.email, orgName(u.org_id)].join(" ").toLowerCase().includes(S.mq.toLowerCase())).map((u) => `<tr><td>${esc(u.nama_lengkap)}<br><span class="mini">${esc(u.email || "")}${u.status_aktif === false ? " · nonaktif" : ""}</span></td>
    <td>${esc(u.nia || "–")}</td><td>${esc(orgName(u.org_id))}</td><td><span class="pill role">${RL[u.role] || u.role}</span></td><td>${esc(u.sabuk || "–")}</td>
    <td>${(u.kualifikasi || []).map(qBadge).join(" ") || "–"}</td>
    <td><div class="act">${btn("mem-edit", u.id, "Edit", "", u.id === S.me.uid)}${btn("mem-q", u.id, "Kualifikasi", "", u.id === S.me.uid)}${btn("mem-role", u.id, "Ubah jabatan", "", !canChange(u))}${btn("mem-act", u.id, u.status_aktif === false ? "Aktifkan" : "Nonaktifkan", "bad", u.id === S.me.uid)}</div></td></tr>`).join(""),
    "Belum ada anggota yang cocok.");
  $("#q").oninput = (e) => { S.mq = e.target.value; render(); };
}

function memberForm(id) {
  const u = S.users.find((x) => x.id === id), orgs = Object.keys(S.orgs).filter(inScope);
  const types = visTypes().filter((t) => !t.prasyarat);
  const roleSel = (orgId, cur) => { const o = roleOpts(orgId); if (cur && !o.some((r) => r[0] === cur)) o.unshift([cur, RL[cur]]); return o; };
  const sabuk = sel("Tingkatan terakhir UKT (sabuk)", "m7", LEVELS.map((l) => [l, `${l} · ${GRP[l]}`]), u?.sabuk || "Putih");
  modal(id ? "Edit anggota" : "Tambah anggota",
    fld("Nama lengkap", "m1", u?.nama_lengkap || "") +
    (id ? `<label>NIA</label><input value="${esc(u.nia)}" disabled><label>Email</label><input value="${esc(u.email || "")}" disabled>` + sel("Role", "m6", roleSel(u.org_id, u.role), u.role)
        : fld("NIA (nomor induk anggota)", "m2") + fld("Email (juga menjadi kata sandi awal)", "m3", "", "email") +
          sel("Unit", "m5", orgs.map((o) => [o, `${orgName(o)} · ${TNG[S.orgs[o].tingkat]}`]), S.me.org_id) +
          sel("Role", "m6", roleOpts(S.me.org_id), "member")) +
    sabuk + fld("Alamat", "m4", u?.alamat || "") +
    (id || !types.length ? "" : `<label>Tipe role khusus (opsional)</label>${types.map((t) => qblock(t)).join("")}`),
    async () => {
      const nama = val("m1"), alamat = val("m4");
      if (!nama) { toast("Isi nama lengkap."); return false; }
      if (id) {
        const rl = $("#m6").value, upd = { nama_lengkap: nama, alamat, sabuk: $("#m7").value, updated_at: serverTimestamp() }, b = writeBatch(db);
        if (rl !== u.role) {
          upd.role = rl;
          b.set(doc(collection(db, "audit_logs")), { aksi: "CHANGE_ROLE", pelaku_uid: S.me.uid, pelaku_nama: S.me.nama, target_uid: id, target_nama: u.nama_lengkap, role_lama: u.role, role_baru: rl, timestamp: serverTimestamp() });
        }
        b.update(doc(db, "users", id), upd);
        await b.commit(); toast("Data anggota disimpan."); return;
      }
      const nia = val("m2"), email = val("m3").toLowerCase(), org = $("#m5").value, rl = $("#m6").value;
      if (!nia || nia.includes("/")) { toast("NIA wajib diisi dan tidak boleh memuat “/”."); return false; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Format email tidak valid."); return false; }
      if (email.length < 6) { toast("Email terlalu pendek untuk dijadikan kata sandi awal."); return false; }
      if ((await getDoc(doc(db, "nia_registry", nia))).exists()) { toast("NIA sudah dipakai anggota lain."); return false; }
      const kualifikasi = types.length ? readBlocks(types) : [];
      const sa = secondaryAuth();
      const c = await createUserWithEmailAndPassword(sa, email, email); // kata sandi awal = email
      await signOut(sa);
      const b = writeBatch(db);
      b.set(doc(db, "users", c.user.uid), { nia, nama_lengkap: nama, alamat, email, role: rl, org_id: org, hierarki_path: S.orgs[org].hierarki_path, status_aktif: true, kualifikasi, sabuk: $("#m7").value, created_at: serverTimestamp(), created_by: S.me.uid });
      b.set(doc(db, "nia_registry", nia), { uid: c.user.uid, org_id: org, created_at: serverTimestamp() });
      await b.commit();
      toast("Anggota ditambahkan. Akun login dibuat: kata sandi awal = alamat email, wajib diganti saat login pertama.");
    }, "Simpan",
    () => {
      if (id) { $("#m6").disabled = !canChange(u); return; }
      $("#m5").onchange = () => { $("#m6").innerHTML = roleOpts($("#m5").value).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(""); };
      if (types.length) bindBlocks(types);
    });
}

function qualModal(u) {
  const types = visTypes().filter((t) => !t.prasyarat || hasQual(u.kualifikasi, t.prasyarat) || hasQual(u.kualifikasi, t.id));
  const blocked = visTypes().filter((t) => t.prasyarat && !types.includes(t));
  if (!types.length && !blocked.length) return toast("Tidak ada tipe role yang dapat Anda berikan.");
  modal(`Kualifikasi ${esc(u.nama_lengkap)}`,
    types.map((t) => qblock(t, (u.kualifikasi || []).find((k) => k.tipe_id === t.id))).join("") +
    blocked.map((t) => `<p class="mini">${esc(t.nama)} tidak tersedia: anggota harus lebih dulu berstatus ${esc(S.types.find((x) => x.id === t.prasyarat)?.nama || t.prasyarat)}.</p>`).join(""),
    async () => {
      await updateDoc(doc(db, "users", u.id), { kualifikasi: readBlocks(types, u.kualifikasi || []), updated_at: serverTimestamp() });
      toast("Kualifikasi disimpan.");
    }, "Simpan kualifikasi", () => bindBlocks(types));
}

function changeRoleForm(u) {
  const o = roleOpts(u.org_id).filter((r) => r[0] !== u.role);
  modal(`Ubah jabatan ${esc(u.nama_lengkap)}`, `<p class="mute">Saat ini: ${RL[u.role]} · ${esc(orgName(u.org_id))}</p>${sel("Role baru", "nr", o, o[0][0])}`, async () => {
    const r = $("#nr").value, b = writeBatch(db);
    b.update(doc(db, "users", u.id), { role: r, updated_at: serverTimestamp() });
    b.set(doc(collection(db, "audit_logs")), { aksi: "CHANGE_ROLE", pelaku_uid: S.me.uid, pelaku_nama: S.me.nama, target_uid: u.id, target_nama: u.nama_lengkap, role_lama: u.role, role_baru: r, timestamp: serverTimestamp() });
    await b.commit();
    toast(`Jabatan ${u.nama_lengkap} kini ${RL[r]}.`);
  }, "Terapkan role");
}

/* ---------- UKT ---------- */
function ukt() {
  const sub = isSubRole(), pac = S.me.role === "admin_pac", cab = S.me.role === "admin_cabang";
  const rows = S.ukt.filter((x) => !S.fu || x.org_id === S.fu);
  const units = [...new Set(S.ukt.map((x) => x.org_id))];
  const ready = S.ukt.filter((x) => x.status_verifikasi === "disetujui_pac" && !x.nomor_sertifikat).length;
  $("#view").innerHTML = `<p class="mute">${sub ? "Ajukan kenaikan tingkat anggota unit Anda: dilaksanakan mandiri atau didelegasikan ke PAC. Tingkatan terakhir anggota diatur di menu Anggota." : pac ? "Verifikasi pengajuan ranting/rayon (termasuk UKT yang didelegasikan ke PAC), lalu ajukan sertifikatnya ke cabang." : cab ? "Anda melihat semua peserta per unit dan menerbitkan sertifikat atas pengajuan PAC." : "Anda memantau proses UKT."} Sertifikat terbit setelah disetujui cabang.</p>
  <div class="bar">${sub || pac ? '<button class="pri" data-act="ukt-add">Ajukan UKT</button>' : ""}${pac && ready ? `<button data-act="ukt-batch">Ajukan semua yang siap ke cabang (${ready})</button>` : ""}
  <select id="fu"><option value="">Semua unit</option>${units.map((o) => `<option value="${o}" ${S.fu === o ? "selected" : ""}>${esc(orgName(o))}</option>`).join("")}</select></div>` +
  tbl(["Peserta", "Unit", "Kenaikan", "Status", "Sertifikat", ""], rows.map((x) => `<tr><td>${esc(x.nama_peserta)}<br><span class="mini">${esc(x.periode_ukt || "")} · ${x.pelaksana === "pac" ? "Delegasi PAC" : "Mandiri"}</span></td><td>${esc(orgName(x.org_id))}</td>
    <td>${esc(x.sabuk_asal)} → <b>${esc(x.sabuk_tujuan)}</b><br><span class="mini">${GRP[x.sabuk_tujuan] || ""}</span></td>
    <td><span class="pill ${x.status_verifikasi === "revisi" ? "bad" : uktFinal(x) ? "ok" : "warn"}">${x.nomor_sertifikat ? "Sertifikat terbit" : STG[x.status_verifikasi] || x.status_verifikasi}</span>${x.catatan_revisi && !x.nomor_sertifikat ? `<br><span class="mini">${esc(x.catatan_revisi)}</span>` : ""}</td>
    <td>${x.nomor_sertifikat ? `${esc(x.nomor_sertifikat)}<div class="act">${btn("cert-png", x.id, "PNG")}${btn("cert-pdf", x.id, "PDF")}</div>` : "–"}</td>
    <td><div class="act">${uktActions(x)}</div></td></tr>`).join(""),
    "Belum ada pengajuan UKT.") +
  (cab ? `<div class="sec">Desain sertifikat UKT</div><p class="mute">Unggah desain PNG untuk tiap tingkat. Nama lengkap dan nomor sertifikat ditempel otomatis di posisi yang Anda atur.</p>` +
    tbl(["Tingkat", "Desain", "Sudah dicetak", "Format nomor", ""], LEVELS.map((l) => { const t = S.tpl.find((x) => x.level === l), c = S.cnt[l] || { n: 0 };
      return `<tr><td>${l} <span class="mini">${GRP[l]}</span></td><td>${t ? '<span class="pill ok">Terunggah</span>' : '<span class="pill warn">Belum</span>'}</td><td>${c.n || 0} lembar</td><td><span class="mini">${esc(c.format || DEF_FMT)}</span></td><td><div class="act">${btn("tpl-edit", l, t ? "Ubah desain" : "Unggah desain")}${btn("cnt-edit", l, "Atur nomor")}${t ? btn("tpl-del", l, "Hapus", "bad") : ""}</div></td></tr>`; }).join(""), "") : "");
  const f = $("#fu"); if (f) f.onchange = (e) => { S.fu = e.target.value; render(); };
}

function uktForm() {
  const pac = S.me.role === "admin_pac";
  const members = S.users.filter((u) => u.role === "member" && u.status_aktif !== false && (pac || u.org_id === S.me.org_id));
  if (!members.length) return toast("Belum ada anggota aktif untuk diajukan.");
  const next = (u) => LEVELS[LEVELS.indexOf(u.sabuk || "Putih") + 1];
  const eligible = members.filter((u) => next(u));
  if (!eligible.length) return toast("Semua anggota sudah di tingkat tertinggi.");
  modal("Ajukan UKT", sel("Peserta", "u1", eligible.map((u) => [u.id, `${u.nama_lengkap}${pac ? " · " + orgName(u.org_id) : ""} (${u.sabuk || "Putih"} → ${next(u)})`]), eligible[0].id) +
    (pac ? '<p class="mini">UKT dilaksanakan di PAC.</p>' : sel("Pelaksanaan UKT", "u3", [["mandiri", "Mandiri (dilaksanakan oleh unit ini)"], ["pac", "Didelegasikan ke PAC"]], "mandiri")) +
    fld("Periode (mis. UKT Gelombang II 2026)", "u2"), async () => {
    const u = eligible.find((x) => x.id === $("#u1").value);
    if (S.ukt.some((x) => x.uid === u.id && !uktFinal(x) && x.status_verifikasi !== "revisi")) { toast("Peserta ini masih punya pengajuan yang berjalan."); return false; }
    const path = S.orgs[u.org_id].hierarki_path, up = (t) => path.find((o) => S.orgs[o]?.tingkat === t) || "";
    await addDoc(collection(db, "ukt_registrations"), {
      uid: u.id, nama_peserta: u.nama_lengkap, org_id: u.org_id, pac_id: up("pac"), cabang_id: up("cabang"), hierarki_path: path,
      sabuk_asal: u.sabuk || "Putih", sabuk_tujuan: next(u), periode_ukt: val("u2"), pelaksana: pac ? "pac" : $("#u3").value, status_verifikasi: "pending",
      riwayat: [hist("pending")], created_by: S.me.uid, created_at: serverTimestamp(),
    });
    toast("Pengajuan UKT dikirim ke PAC.");
  }, "Ajukan");
}

async function uktApprove(id) {
  const x = S.ukt.find((u) => u.id === id), st = x.status_verifikasi;
  try {
    if (st === "pending") return uktUpdate(id, { status_verifikasi: "disetujui_pac", catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("disetujui_pac")] }, "Diverifikasi. Ajukan sertifikat ke cabang bila sudah siap.");
    if (st === "disetujui_pac") return uktUpdate(id, { status_verifikasi: "diajukan_cabang", catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("diajukan_cabang")] }, "Diajukan ke cabang untuk sertifikat.");
    const year = new Date().getFullYear(), cab = x.cabang_id || S.me.org_id;
    const cref = doc(db, "counters", `${cab}_${x.sabuk_tujuan}`), uref = doc(db, "users", x.uid), xref = doc(db, "ukt_registrations", id);
    await runTransaction(db, async (tx) => {
      const c = await tx.get(cref), u = await tx.get(uref), n = (c.exists() ? c.data().n : 0) + 1;
      const fmtStr = c.exists() ? c.data().format : "";
      const nomor = nomorFmt(fmtStr, { urut: n, kode: cab, level: x.sabuk_tujuan, year });
      tx.set(cref, { n, format: fmtStr || DEF_FMT });
      tx.update(xref, { status_verifikasi: "disetujui_cabang", nomor_sertifikat: nomor, catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("disetujui_cabang")], updated_at: serverTimestamp() });
      const upd = { sabuk: x.sabuk_tujuan, updated_at: serverTimestamp() }, q = u.data().kualifikasi || [];
      if (x.sabuk_tujuan === "Hitam" && !q.some((k) => k.tipe_id === "pelatih")) {
        const t = S.types.find((y) => y.id === "pelatih");
        upd.kualifikasi = [...q, { tipe_id: "pelatih", nama: t?.nama || "Pelatih", data: {}, internal: { status: "terverifikasi", oleh: S.me.nama, tanggal: new Date().toISOString() }, ipsi: { status: "belum", jenjang: "kabupaten", nomor: "", oleh: S.me.nama, tanggal: new Date().toISOString() } }];
      }
      tx.update(uref, upd);
    });
    toast("Sertifikat diterbitkan dan sabuk peserta diperbarui.");
  } catch (e) { fail(e); }
}
async function uktBatch() {
  const rows = S.ukt.filter((x) => x.status_verifikasi === "disetujui_pac" && !x.nomor_sertifikat).slice(0, 400);
  if (!rows.length || !confirm(`Ajukan ${rows.length} peserta ke cabang untuk penerbitan sertifikat?`)) return;
  try {
    const b = writeBatch(db);
    rows.forEach((x) => b.update(doc(db, "ukt_registrations", x.id), { status_verifikasi: "diajukan_cabang", catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("diajukan_cabang")], updated_at: serverTimestamp() }));
    await b.commit(); toast(`${rows.length} peserta diajukan ke cabang.`);
  } catch (e) { fail(e); }
}
const uktUpdate = async (id, data, msg) => { try { await updateDoc(doc(db, "ukt_registrations", id), { ...data, updated_at: serverTimestamp() }); toast(msg); } catch (e) { fail(e); } };

/* ---------- sertifikat UKT ---------- */
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Gambar tidak dapat dibaca")); i.src = src; });
async function fitImage(file, lim = 900000) {
  const url = URL.createObjectURL(file), img = await loadImg(url); URL.revokeObjectURL(url);
  for (const [mw, type, q] of [[1754, "image/png"], [1500, "image/png"], [1754, "image/jpeg", 0.9], [1500, "image/jpeg", 0.85], [1200, "image/jpeg", 0.8], [1000, "image/jpeg", 0.7]]) {
    const s = Math.min(1, mw / img.naturalWidth), c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const d = c.toDataURL(type, q);
    if (d.length <= lim) return d;
  }
  throw new Error("Gambar terlalu besar. Perkecil resolusi atau ukuran berkasnya.");
}
async function renderCert(tpl, nama, nomor) {
  try { await document.fonts.load('600 40px Fraunces'); await document.fonts.load('500 20px "Public Sans"'); } catch { /* pakai font cadangan */ }
  const img = tpl._img || (await loadImg(tpl.image)), c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = tpl.warna || "#1c2420";
  let fs = (c.width * (tpl.size_nama || 4.5)) / 100;
  x.font = `600 ${fs}px Fraunces, Georgia, serif`;
  while (x.measureText(nama).width > c.width * 0.8 && fs > 12) { fs -= 2; x.font = `600 ${fs}px Fraunces, Georgia, serif`; }
  x.fillText(nama, (c.width * (tpl.nama_x ?? 50)) / 100, (c.height * (tpl.nama_y ?? 48)) / 100);
  x.font = `500 ${(c.width * (tpl.size_nomor || 2)) / 100}px "Public Sans", Arial, sans-serif`;
  x.fillText(nomor, (c.width * (tpl.nomor_x ?? 50)) / 100, (c.height * (tpl.nomor_y ?? 60)) / 100);
  return c;
}
function makePdfPages(jpgs, w, h) {
  const enc = new TextEncoder(), parts = [], off = []; let len = 0;
  const put = (d) => { const b = typeof d === "string" ? enc.encode(d) : d; parts.push(b); len += b.length; };
  const W = Math.round(w * 0.75), H = Math.round(h * 0.75), n = jpgs.length, cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  put("%PDF-1.4\n");
  off[1] = len; put("1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n");
  off[2] = len; put(`2 0 obj\n<</Type/Pages/Kids[${jpgs.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}]/Count ${n}>>\nendobj\n`);
  jpgs.forEach((jpg, i) => {
    const pg = 3 + 3 * i;
    off[pg] = len; put(`${pg} 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W} ${H}]/Resources<</XObject<</Im0 ${pg + 1} 0 R>>>>/Contents ${pg + 2} 0 R>>\nendobj\n`);
    off[pg + 1] = len; put(`${pg + 1} 0 obj\n<</Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>\nstream\n`); put(jpg); put("\nendstream\nendobj\n");
    off[pg + 2] = len; put(`${pg + 2} 0 obj\n<</Length ${cs.length}>>\nstream\n${cs}\nendstream\nendobj\n`);
  });
  const total = 3 + 3 * n, xr = len; let t = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) t += String(off[i]).padStart(10, "0") + " 00000 n \n";
  put(t + `trailer\n<</Size ${total}/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0; parts.forEach((b) => { out.set(b, p); p += b.length; });
  return out;
}
const makePdf = (jpg, w, h) => makePdfPages([jpg], w, h);
const jpegBytes = (c, q = 0.88) => Uint8Array.from(atob(c.toDataURL("image/jpeg", q).split(",")[1]), (ch) => ch.charCodeAt(0));
async function saveBlob(blob, name) {
  if (isNative()) {
    const P = window.Capacitor.Plugins || {};
    if (!P.Filesystem || !P.Share) return toast("Unduh di aplikasi memerlukan plugin @capacitor/filesystem dan @capacitor/share.");
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
      const f = await P.Filesystem.writeFile({ path: name, data: b64, directory: "CACHE" });
      await P.Share.share({ title: name, url: f.uri, dialogTitle: "Simpan atau bagikan berkas" });
    } catch (e) { toast("Gagal menyimpan berkas: " + (e.message || e)); }
    return;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
async function certDownload(id, kind) {
  try {
    const x = S.ukt.find((u) => u.id === id);
    const t = await getDoc(doc(db, "ukt_templates", `${x.cabang_id}__${x.sabuk_tujuan}`));
    if (!t.exists()) return toast(`Desain sertifikat ${x.sabuk_tujuan} belum diunggah oleh cabang.`);
    const c = await renderCert(t.data(), x.nama_peserta, x.nomor_sertifikat);
    const base = `Sertifikat-UKT-${x.sabuk_tujuan}-${x.nama_peserta}`.replace(/[^\w-]+/g, "_");
    if (kind === "png") c.toBlob((b) => saveBlob(b, base + ".png"), "image/png");
    else {
      saveBlob(new Blob([makePdf(jpegBytes(c, 0.92), c.width, c.height)], { type: "application/pdf" }), base + ".pdf");
    }
  } catch (e) { fail(e); }
}
function tplForm(level) {
  const cur = S.tpl.find((t) => t.level === level); let data = cur?.image || "", imgEl = null;
  const v = (k, d) => cur?.[k] ?? d;
  const num = (id, d) => { const n = parseFloat($("#" + id).value); return Number.isFinite(n) ? n : d; };
  const params = () => ({ nama_x: num("tx", 50), nama_y: num("ty", 48), nomor_x: num("nx", 50), nomor_y: num("ny", 60), size_nama: num("ts", 4.5), size_nomor: num("tz", 2), warna: $("#tc").value || "#1c2420" });
  const c0 = S.cnt[level] || { n: 0 };
  const sample = () => nomorFmt(c0.format, { urut: (c0.n || 0) + 1, kode: S.me.org_id, level, year: new Date().getFullYear() });
  let busy = false, again = false;
  const draw = async () => {
    if (!data) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      if (!imgEl) imgEl = await loadImg(data);
      const P = params(), c = await renderCert({ image: data, _img: imgEl, ...P }, "Nama Lengkap Peserta", sample());
      const p = $("#tp"); p.width = c.width; p.height = c.height;
      const g = p.getContext("2d"); g.drawImage(c, 0, 0);
      g.fillStyle = "#1f6b4f"; g.strokeStyle = "#fff"; g.lineWidth = Math.max(2, c.width / 300);
      [[P.nama_x, P.nama_y], [P.nomor_x, P.nomor_y]].forEach(([px, py]) => { g.beginPath(); g.arc((c.width * px) / 100, (c.height * py) / 100, c.width / 120, 0, 7); g.fill(); g.stroke(); });
    } finally { busy = false; if (again) { again = false; draw(); } }
  };
  modal(`Desain sertifikat ${level}`,
    `<label for="tf">Berkas desain PNG (tanpa nama dan nomor)</label><input id="tf" type="file" accept="image/png,image/jpeg">
     <p class="mini">Seret nama atau nomor langsung di gambar untuk memindahkannya (titik hijau = pusat teks).</p>
     <canvas id="tp" style="width:100%;border:1px solid var(--line);border-radius:8px"></canvas>` +
    fld("Nama – posisi X (%)", "tx", v("nama_x", 50), "number") + fld("Nama – posisi Y (%)", "ty", v("nama_y", 48), "number") +
    fld("Nomor – posisi X (%)", "nx", v("nomor_x", 50), "number") + fld("Nomor – posisi Y (%)", "ny", v("nomor_y", 60), "number") +
    fld("Ukuran nama (% lebar)", "ts", v("size_nama", 4.5), "number") + fld("Ukuran nomor (% lebar)", "tz", v("size_nomor", 2), "number") + fld("Warna teks", "tc", v("warna", "#1c2420"), "color"),
    async () => {
      if (!data) { toast("Unggah berkas desain terlebih dahulu."); return false; }
      await setDoc(doc(db, "ukt_templates", `${S.me.org_id}__${level}`), { org_id: S.me.org_id, level, image: data, ...params(), updated_at: serverTimestamp() });
      toast("Desain sertifikat disimpan.");
    }, "Simpan desain",
    () => {
      ["tx", "ty", "nx", "ny", "ts", "tz", "tc"].forEach((i) => ($("#" + i).oninput = draw));
      $("#tf").onchange = async (e) => { try { data = await fitImage(e.target.files[0]); imgEl = null; draw(); } catch (er) { toast(er.message); } };
      const cv = $("#tp"); let drag = null;
      cv.style.touchAction = "none"; cv.style.cursor = "crosshair";
      const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)), r }; };
      const setPos = (k, p) => { $(k === "nama" ? "#tx" : "#nx").value = p.x.toFixed(1); $(k === "nama" ? "#ty" : "#ny").value = p.y.toFixed(1); draw(); };
      cv.onpointerdown = (e) => {
        if (!data) return;
        const p = pt(e), P = params(), d = (ax, ay) => Math.hypot(((p.x - ax) / 100) * p.r.width, ((p.y - ay) / 100) * p.r.height);
        drag = d(P.nama_x, P.nama_y) <= d(P.nomor_x, P.nomor_y) ? "nama" : "nomor";
        cv.setPointerCapture(e.pointerId); setPos(drag, p);
      };
      cv.onpointermove = (e) => { if (drag) setPos(drag, pt(e)); };
      cv.onpointerup = cv.onpointercancel = () => { drag = null; };
      draw();
    });
}
function cntForm(level) {
  const c = S.cnt[level] || { n: 0 };
  modal(`Nomor sertifikat ${level}`,
    fld("Jumlah sertifikat yang sudah dicetak (nomor terakhir)", "c1", c.n || 0, "number") +
    fld("Format nomor", "c2", c.format || DEF_FMT) +
    `<p class="mini">Isian format: {urut} nomor urut 4 digit, {kode} kode cabang, {TINGKAT} nama tingkat huruf besar, {tingkat} nama tingkat, {tahun} tahun terbit. Sertifikat berikutnya memakai nomor terakhir + 1.</p>`,
    async () => {
      const n = Math.floor(Number($("#c1").value)), f = val("c2");
      if (!(n >= 0) || !f.includes("{urut}")) { toast("Isi nomor terakhir (≥ 0) dan format yang memuat {urut}."); return false; }
      await setDoc(doc(db, "counters", `${S.me.org_id}_${level}`), { n, format: f });
      toast("Pengaturan nomor disimpan.");
    });
}

/* ---------- berkas (dipecah di Firestore, maks. 3 MB) ---------- */
async function prepFile(file, exts = /\.(pdf|doc|docx)$/i, maxMB = 3) {
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Berkas maksimal ${maxMB} MB.`);
  if (!exts.test(file.name)) throw new Error("Jenis berkas tidak didukung.");
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
  const parts = []; for (let i = 0; i < b64.length; i += 800000) parts.push(b64.slice(i, i + 800000));
  return { meta: { nama_berkas: file.name, tipe: file.type || "application/octet-stream", ukuran: file.size, chunks: parts.length }, parts };
}
async function writeChunks(col, id, parts) {
  const old = await getDocs(collection(db, col, id, "chunks")), b = writeBatch(db);
  old.docs.forEach((d) => b.delete(d.ref));
  parts.forEach((p, i) => b.set(doc(db, col, id, "chunks", String(i).padStart(3, "0")), { i, data: p }));
  await b.commit();
}
async function putFile(col, id, file, exts, maxMB) { const { meta, parts } = await prepFile(file, exts, maxMB); await writeChunks(col, id, parts); return meta; }
async function viewFile(col, id, meta) {
  try {
    const s = await getDocs(query(collection(db, col, id, "chunks"), orderBy("i")));
    const blob = new Blob([Uint8Array.from(atob(s.docs.map((d) => d.data().data).join("")), (c) => c.charCodeAt(0))], { type: meta.tipe });
    if (meta.tipe.startsWith("image/")) {
      dlg(`<h2>${esc(meta.nama_berkas)}</h2><img src="${URL.createObjectURL(blob)}" alt="" style="max-width:100%;border-radius:8px"><div class="btns"><button id="c">Tutup</button></div>`);
      $("#c").onclick = closeDlg;
    } else saveBlob(blob, meta.nama_berkas);
  } catch (e) { fail(e); }
}
async function downloadFile(col, id, meta) {
  try {
    const m = meta || (await getDoc(doc(db, col, id))).data();
    if (!m || !m.chunks) return toast("Berkas belum tersedia.");
    const s = await getDocs(query(collection(db, col, id, "chunks"), orderBy("i")));
    const bin = atob(s.docs.map((d) => d.data().data).join(""));
    saveBlob(new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: m.tipe }), m.nama_berkas);
  } catch (e) { fail(e); }
}
async function deleteFile(col, id) {
  const old = await getDocs(collection(db, col, id, "chunks")), b = writeBatch(db);
  old.docs.forEach((d) => b.delete(d.ref)); b.delete(doc(db, col, id));
  await b.commit();
}

/* ---------- SK kepengurusan ---------- */
const myUp = () => { const parent = S.orgs[S.me.org_id]?.parent_id; return { parent, issuer: S.orgs[parent]?.parent_id }; };
function sk() {
  const jenis = SK_BY_TNG[myTng()], up = myUp(), yr = new Date().getFullYear();
  const canSubmit = jenis && up.parent && up.issuer && ["admin_ranting", "admin_rayon", "admin_pac", "admin_cabang"].includes(S.me.role);
  const ij = SK_ISSUE[myTng()];
  $("#view").innerHTML = `<p class="mute">Alur: pemohon mengajukan ke unit induk, unit induk meneruskan, lalu unit di atasnya menerbitkan SK dan melantik. SK terbit otomatis (PDF) ditandatangani Ketua dan Sekretaris unit yang mengesahkan. ${canSubmit ? `SK unit Anda diajukan ke <b>${esc(orgName(up.parent))}</b> dan disahkan oleh <b>${esc(orgName(up.issuer))}</b>.` : ""}</p>
  <div class="bar">${canSubmit ? `<button class="pri" data-act="sk-add">Ajukan SK</button>${btn("sk-tpl-get", `${up.issuer}__${jenis}`, "Unduh template SK")}` : ""}</div>` +
  tbl(["Pemohon", "Masa bakti / Ketua", "Alur", "Status", ""], S.sk.map((x) => `<tr><td>${esc(x.org_nama)}<br><span class="mini">${SKJ[x.jenis]}</span></td><td>${esc(x.periode)}<br><span class="mini">${esc(x.nama_ketua)}</span></td>
    <td><span class="mini">${esc(orgName(x.org_id))} → ${esc(orgName(x.parent_id))} → ${esc(orgName(x.issuer_id))} (mengesahkan)</span></td>
    <td><span class="pill ${x.status === "dilantik" ? "ok" : x.status === "revisi" ? "bad" : "warn"}">${SKS[x.status]}</span>${x.catatan_revisi && x.status === "revisi" ? `<br><span class="mini">${esc(x.catatan_revisi)}</span>` : ""}${x.nomor_sk ? `<br><span class="mini">No. ${esc(x.nomor_sk)} · ${esc(x.tanggal_pelantikan)}</span>` : ""}</td>
    <td><div class="act">${skActions(x)}</div></td></tr>`).join(""), "Belum ada pengajuan SK.") +
  (ij ? `<div class="sec">Penerbitan ${SKJ[ij]}</div><p class="mute">Nomor surat otomatis: <code>nomor urut/${esc(S.me.org_id)}/A1/${yr}</code>. Nomor urut terakhir tahun ${yr}: <b>${S.cntSK}</b>. Lengkapi nama ketua/sekretaris dan tanda tangan di menu Profil &amp; website.</p>
    <div class="bar">${btn("sk-cnt", "", "Atur nomor urut")}</div>` +
    tbl(["Template", "Berkas", ""], [ij].map((j) => { const t = S.skTpl.find((x) => x.jenis === j);
      return `<tr><td>${SKJ[j]}</td><td>${t ? `${esc(t.nama_berkas)} <span class="mini">(${Math.round(t.ukuran / 1024)} KB)</span>` : '<span class="pill warn">Belum diunggah</span>'}</td><td><div class="act">${btn("sk-tpl-up", j, t ? "Ganti" : "Unggah")}${t ? btn("sk-tpl-get", t.id, "Unduh") + btn("sk-tpl-del", t.id, "Hapus", "bad") : ""}</div></td></tr>`; }).join(""), "") : "");
}
function skForm(id) {
  const x = S.sk.find((r) => r.id === id), up = myUp(), jenis = SK_BY_TNG[myTng()];
  if (!id && S.sk.some((r) => r.org_id === S.me.org_id && r.status !== "dilantik")) return toast("Masih ada pengajuan SK yang berjalan.");
  const rows = x?.pengurus?.length ? x.pengurus.map((r) => ({ ...r })) : [{ jabatan: "Ketua", nama: x?.nama_ketua || "" }, { jabatan: "Sekretaris", nama: x?.nama_sekretaris || "" }, { jabatan: "Bendahara", nama: x?.nama_bendahara || "" }];
  const drawRows = () => {
    $("#pr").innerHTML = rows.map((r, i) => `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin:6px 0"><input data-i="${i}" data-k="jabatan" placeholder="Nama jabatan (mis. Biro Kepelatihan)" value="${esc(r.jabatan)}" ${i < 2 ? "disabled" : ""}><input data-i="${i}" data-k="nama" placeholder="Nama terang" value="${esc(r.nama)}">${i < 2 ? "<span></span>" : `<button type="button" data-rm="${i}" aria-label="Hapus baris">×</button>`}</div>`).join("");
    $("#pr").querySelectorAll("input").forEach((el) => (el.oninput = () => { rows[+el.dataset.i][el.dataset.k] = el.value; }));
    $("#pr").querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { rows.splice(+b.dataset.rm, 1); drawRows(); }));
  };
  modal(id ? "Perbaiki pengajuan SK" : "Ajukan SK", fld("Masa bakti (mis. 2026–2031)", "s1", x?.periode || "") +
    '<label>Susunan pengurus (Ketua dan Sekretaris wajib; tambah jabatan sesuai kebutuhan)</label><div id="pr"></div><button type="button" id="pa">+ Tambah jabatan</button>' +
    fld("Catatan untuk penerima (opsional)", "s6", x?.catatan || ""), async () => {
    const pengurus = rows.map((r) => ({ jabatan: r.jabatan.trim(), nama: r.nama.trim() }));
    if (!val("s1") || !pengurus[0].nama || !pengurus[1].nama) { toast("Lengkapi masa bakti serta nama Ketua dan Sekretaris."); return false; }
    if (pengurus.some((r, i) => i >= 2 && !!r.jabatan !== !!r.nama)) { toast("Setiap baris tambahan harus memuat jabatan dan nama."); return false; }
    const d = { periode: val("s1"), nama_ketua: pengurus[0].nama, nama_sekretaris: pengurus[1].nama, pengurus: pengurus.filter((r) => r.jabatan && r.nama), catatan: val("s6") };
    if (id) await updateDoc(doc(db, "sk_requests", id), { ...d, status: "diajukan", catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("diajukan", "Diajukan ulang")], updated_at: serverTimestamp() });
    else await addDoc(collection(db, "sk_requests"), { ...d, org_id: S.me.org_id, org_nama: orgName(S.me.org_id), tingkat: myTng(), jenis, parent_id: up.parent, issuer_id: up.issuer, hierarki_path: S.orgs[S.me.org_id].hierarki_path, status: "diajukan", riwayat: [hist("diajukan")], created_by: S.me.uid, created_by_nama: S.me.nama, created_at: serverTimestamp() });
    toast("Pengajuan SK dikirim.");
  }, "Kirim", () => { drawRows(); $("#pa").onclick = () => { rows.push({ jabatan: "", nama: "" }); drawRows(); }; });
}
function skDetail(x) {
  const list = x.pengurus?.length ? x.pengurus : [{ jabatan: "Ketua", nama: x.nama_ketua }, { jabatan: "Sekretaris", nama: x.nama_sekretaris }];
  dlg(`<h2>${esc(x.org_nama)}</h2><p class="mute">${SKJ[x.jenis]} · ${SKS[x.status]}</p>
  <dl class="info"><dt>Masa bakti</dt><dd>${esc(x.periode)}</dd>${list.map((r) => `<dt>${esc(r.jabatan)}</dt><dd>${esc(r.nama)}</dd>`).join("")}${x.catatan ? `<dt>Catatan</dt><dd>${esc(x.catatan)}</dd>` : ""}
  ${x.nomor_sk ? `<dt>Nomor SK</dt><dd>${esc(x.nomor_sk)} · ditetapkan di ${esc(x.tempat_penetapan || "–")}, ${esc(x.tanggal_pelantikan)}</dd>` : ""}
  <dt>Riwayat</dt><dd>${(x.riwayat || []).map((h) => `${esc(SKS[h.status] || h.status)} · ${esc(h.oleh)} · ${new Date(h.tanggal).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}${h.catatan ? " · " + esc(h.catatan) : ""}`).join("<br>")}</dd></dl>
  <div class="btns"><button id="c">Tutup</button></div>`);
  $("#c").onclick = closeDlg;
}
const skUpdate = async (x, data, msg) => { try { await updateDoc(doc(db, "sk_requests", x.id), { ...data, updated_at: serverTimestamp() }); toast(msg); } catch (e) { fail(e); } };

async function renderSk(x, iss, sig, nomor, tempat, tgl) {
  try { await document.fonts.load("600 40px Fraunces"); } catch { /* font cadangan */ }
  const W = 1240, H = 1754, M = 140, LH = 40, FONT = '"Times New Roman", Times, serif', pages = [];
  let c, g, y;
  const newPage = () => { c = document.createElement("canvas"); c.width = W; c.height = H; g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.fillStyle = "#111"; y = M; pages.push(c); };
  const need = (h) => { if (y + h > H - M) newPage(); };
  const font = (sz, b) => { g.font = `${b ? "700 " : ""}${sz}px ${FONT}`; };
  const center = (t, sz, b, gap = 6) => { need(sz * 1.5); font(sz, b); g.textAlign = "center"; g.fillText(t, W / 2, y + sz); y += sz * 1.25 + gap; };
  const wrap = (t, sz, b, maxW) => { font(sz, b); const out = []; let l = ""; for (const w of String(t).split(/\s+/)) { const tt = l ? l + " " + w : w; if (g.measureText(tt).width > maxW && l) { out.push(l); l = w; } else l = tt; } if (l) out.push(l); return out; };
  const item = (label, text, lab = 250) => { wrap(text, 27, false, W - M - (M + lab)).forEach((ln, i) => { need(LH); g.textAlign = "left"; font(27, false); if (i === 0 && label) g.fillText(label, M, y + 27); g.fillText(ln, M + lab, y + 27); y += LH; }); y += 4; };
  newPage();
  const un = iss.nama_unit.toUpperCase(), on = x.org_nama.toUpperCase();
  center("PAGAR NUSA", 40, true, 0); center(un, 34, true, 0);
  if (iss.alamat) center(iss.alamat, 22, false, 4);
  g.fillRect(M, y, W - 2 * M, 4); y += 30;
  center("SURAT KEPUTUSAN", 32, true, 0); center(`PIMPINAN ${un.replace(/^PIMPINAN\s+/, "")}`, 28, true, 0); center(`Nomor: ${nomor}`, 26, false, 16);
  center("TENTANG", 26, true, 0); center(`PENGESAHAN SUSUNAN PENGURUS ${on}`, 26, true, 0); center(`MASA BAKTI ${x.periode}`, 26, true, 20);
  item("Menimbang :", `a. bahwa untuk kelancaran roda organisasi perlu ditetapkan susunan pengurus ${x.org_nama} masa bakti ${x.periode};`);
  item("", "b. bahwa nama-nama yang tercantum dalam keputusan ini dipandang cakap dan memenuhi syarat untuk diangkat sebagai pengurus.");
  item("Mengingat :", "Anggaran Dasar dan Anggaran Rumah Tangga serta ketentuan organisasi yang berlaku.");
  y += 6; center("MEMUTUSKAN", 28, true, 10);
  item("Menetapkan :", `KESATU. Mengesahkan susunan pengurus ${x.org_nama} masa bakti ${x.periode} dengan susunan sebagai berikut:`);
  const list = x.pengurus?.length ? x.pengurus : [{ jabatan: "Ketua", nama: x.nama_ketua }, { jabatan: "Sekretaris", nama: x.nama_sekretaris }];
  list.forEach((r) => { wrap(r.nama, 27, false, W - M - (M + 740)).forEach((ln, i) => { need(LH); g.textAlign = "left"; font(27, false); if (i === 0) { g.fillText(r.jabatan, M + 270, y + 27); g.fillText(":", M + 670, y + 27); } g.fillText(ln, M + 700, y + 27); y += LH; }); });
  y += 8;
  item("", "KEDUA. Pengurus sebagaimana dimaksud pada diktum KESATU melaksanakan tugas sesuai ketentuan organisasi yang berlaku.");
  item("", "KETIGA. Surat keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diperbaiki sebagaimana mestinya.");
  need(470); y += 20;
  const tglLong = new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  g.textAlign = "left"; font(27, false); g.fillText(`Ditetapkan di : ${tempat}`, W / 2, y + 27); y += LH; g.fillText(`Pada tanggal  : ${tglLong}`, W / 2, y + 27); y += LH + 14;
  center(`PIMPINAN ${un.replace(/^PIMPINAN\s+/, "")}`, 27, true, 12);
  const c1 = W * 0.3, c2 = W * 0.7;
  font(27, true); g.textAlign = "center"; g.fillText("Ketua", c1, y + 27); g.fillText("Sekretaris", c2, y + 27); y += LH;
  const sy = y;
  for (const [k, cx] of [["ketua", c1], ["sekretaris", c2]]) if (sig[k]) { const im = await loadImg(sig[k]), sc = Math.min(280 / im.naturalWidth, 130 / im.naturalHeight); g.drawImage(im, cx - (im.naturalWidth * sc) / 2, sy, im.naturalWidth * sc, im.naturalHeight * sc); }
  y = sy + 150; font(27, true); g.textAlign = "center";
  for (const [nm, cx] of [[iss.ketua_nama, c1], [iss.sekretaris_nama, c2]]) { g.fillText(nm, cx, y + 27); const w = g.measureText(nm).width; g.fillRect(cx - w / 2, y + 33, w, 2); }
  return pages;
}
function skIssue(x) {
  const yr = new Date().getFullYear(), today = new Date().toISOString().slice(0, 10);
  modal(`Terbitkan SK ${esc(x.org_nama)}`, fld("Nomor urut surat", "i1", (S.cntSK || 0) + 1, "number") +
    `<p class="mini">Nomor surat: urut/${esc(S.me.org_id)}/A1/${yr}. Ditandatangani Ketua dan Sekretaris ${esc(orgName(S.me.org_id))}.</p>` +
    fld("Ditetapkan di (kota)", "i2") + fld("Tanggal penetapan / pelantikan", "i3", today, "date"), async () => {
    const urut = Math.floor(Number($("#i1").value)), tempat = val("i2"), tgl = val("i3");
    if (!(urut > 0) || !tempat || !tgl) { toast("Isi nomor urut, kota penetapan, dan tanggal."); return false; }
    const [io, sg] = await Promise.all([getDoc(doc(db, "organizations", S.me.org_id)), getDoc(doc(db, "org_signatures", S.me.org_id))]);
    const iss = io.data();
    if (!iss.ketua_nama || !iss.sekretaris_nama) { toast("Lengkapi nama ketua dan sekretaris di menu Profil & website terlebih dahulu."); return false; }
    const nomor = `${urut}/${S.me.org_id}/A1/${yr}`;
    const pages = await renderSk(x, iss, sg.exists() ? sg.data() : {}, nomor, tempat, tgl);
    const pdf = makePdfPages(pages.map((c) => jpegBytes(c, 0.85)), pages[0].width, pages[0].height);
    const { meta, parts } = await prepFile(new File([pdf], `SK-${x.org_nama}.pdf`.replace(/[^\w.-]+/g, "_"), { type: "application/pdf" }));
    await setDoc(doc(db, "counters", `${S.me.org_id}_SK${yr}`), { n: urut });
    await writeChunks("sk_requests", x.id, parts);
    await updateDoc(doc(db, "sk_requests", x.id), { status: "dilantik", nomor_sk: nomor, tanggal_pelantikan: tgl, tempat_penetapan: tempat, file: meta, catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("dilantik")], updated_at: serverTimestamp() });
    toast(`SK ${nomor} diterbitkan.`);
  }, "Terbitkan & buat PDF");
}
function skCnt() {
  const yr = new Date().getFullYear();
  modal(`Nomor urut surat ${yr}`, fld("Nomor urut terakhir yang sudah dipakai", "n1", S.cntSK || 0, "number") + '<p class="mini">SK berikutnya memakai nomor terakhir + 1 (dapat diubah saat menerbitkan).</p>', async () => {
    const n = Math.floor(Number($("#n1").value));
    if (!(n >= 0)) { toast("Isi angka 0 atau lebih."); return false; }
    await setDoc(doc(db, "counters", `${S.me.org_id}_SK${yr}`), { n }); toast("Nomor urut disimpan.");
  });
}
function skTplUp(jenis) {
  modal(`Template ${SKJ[jenis]}`, '<label for="t1">Berkas template (.doc, .docx, atau .pdf; maks. 3 MB)</label><input id="t1" type="file" accept=".pdf,.doc,.docx">', async () => {
    const f = $("#t1").files[0];
    if (!f) { toast("Pilih berkas terlebih dahulu."); return false; }
    const id = `${S.me.org_id}__${jenis}`, meta = await putFile("sk_templates", id, f);
    await setDoc(doc(db, "sk_templates", id), { org_id: S.me.org_id, jenis, ...meta, updated_at: serverTimestamp() });
    toast("Template tersimpan.");
  }, "Unggah");
}
function sigForm(kind) {
  modal(`Tanda tangan ${kind === "ketua" ? "Ketua" : "Sekretaris"}`, '<label for="g1">Gambar tanda tangan (PNG/JPG)</label><input id="g1" type="file" accept="image/png,image/jpeg">', async () => {
    const f = $("#g1").files[0];
    if (!f) { toast("Pilih gambar terlebih dahulu."); return false; }
    const data = await fitImage(f, 400000);
    await setDoc(doc(db, "org_signatures", S.me.org_id), { ...S.sig, [kind]: data, updated_at: serverTimestamp() });
    toast("Tanda tangan disimpan.");
  }, "Simpan");
}

/* ---------- Pelatihan: Pelatih & Wasit Juri ---------- */
const progOf = (x) => x.program || "pelatih";
const curProg = () => (location.hash === "#pelatihan-wasit" ? "wasit_juri" : "pelatih");
const wjLabel = (x) => (x.jenis === "ipsi" ? `IPSI ${JENJANG[x.jenjang_ipsi] || ""}` : "Internal Pagar Nusa");
const feeOf = (x) => (progOf(x) === "pelatih" ? S.pset?.biaya : x.jenis === "ipsi" ? S.pset?.biaya_wj_ipsi : S.pset?.biaya_wj_internal) || 0;
const REK_FMT = "{urut}/{kode}/REK-WJ/{tahun}";
const Rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
function plActions(x) {
  const r = S.me.role, st = x.status;
  if (r === "admin_pac" && st === "diajukan") return btn("pl-ok", x.id, "Verifikasi", "pri") + btn("pl-rev", x.id, "Minta revisi");
  if (isSubRole() && st === "revisi") return btn("pl-again", x.id, "Ajukan ulang", "pri");
  if (r === "admin_cabang" && progOf(x) === "wasit_juri" && x.jenis === "ipsi" && st === "terdaftar" && !x.rekomendasi) return btn("wj-rek", x.id, "Terbitkan surat rekomendasi", "pri");
  return "";
}
function pelatihan(prog) {
  const r = S.me.role, pac = r === "admin_pac", cab = r === "admin_cabang", subr = isSubRole(), wj = prog === "wasit_juri";
  const regs = S.pls.filter((x) => progOf(x) === prog), pays = S.plp.filter((p) => (p.program || "pelatih") === prog);
  const ready = regs.filter((x) => x.status === "diverifikasi_pac" && !x.pembayaran_id).length;
  const accts = S.accts.filter((a) => a.aktif !== false);
  const payRows = pays.map((p) => `<tr><td>${fmtD(p.created_at)}</td><td>${esc(p.pac_nama)}</td><td>${esc((p.peserta_nama || []).join(", "))}</td><td>${Rp(p.jumlah)}<br><span class="mini">${esc(p.rekening_info || p.metode)}</span></td>
    <td><span class="pill ${p.status === "terverifikasi" ? "ok" : p.status === "ditolak" ? "bad" : "warn"}">${PAYS[p.status]}</span>${p.catatan ? `<br><span class="mini">${esc(p.catatan)}</span>` : ""}</td>
    <td><div class="act">${btn("pl-proof", p.id, "Lihat bukti")}${cab && p.status === "menunggu" ? btn("pl-payok", p.id, "Verifikasi pembayaran", "pri") + btn("pl-payno", p.id, "Tolak", "bad") : ""}</div></td></tr>`).join("");
  const fee = wj ? ` Biaya per peserta: Internal <b>${Rp(S.pset?.biaya_wj_internal)}</b>, IPSI <b>${Rp(S.pset?.biaya_wj_ipsi)}</b>.` : S.pset?.biaya ? ` Biaya: <b>${Rp(S.pset.biaya)}</b> per peserta.` : "";
  const intro = wj ? "Pelatihan Wasit Juri dilaksanakan di tingkat cabang: Wasit Juri Internal Pagar Nusa (per cabang) atau Wasit Juri IPSI (Kabupaten/Kota, Provinsi, Nasional). Untuk IPSI, cabang menerbitkan surat rekomendasi setelah pembayaran terverifikasi." : "Pelatihan pelatih untuk anggota minimal sabuk Coklat, dilaksanakan di tingkat cabang.";
  const role = subr ? " Daftarkan peserta; PAC memverifikasi." : pac ? " Verifikasi pendaftar, lalu bayar ke cabang dan unggah bukti pembayaran." : cab ? " Verifikasi bukti pembayaran dari PAC; kelola rekening, QRIS, dan biaya di bawah." : "";
  $("#view").innerHTML = `<p class="mute">${intro}${role}${fee}</p>
  <div class="bar">${subr || pac ? '<button class="pri" data-act="pl-add">Daftarkan peserta</button>' : ""}${pac && ready ? `<button class="pri" data-act="pl-pay">Bayar ke cabang (${ready} peserta siap)</button>` : ""}${cab && wj ? `<button data-act="rek-cnt">Atur nomor surat rekomendasi (terakhir: ${S.cntRek.n || 0})</button>` : ""}</div>
  <div class="sec" style="margin-top:0">Peserta</div>` +
  tbl(wj ? ["Peserta", "Unit", "Jenis", "Status", "Surat rekomendasi IPSI", ""] : ["Peserta", "Unit", "Sabuk", "Status", ""], regs.map((x) => `<tr><td>${esc(x.nama_peserta)}<br><span class="mini">${esc(x.periode || "")}</span></td><td>${esc(orgName(x.org_id))}</td><td>${wj ? esc(wjLabel(x)) : esc(x.sabuk)}</td>
    <td><span class="pill ${x.status === "terdaftar" ? "ok" : x.status === "revisi" ? "bad" : "warn"}">${PLS[x.status]}</span>${x.catatan_revisi && x.status === "revisi" ? `<br><span class="mini">${esc(x.catatan_revisi)}</span>` : ""}</td>
    ${wj ? `<td>${x.rekomendasi ? `${esc(x.rekomendasi.nomor)}<div class="act">${btn("wj-file", x.id, "Unduh surat")}</div>` : x.jenis === "ipsi" ? "–" : '<span class="mini">Tidak diperlukan</span>'}</td>` : ""}
    <td><div class="act">${plActions(x)}</div></td></tr>`).join(""), "Belum ada pendaftar.") +
  (pac || LV[r] <= LV.admin_cabang ? `<div class="sec">Pembayaran ke cabang</div>` + tbl(["Tanggal", "PAC", "Peserta", "Jumlah", "Status", ""], payRows, "Belum ada pembayaran.") : "") +
  (cab ? `<div class="sec">Rekening &amp; QRIS pembayaran</div><p class="mute">Berlaku untuk Pelatihan Pelatih dan Wasit Juri.</p>
    <div class="bar"><button class="pri" data-act="acct-add-rekening">Tambah rekening</button><button data-act="acct-add-qris">Unggah QRIS</button><button data-act="biaya-edit">Atur biaya</button></div>` +
    tbl(["Jenis", "Detail", ""], S.accts.map((a) => `<tr><td>${a.tipe === "qris" ? "QRIS" : "Rekening"}</td><td>${a.tipe === "qris" ? `<img src="${a.image}" alt="QRIS" style="height:80px;background:#fff;border-radius:6px">` : `${esc(a.bank)} · <b>${esc(a.nomor)}</b><br><span class="mini">a.n. ${esc(a.atas_nama)}</span>`}${a.keterangan ? `<br><span class="mini">${esc(a.keterangan)}</span>` : ""}</td>
      <td><div class="act">${btn("acct-edit", a.id, "Edit")}${btn("acct-del", a.id, "Hapus", "bad")}</div></td></tr>`).join(""), "Belum ada rekening atau QRIS.") : "") +
  (pac && accts.length ? `<div class="sec">Rekening &amp; QRIS cabang</div>` + tbl(["Jenis", "Detail"], accts.map((a) => `<tr><td>${a.tipe === "qris" ? "QRIS" : "Rekening"}</td><td>${a.tipe === "qris" ? `<img src="${a.image}" alt="QRIS" style="height:120px;background:#fff;border-radius:6px">` : `${esc(a.bank)} · <b>${esc(a.nomor)}</b><br><span class="mini">a.n. ${esc(a.atas_nama)}</span>`}</td></tr>`).join(""), "") : "");
}
const plUpd = async (id, data, msg) => { try { await updateDoc(doc(db, "pelatihan_registrations", id), { ...data, updated_at: serverTimestamp() }); toast(msg); } catch (e) { fail(e); } };
function plForm(prog) {
  const pac = S.me.role === "admin_pac", wj = prog === "wasit_juri";
  const members = S.users.filter((u) => u.role === "member" && u.status_aktif !== false && (wj || ["Coklat", "Hitam"].includes(u.sabuk)) && (pac || u.org_id === S.me.org_id));
  if (!members.length) return toast(wj ? "Belum ada anggota aktif yang dapat didaftarkan." : "Belum ada anggota bersabuk Coklat/Hitam yang dapat didaftarkan.");
  modal(`Daftarkan peserta ${wj ? "Wasit Juri" : "Pelatihan Pelatih"}`,
    sel("Peserta", "l1", members.map((u) => [u.id, `${u.nama_lengkap} · ${u.sabuk || "Putih"}${pac ? " · " + orgName(u.org_id) : ""}`]), members[0].id) +
    (wj ? sel("Jenis Wasit Juri", "l3", [["internal", "Wasit Juri Internal Pagar Nusa (cabang)"], ["ipsi", "Wasit Juri IPSI"]], "internal") + `<div id="lj" style="display:none">${sel("Jenjang IPSI", "l4", Object.entries(JENJANG), "kabupaten")}</div>` : "") +
    fld(`Angkatan / periode (mis. ${wj ? "Pelatihan Wasit Juri" : "Pelatihan Pelatih"} 2026)`, "l2"), async () => {
    const u = members.find((m) => m.id === $("#l1").value), path = S.orgs[u.org_id].hierarki_path, up = (t) => path.find((o) => S.orgs[o]?.tingkat === t) || "";
    const jenis = wj ? $("#l3").value : "", jenjang = wj && jenis === "ipsi" ? $("#l4").value : "";
    if (S.pls.some((x) => x.uid === u.id && progOf(x) === prog && (x.jenis || "") === jenis && (x.jenjang_ipsi || "") === jenjang && x.status !== "revisi")) { toast("Peserta ini sudah terdaftar pada program/jenis yang sama."); return false; }
    await addDoc(collection(db, "pelatihan_registrations"), { uid: u.id, nama_peserta: u.nama_lengkap, org_id: u.org_id, pac_id: up("pac"), cabang_id: up("cabang"), hierarki_path: path, sabuk: u.sabuk || "Putih", periode: val("l2"), program: prog, jenis, jenjang_ipsi: jenjang, status: "diajukan", riwayat: [hist("diajukan")], created_by: S.me.uid, created_at: serverTimestamp() });
    toast("Peserta didaftarkan dan menunggu verifikasi PAC.");
  }, "Daftarkan", () => { if (wj) { const t = () => { $("#lj").style.display = $("#l3").value === "ipsi" ? "" : "none"; }; $("#l3").onchange = t; t(); } });
}
function plPay(prog) {
  const ready = S.pls.filter((x) => progOf(x) === prog && x.status === "diverifikasi_pac" && !x.pembayaran_id), accts = S.accts.filter((a) => a.aktif !== false);
  if (!ready.length) return toast("Belum ada peserta yang siap dibayarkan.");
  if (!accts.length) return toast("Cabang belum mengisi rekening atau QRIS pembayaran.");
  const label = (a) => (a.tipe === "qris" ? "QRIS cabang" : `${a.bank} ${a.nomor} a.n. ${a.atas_nama}`);
  modal("Bayar ke cabang", `<label>Peserta yang dibayarkan</label>` + ready.map((x) => `<label class="cb"><input type="checkbox" class="pp" value="${x.id}" checked>${esc(x.nama_peserta)} · ${esc(prog === "wasit_juri" ? wjLabel(x) : orgName(x.org_id))} · ${Rp(feeOf(x))}</label>`).join("") +
    sel("Dibayar ke", "pa", accts.map((a) => [a.id, label(a)]), accts[0].id) + '<div id="pq"></div>' +
    fld("Jumlah dibayar (Rp)", "pj", ready.reduce((a, x) => a + feeOf(x), 0), "number") +
    `<label for="pb">Bukti pembayaran (PNG/JPG/PDF, maks. 2 MB)</label><input id="pb" type="file" accept=".png,.jpg,.jpeg,.pdf">`, async () => {
    const ids = [...document.querySelectorAll(".pp:checked")].map((i) => i.value), jumlah = Number($("#pj").value), f = $("#pb").files[0], a = accts.find((z) => z.id === $("#pa").value);
    if (!ids.length || !(jumlah > 0) || !f) { toast("Pilih peserta, isi jumlah, dan unggah bukti pembayaran."); return false; }
    const { meta, parts } = await prepFile(f, /\.(png|jpe?g|pdf)$/i, 2), chosen = ready.filter((x) => ids.includes(x.id));
    const pref = doc(collection(db, "pelatihan_payments")), b = writeBatch(db);
    b.set(pref, { program: prog, pac_id: S.me.org_id, pac_nama: orgName(S.me.org_id), cabang_id: S.orgs[S.me.org_id].parent_id, hierarki_path: S.orgs[S.me.org_id].hierarki_path, peserta_ids: ids, peserta_nama: chosen.map((x) => x.nama_peserta), jumlah, metode: a.tipe === "qris" ? "qris" : "transfer", rekening_info: label(a), bukti: meta, status: "menunggu", catatan: "", riwayat: [hist("menunggu")], created_by: S.me.uid, created_at: serverTimestamp() });
    chosen.forEach((x) => b.update(doc(db, "pelatihan_registrations", x.id), { status: "menunggu_bayar", pembayaran_id: pref.id, riwayat: [...(x.riwayat || []), hist("menunggu_bayar")], updated_at: serverTimestamp() }));
    await b.commit();
    await writeChunks("pelatihan_payments", pref.id, parts);
    toast("Pembayaran dikirim. Menunggu verifikasi cabang.");
  }, "Kirim pembayaran", () => {
    const upd = () => { $("#pj").value = [...document.querySelectorAll(".pp:checked")].reduce((a, c) => a + feeOf(ready.find((x) => x.id === c.value)), 0); };
    document.querySelectorAll(".pp").forEach((c) => (c.onchange = upd));
    const show = () => { const a = accts.find((z) => z.id === $("#pa").value); $("#pq").innerHTML = a?.tipe === "qris" ? `<img src="${a.image}" alt="QRIS" style="max-width:220px;background:#fff;border-radius:8px">` : ""; };
    $("#pa").onchange = show; show();
  });
}
async function plPayVerify(id, ok) {
  const p = S.plp.find((x) => x.id === id), note = ok ? "" : prompt("Alasan penolakan pembayaran:");
  if (!ok && !note) return;
  try {
    const b = writeBatch(db), st = ok ? "terverifikasi" : "ditolak";
    b.update(doc(db, "pelatihan_payments", id), { status: st, catatan: note || "", riwayat: [...(p.riwayat || []), hist(st, note || "")], updated_at: serverTimestamp() });
    S.pls.filter((x) => x.pembayaran_id === id && x.status === "menunggu_bayar").forEach((x) => b.update(doc(db, "pelatihan_registrations", x.id), ok
      ? { status: "terdaftar", riwayat: [...(x.riwayat || []), hist("terdaftar")], updated_at: serverTimestamp() }
      : { status: "diverifikasi_pac", pembayaran_id: "", catatan_revisi: "Pembayaran ditolak: " + note, riwayat: [...(x.riwayat || []), hist("diverifikasi_pac", "Pembayaran ditolak")], updated_at: serverTimestamp() }));
    await b.commit(); toast(ok ? "Pembayaran terverifikasi; peserta terdaftar." : "Pembayaran ditolak; PAC dapat membayar ulang.");
  } catch (e) { fail(e); }
}

/* --- surat rekomendasi Wasit Juri ke IPSI --- */
async function renderRekom({ x, u, iss, sig, nomor, tujuan, tempat, tgl }) {
  try { await document.fonts.load("600 40px Fraunces"); } catch { /* font cadangan */ }
  const W = 1240, H = 1754, M = 140, LH = 40, FONT = '"Times New Roman", Times, serif', pages = [];
  let c, g, y;
  const newPage = () => { c = document.createElement("canvas"); c.width = W; c.height = H; g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.fillStyle = "#111"; y = M; pages.push(c); };
  const need = (h) => { if (y + h > H - M) newPage(); };
  const font = (sz, b) => { g.font = `${b ? "700 " : ""}${sz}px ${FONT}`; };
  const center = (t, sz, b, gap = 6) => { need(sz * 1.5); font(sz, b); g.textAlign = "center"; g.fillText(t, W / 2, y + sz); y += sz * 1.25 + gap; };
  const wrap = (t, sz, b, maxW) => { font(sz, b); const out = []; let l = ""; for (const w of String(t).split(/\s+/)) { const tt = l ? l + " " + w : w; if (g.measureText(tt).width > maxW && l) { out.push(l); l = w; } else l = tt; } if (l) out.push(l); return out; };
  const para = (t, gap = 14) => { wrap(t, 27, false, W - 2 * M).forEach((ln) => { need(LH); g.textAlign = "left"; font(27, false); g.fillText(ln, M, y + 27); y += LH; }); y += gap; };
  const row = (lab, v, off = 240) => { need(LH); g.textAlign = "left"; font(27, false); g.fillText(lab, M, y + 27); g.fillText(":", M + off - 30, y + 27); wrap(v, 27, false, W - M - (M + off)).forEach((ln, i) => { if (i) need(LH); g.fillText(ln, M + off, y + 27); y += LH; }); };
  newPage();
  const un = iss.nama_unit.toUpperCase(), jj = JENJANG[x.jenjang_ipsi] || "";
  center("PAGAR NUSA", 40, true, 0); center(un, 34, true, 0);
  if (iss.alamat) center(iss.alamat, 22, false, 4);
  g.fillRect(M, y, W - 2 * M, 4); y += 34;
  row("Nomor", nomor); row("Lampiran", "-"); row("Perihal", `Rekomendasi Wasit Juri IPSI Tingkat ${jj}`); y += 24;
  para("Kepada Yth.", 0); font(27, true); need(LH); g.textAlign = "left"; g.fillText(tujuan, M, y + 27); y += LH; para("di tempat", 22);
  para("Dengan hormat,");
  para(`Bersama surat ini, ${iss.nama_unit} merekomendasikan anggota berikut:`, 10);
  row("Nama", x.nama_peserta, 280); row("NIA", u.nia || "-", 280); row("Unit", orgName(x.org_id), 280); row("Tingkatan", `Sabuk ${x.sabuk || "-"}`, 280); y += 14;
  para(`untuk mengikuti penjenjangan Wasit Juri IPSI tingkat ${jj}. Yang bersangkutan telah mengikuti Pelatihan Wasit Juri yang diselenggarakan oleh ${iss.nama_unit}${x.periode ? ` (${x.periode})` : ""}.`);
  para("Demikian surat rekomendasi ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.", 30);
  need(420);
  const tglLong = new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  g.textAlign = "left"; font(27, false); g.fillText(`${tempat}, ${tglLong}`, W / 2, y + 27); y += LH + 14;
  center(un, 27, true, 12);
  const c1 = W * 0.3, c2 = W * 0.7;
  font(27, true); g.textAlign = "center"; g.fillText("Ketua", c1, y + 27); g.fillText("Sekretaris", c2, y + 27); y += LH;
  const sy = y;
  for (const [k, cx] of [["ketua", c1], ["sekretaris", c2]]) if (sig[k]) { const im = await loadImg(sig[k]), sc = Math.min(280 / im.naturalWidth, 130 / im.naturalHeight); g.drawImage(im, cx - (im.naturalWidth * sc) / 2, sy, im.naturalWidth * sc, im.naturalHeight * sc); }
  y = sy + 150; font(27, true); g.textAlign = "center";
  for (const [nm, cx] of [[iss.ketua_nama, c1], [iss.sekretaris_nama, c2]]) { g.fillText(nm, cx, y + 27); const w = g.measureText(nm).width; g.fillRect(cx - w / 2, y + 33, w, 2); }
  return pages;
}
function wjRek(id) {
  const x = S.pls.find((r) => r.id === id), yr = new Date().getFullYear(), today = new Date().toISOString().slice(0, 10);
  const def = x.jenjang_ipsi === "nasional" ? "Ketua Umum Pengurus Besar IPSI" : x.jenjang_ipsi === "provinsi" ? "Ketua Pengurus IPSI Provinsi" : "Ketua Pengurus IPSI Kabupaten/Kota";
  modal(`Surat rekomendasi ${esc(x.nama_peserta)}`, fld("Nomor urut surat", "r1", (S.cntRek.n || 0) + 1, "number") + fld("Ditujukan kepada", "r2", def) + fld("Dibuat di (kota)", "r3") + fld("Tanggal surat", "r4", today, "date") +
    `<p class="mini">Jenjang IPSI: ${esc(JENJANG[x.jenjang_ipsi])}. Ditandatangani Ketua dan Sekretaris ${esc(orgName(S.me.org_id))}.</p>`, async () => {
    const urut = Math.floor(Number($("#r1").value)), tujuan = val("r2"), tempat = val("r3"), tgl = val("r4");
    if (!(urut > 0) || !tujuan || !tempat || !tgl) { toast("Isi nomor urut, tujuan, kota, dan tanggal."); return false; }
    const [io, sg, us] = await Promise.all([getDoc(doc(db, "organizations", S.me.org_id)), getDoc(doc(db, "org_signatures", S.me.org_id)), getDoc(doc(db, "users", x.uid))]);
    const iss = io.data();
    if (!iss.ketua_nama || !iss.sekretaris_nama) { toast("Lengkapi nama ketua dan sekretaris di menu Profil & website terlebih dahulu."); return false; }
    const fmtS = S.cntRek.format || REK_FMT, nomor = nomorFmt(fmtS, { urut, kode: S.me.org_id, level: "WJ", year: yr });
    const pages = await renderRekom({ x, u: us.data() || {}, iss, sig: sg.exists() ? sg.data() : {}, nomor, tujuan, tempat, tgl });
    const pdf = makePdfPages(pages.map((c) => jpegBytes(c, 0.85)), pages[0].width, pages[0].height);
    const { meta, parts } = await prepFile(new File([pdf], `Rekomendasi-${x.nama_peserta}.pdf`.replace(/[^\w.-]+/g, "_"), { type: "application/pdf" }));
    await setDoc(doc(db, "counters", `${S.me.org_id}_REKWJ`), { n: urut, format: fmtS });
    await writeChunks("pelatihan_registrations", x.id, parts);
    await updateDoc(doc(db, "pelatihan_registrations", x.id), { rekomendasi: { nomor, tanggal: tgl, tujuan, tempat, file: meta }, riwayat: [...(x.riwayat || []), hist("terdaftar", "Surat rekomendasi terbit")], updated_at: serverTimestamp() });
    toast(`Surat rekomendasi ${nomor} diterbitkan.`);
  }, "Terbitkan & buat PDF");
}
function rekCntForm() {
  modal("Nomor surat rekomendasi", fld("Nomor urut terakhir yang sudah dipakai", "k1", S.cntRek.n || 0, "number") + fld("Format nomor", "k2", S.cntRek.format || REK_FMT) +
    '<p class="mini">Isian format: {urut} nomor urut 4 digit, {kode} kode cabang, {tahun} tahun surat.</p>', async () => {
    const n = Math.floor(Number($("#k1").value)), f = val("k2");
    if (!(n >= 0) || !f.includes("{urut}")) { toast("Isi nomor terakhir (≥ 0) dan format yang memuat {urut}."); return false; }
    await setDoc(doc(db, "counters", `${S.me.org_id}_REKWJ`), { n, format: f }); toast("Pengaturan nomor disimpan.");
  });
}
function acctForm(id, tipe) {
  const a = S.accts.find((x) => x.id === id), t = a?.tipe || tipe;
  modal(`${id ? "Edit" : "Tambah"} ${t === "qris" ? "QRIS" : "rekening"}`,
    (t === "qris" ? '<label for="a5">Gambar QRIS (PNG/JPG)</label><input id="a5" type="file" accept="image/png,image/jpeg">' + (a?.image ? `<img src="${a.image}" alt="" style="height:90px;margin-top:8px;background:#fff;border-radius:6px">` : "")
      : fld("Nama bank", "a1", a?.bank || "") + fld("Nomor rekening", "a2", a?.nomor || "") + fld("Atas nama", "a3", a?.atas_nama || "")) + fld("Keterangan (opsional)", "a4", a?.keterangan || ""),
    async () => {
      const base = { org_id: S.me.org_id, tipe: t, keterangan: val("a4"), aktif: true, updated_at: serverTimestamp() };
      let d;
      if (t === "qris") {
        const f = $("#a5").files[0];
        if (!f && !a?.image) { toast("Pilih gambar QRIS."); return false; }
        d = { ...base, image: f ? await fitImage(f, 800000) : a.image };
      } else {
        if (!val("a1") || !val("a2") || !val("a3")) { toast("Lengkapi bank, nomor rekening, dan atas nama."); return false; }
        d = { ...base, bank: val("a1"), nomor: val("a2"), atas_nama: val("a3") };
      }
      if (id) await updateDoc(doc(db, "payment_accounts", id), d); else await addDoc(collection(db, "payment_accounts"), { ...d, created_at: serverTimestamp() });
      toast("Tersimpan.");
    });
}
function biayaForm() {
  modal("Biaya pelatihan", fld("Pelatihan Pelatih: biaya per peserta (Rp)", "b1", S.pset?.biaya || 0, "number") +
    fld("Wasit Juri Internal: biaya per peserta (Rp)", "b3", S.pset?.biaya_wj_internal || 0, "number") + fld("Wasit Juri IPSI: biaya per peserta (Rp)", "b4", S.pset?.biaya_wj_ipsi || 0, "number") +
    fld("Keterangan (opsional)", "b2", S.pset?.keterangan || ""), async () => {
    const a = Number($("#b1").value), b = Number($("#b3").value), c = Number($("#b4").value);
    if (![a, b, c].every((n) => n >= 0)) { toast("Isi biaya dengan angka 0 atau lebih."); return false; }
    await setDoc(doc(db, "pelatihan_settings", S.me.org_id), { biaya: a, biaya_wj_internal: b, biaya_wj_ipsi: c, keterangan: val("b2"), updated_at: serverTimestamp() });
    toast("Biaya disimpan.");
  });
}

/* ---------- keuangan ---------- */
function keuangan() {
  const f = fin(), m = {};
  S.kas.forEach((k) => { const d = dt(k.tanggal); if (d) (m[d.toISOString().slice(0, 7)] ||= [0, 0])[k.tipe === "pemasukan" ? 0 : 1] += k.nominal || 0; });
  f.out.forEach((d) => { const x = dt(d.updated_at) || dt(d.created_at); if (x) (m[x.toISOString().slice(0, 7)] ||= [0, 0])[1] += d.nominal || 0; });
  const keys = Object.keys(m).sort().slice(-6), max = Math.max(1, ...keys.flatMap((k) => m[k])), W = 560, H = 210;
  const bars = keys.map((k, i) => { const x = 40 + i * 86, a = (m[k][0] / max) * 150, b = (m[k][1] / max) * 150;
    return `<rect x="${x}" y="${H - 30 - a}" width="16" height="${a}" fill="var(--acc)" rx="2"/><rect x="${x + 19}" y="${H - 30 - b}" width="16" height="${b}" fill="var(--gold)" rx="2"/><text x="${x + 17}" y="${H - 12}" text-anchor="middle" fill="var(--mute)" font-size="12">${k}</text>`; }).join("");
  const parent = S.orgs[S.me.org_id]?.parent_id, canDonate = ["admin_rayon", "admin_ranting"].includes(S.me.role) && parent;
  const kas = S.kas.slice().sort((a, b) => ts(b.tanggal) - ts(a.tanggal));
  const dPill = (s) => `<span class="pill ${s === "diterima" ? "ok" : s === "ditolak" ? "bad" : "warn"}">${s}</span>`;
  $("#view").innerHTML = `<p class="mute">Kas ${esc(orgName(S.me.org_id))} bersifat privat: unit di atas maupun di bawah tidak dapat melihatnya.</p>
  <div class="grid"><div class="card stat"><b>${R(f.ti)}</b><span>Total pemasukan</span></div><div class="card stat"><b>${R(f.to)}</b><span>Total pengeluaran (termasuk donasi keluar diterima)</span></div><div class="card stat"><b>${R(f.ti - f.to)}</b><span>Saldo kas</span></div></div>
  <div class="bar"><button class="pri" data-act="kas-add">Catat kas</button>${canDonate ? `<button data-act="don-add">Donasi ke ${esc(orgName(parent))}</button>` : ""}</div>
  <div class="card"><b>Pemasukan dan pengeluaran per bulan</b>${keys.length ? `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:520px" role="img" aria-label="Grafik batang kas per bulan">${bars}<line x1="30" x2="${W - 10}" y1="${H - 30}" y2="${H - 30}" stroke="var(--line)"/></svg></div><p class="mute"><span class="pill ok">Hijau</span> pemasukan &nbsp; <span class="pill warn">Emas</span> pengeluaran</p>` : '<p class="empty">Belum ada catatan kas.</p>'}</div>
  <div class="sec">Catatan kas</div>` +
  tbl(["Tanggal", "Kategori", "Keterangan", "Tipe", "Nominal", ""], kas.map((k) => `<tr><td>${fmtD(k.tanggal)}</td><td>${esc(k.kategori_kas)}</td><td>${esc(k.keterangan)}</td>
    <td><span class="pill ${k.tipe === "pemasukan" ? "ok" : "warn"}">${k.tipe}</span></td><td>${R(k.nominal)}</td>
    <td>${k.donasi_id ? '<span class="mini">Terkunci (donasi)</span>' : `<div class="act">${btn("kas-edit", k.id, "Edit")}${btn("kas-del", k.id, "Hapus", "bad")}</div>`}</td></tr>`).join(""), "Belum ada catatan kas.") +
  (S.donIn.length || LV[S.me.role] < 4 ? `<div class="sec">Donasi masuk dari unit bawah</div>` + tbl(["Tanggal", "Dari", "Keterangan", "Nominal", "Status", ""],
    S.donIn.slice().sort((a, b) => ts(b.created_at) - ts(a.created_at)).map((d) => `<tr><td>${fmtD(d.created_at)}</td><td>${esc(d.from_nama)}</td><td>${esc(d.keterangan)}</td><td>${R(d.nominal)}</td><td>${dPill(d.status)}</td>
    <td>${d.status === "menunggu" ? `<div class="act">${btn("don-ok", d.id, "Terima", "pri")}${btn("don-no", d.id, "Tolak", "bad")}</div>` : ""}</td></tr>`).join(""), "Belum ada donasi masuk.") : "") +
  (canDonate || S.donOut.length ? `<div class="sec">Donasi keluar</div>` + tbl(["Tanggal", "Ke", "Keterangan", "Nominal", "Status", ""],
    S.donOut.slice().sort((a, b) => ts(b.created_at) - ts(a.created_at)).map((d) => `<tr><td>${fmtD(d.created_at)}</td><td>${esc(orgName(d.to_org))}</td><td>${esc(d.keterangan)}</td><td>${R(d.nominal)}</td><td>${dPill(d.status)}</td>
    <td>${d.status === "menunggu" ? btn("don-cancel", d.id, "Batalkan", "bad") : ""}</td></tr>`).join(""), "Belum ada donasi keluar.") : "");
}

function kasForm(id) {
  const k = S.kas.find((x) => x.id === id), d = dt(k?.tanggal) || new Date();
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  modal(id ? "Edit catatan kas" : "Catat kas",
    sel("Tipe", "k1", [["pemasukan", "Pemasukan"], ["pengeluaran", "Pengeluaran"]], k?.tipe || "pemasukan") +
    fld("Kategori kas (mis. Iuran, Pembangunan Padepokan)", "k2", k?.kategori_kas || "") +
    fld("Nominal (Rp)", "k3", k?.nominal || "", "number") + fld("Tanggal", "k4", iso, "date") + fld("Keterangan", "k5", k?.keterangan || ""),
    async () => {
      const nominal = Number(val("k3")), kat = val("k2");
      if (!kat || !(nominal > 0) || !val("k4")) { toast("Lengkapi kategori, nominal (> 0), dan tanggal."); return false; }
      const data = { org_id: S.me.org_id, tipe: $("#k1").value, kategori_kas: kat, nominal, keterangan: val("k5"), tanggal: Timestamp.fromDate(new Date(val("k4") + "T00:00:00")) };
      if (id) await updateDoc(doc(db, "financial_reports", id), data);
      else await addDoc(collection(db, "financial_reports"), { ...data, dibuat_oleh: S.me.uid, dibuat_nama: S.me.nama, created_at: serverTimestamp() });
      toast("Catatan kas disimpan.");
    });
}
function donForm() {
  const parent = S.orgs[S.me.org_id].parent_id;
  modal(`Donasi ke ${esc(orgName(parent))}`, fld("Nominal (Rp)", "d1", "", "number") + fld("Keterangan", "d2"), async () => {
    const nominal = Number(val("d1"));
    if (!(nominal > 0)) { toast("Nominal harus lebih dari 0."); return false; }
    await addDoc(collection(db, "unit_donations"), { from_org: S.me.org_id, to_org: parent, from_nama: orgName(S.me.org_id), nominal, keterangan: val("d2"), status: "menunggu", dibuat_oleh: S.me.uid, dibuat_nama: S.me.nama, created_at: serverTimestamp() });
    toast("Donasi dikirim. Menunggu konfirmasi unit penerima.");
  }, "Kirim donasi");
}
async function donAccept(id) {
  const d = S.donIn.find((x) => x.id === id);
  try {
    const b = writeBatch(db);
    b.update(doc(db, "unit_donations", id), { status: "diterima", updated_at: serverTimestamp() });
    b.set(doc(db, "financial_reports", "don_" + id), { org_id: S.me.org_id, tipe: "pemasukan", kategori_kas: "Donasi dari " + d.from_nama, nominal: d.nominal, keterangan: d.keterangan || "", tanggal: Timestamp.now(), donasi_id: id, dibuat_oleh: S.me.uid, dibuat_nama: S.me.nama, created_at: serverTimestamp() });
    await b.commit(); toast("Donasi diterima dan dicatat sebagai pemasukan.");
  } catch (e) { fail(e); }
}

/* ---------- profil & website ---------- */
const postLink = (x) => `<a class="btn" href="${esc(siteUrl(S.orgs[x.target_org_id] || {}))}?p=${x.id}" target="_blank" rel="noopener">Lihat</a>`;
const SITE = (import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "") || location.origin;
const siteUrl = (o) => `${SITE}/${o.url_path || ""}`;
function profil() {
  const o = S.orgs[S.me.org_id] || {}, units = Object.keys(S.orgs).filter(inScope);
  $("#view").innerHTML = `<div class="card"><b>${esc(o.nama_unit)}</b><p class="mute" style="margin:4px 0">${TNG[o.tingkat] || ""}</p>
  <p>Alamat website unit: <a href="${esc(siteUrl(o))}" target="_blank" rel="noopener">${esc(siteUrl(o))}</a></p>
  <p class="mini">Konten berstatus Terbit dan bertanda “Web” untuk unit ini tampil di alamat tersebut.</p></div>
  <div class="sec">Profil unit (tampil di website)</div><div class="card">
  <label for="p1">Deskripsi singkat</label><textarea id="p1" rows="4">${esc(o.deskripsi || "")}</textarea>
  ${fld("Alamat sekretariat / tempat latihan", "p2", o.alamat || "")}${fld("Jadwal latihan", "p3", o.jadwal_latihan || "")}${fld("Nama ketua", "p4", o.ketua_nama || "")}${fld("Nama sekretaris", "p6", o.sekretaris_nama || "")}${fld("Kontak WhatsApp (mis. 62812xxxx)", "p5", o.kontak_wa || "")}
  <div class="btns"><button class="pri" data-act="org-save">Simpan profil</button></div></div>
  <div class="sec">Tanda tangan digital (dipakai pada SK yang Anda terbitkan)</div><div class="card"><p class="mini">Unggah gambar tanda tangan (PNG/JPG, latar putih atau transparan). Hanya admin unit ini yang dapat melihatnya.</p>
  ${["ketua", "sekretaris"].map((k) => `<div style="display:flex;align-items:center;gap:12px;margin:8px 0"><b style="min-width:100px">${k === "ketua" ? "Ketua" : "Sekretaris"}</b>${S.sig[k] ? `<img src="${S.sig[k]}" alt="" style="height:48px;background:#fff;border:1px solid var(--line);border-radius:6px">` : '<span class="mini">Belum ada</span>'}${btn("sig-up", k, S.sig[k] ? "Ganti" : "Unggah")}</div>`).join("")}</div>
  <div class="sec">Website unit di bawah Anda</div>` +
  tbl(["Unit", "Tingkat", "Alamat"], units.map((id) => `<tr><td>${esc(orgName(id))}</td><td>${TNG[S.orgs[id].tingkat]}</td><td>${S.orgs[id].url_path != null ? `<a href="${esc(siteUrl(S.orgs[id]))}" target="_blank" rel="noopener">/${esc(S.orgs[id].url_path)}</a>` : "–"}</td></tr>`).join(""), "");
}
async function orgSave() {
  const data = { deskripsi: val("p1"), alamat: val("p2"), jadwal_latihan: val("p3"), ketua_nama: val("p4"), sekretaris_nama: val("p6"), kontak_wa: val("p5").replace(/[^\d]/g, "") };
  try { await updateDoc(doc(db, "organizations", S.me.org_id), { ...data, updated_at: serverTimestamp() }); Object.assign(S.orgs[S.me.org_id], data); toast("Profil unit disimpan."); } catch (e) { fail(e); }
}

/* ---------- role & menu ---------- */
const parseFields = (txt) => txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => {
  const [label, type = "teks", opts = ""] = l.split("|").map((s) => s.trim()), tp = ["teks", "angka", "pilihan"].includes(type) ? type : "teks";
  return { key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "f" + i, label, type: tp, options: tp === "pilihan" ? opts.split(",").map((s) => s.trim()).filter(Boolean) : [] };
});
const fieldsToText = (fs) => (fs || []).map((f) => `${f.label} | ${f.type}${f.type === "pilihan" ? " | " + (f.options || []).join(", ") : ""}`).join("\n");

function roleView() {
  const below = Object.keys(LV).filter((r) => r !== "member" && LV[r] > LV[S.me.role]);
  const cfg = (r) => S.cfgOwn.find((x) => x.role === r);
  const types = S.types.filter((t) => S.me.path.includes(t.org_id));
  $("#view").innerHTML = `<div class="sec" style="margin-top:0">Menu per role di ${esc(orgName(S.me.org_id))}</div>
  <p class="mute">Atur menu CMS yang tampil untuk role di bawah jabatan Anda. Pengaturan unit yang lebih dekat dengan pengurus tersebut diutamakan. Ini mengatur tampilan; hak akses data tetap dijaga aturan Firestore.</p>` +
  (below.length ? tbl(["Role", "Menu yang tampil", "Pengaturan", ""], below.map((r) => { const c = cfg(r), m = c ? c.menus : defMenus(r);
    return `<tr><td>${RL[r]}</td><td>${MENUS.filter((x) => m.includes(x[0]) || x[0] === "dasbor").map((x) => x[1]).join(", ")}</td><td><span class="pill ${c ? "role" : ""}">${c ? "Disesuaikan" : "Bawaan"}</span></td>
    <td><div class="act">${btn("menu-edit", r, "Atur menu")}${c ? btn("menu-reset", r, "Kembalikan bawaan", "bad") : ""}</div></td></tr>`; }).join(""), "") : '<p class="empty card">Tidak ada role di bawah jabatan Anda.</p>') +
  `<div class="sec">Tipe role khusus</div><p class="mute">Kualifikasi seperti Pelatih, PASTI, dan Anggota Tetap. Tiap tipe dapat punya isian tambahan, verifikasi internal/IPSI, tingkat minimal admin pemberi, dan prasyarat tipe lain.</p>
  <div class="bar"><button class="pri" data-act="type-add">Tambah tipe role</button></div>` +
  tbl(["Tipe", "Isian tambahan", "Verifikasi", "Pemberi minimal", "Prasyarat", "Pemilik", ""], types.map((t) => `<tr><td>${esc(t.nama)}</td><td>${(t.fields || []).map((f) => esc(f.label)).join(", ") || "–"}</td>
    <td>${[t.butuh_internal ? "Internal" : "", t.butuh_ipsi ? "IPSI (jenjang)" : ""].filter(Boolean).join(" + ") || "–"}</td><td>${TNG[t.min_pemberi || "ranting"]}</td><td>${esc(S.types.find((x) => x.id === t.prasyarat)?.nama || "–")}</td><td>${esc(orgName(t.org_id))}</td>
    <td>${t.org_id === S.me.org_id ? `<div class="act">${btn("type-edit", t.id, "Edit")}${btn("type-del", t.id, "Hapus", "bad")}</div>` : '<span class="mini">Dari unit atas</span>'}</td></tr>`).join(""), "Belum ada tipe role.");
}
function menuForm(r) {
  const mine = myMenus().filter((m) => m[0] !== "dasbor"), c = S.cfgOwn.find((x) => x.role === r), cur = c ? c.menus : defMenus(r);
  modal(`Menu untuk ${RL[r]}`, `<p class="mini">Dashboard selalu tampil. Anda hanya dapat memberikan menu yang Anda miliki.</p>` +
    mine.map(([k, l]) => `<label class="cb"><input type="checkbox" id="mn_${k}" ${cur.includes(k) ? "checked" : ""}>${l}</label>`).join(""),
    async () => {
      const menus = ["dasbor", ...mine.filter(([k]) => $("#mn_" + k).checked).map(([k]) => k)];
      await setDoc(doc(db, "role_menus", `${S.me.org_id}__${r}`), { org_id: S.me.org_id, role: r, menus, updated_by: S.me.uid, updated_at: serverTimestamp() });
      toast("Pengaturan menu disimpan.");
    });
}
function typeForm(id) {
  const t = S.types.find((x) => x.id === id);
  modal(id ? "Edit tipe role" : "Tambah tipe role", fld("Nama tipe", "t1", t?.nama || "") +
    sel("Admin pemberi minimal (tingkat)", "t2", Object.entries(TNG), t?.min_pemberi || "ranting") +
    sel("Prasyarat (harus sudah memiliki tipe ini)", "t5", [["", "Tidak ada"], ...S.types.filter((x) => x.id !== id && S.me.path.includes(x.org_id)).map((x) => [x.id, x.nama])], t?.prasyarat || "") +
    `<label class="cb"><input type="checkbox" id="t3" ${t?.butuh_internal ? "checked" : ""}>Perlu verifikasi internal</label>
     <label class="cb"><input type="checkbox" id="t4" ${t?.butuh_ipsi ? "checked" : ""}>Perlu verifikasi IPSI (jenjang Kabupaten/Provinsi/Nasional)</label>
     <label for="t6">Isian tambahan (satu per baris: Label | teks/angka/pilihan | opsi dipisah koma)</label><textarea id="t6" rows="5" placeholder="Nomor Anggota PASTI | teks&#10;Jenjang | pilihan | Pratama, Madya">${esc(fieldsToText(t?.fields))}</textarea>`,
    async () => {
      const nama = val("t1");
      if (!nama || nama.length > 60) { toast("Nama wajib diisi (maksimal 60 karakter)."); return false; }
      const data = { nama, min_pemberi: $("#t2").value, prasyarat: $("#t5").value, butuh_internal: $("#t3").checked, butuh_ipsi: $("#t4").checked, fields: parseFields($("#t6").value), org_id: S.me.org_id };
      if (id) await updateDoc(doc(db, "role_types", id), data); else await addDoc(collection(db, "role_types"), { ...data, created_by: S.me.uid });
      toast("Tipe role disimpan.");
    });
}

/* ---------- audit ---------- */
function audit() {
  $("#view").innerHTML = tbl(["Waktu", "Pelaku", "Target", "Perubahan"], S.audit.map((a) => `<tr><td>${fmt(a.timestamp)}</td><td>${esc(a.pelaku_nama || a.pelaku_uid)}</td><td>${esc(a.target_nama || a.target_uid)}</td><td>${RL[a.role_lama] || a.role_lama || "–"} → <b>${RL[a.role_baru] || a.role_baru}</b></td></tr>`).join(""), "Belum ada perubahan role.");
}

/* ---------- aksi tombol ---------- */
const run = (p) => p.catch(fail);
const ACT = {
  "post-add": () => postForm(), "post-edit": (id) => postForm(id),
  "post-toggle": (id) => { const x = S.posts.find((p) => p.id === id), st = x.status === "published" ? "draft" : "published"; run(updateDoc(doc(db, "posts", id), { status: st }).then(() => toast(st === "published" ? "Konten diterbitkan." : "Konten ditarik ke draf."))); },
  "post-web": (id) => { const x = S.posts.find((p) => p.id === id); run(updateDoc(doc(db, "posts", id), { publik: !x.publik }).then(() => toast(x.publik ? "Konten disembunyikan dari website." : "Konten tampil di website publik."))); },
  "post-del": (id) => { if (confirm("Hapus konten ini?")) run(deleteDoc(doc(db, "posts", id)).then(() => toast("Konten dihapus."))); },
  "cat-add": () => catForm(), "cat-edit": (id) => catForm(id),
  "cat-del": (id) => { if (confirm("Hapus kategori ini? Konten lama tetap ada tanpa kategori ini.")) run(deleteDoc(doc(db, "post_categories", id)).then(() => toast("Kategori dihapus."))); },
  "mem-add": () => memberForm(), "mem-edit": (id) => memberForm(id),
  "mem-q": (id) => qualModal(S.users.find((u) => u.id === id)),
  "mem-role": (id) => changeRoleForm(S.users.find((u) => u.id === id)),
  "mem-act": (id) => { const u = S.users.find((x) => x.id === id), on = u.status_aktif === false; if (confirm(`${on ? "Aktifkan" : "Nonaktifkan"} ${u.nama_lengkap}?`)) run(updateDoc(doc(db, "users", id), { status_aktif: on, updated_at: serverTimestamp() }).then(() => toast(on ? "Anggota diaktifkan." : "Anggota dinonaktifkan."))); },
  "ukt-add": () => uktForm(), "ukt-ok": (id) => uktApprove(id),
  "ukt-rev": (id) => { const c = prompt("Catatan revisi untuk peserta:"); if (c) { const x = S.ukt.find((u) => u.id === id); uktUpdate(id, { status_verifikasi: "revisi", catatan_revisi: c, riwayat: [...(x.riwayat || []), hist("revisi", c)] }, "Permintaan revisi dikirim."); } },
  "ukt-again": (id) => { const x = S.ukt.find((u) => u.id === id); uktUpdate(id, { status_verifikasi: "pending", riwayat: [...(x.riwayat || []), hist("pending", "Diajukan ulang")] }, "Pengajuan dikirim ulang."); },
  "ukt-batch": () => uktBatch(),
  "ukt-back": (id) => { const c = prompt("Catatan untuk PAC:"); if (c) { const x = S.ukt.find((u) => u.id === id); uktUpdate(id, { status_verifikasi: "disetujui_pac", catatan_revisi: c, riwayat: [...(x.riwayat || []), hist("disetujui_pac", "Dikembalikan: " + c)] }, "Dikembalikan ke PAC."); } },
  "sk-add": () => skForm(), "sk-edit": (id) => skForm(id), "sk-view": (id) => skDetail(S.sk.find((x) => x.id === id)),
  "sk-fwd": (id) => { const x = S.sk.find((r) => r.id === id); skUpdate(x, { status: "diteruskan", catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("diteruskan")] }, `Diteruskan ke ${orgName(x.issuer_id)}.`); },
  "sk-rev": (id) => { const c = prompt("Catatan revisi untuk pemohon:"); if (c) { const x = S.sk.find((r) => r.id === id); skUpdate(x, { status: "revisi", catatan_revisi: c, riwayat: [...(x.riwayat || []), hist("revisi", c)] }, "Permintaan revisi dikirim."); } },
  "sk-issue": (id) => skIssue(S.sk.find((x) => x.id === id)),
  "sk-del": (id) => { if (confirm("Batalkan pengajuan SK ini?")) run(deleteDoc(doc(db, "sk_requests", id)).then(() => toast("Pengajuan dibatalkan."))); },
  "sk-file": (id) => { const x = S.sk.find((r) => r.id === id); downloadFile("sk_requests", id, x.file); },
  "sk-tpl-up": (j) => skTplUp(j), "sk-tpl-get": (id) => downloadFile("sk_templates", id),
  "sk-tpl-del": (id) => { if (confirm("Hapus template ini?")) run(deleteFile("sk_templates", id).then(() => toast("Template dihapus."))); },
  "cnt-edit": (l) => cntForm(l),
  "sk-cnt": () => skCnt(), "sig-up": (k) => sigForm(k),
  "pl-add": () => plForm(curProg()), "pl-pay": () => plPay(curProg()),
  "wj-rek": (id) => wjRek(id), "rek-cnt": () => rekCntForm(),
  "wj-file": (id) => { const x = S.pls.find((r) => r.id === id); downloadFile("pelatihan_registrations", id, x.rekomendasi.file); },
  "pl-ok": (id) => { const x = S.pls.find((r) => r.id === id); plUpd(id, { status: "diverifikasi_pac", catatan_revisi: "", riwayat: [...(x.riwayat || []), hist("diverifikasi_pac")] }, "Peserta diverifikasi."); },
  "pl-rev": (id) => { const c = prompt("Catatan revisi untuk pendaftar:"); if (c) { const x = S.pls.find((r) => r.id === id); plUpd(id, { status: "revisi", catatan_revisi: c, riwayat: [...(x.riwayat || []), hist("revisi", c)] }, "Permintaan revisi dikirim."); } },
  "pl-again": (id) => { const x = S.pls.find((r) => r.id === id); plUpd(id, { status: "diajukan", riwayat: [...(x.riwayat || []), hist("diajukan", "Diajukan ulang")] }, "Pendaftaran dikirim ulang."); },
  "pl-proof": (id) => { const p = S.plp.find((x) => x.id === id); viewFile("pelatihan_payments", id, p.bukti); },
  "pl-payok": (id) => plPayVerify(id, true), "pl-payno": (id) => plPayVerify(id, false),
  "acct-add-rekening": () => acctForm("", "rekening"), "acct-add-qris": () => acctForm("", "qris"), "acct-edit": (id) => acctForm(id),
  "acct-del": (id) => { if (confirm("Hapus rekening/QRIS ini?")) run(deleteDoc(doc(db, "payment_accounts", id)).then(() => toast("Dihapus."))); },
  "biaya-edit": () => biayaForm(),
  "cert-png": (id) => certDownload(id, "png"), "cert-pdf": (id) => certDownload(id, "pdf"),
  "tpl-edit": (l) => tplForm(l),
  "tpl-del": (l) => { if (confirm(`Hapus desain sertifikat ${l}?`)) run(deleteDoc(doc(db, "ukt_templates", `${S.me.org_id}__${l}`)).then(() => toast("Desain dihapus."))); },
  "kas-add": () => kasForm(), "kas-edit": (id) => kasForm(id),
  "kas-del": (id) => { if (confirm("Hapus catatan kas ini?")) run(deleteDoc(doc(db, "financial_reports", id)).then(() => toast("Catatan dihapus."))); },
  "don-add": () => donForm(), "don-ok": (id) => donAccept(id),
  "don-no": (id) => run(updateDoc(doc(db, "unit_donations", id), { status: "ditolak", updated_at: serverTimestamp() }).then(() => toast("Donasi ditolak."))),
  "don-cancel": (id) => { if (confirm("Batalkan donasi ini?")) run(deleteDoc(doc(db, "unit_donations", id)).then(() => toast("Donasi dibatalkan."))); },
  "org-save": () => orgSave(),
  "menu-edit": (r) => menuForm(r),
  "menu-reset": (r) => run(deleteDoc(doc(db, "role_menus", `${S.me.org_id}__${r}`)).then(() => toast("Dikembalikan ke menu bawaan."))),
  "type-add": () => typeForm(), "type-edit": (id) => typeForm(id),
  "type-del": (id) => { if (confirm("Hapus tipe role ini?")) run(deleteDoc(doc(db, "role_types", id)).then(() => toast("Tipe role dihapus."))); },
};
