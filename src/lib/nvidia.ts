import OpenAI from 'openai';
import type { EmailMessage, EmailCategory } from '@/types';

const NVIDIA_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_API_KEY = process.env.NVIDIA_NIM_API_KEY || '';

// OpenAI-compatible client for NVIDIA NIM
const nvidia = new OpenAI({
  apiKey: NVIDIA_API_KEY,
  baseURL: NVIDIA_BASE_URL,
});

// Fast model for classification & simple tasks
const FAST_MODEL = 'meta/llama-3.1-8b-instruct';

// Deep reasoning model for complex analysis
const REASONING_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

// ========== Fast model helpers (existing functionality) ==========

async function callNvidiaLLM(messages: { role: string; content: string }[], maxTokens = 1024): Promise<string> {
  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: FAST_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA NIM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

export async function nvidiaCategorizeEmail(email: EmailMessage): Promise<EmailCategory> {
  const content = email.body_text || email.snippet || '';
  const response = await callNvidiaLLM([
    {
      role: 'system',
      content: `You are an email classifier. Classify emails into exactly ONE category. Reply with ONLY the category key, nothing else.
Categories: newsletters, job_recruitment, finance, notifications, personal, work_professional`
    },
    {
      role: 'user',
      content: `From: ${email.from_address}\nSubject: ${email.subject}\n${content.slice(0, 1500)}\n\nCategory:`
    }
  ], 50);

  const category = response.trim().toLowerCase().replace(/[^a-z_]/g, '');
  const valid: EmailCategory[] = ['newsletters', 'job_recruitment', 'finance', 'notifications', 'personal', 'work_professional'];
  return valid.includes(category as EmailCategory) ? (category as EmailCategory) : 'uncategorized';
}

export async function nvidiaSummarizeEmail(email: EmailMessage): Promise<string> {
  const content = email.body_text || email.snippet || '';
  return callNvidiaLLM([
    { role: 'system', content: 'Summarize the following email in 2-3 concise sentences. Focus on key information and action items.' },
    { role: 'user', content: `From: ${email.from_name}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${content.slice(0, 3000)}` }
  ], 200);
}

export async function nvidiaRerank(query: string, documents: { id: string; text: string }[]): Promise<{ id: string; score: number }[]> {
  // Use LLM-based reranking since free-tier may not have a dedicated reranker
  const docList = documents.slice(0, 20).map((d, i) => `[${i}] ${d.text.slice(0, 300)}`).join('\n');
  const response = await callNvidiaLLM([
    {
      role: 'system',
      content: `You are a relevance scorer. Given a query and documents, return the indices of the most relevant documents in order of relevance. Return ONLY comma-separated indices, most relevant first. Example: 3,1,7,0`
    },
    { role: 'user', content: `Query: ${query}\n\nDocuments:\n${docList}` }
  ], 100);

  const indices = response.trim().split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  return indices.map((idx, rank) => {
    const doc = documents[idx];
    return doc ? { id: doc.id, score: 1 - (rank / indices.length) } : null;
  }).filter(Boolean) as { id: string; score: number }[];
}

// ========== Deep Reasoning with Nemotron (new functionality) ==========

/**
 * Use NVIDIA NIM Nemotron for deep reasoning tasks.
 * This model has a dedicated reasoning budget and thinking capabilities,
 * making it ideal for complex analytical questions about email content.
 *
 * Gemini handles tool-calling (search, draft, send, labels).
 * Nemotron handles deep synthesis and reasoning over gathered context.
 */
export async function reasonWithNIM(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    reasoningBudget?: number;
  }
): Promise<string> {
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 4096;
  const reasoningBudget = options?.reasoningBudget ?? 8192;

  console.log(`[NVIDIA NIM] Calling ${REASONING_MODEL} for deep reasoning...`);

  const completion = await nvidia.chat.completions.create({
    model: REASONING_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    top_p: 0.95,
    max_tokens: maxTokens,
    reasoning_budget: reasoningBudget,
    chat_template_kwargs: { enable_thinking: true },
    stream: false,
  } as any);

  const content = completion.choices?.[0]?.message?.content || '';
  console.log(`[NVIDIA NIM] Response received (${content.length} chars)`);
  return content;
}

/**
 * Deep-reason over email context after Gemini has gathered data via tools.
 * This takes the raw tool results and produces a richer, more analytical response.
 */
export async function deepAnalyzeEmails(
  userQuery: string,
  toolContext: string,
  conversationHistory: string
): Promise<string> {
  const systemPrompt = `You are repeatless, an advanced AI email intelligence agent.
You have been given email data that was retrieved by your tool-calling subsystem.
Your job is to deeply analyze this data and provide a rich, insightful response.

RULES:
1. ONLY use information from the provided email context. Never fabricate data.
2. Always cite sources (sender, subject, date) in your answer.
3. Provide structured, well-formatted responses using markdown (bold, lists, headers).
4. For analytical questions, provide patterns, trends, and actionable insights.
5. If the data is insufficient, clearly state what's missing.
6. Be concise but thorough — favor depth over breadth.`;

  const userPrompt = `## User Question
${userQuery}

## Email Data (retrieved by tools)
${toolContext}

## Conversation History
${conversationHistory}

Provide a comprehensive, well-structured analysis.`;

  return reasonWithNIM(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 4096,
    reasoningBudget: 8192,
  });
}
