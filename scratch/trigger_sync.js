const userId = 'c3e8436a-a955-43c9-a241-d039ccacfb1f';

async function run() {
  console.log(`Triggering sync for user ${userId}...`);
  const startRes = await fetch('http://localhost:3000/api/emails/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });

  const startData = await startRes.json();
  console.log('Start Sync Response:', startData);

  if (!startRes.ok) {
    console.error('Failed to start sync');
    return;
  }

  // Poll status every 2 seconds
  const interval = setInterval(async () => {
    try {
      const statusRes = await fetch(`http://localhost:3000/api/emails/sync?userId=${userId}`);
      const statusData = await statusRes.json();
      console.log(`[Status] Phase: ${statusData.phase} | Progress: ${statusData.total_hydrated || statusData.total_messages_synced} | In Progress: ${statusData.sync_in_progress}`);

      // Fetch latest logs
      const logsRes = await fetch(`http://localhost:3000/api/emails/sync/logs?userId=${userId}`);
      const logsData = await logsRes.json();
      if (logsData.logs && logsData.logs.length > 0) {
        console.log('--- LATEST LOGS ---');
        console.log(logsData.logs.slice(-5).join('\n'));
      }

      if (!statusData.sync_in_progress) {
        console.log('Sync finished!');
        clearInterval(interval);
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 2000);
}

run();
