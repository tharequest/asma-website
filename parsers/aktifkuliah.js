// ================================================
// PARSER: aktif_kuliah
// Surat Keterangan Aktif Kuliah / Surat Keterangan
//
// ⚠️  PDF ini punya DUA field "nama":
//     1. nama pejabat penandatangan (atas)
//     2. nama mahasiswa (bawah, setelah "dengan ini menerangkan bahwa")
//
// Solusi: ambil nama dari section setelah kalimat "menerangkan bahwa"
// NIM   : "nomor induk mahasiswa : H104..."
// ================================================

import { cleanText, formatNama } from "./utils.js";

export function extract(text) {
  const clean = cleanText(text);

  // ── NAMA ──────────────────────────────────────
  // Cari section setelah "dengan ini menerangkan bahwa"
  // agar tidak salah ambil nama pejabat di bagian atas
  let nama = "";
  const sectionMatch = clean.match(
    /dengan ini menerangkan bahwa[,.\s]+([\s\S]+)/i
  );
  if (sectionMatch) {
    const section = sectionMatch[1];
    const namaMatch = section.match(/nama\s*:\s*(.+)/i);
    if (namaMatch) {
      nama = namaMatch[1].split("\n")[0].trim();
    }
  }

  // ── NIM ───────────────────────────────────────
  let nim = "";
  const nimMatch = clean.match(/nomor induk mahasiswa\s*:\s*([A-Z0-9]+)/i);
  if (nimMatch) nim = nimMatch[1].trim().toUpperCase();

  // ── KEPERLUAN ─────────────────────────────────
  // Ambil tujuan surat dari "untuk melengkapi persyaratan ..."
  // Normalize whitespace dulu karena pdf-parse sering sisipkan newline
  // di tengah kalimat saat word-wrap, sehingga (.+?) gagal melewatinya.
  let keperluan = "";
  const cleanOneLine = clean.replace(/\s+/g, " ");
  const keperluanMatch = cleanOneLine.match(
    /(?:untuk melengkapi persyaratan|untuk keperluan)\s+(.+?)\./i
  );
  if (keperluanMatch) {
    keperluan = keperluanMatch[1].trim();
  }

  return { nama: formatNama(nama), nim, keperluan };
}