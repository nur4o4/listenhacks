# ListenHacks Project Collection

This repository contains two separate projects:

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

### 👋 [Hand Tracking](hand_tracking/)
A hand tracking application using MediaPipe and OpenCV for finger detection and gesture recognition.

**Features:**
- Real-time hand detection via webcam
- Finger counting and gesture recognition
- Visual feedback with landmark tracking

**Get Started:**
```bash
cd hand_tracking
# Run the hand tracking application
python testhands.py
```

## 🚀 Quick Start

Each project is self-contained in its own directory. Navigate to the project folder you're interested in and follow its specific README for installation and usage instructions.

## 🎚️ Mixer Backend + Action Router

The `mixer/server/` folder exposes a local action API on port `3000` and serves the mixer frontend directly from `mixer/`.
The server only relays actions; it never records audio.

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
