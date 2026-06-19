import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmailMessage, EmailCategory, NewsItem } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export function getGeminiModel(modelName = 'gemini-2.5-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in model response');
    return JSON.parse(match[0]);
  }
}

function cleanSummary(summary: unknown): string {
  const text = typeof summary === 'string' ? summary : '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 700);
}

function formatMessageForSummary(message: EmailMessage, index: number, targetId?: string): string {
  const marker = targetId && message.gmail_id === targetId ? ' [TARGET EMAIL]' : '';
  return [
    `--- Message ${index + 1}${marker} ---`,
    `From: ${message.from_name || ''} <${message.from_address || ''}>`,
    `Date: ${message.date}`,
    `Subject: ${message.subject || '(no subject)'}`,
    (message.body_text || message.snippet || '').slice(0, 1600),
  ].join('\n');
}

export async function summarizeEmail(email: EmailMessage, threadMessages: EmailMessage[] = [email]): Promise<string> {
  const model = getGeminiModel();
  const orderedThread = threadMessages.length > 0
    ? [...threadMessages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [email];
  const threadContext = orderedThread.map((message, index) =>
    formatMessageForSummary(message, index, email.gmail_id)
  ).join('\n\n');

  const prompt = `Summarize the TARGET EMAIL in 1-2 concise sentences.

You must use the full thread context below. If the target email is a reply, explain what it contributes relative to earlier messages instead of summarizing it in isolation.
Focus on concrete purpose, requested action, decision, deadline, or important update. Do not invent details.

Thread subject: ${email.subject || '(no subject)'}
Messages in thread: ${orderedThread.length}
Target Gmail ID: ${email.gmail_id}

${threadContext.slice(0, 9000)}`;

  const result = await model.generateContent(prompt);
  return cleanSummary(result.response.text());
}

export async function summarizeEmailsBatch(items: { email: EmailMessage; threadMessages?: EmailMessage[] }[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const model = getGeminiModel();
  const chunkSize = 5;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const promptItems = chunk.map(({ email, threadMessages }) => {
      const orderedThread = (threadMessages && threadMessages.length > 0 ? threadMessages : [email])
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        id: email.gmail_id,
        subject: email.subject || '(no subject)',
        target_email: {
          from: `${email.from_name || ''} <${email.from_address || ''}>`,
          date: email.date,
          body: (email.body_text || email.snippet || '').slice(0, 1200),
        },
        thread_context: orderedThread.map((message, index) => ({
          index: index + 1,
          is_target: message.gmail_id === email.gmail_id,
          from: `${message.from_name || ''} <${message.from_address || ''}>`,
          date: message.date,
          body: (message.body_text || message.snippet || '').slice(0, 800),
        })),
      };
    });

    const prompt = `Create a concise, context-aware summary for each target email.

Rules:
- Return JSON only in this exact shape: {"summaries":[{"id":"gmail_id","summary":"1-2 sentence summary"}]}.
- Every input id must appear exactly once.
- Use thread_context to understand replies in the flow of the conversation.
- The summary is for the target email, not a whole-thread summary.
- Mention concrete asks, decisions, deadlines, alerts, or next steps when present.
- Keep each summary under 45 words.

Inputs:
${JSON.stringify(promptItems, null, 2)}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const parsed = parseJsonObject(result.response.text()) as { summaries?: { id?: string; summary?: string }[] };
      for (const item of parsed.summaries || []) {
        if (item.id) {
          const summary = cleanSummary(item.summary);
          if (summary) results.set(item.id, summary);
        }
      }
    } catch (error) {
      console.error(`Failed to summarize batch starting at index ${i}:`, error);
    }

    for (const item of chunk) {
      if (!results.has(item.email.gmail_id)) {
        try {
          results.set(item.email.gmail_id, await summarizeEmail(item.email, item.threadMessages || [item.email]));
        } catch (error) {
          console.error(`Failed to summarize email ${item.email.gmail_id}:`, error);
          results.set(item.email.gmail_id, cleanSummary(item.email.snippet || item.email.subject || 'No summary available.'));
        }
      }
    }
  }

  return results;
}

export async function summarizeThread(messages: EmailMessage[]): Promise<string> {
  const model = getGeminiModel();
  const orderedMessages = [...messages].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const threadContent = orderedMessages.map((m, i) =>
    formatMessageForSummary(m, i)
  ).join('\n\n');

  const prompt = `Summarize this email thread as a conversation arc, not as isolated messages.

Cover:
- main topic
- how the conversation progressed
- key decisions or facts
- open action items, owners, deadlines, or current status

Be concise but complete. Use 3-5 short bullets or a compact paragraph.

Subject: ${orderedMessages[0]?.subject}
Participants: ${[...new Set(orderedMessages.map(m => m.from_name || m.from_address).filter(Boolean))].join(', ')}
Messages: ${orderedMessages.length}

${threadContent.slice(0, 8000)}`;

  const result = await model.generateContent(prompt);
  return cleanSummary(result.response.text());
}

export async function summarizeThreadsBatch(threads: { threadId: string; messages: EmailMessage[] }[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const model = getGeminiModel();
  const chunkSize = 8;

  for (let i = 0; i < threads.length; i += chunkSize) {
    const chunk = threads.slice(i, i + chunkSize);
    const promptItems = chunk.map(({ threadId, messages }) => {
      const orderedMessages = messages
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        thread_id: threadId,
        subject: orderedMessages[0]?.subject || '(no subject)',
        participants: [...new Set(orderedMessages.map((message) => message.from_name || message.from_address).filter(Boolean))],
        messages: orderedMessages.map((message, index) => ({
          index: index + 1,
          from: `${message.from_name || ''} <${message.from_address || ''}>`,
          date: message.date,
          body: (message.body_text || message.snippet || '').slice(0, 900),
        })),
      };
    });

    const prompt = `Create a thread-level summary for each email conversation.

Rules:
- Return JSON only in this exact shape: {"threads":[{"thread_id":"thread_id","summary":"summary"}]}.
- Every input thread_id must appear exactly once.
- Summaries must explain the conversation arc: main topic, progression, decisions/facts, current status, and action items.
- Keep each summary concise, under 80 words.
- Do not invent details.

Threads:
${JSON.stringify(promptItems, null, 2)}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const parsed = parseJsonObject(result.response.text()) as { threads?: { thread_id?: string; summary?: string }[] };
      for (const item of parsed.threads || []) {
        if (item.thread_id) {
          const summary = cleanSummary(item.summary);
          if (summary) results.set(item.thread_id, summary);
        }
      }
    } catch (error) {
      console.error(`Failed to summarize thread batch starting at index ${i}:`, error);
    }

    for (const thread of chunk) {
      if (!results.has(thread.threadId)) {
        try {
          results.set(thread.threadId, await summarizeThread(thread.messages));
        } catch (error) {
          console.error(`Failed to summarize thread ${thread.threadId}:`, error);
          const latestMessage = thread.messages[thread.messages.length - 1];
          results.set(thread.threadId, cleanSummary(latestMessage?.summary || latestMessage?.snippet || latestMessage?.subject || 'No summary available.'));
        }
      }
    }
  }

  return results;
}

