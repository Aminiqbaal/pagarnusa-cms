// Website publik per unit: /jawatimur/gresik/manyar/suci  (root "/" = Pimpinan Pusat)
import "./site.css";
import { collection, query, where, getDocs, getDoc, doc, documentId, limit } from "firebase/firestore";
import { db } from "./firebase.js";
import { mountApkButton } from "./components/download-apk.js";

const TNG = { pusat: "Pimpinan Pusat", wilayah: "Pimpinan Wilayah", cabang: "Pimpinan Cabang", pac: "Pimpinan Anak Cabang", rayon: "Pimpinan Rayon", ranting: "Pimpinan Ranting" };
const $app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const href = (o) => "/" + (o.url_path || "");
const date = (t) => (t?.toDate ? t.toDate().toLocaleDateString("id-ID", { dateStyle: "long" }) : "");
const time = (t) => (t?.toDate ? t.toDate().getTime() : 0);
const paras = (txt) => String(txt || "").split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const excerpt = (t) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s.length > 170 ? s.slice(0, 167) + "…" : s; };
const docs = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
const pubQ = (orgId, n) => query(collection(db, "posts"), where("target_org_id", "==", orgId), where("status", "==", "published"), where("publik", "==", true), limit(n));

function page(org, crumbs, tab, body) {
  document.title = `${org.nama_unit} – Pagar Nusa`;
  $app.innerHTML = `<header class="hd"><div class="wrap">
    <div class="crumbs">${crumbs.map((c) => `<a href="${href(c)}">${esc(c.nama_unit)}</a>`).join(" › ")}</div>
    <h1>${esc(org.nama_unit)}</h1><span class="tag">${TNG[org.tingkat] || ""}</span></div></header>
  <main class="wrap"><nav class="tabs">
    <a href="${href(org)}" class="${tab === "home" ? "on" : ""}">Beranda</a>
    <a href="${href(org)}?v=profil" class="${tab === "profil" ? "on" : ""}">Profil</a>
    <a href="${href(org)}?v=unit" class="${tab === "unit" ? "on" : ""}">Unit di bawah</a></nav>${body}</main>
  <footer><div class="wrap">Pagar Nusa · ${esc(org.nama_unit)}<div id="apk"></div></div></footer>`;
  mountApkButton(document.getElementById("apk"), { compact: true });
}
function notFound() {
  document.title = "Halaman tidak ditemukan";
  $app.innerHTML = `<main class="wrap"><div class="card" style="margin-top:12vh"><h2 class="sec" style="margin-top:0">Halaman tidak ditemukan</h2><p class="meta">Alamat unit yang Anda tuju tidak tersedia.</p><p><a href="/">Ke beranda Pagar Nusa</a></p></div></main>`;
}
const card = (p, org) => `<a class="card post" href="${href(org)}?p=${p.id}"><span class="meta">${date(p.created_at)}${p.kategori_nama ? ` · <span class="pill">${esc(p.kategori_nama)}</span>` : ""}</span>
  <h3>${esc(p.judul)}</h3><p class="excerpt">${esc(excerpt(p.konten_html))}</p></a>`;

async function main() {
  const path = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, "").toLowerCase();
  const qs = new URLSearchParams(location.search);
  $app.innerHTML = '<p class="wrap empty">Memuat…</p>';
  let org;
  try {
    const s = await getDocs(query(collection(db, "organizations"), where("url_path", "==", path), limit(1)));
    if (s.empty) return notFound();
    org = { id: s.docs[0].id, ...s.docs[0].data() };
  } catch { return notFound(); }
  const ids = org.hierarki_path || [org.id];
  const ancSnap = ids.length > 1 ? await getDocs(query(collection(db, "organizations"), where(documentId(), "in", ids.slice(0, 10)))) : null;
  const byId = Object.fromEntries((ancSnap ? docs(ancSnap) : []).map((o) => [o.id, o]));
  const crumbs = ids.filter((i) => i !== org.id).map((i) => byId[i]).filter(Boolean);

  if (qs.get("p")) {
    const d = await getDoc(doc(db, "posts", qs.get("p"))).catch(() => null);
    const p = d?.exists() ? d.data() : null;
    if (!p || p.status !== "published" || !p.publik) return page(org, crumbs, "home", `<div class="card"><p>Tulisan tidak ditemukan.</p><a href="${href(org)}">Kembali</a></div>`);
    document.title = `${p.judul} – ${org.nama_unit}`;
    return page(org, crumbs, "home", `<article class="card art"><span class="meta">${date(p.created_at)} · ${esc(orgFrom(p, byId, org))}${p.kategori_nama ? ` · <span class="pill">${esc(p.kategori_nama)}</span>` : ""}</span>
      <h1>${esc(p.judul)}</h1>${paras(p.konten_html)}<p class="meta">Ditulis oleh ${esc(p.author_nama || "pengurus")}</p></article><p><a href="${href(org)}">← Kembali ke ${esc(org.nama_unit)}</a></p>`);
  }

  if (qs.get("v") === "profil") {
    const rows = [["Alamat", org.alamat], ["Jadwal latihan", org.jadwal_latihan], ["Ketua", org.ketua_nama]].filter((r) => r[1]);
    const wa = String(org.kontak_wa || "").replace(/\D/g, "");
    return page(org, crumbs, "profil", `<div class="card">${org.deskripsi ? paras(org.deskripsi) : '<p class="meta">Profil unit belum diisi.</p>'}
      <dl class="info">${rows.map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}${wa ? `<dt>Kontak</dt><dd><a href="https://wa.me/${wa}" rel="noopener">WhatsApp ${esc(wa)}</a></dd>` : ""}</dl></div>`);
  }

  if (qs.get("v") === "unit") {
    const kids = docs(await getDocs(query(collection(db, "organizations"), where("parent_id", "==", org.id)))).sort((a, b) => a.nama_unit.localeCompare(b.nama_unit));
    return page(org, crumbs, "unit", kids.length ? `<div class="kids">${kids.map((k) => `<a href="${href(k)}">${esc(k.nama_unit)}<small>${TNG[k.tingkat] || ""}</small></a>`).join("")}</div>` : '<p class="empty">Belum ada unit di bawah.</p>');
  }

  const own = docs(await getDocs(pubQ(org.id, 50))).sort((a, b) => time(b.created_at) - time(a.created_at));
  const above = (await Promise.all(ids.filter((i) => i !== org.id).map((i) => getDocs(pubQ(i, 10)).then(docs).catch(() => []))))
    .flat().sort((a, b) => time(b.created_at) - time(a.created_at)).slice(0, 8);
  page(org, crumbs, "home", `${org.deskripsi ? `<div class="card">${paras(excerpt(org.deskripsi))}</div>` : ""}
    <h2 class="sec">Kabar terbaru</h2>${own.length ? own.map((p) => card(p, org)).join("") : '<p class="empty">Belum ada tulisan.</p>'}
    ${above.length ? `<h2 class="sec">Dari pimpinan di atas</h2>${above.map((p) => card(p, org)).join("")}` : ""}`);
}
const orgFrom = (p, byId, org) => (byId[p.target_org_id]?.nama_unit) || org.nama_unit;
main().catch(() => notFound());
