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
  'Authorization': `Bearer ${serviceKey}`
};

async function run() {
  const userId = 'c3e8436a-a955-43c9-a241-d039ccacfb1f';
  
  // Get sync_queue stats
  const resQueue = await fetch(`${supabaseUrl}/rest/v1/sync_queue?user_id=eq.${userId}&select=status`, { headers });
  const queueItems = await resQueue.json();
  
  const stats = {};
  queueItems.forEach(item => {
    stats[item.status] = (stats[item.status] || 0) + 1;
  });
  
  console.log('--- SYNC QUEUE STATS ---');
  console.log('Total items in queue:', queueItems.length);
  console.log('Status breakdown:', stats);
}

run();
