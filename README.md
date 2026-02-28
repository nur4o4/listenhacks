# ListenHacks Project Collection

This repository contains multiple audio and AI projects:

## 📁 Projects

### 🎵 [Music Generator](music_generator/)
A singing voice and music generator using the Eleven Labs API. Generate real singing with melody and instrumental music from lyrics.

**Features:**
- Real singing with melody and music using Music API
- Interactive conversational agent for lyric creation
- Text-to-Speech mode for expressive delivery
- Customizable genre, tempo, mood, and voice settings

**Get Started:**
```bash
cd music_generator
# Follow the README in that folder for setup
```

### 🏚️ [Mixer - Browser Audio DAW](mixer/) ⭐ NEW: AI Chat-to-Song with Gemini!

A browser-based Digital Audio Workstation with multi-track recording, effects, and an **AI chatbot powered by Google Gemini** that creates personalized songs from voice conversations!

**Features:**
- Multi-track audio recording and playback
- Real-time effects: Reverb, Delay, Autotune
- Timeline with loop recording and overdubbing
- **🤖 AI Chat-to-Song with Gemini**:
  - Voice chat using Web Speech API (browser-native, FREE!)
  - Gemini 1.5 Pro for natural conversations
  - Personalized lyrics generation
  - A cappella song creation

**How it works:**
1. Hold the mic button and chat with Gemini about your feelings or experiences
2. Gemini responds empathetically and asks follow-up questions
3. Say **"I'M READY"** when you want your song
4. Gemini analyzes the conversation and generates personalized lyrics
5. System creates an a cappella track with your unique song
6. Download and share your creation!

**Quick Start:**
```bash
# Run setup script
./setup_chatbot.sh

# Or manually:
cd mixer/server
npm install
npm start

# Open http://localhost:3000
```

📖 **[Full Chatbot Documentation](mixer/CHATBOT_README.md)**

### 👋 [Hand Tracking](hand_tracking/)
A hand tracking application using MediaPipe and OpenCV for finger detection and gesture recognition.

**Features:**
- Real-time hand detection via webcam
- Finger counting and gesture recognition
- Visual feedback with landmark tracking

**Get Started:**
```bash
cd hand_tracking
python testhands.py
```

## 🚀 Quick Start

Each project is self-contained in its own directory. Navigate to the project folder you're interested in and follow its specific README for installation and usage instructions.

## 🔑 Environment Setup

For mixer chatbot and music generation, create a `.env` file in the project root:

```bash
# Eleven Labs (for music generation and singing)
ELEVEN_LABS_API_KEY=sk_your_eleven_labs_key_here

# Anthropic (for mixer chatbot with Claude)
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key_here
```

Get API keys:
- Eleven Labs: https://elevenlabs.io/
- Anthropic: https://console.anthropic.com/

## 🎚️ Mixer Backend + Action Router

The `mixer/server/` folder exposes a local action API on port `3000` and serves the mixer frontend directly from `mixer/`.

### New AI Chatbot Endpoints:
- `POST /api/chat` - Get Claude's response to conversation
- `POST /api/generate-song` - Generate personalized song from conversation
- `GET /audio/:filename` - Serve generated audio files

```bash
cd mixer/server
npm install
npm run dev
```

Use `POST /api/actions` to trigger frontend behaviors:

```bash
curl -H "Content-Type: application/json" -d '{"type":"START_RECORD","clientId":"demo-1"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"END_RECORD","clientId":"demo-2"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"START_LOOP","clientId":"demo-3"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"END_LOOP","clientId":"demo-4"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"PLAY","clientId":"demo-5"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"PAUSE","clientId":"demo-6"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_REVERB_ENABLED","payload":{"enabled":true},"clientId":"demo-7"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_REVERB_DECAY","payload":{"value":3.2},"clientId":"demo-8"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_DELAY_ENABLED","payload":{"enabled":true},"clientId":"demo-9"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_DELAY_TIME","payload":{"value":0.3},"clientId":"demo-10"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_DELAY_FEEDBACK","payload":{"value":45},"clientId":"demo-11"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_DELAY_WET","payload":{"value":40},"clientId":"demo-12"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_DELAY_ADVANCED_CLAMP","payload":{"enabled":true},"clientId":"demo-13"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_AUTOTUNE_ENABLED","payload":{"enabled":true},"clientId":"demo-14"}' http://localhost:3000/api/actions
curl -H "Content-Type: application/json" -d '{"type":"SET_AUTOTUNE_SEMITONES","payload":{"value":2},"clientId":"demo-15"}' http://localhost:3000/api/actions
```

Useful endpoints:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/actions/recent
```

## 📝 License

See individual project folders for specific license information.
