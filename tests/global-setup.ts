import { execSync } from "node:child_process";

/**
 * Sincroniza o schema num banco SQLite isolado para os testes (prisma/test.db).
 * Não usa reset: as tabelas de teste são limpas por tests/helpers.ts#resetDb.
 */
export default function setup() {
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
