import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { categorizeEmailsBatch } from '@/lib/gemini';
import { nvidiaCategorizeEmail } from '@/lib/nvidia';
import type { EmailMessage, EmailCategory } from '@/types';

export const dynamic = 'force-dynamic';

const MAILBOX_LABELS = ['INBOX'];

export async function POST(request: NextRequest) {
  try {
    const { userId, emailIds, useNvidia } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    // If specific email IDs are provided, categorize those; otherwise categorize uncategorized
    let query = supabaseAdmin
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .contains('labels', MAILBOX_LABELS)
      .is('category', null);

    if (emailIds?.length) {
      query = supabaseAdmin
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .contains('labels', MAILBOX_LABELS)
        .in('gmail_id', emailIds);
    }

    const { data: emails } = await query.limit(100);
    if (!emails?.length) return NextResponse.json({ message: 'No emails to categorize', categorized: 0 });

    const typedEmails = emails as EmailMessage[];
    let categorized = 0;

    if (useNvidia) {
      // Use NVIDIA NIM for categorization
      for (const email of typedEmails) {
        try {
          const category = await nvidiaCategorizeEmail(email);
          await supabaseAdmin
            .from('emails')
            .update({ category, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('gmail_id', email.gmail_id);

          // Also update thread category
          await supabaseAdmin
            .from('threads')
            .update({ category, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('gmail_thread_id', email.thread_id);

          categorized++;
        } catch (e) {
          console.error(`NVIDIA categorize error for ${email.gmail_id}:`, e);
        }
      }
    } else {
      // Use Gemini for categorization
      const results = await categorizeEmailsBatch(typedEmails);
      for (const [gmailId, category] of results) {
        await supabaseAdmin
          .from('emails')
          .update({ category, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('gmail_id', gmailId);

        const email = typedEmails.find((e) => e.gmail_id === gmailId);
        if (email) {
          await supabaseAdmin
            .from('threads')
            .update({ category, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('gmail_thread_id', email.thread_id);
        }
        categorized++;
      }
    }

    return NextResponse.json({ success: true, categorized });
  } catch (error) {
    console.error('Categorize error:', error);
    return NextResponse.json({ error: 'Categorization failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  // Get category counts
  const categories: EmailCategory[] = ['newsletters', 'job_recruitment', 'finance', 'notifications', 'personal', 'work_professional', 'uncategorized'];
  const counts: { category: string; count: number }[] = [];

  for (const cat of categories) {
    const { count } = await supabaseAdmin
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .contains('labels', MAILBOX_LABELS)
      .eq('category', cat);
    counts.push({ category: cat, count: count || 0 });
  }

  // Count uncategorized (null category)
  const { count: nullCount } = await supabaseAdmin
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .contains('labels', MAILBOX_LABELS)
    .is('category', null);

  counts.find((c) => c.category === 'uncategorized')!.count += nullCount || 0;

  return NextResponse.json({ counts });
}
