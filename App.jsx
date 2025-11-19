import { useState, useRef } from 'react';
import { Mic, Square, Loader2, FileText, Download, Key, CheckCircle } from 'lucide-react';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [cleanedText, setCleanedText] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    if (!openaiApiKey || !anthropicApiKey) {
      setShowApiKeyInput(true);
      alert('Du behöver mata in både OpenAI och Anthropic API-nycklar först!');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      alert('Kunde inte starta inspelning. Kontrollera att du har gett åtkomst till mikrofonen.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob || !openaiApiKey) return;

    setIsTranscribing(true);
    setTranscription('');

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'sv');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Whisper API-fel: ' + response.statusText);
      }

      const data = await response.json();
      setTranscription(data.text);
      
      await cleanTranscription(data.text);
    } catch (error) {
      alert('Fel vid transkribering: ' + error.message + '\n\nKontrollera att din API-nyckel är korrekt.');
      setIsTranscribing(false);
    }
  };

  const cleanTranscription = async (textToClean) => {
    const text = textToClean || transcription;
    if (!text) return;

    setIsCleaning(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
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

      const data = await response.json();
      
      if (data.content && data.content[0] && data.content[0].text) {
        setCleanedText(data.content[0].text);
      } else {
        setCleanedText('Kunde inte bearbeta transkriberingen.');
      }
    } catch (error) {
      setCleanedText('Ett fel uppstod vid rensning: ' + error.message);
    } finally {
      setIsTranscribing(false);
      setIsCleaning(false);
    }
  };

  const downloadText = () => {
    const content = `=== ORIGINAL TRANSKRIBERING ===\n\n${transcription}\n\n\n=== RENSAT INNEHÅLL ===\n\n${cleanedText}`;
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `genomgang-${new Date().toLocaleDateString('sv-SE')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setAudioBlob(null);
    setTranscription('');
    setCleanedText('');
    setRecordingTime(0);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '64rem',
        margin: '0 auto'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '2rem'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '4rem',
              height: '4rem',
              background: '#e0e7ff',
              borderRadius: '50%',
              marginBottom: '1rem'
            }}>
              <Mic style={{ width: '2rem', height: '2rem', color: '#4f46e5' }} />
            </div>
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: '0.5rem'
            }}>
              Lärargenomgång - Whisper + Claude
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Spela in → Transkribera (Whisper) → Rensa (Claude)
            </p>
            <p style={{
              color: '#16a34a',
              fontWeight: '600',
              fontSize: '0.875rem',
              marginTop: '0.5rem'
            }}>
              💰 Mycket billigare än direkt audio till Claude!
            </p>
          </div>

          {(!openaiApiKey || !anthropicApiKey || showApiKeyInput) && (
            <div style={{
              marginBottom: '2rem',
              background: '#fefce8',
              border: '2px solid #fde047',
              borderRadius: '0.5rem',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <Key style={{ width: '1.5rem', height: '1.5rem', color: '#ca8a04', flexShrink: 0, marginTop: '0.25rem' }} />
                <div style={{ width: '100%' }}>
                  <h3 style={{
                    fontWeight: 'bold',
                    color: '#713f12',
                    marginBottom: '0.5rem'
                  }}>API-nycklar krävs</h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#854d0e',
                    marginBottom: '1rem'
                  }}>
                    Du behöver två API-nycklar:
                  </p>
                  
                  {/* OpenAI API Key */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#713f12',
                      marginBottom: '0.25rem'
                    }}>
                      OpenAI API-nyckel (för Whisper transkribering)
                    </label>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#854d0e',
                      marginBottom: '0.5rem'
                    }}>
                      Skaffa på <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: '600' }}>platform.openai.com</a>
                    </p>
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="sk-..."
                      style={{
                        width: '100%',
                        padding: '0.5rem 1rem',
                        border: '2px solid #fde047',
                        borderRadius: '0.5rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Anthropic API Key */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#713f12',
                      marginBottom: '0.25rem'
                    }}>
                      Anthropic API-nyckel (för Claude rensning)
                    </label>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#854d0e',
                      marginBottom: '0.5rem'
                    }}>
                      Skaffa på <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: '600' }}>console.anthropic.com</a>
                    </p>
                    <input
                      type="password"
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      style={{
                        width: '100%',
                        padding: '0.5rem 1rem',
                        border: '2px solid #fde047',
                        borderRadius: '0.5rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (openaiApiKey && anthropicApiKey) setShowApiKeyInput(false);
                    }}
                    disabled={!openaiApiKey || !anthropicApiKey}
                    style={{
                      width: '100%',
                      padding: '0.5rem 1rem',
                      background: (openaiApiKey && anthropicApiKey) ? '#ca8a04' : '#d4d4d4',
                      color: 'white',
                      borderRadius: '0.5rem',
                      fontWeight: '600',
                      border: 'none',
                      cursor: (openaiApiKey && anthropicApiKey) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Spara nycklar
                  </button>
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#a16207',
                    marginTop: '0.5rem'
                  }}>
                    Nycklarna sparas bara i din webbläsare och skickas endast till respektive API.
                  </p>
                </div>
              </div>
            </div>
          )}

          {openaiApiKey && anthropicApiKey && !showApiKeyInput && (
            <div style={{
              marginBottom: '1.5rem',
              background: '#f0fdf4',
              borderLeft: '4px solid #22c55e',
              padding: '1rem',
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: '#16a34a' }} />
                <span style={{ color: '#166534', fontWeight: '600' }}>API-nycklar sparade</span>
              </div>
              <button
                onClick={() => setShowApiKeyInput(true)}
                style={{
                  fontSize: '0.875rem',
                  color: '#15803d',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Ändra
              </button>
            </div>
          )}

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {!isRecording && !audioBlob && (
              <button
                onClick={startRecording}
                disabled={!openaiApiKey || !anthropicApiKey}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 2rem',
                  background: (openaiApiKey && anthropicApiKey) ? '#ef4444' : '#9ca3af',
                  color: 'white',
                  borderRadius: '9999px',
                  fontWeight: '600',
                  fontSize: '1.125rem',
                  border: 'none',
                  cursor: (openaiApiKey && anthropicApiKey) ? 'pointer' : 'not-allowed',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Mic style={{ width: '1.5rem', height: '1.5rem' }} />
                Starta inspelning
              </button>
            )}

            {isRecording && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '1rem',
                    height: '1rem',
                    background: '#ef4444',
                    borderRadius: '50%',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}></div>
                  <span style={{
                    fontSize: '1.5rem',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: '#1f2937'
                  }}>
                    {formatTime(recordingTime)}
                  </span>
                </div>
                <button
                  onClick={stopRecording}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 2rem',
                    background: '#1f2937',
                    color: 'white',
                    borderRadius: '9999px',
                    fontWeight: '600',
                    fontSize: '1.125rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <Square style={{ width: '1.5rem', height: '1.5rem' }} />
                  Stoppa inspelning
                </button>
              </div>
            )}

            {audioBlob && !transcription && !isTranscribing && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>
                  Inspelning klar! ({formatTime(recordingTime)})
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={transcribeAudio}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem 2rem',
                      background: '#4f46e5',
                      color: 'white',
                      borderRadius: '9999px',
                      fontWeight: '600',
                      fontSize: '1.125rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <FileText style={{ width: '1.5rem', height: '1.5rem' }} />
                    Transkribera & Rensa
                  </button>
                  <button
                    onClick={reset}
                    style={{
                      padding: '1rem 1.5rem',
                      background: '#e5e7eb',
                      color: '#374151',
                      borderRadius: '9999px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Ny inspelning
                  </button>
                </div>
              </div>
            )}
          </div>

          {isTranscribing && (
            <div style={{
              background: '#eff6ff',
              borderLeft: '4px solid #3b82f6',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Loader2 style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  color: '#3b82f6',
                  animation: 'spin 1s linear infinite'
                }} />
                <div>
                  <p style={{ fontWeight: '600', color: '#1e3a8a' }}>
                    Steg 1/2: Transkriberar med Whisper...
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                    Detta tar oftast 10-30 sekunder
                  </p>
                </div>
              </div>
            </div>
          )}

          {isCleaning && (
            <div style={{
              background: '#eef2ff',
              borderLeft: '4px solid #6366f1',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Loader2 style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  color: '#6366f1',
                  animation: 'spin 1s linear infinite'
                }} />
                <div>
                  <p style={{ fontWeight: '600', color: '#312e81' }}>
                    Steg 2/2: Rensar med Claude...
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#4338ca' }}>
                    Tar bort irrelevanta kommentarer
                  </p>
                </div>
              </div>
            </div>
          )}

          {transcription && !isCleaning && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 'bold',
                color: '#374151',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📝 Original transkribering (från Whisper)
              </h3>
              <div style={{
                background: '#f9fafb',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1rem',
                maxHeight: '12rem',
                overflowY: 'auto'
              }}>
                <p style={{
                  color: '#374151',
                  fontSize: '0.875rem',
                  lineHeight: '1.625'
                }}>{transcription}</p>
              </div>
            </div>
          )}

          {cleanedText && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <FileText style={{ width: '1.5rem', height: '1.5rem', color: '#4f46e5' }} />
                  Rensat resultat
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={downloadText}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: '#16a34a',
                      color: 'white',
                      borderRadius: '0.5rem',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Download style={{ width: '1rem', height: '1rem' }} />
                    Ladda ner
                  </button>
                  <button
                    onClick={reset}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#e5e7eb',
                      color: '#374151',
                      borderRadius: '0.5rem',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Ny inspelning
                  </button>
                </div>
              </div>
              
              <div style={{
                background: 'linear-gradient(to bottom right, #eef2ff, #faf5ff)',
                border: '2px solid #c7d2fe',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                minHeight: '18.75rem'
              }}>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  color: '#1f2937',
                  lineHeight: '1.625',
                  margin: 0
                }}>
                  {cleanedText}
                </pre>
              </div>
            </div>
          )}

          {!audioBlob && !isRecording && openaiApiKey && anthropicApiKey && (
            <div style={{
              marginTop: '2rem',
              background: '#eff6ff',
              borderLeft: '4px solid #3b82f6',
              padding: '1.5rem',
              borderRadius: '0.5rem'
            }}>
              <h3 style={{
                fontWeight: 'bold',
                color: '#1e3a8a',
                marginBottom: '0.5rem'
              }}>Så här använder du verktyget:</h3>
              <ol style={{
                listStylePosition: 'inside',
                color: '#1e40af',
                fontSize: '0.875rem',
                lineHeight: '1.75'
              }}>
                <li>Klicka på "Starta inspelning"</li>
                <li>Håll din genomgång som vanligt</li>
                <li>Klicka på "Stoppa inspelning"</li>
                <li>Klicka på "Transkribera & Rensa" - först transkriberas ljudet, sedan rensas texten</li>
                <li>Ladda ner eller kopiera resultatet</li>
              </ol>
              <div style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '2px solid #bfdbfe'
              }}>
                <p style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                  💡 <strong>Fördel med Whisper:</strong> Mycket billigare än att skicka ljud direkt till Claude!
                  <br />
                  💰 <strong>Kostnad:</strong> ~$0.006 per minut (Whisper) + ~$0.001-0.003 per genomgång (Claude rensning)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
