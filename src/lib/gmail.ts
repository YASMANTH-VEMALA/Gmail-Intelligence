import { google, gmail_v1 } from 'googleapis';
import { supabaseAdmin } from './supabase';
import type { EmailMessage } from '@/types';
import { categorizeEmailsBatch, generateEmbedding, summarizeEmailsBatch, summarizeThreadsBatch } from './gemini';
import { writeSyncLog } from './sync-logs';

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(userId: string) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('access_token, refresh_token, token_expiry')
    .eq('id', userId)
    .single();
  if (error || !user) throw new Error('User not found');

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
    expiry_date: new Date(user.token_expiry).getTime(),
  });

  oauth2Client.on('tokens', async (tokens) => {
    const updateData: Record<string, string> = { updated_at: new Date().toISOString() };
    if (tokens.access_token) updateData.access_token = tokens.access_token;
    if (tokens.refresh_token) updateData.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) updateData.token_expiry = new Date(tokens.expiry_date).toISOString();
    await supabaseAdmin.from('users').update(updateData).eq('id', userId);
  });

  return oauth2Client;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

type GmailApiError = {
  status?: number;
  code?: number;
  message?: string;
  errors?: { reason?: string }[];
  response?: {
    status?: number;
    headers?: Record<string, string | string[] | undefined>;
    data?: {
      error?: {
        message?: string;
        errors?: { reason?: string }[];
      };
    };
  };
};

function asGmailApiError(error: unknown): GmailApiError {
  return typeof error === 'object' && error !== null ? error as GmailApiError : {};
}

function getErrorStatus(error: unknown): number | undefined {
  const apiError = asGmailApiError(error);
  return apiError.status || apiError.code || apiError.response?.status;
}

function getErrorReasons(error: unknown): string[] {
  const apiError = asGmailApiError(error);
  const errors = apiError.errors || apiError.response?.data?.error?.errors || [];
  return errors
    .map((entry) => entry.reason)
    .filter((reason: unknown): reason is string => typeof reason === 'string');
}

function getRetryAfterMs(error: unknown): number | null {
  const apiError = asGmailApiError(error);
  const retryAfter = apiError.response?.headers?.['retry-after'];
  const value = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  if (!value) return null;

  const seconds = Number(value);
  if (!Number.isNaN(seconds)) return seconds * 1000;

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(retryAt - Date.now(), 0);
}

function isRetryableGmailError(error: unknown): boolean {
  const apiError = asGmailApiError(error);
  const status = getErrorStatus(error);
  const reasons = getErrorReasons(error);
  const message = String(apiError.message || apiError.response?.data?.error?.message || '');

  if (status === 429) return true;
  if (status && status >= 500 && status <= 504) return true;

  if (status === 403) {
    return reasons.some((reason) => ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason)) ||
      /rate limit|quota exceeded/i.test(message);
  }

  return /429|rate limit|quota exceeded/i.test(message);
}

class RateLimiter {
  private queue: (() => void)[] = [];
  private activeCount = 0;
  private maxConcurrency = 15; // Gmail concurrency limit
  private rateLimitPerSecond = 25; // Safe rate limit
  private maxRetries = 8;
  private requestTimestamps: number[] = [];
  private backoffMs = 0;
  private pausedUntil = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let retryCount = 0;

      const task = async () => {
        try {
          const result = await fn();
          this.backoffMs = 0; // Reset backoff on success
          this.pausedUntil = 0;
          resolve(result);
        } catch (error: unknown) {
          if (isRetryableGmailError(error) && retryCount < this.maxRetries) {
            retryCount++;
            const retryAfterMs = getRetryAfterMs(error);
            const exponentialMs = Math.min((this.backoffMs || 1000) * 2, 32000);
            const jitterMs = Math.round(Math.random() * 500);
            const pauseMs = Math.max(retryAfterMs || 0, exponentialMs + jitterMs);
            this.backoffMs = exponentialMs;
            this.pausedUntil = Date.now() + pauseMs;
            console.warn(`[RateLimiter] Gmail API quota/rate error. Backing off for ${pauseMs}ms (retry ${retryCount}/${this.maxRetries})`);

            // Re-enqueue at the front of the queue
            this.queue.unshift(task);
          } else {
            reject(error);
          }
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) return;
    if (this.activeCount >= this.maxConcurrency) return;

    // Check rate limit: count requests in the last 1000ms
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 1000);

    if (now < this.pausedUntil) {
      setTimeout(() => this.processQueue(), this.pausedUntil - now);
      return;
    }

    if (this.requestTimestamps.length >= this.rateLimitPerSecond) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 1000 - (now - oldestTimestamp);
      if (waitTime > 0) {
        setTimeout(() => this.processQueue(), waitTime);
        return;
      }
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    this.requestTimestamps.push(Date.now());

    task();
    this.processQueue();
  }
}

const rateLimiter = new RateLimiter();

