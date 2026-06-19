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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    console.log('Using API key length:', process.env.GEMINI_API_KEY?.length);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('Sending prompt to gemini-2.5-flash...');
    const result = await model.generateContent('Hello! Tell me in 3 words if you are working.');
    console.log('Response:', result.response.text());
  } catch (e) {
    console.error('Error calling Gemini:', e);
  }
}

run();
