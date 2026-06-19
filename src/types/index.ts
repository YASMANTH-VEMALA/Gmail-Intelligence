// =============================================
// Type definitions for the Gmail Intelligence Platform
// =============================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  user_id: string;
  gmail_id: string;
  thread_id: string;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  date: string;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  labels: string[];
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  in_reply_to: string | null;
  references: string[];
  headers: Record<string, string>;
  summary: string | null;
  category: EmailCategory | null;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface EmailThread {
  id: string;
  user_id: string;
  gmail_thread_id: string;
  subject: string | null;
  participants: string[];
  message_count: number;
  last_message_date: string;
  snippet: string | null;
  labels: string[];
  summary: string | null;
  category: EmailCategory | null;
  created_at: string;
  updated_at: string;
  messages?: EmailMessage[];
}

export type EmailCategory =
  | 'newsletters'
  | 'job_recruitment'
  | 'finance'
  | 'notifications'
  | 'personal'
  | 'work_professional'
  | 'uncategorized';

export interface AgentActivity {
  type: string;
  args: unknown;
  timestamp: string;
}

export type AgentMode = 'assistant' | 'agent';

export type AgentToolName =
  | 'search_emails'
  | 'get_email_thread'
  | 'create_draft'
  | 'send_email'
  | 'modify_labels'
  | 'modify_thread_labels'
  | 'sync_inbox';

export interface AgentPendingAction {
  id: string;
  toolName: AgentToolName;
  title: string;
  description: string;
  args: Record<string, unknown>;
  confirmationLabel: string;
  risk: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface AgentActionResult {
  toolName: AgentToolName;
  success: boolean;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: EmailSource[];
  activities?: AgentActivity[];
  pendingAction?: AgentPendingAction;
  actionResult?: AgentActionResult;
  model?: string;
  mode?: AgentMode;
  timestamp: string;
}


export interface EmailSource {
  email_id: string;
  gmail_id: string;
  subject: string | null;
  from: string | null;
  date: string;
  snippet: string | null;
  relevance_score?: number;
}

export interface ComposeRequest {
  prompt: string;
  to?: string;
  subject?: string;
}

export interface ReplyRequest {
  thread_id: string;
  message_id: string;
  prompt: string;
}

export interface DraftEmail {
  to: string;
  subject: string;
  body: string;
  in_reply_to?: string;
  references?: string[];
  thread_id?: string;
}

export interface SyncStatus {
  user_id: string;
  last_sync_at: string | null;
  last_history_id: string | null;
  total_messages_synced: number;
  sync_in_progress: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  sources: {
    newsletter: string;
    email_id: string;
    date: string;
  }[];
  topic_cluster?: string;
}

export interface CategoryCount {
  category: EmailCategory;
  count: number;
}

export interface SyncProgress {
  phase: 'fetching' | 'processing' | 'categorizing' | 'embedding' | 'complete';
  current: number;
  total: number;
  message: string;
}
