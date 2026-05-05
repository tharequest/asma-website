import { google } from "googleapis";
import pdfParse from "pdf-parse";
import { Readable } from "stream";

const JENIS_WITH_YEAR = ["cuti_kuliah", "undur_diri", "pindah_kuliah"];

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
// 🔤 FORMAT NAMA
// ===============================
function toProperCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// 🔥 FIX TAMBAHAN (BIAR NAMA GAK NEMPEL)
function fixNamaSpacing(nama) {
  // kasih spasi antar huruf kecil ke kapital (contoh: muhammadRizki)
  nama = nama.replace(/([a-z])([A-Z])/g, "$1 $2");

  // kalau full nempel tanpa spasi → paksa pecah dikit
  if (!nama.includes(" ")) {
    nama = nama.replace(/([a-z]{4,})(?=[a-z]{4,})/gi, "$1 ");
  }

  return nama;
}

// ===============================
// 🔍 PARSER NAMA & NIM
// ===============================
function extractNamaNim(text, jenis) {
  let nama = "";
  let nim = "";

  const clean = text
    .replace(/\r/g, "")
    .replace(/\n/g, " ") // 🔥 FIX (jangan \n+)
    .replace(/\s+/g, " ");

  if (jenis === "aktif_kuliah") {
    const after = clean.split(/menerangkan bahwa/i)[1] || "";

    const namaMatch = after.match(
      /nama\s*[:\-]?\s*([a-zA-Z.'\s]+?)(?=\s+(nim|nomor|tempat|jurusan|alamat|$))/i
    );

    const nimMatch = after.match(
      /(nomor induk mahasiswa|nim)\s*[:\-]?\s*(h\d{8,12})/i
    );

    if (namaMatch) nama = namaMatch[1];
    if (nimMatch) nim = nimMatch[2];

  } else {
    const namaMatch = clean.match(
      /nama\s*[:\-]?\s*([a-zA-Z.'\s]+?)(?=\s+(nim|nomor|tempat|jurusan|alamat|$))/i
    );

    const nimMatch = clean.match(
      /(nim|nomor induk mahasiswa)\s*[:\-]?\s*(h\d{8,12})/i
    );

    if (namaMatch) nama = namaMatch[1];
    if (nimMatch) nim = nimMatch[2];

  if (!nama || !nim) {
      const colMatch = clean.match(
        /nama\s+nomor\s+induk\s+mahasiswa[\s\w\/]+alamat\s*:(.+?)(?=dokumen|kementerian|$)/i
      );
      if (colMatch) {
        const parts = colMatch[1].trim().split(/\s*:\s*/);
        const values = parts.map(p => p.trim()).filter(p => p.length > 0);
        if (values.length >= 2) {
          if (!nama) nama = values[0];
          if (!nim) {
            const nimRaw = values[1].replace(/\s+/g, "");
            const nimFix = nimRaw.match(/h\d{8,12}/i);
            if (nimFix) nim = nimFix[0];
          }
        }
      }
    }
  }

  return {
    nama: toProperCase(fixNamaSpacing(nama.trim())), // 🔥 FIX DIPAKAI DI SINI
    nim: nim.trim().toUpperCase()
  };
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

    const { nama, nim } = extractNamaNim(text, jenis);

    if (!nama || !nim) {
      return res.json({
        success: false,
        error: "Nama / NIM tidak terbaca"
      });
    }

    // ===============================
    // SHEETS (CEK DUPLIKAT)
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
    // DRIVE UPLOAD
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
    // APPEND SHEET
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