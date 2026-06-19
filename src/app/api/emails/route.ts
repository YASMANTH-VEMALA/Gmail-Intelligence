import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAILBOX_LABELS = ['INBOX'];

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const category = request.nextUrl.searchParams.get('category');
  const search = request.nextUrl.searchParams.get('search');
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
  const threadView = request.nextUrl.searchParams.get('threadView') === 'true';

  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  if (threadView) {
    let query = supabaseAdmin
      .from('threads')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .contains('labels', MAILBOX_LABELS)
      .order('last_message_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category) query = query.eq('category', category);
    if (search) query = query.or(`subject.ilike.%${search}%,snippet.ilike.%${search}%`);

    const { data, error, count } = await query;
    console.log('[API Emails] Threads query result length:', data?.length, 'error:', error, 'count:', count);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ threads: data, total: count, page, limit });
  }

  let query = supabaseAdmin
    .from('emails')
    .select('id, gmail_id, thread_id, subject, from_address, from_name, date, snippet, labels, is_read, is_starred, category, summary', { count: 'exact' })
    .eq('user_id', userId)
    .contains('labels', MAILBOX_LABELS)
    .order('date', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (category) query = query.eq('category', category);
  if (search) query = query.or(`subject.ilike.%${search}%,from_name.ilike.%${search}%,snippet.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ emails: data, total: count, page, limit });
}
