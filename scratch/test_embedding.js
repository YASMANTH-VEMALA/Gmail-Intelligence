const { GoogleGenAI, GoogleGen } = require('@google/generative-ai');
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

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

async function test() {
  console.log('Testing "text-embedding-004"...');
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent('hello');
    console.log('Success! Vector size:', result.embedding.values.length);
    return;
  } catch (e) {
    console.error('Failed with "text-embedding-004":', e.message);
  }

  console.log('\nTesting "models/text-embedding-004"...');
  try {
    const model = genAI.getGenerativeModel({ model: 'models/text-embedding-004' });
    const result = await model.embedContent('hello');
    console.log('Success! Vector size:', result.embedding.values.length);
    return;
  } catch (e) {
    console.error('Failed with "models/text-embedding-004":', e.message);
  }
}
test();
