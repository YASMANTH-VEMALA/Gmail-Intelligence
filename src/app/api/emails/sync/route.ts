import { NextRequest, NextResponse } from 'next/server';
import { runSyncPipeline } from '@/lib/gmail';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    // Check if sync is already in progress
    const { data: syncStatus } = await supabaseAdmin
      .from('sync_status')
      .select('sync_in_progress, updated_at')
      .eq('user_id', userId)
      .single();

    // If a sync is marked in progress but hasn't updated in 5 minutes, assume it timed out and allow restart/resume
    const isStale = syncStatus?.sync_in_progress &&
      (Date.now() - new Date(syncStatus.updated_at).getTime() > 5 * 60 * 1000);

    if (syncStatus?.sync_in_progress && !isStale) {
      return NextResponse.json({ error: 'Sync already in progress' }, { status: 400 });
    }

    // Start or resume the sync pipeline in the background
    runSyncPipeline(userId).catch((err) => {
      console.error('[Sync API] Background sync pipeline failed:', err);
    });

    return NextResponse.json({
      success: true,
      message: isStale ? 'Stale sync resumed' : 'Sync pipeline started in background'
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const { data: syncStatus, error } = await supabaseAdmin
      .from('sync_status')
      .select('sync_in_progress, total_messages_synced, last_sync_at, phase, total_discovered, total_hydrated, total_errors, enumeration_done')
      .eq('user_id', userId)
      .single();

    if (error || !syncStatus) {
      return NextResponse.json({
        sync_in_progress: false,
        total_messages_synced: 0,
        last_sync_at: null,
        phase: 'idle',
        total_discovered: 0,
        total_hydrated: 0,
        total_errors: 0,
        enumeration_done: false
      });
    }

    return NextResponse.json(syncStatus);
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
  }
}
