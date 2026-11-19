import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { TEST_DATABASE_URL, TEST_DB_PORT } from './env.js';

/** Starts a throwaway PostgreSQL server for the test run and applies the migrations. */
export default async function setup() {
  const databaseDir = mkdtempSync(path.join(tmpdir(), 'classpilot-test-db-'));
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'password',
    port: TEST_DB_PORT,
    persistent: false,
    onLog: () => undefined,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('classpilot_test');

  execSync('npx prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });

  return async () => {
    await pg.stop();
    rmSync(databaseDir, { recursive: true, force: true });
  };
}
