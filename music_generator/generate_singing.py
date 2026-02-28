#!/usr/bin/env python3
"""
Generate singing voice from lyrics using Eleven Labs API
"""

import os
import requests
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class ElevenLabsSingingGenerator:
    """Generate singing voices from lyrics using Eleven Labs API"""
    
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
    
    def get_available_voices(self):
        """Get list of available voices"""
        url = f"{self.base_url}/voices"
        headers = {"xi-api-key": self.api_key}
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        return response.json()
    
    def generate_singing(
        self,
        lyrics: str,
        voice_id: str,
        output_path: str = "output_singing.mp3",
        model_id: str = "eleven_multilingual_v2",
        stability: float = 0.3,
        similarity_boost: float = 0.75,
        style: float = 0.6,
        use_speaker_boost: bool = True
    ) -> str:
        """
        Generate singing voice from lyrics
        
        Args:
            lyrics: The lyrics text to convert to singing
            voice_id: ID of the voice to use
            output_path: Path where the audio file will be saved
            model_id: Model to use (eleven_multilingual_v2, eleven_monolingual_v1, etc.)
            stability: Stability setting (0.0 to 1.0)
            similarity_boost: Similarity boost setting (0.0 to 1.0)
            style: Style exaggeration (0.0 to 1.0)
            use_speaker_boost: Enable speaker boost for better clarity
        
        Returns:
            Path to the generated audio file
        """
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        
        data = {
            "text": lyrics,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": use_speaker_boost
            }
        }
        
        print(f"Generating singing voice for lyrics...")
        print(f"Voice ID: {voice_id}")
        print(f"Model: {model_id}")
        
        response = requests.post(url, json=data, headers=self.headers)
        response.raise_for_status()
        
        # Save the audio file
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "wb") as f:
            f.write(response.content)
        
        print(f"✓ Singing audio generated successfully: {output_path}")
        print(f"✓ File size: {len(response.content) / 1024:.2f} KB")
        
        return str(output_path)
    
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
            voice_id: ID of the voice to use
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
        description="Generate singing voice from lyrics using Eleven Labs API"
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
        required=True,
        help="Voice ID to use (run with --list-voices to see available voices)"
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
        help="List available voices and exit"
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
        help="Stability setting 0.0-1.0 (default: 0.5)"
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
        default=0.0,
        help="Style exaggeration 0.0-1.0 (default: 0.0)"
    )
    
    args = parser.parse_args()
    
    try:
        generator = ElevenLabsSingingGenerator(api_key=args.api_key)
        
        if args.list_voices:
            voices = generator.get_available_voices()
            print("\n📋 Available Voices:")
            print("-" * 80)
            for voice in voices.get("voices", []):
                print(f"  Name: {voice['name']}")
                print(f"  ID: {voice['voice_id']}")
                print(f"  Category: {voice.get('category', 'N/A')}")
                print(f"  Description: {voice.get('description', 'N/A')}")
                print("-" * 80)
            return
        
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
        
        print(f"\n🎵 Success! Your singing audio is ready at: {output}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
