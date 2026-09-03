// Creates official auth users + jetflo_users profiles. Run: node scripts/seed-users.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  { email: 'raju.r@claromfg.com',       name: 'Raju R',        role: 'requester',  plant: 'JetFlo Hyderabad',   phone: '+91 98490 11111' },
  { email: 'accounts@claroenergy.in',   name: 'Accounts Team', role: 'finance',    plant: 'Claro Energy, Mumbai', phone: '+91 98200 22222' },
  { email: 'gaurav@claroenergy.in',     name: 'Gaurav',        role: 'finance',    plant: 'Claro Energy, Mumbai', phone: '+91 98200 33333' },
  { email: 'kartik@claroenergy.in',     name: 'Kartik',        role: 'leadership', plant: 'Claro Energy, Mumbai', phone: '+91 98100 44444' },
  { email: 'soumitra@claroenergy.in',   name: 'Soumitra',      role: 'leadership', plant: 'Claro Energy, Mumbai', phone: '+91 98100 55555' },
  { email: 'yash.parashar@claroenergy.in', name: 'Yash Parashar', role: 'leadership', plant: 'Claro Energy, Mumbai', phone: '+91 98000 00000' },
];
const PASSWORD = 'JetFlo@2026';

for (const u of users) {
  let id;
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: PASSWORD, email_confirm: true,
  });
  if (error) {
    if (!/already/i.test(error.message)) { console.error(u.email, error.message); process.exit(1); }
    const { data: list } = await admin.auth.admin.listUsers();
    id = list.users.find((x) => x.email.toLowerCase() === u.email.toLowerCase())?.id;
  } else id = data.user.id;

  const { error: pErr } = await admin.from('jetflo_users').upsert({
    id, email: u.email, name: u.name, role: u.role, plant: u.plant, phone: u.phone,
  });
  if (pErr) { console.error('profile', u.email, pErr.message); process.exit(1); }
  console.log('ok', u.role.padEnd(12), u.email, id);
}
console.log('\nAll official users ready in Supabase! Password:', PASSWORD);
