import { google } from "googleapis";
import pdfParse from "pdf-parse";
import { Readable } from "stream";

// ── Import semua parser ────────────────────────
import { extract as extractAktifKuliah }  from "../parsers/aktifkuliah.js";
import { extract as extractKetLulus }     from "../parsers/ketlulus.js";
import { extract as extractCuti }         from "../parsers/cuti.js";
import { extract as extractUndurDiri }    from "../parsers/undirdiri.js";
import { extract as extractPindahKuliah } from "../parsers/pindahkuliah.js";
import { extract as extractIzinKegiatan } from "../parsers/izinkegiatan.js";

// ── Konstanta ──────────────────────────────────
const JENIS_WITH_YEAR   = ["cuti_kuliah", "undur_diri", "pindah_kuliah"];
const JENIS_KEGIATAN    = ["izin_kegiatan"];

export const config = {
  api: { bodyParser: false }
};

// ── Router parser ──────────────────────────────
const PARSER_MAP = {
  aktif_kuliah:  extractAktifKuliah,
  ket_lulus:     extractKetLulus,
  cuti_kuliah:   extractCuti,
  undur_diri:    extractUndurDiri,
  pindah_kuliah: extractPindahKuliah,
  izin_kegiatan: extractIzinKegiatan,
};

// ── Util: baca buffer dari request ────────────
function bufferFromReq(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ── Util: Google Auth ──────────────────────────
function getAuth(scopes) {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  return new google.auth.JWT(sa.client_email, null, sa.private_key, scopes);
}

// ── Util: Drive folder per jenis ──────────────
function getDriveFolder(jenis) {
  const map = JSON.parse(process.env.GOOGLE_DRIVE_FOLDER_MAP || "{}");
  return map[jenis] || map.aktif_kuliah;
}

// ── Main Handler ───────────────────────────────
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false });
    }

    const jenis = req.query?.jenis || "aktif_kuliah";
    const tahun = JENIS_WITH_YEAR.includes(jenis) ? (req.query?.tahun || "") : "";

    // Validasi jenis
    if (!PARSER_MAP[jenis]) {
      return res.status(400).json({ success: false, error: `Jenis tidak dikenal: ${jenis}` });
    }

    // Parse PDF
    const buffer = await bufferFromReq(req);
    const { text } = await pdfParse(buffer);

    // Jalankan parser sesuai jenis
    const parser = PARSER_MAP[jenis];
    const parsed = parser(text);

    // ── CABANG: IZIN KEGIATAN ──────────────────
    if (JENIS_KEGIATAN.includes(jenis)) {
      const { nama_himpunan, hari_tanggal, tempat } = parsed;

      console.log("[izin_kegiatan] Extracted:", { nama_himpunan, hari_tanggal, tempat });

      if (!nama_himpunan || !hari_tanggal || !tempat) {
        return res.json({
          success: false,
          error: `Tidak terbaca: himpunan=${nama_himpunan || "?"}, tgl=${hari_tanggal || "?"}, tempat=${tempat || "?"}`
        });
      }

      const sheets = google.sheets({
        version: "v4",
        auth: getAuth(["https://www.googleapis.com/auth/spreadsheets"])
      });

      // Cek duplikat: kombinasi nama_himpunan + hari_tanggal
      const sheetRes = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${jenis}!A:B`
      });
      const existing = (sheetRes.data.values || []).slice(1);
      const isDup = existing.some(r => r[0] === nama_himpunan && r[1] === hari_tanggal);
      if (isDup) {
        return res.json({ success: true, duplicate: true, nama: nama_himpunan, nim: hari_tanggal });
      }

      // Upload ke Drive
      const drive = google.drive({
        version: "v3",
        auth: getAuth(["https://www.googleapis.com/auth/drive"])
      });
      const folderId = getDriveFolder(jenis);
      const up = await drive.files.create({
        requestBody: {
          name: `${nama_himpunan} - ${hari_tanggal}.pdf`,
          parents: [folderId]
        },
        media: { mimeType: "application/pdf", body: Readable.from(buffer) },
        fields: "id",
        supportsAllDrives: true
      });
      const link = `https://drive.google.com/file/d/${up.data.id}/view`;

      // Simpan ke sheet: nama_himpunan | hari_tanggal | tempat | link
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${jenis}!A:D`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[nama_himpunan, hari_tanggal, tempat, link]] }
      });

      return res.json({ success: true, nama: nama_himpunan, nim: hari_tanggal, link });
    }

    // ── CABANG: SURAT MAHASISWA ────────────────
    const { nama, nim } = parsed;

    console.log(`[${jenis}] Extracted:`, { nama, nim });

    if (!nama || !nim) {
      return res.json({ success: false, error: "Nama / NIM tidak terbaca" });
    }

    const sheets = google.sheets({
      version: "v4",
      auth: getAuth(["https://www.googleapis.com/auth/spreadsheets"])
    });

    // Cek duplikat NIM di kolom B
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${jenis}!B:B`
    });
    const existingNIM = (sheetRes.data.values || []).flat();
    if (existingNIM.includes(nim)) {
      return res.json({ success: true, duplicate: true, nama, nim });
    }

    // Upload ke Drive
    const drive = google.drive({
      version: "v3",
      auth: getAuth(["https://www.googleapis.com/auth/drive"])
    });
    const folderId = getDriveFolder(jenis);
    const up = await drive.files.create({
      requestBody: {
        name: `${nama} - ${nim}.pdf`,
        parents: [folderId]
      },
      media: { mimeType: "application/pdf", body: Readable.from(buffer) },
      fields: "id",
      supportsAllDrives: true
    });
    const link = `https://drive.google.com/file/d/${up.data.id}/view`;

    // Simpan ke sheet
    const row = JENIS_WITH_YEAR.includes(jenis)
      ? [nama, nim, link, tahun]
      : [nama, nim, link];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${jenis}!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] }
    });

    return res.json({ success: true, nama, nim, link });

  } catch (e) {
    console.error("UPLOAD ERROR:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