export async function categorizeEmail(email: EmailMessage): Promise<EmailCategory> {
  const model = getGeminiModel();
  const content = email.body_text || email.snippet || '';
  const prompt = `Categorize this email into exactly ONE of these categories. Reply with ONLY the category key:
- newsletters: Subscription content, digests, marketing emails
- job_recruitment: Job applications, offers, rejections, interviews
- finance: Invoices, receipts, bank alerts, payments
- notifications: System alerts, OTPs, platform updates, automated notifications
- personal: Direct human-to-human personal communication
- work_professional: Project discussions, team communication, work-related

From: ${email.from_address}
Subject: ${email.subject}
${content.slice(0, 2000)}

Category:`;

  const result = await model.generateContent(prompt);
  const category = result.response.text().trim().toLowerCase().replace(/[^a-z_]/g, '');
  const valid: EmailCategory[] = ['newsletters', 'job_recruitment', 'finance', 'notifications', 'personal', 'work_professional'];
  return valid.includes(category as EmailCategory) ? (category as EmailCategory) : 'uncategorized';
}

export async function categorizeEmailsBatch(emails: EmailMessage[]): Promise<Map<string, EmailCategory>> {
  const results = new Map<string, EmailCategory>();
  const model = getGeminiModel();

  // Process in batches of 50 to maximize speed and cost efficiency
  const batchSize = 50;
  for (let i = 0; i < emails.length; i += batchSize) {
    const chunk = emails.slice(i, i + batchSize);

    const emailData = chunk.map((email, idx) => ({
      index: idx,
      id: email.gmail_id,
      subject: email.subject || '',
      from: email.from_address || '',
      snippet: (email.body_text || email.snippet || '').slice(0, 300)
    }));

    const prompt = `You are an AI email classifier. Categorize the following emails into exactly one of these categories:
- newsletters
- job_recruitment
- finance
- notifications
- personal
- work_professional

Provide the classification result in the following JSON format:
{
  "classifications": [
    {
      "id": "email_gmail_id",
      "category": "category_name"
    }
  ]
}

Emails to categorize:
${JSON.stringify(emailData, null, 2)}

Ensure EVERY email id in the input is present in the output with a valid category.`;

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      if (parsed.classifications && Array.isArray(parsed.classifications)) {
        for (const item of parsed.classifications) {
          const cat = item.category?.trim().toLowerCase().replace(/[^a-z_]/g, '');
          const valid: EmailCategory[] = ['newsletters', 'job_recruitment', 'finance', 'notifications', 'personal', 'work_professional'];
          results.set(item.id, valid.includes(cat as EmailCategory) ? (cat as EmailCategory) : 'uncategorized');
        }
      }

      // Fallback for missing items from JSON
      for (const email of chunk) {
        if (!results.has(email.gmail_id)) {
          try {
            const cat = await categorizeEmail(email);
            results.set(email.gmail_id, cat);
          } catch {
            results.set(email.gmail_id, 'uncategorized');
          }
        }
      }
    } catch (e) {
      console.error(`Failed to categorize batch starting at index ${i}:`, e);
      // Fallback: classify individually
      for (const email of chunk) {
        try {
          const cat = await categorizeEmail(email);
          results.set(email.gmail_id, cat);
        } catch {
          results.set(email.gmail_id, 'uncategorized');
        }
      }
    }
  }
  return results;
}

