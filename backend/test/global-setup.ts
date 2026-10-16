import { execSync } from 'node:child_process';

import pg from 'pg';

/** Brings the test database up to the latest migration and empties every table before the e2e run. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL!;
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length > 0) {
    await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
  }
  await client.end();
}
