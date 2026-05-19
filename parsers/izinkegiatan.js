// ================================================
// PARSER: izin_kegiatan
// Surat Perizinan Kegiatan
//
// Struktur PDF:
//   "...memberikan izin kepada Himpunan Mahasiswa Biologi (HIMABIO) Fakultas..."
//   hari/tanggal : Sabtu, 9 Mei 2026
//   pukul        : 07.00 - 12.35 WIB
//   tempat       : Lapangan Gedung Olahraga Universitas Tanjungpura
//
// Data yang diambil:
//   nama_himpunan → singkatan di dalam kurung ( )
//   hari_tanggal  → nilai setelah "hari/tanggal :"
//   tempat        → nilai setelah "tempat :"
// ================================================

import { cleanText } from "./utils.js";

export function extract(text) {
  const clean = cleanText(text);

  // ── NAMA HIMPUNAN ─────────────────────────────
  // Ambil singkatan dalam kurung PERTAMA setelah "memberikan izin kepada"
  // dan sebelum kata "Fakultas" — dijamin tidak salah tangkap singkatan kegiatan.
  //
  // Catatan: pdf-parse (npm) kadang tidak menambahkan spasi antara ")"
  // dan "Fakultas" saat ekstraksi teks PDF, sehingga "\s+" gagal match.
  // Solusi: gunakan "\s*" (opsional) + fallback [\s\S]{0,30}? untuk kasus ekstrem.
  let nama_himpunan = "";
  const namaMatch =
    clean.match(/memberikan izin kepada\s+[^(]+\(([^)]+)\)\s*Fakultas/i) ||
    clean.match(/memberikan izin kepada[^(]+\(([^)]+)\)[\s\S]{0,30}?Fakultas/i);
  if (namaMatch) {
    nama_himpunan = namaMatch[1].trim();
  }

  // ── HARI / TANGGAL ────────────────────────────
  let hari_tanggal = "";
  const hariMatch = clean.match(/hari\/tanggal[\s]*:[\s]*([^\n]+)/i);
  if (hariMatch) {
    hari_tanggal = hariMatch[1].trim();
  }

  // ── TEMPAT ────────────────────────────────────
  let tempat = "";
  const tempatMatch = clean.match(/tempat[\s]*:[\s]*([^\n]+)/i);
  if (tempatMatch) {
    tempat = tempatMatch[1].trim();
  }

  return { nama_himpunan, hari_tanggal, tempat };
}