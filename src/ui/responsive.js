// Daftar data responsif: tabel di layar lebar, kartu vertikal di layar HP (diatur CSS di responsive.css).
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// 1) Untuk tabel yang sudah dirender: beri label tiap sel dari judul kolomnya.
//    Dipanggil setelah setiap render halaman, jadi semua tabel di CMS otomatis menjadi kartu di HP.
export function enhanceTables(root = document) {
  root.querySelectorAll(".tw table").forEach((t) => {
    t.classList.add("rt");
    const rows = [...t.querySelectorAll("tr")], head = rows[0];
    if (!head || !head.querySelector("th")) return;
    head.classList.add("rh");
    const labels = [...head.children].map((th) => th.textContent.trim());
    rows.slice(1).forEach((tr) => [...tr.children].forEach((td, i) => {
      if (td.colSpan > 1) td.classList.add("empty"); else td.dataset.label = labels[i] ?? "";
    }));
  });
}

// 2) Untuk tampilan baru: render langsung dari definisi kolom.
//    columns: [{ label: "Nama", render: (row) => "<b>…</b>" }, { label: "", render: (row) => "<button>…</button>" }]
export function renderList({ columns, rows, empty = "Tidak ada data." }) {
  const head = `<tr class="rh">${columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>`;
  const body = rows.length
    ? rows.map((r) => `<tr>${columns.map((c) => `<td data-label="${esc(c.label)}">${c.render(r)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length}" class="empty">${esc(empty)}</td></tr>`;
  return `<div class="tw"><table class="rt">${head}${body}</table></div>`;
}
