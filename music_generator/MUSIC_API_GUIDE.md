# 🎵 Eleven Labs Music API - REAL Singing Generation!

## ⭐ This is What You Want!

The **Eleven Labs Music API** generates **REAL singing with music and melody**, not just spoken lyrics!

## Quick Start

### 1. Install the SDK

```bash
pip install elevenlabs python-dotenv
```

### 2. Make sure your API key is set in `.env`

Your `.env` file should have:
```
ELEVEN_LABS_API_KEY=sk_your_key_here
```

### 3. Generate Music with Singing!

#### Interactive Mode (Easiest):

```bash
python3 interactive_singing.py
```

When prompted, choose option **2** for Music Generation (REAL singing)!

#### Command-Line Mode:

```bash
python3 generate_music.py \
  --lyrics "Twinkle twinkle little star, how I wonder what you are" \
  --genre pop \
  --tempo moderate \
  --mood happy \
  --length 30 \
  --output my_song.mp3
```

## Examples

### Example 1: Happy Pop Song

```bash
python3 generate_music.py \
  --lyrics "Happy birthday to you, happy birthday to you, happy birthday dear friend, happy birthday to you!" \
  --genre pop \
  --tempo moderate \
  --mood happy \
  --length 20 \
  --output birthday_song.mp3
```

### Example 2: Rock Anthem

```bash
python3 generate_music.py \
  --lyrics "We are the champions, we are the fighters, standing together, reaching higher!" \
  --genre rock \
  --tempo fast \
  --mood energetic \
  --length 30 \
  --output rock_anthem.mp3
```

### Example 3: From Lyrics File

```bash
python3 generate_music.py \
  --lyrics-file example_lyrics.txt \
  --genre folk \
  --tempo slow \
  --mood peaceful \
  --length 45 \
  --output twinkle_star_music.mp3
```

## Parameters Explained

### `--genre`
Choose from:
- `pop` - Modern, catchy melodies
- `rock` - Electric guitars, powerful drums  
- `jazz` - Smooth, improvisation
- `country` - Acoustic, storytelling
- `electronic` - Synths, electronic beats
- `rap` - Hip-hop beats, rhythmic flow
- `r&b` - Smooth grooves, harmonies
- `folk` - Acoustic, natural
- `classical` - Orchestral, operatic

### `--tempo`
- `slow` - Ballad style
- `moderate` - Normal pace
- `fast` - Upbeat, energetic
- Or specify BPM: `120 bpm`

### `--mood`
- `happy`, `sad`, `energetic`, `romantic`, `peaceful`, `dramatic`, etc.

### `--length`
Time in seconds (e.g., `30` for 30 seconds)
- Minimum: ~10 seconds
- Maximum: depends on your plan
- Default: 30 seconds

## 🆚 Music API vs Text-to-Speech

| Feature | Music API ⭐ | Text-to-Speech |
|---------|------------|----------------|
| **Singing** | ✅ Real singing with melody | ❌ Speaks lyrics |
| **Music** | ✅ Full instrumental | ❌ No music |
| **Melody** | ✅ Musical notes | ❌ Monotone speech |
| **Use Case** | Songs, jingles, musical content | Audiobooks, narration |

## Tips for Best Results

### 1. Keep Lyrics Clear
```
Good:
"Happy birthday to you
Happy birthday to you"

Not as good:
"Happybirthdaytoyou" (no spacing)
```

### 2. Match Genre to Lyrics
- Love songs → `romantic` + `r&b` or `pop`
- Party songs → `energetic` + `electronic` or `pop`
- Sad songs → `sad` + `folk` or `jazz`

### 3. Adjust Length Based on Lyrics
- 2-4 short lines: 20-30 seconds
- Full verse + chorus: 30-45 seconds
- Multiple verses: 45-60 seconds

### 4. Avoid Copyrighted Content
❌ Don't use:
- Artist names ("Make it sound like Taylor Swift")
- Song titles ("Create 'Bohemian Rhapsody'")
- Copyrighted lyrics from real songs

The API will suggest alternatives if you accidentally do this.

## Advanced: Using Composition Plans

For more control, use `--use-plan` to generate with a detailed composition plan:

```bash
python3 generate_music.py \
  --lyrics "Your lyrics here" \
  --genre pop \
  --use-plan \
  --output song.mp3
```

This gives you more granular control over each section of the music.

## Python API

You can also use it programmatically:

```python
from generate_music import ElevenLabsMusicGenerator

generator = ElevenLabsMusicGenerator()

output = generator.generate_music_from_lyrics(
    lyrics="Twinkle twinkle little star",
    genre="pop",
    tempo="moderate",
    mood="happy",
    music_length_ms=30000,  # 30 seconds
    output_path="my_song.mp3"
)

print(f"Generated: {output}")
```

## Pricing Note

⚠️ The Eleven Labs Music API is **only available to paid users**. Check your plan at [elevenlabs.io](https://elevenlabs.io).

## Troubleshooting

**Error: "elevenlabs package not installed"**
```bash
pip install elevenlabs
```

**Error: "API key is required"**
- Make sure `.env` file has `ELEVEN_LABS_API_KEY=your_key`
- Or export it: `export ELEVEN_LABS_API_KEY=your_key`

**Error: "bad_prompt"**
- The API detected copyrighted material or inappropriate content
- Check the error message for suggested alternatives
- Avoid artist names, song titles, or copyrighted lyrics

**Music doesn't match my lyrics tone**
- Adjust the `--mood` parameter
- Try different `--genre` options
- Make lyrics more descriptive

## 🎵 Now You Can Create REAL Music!

This is what you wanted - actual singing with melody and instrumentalmusic! Not just spoken words. Try it out:

```bash
python3 interactive_singing.py
```

Choose option **2** and create your first song! 🎤✨
