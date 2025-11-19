import { Buffer, Blob } from 'node:buffer';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Api-Key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    const body = await readRequestBody(req);
    const { audio, mimeType, fileName } = body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data required' });
    }

    const buffer = Buffer.from(audio, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, fileName || 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'sv');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `OpenAI API error: ${error}` });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}

async function readRequestBody(req) {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}
