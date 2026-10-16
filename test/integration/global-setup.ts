import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = 54329;
const URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/saas_test`;

let pg: EmbeddedPostgres | null = null;
let dir = "";

// Geçici bir PostgreSQL başlatır, tüm migration'ları sırayla uygular ve test bitince siler.
export async function setup() {
  dir = mkdtempSync(join(tmpdir(), "saas-pg-"));
  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: false,
    // Sistem yerel ayarı ASCII dışı olabilir (örn. Türkçe Windows): initdb'nin çökmemesi için sabit "C" kullanılır
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("saas_test");

  // Gerçek migration dosyaları uygulanır: sıra veya SQL hatası burada yakalanır
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: URL, DIRECT_URL: URL },
  });
}

export async function teardown() {
  await pg?.stop().catch(() => undefined);
  if (dir) rmSync(dir, { recursive: true, force: true });
}
