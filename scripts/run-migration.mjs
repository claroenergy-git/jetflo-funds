// Apply one SQL migration with the migration credentials from .env.migrations.
// Usage: node scripts/run-migration.mjs supabase/migrations/012_notification_recipients.sql
import pg from 'pg';
import { readFileSync, existsSync } from 'fs';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Usage: node scripts/run-migration.mjs <path-to-migration.sql>');
  process.exit(1);
}

for (const line of readFileSync('.env.migrations', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
const missing = ['MIGRATION_DB_HOST', 'MIGRATION_DB_NAME', 'MIGRATION_DB_USER', 'MIGRATION_DB_PASSWORD'].filter(
  (k) => !process.env[k]
);
if (missing.length) {
  console.error(`Fill in ${missing.join(', ')} in .env.migrations`);
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.MIGRATION_DB_HOST,
  port: Number(process.env.MIGRATION_DB_PORT || 5432),
  database: process.env.MIGRATION_DB_NAME,
  user: process.env.MIGRATION_DB_USER,
  password: process.env.MIGRATION_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // server requires SSL (sslmode=require)
});
await client.connect();

const { rows } = await client.query('SELECT current_user, current_database()');
console.log(`Connected as ${rows[0].current_user} to ${rows[0].current_database}`);

// All-or-nothing: a failure part-way leaves the database unchanged.
try {
  await client.query('BEGIN');
  await client.query(readFileSync(file, 'utf8'));
  await client.query('COMMIT');
  console.log(`Applied ${file}`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error(`Failed — rolled back, nothing changed:\n  ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
