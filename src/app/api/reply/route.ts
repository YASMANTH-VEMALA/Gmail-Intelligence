import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { composeReply } from '@/lib/gemini';
import { sendEmail } from '@/lib/gmail';
import type { EmailMessage } from '@/types';

export const dynamic = 'force-dynamic';

function getRecipientAddresses(value: string | string[] | null | undefined) {
  const recipients = Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/);
  return recipients
    .map((recipient) => recipient.match(/<([^<>]+)>/)?.[1] || recipient)
    .map((recipient) => recipient.trim().toLowerCase())
    .filter(Boolean);
}

function isNoReplyRecipient(value: string | string[] | null | undefined) {
  return getRecipientAddresses(value).some((address) => {
    const localPart = address.split('@')[0]?.replace(/[^a-z]/g, '') || '';
    return localPart.includes('noreply') ||
      localPart.includes('donotreply') ||
      localPart.includes('mailerdaemon') ||
      localPart.includes('postmaster');
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, threadId, prompt, sendNow, to, subject, body, inReplyTo, references, attachments } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (sendNow && to && body) {
      if (isNoReplyRecipient(to)) {
        return NextResponse.json({
          error: 'This sender uses a no-reply address, so replying will usually bounce. Use Compose with a real recipient address instead.'
        }, { status: 400 });
      }

      const messageId = await sendEmail(userId, to, subject || '', body, inReplyTo, references, threadId, attachments);

      // Return updated thread messages so the frontend can refresh the view
      let updatedMessages = null;
      if (threadId) {
        const { data: msgs } = await supabaseAdmin
          .from('emails')
          .select('*')
          .eq('user_id', userId)
          .eq('thread_id', threadId)
          .order('date', { ascending: true });
        updatedMessages = msgs;
      }

      return NextResponse.json({ success: true, messageId, threadMessages: updatedMessages });
    }

    if (!threadId || !prompt) {
      return NextResponse.json({ error: 'Missing threadId or prompt' }, { status: 400 });
    }

    // Get thread messages for context
    const { data: messages } = await supabaseAdmin
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .order('date', { ascending: true });

    if (!messages?.length) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const typedMessages = messages as EmailMessage[];
    
    // Bypass Gemini API call if we just want the headers
    let replyBody = '';
    if (prompt !== 'default_headers_only_no_ai') {
      replyBody = await composeReply(prompt, typedMessages);
    }

    // Get the last message for reply headers
    const lastMessage = typedMessages[typedMessages.length - 1];
    const messageIdHeader = lastMessage.headers?.['Message-ID'] || lastMessage.headers?.['Message-Id'] || '';
    const existingRefs = lastMessage.references || [];

    return NextResponse.json({
      draft: {
        to: lastMessage.from_address || '',
        subject: `Re: ${(lastMessage.subject || '').replace(/^Re:\s*/i, '')}`,
        body: replyBody,
        inReplyTo: messageIdHeader,
        references: [...existingRefs, messageIdHeader].filter(Boolean),
        threadId,
      },
    });
  } catch (error) {
    console.error('Reply error:', error);
    const message = error instanceof Error ? error.message : 'Reply failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
