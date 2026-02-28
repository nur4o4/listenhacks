#!/bin/bash
# Quick setup script for Mixer AI Chat-to-Song with Claude

echo "🎵 Setting up Mixer AI Chat-to-Song..."
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo ""
    echo "Please create a .env file with your API keys:"
    echo "  ELEVEN_LABS_API_KEY=sk_your_key_here"
    echo "  ANTHROPIC_API_KEY=sk-ant-your_key_here"
    echo ""
    exit 1
fi

echo "✓ .env file found"

# Check for API keys
if ! grep -q "ELEVEN_LABS_API_KEY=sk_" .env; then
    echo "⚠️  Warning: ELEVEN_LABS_API_KEY not set in .env"
fi

if ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set in .env"
fi

echo ""

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
cd mixer/server
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node dependencies"
    exit 1
fi

echo ""
echo "✓ Node dependencies installed"
echo ""

# Check Python environment
echo "🐍 Checking Python environment..."
cd ../../music_generator

if [ ! -f "generate_music.py" ]; then
    echo "❌ generate_music.py not found!"
    exit 1
fi

echo "✓ Python scripts found"
echo ""

# Check requirements
if [ -f "requirements.txt" ]; then
    echo "💡 Install Python dependencies with:"
    echo "  source ../.venv/bin/activate  # if using venv"
    echo "  cd music_generator"
    echo "  pip install -r requirements.txt"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎬 To start the mixer:"
echo "  cd mixer/server"
echo "  npm start"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "📖 Full docs: mixer/CHATBOT_README.md"
echo ""
echo "🎤 Usage:"
echo "  1. Hold the mic button and speak"
echo "  2. Chat with Claude about your feelings"
echo "  3. Say 'I'M READY' to generate your song"
echo "  4. Download and enjoy! 🎵"
