import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

/** تجزئة argon2id لكلمات المرور */
export const hashPassword = (pw: string) => argonHash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  try { return await argonVerify(hash, pw); } catch { return false; }
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const hmacHex = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
/** رمز تحقق من 6 أرقام */
export const code6 = () => String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
