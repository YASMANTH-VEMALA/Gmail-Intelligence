const fs = require('fs');
const envPath = '/home/yasmanth/Pictures/repeatless/.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const cleanText = (str) => {
  if (!str) return '';
  // Keep only printable ascii and common latin characters, remove control chars
  return str
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .slice(0, 300);
};

async function categorizeEmailsBatch(emails) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const chunk = emails.slice(0, 50);
  const emailData = chunk.map((email, idx) => ({
    index: idx,
    id: email.gmail_id,
    subject: cleanText(email.subject),
    from: cleanText(email.from_address),
    snippet: cleanText(email.body_text || email.snippet)
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

  console.log('JSON Payload Size:', JSON.stringify(emailData).length, 'chars');
  console.log('Sending batch prompt to Gemini...');
  try {
    const start = Date.now();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });
    
    const responseText = result.response.text();
    console.log(`Received response in ${((Date.now() - start)/1000).toFixed(1)}s:`, responseText);
    const parsed = JSON.parse(responseText);
    console.log('Parsed successfully! Item count:', parsed.classifications?.length);
  } catch (e) {
    console.error('Batch categorization failed:', e);
  }
}

async function run() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };

  const userId = 'c3e8436a-a955-43c9-a241-d039ccacfb1f';
  const url = `${supabaseUrl}/rest/v1/emails?user_id=eq.${userId}&select=*&limit=50`;
  const res = await fetch(url, { headers });
  const emails = await res.json();

  console.log(`Fetched ${emails.length} emails. Running batch categorization...`);
  await categorizeEmailsBatch(emails);
}

run();
