import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Clear audit log (bigint id)
const { error: eAud } = await admin.from('jetflo_audit_log').delete().gte('id', 0);
console.log('Cleared jetflo_audit_log:', eAud ? eAud.message : 'OK');

// Delete any lingering test vendors
const { data: vends } = await admin.from('jetflo_vendors').select('id, name');
for (const v of vends ?? []) {
  if (['vendor', 'yash parashar'].includes(v.name?.toLowerCase().trim())) {
    await admin.from('jetflo_vendors').delete().eq('id', v.id);
    console.log('Deleted vendor:', v.name);
  }
}

// Verify counts
const { count: reqCount } = await admin.from('jetflo_fund_requests').select('*', { count: 'exact', head: true });
const { count: vendCount } = await admin.from('jetflo_vendors').select('*', { count: 'exact', head: true });
const { count: payCount } = await admin.from('jetflo_payments').select('*', { count: 'exact', head: true });

console.log(`\nVerified Database State:`);
console.log(`- Active Fund Requests: ${reqCount}`);
console.log(`- Active Payments: ${payCount}`);
console.log(`- Active Vendors: ${vendCount}`);
