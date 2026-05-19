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
  // Cari singkatan dalam kurung yang langsung diikuti kata "Fakultas".
  // Pola ini berlaku untuk semua himpunan: (HIMABIO), (HIMAFIS), (HIMASTA), (MSI), dll.
  // Nomor telepon (0561) tidak ikut karena tidak diikuti "Fakultas".
  // Singkatan kegiatan seperti (SIGMA) juga aman karena diikuti "yang", bukan "Fakultas".
  let nama_himpunan = "";
  const namaMatch = clean.match(/\(([^)]+)\)\s*Fakultas/i);
  if (namaMatch) {
    nama_himpunan = namaMatch[1].trim();
  }

  // ── PUKUL ─────────────────────────────────────
  let pukul = "";
  const pukulMatch = clean.match(/pukul[\s]*:[\s]*([^\n]+)/i);
  if (pukulMatch) {
    pukul = pukulMatch[1].trim();
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

  return { nama_himpunan, hari_tanggal, pukul, tempat };
}