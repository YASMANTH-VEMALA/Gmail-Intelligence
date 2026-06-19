import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { deduplicateNews } from '@/lib/gemini';
import type { EmailMessage } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const days = parseInt(request.nextUrl.searchParams.get('days') || '7');

  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: newsletters } = await supabaseAdmin
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'newsletters')
    .gte('date', since.toISOString())
    .order('date', { ascending: false })
    .limit(50);

  if (!newsletters?.length) {
    return NextResponse.json({ items: [], message: 'No newsletters found in this period' });
  }

  const newsItems = await deduplicateNews(newsletters as EmailMessage[]);
  return NextResponse.json({ items: newsItems, total: newsItems.length });
}
