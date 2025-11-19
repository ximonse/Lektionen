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
    const { text, apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    if (!text) {
      return res.status(400).json({ error: 'Text required' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [
          {
            role: 'user',
            content: `Du är en assistent som hjälper lärare att rensa och strukturera sina genomgångar.

Här är en transkribering av en lärargenomgång. Skapa en RENSAT och STRUKTURERAD sammanfattning som ENDAST innehåller:
- Vad som ska hända under lektionen/arbetspasset
- Arbetsuppgifter och instruktioner
- Ämnesinnehåll och förklaringar
- Räknemetoder och exempel

TA BORT:
- Kommentarer till enskilda elever (t.ex. "David, var tyst", "Emma, kan du sätta dig")
- Bakgrundskommentarer och irrelevanta kommentarer
- Organisatoriska avbrott som inte är viktiga för innehållet
- Upprepningar av samma information
- Transkriberingfel och ofullständiga meningar

Formatera resultatet tydligt med rubriker. Skriv på svenska.

TRANSKRIBERING:
${text}`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${error}` });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
