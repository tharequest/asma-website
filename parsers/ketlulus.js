// ================================================
// PARSER: ket_lulus
// Surat Keterangan Lulus
//
// Struktur PDF:
//   nama : Carlos Aprillio Angger Gindaong
//   NIM  : H1051201083          ← pakai "NIM", bukan "nomor induk mahasiswa"
//   tempat dan tanggal lahir : ...
//   program studi : ...
//
// ✅ Hanya ada SATU field "nama" (tidak ada nama pejabat terpisah)
// ================================================

import { cleanText, formatNama } from "./utils.js";

export function extract(text) {
  const clean = cleanText(text);

  // ── NAMA ──────────────────────────────────────
  let nama = "";
  const namaMatch = clean.match(/^nama\s*:\s*(.+)/im);
  if (namaMatch) {
    nama = namaMatch[1].split("\n")[0].trim();
  }

  // ── NIM ───────────────────────────────────────
  // Pakai \bNIM\b agar tidak menangkap kata lain yang mengandung "nim"
  let nim = "";
  const nimMatch = clean.match(/\bNIM\s*:\s*([A-Z0-9]+)/i);
  if (nimMatch) nim = nimMatch[1].trim().toUpperCase();

  return { nama: formatNama(nama), nim };
}
