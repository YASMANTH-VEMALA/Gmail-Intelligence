import { NextRequest, NextResponse } from 'next/server';
import { readSyncLogs } from '@/lib/sync-logs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const logs = readSyncLogs(userId);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[SyncLogs API] Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
