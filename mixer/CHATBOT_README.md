# 🎵 AI Chat-to-Song with Gemini

## Overview

The mixer now features an AI-powered chatbot sidebar that creates personalized songs from voice conversations using **Google Gemini**!

### How It Works

1. **Voice Chat**: Hold the microphone button and talk to Gemini
2. **Natural Conversation**: Gemini asks about your feelings, experiences, or what's on your mind
3. **Automatic Song Generation**: When you say **"I'M READY"**, the system will:
   - Analyze your conversation with Gemini
   - Extract themes, emotions, and personalized lyrics
   - Generate an a cappella song (vocals only)
   - Present it for playback and download

## Architecture

### Frontend (`mixer/`)
- **Split Layout**: 2/3 DAW interface + 1/3 chatbot sidebar
- **Voice Input**: Uses **Web Speech API** (browser-based, no external STT API needed!)
- **UI**: [mixer/js/chatbot.js](js/chatbot.js) handles recording, messages, and API calls

### Backend - Mixer Server (`mixer/server/`)
- **Conversation AI**: **Claude 3.5 Sonnet** for empathetic, natural responses
- **Song Analysis**: Claude extracts lyrics, genre, mood, and tempo from conversation
- **API Proxy**: Routes song generation requests to Music Generator API

### Backend - Music Generator API (`music_generator/`)
- **Flask API Server**: Dedicated Python API for song generation on port 5000
- **Endpoints**:
  - `POST /generate` - Generate song from lyrics and parameters
  - `GET /health` - Health check endpoint
  - `GET /download/:filename` - Download generated songs
- **Integration**: Uses `generate_music.py` with Eleven Labs Music API
- **Output**: Saves to `mixer/audio_files/` for serving

### Key Technologies
- **Anthropic Claude 3.5 Sonnet**: Conversation + lyrics extraction
- **Web Speech API**: Browser-native speech-to-text (no API costs!)
- **Flask**: Python API server for music generation
- **Eleven Labs**: Voice synthesis for singing
- **Node.js + Python**: Seamless microservices architecture

## Setup

### 1. Add API Keys to `.env`

In your `.env` file at the project root:

