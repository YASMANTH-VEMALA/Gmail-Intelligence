import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { summarizeEmail, summarizeThread } from '@/lib/gemini';
import type { EmailMessage } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, emailId, threadId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (threadId) {
      // Thread summarization
      const { data: messages } = await supabaseAdmin
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .order('date', { ascending: true });

      if (!messages?.length) return NextResponse.json({ error: 'No messages found' }, { status: 404 });

      const summary = await summarizeThread(messages as EmailMessage[]);

      // Update thread summary
      await supabaseAdmin
        .from('threads')
        .update({ summary, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('gmail_thread_id', threadId);

      return NextResponse.json({ summary, type: 'thread' });
    }

    if (emailId) {
      // Single email summarization with full thread context
      const { data: email } = await supabaseAdmin
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .eq('gmail_id', emailId)
        .single();

      if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

      const { data: threadMessages } = await supabaseAdmin
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .eq('thread_id', email.thread_id)
        .order('date', { ascending: true });

      const summary = await summarizeEmail(email as EmailMessage, (threadMessages || [email]) as EmailMessage[]);

      // Update email summary
      await supabaseAdmin
        .from('emails')
        .update({ summary, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('gmail_id', emailId);

      return NextResponse.json({ summary, type: 'email' });
    }

    return NextResponse.json({ error: 'Provide emailId or threadId' }, { status: 400 });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 });
  }
}
