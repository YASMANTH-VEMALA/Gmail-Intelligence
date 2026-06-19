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
  console.log('Testing "gemini-embedding-2" with outputDimensionality = 768...');
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
    const result = await model.embedContent({
      content: 'hello',
      outputDimensionality: 768
    });
    console.log('Success! Vector size:', result.embedding.values.length);
  } catch (e) {
    console.error('Failed:', e.message);
  }

  console.log('\nTesting "gemini-embedding-001" with outputDimensionality = 768...');
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await model.embedContent({
      content: 'hello',
      outputDimensionality: 768
    });
    console.log('Success! Vector size:', result.embedding.values.length);
  } catch (e) {
    console.error('Failed:', e.message);
  }
}
test();
