// Password hashing and session tokens, using only Node's built-in crypto.
import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return { salt, passwordHash: hash };
}

export function verifyPassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = crypto.scryptSync(String(password), user.salt, KEY_LENGTH);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// The browser keeps the token; the database only keeps its SHA-256 hash, so a
// copy of db.json can't be used to log in as someone.
export const newToken = () => crypto.randomBytes(32).toString("hex");
export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");
