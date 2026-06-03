import { verifyToken } from "./login.js";

/**
 * Cek token dari header x-asma-token.
 * Kembalikan true jika valid, false + kirim 401 jika tidak.
 */
export function requireAuth(req, res) {
  const token = req.headers["x-asma-token"] || "";
  if (!token || !verifyToken(token)) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return false;
  }
  return true;
}
