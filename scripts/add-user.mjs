// Script to add or update a user in jetflo_users with a bcrypt-hashed password.
// Usage: node scripts/add-user.mjs <email> <name> [role] [password] [plant] [phone]
// Example: node scripts/add-user.mjs accounts2@claroenergy.in "Accounts 2" finance "JetFlo@2026" "Claro Energy, Mumbai"

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

if (!existsSync('.env.local')) {
  console.error('Missing .env.local file');
  process.exit(1);
}

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const dbUrl = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_ADMIN_URL or DATABASE_URL not found in .env.local');
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
const name = process.argv[3]?.trim();
const role = (process.argv[4]?.trim().toLowerCase() || 'finance');
const password = process.argv[5] || 'JetFlo@2026';
const plant = process.argv[6] || 'Claro Energy, Mumbai';
const phone = process.argv[7] || null;

if (!email || !name) {
  console.log(`
Usage:
  node scripts/add-user.mjs <email> <name> [role] [password] [plant] [phone]

Defaults:
  role:     finance (options: finance, requester, leadership)
  password: JetFlo@2026
  plant:    Claro Energy, Mumbai

Examples:
  node scripts/add-user.mjs priya@claroenergy.in "Priya Sharma" finance
  node scripts/add-user.mjs rahul@claromfg.com "Rahul Verma" requester "JetFlo@2026" "JetFlo Coimbatore"
`);
  process.exit(1);
}

const validRoles = ['requester', 'finance', 'leadership'];
if (!validRoles.includes(role)) {
  console.error(`Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const passwordHash = await bcrypt.hash(password, 12);

  // Check if user already exists
  const existing = await client.query('SELECT id, email, role FROM jetflo_users WHERE email = $1', [email]);

  if (existing.rows.length > 0) {
    const existingUser = existing.rows[0];
    await client.query(
      `UPDATE jetflo_users
       SET name = $1, role = $2, plant = $3, phone = COALESCE($4, phone), password_hash = $5, active = true
       WHERE id = $6`,
      [name, role, plant, phone, passwordHash, existingUser.id]
    );
    console.log(`✓ Updated existing user ${email} (${name}, role: ${role})`);
    console.log(`  ID: ${existingUser.id}`);
    console.log(`  Password updated: ${password}`);
  } else {
    const newId = randomUUID();
    await client.query(
      `INSERT INTO jetflo_users (id, name, email, role, plant, phone, password_hash, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [newId, name, email, role, plant, phone, passwordHash]
    );
    console.log(`✓ Created new user ${email} (${name}, role: ${role})`);
    console.log(`  ID: ${newId}`);
    console.log(`  Password: ${password}`);
  }
} catch (err) {
  console.error('Failed to create/update user:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}

