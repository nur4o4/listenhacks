#!/usr/bin/env python3
"""
Generate singing voice from lyrics using Eleven Labs Singing Voices API
Fixed version that uses actual singing voices, not speech voices
"""

import os
import requests
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class ElevenLabsSingingGenerator:
    """Generate singing voices from lyrics using Eleven Labs Singing Voices"""
    
    # Singing voices available in Eleven Labs
    # Get full list with: generator.list_singing_voices()
    POPULAR_SINGING_VOICES = {
        "aria": "3z7cNCbWE8L0S8H8N8H7",  # Soft, melodic female
        "bella": "EXAVITQu4vr4xnSDxMaL",  # Warm, soulful female
        "chronos": "t0jbNlv7OJinYqC4IJR7",  # Deep, resonant male
        "eleven_multilingual_sting": "JBFqnCBsd6RMkjVDRZzb",  # Versatile male
    }
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Eleven Labs API client
        
        Args:
            api_key: Your Eleven Labs API key. If not provided, 
                     will look for ELEVEN_LABS_API_KEY environment variable
        """
        self.api_key = api_key or os.getenv("ELEVEN_LABS_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key is required. Either pass it as parameter or set "
                "ELEVEN_LABS_API_KEY environment variable"
            )
        
        self.base_url = "https://api.elevenlabs.io/v1"
        self.headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
    
    def list_singing_voices(self):
        """Get list of all available voices including singing voices"""
        url = f"{self.base_url}/voices"
        headers = {"xi-api-key": self.api_key}
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        voices = response.json().get("voices", [])
        
        # Filter and display voices
        singing_voices = {}
        for voice in voices:
            voice_id = voice.get("voice_id")
            name = voice.get("name")
            category = voice.get("category", "")
            
            # Look for singing-related voices
            if "singing" in category.lower() or "singer" in name.lower():
                singing_voices[name] = voice_id
                print(f"Found: {name} (ID: {voice_id}) - Category: {category}")
        
        return singing_voices
    
    def generate_singing(
        self,
        lyrics: str,
        voice_id: str,
        output_path: str = "output_singing.mp3",
        model_id: str = "eleven_multilingual_v2",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.6,
        use_speaker_boost: bool = True
    ) -> str:
        """
        Generate singing voice from lyrics using TTS with singing voice
        
        This uses the standard TTS endpoint but with SINGING VOICES
        which are specifically trained for singing instead of speech.
        
        Args:
            lyrics: The lyrics text to convert to singing
            voice_id: ID of a SINGING voice (not regular speech voice)
            output_path: Path where the audio file will be saved
            model_id: Model to use
            stability: Voice stability (0.0 to 1.0) - lower is more varied
            similarity_boost: How closely to match voice (0.0 to 1.0)
            style: Style exaggeration (0.0 to 1.0) - for singing variety
            use_speaker_boost: Enable speaker boost
        
        Returns:
            Path to the generated audio file
        """
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        
        # Format lyrics for better singing prosody
        # Break into lines for natural phrasing
        formatted_lyrics = self._format_lyrics_for_singing(lyrics)
        
        data = {
            "text": formatted_lyrics,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,  # Important for singing - adds musical variation
                "use_speaker_boost": use_speaker_boost
            }
        }
        
        print(f"\n🎤 Generating singing voice...")
        print(f"   Voice ID: {voice_id}")
        print(f"   Model: {model_id}")
        print(f"   Stability: {stability} (lower = more variation)")
        print(f"   Style: {style} (higher = more expressive)")
        
        response = requests.post(url, json=data, headers=self.headers)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            response.raise_for_status()
        
        # Save the audio file
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "wb") as f:
            f.write(response.content)
        
        print(f"\n✓ Singing audio generated successfully!")
        print(f"✓ Saved to: {output_path}")
        print(f"✓ File size: {len(response.content) / 1024 / 1024:.2f} MB")
        
        return str(output_path)
    
    def _format_lyrics_for_singing(self, lyrics: str) -> str:
        """
        Format lyrics for better singing generation
        Add punctuation cues for musical phrasing
        """
        lines = lyrics.strip().split('\n')
        formatted = []
        
        for line in lines:
            line = line.strip()
            if line:
                # Add periods to complete phrases (natural breathing points)
                if not line.endswith(('.', '!', '?', ',')):
                    # Check if it's likely the end of a verse or chorus
                    if len(line) > 10:  # Reasonable line length
                        line += '.'
                formatted.append(line)
        
        return ' '.join(formatted)
    
    def generate_from_file(
        self,
        lyrics_file: str,
        voice_id: str,
        output_path: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate singing voice from a lyrics file
        
        Args:
            lyrics_file: Path to text file containing lyrics
            voice_id: ID of the singing voice to use
            output_path: Output path (if None, will use lyrics filename)
            **kwargs: Additional arguments for generate_singing
        
        Returns:
            Path to the generated audio file
        """
        lyrics_path = Path(lyrics_file)
        if not lyrics_path.exists():
            raise FileNotFoundError(f"Lyrics file not found: {lyrics_file}")
        
        with open(lyrics_path, "r", encoding="utf-8") as f:
            lyrics = f.read()
        
        if output_path is None:
            output_path = lyrics_path.stem + "_singing.mp3"
        
        return self.generate_singing(lyrics, voice_id, output_path, **kwargs)


