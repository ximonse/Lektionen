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
    // Vercel automatically handles multipart/form-data
    const formData = new FormData();
    
    // Get the API key from headers or body
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    // Forward the audio file
    if (!req.body.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    formData.append('file', req.body.file);
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

export const config = {
  api: {
    bodyParser: false,
  },
};
