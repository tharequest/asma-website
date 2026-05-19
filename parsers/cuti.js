// ================================================
// PARSER: cuti_kuliah
// Surat Keterangan Cuti Akademik
//
// Struktur PDF (kapital berbeda dari surat lain):
//   Nama                   : Lusianna Siregar
//   Nomor Induk Mahasiswa  : H1081231017     ← huruf kapital semua
//   Jurusan                : Ilmu Kelautan
//   Program Studi          : Ilmu Kelautan
//   Periode yang di izinkan: Semester genap 2025/2026
//
// ✅ Tidak ada field "nama" pejabat, langsung daftar mahasiswa
// ================================================

import { cleanText, formatNama } from "./utils.js";

export function extract(text) {
  const clean = cleanText(text);

  // ── NAMA ──────────────────────────────────────
  // "Nama" dengan huruf kapital (berbeda dengan surat lain)
  let nama = "";
  const namaMatch = clean.match(/^Nama\s*:\s*(.+)/m);
  if (namaMatch) {
    nama = namaMatch[1].split("\n")[0].trim();
  } else {
    // Fallback case-insensitive jika format berubah
    const fallback = clean.match(/nama\s*:\s*(.+)/i);
    if (fallback) nama = fallback[1].split("\n")[0].trim();
  }

  // ── NIM ───────────────────────────────────────
  // "Nomor Induk Mahasiswa" dengan huruf kapital
  let nim = "";
  const nimMatch = clean.match(/Nomor Induk Mahasiswa\s*:\s*([A-Z0-9]+)/i);
  if (nimMatch) nim = nimMatch[1].trim().toUpperCase();

  return { nama: formatNama(nama), nim };
}
