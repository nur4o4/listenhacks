#!/usr/bin/env python3
"""
Generate actual singing/music from lyrics using Eleven Labs Music API
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class ElevenLabsMusicGenerator:
    """Generate real singing and music using Eleven Labs Music API"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Eleven Labs Music API client
        
        Args:
            api_key: Your Eleven Labs API key. If not provided, 
                     will look for ELEVEN_LABS_API_KEY environment variable
        """
        try:
            from elevenlabs.client import ElevenLabs
            self.ElevenLabs = ElevenLabs
        except ImportError:
            raise ImportError(
                "elevenlabs package not installed. Install with: pip install elevenlabs"
            )
        
        self.api_key = api_key or os.getenv("ELEVEN_LABS_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key is required. Either pass it as parameter or set "
                "ELEVEN_LABS_API_KEY environment variable"
            )
        
        self.client = self.ElevenLabs(api_key=self.api_key)
    
    def generate_music_from_lyrics(
        self,
        lyrics: str,
        output_path: str = "output_music.mp3",
        genre: str = "pop",
        tempo: str = "moderate",
        mood: str = "upbeat",
        music_length_ms: int = 30000,
        use_composition_plan: bool = False
    ) -> str:
        """
        Generate singing/music from lyrics
        
        Args:
            lyrics: The lyrics to sing
            output_path: Path where the audio file will be saved
            genre: Music genre (e.g., pop, rock, jazz, country, etc.)
            tempo: Tempo (e.g., slow, moderate, fast, 120 bpm)
            mood: Mood/feeling (e.g., happy, sad, energetic, romantic)
            music_length_ms: Length of music in milliseconds (default: 30 seconds)
            use_composition_plan: Whether to generate with detailed composition plan
        
        Returns:
            Path to the generated audio file
        """
        # Build prompt from lyrics and parameters
        prompt = self._build_prompt(lyrics, genre, tempo, mood)
        
        print(f"🎵 Generating music with REAL singing...")
        print(f"Genre: {genre} | Tempo: {tempo} | Mood: {mood}")
        print(f"Length: {music_length_ms / 1000} seconds")
        print(f"Lyrics: {lyrics[:100]}..." if len(lyrics) > 100 else f"Lyrics: {lyrics}")
        print()
        
        try:
            if use_composition_plan:
                # Generate with detailed composition plan
                print("📋 Creating composition plan first...")
                composition_plan = self.client.music.composition_plan.create(
                    prompt=prompt,
                    music_length_ms=music_length_ms
                )
                print("✓ Composition plan created")
                
                # Generate music from plan
                track = self.client.music.compose(
                    composition_plan=composition_plan,
                )
            else:
                # Direct generation from prompt
                track = self.client.music.compose(
                    prompt=prompt,
                    music_length_ms=music_length_ms,
                )
            
            # Save the track
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            print("💾 Saving track...")
            total_bytes = 0
            with open(output_path, "wb") as f:
                for chunk in track:
                    f.write(chunk)
                    total_bytes += len(chunk)
            
            print(f"✓ Music generated successfully: {output_path}")
            print(f"✓ File size: {total_bytes / 1024:.2f} KB")
            
            return str(output_path)
            
        except Exception as e:
            error_msg = str(e)
            
            # Handle copyright/bad prompt errors
            if hasattr(e, 'body') and isinstance(e.body, dict):
                detail = e.body.get('detail', {})
                if detail.get('status') == 'bad_prompt':
                    suggestion = detail.get('data', {}).get('prompt_suggestion')
                    if suggestion:
                        print(f"⚠️  Original prompt had issues. Suggestion: {suggestion}")
                        print("Retrying with suggested prompt...")
                        
                        track = self.client.music.compose(
                            prompt=suggestion,
                            music_length_ms=music_length_ms,
                        )
                        
                        output_path = Path(output_path)
                        with open(output_path, "wb") as f:
                            for chunk in track:
                                f.write(chunk)
                        
                        print(f"✓ Music generated with adjusted prompt: {output_path}")
                        return str(output_path)
            
            raise Exception(f"Failed to generate music: {error_msg}")
    
    def _build_prompt(self, lyrics: str, genre: str, tempo: str, mood: str) -> str:
        """Build a music generation prompt from lyrics and parameters"""
        
        # Format lyrics for the prompt
        lyrics_formatted = lyrics.strip()
        
        # Build detailed prompt
        prompt_parts = [
            f"Create a {mood} {genre} song with {tempo} tempo.",
            f"The song should have vocals singing the following lyrics:",
            f'"{lyrics_formatted}"',
        ]
        
        # Add genre-specific details
        genre_details = {
            "pop": "with catchy melodies, modern production, and clear vocals",
            "rock": "with electric guitars, driving drums, and powerful vocals",
            "jazz": "with smooth instrumentation, improvisation, and soulful vocals",
            "country": "with acoustic guitar, storytelling vocals, and warm harmonies",
            "electronic": "with synth layers, electronic beats, and processed vocals",
            "rap": "with hip-hop beats, rhythmic flow, and strong bass",
            "r&b": "with smooth grooves, emotional vocals, and rich harmonies",
            "folk": "with acoustic instruments, natural vocals, and simple arrangements",
            "classical": "with orchestral elements and operatic or refined vocals",
        }
        
        if genre.lower() in genre_details:
            prompt_parts.append(genre_details[genre.lower()])
        
        return " ".join(prompt_parts)
    
    def generate_from_file(
        self,
        lyrics_file: str,
        output_path: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate music from a lyrics file
        
        Args:
            lyrics_file: Path to text file containing lyrics
            output_path: Output path (if None, will use lyrics filename)
            **kwargs: Additional arguments for generate_music_from_lyrics
        
        Returns:
            Path to the generated audio file
        """
        lyrics_path = Path(lyrics_file)
        if not lyrics_path.exists():
            raise FileNotFoundError(f"Lyrics file not found: {lyrics_file}")
        
        with open(lyrics_path, "r", encoding="utf-8") as f:
            lyrics = f.read()
        
        if output_path is None:
            output_path = lyrics_path.stem + "_music.mp3"
        
        return self.generate_music_from_lyrics(lyrics, output_path, **kwargs)


