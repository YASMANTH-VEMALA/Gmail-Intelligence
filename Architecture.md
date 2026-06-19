# Architecture & Design Document

## 1. System Architecture

Repeatless is a full-stack Next.js application. The frontend, API routes, Gmail integration, AI orchestration, and Supabase persistence live in one repository.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Frontend - Next.js App Router / React / Zustand                    │
│                                                                    │
│ Landing Page                                                       │
│   └─ Connect with Gmail → /api/auth/gmail                          │
│                                                                    │
│ Dashboard                                                          │
│   ├─ Sidebar: user, category filters, compose, sync, logout         │
│   ├─ EmailList: threads/messages/search/newsletter digest           │
│   ├─ EmailDetail: thread reader, summaries, reply                   │
│   ├─ ComposeModal / ReplyModal                                     │
│   ├─ ChatPanel: Ask/Agent mode, sources, action confirmations       │
│   └─ SyncTerminal: live log/status polling                          │
└───────────────────────────────┬────────────────────────────────────┘
                                │ fetch()
┌───────────────────────────────┴────────────────────────────────────┐
│ Backend - Next.js API Routes                                       │
│                                                                    │
│ /api/auth/*        OAuth URL, callback, session lookup              │
│ /api/emails/*      list/detail/sync/hydrate/logs                    │
│ /api/compose       Gemini draft generation and Gmail send           │
│ /api/reply         thread-aware reply generation and Gmail send      │
│ /api/chat          Gemini tool-calling agent                        │
│ /api/summarize     email/thread summaries                           │
│ /api/categorize    manual categorization + category counts          │
│ /api/embed         embedding backfill                               │
│ /api/newsletter    newsletter deduplication                         │
└───────────────┬───────────────────┬──────────────────┬─────────────┘
                │                   │                  │
                │                   │                  │
┌───────────────▼──────────────┐ ┌──▼──────────────┐ ┌─▼──────────────┐
│ Gmail API                     │ │ Google Gemini   │ │ NVIDIA NIM     │
│ OAuth, list, get, send,       │ │ drafts, replies,│ │ classification,│
│ drafts, labels, history       │ │ summaries,      │ │ rerank helper, │
│                               │ │ embeddings,     │ │ deep analysis  │
│                               │ │ tool calling    │ │                │
└───────────────┬──────────────┘ └──┬──────────────┘ └─┬──────────────┘
                │                   │                  │
┌───────────────▼───────────────────▼──────────────────▼─────────────┐
│ Supabase PostgreSQL                                                 │
│ users, emails, threads, sync_status, sync_queue                     │
│ pgvector IVFFlat index + match_emails() RPC                         │
└────────────────────────────────────────────────────────────────────┘
```

### Interaction Flow

1. The landing page requests `/api/auth/gmail`, which returns a Google OAuth URL.
2. Google redirects to `/api/auth/callback`; the app exchanges the code for tokens, fetches profile data, and stores/updates the user in Supabase.
3. The dashboard stores `repeatless_user_id` in local storage and validates it through `/api/auth/session`.
4. The dashboard triggers `/api/emails/sync` automatically and on demand.
5. Sync enumerates Gmail message IDs into `sync_queue`, hydrates each message, categorizes/summarizes/embeds it, upserts into `emails`, and rebuilds `threads`.
6. UI polling reads `/api/emails`, `/api/emails/[id]`, `/api/categorize`, and `/api/emails/sync`.
7. Compose/reply routes call Gemini when drafting, then call Gmail send with MIME-formatted HTML and optional attachments.
8. Chat calls `/api/chat`; Gemini runs in Ask or Agent mode, local tool handlers query Supabase or Gmail, source references are returned to the UI, and risky Gmail mutations return a pending confirmation before execution.

### Queues And Background Work

There is no external worker service such as Redis/Bull. The app uses:

- `sync_queue` in Supabase as a persistent resumable queue of Gmail message IDs.
- `sync_status` for phase/progress counters.
- Fire-and-forget execution from `/api/emails/sync`, where `runSyncPipeline(userId)` continues in the server process.
- Local JSON log files in `src/tmp_logs` for the SyncTerminal UI.

This is intentionally simple for a single-deploy project, while still allowing interrupted syncs to resume from database state.

---

## 2. Database Schema

The full SQL is in `supabase/schema.sql` and `supabase/migration_sync_queue.sql`.

### Extensions

- `vector`: stores Gemini email embeddings and supports cosine similarity search.
- `pg_trgm`: supports trigram indexing for subject search.

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Internal user ID. |
| `email` | `TEXT NOT NULL UNIQUE` | Gmail account email. |
| `name` | `TEXT` | Google profile name. |
| `picture` | `TEXT` | Google profile picture URL. |
| `access_token` | `TEXT NOT NULL` | Gmail OAuth access token. |
| `refresh_token` | `TEXT NOT NULL` | Gmail OAuth refresh token. |
| `token_expiry` | `TIMESTAMPTZ NOT NULL` | Access token expiry. |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Last update time. |

Indexes:

- `idx_users_email` on `email`.

Decision: the app stores Gmail tokens server-side in Supabase so API routes can refresh tokens and call Gmail without asking the user to re-authenticate every session.

### `emails`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Internal row ID. |
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owner. |
| `gmail_id` | `TEXT NOT NULL` | Gmail message ID. |
| `thread_id` | `TEXT NOT NULL` | Gmail thread ID. |
| `subject` | `TEXT` | Subject header. |
| `from_address` | `TEXT` | Sender address. |
| `from_name` | `TEXT` | Sender display name. |
| `to_addresses` | `TEXT[] DEFAULT '{}'` | Parsed To recipients. |
| `cc_addresses` | `TEXT[] DEFAULT '{}'` | Parsed Cc recipients. |
| `bcc_addresses` | `TEXT[] DEFAULT '{}'` | Parsed Bcc recipients. |
| `date` | `TIMESTAMPTZ` | Parsed Date header, fallback to Gmail internal date. |
| `snippet` | `TEXT` | Gmail snippet. |
| `body_text` | `TEXT` | Plain text body. |
| `body_html` | `TEXT` | HTML body. |
| `labels` | `TEXT[] DEFAULT '{}'` | Gmail label IDs. |
| `is_read` | `BOOLEAN DEFAULT TRUE` | Derived from `UNREAD` label. |
| `is_starred` | `BOOLEAN DEFAULT FALSE` | Derived from `STARRED` label. |
| `has_attachments` | `BOOLEAN DEFAULT FALSE` | Attachment presence flag. |
| `in_reply_to` | `TEXT` | Email threading header. |
| `references` | `TEXT[] DEFAULT '{}'` | Email references header. |
| `headers` | `JSONB DEFAULT '{}'` | Original headers for threading/context. |
| `summary` | `TEXT` | AI-generated context-aware summary. |
| `category` | `TEXT CHECK (...)` | One of the supported mailbox categories. |
| `embedding` | `vector(768)` | Gemini semantic embedding. |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Last update time. |

Constraints and indexes:

- `UNIQUE(user_id, gmail_id)` prevents duplicate Gmail messages per user.
- `idx_emails_user_id` on `user_id`.
- `idx_emails_thread_id` on `(user_id, thread_id)`.
- `idx_emails_date` on `(user_id, date DESC)`.
- `idx_emails_category` on `(user_id, category)`.
- `idx_emails_from` on `(user_id, from_address)`.
- `idx_emails_subject` GIN trigram index on `subject`.
- `idx_emails_embedding` IVFFlat index on `embedding vector_cosine_ops`.

Decision: `emails` is the canonical searchable document table. It stores both raw metadata and AI-enriched fields so listing, chat, and detail views do not need to re-call Gmail for every interaction.

### `threads`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Internal row ID. |
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owner. |
| `gmail_thread_id` | `TEXT NOT NULL` | Gmail thread ID. |
| `subject` | `TEXT` | Thread subject. |
| `participants` | `TEXT[] DEFAULT '{}'` | Unique participant list. |
| `message_count` | `INTEGER DEFAULT 0` | Number of local messages in thread. |
| `last_message_date` | `TIMESTAMPTZ` | Most recent message date. |
| `snippet` | `TEXT` | Latest snippet. |
| `labels` | `TEXT[] DEFAULT '{}'` | Aggregate labels. |
| `summary` | `TEXT` | Thread-level summary. |
| `category` | `TEXT CHECK (...)` | Dominant/latest category. |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Last update time. |

Constraints and indexes:

- `UNIQUE(user_id, gmail_thread_id)`.
- `idx_threads_user_id` on `user_id`.
- `idx_threads_date` on `(user_id, last_message_date DESC)`.
- `idx_threads_category` on `(user_id, category)`.

Decision: thread rows are denormalized summaries for fast inbox rendering. Full message context still comes from `emails`.

### `sync_status`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE` | One sync state per user. |
| `last_sync_at` | `TIMESTAMPTZ` | Last completed sync. |
| `last_history_id` | `TEXT` | Gmail history cursor for incremental sync. |
| `total_messages_synced` | `INTEGER DEFAULT 0` | Backward-compatible count. |
| `sync_in_progress` | `BOOLEAN DEFAULT FALSE` | Active sync flag. |
| `phase` | `TEXT DEFAULT 'idle' CHECK (...)` | `idle`, `enumerating`, `hydrating`, `categorizing`, `embedding`, `complete`, `error`. |
| `total_discovered` | `INTEGER DEFAULT 0` | Message IDs found during enumeration. |
| `total_hydrated` | `INTEGER DEFAULT 0` | Messages fetched and stored. |
| `total_errors` | `INTEGER DEFAULT 0` | Sync errors. |
| `last_page_token` | `TEXT` | Gmail page cursor for resumable enumeration. |
| `enumeration_done` | `BOOLEAN DEFAULT FALSE` | Whether initial enumeration finished. |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Last update time. |

Decision: `sync_status` allows the dashboard and terminal to poll progress and allows stale syncs to resume.

### `sync_queue`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Internal row ID. |
| `user_id` | `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owner. |
| `gmail_id` | `TEXT NOT NULL` | Gmail message ID to hydrate. |
| `thread_id` | `TEXT` | Gmail thread ID if known from listing. |
| `status` | `TEXT NOT NULL DEFAULT 'pending' CHECK (...)` | `pending`, `synced`, or `error`. |
| `error_message` | `TEXT` | Last hydration error. |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Creation time. |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Last update time. |

Constraints and indexes:

- `UNIQUE(user_id, gmail_id)`.
- `idx_sync_queue_user_status` on `(user_id, status)`.
- `idx_sync_queue_user_pending` partial index on `user_id WHERE status = 'pending'`.

Decision: `sync_queue` gives the app a lightweight durable queue without operating a separate queue service.

### `match_emails()` RPC

`match_emails(query_embedding, match_threshold, match_count, p_user_id)` returns emails whose stored embedding has cosine similarity above the threshold, ordered by nearest vector distance.

### pgvector Design

What is embedded:

```text
Subject: <subject>
From: <from_name>
<body_text or snippet, truncated to 2000 characters>
```

Why:

- Subject captures topic.
- Sender captures entity/person context.
- Body/snippet captures semantic content.
- 768-dimensional vectors from Gemini `gemini-embedding-2` fit the `vector(768)` schema and support natural language retrieval.

This allows searches like "project delay", "flight receipts", or "job interview updates" to match semantically related emails even when the exact words differ.

### Row Level Security

RLS is enabled on all core tables. Current policies allow service-role access for backend API routes. This keeps browser clients from directly querying private data, but a production system should add user-scoped policies and real session auth rather than relying on service-role routes plus a client-supplied `userId`.

---

## 3. AI Design

### Email Summarization

The app uses Gemini `gemini-2.5-flash` for summaries.

Individual email summaries:

- `summarizeEmail(email, threadMessages)` sorts the full thread chronologically.
- The target email is marked with `[TARGET EMAIL]`.
- Each message contributes sender, date, subject, and up to 1600 characters of text.
- The total prompt is capped around 9000 characters.
- The prompt asks for a 1-2 sentence summary focused on purpose, concrete asks, decisions, deadlines, or important updates.

Batch email summaries:

- `summarizeEmailsBatch()` processes chunks of 5 target emails.
- Each target includes up to 1200 characters from the email and up to 800 characters from each thread-context message.
- Gemini is asked to return JSON, and missing/failed rows fall back to individual summarization.

Thread summaries:

- `summarizeThread()` sorts messages chronologically.
- Each message is truncated to 1600 characters.
- Combined context is capped around 8000 characters.
- The prompt asks for a conversation arc: topic, progression, decisions/facts, current status, and action items.

Batch thread summaries:

- `summarizeThreadsBatch()` processes chunks of 8 threads.
- Each message contributes up to 900 characters.
- Gemini returns JSON keyed by `thread_id`, with individual fallback.

Long-thread strategy:

- Preserve chronological order.
- Mark the target email when summarizing one message inside a thread.
- Truncate per-message and full-prompt content to fit within reliable context limits.
- Prefer recent stored summaries/snippets as fallbacks if generation fails.

### Chat Agent Retrieval And RAG Pipeline

The chat endpoint calls `runAgentConversation()` in `src/lib/agent.ts`.

1. **Prompt/context construction**
   - If a user has selected an email, `ChatPanel` appends a `[CONTEXT: Currently viewing email]` block containing the current thread.
   - The agent system instruction tells Gemini to use that context directly.

2. **Mode-aware tool-calling agent**
   - `ChatPanel` sends `mode='assistant'` for Ask mode or `mode='agent'` for Agent mode.
   - Ask mode only exposes read tools:
     - `search_emails`
     - `get_email_thread`
   - Agent mode exposes the full tool set:
     - `search_emails`
     - `get_email_thread`
     - `create_draft`
     - `send_email`
     - `modify_labels`
     - `modify_thread_labels`
     - `sync_inbox`
   - The system instruction changes with the mode. Ask mode is read-only; Agent mode can create drafts, sync Gmail, and prepare Gmail mutations.

3. **Action confirmation**
   - `create_draft` and `sync_inbox` execute directly in Agent mode.
   - `send_email`, `modify_labels`, and `modify_thread_labels` are intercepted by the runtime before execution.
   - The API returns a typed `pendingAction` with title, description, arguments, confirmation label, and risk level.
   - The UI renders a preview card. Only after the user confirms does `/api/chat` call `executeConfirmedAgentAction()` and run the tool.

4. **Semantic retrieval**
   - `search_emails` embeds the query with Gemini `gemini-embedding-2`.
   - It calls Supabase `match_emails()` with threshold `0.45` and count `15`.

5. **Text fallback**
   - If fewer than 5 vector results return, the tool runs keyword fallback over subject, body text, and sender name.

6. **Optional category filter**
   - Tool results can be filtered by category when Gemini supplies a category.

7. **Optional reranking helper**
   - `src/lib/nvidia.ts` includes `nvidiaRerank()` for LLM-based ordering of candidate documents.
   - The current active chat route does not call this helper; it relies on vector order, keyword fallback, and optional deep reasoning.

8. **Optional deep reasoning**
   - Analytical queries are detected with heuristics such as summarize/analyze/trend/compare.
   - If tools returned context, the app can pass that retrieved context to NVIDIA Nemotron for deeper synthesis.

9. **Final answer and sources**
   - The final response plus tool activity and source metadata are returned to the UI.
   - Chat source badges open the referenced emails in the dashboard.

### Source Clarity

Source clarity is maintained in several layers:

- Tool results include `gmail_id`, `thread_id`, sender, subject, date, snippet, labels, category, and a body excerpt.
- `runAgentConversation()` collects searched emails into a `sourcesMap`.
- The system prompt requires citations with sender, subject, and date.
- The UI renders "Reference Sources" badges under assistant messages and clicking a badge loads the original email/thread.
- For selected-email chat, the context block includes Gmail message IDs and thread IDs for the selected email and each message in the thread.

### NVIDIA NIM Model Choice

The project uses NVIDIA NIM in two roles:

1. **Fast secondary model**: `meta/llama-3.1-8b-instruct`
   - Used for alternate email categorization.
   - Provides the implemented `nvidiaRerank()` helper for LLM-based ordering of candidate search results.
   - Chosen because classification and relevance ordering are short, structured tasks that do not require the primary Gemini model.

2. **Deep reasoning model**: `nvidia/nemotron-3-ultra-550b-a55b`
   - Used when analytical queries benefit from deeper synthesis over retrieved email context.
   - Chosen for complex "analyze", "compare", "trend", "overview", and "report" style questions.

This split keeps routine tasks fast and reserves heavier reasoning for queries where it adds value.

### Hallucination Prevention

- The agent system prompt says to use actual email data and cite sources.
- `chatWithEmails()` and `deepAnalyzeEmails()` both explicitly instruct the model to only use provided email context.
- Search tools return concrete snippets and IDs, not just abstract summaries.
- The UI exposes source links for verification.
- Selected-email context is isolated in a labeled block to reduce mixing it with unrelated search results.
- If no relevant information is available, prompts instruct the model to say so rather than inventing details.

---

## 4. Gmail API Strategy

### Initial Sync

Initial sync runs when there is no usable `last_history_id`, or when the Gmail history cursor expires.

1. Get an authenticated OAuth client using the user's stored refresh/access tokens.
2. Read Gmail profile to capture a `historyId` for future incremental sync.
3. Enumerate all message IDs with `gmail.users.messages.list({ maxResults: 500, pageToken })`.
4. Upsert each listed message ID into `sync_queue` with `pending` status.
5. Persist `last_page_token`, `total_discovered`, and `phase='enumerating'` in `sync_status`.
6. Hydrate pending queue items in batches of 50:
   - Fetch full Gmail message with `messages.get(format='full')`.
   - Parse headers, recipients, dates, body text/html, labels, reply headers, and attachment presence.
   - Categorize with Gemini.
   - Generate context-aware summaries.
   - Generate Gemini embeddings.
   - Upsert into `emails`.
   - Mark queue rows as `synced` or `error`.
7. Rebuild affected `threads`.
8. Store `last_history_id`, mark `phase='complete'`, and clear `sync_in_progress`.

### Incremental Sync

If `last_history_id` exists:

1. Call `gmail.users.history.list({ startHistoryId })`.
2. Collect changed IDs from `messagesAdded`, `labelsAdded`, and `labelsRemoved`.
3. Collect deleted IDs from `messagesDeleted`.
4. Reconcile recent inbox messages with `messages.list(labelIds=['INBOX'])` to catch recent missing rows.
5. Delete locally removed messages and update or delete affected thread records.
6. Upsert changed IDs into `sync_queue` and hydrate them in smaller batches.
7. Update `last_history_id`.

If Gmail returns a 404/history cursor error, the app resets queue/status state and falls back to full sync.

### Pagination For Large Inboxes

- `messages.list` requests up to 500 message IDs per page.
- `nextPageToken` is stored in `sync_status.last_page_token` after each page.
- If the server restarts or sync becomes stale, enumeration can resume from the saved token.
- Hydration uses `sync_queue.status='pending'`, so already-synced messages are skipped on resume.

### Rate Limiting And Quota Handling

All Gmail API calls go through a shared `RateLimiter`:

- Maximum concurrency: `15`
- Per-second throttle: `25` requests/second
- Retryable errors:
  - HTTP `429`
  - HTTP `500-504`
  - Gmail quota/rate-limit `403` reasons such as `rateLimitExceeded` and `userRateLimitExceeded`
- Backoff:
  - Honors `Retry-After` when present.
  - Otherwise exponential backoff up to 32 seconds plus jitter.
  - Retries up to 8 times in the queue and also has additional retry handling around `messages.get`.

The dashboard also prevents overlapping sync starts by checking `sync_status.sync_in_progress`; stale syncs older than 5 minutes can be resumed.

### Send, Draft, And Label Strategy

- `sendEmail()` builds MIME messages with HTML bodies, optional attachments, `In-Reply-To`, `References`, and optional Gmail `threadId`.
- Compose supports multiple recipients by normalizing arrays or comma/semicolon-separated strings into a safe `To` header.
- Sent messages are fetched back from Gmail and upserted locally so the UI updates before the next full sync.
- `createDraft()` creates Gmail drafts from the agent.
- `modifyMessageLabels()` updates Gmail labels and mirrors read/star labels locally.
- The chat agent can also apply label changes to every locally indexed message in a thread through `modify_thread_labels`.
- Agent-mode sends and label changes require UI confirmation before Gmail is mutated.

---

## 5. Tool & Technology Decisions

| Decision | Justification |
| --- | --- |
| **Next.js App Router** | Keeps frontend screens and server API routes in one project, simplifying deployment and data flow. |
| **TypeScript** | Gives shared types for email/thread/chat records and safer API/lib code. |
| **Zustand** | Small global state layer for selected email/thread, filters, auth user, modals, chat state, and sync state. |
| **Supabase PostgreSQL** | Stores users, OAuth tokens, Gmail messages, sync state, and thread aggregates. |
| **Supabase `pgvector`** | Provides semantic search inside the same database, avoiding a separate vector database. |
| **`sync_queue` table instead of Redis/Bull** | Keeps the project simple while allowing resumable sync. |
| **Gmail API via `googleapis`** | Official Google client with OAuth refresh support and Gmail message/send/label APIs. |
| **Gemini `gemini-2.5-flash`** | Main generation model for summaries, compose/reply, classification, and tool-calling agent flow. |
| **Gemini `gemini-embedding-2`** | Produces 768-dimensional embeddings for `vector(768)`. |
| **NVIDIA NIM** | Adds a second model provider for alternate categorization, a reranking helper, and optional deep analysis. |
| **Tailwind + custom CSS** | Tailwind supports landing-page layout speed; custom CSS defines the dashboard's app-specific visual system. |
| **Lucide + Lottie** | Lightweight icons and animated assets for a richer UI without heavy custom graphics. |

---

## 6. Trade-offs & Limitations

### Deliberate Simplifications

1. **No external background worker**
   - Sync runs in the Next.js server process and uses Supabase tables for resumability.
   - A production version should move long sync and AI enrichment to durable workers.

2. **No real-time Gmail push notifications**
   - The dashboard triggers background sync and polls status.
   - Production should use Gmail Pub/Sub push notifications.

3. **Client-supplied `userId` session model**
   - The dashboard stores `repeatless_user_id` in local storage.
   - Production should use secure HTTP-only sessions or a full auth provider.

4. **Service-role Supabase access in API routes**
   - This is simple for a controlled backend, but production should use scoped policies and stronger authorization checks.

5. **Attachment handling is send-only/minimal**
   - Incoming attachments are detected but not downloaded, indexed, OCR'd, or summarized.

6. **AI responses are not cached**
   - Repeated summaries or chat queries can call models again.
   - Production could cache summaries, retrieval results, and common chat answers.

7. **Limited test coverage**
   - The repo has scratch scripts but no formal test suite.
   - Production should add unit tests for parsing/prompt utilities and integration tests for API routes.

8. **Local file sync logs**
   - `src/tmp_logs` works locally but is not durable across stateless deployments.
   - Production should store logs in Supabase or a logging service.

9. **Search fallback is simple keyword matching**
   - Text fallback is intentionally lightweight.
   - More robust search could combine full-text indexes, recency weighting, and learned reranking.

### What I Would Improve With More Time

1. Move sync/enrichment to a dedicated job worker with retries and backpressure.
2. Add Gmail Pub/Sub push notifications for near-real-time updates.
3. Add secure sessions and user-scoped authorization on every API route.
4. Add formal tests and CI checks.
5. Stream chat responses and sync progress instead of polling.
6. Store and index attachments, including PDFs and images.
7. Add richer label actions, archive/delete UX, and Gmail label management.
8. Add observability for Gmail quota usage, AI latency, and sync errors.
9. Add caching for summaries, newsletter digests, and chat retrieval.
