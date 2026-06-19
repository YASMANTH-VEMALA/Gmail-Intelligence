import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const emailId = params.id;

  // Check if this is a thread ID or email ID
  const isThread = request.nextUrl.searchParams.get('isThread') === 'true';

  if (isThread) {
    // Get thread with all messages
    const { data: thread } = await supabaseAdmin
      .from('threads')
      .select('*')
      .eq('user_id', userId)
      .eq('gmail_thread_id', emailId)
      .single();

    const { data: messages } = await supabaseAdmin
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .eq('thread_id', emailId)
      .order('date', { ascending: true });

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    return NextResponse.json({ thread, messages });
  }

  // Get single email
  const { data: email, error } = await supabaseAdmin
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('gmail_id', emailId)
    .single();

  if (error || !email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

  // Also get thread messages for context
  const { data: threadMessages } = await supabaseAdmin
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('thread_id', email.thread_id)
    .order('date', { ascending: true });

  return NextResponse.json({ email, threadMessages });
}
