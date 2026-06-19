import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'src', 'tmp_logs');

// Ensure directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export function writeSyncLog(userId: string, message: string, append = true) {
  try {
    const filePath = path.join(LOGS_DIR, `sync_${userId}.json`);
    let logs: string[] = [];
    
    if (append && fs.existsSync(filePath)) {
      try {
        logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (err) {
        logs = [];
      }
    }
    
    const timestamp = new Date().toLocaleTimeString();
    logs.push(`[${timestamp}] ${message}`);
    
    // Cap at 150 log lines to save disk space and performance
    if (logs.length > 150) {
      logs.shift();
    }
    
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('[SyncLogs] Error writing sync log:', e);
  }
}

export function readSyncLogs(userId: string): string[] {
  try {
    const filePath = path.join(LOGS_DIR, `sync_${userId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error('[SyncLogs] Error reading sync log:', e);
  }
  return [];
}

export function clearSyncLogs(userId: string) {
  try {
    const filePath = path.join(LOGS_DIR, `sync_${userId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // ignore
  }
}
