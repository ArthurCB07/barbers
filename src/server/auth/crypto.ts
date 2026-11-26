import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const COST = process.env.NODE_ENV === "test" ? 4 : 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Token aleatório de alta entropia (enviado ao usuário) */
export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Apenas o hash do token é persistido */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
