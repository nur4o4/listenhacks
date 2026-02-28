# Singing Voice Generator using Eleven Labs API

Generate **REAL singing with music** or expressive speech from lyrics using the Eleven Labs API.

## ⭐ NEW: Music API with REAL Singing!

We now support the **Eleven Labs Music API** which generates **actual singing with melody and instrumental music** - not just spoken lyrics!

## Features

- 🎵 **Music Generation** - REAL singing with melody and music (⭐ RECOMMENDED)
- 🤖 **Interactive conversational agent** to help create lyrics
- 🎤 Text-to-Speech mode for spoken/expressive delivery  
- 📝 Read lyrics from text or file
- ⚙️ Customizable settings (genre, tempo, mood, voice, etc.)
- 🔊 Output as MP3 audio file
- ✨ Optional AI assistance for generating/improving lyrics (OpenAI)

## Prerequisites

1. **Eleven Labs API Account**
   - Sign up at [elevenlabs.io](https://elevenlabs.io)
   - Get your API key from the profile settings
   - **Note**: Music API (real singing) requires a paid plan

2. **Python 3.7+**

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

This installs:
- `requests` - For API calls
- `python-dotenv` - For loading environment variables
- `elevenlabs` - Official SDK for Music API

2. Set up your API key in `.env` file:

```bash
# Create .env file (if it doesn't exist)
cp .env.example .env

# Edit .env and add your key:
# ELEVEN_LABS_API_KEY=sk_your_key_here
```

Your `.env` file is automatically loaded by all scripts.

## Usage

### 🎵 Music Generation (REAL Singing) ⭐ RECOMMENDED

#### Interactive Mode:

```bash
python3 interactive_singing.py
```

Choose **option 2** for Music Generation when prompted!

#### Command-Line:

```bash
python3 generate_music.py \
  --lyrics "Twinkle twinkle little star, how I wonder what you are" \
  --genre pop \
  --tempo moderate \
  --mood happy \
  --length 30 \
  --output my_song.mp3
```

**See [MUSIC_API_GUIDE.md](MUSIC_API_GUIDE.md) for full documentation!**

---

### 🎤 Text-to-Speech Mode (Expressive Speaking)

For spoken/dramatic reading of lyrics (not actual singing):

#### Interactive Mode:

The easiest way to use this tool is with the interactive conversational agent:

```bash
python interactive_singing.py
``````bash
python3 interactive_singing.py
```

Choose **option 1** for Text-to-Speech when prompted.

This will guide you through:
1. **Conversation** - Discuss what kind of content you want
2. **Lyrics Creation** - Write your own or get AI help (optional)
3. **Mode Selection** - Choose Music (singing) or TTS (speaking)
4. **Settings** - Configure generation parameters
5. **Generation** - Create your audio file

#### With AI Assistance for Lyrics:

Enable AI to help generate or improve lyrics:

```bash
# Set OpenAI API key
export OPENAI_API_KEY="your_openai_api_key"

# Install OpenAI package
pip install openai

# Run with AI enabled
python interactive_singing.py --ai
```

The AI can:
- Generate complete lyrics based on your description
- Improve and refine your draft lyrics
- Suggest creative ideas

---

### 📝 Command-Line Mode

For direct command-line usage without the interactive agent:

#### List Available Voices

First, check which voices are available:

```bash
python generate_singing.py --list-voices --voice-id dummy
```

### Generate Singing from Text

```bash
python generate_singing.py \
  --lyrics "Twinkle twinkle little star, how I wonder what you are" \
  --voice-id "YOUR_VOICE_ID" \
  --output my_song.mp3
```

### Generate Singing from File

1. Create a lyrics file (e.g., `lyrics.txt`):
```txt
Twinkle twinkle little star
How I wonder what you are
Up above the world so high
Like a diamond in the sky
```

2. Generate the singing:
```bash
python generate_singing.py \
  --lyrics-file lyrics.txt \
  --voice-id "YOUR_VOICE_ID" \
  --output twinkle_star.mp3
```

### Advanced Options

Customize the voice characteristics:

```bash
python generate_singing.py \
  --lyrics-file lyrics.txt \
  --voice-id "YOUR_VOICE_ID" \
  --output song.mp3 \
  --model eleven_multilingual_v2 \
  --stability 0.7 \
  --similarity 0.8 \
  --style 0.3
```

**Parameters:**
- `--stability` (0.0-1.0): Lower = more variable/expressive, Higher = more stable/consistent
- `--similarity` (0.0-1.0): How closely to match the original voice
- `--style` (0.0-1.0): Amount of style exaggeration (0 = neutral)
- `--model`: Model to use (eleven_multilingual_v2, eleven_monolingual_v1, etc.)

## Python API Usage

You can also use it as a Python library:

```python
from generate_singing import ElevenLabsSingingGenerator

# Initialize
generator = ElevenLabsSingingGenerator(api_key="your_api_key")

# List voices
voices = generator.get_available_voices()
for voice in voices['voices']:
    print(f"{voice['name']}: {voice['voice_id']}")

# Generate singing from text
lyrics = """
Row, row, row your boat
Gently down the stream
Merrily, merrily, merrily, merrily
Life is but a dream
"""

output_path = generator.generate_singing(
    lyrics=lyrics,
    voice_id="YOUR_VOICE_ID",
    output_path="boat_song.mp3",
    stability=0.6,
    similarity_boost=0.8,
    style=0.2
)

print(f"Generated: {output_path}")

# Or generate from file
output_path = generator.generate_from_file(
    lyrics_file="my_lyrics.txt",
    voice_id="YOUR_VOICE_ID",
    output_path="my_song.mp3"
)
```

## Important Notes

### About Singing vs. Speech

⚠️ **Note**: Eleven Labs' API is primarily designed for text-to-speech, not true singing synthesis. While the API can deliver the lyrics with various vocal characteristics, it may not produce a fully "singing" voice like a dedicated singing synthesis system would.

For better singing results:
- Use voices that sound more expressive
- Adjust the `style` parameter (0.3-0.5 often works well for more musical delivery)
- Format your lyrics with natural phrasing and punctuation
- Consider adding musical notation or phonetic guides in the text

### Audio Format

The output is MP3 audio format (not MP4 video). If you need MP4:
```bash
# Convert MP3 to MP4 with a static image (requires ffmpeg)
ffmpeg -loop 1 -i image.jpg -i output.mp3 -c:v libx264 -c:a copy -shortest output.mp4
```

### API Limits

- Free tier: Limited characters per month
- Check your usage at [elevenlabs.io](https://elevenlabs.io)
- Each request consumes characters based on lyrics length

## Troubleshooting

**Error: "API key is required"**
- Make sure you've set the `ELEVEN_LABS_API_KEY` environment variable or pass `--api-key`

**Error: "Voice not found"**
- Run `--list-voices` to see available voice IDs
- Make sure you're using the voice ID, not the voice name

**Poor singing quality**
- Try different voices (some are more expressive)
- Adjust the `style` parameter (try 0.3-0.5)
- Experiment with `stability` and `similarity` settings
- Format lyrics with natural phrasing

**Rate limit errors**
- Wait a few seconds between requests
- Check your API quota on Eleven Labs website

## Examples

### Interactive Mode Example

```bash
$ python interactive_singing.py

🎵 INTERACTIVE SINGING VOICE GENERATOR 🎵
============================================================

Welcome! I'll help you create lyrics and generate a singing voice.

📝 First, let's talk about your song!

What would you like the song to be about? birthday celebration
What mood/style? (e.g., happy, sad, upbeat, romantic) happy and upbeat

✓ Great! A happy and upbeat song about birthday celebration

============================================================
LYRICS CREATION
============================================================

How would you like to create your lyrics?
1. I'll write them myself

Your choice (1-3): 1

📝 Enter your lyrics:
(Type your lyrics below. When done, enter a line with just 'DONE')
------------------------------------------------------------
Happy birthday to you
Happy birthday to you
Happy birthday dear friend
Happy birthday to you
DONE

[... continues with voice selection and generation ...]
```

### Command-Line Examples

#### Example 1: Simple Song
```bash
python generate_singing.py \
  --lyrics "Happy birthday to you, happy birthday to you" \
  --voice-id "21m00Tcm4TlvDq8ikWAM" \
  --output birthday.mp3
```

### Example 2: From File with Custom Settings
```bash
python generate_singing.py \
  --lyrics-file my_song.txt \
  --voice-id "21m00Tcm4TlvDq8ikWAM" \
  --output my_song.mp3 \
  --stability 0.6 \
  --similarity 0.8 \
  --style 0.4
```

## Resources

- [Eleven Labs Documentation](https://docs.elevenlabs.io/)
- [Voice Lab](https://elevenlabs.io/voice-lab) - Create custom voices
- [API Reference](https://api.elevenlabs.io/docs)

## License

This is a simple utility script for personal use. Make sure to comply with Eleven Labs' terms of service when using their API.
