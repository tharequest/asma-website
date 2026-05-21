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
  // Pola 1: ada singkatan dalam kurung → (HIMABIO) Fakultas, (MSI) Fakultas, dll.
  // Pola 2: tidak ada kurung → "Art Laboratory Fakultas" — tangkap kata sebelum Fakultas.
  //   Dibatasi ke max 5 kata agar tidak tangkap kalimat panjang.
  let nama_himpunan = "";
  const namaMatch =
    clean.match(/\(([^)]+)\)\s*Fakultas/i) ||
    clean.match(/memberikan izin kepada\s+((?:\S+\s+){0,4}\S+?)\s*Fakultas/i);
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