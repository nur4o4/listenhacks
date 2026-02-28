import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import axios from 'axios';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_SOURCE_DIR = path.join(__dirname, '..');
const MAX_ACTIONS = 200;
const MUSIC_GENERATOR_API = 'http://localhost:5001';
const AUDIO_OUTPUT_DIR = path.join(__dirname, '../audio_files');

// Initialize Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ACTION_ALLOWLIST = new Set([
  'ENABLE_MIC',
  'START_RECORD',
  'END_RECORD',
  'PLAY',
  'PAUSE',
  'START_LOOP',
  'END_LOOP',
  'SET_REVERB_ENABLED',
  'SET_DISTORTION_ENABLED',
  'TOGGLE_MONITORING',
]);

const recentActions = [];
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function sanitizeActionPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return payload;
}

function pushRecentAction(action) {
  recentActions.push(action);
  while (recentActions.length > MAX_ACTIONS) {
    recentActions.shift();
  }
}

function broadcastAction(action) {
  let count = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(action));
      count += 1;
    }
  }

  console.log(
    `[ws] action broadcast ${action.type}`,
    `id=${action.id}`,
    `clients=${count}`,
  );
}

function allowlistActionType(type) {
  return ACTION_ALLOWLIST.has(type);
}

app.use(express.json());
app.use('/css', express.static(path.join(FRONTEND_SOURCE_DIR, 'css')));
app.use('/js', express.static(path.join(FRONTEND_SOURCE_DIR, 'js')));

wss.on('connection', (socket) => {
  console.log('[ws] client connected');

  socket.on('close', () => {
    console.log('[ws] client disconnected');
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/actions/recent', (req, res) => {
  res.json(recentActions);
});

app.post('/api/actions', (req, res) => {
  const body = req.body || {};
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const clientId = body.clientId;
  const payload = sanitizeActionPayload(body.payload);

  if (!type) {
    return res.status(400).json({
      ok: false,
      error: 'type is required',
    });
  }

  if (!allowlistActionType(type)) {
    return res.status(400).json({
      ok: false,
      error: 'Unknown action type',
      type,
    });
  }

  const action = {
    id: clientId || randomUUID(),
    type,
    payload,
    clientId,
    receivedAtMs: Date.now(),
  };

  pushRecentAction(action);
  console.log('[http] action received', action.type, action.id);

  broadcastAction(action);
  return res.json({
    ok: true,
    id: action.id,
  });
});

// AI Chatbot Endpoints

// Gemini Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { conversation } = req.body;

    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ error: 'Invalid conversation format' });
    }

    console.log('[chat] Processing conversation with', conversation.length, 'messages');

    // System prompt for the AI song creator
    const systemPrompt = `You are a warm, empathetic AI music companion helping users create personalized songs through natural conversation.

Your approach:
- Be friendly and conversational, like a creative friend
- Ask about their feelings, experiences, or what's on their mind
- Listen actively and show understanding
- Gently guide them to express emotions and stories
- Ask follow-up questions to dig deeper
- Keep responses SHORT - around 50 words maximum (this is spoken aloud)

When the user says they're ready (like "I'm ready" or "let's do it"), the system will automatically generate their song.

Focus on the emotional journey and creative expression. Make them feel heard.`;

    // Build chat history for Gemini
    const history = conversation.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt
    });

    const chat = model.startChat({ history });
    const lastMessage = conversation[conversation.length - 1];
    const result = await chat.sendMessage(lastMessage.content);

    const aiMessage = result.response.text();
    console.log('[chat] Gemini response:', aiMessage);

    res.json({ message: aiMessage });

  } catch (error) {
    console.error('[chat] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI response',
      details: error.message 
    });
  }
});

// Text-to-Speech endpoint using ElevenLabs
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('[tts] Converting text to speech:', text.substring(0, 50) + '...');

    // Call ElevenLabs TTS API
    const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - warm, friendly voice
    const ttsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVEN_LABS_API_KEY
        },
        responseType: 'arraybuffer'
      }
    );

    console.log('[tts] Audio generated successfully');

    // Send audio back as response
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(ttsResponse.data));

  } catch (error) {
    console.error('[tts] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error.message 
    });
  }
});

// Song generation endpoint
app.post('/api/generate-song', async (req, res) => {
  try {
    const { conversation } = req.body;

    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ error: 'Invalid conversation format' });
    }

    console.log('[generate-song] Analyzing conversation to create song...');

    // Step 1: Use Gemini to extract song parameters from conversation
    const analysisPrompt = `Analyze this conversation and create a personalized song.

Extract and return ONLY a JSON object with these fields:
{
  "lyrics": "4-8 lines of lyrics that capture what the user shared, using their own words when possible",
  "genre": "one of: pop, rock, r&b, folk, jazz, country",
  "mood": "one word: happy, sad, energetic, melancholic, romantic, angry, hopeful, nostalgic",
  "tempo": "one of: slow, moderate, fast"
}

Make the lyrics emotionally resonant and personal based on what they shared. NO extra text, ONLY the JSON.`;

    // Build chat history for Gemini
    const history = conversation.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(analysisPrompt);

    const responseText = result.response.text();
    console.log('[generate-song] Gemini raw response:', responseText);

    // Extract JSON from response (Gemini might wrap it in markdown)
    let songParams;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        songParams = JSON.parse(jsonMatch[0]);
      } else {
        songParams = JSON.parse(responseText);
      }
    } catch (e) {
      console.error('[generate-song] Failed to parse JSON:', e);
      throw new Error('Failed to extract song parameters');
    }

    console.log('[generate-song] Song parameters:', songParams);

    // Step 2: Call Flask API to generate the song
    console.log('[generate-song] Calling music generator API...');
    
    try {
      const generationResponse = await axios.post(`${MUSIC_GENERATOR_API}/generate`, {
        lyrics: songParams.lyrics,
        genre: songParams.genre || 'pop',
        mood: songParams.mood || 'expressive',
        tempo: songParams.tempo || 'moderate',
        length_ms: 25000
      }, {
        timeout: 120000 // 2 minute timeout for song generation
      });

      const generationData = generationResponse.data;
      console.log('[generate-song] Song generated successfully:', generationData.filename);

      // Return URL to access the audio file
      res.json({
        success: true,
        audioUrl: `/audio/${generationData.filename}`,
        filePath: generationData.path,
        lyrics: songParams.lyrics,
        genre: generationData.genre,
        mood: generationData.mood,
        tempo: generationData.tempo,
        size: generationData.size
      });
      
    } catch (apiError) {
      console.error('[generate-song] Music generator API error:', apiError.message);
      
      if (apiError.code === 'ECONNREFUSED') {
        throw new Error('Music generator API is not running. Please start it with: cd music_generator && python3 api_server.py');
      }
      
      throw new Error(`Music generation failed: ${apiError.message}`);
    }

  } catch (error) {
    console.error('[generate-song] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate song',
      details: error.message 
    });
  }
});

// Serve generated audio files
app.use('/audio', express.static(AUDIO_OUTPUT_DIR));

const fallback = (req, res) => {
  if (req.method !== 'GET') {
    return;
  }
  res.sendFile(path.join(FRONTEND_SOURCE_DIR, 'index.html'), (error) => {
    if (error) {
      res.status(404).send('Frontend not found');
    }
  });
};

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }

  if (req.method !== 'GET') {
    return next();
  }

  return fallback(req, res);
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log('[server] action allowlist:', Array.from(ACTION_ALLOWLIST).join(', '));
});
