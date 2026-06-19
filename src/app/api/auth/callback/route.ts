import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, getOAuth2Client } from '@/lib/gmail';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    const tokens = await getTokensFromCode(code);

    // Get user info
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const userId = uuidv4();
    const userData = {
      id: userId,
      email: userInfo.data.email!,
      name: userInfo.data.name || null,
      picture: userInfo.data.picture || null,
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      token_expiry: new Date(tokens.expiry_date!).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', userInfo.data.email!)
      .single();

    if (existingUser) {
      // Update existing user
      await supabaseAdmin
        .from('users')
        .update({
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token || undefined,
          token_expiry: new Date(tokens.expiry_date!).toISOString(),
          name: userInfo.data.name || null,
          picture: userInfo.data.picture || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      const redirectUrl = new URL('/dashboard', request.url);
      redirectUrl.searchParams.set('userId', existingUser.id);
      return NextResponse.redirect(redirectUrl);
    }

    // Insert new user
    await supabaseAdmin.from('users').insert(userData);

    // Initialize sync status
    await supabaseAdmin.from('sync_status').insert({
      user_id: userId,
      sync_in_progress: false,
      total_messages_synced: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('userId', userId);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}