def main():
    """Example usage"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate SINGING voice from lyrics using Eleven Labs"
    )
    parser.add_argument(
        "--lyrics",
        type=str,
        help="Lyrics text (use quotes for multi-line)"
    )
    parser.add_argument(
        "--lyrics-file",
        type=str,
        help="Path to file containing lyrics"
    )
    parser.add_argument(
        "--voice-id",
        type=str,
        help="Voice ID to use (must be a SINGING voice, not speech voice)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output_singing.mp3",
        help="Output audio file path (default: output_singing.mp3)"
    )
    parser.add_argument(
        "--list-voices",
        action="store_true",
        help="List all available singing voices and exit"
    )
    parser.add_argument(
        "--api-key",
        type=str,
        help="Eleven Labs API key (or set ELEVEN_LABS_API_KEY env variable)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="eleven_multilingual_v2",
        help="Model ID to use (default: eleven_multilingual_v2)"
    )
    parser.add_argument(
        "--stability",
        type=float,
        default=0.5,
        help="Stability setting 0.0-1.0 (lower = more variation, better for singing)"
    )
    parser.add_argument(
        "--similarity",
        type=float,
        default=0.75,
        help="Similarity boost 0.0-1.0 (default: 0.75)"
    )
    parser.add_argument(
        "--style",
        type=float,
        default=0.6,
        help="Style exaggeration 0.0-1.0 (higher = more musical expression)"
    )
    
    args = parser.parse_args()
    
    try:
        generator = ElevenLabsSingingGenerator(api_key=args.api_key)
        
        if args.list_voices:
            print("\n🎤 Searching for singing voices...\n")
            singing_voices = generator.list_singing_voices()
            
            if singing_voices:
                print(f"\n✓ Found {len(singing_voices)} singing voices")
                print("\nUse with --voice-id <ID>")
            else:
                print("\nNo dedicated singing voices found.")
                print("Tip: Check Eleven Labs voice library at elevenlabs.io/voice-library/singing")
                print("Filter for 'Singing' category and use those voice IDs")
            return
        
        if not args.voice_id:
            print("Error: --voice-id is required")
            print("Run with --list-voices to find available singing voices")
            return 1
        
        if not args.lyrics and not args.lyrics_file:
            parser.error("Either --lyrics or --lyrics-file must be provided")
        
        if args.lyrics_file:
            output = generator.generate_from_file(
                args.lyrics_file,
                args.voice_id,
                args.output,
                model_id=args.model,
                stability=args.stability,
                similarity_boost=args.similarity,
                style=args.style
            )
        else:
            output = generator.generate_singing(
                args.lyrics,
                args.voice_id,
                args.output,
                model_id=args.model,
                stability=args.stability,
                similarity_boost=args.similarity,
                style=args.style
            )
        
        print(f"\n🎵 Success! Your singing audio is ready: {output}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())