import {
  Content,
  FunctionCallPart,
  FunctionDeclaration,
  FunctionResponsePart,
  SchemaType,
  Tool,
} from '@google/generative-ai';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase';
import { generateEmbedding, getGeminiModel } from './gemini';
import { deepAnalyzeEmails } from './nvidia';
import { sendEmail, createDraft, modifyMessageLabels, runSyncPipeline } from './gmail';
import type {
  AgentActionResult,
  AgentActivity,
  AgentMode,
  AgentPendingAction,
  AgentToolName,
  EmailMessage,
  EmailSource,
} from '@/types';


const READ_ONLY_TOOL_NAMES = new Set(['search_emails', 'get_email_thread']);
const CONFIRMATION_REQUIRED_TOOLS = new Set(['send_email', 'modify_labels', 'modify_thread_labels']);

const agentFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_emails',
    description: 'Search for emails in the user inbox matching a search query. Uses vector semantic search. Returns matching emails.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'The search term, keyword, or semantic description of what to find in the emails (e.g., "flight receipts", "Johns status update").',
        },
        category: {
          type: SchemaType.STRING,
          description: 'Optional category filter: newsletters, job_recruitment, finance, notifications, personal, work_professional.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_email_thread',
    description: 'Retrieve all email messages belonging to a specific thread ID, chronologically ordered. Use this to read full conversation context.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        threadId: {
          type: SchemaType.STRING,
          description: 'The thread ID of the conversation to retrieve.',
        },
      },
      required: ['threadId'],
    },
  },
  {
    name: 'create_draft',
    description: 'Create a new email draft in the user\'s Gmail. It will not be sent automatically.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        to: {
          type: SchemaType.STRING,
          description: 'Recipient email address (e.g. "recipient@example.com").',
        },
        subject: {
          type: SchemaType.STRING,
          description: 'Subject of the email draft.',
        },
        bodyHtml: {
          type: SchemaType.STRING,
          description: 'The body of the email in HTML format.',
        },
        threadId: {
          type: SchemaType.STRING,
          description: 'Optional thread ID to link this draft as a reply in an existing thread.',
        },
      },
      required: ['to', 'subject', 'bodyHtml'],
    },
  },
  {
    name: 'send_email',
    description: 'Prepare to send a new email immediately to a recipient. The runtime will require user confirmation before the email is sent.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        to: {
          type: SchemaType.STRING,
          description: 'Recipient email address.',
        },
        subject: {
          type: SchemaType.STRING,
          description: 'Subject of the email.',
        },
        bodyHtml: {
          type: SchemaType.STRING,
          description: 'The body of the email in HTML format.',
        },
        threadId: {
          type: SchemaType.STRING,
          description: 'Optional thread ID if sending this message as part of an existing thread.',
        },
      },
      required: ['to', 'subject', 'bodyHtml'],
    },
  },
  {
    name: 'modify_labels',
    description: 'Prepare to modify label IDs on a specific email (e.g., star/unstar, mark read/unread, archive). The runtime will require confirmation before labels are changed.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        gmailId: {
          type: SchemaType.STRING,
          description: 'The Gmail message ID of the email to modify.',
        },
        addLabelIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Label IDs to add. Examples: "STARRED", "UNREAD".',
        },
        removeLabelIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Label IDs to remove. Examples: "INBOX" to archive, "UNREAD" to mark read, "STARRED" to unstar.',
        },
      },
      required: ['gmailId', 'addLabelIds', 'removeLabelIds'],
    },
  },
  {
    name: 'modify_thread_labels',
    description: 'Prepare to modify label IDs on every message in a Gmail thread. Use this for thread-level archive, star, unstar, mark read, or mark unread actions. The runtime will require confirmation before labels are changed.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        threadId: {
          type: SchemaType.STRING,
          description: 'The Gmail thread ID to modify.',
        },
        addLabelIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Label IDs to add to every message in the thread. Examples: "STARRED", "UNREAD".',
        },
        removeLabelIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Label IDs to remove from every message in the thread. Examples: "INBOX", "UNREAD", "STARRED".',
        },
      },
      required: ['threadId', 'addLabelIds', 'removeLabelIds'],
    },
  },
  {
    name: 'sync_inbox',
    description: 'Trigger a sync of the user\'s inbox to fetch any new emails from Gmail.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
];

