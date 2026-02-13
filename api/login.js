import { google } from "googleapis";
import crypto from "crypto";

function getAuth() {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  return new google.auth.JWT(
    sa.client_email,
    null,
    sa.private_key,
    ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  );
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false });
    }

    const { username, password } = req.body;

    const sheets = google.sheets({
      version: "v4",
      auth: getAuth()
    });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_USER_SHEET_ID,
      range: `user!A:C`
    });

    const rows = response.data.values || [];

    const hashed = sha256(password);

    const user = rows.find(
      r => r[0] === username && r[1] === hashed
    );

    if (!user) {
      return res.json({ success: false });
    }

    return res.json({ success: true });

  } catch (e) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ success: false });
  }
}