export async function composeEmail(prompt: string, context?: string): Promise<{ to: string; subject: string; body: string }> {
  const model = getGeminiModel();
  const systemPrompt = `You are an AI email assistant. Based on the user's prompt, draft a professional email.
Return your response in this exact JSON format:
{"to": "recipient@email.com", "subject": "Email Subject", "body": "<html email body>"}

If the recipient is not specified, use "recipient@email.com" as placeholder.
The body should be well-formatted HTML with proper paragraphs.
${context ? `\nContext from previous emails:\n${context}` : ''}

User's prompt: ${prompt}`;

  const result = await model.generateContent(systemPrompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse email draft');
  return JSON.parse(jsonMatch[0]);
}

export async function composeReply(prompt: string, threadMessages: EmailMessage[]): Promise<string> {
  const model = getGeminiModel();
  const threadContext = threadMessages.map((m, i) =>
    `[Message ${i + 1}] From: ${m.from_name} <${m.from_address}>\nDate: ${m.date}\n${(m.body_text || m.snippet || '').slice(0, 1500)}`
  ).join('\n---\n');

  const replyPrompt = `You are drafting a reply to an email thread. Understand the full conversation context and draft an appropriate response.

Thread Context:
${threadContext.slice(0, 6000)}

User's instruction for the reply: ${prompt}

Draft the reply as HTML. Be professional, contextually aware, and concise. Only output the reply body HTML, no subject or headers.`;

  const result = await model.generateContent(replyPrompt);
  return result.response.text();
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
  const request = {
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768
  } as unknown as Parameters<typeof model.embedContent>[0];
  const result = await model.embedContent(request);
  return result.embedding.values;
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += 5) {
    const batch = texts.slice(i, i + 5);
    const embeddings = await Promise.all(batch.map((t) => generateEmbedding(t)));
    results.push(...embeddings);
  }
  return results;
}

export async function chatWithEmails(
  query: string,
  relevantEmails: EmailMessage[],
  conversationHistory: { role: string; content: string }[]
): Promise<string> {
  const model = getGeminiModel();

  const emailContext = relevantEmails.map((e, i) =>
    `[Email ${i + 1}] ID: ${e.gmail_id}\nFrom: ${e.from_name} <${e.from_address}>\nSubject: ${e.subject}\nDate: ${e.date}\n${(e.body_text || e.snippet || '').slice(0, 1500)}`
  ).join('\n===\n');

  const historyContext = conversationHistory.slice(-6).map(
    (m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n');

  const prompt = `You are an AI assistant with access to the user's emails as your knowledge base.

RULES:
1. ONLY use information from the provided emails. Never hallucinate or make up information.
2. Always cite which email(s) your information comes from (mention sender, subject, date).
3. If information is not in the emails, clearly say "I don't have that information in your emails."
4. Synthesize information from multiple emails when relevant.
5. Maintain conversation context from the chat history.

EMAIL KNOWLEDGE BASE:
${emailContext.slice(0, 10000)}

CONVERSATION HISTORY:
${historyContext}

USER QUERY: ${query}

Provide a clear, well-structured response with source attributions.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function deduplicateNews(newsletters: EmailMessage[]): Promise<NewsItem[]> {
  const model = getGeminiModel();
  const newsContent = newsletters.map((e) =>
    `[Source: ${e.from_name}, Date: ${e.date}, ID: ${e.gmail_id}]\n${(e.body_text || e.snippet || '').slice(0, 2000)}`
  ).join('\n===\n');

  const prompt = `Extract unique news items from these newsletter emails. Deduplicate stories that cover the same topic.
Return as JSON array:
[{"title": "...", "summary": "...", "sources": [{"newsletter": "...", "email_id": "...", "date": "..."}]}]

Remove duplicates where the same story appears in multiple newsletters. Keep the best summary.

Newsletters:
${newsContent.slice(0, 10000)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try { return JSON.parse(jsonMatch[0]); } catch { return []; }
}