```bash
ELEVEN_LABS_API_KEY=sk_your_eleven_labs_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your Gemini API key at: https://aistudio.google.com/app/apikey

### 2. Install Node Dependencies

```bash
cd mixer/server
npm install
```

New packages:
- `@google/generative-ai` - Google Gemini API client
- `dotenv` - Environment variable loading
- `axios` - HTTP client for calling Music Generator API

### 3. Install Python Dependencies

```bash
cd music_generator
pip install -r requirements.txt
```

New packages:
- `flask` - Python web framework for API server
- `flask-cors` - CORS support for API

### 4. Start Both Servers

**Option A: Use the startup script (recommended)**

```bash
./start_chatbot.sh
```

This automatically starts both:
- Music Generator API on port 5001
- Mixer Frontend on port 3000

**Option B: Start manually**

In terminal 1 (Music Generator API):
```bash
cd music_generator
PORT=5001 python3 api_server.py
```

In terminal 2 (Mixer Frontend):
```bash
cd mixer/server
npm start
```

### 5. Open in Browser

Navigate to **http://localhost:3000**

## Usage

1. Open **http://localhost:3000** in your browser
2. **Allow microphone access** when prompted
3. **Hold the 🎤 button** and speak
4. **Release** to send your message
5. **Chat naturally** with Claude about your feelings, experiences
6. When ready, say **"I'M READY"** or **"MAKE THE SONG"**
7. **Listen** to your generated song and **download** it!

## API Endpoints

### `POST /api/chat`
- **Purpose**: Get Claude's response to user message
- **Input**: 
  ```json
  {
    "conversation": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
  ```
- **Output**: 
  ```json
  {
    "message": "Claude's response"
  }
  ```

### `POST /api/generate-song`
- **Purpose**: Generate personalized song from conversation
- **Input**: 
  ```json
  {
    "conversation": [ ... ]
  }
  ```
- **Output**: 
  ```json
  {
    "success": true,
    "audioUrl": "/audio/generated_song_123.mp3",
    "lyrics": "...",
    "genre": "...",
    "mood": "...",
    "tempo": "..."
  }
  ```

### `GET /audio/:filename`
- **Purpose**: Serve generated audio files
- **Returns**: MP3 audio file

## User Flow

```
1. User holds mic button
   ↓
2. Web Speech API records & transcribes
   ↓
3. Display user message
   ↓
4. POST /api/chat → Claude response
   ↓
5. Display Claude's message
   ↓
6. Repeat conversation...
   ↓
7. User says "I'M READY"
   ↓
8. POST /api/generate-song:
   - Claude analyzes conversation
   - Extracts lyrics + parameters
   - Python generates a cappella
   ↓
9. Song displayed with player
   ↓
10. User plays/downloads
```

## Browser Compatibility

### Web Speech API Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Best experience |
| Edge | ✅ Full | Chromium-based |
| Safari | ✅ Full | Webkit Speech API |
| Firefox | ⚠️ Partial | May need flag enabled |
| Mobile Chrome | ✅ Works | Touch events supported |
| Mobile Safari | ✅ Works | Requires user permission |

**Note**: HTTPS or localhost required for microphone access

## Cost Estimation

- **Claude 3.5 Sonnet**: ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens
  - Typical conversation: ~$0.05-0.15
- **Web Speech API**: **FREE** (browser-native!)
- **Eleven Labs Music**: Varies by plan (check your account)

**Total cost per song: ~$0.10-0.50**

## Customization

### Change Claude's Personality

Edit the system prompt in [mixer/server/index.js](server/index.js) around line 155:

```javascript
const systemPrompt = `You are a warm, empathetic AI music companion...`;
```

### Adjust Trigger Phrases

Edit in [mixer/js/chatbot.js](js/chatbot.js) around line 145:

```javascript
detectReadyTrigger(text) {
  const normalizedText = text.toLowerCase();
  return normalizedText.includes('im ready') || 
         normalizedText.includes('create the song');
}
```

### Modify Song Generation

In [mixer/server/index.js](server/index.js) around line 243:

```javascript
const args = [
  '--lyrics', songParams.lyrics,
  '--genre', 'a cappella',  // Change genre here
  '--tempo', songParams.tempo,
  '--mood', songParams.mood,
  '--length', '25000',      // Length in ms
  '--output', outputPath
];
```

### Change Gemini Model

In [mixer/server/index.js](mixer/server/index.js):

```javascript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-pro',  // or gemini-1.5-flash for faster/cheaper
  systemInstruction: systemPrompt
});
```

## Troubleshooting

### "Speech Recognition not supported"
- Try Chrome or Edge (best support)
- Enable Web Speech API in Firefox: `about:config` → `media.webspeech.recognition.enable`
- Use HTTPS (required for mic access)

### "API key not configured"
- Verify `.env` file exists in project root
- Check `ANTHROPIC_API_KEY` is set correctly (starts with `sk-ant-`)
- Restart server after updating `.env`

### Song generation fails
- Check Python environment is activated
- Ensure `music_generator/generate_music.py` exists
- Verify Eleven Labs API has credits
- Check server logs for Python errors

### Microphone not working
- Allow microphone permissions in browser
- Check system settings (macOS: System Preferences → Security & Privacy → Microphone)
- Try refreshing the page

### Audio file not playing
- Check `mixer/audio_files/` directory exists
- Verify file permissions
- Check browser console for 404 errors

## Advantages of This Stack

### Web Speech API (vs traditional STT)
- ✅ **Free**: No API costs for transcription
- ✅ **Fast**: Real-time processing in browser
- ✅ **Private**: Audio never leaves the browser
- ✅ **Zero latency**: No network round-trip for STT

### Claude (vs GPT-4)
- ✅ **Better context**: 200K token context window
- ✅ **More empathetic**: Great for conversational AI
- ✅ **Faster**: Quick response times
- ✅ **Cost-effective**: Lower pricing than GPT-4

## Future Enhancements

- [ ] Text input option (in addition to voice)
- [ ] Multiple voice styles for singing
- [ ] Longer songs with verse/chorus structure
- [ ] Export lyrics separately as text
- [ ] Share songs via unique links
- [ ] Conversation history/replay
- [ ] Multi-language support
- [ ] Real-time waveform visualization
- [ ] Voice tone analysis for mood detection

## Credits

- **Anthropic Claude**: Conversation AI and lyrics generation
- **Web Speech API**: Browser-native speech recognition
- **Eleven Labs**: Music generation and singing voices
- **ListenHacks**: Browser Audio DAW platform

---

Enjoy creating personalized songs with AI! 🎵✨
