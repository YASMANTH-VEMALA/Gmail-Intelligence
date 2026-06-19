import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
