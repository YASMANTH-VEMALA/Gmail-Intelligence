const fs = require('fs');
const envPath = '/home/yasmanth/Pictures/repeatless/.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function runSQL(sql, label) {
  console.log(`\n--- ${label} ---`);
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  console.log('RPC status:', res.status);
}

async function createSyncQueue() {
  // Test if sync_queue already exists
  const res = await fetch(`${supabaseUrl}/rest/v1/sync_queue?select=id&limit=1`, { headers });
  if (res.ok) {
    console.log('sync_queue table already exists!');
    return true;
  }
  console.log('sync_queue status:', res.status, '- table does not exist yet');
  return false;
}

async function checkSyncStatusColumns() {
  const res = await fetch(`${supabaseUrl}/rest/v1/sync_status?select=phase,total_discovered,total_hydrated,total_errors,last_page_token,enumeration_done&limit=1`, { headers });
  if (res.ok) {
    console.log('sync_status new columns already exist!');
    return true;
  }
  console.log('sync_status new columns missing, status:', res.status);
  return false;
}

async function run() {
  const queueExists = await createSyncQueue();
  const colsExist = await checkSyncStatusColumns();
  
  if (!queueExists || !colsExist) {
    console.log('\n⚠️  Please run the migration SQL in Supabase SQL Editor:');
    console.log('   File: supabase/migration_sync_queue.sql');
  } else {
    console.log('\n✅ All tables and columns are ready!');
  }
}

run();
