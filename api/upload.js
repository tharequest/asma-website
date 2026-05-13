import { google } from "googleapis";
import pdfParse from "pdf-parse";
import { Readable } from "stream";

const JENIS_WITH_YEAR = ["cuti_kuliah", "undur_diri", "pindah_kuliah"];
const JENIS_KEGIATAN = ["izin_kegiatan"];

export const config = {
  api: { bodyParser: false }
};

// ===============================
// UTIL: READ BUFFER
// ===============================
function bufferFromReq(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ===============================
// UTIL: GOOGLE AUTH
// ===============================
function getAuth(scopes) {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  return new google.auth.JWT(
    sa.client_email,
    null,
    sa.private_key,
    scopes
  );
}

// ===============================
// UTIL: DRIVE FOLDER MAP
// ===============================
function getDriveFolder(jenis) {
  const map = JSON.parse(process.env.GOOGLE_DRIVE_FOLDER_MAP || "{}");
  return map[jenis] || map.aktif_kuliah;
}

// ===============================
// FORMAT NAMA
// ===============================
function toProperCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function fixNamaSpacing(nama) {
  nama = nama.replace(/([a-z])([A-Z])/g, "$1 $2");

  if (!nama.includes(" ")) {
    nama = nama.replace(/([a-z]{4,})(?=[a-z]{4,})/gi, "$1 ");
  }

  return nama;
}

// ===============================
// PARSER NAMA & NIM (FINAL STABLE)
// ===============================
function extractNamaNim(text, jenis) {
  let nama = "";
  let nim = "";

  const clean = text
    .replace(/\r/g, "")
    .replace(/\n/g, "\n")
    .replace(/Dokumen ini telah.*?BSrE\./is, "")
    .trim();

  // =======================
  // AMBIL NAMA
  // =======================
  const namaMatch = clean.match(
    /nama\s*:\s*(.+)/i
  );

  if (namaMatch) {
    nama = namaMatch[1]
      .split("\n")[0]
      .replace(/\d+/g, "")
      .trim();
  }

  // =======================
  // AMBIL NIM
  // =======================
  const nimMatch = clean.match(
    /nomor induk mahasiswa\s*:\s*([A-Z0-9]+)/i
  );

  if (nimMatch) {
    nim = nimMatch[1].trim().toUpperCase();
  }

  return {
    nama: toProperCase(fixNamaSpacing(nama)),
    nim
  };
}

// ===============================
// PARSER IZIN KEGIATAN
// ===============================
function extractIzinKegiatan(text) {
  const clean = text
    .replace(/\r/g, "")
    .replace(/Dokumen ini telah.*?BSrE\./is, "")
    .trim();

  // Nama himpunan: ambil singkatan dalam kurung PERTAMA antara "kepada ... Fakultas"
  // Contoh: "kepada Himpunan Mahasiswa Geofisika (HMG) Fakultas" → "HMG"
  //         "kepada Himpunan Mahasiswa Fisika (HIMAFIS) Fakultas" → "HIMAFIS"
  // Tidak akan mengambil singkatan kegiatan seperti (ION), (Gempa) karena
  // muncul SETELAH kata "Fakultas" — dijamin tidak salah tangkap
  let nama_himpunan = "";
  const namaMatch = clean.match(
    /memberikan izin kepada\s+[^(]+\(([^)]+)\)\s+Fakultas/is
  );
  if (namaMatch) {
    nama_himpunan = namaMatch[1].trim();
  }

  // Hari/tanggal: "hari/tanggal : Sabtu, 16 Mei 2026"
  let hari_tanggal = "";
  const hariMatch = clean.match(/hari\/tanggal\s*:\s*(.+)/i);
  if (hariMatch) {
    hari_tanggal = hariMatch[1].split("\n")[0].trim();
  }

  // Tempat: "tempat : Ruangan H3.1 Gedung Baru FMIPA Untan"
  let tempat = "";
  const tempatMatch = clean.match(/tempat\s*:\s*(.+)/i);
  if (tempatMatch) {
    tempat = tempatMatch[1].split("\n")[0].trim();
  }

  return { nama_himpunan, hari_tanggal, tempat };
}

// ===============================
// HANDLER
// ===============================
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false });
    }

    const jenis = req.query?.jenis || "aktif_kuliah";
    const tahun = JENIS_WITH_YEAR.includes(jenis)
      ? req.query?.tahun
      : "";

    const buffer = await bufferFromReq(req);

    const pdf = await pdfParse(buffer);
    const text = pdf.text;

    // ─────────────────────────────────────────
    // CABANG: IZIN KEGIATAN
    // ─────────────────────────────────────────
    if (JENIS_KEGIATAN.includes(jenis)) {
      const { nama_himpunan, hari_tanggal, tempat } = extractIzinKegiatan(text);

      if (!nama_himpunan || !hari_tanggal || !tempat) {
        return res.json({
          success: false,
          error: "Data himpunan/tanggal/tempat tidak terbaca dari PDF"
        });
      }

      // Cek duplikat: kombinasi nama_himpunan + hari_tanggal (kolom A+B)
      const sheets = google.sheets({
        version: "v4",
        auth: getAuth(["https://www.googleapis.com/auth/spreadsheets"])
      });

      const sheetRes = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${jenis}!A:B`
      });

      const existing = (sheetRes.data.values || []).slice(1);
      const isDup = existing.some(
        r => r[0] === nama_himpunan && r[1] === hari_tanggal
      );

      if (isDup) {
        return res.json({
          success: true,
          duplicate: true,
          nama: nama_himpunan,
          nim: hari_tanggal
        });
      }

      // Upload ke Drive
      const drive = google.drive({
        version: "v3",
        auth: getAuth(["https://www.googleapis.com/auth/drive"])
      });

      const folderId = getDriveFolder(jenis);
      const stream = Readable.from(buffer);

      const up = await drive.files.create({
        requestBody: {
          name: `${nama_himpunan} - ${hari_tanggal}.pdf`,
          parents: [folderId]
        },
        media: { mimeType: "application/pdf", body: stream },
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

      return res.json({
        success: true,
        nama: nama_himpunan,
        nim: hari_tanggal,
        link
      });
    }

    // ─────────────────────────────────────────
    // CABANG: SURAT MAHASISWA (EXISTING)
    // ─────────────────────────────────────────
    const { nama, nim } = extractNamaNim(text, jenis);

    if (!nama || !nim) {
      return res.json({
        success: false,
        error: "Nama / NIM tidak terbaca"
      });
    }

    // ===============================
    // CEK DUPLIKAT
    // ===============================
    const sheets = google.sheets({
      version: "v4",
      auth: getAuth(["https://www.googleapis.com/auth/spreadsheets"])
    });

    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${jenis}!B:B`
    });

    const existingNIM = (sheetRes.data.values || []).flat();

    if (existingNIM.includes(nim)) {
      return res.json({
        success: true,
        duplicate: true,
        nama,
        nim
      });
    }

    // ===============================
    // UPLOAD DRIVE
    // ===============================
    const drive = google.drive({
      version: "v3",
      auth: getAuth(["https://www.googleapis.com/auth/drive"])
    });

    const folderId = getDriveFolder(jenis);
    const stream = Readable.from(buffer);

    const up = await drive.files.create({
      requestBody: {
        name: `${nama} - ${nim}.pdf`,
        parents: [folderId]
      },
      media: {
        mimeType: "application/pdf",
        body: stream
      },
      fields: "id",
      supportsAllDrives: true
    });

    const link = `https://drive.google.com/file/d/${up.data.id}/view`;

    // ===============================
    // SIMPAN KE SHEET
    // ===============================
    const row = JENIS_WITH_YEAR.includes(jenis)
      ? [nama, nim, link, tahun]
      : [nama, nim, link];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${jenis}!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row]
      }
    });

    return res.json({
      success: true,
      nama,
      nim,
      link
    });

  } catch (e) {
    console.error("UPLOAD ERROR:", e);
    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
}