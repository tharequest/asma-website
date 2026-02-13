import { google } from "googleapis";

function getAuth() {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  return new google.auth.JWT(
    sa.client_email,
    null,
    sa.private_key,
    [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive"
    ]
  );
}

function extractFileId(input) {
  if (!input) return null;
  input = input.trim();

  if (!input.includes("http")) return input;

  const match1 = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];

  const match2 = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];

  return null;
}

export default async function handler(req, res) {
  try {
    const { jenis, rowIndex, link } = req.body;

    if (!jenis || rowIndex === undefined) {
      return res.status(400).json({ success: false });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    // 🔥 Ambil metadata spreadsheet untuk cari sheetId
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID
    });

    const sheet = meta.data.sheets.find(
      s => s.properties.title === jenis
    );

    if (!sheet) {
      return res.status(400).json({ success: false, error: "Sheet tidak ditemukan" });
    }

    const sheetId = sheet.properties.sheetId;

    // 🔥 Hapus file Drive
    const fileId = extractFileId(link);
    if (fileId) {
      try {
        await drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true
        });
      } catch (err) {
        console.log("File Drive tidak ditemukan atau sudah dihapus");
      }
    }

    // 🔥 Hapus baris spreadsheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }
        ]
      }
    });

    return res.json({ success: true });

  } catch (e) {
    console.error("DELETE ERROR:", e);
    return res.status(500).json({ success: false });
  }
}