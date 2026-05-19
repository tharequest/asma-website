// ================================================
// PARSER: pindah_kuliah
// Surat Persetujuan Pindah Kuliah
//
// Struktur PDF:
//   Berdasarkan permohonan pindah kuliah yang disampaikan oleh,
//   nama                   : Rimi Kartika
//   nomor induk mahasiswa  : H1041241013
//   jurusan/program studi  : Biologi/ Biologi
//   tempat/tanggal lahir   : Gombang, 1 April 2007
//   alamat                 : ...
//
// ✅ Hanya ada SATU field "nama"
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
