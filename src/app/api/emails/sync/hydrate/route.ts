import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, hydrateMessagesBatch } from '@/lib/gmail';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, limit = 50 } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Set sync status to hydrating if it is not already in progress
    const { data: syncStatus } = await supabaseAdmin
      .from('sync_status')
      .select('sync_in_progress, phase')
      .eq('user_id', userId)
      .single();

    if (!syncStatus?.sync_in_progress) {
      await supabaseAdmin.from('sync_status').update({
        sync_in_progress: true,
        phase: 'hydrating',
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
    }

    const auth = await getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const result = await hydrateMessagesBatch(gmail, userId, limit);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      successCount: result.successCount || 0,
      errorCount: result.errorCount || 0,
      finished: result.finished
    });
  } catch (error: any) {
    console.error('[Hydrate API] Sync hydration error:', error);
    return NextResponse.json({ error: error.message || 'Hydration failed' }, { status: 500 });
  }
}
