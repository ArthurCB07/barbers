/**
 * Armazenamento de arquivos. Implementação local em disco (UPLOAD_DIR),
 * servida por /api/files/[name]. Para produção serverless, substitua por
 * Supabase Storage mantendo a mesma interface (ver docs/DEPLOY.md).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads");
export const MAX_UPLOAD = 3 * 1024 * 1024;

const SIGNATURES: Array<{ mime: string; ext: string; test: (b: Buffer) => boolean }> = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
];

/** Valida pelo conteúdo real (assinatura), não pela extensão informada */
export async function saveImage(buf: Buffer): Promise<string> {
  if (buf.length > MAX_UPLOAD) throw new Error("A imagem deve ter no máximo 3 MB.");
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new Error("Formato não suportado. Use JPG, PNG ou WebP.");
  await mkdir(DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(9).toString("base64url")}.${sig.ext}`;
  await writeFile(path.join(DIR, name), buf);
  return `/api/files/${name}`;
}

export async function readStored(name: string): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(name)) return null;
  try {
    const data = await readFile(path.join(DIR, name));
    const ext = name.split(".").pop();
    return { data, mime: ext === "jpg" ? "image/jpeg" : `image/${ext}` };
  } catch {
    return null;
  }
}
