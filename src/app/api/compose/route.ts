import { NextRequest, NextResponse } from 'next/server';
import { composeEmail } from '@/lib/gemini';
import { normalizeEmailRecipients, sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

function isLikelyEmailRecipient(recipient: string) {
  const address = recipient.match(/<([^<>]+)>/)?.[1] || recipient;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address.trim());
}

export async function POST(request: NextRequest) {
  try {
    const { userId, prompt, sendNow, to, subject, body, attachments } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (sendNow) {
      const recipients = normalizeEmailRecipients(to);
      if (recipients.length === 0) {
        return NextResponse.json({ error: 'Add at least one recipient' }, { status: 400 });
      }
      const invalidRecipients = recipients.filter((recipient) => !isLikelyEmailRecipient(recipient));
      if (invalidRecipients.length > 0) {
        return NextResponse.json({ error: `Invalid recipient: ${invalidRecipients[0]}` }, { status: 400 });
      }
      if (!body) {
        return NextResponse.json({ error: 'Missing body' }, { status: 400 });
      }

      // Send the finalized email
      const messageId = await sendEmail(userId, recipients, subject || '', body, undefined, undefined, undefined, attachments);
      return NextResponse.json({ success: true, messageId });
    }

    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });

    // Generate draft from prompt
    const draft = await composeEmail(prompt);
    return NextResponse.json({ draft });
  } catch (error) {
    console.error('Compose error:', error);
    const message = error instanceof Error ? error.message : 'Compose failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