def main():
    """Example usage"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate real singing/music from lyrics using Eleven Labs Music API"
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
        "--output",
        type=str,
        default="output_music.mp3",
        help="Output audio file path (default: output_music.mp3)"
    )
    parser.add_argument(
        "--genre",
        type=str,
        default="pop",
        help="Music genre (pop, rock, jazz, country, electronic, etc.)"
    )
    parser.add_argument(
        "--tempo",
        type=str,
        default="moderate",
        help="Tempo (slow, moderate, fast, or specific BPM like '120 bpm')"
    )
    parser.add_argument(
        "--mood",
        type=str,
        default="upbeat",
        help="Mood/feeling (happy, sad, energetic, romantic, etc.)"
    )
    parser.add_argument(
        "--length",
        type=int,
        default=30000,
        help="Music length in milliseconds (default: 30000 = 30 seconds)"
    )
    parser.add_argument(
        "--api-key",
        type=str,
        help="Eleven Labs API key (or set ELEVEN_LABS_API_KEY env variable)"
    )
    parser.add_argument(
        "--use-plan",
        action="store_true",
        help="Use detailed composition plan for more control"
    )
    
    args = parser.parse_args()
    
    if not args.lyrics and not args.lyrics_file:
        parser.error("Either --lyrics or --lyrics-file must be provided")
    
    try:
        generator = ElevenLabsMusicGenerator(api_key=args.api_key)
        
        if args.lyrics_file:
            output = generator.generate_from_file(
                args.lyrics_file,
                args.output,
                genre=args.genre,
                tempo=args.tempo,
                mood=args.mood,
                music_length_ms=args.length,
                use_composition_plan=args.use_plan
            )
        else:
            output = generator.generate_music_from_lyrics(
                args.lyrics,
                args.output,
                genre=args.genre,
                tempo=args.tempo,
                mood=args.mood,
                music_length_ms=args.length,
                use_composition_plan=args.use_plan
            )
        
        print(f"\n🎵 Success! Your music with singing is ready at: {output}")
        print(f"\nTo play it:")
        print(f"  open {output}  # macOS")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