function decodeBase64Url(data: string): string {
  try { return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'); }
  catch { return ''; }
}

function extractBody(payload: gmail_v1.Schema$MessagePart): { text: string; html: string } {
  let text = '', html = '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) text = decodeBase64Url(payload.body.data);
  else if (payload.mimeType === 'text/html' && payload.body?.data) html = decodeBase64Url(payload.body.data);
  if (payload.parts) for (const part of payload.parts) { const r = extractBody(part); if (r.text) text = r.text; if (r.html) html = r.html; }
  return { text, html };
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function parseAddresses(v: string): string[] {
  return v ? v.split(',').map((a) => a.trim()).filter(Boolean) : [];
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function normalizeEmailRecipients(recipients: string | string[] | null | undefined): string[] {
  const values = Array.isArray(recipients)
    ? recipients.flatMap((recipient) => String(recipient).split(/[,;\n]+/))
    : String(recipients || '').split(/[,;\n]+/);
  const seen = new Set<string>();

  return values
    .map((recipient) => sanitizeHeaderValue(recipient))
    .filter((recipient) => {
      if (!recipient) return false;
      const key = recipient.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatEmailRecipients(recipients: string | string[]): string {
  return normalizeEmailRecipients(recipients).join(', ');
}

function isInboxMessage(message: Pick<EmailMessage, 'labels'> | { labels?: string[] | null }) {
  return Array.isArray(message.labels) && message.labels.includes('INBOX');
}

export async function parseGmailMessage(message: gmail_v1.Schema$Message, userId: string): Promise<Partial<EmailMessage>> {
  const headers = message.payload?.headers;
  const { text, html } = extractBody(message.payload!);
  const from = getHeader(headers, 'From');
  const fromMatch = from.match(/(?:"?([^"]*)"?\s)?<?([^>]*)>?/);
  return {
    user_id: userId,
    gmail_id: message.id!,
    thread_id: message.threadId!,
    subject: getHeader(headers, 'Subject') || '(no subject)',
    from_address: fromMatch?.[2] || from,
    from_name: fromMatch?.[1] || fromMatch?.[2] || from,
    to_addresses: parseAddresses(getHeader(headers, 'To')),
    cc_addresses: parseAddresses(getHeader(headers, 'Cc')),
    bcc_addresses: parseAddresses(getHeader(headers, 'Bcc')),
    date: (() => {
      const rawDate = getHeader(headers, 'Date');
      if (rawDate) {
        let parsed = Date.parse(rawDate);
        if (!isNaN(parsed)) return new Date(parsed).toISOString();
        const cleaned = rawDate.replace(/\s*\([^)]*\)\s*$/, '').trim();
        parsed = Date.parse(cleaned);
        if (!isNaN(parsed)) return new Date(parsed).toISOString();
      }

      // Fallback to internalDate (always valid timestamp from Google)
      if (message.internalDate) {
        const parsedInternal = parseInt(message.internalDate, 10);
        if (!isNaN(parsedInternal)) {
          return new Date(parsedInternal).toISOString();
        }
      }

      return new Date().toISOString();
    })(),
    snippet: message.snippet || '',
    body_text: text || null,
    body_html: html || null,
    labels: message.labelIds || [],
    is_read: !message.labelIds?.includes('UNREAD'),
    is_starred: message.labelIds?.includes('STARRED') || false,
    has_attachments: message.payload?.parts?.some((p) => p.filename && p.filename.length > 0) || false,
    in_reply_to: getHeader(headers, 'In-Reply-To') || null,
    references: parseAddresses(getHeader(headers, 'References')),
    headers: Object.fromEntries((headers || []).map((h) => [h.name || '', h.value || ''])),
  };
}

/**
 * Fetch and parse a single Gmail message with retry and backoff on rate limits
 */
async function fetchAndParseMessage(
  gmail: gmail_v1.Gmail,
  userId: string,
  gmailId: string,
  retries = 5,
  delay = 1000
): Promise<Partial<EmailMessage>> {
  try {
    const res = await rateLimiter.execute(() =>
      gmail.users.messages.get({ userId: 'me', id: gmailId, format: 'full' })
    );
    return await parseGmailMessage(res.data, userId);
  } catch (error: unknown) {
    if (isRetryableGmailError(error) && retries > 0) {
      const jitter = Math.random() * 500;
      const nextDelay = delay * 2 + jitter;
      console.warn(`[Gmail Get] Rate limit hit for ${gmailId}. Retrying in ${Math.round(nextDelay)}ms... (${retries} left)`);
      await sleep(nextDelay);
      return fetchAndParseMessage(gmail, userId, gmailId, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Phase A: Enumerate message IDs and populate the sync_queue
 */
export async function enumerateMessages(gmail: gmail_v1.Gmail, userId: string) {
  const { data: syncStatus } = await supabaseAdmin
    .from('sync_status')
    .select('last_page_token, total_discovered, enumeration_done')
    .eq('user_id', userId)
    .single();

  if (syncStatus?.enumeration_done) {
    writeSyncLog(userId, 'Enumeration already completed previously.');
    return;
  }

  let pageToken: string | undefined = syncStatus?.last_page_token || undefined;
  let discoveredCount = syncStatus?.total_discovered || 0;

  writeSyncLog(userId, 'Starting Phase A: Message Enumeration...');

  await supabaseAdmin.from('sync_status').upsert({
    user_id: userId,
    sync_in_progress: true,
    phase: 'enumerating',
    updated_at: new Date().toISOString()
  });

  do {
    const res = await rateLimiter.execute(() =>
      gmail.users.messages.list({ userId: 'me', maxResults: 500, pageToken })
    );

    const messages = res.data.messages || [];
    if (messages.length > 0) {
      const queueItems = messages.map((m) => ({
        user_id: userId,
        gmail_id: m.id!,
        thread_id: m.threadId || null,
        status: 'pending',
        updated_at: new Date().toISOString()
      }));

      const { error: upsertError } = await supabaseAdmin
        .from('sync_queue')
        .upsert(queueItems, { onConflict: 'user_id,gmail_id' });

      if (upsertError) {
        console.error('[Enumerate] Queue upsert error:', upsertError);
        throw upsertError;
      }

      discoveredCount += messages.length;
    }

    pageToken = res.data.nextPageToken || undefined;

    await supabaseAdmin.from('sync_status').update({
      total_discovered: discoveredCount,
      last_page_token: pageToken || null,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);

    writeSyncLog(userId, `Discovered ${discoveredCount} messages...`);
  } while (pageToken);

  await supabaseAdmin.from('sync_status').update({
    enumeration_done: true,
    last_page_token: null,
    phase: 'hydrating',
    updated_at: new Date().toISOString()
  }).eq('user_id', userId);

  writeSyncLog(userId, `Phase A complete. Total discovered: ${discoveredCount} messages.`);
}

/**
 * Phase B: Hydrate messages in batches, performing inline categorization and embedding generation
 */
export async function hydrateMessagesBatch(gmail: gmail_v1.Gmail, userId: string, batchSize = 50) {
  const { data: queueItems, error: fetchError } = await supabaseAdmin
    .from('sync_queue')
    .select('gmail_id, thread_id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .limit(batchSize);

  if (fetchError) {
    console.error('[Hydrate] Error fetching queue:', fetchError);
    throw fetchError;
  }

  if (!queueItems || queueItems.length === 0) {
    return { processed: 0, finished: true };
  }

  const toInsert: Partial<EmailMessage>[] = [];
  const successIds: string[] = [];
  const threadIds = new Set<string>();
  let errorCount = 0;

  // 1. Download and parse emails from Gmail
  await Promise.all(
    queueItems.map(async (item) => {
      try {
        const parsedMsg = await fetchAndParseMessage(gmail, userId, item.gmail_id);
        toInsert.push(parsedMsg);
        successIds.push(item.gmail_id);
        if (parsedMsg.thread_id) {
          threadIds.add(parsedMsg.thread_id);
        }
      } catch (err: unknown) {
        errorCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Hydrate] Failed message ${item.gmail_id}:`, errMsg);

        await supabaseAdmin
          .from('sync_queue')
          .update({
            status: 'error',
            error_message: errMsg,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('gmail_id', item.gmail_id);
      }
    })
  );

  // 2. Perform INLINE AI Categorization and Embedding Generation (only for successfully fetched emails)
  if (toInsert.length > 0) {
    // A. Inline AI Categorization
    try {
      const categoryMap = await categorizeEmailsBatch(toInsert as EmailMessage[]);
      for (const email of toInsert) {
        email.category = categoryMap.get(email.gmail_id!) || 'uncategorized';
      }
    } catch (catErr) {
      console.error('[Hydrate] Batch categorization failed, fallback to uncategorized:', catErr);
      for (const email of toInsert) {
        email.category = 'uncategorized';
      }
    }

    // B. Inline context-aware summaries
    try {
      const threadContextById = new Map<string, EmailMessage[]>();

      if (threadIds.size > 0) {
        const { data: existingThreadMessages, error: existingThreadError } = await supabaseAdmin
          .from('emails')
          .select('*')
          .eq('user_id', userId)
          .in('thread_id', Array.from(threadIds))
          .order('date', { ascending: true });

        if (existingThreadError) throw existingThreadError;

        for (const message of existingThreadMessages || []) {
          const arr = threadContextById.get(message.thread_id) || [];
          arr.push(message as EmailMessage);
          threadContextById.set(message.thread_id, arr);
        }
      }

      for (const email of toInsert) {
        if (!email.thread_id) continue;
        const arr = threadContextById.get(email.thread_id) || [];
        const existingIndex = arr.findIndex((message) => message.gmail_id === email.gmail_id);
        if (existingIndex >= 0) arr[existingIndex] = email as EmailMessage;
        else arr.push(email as EmailMessage);
        arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        threadContextById.set(email.thread_id, arr);
      }

      const summaryMap = await summarizeEmailsBatch(
        toInsert.map((email) => ({
          email: email as EmailMessage,
          threadMessages: email.thread_id ? threadContextById.get(email.thread_id) : [email as EmailMessage],
        }))
      );

      for (const email of toInsert) {
        email.summary = summaryMap.get(email.gmail_id!) || null;
      }
    } catch (summaryErr) {
      console.error('[Hydrate] Batch summarization failed, saving emails without summaries:', summaryErr);
    }

    // C. Inline Embedding Generation (processed in parallel chunks of 10)
    const embeddingChunkSize = 10;
    for (let i = 0; i < toInsert.length; i += embeddingChunkSize) {
      const chunk = toInsert.slice(i, i + embeddingChunkSize);
      await Promise.all(
        chunk.map(async (email) => {
          try {
            const text = `Subject: ${email.subject}\nFrom: ${email.from_name}\n${(email.body_text || email.snippet || '').slice(0, 2000)}`;
            email.embedding = await generateEmbedding(text);
          } catch (embedErr) {
            console.error(`[Hydrate] Embedding generation failed for ${email.gmail_id}:`, embedErr);
            // Non-blocking: save without embedding, can be updated later
          }
        })
      );
    }

    // 3. Batch insert populated emails into Supabase
    const { error: upsertError } = await supabaseAdmin
      .from('emails')
      .upsert(
        toInsert.map((m) => ({
          ...m,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,gmail_id' }
      );

    if (upsertError) {
      console.error('[Hydrate] Database emails upsert failed:', upsertError);

      // Fallback: individual row updates on batch insert failure
      for (const item of toInsert) {
        try {
          const { error: singleError } = await supabaseAdmin
            .from('emails')
            .upsert({
              ...item,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,gmail_id' });

          if (singleError) throw singleError;

          await supabaseAdmin
            .from('sync_queue')
            .update({ status: 'synced', updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('gmail_id', item.gmail_id!);
        } catch (singleErr: unknown) {
          errorCount++;
          const singleErrMsg = singleErr instanceof Error ? singleErr.message : String(singleErr);
          await supabaseAdmin
            .from('sync_queue')
            .update({
              status: 'error',
              error_message: singleErrMsg,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('gmail_id', item.gmail_id!);
        }
      }
    } else {
      // Batch mark queue items as synced
      const { error: queueUpdateError } = await supabaseAdmin
        .from('sync_queue')
        .update({ status: 'synced', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .in('gmail_id', successIds);

      if (queueUpdateError) {
        console.error('[Hydrate] Error updating sync_queue status:', queueUpdateError);
      }
    }
  }

  // 4. Update parent thread records
  if (threadIds.size > 0) {
    try {
      await buildThreadRecords(userId, Array.from(threadIds));
    } catch (e) {
      console.error('[Hydrate] Error building thread records:', e);
    }
  }

  // 5. Update live sync statistics
  const { data: stats } = await supabaseAdmin
    .from('sync_status')
    .select('total_hydrated, total_errors')
    .eq('user_id', userId)
    .single();

  const currentHydrated = (stats?.total_hydrated || 0) + successIds.length;
  const currentErrors = (stats?.total_errors || 0) + errorCount;

  await supabaseAdmin
    .from('sync_status')
    .update({
      total_hydrated: currentHydrated,
      total_errors: currentErrors,
      total_messages_synced: currentHydrated,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  return {
    processed: queueItems.length,
    successCount: successIds.length,
    errorCount,
    finished: false
  };
}

async function findMissingRecentInboxMessages(gmail: gmail_v1.Gmail, userId: string, limit = 50) {
  const res = await rateLimiter.execute(() =>
    gmail.users.messages.list({
      userId: 'me',
      maxResults: limit,
      labelIds: ['INBOX'],
    })
  );

  const recentMessages = res.data.messages || [];
  const recentIds = recentMessages.map((message) => message.id).filter((id): id is string => Boolean(id));
  if (recentIds.length === 0) {
    return { checked: 0, missingIds: [] as string[] };
  }

  const { data: existingEmails, error } = await supabaseAdmin
    .from('emails')
    .select('gmail_id')
    .eq('user_id', userId)
    .in('gmail_id', recentIds);

  if (error) throw error;

  const existingIds = new Set((existingEmails || []).map((email) => email.gmail_id));
  const missingIds = recentIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    writeSyncLog(userId, `Recent inbox reconciliation found ${missingIds.length} missing message(s).`);
  }

  return { checked: recentIds.length, missingIds };
}

export async function syncEmails(userId: string, onProgress?: (c: number, t: number, m: string) => void) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  const { data: syncStatus } = await supabaseAdmin.from('sync_status').select('*').eq('user_id', userId).single();

  if (syncStatus?.last_history_id) {
    try {
      const r = await incrementalSync(gmail, userId, syncStatus.last_history_id, onProgress);
      return r;
    } catch (error: unknown) {
      const status = getErrorStatus(error);
      const message = asGmailApiError(error).message || String(error);
      if (status === 404 || message.includes('historyId')) {
        console.warn(`[Sync] historyId expired or not found. Resetting for full sync.`);
        writeSyncLog(userId, 'Incremental history expired. Resetting sync queue...');

        await supabaseAdmin.from('sync_queue').delete().eq('user_id', userId);
        await supabaseAdmin.from('sync_status').upsert({
          user_id: userId,
          enumeration_done: false,
          last_page_token: null,
          total_discovered: 0,
          total_hydrated: 0,
          total_errors: 0,
          phase: 'idle',
          updated_at: new Date().toISOString()
        });
      } else {
        throw error;
      }
    }
  }

  const fullSyncStartProfile = await rateLimiter.execute(() => gmail.users.getProfile({ userId: 'me' }));
  const fullSyncStartHistoryId = fullSyncStartProfile.data.historyId || null;

  // Phase A: Enumerate
  await enumerateMessages(gmail, userId);

  // Phase B: Hydrate loop (with inline categorization & embeddings)
  writeSyncLog(userId, 'Starting Phase B: Hydrating, classifying, and indexing messages...');
  await supabaseAdmin.from('sync_status').update({
    phase: 'hydrating',
    updated_at: new Date().toISOString()
  }).eq('user_id', userId);

  let finished = false;
  while (!finished) {
    const res = await hydrateMessagesBatch(gmail, userId, 50);
    if (res.finished) {
      finished = true;
      break;
    }

    const { data: currentStatus } = await supabaseAdmin
      .from('sync_status')
      .select('total_discovered, total_hydrated, total_errors')
      .eq('user_id', userId)
      .single();

    const discovered = currentStatus?.total_discovered || 0;
    const hydrated = currentStatus?.total_hydrated || 0;
    const errors = currentStatus?.total_errors || 0;

    writeSyncLog(userId, `Synced, classified, and indexed ${hydrated}/${discovered} messages (${errors} errors)...`);
    onProgress?.(hydrated, discovered, `Processed ${hydrated + errors}/${discovered}`);
  }

  const { data: finalStats } = await supabaseAdmin
    .from('sync_status')
    .select('total_hydrated, total_errors')
    .eq('user_id', userId)
    .single();

  await supabaseAdmin.from('sync_status').upsert({
    user_id: userId,
    last_sync_at: new Date().toISOString(),
    last_history_id: fullSyncStartHistoryId,
    total_messages_synced: finalStats?.total_hydrated || 0,
    sync_in_progress: false,
    phase: 'complete',
    updated_at: new Date().toISOString(),
  });

  return {
    synced: finalStats?.total_hydrated || 0,
    errors: finalStats?.total_errors || 0
  };
}

async function incrementalSync(
  gmail: gmail_v1.Gmail,
  userId: string,
  historyId: string,
  onProgress?: (c: number, t: number, m: string) => void
) {
  let synced = 0, errors = 0;
  let pageToken: string | undefined;
  let nextHistoryId: string | undefined;
  const changed = new Set<string>();
  const deletedIds = new Set<string>();

  onProgress?.(0, 0, 'Checking for incremental updates...');
  writeSyncLog(userId, 'Running incremental updates sync...');

  do {
    const res = await rateLimiter.execute(() =>
      gmail.users.history.list({ userId: 'me', startHistoryId: historyId, pageToken })
    );
    if (res.data.historyId) nextHistoryId = res.data.historyId;

    for (const r of (res.data.history || [])) {
      for (const m of (r.messagesAdded || [])) if (m.message?.id) changed.add(m.message.id);
      for (const m of (r.labelsAdded || [])) if (m.message?.id) changed.add(m.message.id);
      for (const m of (r.labelsRemoved || [])) if (m.message?.id) changed.add(m.message.id);
      for (const m of (r.messagesDeleted || [])) {
        if (m.message?.id) {
          deletedIds.add(m.message.id);
          changed.delete(m.message.id);
        }
      }
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  const recentInbox = await findMissingRecentInboxMessages(gmail, userId);
  for (const id of recentInbox.missingIds) {
    changed.add(id);
  }

  if (deletedIds.size > 0) {
    console.log(`[IncrementalSync] Deleting ${deletedIds.size} messages from database...`);
    writeSyncLog(userId, `Deleting ${deletedIds.size} message(s) from local database...`);
    const deletedArr = Array.from(deletedIds);
    const deletedThreadIds = new Set<string>();

    for (let i = 0; i < deletedArr.length; i += 100) {
      const { data: deletedEmails } = await supabaseAdmin
        .from('emails')
        .select('thread_id')
        .eq('user_id', userId)
        .in('gmail_id', deletedArr.slice(i, i + 100));

      for (const email of deletedEmails || []) {
        if (email.thread_id) deletedThreadIds.add(email.thread_id);
      }
    }

    for (let i = 0; i < deletedArr.length; i += 100) {
      await supabaseAdmin
        .from('emails')
        .delete()
        .eq('user_id', userId)
        .in('gmail_id', deletedArr.slice(i, i + 100));

      await supabaseAdmin
        .from('sync_queue')
        .delete()
        .eq('user_id', userId)
        .in('gmail_id', deletedArr.slice(i, i + 100));
    }

    const affectedThreadIds = Array.from(deletedThreadIds);
    if (affectedThreadIds.length > 0) {
      const { data: remainingThreadRows } = await supabaseAdmin
        .from('emails')
        .select('thread_id')
        .eq('user_id', userId)
        .in('thread_id', affectedThreadIds);

      const remainingThreadIds = Array.from(new Set((remainingThreadRows || []).map((row) => row.thread_id).filter(Boolean)));
      const emptyThreadIds = affectedThreadIds.filter((threadId) => !remainingThreadIds.includes(threadId));

      if (remainingThreadIds.length > 0) {
        await buildThreadRecords(userId, remainingThreadIds);
      }

      if (emptyThreadIds.length > 0) {
        await supabaseAdmin
          .from('threads')
          .delete()
          .eq('user_id', userId)
          .in('gmail_thread_id', emptyThreadIds);
      }
    }
  }

  const changedArr = Array.from(changed);
  if (changedArr.length > 0) {
    writeSyncLog(userId, `Discovered ${changedArr.length} new/changed messages. Processing...`);

    const queueItems = changedArr.map((id) => ({
      user_id: userId,
      gmail_id: id,
      status: 'pending',
      updated_at: new Date().toISOString()
    }));

    await supabaseAdmin.from('sync_queue').upsert(queueItems, { onConflict: 'user_id,gmail_id' });

    let finished = false;
    while (!finished) {
      const res = await hydrateMessagesBatch(gmail, userId, 20);
      if (res.finished) {
        finished = true;
      }
      synced += res.successCount || 0;
      errors += res.errorCount || 0;
    }
  }

  await supabaseAdmin.from('sync_status').update({
    last_sync_at: new Date().toISOString(),
    last_history_id: nextHistoryId || historyId,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);

  writeSyncLog(userId, `Incremental sync complete: ${synced} messages updated, ${errors} errors.`);
  return { synced, errors };
}

async function buildThreadRecords(userId: string, updatedThreadIds: string[]) {
  if (updatedThreadIds.length === 0) return;

  const { data: emails, error } = await supabaseAdmin
    .from('emails')
    .select('thread_id, subject, from_address, from_name, date, snippet, body_text, labels, category, summary')
    .eq('user_id', userId)
    .in('thread_id', updatedThreadIds)
    .order('date', { ascending: true });

  if (error || !emails || emails.length === 0) return;

  const map = new Map<string, typeof emails>();
  for (const e of emails) {
    const arr = map.get(e.thread_id) || [];
    arr.push(e);
    map.set(e.thread_id, arr);
  }

  const threadSummaries = await summarizeThreadsBatch(
    Array.from(map.entries())
      .filter(([, msgs]) => msgs.length > 1)
      .map(([threadId, messages]) => ({ threadId, messages: messages as EmailMessage[] }))
  );

	  const records = [];
	  for (const [tid, msgs] of map.entries()) {
	    const mailboxMessages = msgs.filter(isInboxMessage);
	    const categoryMessages = mailboxMessages.length > 0 ? mailboxMessages : msgs;
	    const categories = categoryMessages.map(m => m.category).filter(Boolean);
	    const category = categories[categories.length - 1] || 'uncategorized';
    const summary = msgs.length === 1
      ? msgs[0].summary || msgs[0].snippet || null
      : threadSummaries.get(tid) || null;

    records.push({
      user_id: userId,
      gmail_thread_id: tid,
      subject: msgs[0].subject,
      participants: [...new Set(msgs.map((m) => m.from_address).filter(Boolean))],
      message_count: msgs.length,
      last_message_date: msgs[msgs.length - 1].date,
      snippet: msgs[msgs.length - 1].snippet,
      labels: [...new Set(msgs.flatMap((m) => m.labels || []))],
      category,
      summary,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < records.length; i += 100) {
    await supabaseAdmin.from('threads').upsert(records.slice(i, i + 100), { onConflict: 'user_id,gmail_thread_id' });
  }
}

export async function runSyncPipeline(userId: string) {
  try {
    writeSyncLog(userId, 'Starting sync pipeline...', false);

    await supabaseAdmin.from('sync_status').upsert({
      user_id: userId,
      sync_in_progress: true,
      phase: 'hydrating',
      updated_at: new Date().toISOString()
    });

    writeSyncLog(userId, 'Connecting to Gmail API and checking authentication...');

    // Run Enumerate and Hydrate phases (which now do categorization + embeddings inline!)
    const { synced, errors } = await syncEmails(userId, async (current, total, message) => {
      writeSyncLog(userId, message);
    });

    writeSyncLog(userId, `Gmail download and processing complete: ${synced} messages successfully synced, classified, and indexed (${errors} errors).`);

    // Backward compatibility scan: check for any old emails that have missing category
    let categorizedCount = 0;
    while (true) {
      const { data: uncategorized } = await supabaseAdmin
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .is('category', null)
        .limit(100);

      if (!uncategorized || uncategorized.length === 0) {
        break;
      }

      writeSyncLog(userId, `Running background categorization for batch of ${uncategorized.length} legacy emails...`);
      const results = await categorizeEmailsBatch(uncategorized as EmailMessage[]);

      const threadIdsToUpdate = new Set<string>();
      await Promise.all(Array.from(results).map(async ([gmailId, category]) => {
        const email = uncategorized.find((e) => e.gmail_id === gmailId);
        if (email) {
          await supabaseAdmin
            .from('emails')
            .update({ category, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('gmail_id', gmailId);
          threadIdsToUpdate.add(email.thread_id);
        }
      }));

      if (threadIdsToUpdate.size > 0) {
        await buildThreadRecords(userId, Array.from(threadIdsToUpdate));
      }

      categorizedCount += uncategorized.length;
      writeSyncLog(userId, `Categorized ${categorizedCount} legacy emails...`);
    }

    // Recover any missing thread records for all emails in the database
    const { data: allEmailThreads } = await supabaseAdmin
      .from('emails')
      .select('thread_id')
      .eq('user_id', userId);

    if (allEmailThreads && allEmailThreads.length > 0) {
      const emailThreadIds = Array.from(new Set(allEmailThreads.map((e) => e.thread_id).filter(Boolean)));

      const { data: existingThreads } = await supabaseAdmin
        .from('threads')
        .select('gmail_thread_id')
        .eq('user_id', userId);

      const existingThreadIds = new Set(existingThreads?.map((t) => t.gmail_thread_id) || []);
      const missingThreadIds = emailThreadIds.filter((id) => !existingThreadIds.has(id));

      if (missingThreadIds.length > 0) {
        writeSyncLog(userId, `Recovering ${missingThreadIds.length} missing thread records...`);
        const chunkSize = 50;
        for (let i = 0; i < missingThreadIds.length; i += chunkSize) {
          const chunk = missingThreadIds.slice(i, i + chunkSize);
          await buildThreadRecords(userId, chunk);
        }
        writeSyncLog(userId, `Recovered all missing thread records.`);
      }
    }

    // Backfill context-aware summaries for any emails that predate inline summarization.
    let summarizedCount = 0;
    while (true) {
      const { data: unsummarized } = await supabaseAdmin
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .is('summary', null)
        .order('date', { ascending: false })
        .limit(20);

      if (!unsummarized || unsummarized.length === 0) {
        break;
      }

      writeSyncLog(userId, `Generating context-aware summaries for batch of ${unsummarized.length} emails...`);
      await supabaseAdmin
        .from('sync_status')
        .update({ phase: 'hydrating', updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      const threadIds = Array.from(new Set(unsummarized.map((email) => email.thread_id).filter(Boolean)));
      const threadContextById = new Map<string, EmailMessage[]>();

      if (threadIds.length > 0) {
        const { data: contextMessages } = await supabaseAdmin
          .from('emails')
          .select('*')
          .eq('user_id', userId)
          .in('thread_id', threadIds)
          .order('date', { ascending: true });

        for (const message of contextMessages || []) {
          const arr = threadContextById.get(message.thread_id) || [];
          arr.push(message as EmailMessage);
          threadContextById.set(message.thread_id, arr);
        }
      }

      const summaries = await summarizeEmailsBatch((unsummarized as EmailMessage[]).map((email) => ({
        email,
        threadMessages: threadContextById.get(email.thread_id) || [email],
      })));

      await Promise.all(Array.from(summaries).map(([gmailId, summary]) =>
        supabaseAdmin
          .from('emails')
          .update({ summary, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('gmail_id', gmailId)
      ));

      if (threadIds.length > 0) {
        await buildThreadRecords(userId, threadIds);
      }

      summarizedCount += unsummarized.length;
      await supabaseAdmin
        .from('sync_status')
        .update({ phase: 'hydrating', updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      writeSyncLog(userId, `Generated ${summarizedCount} email summaries...`);
    }

    // Embed legacy emails
    let embeddedCount = 0;
    while (true) {
      const { data: unembedded } = await supabaseAdmin
        .from('emails')
        .select('gmail_id, subject, from_name, body_text, snippet')
        .eq('user_id', userId)
        .is('embedding', null)
        .limit(100);

      if (!unembedded || unembedded.length === 0) {
        break;
      }

      writeSyncLog(userId, `Generating search embeddings for batch of ${unembedded.length} emails...`);
      const embeddingChunkSize = 10;
      for (let i = 0; i < unembedded.length; i += embeddingChunkSize) {
        const chunk = unembedded.slice(i, i + embeddingChunkSize);
        await Promise.all(chunk.map(async (email) => {
          try {
            const text = `Subject: ${email.subject}\nFrom: ${email.from_name}\n${(email.body_text || email.snippet || '').slice(0, 2000)}`;
            const embedding = await generateEmbedding(text);
            await supabaseAdmin
              .from('emails')
              .update({ embedding, updated_at: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('gmail_id', email.gmail_id);
          } catch (e) {
            console.error(`[SyncPipeline] Legacy embedding error for ${email.gmail_id}:`, e);
          }
        }));
      }

      embeddedCount += unembedded.length;
      writeSyncLog(userId, `Generated ${embeddedCount} legacy embeddings...`);
    }

    await supabaseAdmin.from('sync_status').update({
      phase: 'complete',
      sync_in_progress: false,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    writeSyncLog(userId, `Sync Pipeline error: ${errMsg}`);
    console.error(`[SyncPipeline] Pipeline failed for user ${userId}:`, error);
    await supabaseAdmin.from('sync_status').update({
      phase: 'error',
      sync_in_progress: false,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);
  } finally {
    writeSyncLog(userId, 'Sync pipeline finished. Inbox is up-to-date.');
  }
}

export async function sendEmail(
  userId: string,
  to: string | string[],
  subject: string,
  body: string,
  inReplyTo?: string,
  references?: string[],
  threadId?: string,
  attachments?: { filename: string; mimeType: string; content: string }[]
) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  const boundary = 'repeatless_mixed_boundary_' + Date.now().toString(16);
  const toHeader = formatEmailRecipients(to);
  if (!toHeader) throw new Error('Missing recipient');

  const hdrs = [
    `To: ${toHeader}`,
    `Subject: ${sanitizeHeaderValue(subject)}`,
    `MIME-Version: 1.0`,
  ];
  if (inReplyTo) hdrs.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyTo)}`);
  if (references?.length) hdrs.push(`References: ${references.map(sanitizeHeaderValue).filter(Boolean).join(' ')}`);

  let rawContent = '';

  if (attachments && attachments.length > 0) {
    hdrs.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    rawContent += hdrs.join('\r\n') + '\r\n\r\n';

    rawContent += `--${boundary}\r\n`;
    rawContent += `Content-Type: text/html; charset=utf-8\r\n`;
    rawContent += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    rawContent += body + '\r\n';

    for (const att of attachments) {
      rawContent += `--${boundary}\r\n`;
      rawContent += `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n`;
      rawContent += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
      rawContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
      const base64Data = att.content.includes('base64,')
        ? att.content.split('base64,')[1]
        : att.content;
      rawContent += base64Data + '\r\n';
    }
    rawContent += `--${boundary}--`;
  } else {
    hdrs.push(`Content-Type: text/html; charset=utf-8`);
    rawContent = [...hdrs, '', body].join('\r\n');
  }

  const raw = Buffer.from(rawContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await rateLimiter.execute(() => gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId: threadId || undefined } }));
  const sentMessageId = res.data.id!;

  // Immediately fetch the sent message back and store it locally
  try {
    const sentRes = await rateLimiter.execute(() =>
      gmail.users.messages.get({ userId: 'me', id: sentMessageId, format: 'full' })
    );
    const parsed = await parseGmailMessage(sentRes.data, userId);

    // Upsert into emails table
    await supabaseAdmin.from('emails').upsert({
      ...parsed,
      category: 'personal', // Sent replies default to personal
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,gmail_id' });

    // Update thread metadata
    const actualThreadId = parsed.thread_id || threadId;
    if (actualThreadId) {
      const { data: threadMsgs } = await supabaseAdmin
        .from('emails')
        .select('from_name, from_address, date')
        .eq('user_id', userId)
        .eq('thread_id', actualThreadId)
        .order('date', { ascending: false });

      if (threadMsgs && threadMsgs.length > 0) {
        const participants = [...new Set(threadMsgs.map(m => m.from_name || m.from_address))];
        await supabaseAdmin.from('threads').upsert({
          user_id: userId,
          gmail_thread_id: actualThreadId,
          subject: parsed.subject,
          snippet: parsed.snippet,
          last_message_date: threadMsgs[0].date,
          message_count: threadMsgs.length,
          participants,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,gmail_thread_id' });
      }
    }

    console.log(`[Gmail] Sent message ${sentMessageId} saved locally to thread ${parsed.thread_id || threadId}`);
  } catch (syncErr) {
    console.warn('[Gmail] Failed to sync sent message locally (will appear on next full sync):', syncErr);
  }

  return sentMessageId;
}

export async function createDraft(
  userId: string,
  to: string | string[],
  subject: string,
  body: string,
  threadId?: string
) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  const toHeader = formatEmailRecipients(to);
  if (!toHeader) throw new Error('Missing recipient');

  const hdrs = [
    `To: ${toHeader}`,
    `Subject: ${sanitizeHeaderValue(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`
  ];
  const rawContent = [...hdrs, '', body].join('\r\n');
  const raw = Buffer.from(rawContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await rateLimiter.execute(() =>
    gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw,
          threadId: threadId || undefined
        }
      }
    })
  );
  return res.data.id!;
}

export async function modifyMessageLabels(
  userId: string,
  gmailId: string,
  addLabelIds: string[],
  removeLabelIds: string[]
) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  // 1. Update Gmail API
  const res = await rateLimiter.execute(() =>
    gmail.users.messages.modify({
      userId: 'me',
      id: gmailId,
      requestBody: {
        addLabelIds,
        removeLabelIds
      }
    })
  );

  const updatedLabels = res.data.labelIds || [];

  // 2. Fetch the local email to find its thread_id
  const { data: email } = await supabaseAdmin
    .from('emails')
    .select('thread_id')
    .eq('user_id', userId)
    .eq('gmail_id', gmailId)
    .single();

  // 3. Update local Supabase DB
  const isRead = !updatedLabels.includes('UNREAD');
  const isStarred = updatedLabels.includes('STARRED');

  await supabaseAdmin
    .from('emails')
    .update({
      labels: updatedLabels,
      is_read: isRead,
      is_starred: isStarred,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('gmail_id', gmailId);

  // 4. Update thread record if thread_id exists
  if (email?.thread_id) {
    await buildThreadRecords(userId, [email.thread_id]);
  }

  return { success: true, labels: updatedLabels };
}
