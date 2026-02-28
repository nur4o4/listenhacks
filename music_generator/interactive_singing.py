#!/usr/bin/env python3
"""
Interactive conversational agent for creating and generating singing voices
"""

import os
import sys
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from generate_singing import ElevenLabsSingingGenerator


class LyricsConversationAgent:
    """Interactive agent to help create lyrics and generate singing voice"""
    
    def __init__(self, use_ai: bool = False, openai_api_key: Optional[str] = None):
        """
        Initialize the conversation agent
        
        Args:
            use_ai: Whether to use AI (OpenAI) to help generate lyrics
            openai_api_key: OpenAI API key if using AI assistance
        """
        self.use_ai = use_ai
        self.openai_client = None
        
        if use_ai:
            try:
                from openai import OpenAI
                api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
                if not api_key:
                    print("⚠️  Warning: AI mode requested but no OpenAI API key found.")
                    print("   Set OPENAI_API_KEY environment variable or pass as parameter.")
                    print("   Continuing without AI assistance...\n")
                    self.use_ai = False
                else:
                    self.openai_client = OpenAI(api_key=api_key)
                    print("✓ AI assistant enabled\n")
            except ImportError:
                print("⚠️  Warning: 'openai' package not installed.")
                print("   Run: pip install openai")
                print("   Continuing without AI assistance...\n")
                self.use_ai = False
    
    def ai_generate_lyrics(self, prompt: str, style: str = "song") -> str:
        """Use AI to generate lyrics based on prompt"""
        if not self.use_ai or not self.openai_client:
            return ""
        
        try:
            system_prompt = f"""You are a creative lyricist. Generate {style} lyrics based on the user's request. 
Keep it appropriate, creative, and singable. Format with proper line breaks and verses."""
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=500
            )
            
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️  AI generation failed: {e}")
            return ""
    
    def ai_improve_lyrics(self, lyrics: str) -> str:
        """Use AI to improve/refine existing lyrics"""
        if not self.use_ai or not self.openai_client:
            return lyrics
        
        try:
            system_prompt = """You are a lyricist editor. Improve the given lyrics by:
- Making them more singable and rhythmic
- Fixing grammar/flow issues
- Keeping the original intent and meaning
- Not changing much if they're already good
Return only the improved lyrics."""
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": lyrics}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️  AI improvement failed: {e}")
            return lyrics
    
    def get_multiline_input(self, prompt: str) -> str:
        """Get multiline input from user"""
        print(prompt)
        print("(Type your lyrics below. When done, enter a line with just 'DONE')")
        print("-" * 60)
        
        lines = []
        while True:
            try:
                line = input()
                if line.strip().upper() == "DONE":
                    break
                lines.append(line)
            except EOFError:
                break
        
        return "\n".join(lines)
    
    def display_lyrics(self, lyrics: str):
        """Display lyrics in a nice format"""
        print("\n" + "=" * 60)
        print("YOUR LYRICS:")
        print("=" * 60)
        print(lyrics)
        print("=" * 60 + "\n")
    
    def get_voice_choice(self, generator: ElevenLabsSingingGenerator) -> Optional[str]:
        """Let user choose a voice"""
        try:
            print("📋 Fetching available voices...")
            voices_data = generator.get_available_voices()
            voices = voices_data.get("voices", [])
            
            if not voices:
                print("❌ No voices found!")
                return None
            
            # Recommend specific voices for more expressive delivery
            recommended = ['cgSgspJ2msm6clMCkdW9', 'pFZP5JQG7iQjIQuC4Bku', 'EXAVITQu4vr4xnSDxMaL']
            
            print("\n⚠️  NOTE: Eleven Labs does TEXT-TO-SPEECH (speaking lyrics with emotion),")
            print("   not true singing synthesis. For actual singing, try Suno AI or Udio.")
            print("   We'll use the most expressive voices for best results.\n")
            
            print("\n🎤 Available Voices (⭐ = Recommended for expressive delivery):")
            print("-" * 60)
            for idx, voice in enumerate(voices, 1):
                name = voice.get('name', 'Unknown')
                voice_id = voice.get('voice_id', '')
                category = voice.get('category', 'N/A')
                star = "⭐ " if voice_id in recommended else "   "
                print(f"{star}{idx}. {name} ({category})")
                print(f"      ID: {voice_id}")
            print("-" * 60)
            
            while True:
                choice = input(f"\nChoose a voice (1-{len(voices)}) or enter voice ID directly: ").strip()
                
                # Check if it's a number
                if choice.isdigit():
                    idx = int(choice) - 1
                    if 0 <= idx < len(voices):
                        return voices[idx]['voice_id']
                    else:
                        print(f"Invalid choice. Please enter 1-{len(voices)}")
                else:
                    # Assume it's a voice ID
                    return choice
                    
        except Exception as e:
            print(f"❌ Error fetching voices: {e}")
            return None
    
    def run_conversation(self):
        """Run the interactive conversation"""
        print("=" * 60)
        print("🎵 INTERACTIVE SINGING VOICE GENERATOR 🎵")
        print("=" * 60)
        print("\nWelcome! I'll help you create lyrics and generate singing.")
        print()
        
        # Choose mode: TTS or Music
        print("Choose generation mode:")
        print("1. Text-to-Speech (speaks lyrics with emotion - NO melody)")
        print("2. Music Generation (REAL singing with music and melody) ⭐ RECOMMENDED")
        print()
        mode_choice = input("Your choice (1 or 2, default: 2): ").strip()
        use_music_api = mode_choice != "1"
        
        if use_music_api:
            print("\n✨ Using Eleven Labs Music API for real singing!")
        else:
            print("\n📢 Using Text-to-Speech (will speak, not sing)")
        print()
        
        # Step 1: Discuss what they want
        print("📝 First, let's talk about your song!\n")
        
        song_about = input("What would you like the song to be about? ").strip()
        if not song_about:
            song_about = "general topic"
        
        mood = input("What mood/style? (e.g., happy, sad, upbeat, romantic) ").strip()
        if not mood:
            mood = "any style"
        
        print(f"\n✓ Great! A {mood} song about {song_about}")
        
        # Step 2: Get or generate lyrics
        print("\n" + "=" * 60)
        print("LYRICS CREATION")
        print("=" * 60)
        print("\nHow would you like to create your lyrics?")
        print("1. I'll write them myself")
        if self.use_ai:
            print("2. Help me generate lyrics with AI")
            print("3. I'll write draft lyrics and AI can improve them")
        
        choice = input("\nYour choice (1-3): ").strip()
        
        lyrics = ""
        
        if choice == "1":
            # Manual lyrics entry
            lyrics = self.get_multiline_input("\n📝 Enter your lyrics:")
        
        elif choice == "2" and self.use_ai:
            # AI generation
            print("\n🤖 Generating lyrics with AI...")
            prompt = f"Write {mood} song lyrics about {song_about}. Keep it short (2-4 verses)."
            lyrics = self.ai_generate_lyrics(prompt, mood)
            if lyrics:
                self.display_lyrics(lyrics)
                
                edit = input("Would you like to edit these lyrics? (y/n) ").strip().lower()
                if edit == 'y':
                    print("\nEnter your edited version:")
                    lyrics = self.get_multiline_input("📝 Enter your lyrics:")
            else:
                print("❌ AI generation failed. Let's try manual entry.")
                lyrics = self.get_multiline_input("\n📝 Enter your lyrics:")
        
        elif choice == "3" and self.use_ai:
            # User writes, AI improves
            lyrics = self.get_multiline_input("\n📝 Enter your draft lyrics:")
            
            print("\n🤖 AI is improving your lyrics...")
            improved = self.ai_improve_lyrics(lyrics)
            
            print("\n--- ORIGINAL ---")
            print(lyrics)
            print("\n--- AI IMPROVED ---")
            print(improved)
            
            use_improved = input("\nUse AI improved version? (y/n) ").strip().lower()
            if use_improved == 'y':
                lyrics = improved
        
        else:
            # Fallback to manual
            lyrics = self.get_multiline_input("\n📝 Enter your lyrics:")
        
        if not lyrics.strip():
            print("\n❌ No lyrics entered. Exiting.")
            return
        
        # Display final lyrics
        self.display_lyrics(lyrics)
        
        # Confirm before generating
        confirm = input("Ready to generate? (y/n) ").strip().lower()
        if confirm != 'y':
            print("\n👋 Okay, maybe next time!")
            return
        
        # Step 3: Initialize generator based on mode
        print("\n" + "=" * 60)
        print("GENERATION SETUP")
        print("=" * 60)
        
            try:
                generator = ElevenLabsSingingGenerator()
            except ValueError as e:
                print(f"\n❌ {e}")
                print("\nPlease set your Eleven Labs API key:")
                print("  export ELEVEN_LABS_API_KEY='your_api_key'")
                    print(f"\n❌ {e}")
                return
            except ImportError as e:
                print(f"\n❌ {e}")
                print("Install with: pip install elevenlabs")
                return
            
            print("\n🎼 Music Settings:")
            genre = input("Genre (pop, rock, jazz, country, electronic, etc., default: pop): ").strip() or "pop"
            tempo = input("Tempo (slow, moderate, fast, or BPM like '120 bpm', default: moderate): ").strip() or "moderate"
            mood_input = input(f"Mood (happy, sad, energetic, romantic, default: {mood}): ").strip() or mood
            length_input = input("Length in seconds (default: 30): ").strip()
            try:
                length_ms = int(length_input) * 1000 if length_input else 30000
            except:
                length_ms = 30000
            
            output_default = "my_music.mp3"
            output = input(f"\nOutput filename (default: {output_default}): ").strip() or output_default
            if not output.endswith('.mp3'):
                output += '.mp3'
            
            # Generate music
            print("\n" + "=" * 60)
            print("🎵 GENERATING MUSIC WITH SINGING...")
            print("=" * 60)
            
            try:
                output_path = generator.generate_music_from_lyrics(
                    lyrics=lyrics,
                    output_path=output,
                    genre=genre,
                    tempo=tempo,
                    mood=mood_input,
                    music_length_ms=length_ms
                )
                
                print("\n" + "=" * 60)
                print("✨ SUCCESS! ✨")
                print("=" * 60)
                print(f"\n🎵 Your music with singing is ready: {output_path}")
                print(f"\nTo play it:")
                print(f"  open {output_path}  # macOS")
                
            except Exception as e:
                print(f"\n❌ Error generating music: {e}")
                return
            
        else:
            # Text-to-Speech mode (original)
        
        try:
            generator = ElevenLabsSingingGenerator()
        except ValueError as e:
            print(f"\n❌ {e}")
            print("\nPlease set your Eleven Labs API key:")
            print("  export ELEVEN_LABS_API_KEY='your_api_key'")
            return
            
            # Step 4: Choose voice
            voice_id = self.get_voice_choice(generator)
            if not voice_id:
                print("\n❌ No voice selected. Exiting.")
                return
            
            print(f"\n✓ Voice selected: {voice_id}")
            
            # Step 5: Choose output filename
            default_output = "my_song.mp3"
            output = input(f"\nOutput filename (default: {default_output}): ").strip()
            if not output:
                output = default_output
            
            if not output.endswith('.mp3'):
                output += '.mp3'
            
            # Step 6: Voice settings
            print("\n⚙️  Voice Settings (press Enter for optimized defaults)")
            print("   💡 TIP: Higher style = more expressive/emotional delivery")
            try:
                stability = input("Stability (0.0-1.0, default: 0.3 for more variation): ").strip()
                stability = float(stability) if stability else 0.3
                
                similarity = input("Similarity (0.0-1.0, default: 0.75): ").strip()
                similarity = float(similarity) if similarity else 0.75
                
                style = input("Style/Expression (0.0-1.0, default: 0.6 for expressive): ").strip()
                style = float(style) if style else 0.6
            except ValueError:
                print("⚠️  Invalid input, using optimized defaults")
                stability, similarity, style = 0.3, 0.75, 0.6
            
            # Step 7: Generate!
            print("\n" + "=" * 60)
            print("🎵 GENERATING VOICE...")
            print("=" * 60)
            
            try:
                output_path = generator.generate_singing(
                    lyrics=lyrics,
                    voice_id=voice_id,
                    output_path=output,
                    stability=stability,
                    similarity_boost=similarity,
                    style=style
                )
                
                print("\n" + "=" * 60)
                print("✨ SUCCESS! ✨")
                print("=" * 60)
                print(f"\n🎵 Your audio is ready: {output_path}")
                print(f"\nTo play it:")
                print(f"  open {output_path}  # macOS")
                
            except Exception as e:
                print(f"\n❌ Error generating audio: {e}")
                return
        
        # Save lyrics for reference
        with open("lyrics_history.txt", "a", encoding="utf-8") as f:
            f.write("\n" + "=" * 60 + "\n")
            f.write(f"Generated: {output_path if 'output_path' in locals() else 'unknown'}\n")
            f.write(f"Mode: {'Music API' if use_music_api else 'Text-to-Speech'}\n")
            f.write("=" * 60 + "\n")
            f.write(lyrics)
            f.write("\n" + "=" * 60 + "\n\n")
        
        # Ask if they want to generate another
        print("\n" + "=" * 60)
        another = input("\n🎤 Generate another song? (y/n) ").strip().lower()
        if another == 'y':
            print("\n\n")
            self.run_conversation()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Interactive agent for creating and generating singing voices"
    )
    parser.add_argument(
        "--ai",
        action="store_true",
        help="Enable AI assistance for lyrics generation (requires OpenAI API key)"
    )
    parser.add_argument(
        "--openai-key",
        type=str,
        help="OpenAI API key (or set OPENAI_API_KEY env variable)"
    )
    
    args = parser.parse_args()
    
    agent = LyricsConversationAgent(use_ai=args.ai, openai_api_key=args.openai_key)
    
    try:
        agent.run_conversation()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
        return 0
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
