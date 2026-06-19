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

async function run() {
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/emails?select=id,user_id,category,subject`, { headers });
    const data = await res.json();
    console.log('Total emails found across all users:', data.length);
    const userEmails = {};
    data.forEach(e => {
      userEmails[e.user_id] = (userEmails[e.user_id] || 0) + 1;
    });
    console.log('Emails per user:', userEmails);

    const counts = {};
    const samples = {};
    data.forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + 1;
      if (!samples[e.category]) {
        samples[e.category] = [];
      }
      if (samples[e.category].length < 3) {
        samples[e.category].push(e.subject);
      }
    });
    console.log('Email category counts:', counts);

    console.log('\n--- THREADS ---');
    const threadRes = await fetch(`${supabaseUrl}/rest/v1/threads?select=id,user_id,category,subject`, { headers });
    const threadData = await threadRes.json();
    console.log('Total threads found across all users:', threadData.length);
    const userThreads = {};
    threadData.forEach(t => {
      userThreads[t.user_id] = (userThreads[t.user_id] || 0) + 1;
    });
    console.log('Threads per user:', userThreads);
    
    const threadCounts = {};
    threadData.forEach(t => {
      threadCounts[t.category] = (threadCounts[t.category] || 0) + 1;
    });
    console.log('Thread category counts:', threadCounts);
  } catch (e) {
    console.error(e);
  }
}
run();
