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

const sql = fs.readFileSync('/home/yasmanth/Pictures/repeatless/supabase/migration_sync_queue.sql', 'utf-8');
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    // Use the SQL endpoint instead
    const sqlRes = await fetch(`${supabaseUrl}/pg`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    
    if (!sqlRes.ok) {
      // Try splitting into individual statements
      console.log('Direct SQL endpoint not available, running via individual REST calls...');
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const stmt of statements) {
        console.log('Executing:', stmt.substring(0, 80) + '...');
      }
      console.log('\nPlease run the migration SQL manually in the Supabase SQL Editor.');
      console.log('File: /home/yasmanth/Pictures/repeatless/supabase/migration_sync_queue.sql');
    } else {
      console.log('Migration successful!');
    }
  } catch (e) {
    console.log('Need to run migration via Supabase SQL Editor.');
    console.log('File: /home/yasmanth/Pictures/repeatless/supabase/migration_sync_queue.sql');
  }
}
run();
