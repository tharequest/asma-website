// ================================================
// UTILS — Helper bersama untuk semua parser
// ================================================

export function toProperCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function fixNamaSpacing(nama) {
  nama = nama.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (!nama.includes(" ")) {
    nama = nama.replace(/([a-z]{4,})(?=[a-z]{4,})/gi, "$1 ");
  }
  return nama;
}

export function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/Dokumen ini telah.*?BSrE\./is, "")
    .trim();
}

export function formatNama(nama) {
  return toProperCase(fixNamaSpacing(nama.replace(/\d+/g, "").trim()));
}
