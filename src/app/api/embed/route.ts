import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    // Get emails without embeddings
    const { data: emails } = await supabaseAdmin
      .from('emails')
      .select('gmail_id, subject, from_name, body_text, snippet')
      .eq('user_id', userId)
      .is('embedding', null)
      .limit(50);

    if (!emails?.length) return NextResponse.json({ message: 'No emails to embed', embedded: 0 });

    let embedded = 0;
    for (const email of emails) {
      try {
        const text = `Subject: ${email.subject}\nFrom: ${email.from_name}\n${(email.body_text || email.snippet || '').slice(0, 2000)}`;
        const embedding = await generateEmbedding(text);

        await supabaseAdmin
          .from('emails')
          .update({ embedding, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('gmail_id', email.gmail_id);

        embedded++;
      } catch (e) {
        console.error(`Embedding error for ${email.gmail_id}:`, e);
      }
    }

    return NextResponse.json({ success: true, embedded });
  } catch (error) {
    console.error('Embed error:', error);
    return NextResponse.json({ error: 'Embedding failed' }, { status: 500 });
  }
}
