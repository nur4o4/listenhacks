#!/bin/bash
# Start both the music generator API and mixer frontend server

echo "🎵 Starting ListenHacks AI Chat-to-Song System..."
echo "=================================================="
echo ""

# Clean up any existing processes on ports 3000 and 5001
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
sleep 1

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create one with your API keys first."
    exit 1
fi

# Check if dependencies are installed
echo "📦 Checking dependencies..."

# Check Node dependencies
if [ ! -d "mixer/server/node_modules" ]; then
    echo "Installing Node.js dependencies..."
    cd mixer/server && npm install && cd ../..
fi

# Check Python dependencies
echo "🐍 Make sure Python dependencies are installed:"
echo "   cd music_generator && pip install -r requirements.txt"
echo ""

# Start music generator API in background
echo "🎵 Starting Music Generator API on port 5001..."
cd music_generator
PORT=5001 python3 api_server.py &
MUSIC_API_PID=$!
cd ..

# Wait a moment for the API to start
sleep 2

# Check if music API started successfully
if ! curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo "❌ Failed to start Music Generator API"
    kill $MUSIC_API_PID 2>/dev/null
    exit 1
fi

echo "✓ Music Generator API running (PID: $MUSIC_API_PID)"
echo ""

# Start mixer server
echo "🎚️ Starting Mixer Frontend Server on port 3000..."
cd mixer/server
npm start &
MIXER_PID=$!
cd ../..

# Wait for mixer to start
sleep 2

echo ""
echo "✅ Both servers are running!"
echo ""
echo "📍 URLs:"
echo "   Frontend:  http://localhost:3000"
echo "   Music API: http://localhost:5001"
echo ""
echo "🎤 Open http://localhost:3000 in your browser to start!"
echo ""
echo "To stop both servers, press Ctrl+C"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $MUSIC_API_PID 2>/dev/null
    kill $MIXER_PID 2>/dev/null
    # Kill any remaining python/node processes on these ports
    lsof -ti:5001 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo "✓ Servers stopped"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Wait for processes
wait
