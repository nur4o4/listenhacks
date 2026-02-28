#!/bin/bash
# Quick start script for generating singing voice

echo "🎵 Singing Voice Generator - Quick Start"
echo "========================================"
echo ""

# Check if API key is set
if [ -z "$ELEVEN_LABS_API_KEY" ]; then
    echo "❌ ELEVEN_LABS_API_KEY is not set!"
    echo ""
    echo "Please set your API key:"
    echo "  export ELEVEN_LABS_API_KEY='your_api_key_here'"
    echo ""
    echo "Or edit .env.example and run:"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your API key"
    echo "  source .env"
    exit 1
fi

echo "✓ API key found"
echo ""

# Install dependencies if needed
if ! python3 -c "import requests" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip3 install -r requirements.txt
    echo ""
fi

# Make scripts executable
chmod +x generate_singing.py interactive_singing.py

echo "✅ Setup complete!"
echo ""
echo "Choose how you want to proceed:"
echo ""
echo "1️⃣  Interactive Mode (Recommended)"
echo "   Have a conversation to create lyrics, then generate singing:"
echo "   → python3 interactive_singing.py"
echo ""
echo "2️⃣  Command-Line Mode"
echo "   Direct generation from text or file:"
echo ""
echo "   List voices:"
echo "   → python3 generate_singing.py --list-voices --voice-id dummy"
echo ""
echo "   Generate from text:"
echo "   → python3 generate_singing.py \\"
echo "       --lyrics 'Your lyrics here' \\"
echo "       --voice-id 'VOICE_ID' \\"
echo "       --output my_song.mp3"
echo ""
echo "   Generate from file:"
echo "   → python3 generate_singing.py \\"
echo "       --lyrics-file example_lyrics.txt \\"
echo "       --voice-id 'VOICE_ID' \\"
echo "       --output song.mp3"
echo ""
echo "🚀 Quick start with interactive mode:"
echo "   python3 interactive_singing.py"
echo ""
