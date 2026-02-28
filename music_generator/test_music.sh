#!/bin/bash
# Quick test for REAL singing with Eleven Labs Music API

echo "🎵 Testing REAL Singing Generation with Music API"
echo "=================================================="
echo ""

cd /Users/nuthanantharmarajah/testing

python3 generate_music.py \
  --lyrics "Happy birthday to you, happy birthday to you, happy birthday dear friend, happy birthday to you!" \
  --genre pop \
  --tempo moderate \
  --mood happy \
  --length 25 \
  --output test_music_singing.mp3

if [ $? -eq 0 ]; then
    echo ""
    echo "✨ Success! Playing your music..."
    open test_music_singing.mp3
else
    echo ""
    echo "❌ Generation failed. Check the error above."
fi
