import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = '16b91881-a5f3-4525-9455-b3ac17ded0db';
  try {
    const { data: noOrder } = await supabaseAdmin.from('threads').select('*').eq('user_id', userId);
    const { data: withOrder } = await supabaseAdmin.from('threads').select('*').eq('user_id', userId).order('last_message_date', { ascending: false });

    return NextResponse.json({
      noOrder,
      withOrder,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
