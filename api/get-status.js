import { google } from "googleapis";

function getSheets() {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.JWT(
    sa.client_email,
    null,
    sa.private_key,
    ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  );

  return google.sheets({ version: "v4", auth });
}

export default async function handler(req, res) {
  try {
    const { jenis } = req.query;

    if (!jenis) {
      return res.status(400).json({
        success: false,
        error: "Parameter jenis tidak ada"
      });
    }

    const sheets = getSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${jenis}!A:D`
    });

    const rows = response.data.values || [];

    const data = rows
      .slice(1)
      .filter(r => r[0] && r[1] && r[2])
      .map(r => ({
        nama: r[0],
        nim: r[1],
        link: r[2],
        tahun: r[3] || ""
      }));

    return res.json({
      success: true,
      data
    });

  } catch (e) {
    console.error("GET STATUS ERROR:", e);
    return res.status(500).json({
      success: false,
      error: e.message
    });
  }
}