// Define tools for the Gemini model.
export const agentTools: Tool[] = [{ functionDeclarations: agentFunctionDeclarations }];
export const assistantTools: Tool[] = [
  {
    functionDeclarations: agentFunctionDeclarations.filter((tool) => READ_ONLY_TOOL_NAMES.has(tool.name)),
  },
];

type AgentConversationResult = {
  response: string;
  activities: AgentActivity[];
  sources: EmailSource[];
  pendingAction?: AgentPendingAction;
  actionResult?: AgentActionResult;
  model?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function formatRecipient(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return typeof value === 'string' ? value : '';
}

function summarizeLabelAction(toolName: string, args: Record<string, unknown>) {
  const target = toolName === 'modify_thread_labels' ? 'thread' : 'email';
  const addLabelIds = toStringArray(args.addLabelIds);
  const removeLabelIds = toStringArray(args.removeLabelIds);

  if (addLabelIds.includes('TRASH')) {
    return {
      title: `Move ${target} to trash`,
      description: `Move this ${target} to Gmail trash.`,
      confirmationLabel: 'Move to trash',
      risk: 'high' as const,
    };
  }

  if (removeLabelIds.includes('INBOX')) {
    return {
      title: `Archive ${target}`,
      description: `Remove this ${target} from the inbox. It will still be available in All Mail and search.`,
      confirmationLabel: 'Archive',
      risk: 'medium' as const,
    };
  }

  if (addLabelIds.includes('UNREAD')) {
    return {
      title: `Mark ${target} unread`,
      description: `Mark this ${target} as unread in Gmail.`,
      confirmationLabel: 'Mark unread',
      risk: 'medium' as const,
    };
  }

  if (removeLabelIds.includes('UNREAD')) {
    return {
      title: `Mark ${target} read`,
      description: `Mark this ${target} as read in Gmail.`,
      confirmationLabel: 'Mark read',
      risk: 'medium' as const,
    };
  }

  if (addLabelIds.includes('STARRED')) {
    return {
      title: `Star ${target}`,
      description: `Add a Gmail star to this ${target}.`,
      confirmationLabel: 'Star',
      risk: 'medium' as const,
    };
  }

  if (removeLabelIds.includes('STARRED')) {
    return {
      title: `Unstar ${target}`,
      description: `Remove the Gmail star from this ${target}.`,
      confirmationLabel: 'Unstar',
      risk: 'medium' as const,
    };
  }

  return {
    title: `Update ${target} labels`,
    description: `Apply the requested Gmail label changes to this ${target}.`,
    confirmationLabel: 'Update labels',
    risk: 'medium' as const,
  };
}

function buildPendingAction(name: string, rawArgs: Record<string, unknown>): AgentPendingAction {
  const toolName = name as AgentToolName;
  const args = rawArgs || {};

  if (toolName === 'send_email') {
    const to = formatRecipient(args.to);
    const subject = typeof args.subject === 'string' ? args.subject : '(no subject)';
    return {
      id: randomUUID(),
      toolName,
      title: 'Send email',
      description: `Send an email to ${to || 'the selected recipient'} with subject "${subject}".`,
      args,
      confirmationLabel: 'Send now',
      risk: 'high',
      createdAt: new Date().toISOString(),
    };
  }

  const labelSummary = summarizeLabelAction(toolName, args);
  return {
    id: randomUUID(),
    toolName,
    title: labelSummary.title,
    description: labelSummary.description,
    args,
    confirmationLabel: labelSummary.confirmationLabel,
    risk: labelSummary.risk,
    createdAt: new Date().toISOString(),
  };
}

function normalizeActionResult(toolName: AgentToolName, data: unknown): AgentActionResult {
  const dataRecord = isRecord(data) ? data : {};
  const success = dataRecord.success !== false;
  const message = getString(dataRecord.message) ||
    getString(dataRecord.error) ||
    (success ? 'Action completed successfully.' : 'Action failed.');

  return {
    toolName,
    success,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

function addToolSources(
  toolName: string,
  resultData: unknown,
  sourcesMap: Map<string, EmailSource>
) {
  if (!Array.isArray(resultData)) return;
  if (toolName !== 'search_emails' && toolName !== 'get_email_thread') return;

  for (const item of resultData) {
    if (!isRecord(item)) continue;
    const gmailId = getString(item.gmail_id);
    if (!gmailId) continue;
    const body = getString(item.body);
    sourcesMap.set(gmailId, {
      email_id: getString(item.id),
      gmail_id: gmailId,
      subject: getString(item.subject) || null,
      from: getString(item.from) || null,
      date: getString(item.date),
      snippet: getString(item.snippet) || body.slice(0, 160) || null,
    });
  }
}

// Local function execution map
export async function executeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  console.log(`[Agent Tool Call] Executing ${name} with args:`, JSON.stringify(args));
  
  switch (name) {
    case 'search_emails': {
      const query = getString(args.query);
      const category = getString(args.category);
      let relevantEmails: EmailMessage[] = [];
      try {
        const queryEmbedding = await generateEmbedding(query);
        const { data: vectorResults } = await supabaseAdmin.rpc('match_emails', {
          query_embedding: queryEmbedding,
          match_threshold: 0.45,
          match_count: 15,
          p_user_id: userId,
        });
        if (vectorResults) relevantEmails = vectorResults;
      } catch (err) {
        console.warn('Vector search failed in tool, falling back to text search:', err);
      }

      // Keyword search fallback
      if (relevantEmails.length < 5) {
        const keywords = query.split(' ').filter((w: string) => w.length > 3).slice(0, 5);
        const searchTerms = keywords.map((k: string) => `%${k}%`);
        for (const term of searchTerms) {
          const { data: textResults } = await supabaseAdmin
            .from('emails')
            .select('*')
            .eq('user_id', userId)
            .or(`subject.ilike.${term},body_text.ilike.${term},from_name.ilike.${term}`)
            .order('date', { ascending: false })
            .limit(8);

          if (textResults) {
            const existingIds = new Set(relevantEmails.map((e) => e.gmail_id));
            for (const email of textResults) {
              if (!existingIds.has(email.gmail_id)) {
                relevantEmails.push(email as EmailMessage);
                existingIds.add(email.gmail_id);
              }
            }
          }
        }
      }

      // Apply category filter if specified
      if (category) {
        relevantEmails = relevantEmails.filter(
          (e) => e.category?.toLowerCase() === category.toLowerCase()
        );
      }

      return relevantEmails.map((e) => ({
        id: e.id,
        gmail_id: e.gmail_id,
        thread_id: e.thread_id,
        from: `${e.from_name} <${e.from_address}>`,
        subject: e.subject,
        date: e.date,
        snippet: e.snippet,
        body: (e.body_text || e.snippet || '').slice(0, 1000),
        labels: e.labels,
        category: e.category,
      }));
    }

    case 'get_email_thread': {
      const { threadId } = args;
      const { data: threadMessages, error } = await supabaseAdmin
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .eq('thread_id', threadId)
        .order('date', { ascending: true });

      if (error || !threadMessages) {
        return { error: `Failed to retrieve thread: ${error?.message}` };
      }

      return threadMessages.map((e) => ({
        id: e.id,
        gmail_id: e.gmail_id,
        thread_id: e.thread_id,
        from: `${e.from_name} <${e.from_address}>`,
        subject: e.subject,
        date: e.date,
        body: e.body_text || e.snippet || '',
        labels: e.labels,
      }));
    }

    case 'create_draft': {
      const to = Array.isArray(args.to) ? toStringArray(args.to) : getString(args.to);
      const subject = getString(args.subject);
      const bodyHtml = getString(args.bodyHtml);
      const threadId = getString(args.threadId) || undefined;
      try {
        const draftId = await createDraft(userId, to, subject, bodyHtml, threadId);
        return { success: true, draftId, message: 'Draft created successfully in Gmail.' };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    }

    case 'send_email': {
      const to = Array.isArray(args.to) ? toStringArray(args.to) : getString(args.to);
      const subject = getString(args.subject);
      const bodyHtml = getString(args.bodyHtml);
      const threadId = getString(args.threadId) || undefined;
      try {
        let inReplyTo: string | undefined;
        let references: string[] | undefined;
        if (threadId) {
          const { data: lastEmail } = await supabaseAdmin
            .from('emails')
            .select('headers, gmail_id')
            .eq('user_id', userId)
            .eq('thread_id', threadId)
            .order('date', { ascending: false })
            .limit(1)
            .single();

          if (lastEmail) {
            const hdrs = lastEmail.headers as Record<string, string>;
            const messageId = hdrs?.['Message-ID'] || hdrs?.['message-id'];
            if (messageId) {
              inReplyTo = messageId;
              const refs = hdrs?.['References'] || hdrs?.['references'] || '';
              references = refs ? refs.split(/\s+/).filter(Boolean) : [];
              references.push(messageId);
            }
          }
        }

        const sentId = await sendEmail(userId, to, subject, bodyHtml, inReplyTo, references, threadId);
        return { success: true, sentId, message: 'Email sent successfully.' };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    }

    case 'modify_labels': {
      const gmailId = getString(args.gmailId);
      const addLabelIds = toStringArray(args.addLabelIds);
      const removeLabelIds = toStringArray(args.removeLabelIds);
      try {
        const result = await modifyMessageLabels(userId, gmailId, addLabelIds, removeLabelIds);
        return { success: true, labels: result.labels, message: `Updated labels: added [${addLabelIds.join(', ')}], removed [${removeLabelIds.join(', ')}].` };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    }

    case 'modify_thread_labels': {
      const threadId = getString(args.threadId);
      const addLabelIds = toStringArray(args.addLabelIds);
      const removeLabelIds = toStringArray(args.removeLabelIds);
      try {
        const { data: messages, error } = await supabaseAdmin
          .from('emails')
          .select('gmail_id')
          .eq('user_id', userId)
          .eq('thread_id', threadId);

        if (error) throw error;
        if (!messages?.length) {
          return { success: false, error: 'No local messages found for this thread.' };
        }

        const results = [];
        for (const message of messages) {
          const result = await modifyMessageLabels(
            userId,
            message.gmail_id,
            addLabelIds,
            removeLabelIds
          );
          results.push({ gmailId: message.gmail_id, labels: result.labels });
        }

        return {
          success: true,
          updatedCount: results.length,
          results,
          message: `Updated labels on ${results.length} thread message${results.length === 1 ? '' : 's'}.`,
        };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    }

    case 'sync_inbox': {
      try {
        await runSyncPipeline(userId);
        return { success: true, message: 'Inbox synchronization complete.' };
      } catch (err) {
        return { success: false, error: getErrorMessage(err) };
      }
    }

    default:
      throw new Error(`Tool ${name} is not implemented.`);
  }
}

// Heuristic: detect queries that benefit from deep reasoning vs simple tool responses
function isAnalyticalQuery(query: string): boolean {
  // Only trigger deep reasoning for explicitly analytical multi-email queries.
  // Simple actions (draft, reply, archive, star) should NEVER trigger this.
  const actionPatterns = [/draft/i, /reply/i, /send/i, /archive/i, /star/i, /unstar/i, /mark/i, /label/i, /sync/i, /compose/i, /create/i, /unread/i];
  if (actionPatterns.some((p) => p.test(query))) return false;

  const analyticalPatterns = [
    /\banalyz/i, /\btrend/i, /\bpattern/i, /\binsight/i,
    /\bcompare/i, /\boverview/i, /\bbreakdown/i, /\breport/i,
    /what.*important/i, /what.*key/i, /\bprioritiz/i,
    /how many/i, /which.*most/i, /\bdigest\b/i, /\bhighlight/i,
  ];
  // Require at least 2 pattern matches or a very strong single match
  const matchCount = analyticalPatterns.filter((p) => p.test(query)).length;
  return matchCount >= 2;
}

function buildSystemInstruction(mode: AgentMode) {
  const modeRules = mode === 'agent'
    ? `MODE: Agent Mode.
You can take action through tools.
- Use create_draft when the user asks to draft or prepare a reply.
- Use sync_inbox when the user asks to refresh or sync Gmail.
- For selected-email actions, use Gmail ID and Thread ID from the [CONTEXT] block.
- For "this email" label changes, use modify_labels.
- For "this thread" label changes, use modify_thread_labels.
- Archive means remove "INBOX"; mark read means remove "UNREAD"; mark unread means add "UNREAD"; star means add "STARRED"; unstar means remove "STARRED".
- If asked to send email or change labels, call the appropriate tool with the intended arguments. The runtime will ask the user to confirm before executing that risky action.`
    : `MODE: Assistant Mode.
You may search and read email context, but you must not create drafts, send mail, change labels, or sync Gmail.
If the user asks you to perform an action, explain that switching to Agent Mode enables the action.`;

  return `You are repeatless, a helpful AI Gmail assistant.
You manage, search, sync, and organize the user's email inbox.

${modeRules}

RULES:
1. If the user asks about emails and no [CONTEXT] is provided, ALWAYS run search_emails first to get actual data.
2. If the user's query includes a [CONTEXT: Currently viewing email] block, that IS the email they are asking about. Use it directly unless they ask about other emails.
3. If you need to read a full thread discussion and a Thread ID is available, use get_email_thread.
4. Be concise, transparent, and direct in your final summaries.
5. Cite sources with subjects, senders, and dates whenever you used email records.
6. When returning an answer after tool use, state what you actually did.`;
}

export async function executeConfirmedAgentAction(
  userId: string,
  action: AgentPendingAction
): Promise<AgentConversationResult> {
  if (!CONFIRMATION_REQUIRED_TOOLS.has(action.toolName)) {
    throw new Error(`Tool ${action.toolName} does not require confirmation.`);
  }

  const activities: AgentActivity[] = [{
    type: action.toolName,
    args: action.args,
    timestamp: new Date().toISOString(),
  }];

  const resultData = await executeTool(userId, action.toolName, action.args);
  const actionResult = normalizeActionResult(action.toolName, resultData);

  return {
    response: actionResult.message,
    activities,
    sources: [],
    actionResult,
    model: 'agent-action',
  };
}

// Agent conversation execution loop
export async function runAgentConversation(
  userId: string,
  userQuery: string,
  conversationHistory: { role: string; content: string }[],
  mode: AgentMode = 'assistant'
): Promise<AgentConversationResult> {
  // Use gemini-2.5-flash with thinking DISABLED for fast tool-calling (~1-3s)
  const model = getGeminiModel('gemini-2.5-flash');
  const systemInstruction = buildSystemInstruction(mode);
  const tools = mode === 'agent' ? agentTools : assistantTools;

  // Format conversation history for Gemini API
  const contents: Content[] = [];
  
  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  // Append user's current query
  contents.push({
    role: 'user',
    parts: [{ text: userQuery }]
  });

  const activities: AgentActivity[] = [];
  const sourcesMap = new Map<string, EmailSource>();
  const toolResults: string[] = []; // Collect raw tool results for NIM
  let loopCount = 0;
  const maxLoops = 4;
  const useDeepReasoning = isAnalyticalQuery(userQuery);

  while (loopCount < maxLoops) {
    loopCount++;
    console.log(`[Agent Loop] Iteration ${loopCount}`);

    const result = await model.generateContent({
      contents,
      tools,
      systemInstruction,
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });

    const responseContent = result.response.candidates?.[0]?.content;
    if (!responseContent) {
      throw new Error('No candidate content received from Gemini model.');
    }

    // Append model output (which may contain functionCalls or text response)
    contents.push(responseContent);

    // Extract function calls if any
    const functionCalls = responseContent.parts?.filter(
      (part): part is FunctionCallPart => Boolean(part.functionCall)
    );

    if (!functionCalls || functionCalls.length === 0) {
      // Model gave the final text output
      const geminiResponse = responseContent.parts
        ?.map((part) => part.text)
        .filter((text): text is string => Boolean(text))
        .join('\n') || '';

      // If deep reasoning is warranted and we have tool context, enhance with Nemotron
      if (useDeepReasoning && toolResults.length > 0) {
        console.log('[Agent] Routing to NVIDIA NIM Nemotron for deep reasoning...');
        activities.push({
          type: 'deep_reasoning',
          args: { model: 'nvidia/nemotron-3-ultra-550b-a55b' },
          timestamp: new Date().toISOString(),
        });

        try {
          const historyText = conversationHistory
            .slice(-4)
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');

          const nimResponse = await deepAnalyzeEmails(
            userQuery,
            toolResults.join('\n---\n'),
            historyText
          );

          return {
            response: nimResponse,
            activities,
            sources: Array.from(sourcesMap.values()),
            model: 'nvidia/nemotron-3-ultra-550b-a55b',
          };
        } catch (nimError) {
          console.warn('[Agent] NIM deep reasoning failed, falling back to Gemini response:', getErrorMessage(nimError));
          // Fall back to Gemini's response
        }
      }

      return {
        response: geminiResponse,
        activities,
        sources: Array.from(sourcesMap.values()),
        model: 'gemini-2.5-flash',
      };
    }

    const functionResponses: FunctionResponsePart[] = [];

    // Execute each tool request
    for (const call of functionCalls) {
      if (!call.functionCall) continue;
      const { name } = call.functionCall;
      const args = isRecord(call.functionCall.args) ? call.functionCall.args : {};

      if (mode !== 'agent' && !READ_ONLY_TOOL_NAMES.has(name)) {
        return {
          response: 'Switch to Agent Mode when you want me to create drafts, send email, change labels, or sync Gmail.',
          activities,
          sources: Array.from(sourcesMap.values()),
          model: 'gemini-2.5-flash',
        };
      }

      if (mode === 'agent' && CONFIRMATION_REQUIRED_TOOLS.has(name)) {
        const pendingAction = buildPendingAction(name, args || {});
        activities.push({
          type: `${name}_needs_confirmation`,
          args,
          timestamp: new Date().toISOString(),
        });

        return {
          response: `I'm ready to ${pendingAction.title.toLowerCase()}. Please confirm before I run it.`,
          activities,
          sources: Array.from(sourcesMap.values()),
          pendingAction,
          model: 'gemini-2.5-flash',
        };
      }
      
      // Log activity
      activities.push({
        type: name,
        args,
        timestamp: new Date().toISOString(),
      });

      try {
        const resultData = await executeTool(userId, name, args);

        // Collect tool results for potential NIM deep reasoning
        toolResults.push(JSON.stringify(resultData, null, 1).slice(0, 6000));

        addToolSources(name, resultData, sourcesMap);

        functionResponses.push({
          functionResponse: {
            name,
            response: { result: resultData }
          }
        });
      } catch (err) {
        functionResponses.push({
          functionResponse: {
            name,
            response: { error: getErrorMessage(err) }
          }
        });
      }
    }

    // Append tool responses
    contents.push({
      role: 'user',
      parts: functionResponses
    });
  }

  throw new Error('Agent reached maximum loop execution limit.');
}
