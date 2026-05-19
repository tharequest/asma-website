// ================================================
// PARSER: undur_diri
// Surat Pengunduran Diri
//
// Struktur PDF:
//   berdasarkan permohonan pengunduran diri yang disampaikan oleh,
//   nama                   : Muhammad Fadhil Hermansyah
//   nomor induk mahasiswa  : H1031251064
//   jurusan/prodi          : Kimia / Kimia
//   tempat/tanggal lahir   : Pontianak, 04 Desember 2007
//   alamat                 : ...
//
// ✅ Hanya ada SATU field "nama" (tidak ada nama pejabat terpisah)
// ================================================

import { cleanText, formatNama } from "./utils.js";

export function extract(text) {
  const clean = cleanText(text);

  // ── NAMA ──────────────────────────────────────
  let nama = "";
  const namaMatch = clean.match(/nama\s*:\s*(.+)/i);
  if (namaMatch) {
    nama = namaMatch[1].split("\n")[0].trim();
  }

  // ── NIM ───────────────────────────────────────
  let nim = "";
  const nimMatch = clean.match(/nomor induk mahasiswa\s*:\s*([A-Z0-9]+)/i);
  if (nimMatch) nim = nimMatch[1].trim().toUpperCase();

  return { nama: formatNama(nama), nim };
}
